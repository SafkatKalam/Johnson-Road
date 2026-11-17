#!/usr/bin/env bash
# F49: restore a backup made by scripts/backup.sh. THIS REPLACES the current database and media.
#   bash scripts/restore.sh <backup-folder> --yes
# Without --yes it only checks the backup and says what it would do. Stop the API and the worker first.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${1:?usage: restore.sh <backup-folder> [--yes]}"
CONFIRM="${2:-}"
CONTAINER="${DB_CONTAINER:-johnson-road-db}"
DB_NAME="${POSTGRES_DB:-johnson_road}"
DB_USER="${POSTGRES_USER:-postgres}"
MEDIA="${STORAGE_ROOT:-$ROOT/backend/data}"

[ -f "$SRC/database.dump" ] || { echo "no database.dump in $SRC"; exit 1; }
if [ -f "$SRC/SHA256SUMS" ]; then (cd "$SRC" && sha256sum -c SHA256SUMS) || { echo "checksum mismatch: backup damaged"; exit 1; }; fi
echo "Would restore database '$DB_NAME' in container '$CONTAINER' and media into '$MEDIA' from '$SRC'."
if [ "$CONFIRM" != "--yes" ]; then echo "Dry run only. Add --yes to replace the current data."; exit 0; fi

echo "restoring database"
docker exec -i "$CONTAINER" pg_restore -U "$DB_USER" -d "$DB_NAME" --clean --if-exists --no-owner < "$SRC/database.dump"
if [ -f "$SRC/media.tar" ]; then
  echo "restoring media"
  mkdir -p "$MEDIA"
  tar --force-local -C "$MEDIA" -xf "$SRC/media.tar"
fi
echo "restored. Next: start the API and run 'python -m app.maintenance orphans' to confirm rows and files match."
