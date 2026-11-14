#!/usr/bin/env bash
# Pre-generate the jury's TTS audio so their runs cost no credits. Dry run first (prints the texts and the character
# total; the server refuses more than 4,000 characters), then generates what isn't cached yet.
# Usage: TTS_PREWARM_SECRET=... scripts/prewarm-tts.sh [base-url] [--yes]     (default https://speak.incode.kz)
set -euo pipefail

BASE="${1:-https://speak.incode.kz}"
: "${TTS_PREWARM_SECRET:?set TTS_PREWARM_SECRET (same value as on the server)}"

call() { curl -fsS -X POST -H "authorization: Bearer $TTS_PREWARM_SECRET" "$BASE/api/speech/prewarm$1"; }

summary() {
  python3 -c "$(cat <<'PY'
import json, sys
from collections import Counter
d = json.load(sys.stdin)
if d.get("dryRun"):
    for i in d["items"]:
        print("  %-7s %4d  %s" % (i["status"], i["chars"], i["preview"]))
    print("total %d chars (~%.0f credits); not cached yet: %d chars (~%.0f credits)" % (d["totalChars"], d["estCredits"], d["newChars"], d["newCredits"]))
else:
    print("result:", dict(Counter(i["status"] for i in d["items"])), "- generated %d chars (~%.0f credits)" % (d["newChars"], d["newCredits"]))
PY
)"
}

echo "Dry run against $BASE:"
call "?dryRun=1" | summary
if [ "${2:-}" != "--yes" ]; then
  read -r -p "Generate now? [y/N] " ok
  [ "$ok" = "y" ] || { echo "Stopped."; exit 0; }
fi
call "" | summary
