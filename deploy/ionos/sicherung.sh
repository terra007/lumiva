#!/usr/bin/env bash
# Backup der Datenbank: pg_dump, mit age für den öffentlichen Schlüssel SICHERUNG_EMPFAENGER
# verschlüsselt, nach /var/backups/lumiva und (falls SICHERUNG_ZIEL gesetzt) per rclone außer Haus.
# Läuft täglich über den systemd-Timer lumiva-sicherung.timer; von Hand: sudo ./sicherung.sh
#
# Der Server kann seine eigenen Backups nicht entschlüsseln: der private age-Schlüssel liegt
# getrennt (Passwortmanager). Die Akteninhalte sind darin zusätzlich mit dem Hauptschlüssel
# feldverschlüsselt.
set -euo pipefail
cd "$(dirname "$0")"
set -a; . ./.env; set +a

ORDNER=/var/backups/lumiva
[ -n "${SICHERUNG_EMPFAENGER:-}" ] || { echo "SICHERUNG_EMPFAENGER fehlt in .env (age1…)."; exit 1; }
command -v age >/dev/null || { echo "age fehlt: apt install age"; exit 1; }

umask 077
mkdir -p "$ORDNER"
datei="$ORDNER/lumiva-$(date +%Y-%m-%d_%H%M).dump.age"
teil="$datei.teil"

# Erst in eine Teildatei, damit ein abgebrochenes Backup nie wie ein fertiges aussieht.
docker compose exec -T datenbank pg_dump -U lumiva -d lumiva --format=custom \
  | age -r "$SICHERUNG_EMPFAENGER" -o "$teil"
mv "$teil" "$datei"
echo "Backup: $datei ($(du -h "$datei" | cut -f1))"

if [ -n "${SICHERUNG_ZIEL:-}" ]; then
  rclone copy --config /root/.config/rclone/rclone.conf "$datei" "$SICHERUNG_ZIEL"
  echo "Außer Haus kopiert nach $SICHERUNG_ZIEL"
fi

find "$ORDNER" -name 'lumiva-*.dump.age' -mtime +"${SICHERUNG_TAGE:-14}" -delete
find "$ORDNER" -name '*.teil' -mmin +600 -delete
