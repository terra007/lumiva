#!/usr/bin/env bash
# Spielt ein Backup aus sicherung.sh zurück. ERSETZT den aktuellen Datenbankinhalt.
#   sudo ./wiederherstellen.sh /var/backups/lumiva/lumiva-….dump.age /pfad/zum/age-schluessel.txt
# Der private age-Schlüssel kommt nur für diesen Vorgang auf den Server; danach löschen.
# Die .env muss denselben LUMIVA_HAUPTSCHLUESSEL wie beim Backup enthalten.
set -euo pipefail
cd "$(dirname "$0")"
[ $# -eq 2 ] || { echo "Aufruf: $0 <backup.dump.age> <age-schluessel.txt>"; exit 1; }
backup=$(realpath "$1"); schluessel=$(realpath "$2")

read -rp "Aktuelle Datenbank wird durch $(basename "$backup") ersetzt. Zum Fortfahren JA eingeben: " ok
[ "$ok" = JA ] || { echo "Abgebrochen."; exit 1; }

docker compose stop web
docker compose up -d --wait datenbank
age -d -i "$schluessel" "$backup" \
  | docker compose exec -T datenbank pg_restore -U lumiva -d lumiva --clean --if-exists --no-owner --single-transaction
docker compose up -d web
echo "Wiederhergestellt. Jetzt den age-Schlüssel vom Server löschen: shred -u $schluessel"
