#!/usr/bin/env bash
# Neue Version von LUMIVA einspielen: erst Backup, dann neuen Stand von main holen und neu bauen.
# Die Datenbank wird beim Start der Web-App automatisch migriert.
#   sudo ./aktualisieren.sh
set -euo pipefail
cd "$(dirname "$0")"

./sicherung.sh
git -C ../.. pull --ff-only
docker compose up -d --build --wait
docker image prune -f >/dev/null
echo "Aktualisiert auf $(git -C ../.. log -1 --format='%h %s')"
