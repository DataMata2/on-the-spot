// TTS audio cache: sha256(voice + model + format + text) → MP3 bytes, on disk (TTS_CACHE_DIR, a docker volume in
// production) with a small in-memory LRU in front. A hit costs no ElevenLabs credits and no daily budget.
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

export function ttsCacheKey(voiceId: string, modelId: string, format: string, text: string): string {
  return createHash("sha256").update(`${voiceId}\n${modelId}\n${format}\n${text}`).digest("hex");
}

export class TtsCache {
  private memory = new Map<string, Uint8Array>();

  constructor(
    private readonly dir: string | null,
    private readonly maxMemoryItems = 64,
  ) {}

  private file(key: string): string | null {
    return this.dir && /^[0-9a-f]{64}$/.test(key) ? join(this.dir, `${key}.mp3`) : null;
  }

  async get(key: string): Promise<Uint8Array | null> {
    const hit = this.memory.get(key);
    if (hit) {
      // Refresh recency.
      this.memory.delete(key);
      this.memory.set(key, hit);
      return hit;
    }
    const file = this.file(key);
    if (!file) return null;
    try {
      const bytes = new Uint8Array(await readFile(file));
      if (bytes.byteLength === 0) return null;
      this.remember(key, bytes);
      return bytes;
    } catch {
      return null;
    }
  }

  async set(key: string, bytes: Uint8Array): Promise<void> {
    this.remember(key, bytes);
    const file = this.file(key);
    if (!file || !this.dir) return;
    try {
      await mkdir(this.dir, { recursive: true });
      const tmp = `${file}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
      await writeFile(tmp, bytes);
      await rename(tmp, file);
    } catch (err) {
      console.warn("[elevenlabs] tts cache write failed:", err instanceof Error ? err.message : err);
    }
  }

  private remember(key: string, bytes: Uint8Array) {
    this.memory.delete(key);
    this.memory.set(key, bytes);
    while (this.memory.size > this.maxMemoryItems) {
      const oldest = this.memory.keys().next().value;
      if (oldest === undefined) break;
      this.memory.delete(oldest);
    }
  }
}
