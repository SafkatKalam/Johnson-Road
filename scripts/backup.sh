#!/usr/bin/env bash
# F49: back up the database and the stored media together, so a restore has rows AND the files they point to.
#   bash scripts/backup.sh [target-folder]      (default: ./backups/<date-time>)
# Database: pg_dump in the PostgreSQL container (custom format). Media: a copy of STORAGE_ROOT (default backend/data).
# It writes only into the target folder. Keep backups somewhere other than this computer for real protection.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
DEST="${1:-$ROOT/backups/$STAMP}"
CONTAINER="${DB_CONTAINER:-johnson-road-db}"
DB_NAME="${POSTGRES_DB:-johnson_road}"
DB_USER="${POSTGRES_USER:-postgres}"
MEDIA="${STORAGE_ROOT:-$ROOT/backend/data}"

mkdir -p "$DEST"
echo "database -> $DEST/database.dump"
docker exec "$CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc > "$DEST/database.dump"
echo "media -> $DEST/media.tar"
if [ -d "$MEDIA" ]; then
  tar --force-local -C "$MEDIA" -cf "$DEST/media.tar" .   # --force-local: a "D:/..." path is a file, not a remote host
else
  echo "  (no media folder at $MEDIA)"
fi
( cd "$DEST" && sha256sum database.dump media.tar 2>/dev/null > SHA256SUMS || true )
echo "done: $DEST"
