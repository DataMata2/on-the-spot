#!/usr/bin/env bash
# One-command redeploy: ships origin/main to the server, rebuilds and restarts the container.
# Usage: scripts/deploy.sh            (env vars live in /home/ubuntu/on-the-spot/.env on the server)
set -euo pipefail

HOST="${DEPLOY_HOST:-root@incode.kz}"
DIR="${DEPLOY_DIR:-/home/ubuntu/on-the-spot}"
cd "$(dirname "$0")/.."

git fetch -q origin main
SHA="$(git rev-parse --short origin/main)"
echo "Deploying origin/main @ $SHA to $HOST:$DIR"

# Ship a clean tree of origin/main (no .env, no local changes), keep the server's .env.
git archive --format=tar origin/main | ssh "$HOST" "set -e
  mkdir -p '$DIR/src.new' && tar -x -C '$DIR/src.new'
  rm -rf '$DIR/src.old'; [ -d '$DIR/src' ] && mv '$DIR/src' '$DIR/src.old'; mv '$DIR/src.new' '$DIR/src'
  ln -sf '$DIR/.env' '$DIR/src/.env'
  echo '$SHA' > '$DIR/src/REVISION'
  cd '$DIR/src' && docker compose -p on-the-spot --env-file '$DIR/.env' up -d --build --remove-orphans
  docker image prune -f >/dev/null"

echo "Waiting for health..."
for i in $(seq 1 30); do
  if ssh "$HOST" "docker exec on-the-spot-app wget -qO- http://127.0.0.1:3000/ >/dev/null 2>&1"; then
    echo "Up: $SHA"; exit 0
  fi
  sleep 2
done
echo "App did not answer on :3000 after 60s"; ssh "$HOST" "docker logs --tail 50 on-the-spot-app"; exit 1
