#!/usr/bin/env bash
# Erster Start von LUMIVA: legt die .env an (mit neuen Geheimnissen), prüft sie, startet alles
# und lädt bei eingeschalteter KI die Modelle einmalig herunter. Im Ordner deploy/ionos ausführen.
# Mehrfaches Ausführen ist unschädlich: vorhandene Werte in der .env bleiben, wie sie sind.
set -euo pipefail
cd "$(dirname "$0")"

# Setzt einen leeren Schlüssel in der .env auf einen Wert. Werte enthalten nur base64/hex, kein "|".
setzen() { sed -i "s|^$1=\$|$1=$2|" .env; }

if [ ! -f .env ]; then
  cp env.beispiel .env
  chmod 600 .env
  echo ".env aus env.beispiel angelegt."
fi
if ! grep -q '^LUMIVA_DOMAIN=.' .env; then
  read -rp "Domain für LUMIVA (z. B. praxis.example.at): " domain
  [ -n "$domain" ] || { echo "Ohne Domain geht es nicht."; exit 1; }
  setzen LUMIVA_DOMAIN "$domain"
fi
neu=0
grep -q '^POSTGRES_PASSWORT=$' .env && { setzen POSTGRES_PASSWORT "$(openssl rand -hex 32)"; neu=1; }
grep -q '^LUMIVA_HAUPTSCHLUESSEL=$' .env && { setzen LUMIVA_HAUPTSCHLUESSEL "$(openssl rand -base64 32)"; neu=1; }
grep -q '^BETTER_AUTH_SECRET=$' .env && { setzen BETTER_AUTH_SECRET "$(openssl rand -base64 32)"; neu=1; }

set -a; . ./.env; set +a

# Prüfen, bevor etwas startet.
fehler=0
[[ "$POSTGRES_PASSWORT" =~ ^[A-Za-z0-9]+$ ]] || {
  echo "POSTGRES_PASSWORT darf nur Buchstaben und Ziffern enthalten (openssl rand -hex 32)."; fehler=1; }
[ "$(printf %s "$LUMIVA_HAUPTSCHLUESSEL" | base64 -d 2>/dev/null | wc -c)" = 32 ] || {
  echo "LUMIVA_HAUPTSCHLUESSEL muss 32 Bytes als base64 sein (openssl rand -base64 32)."; fehler=1; }
[ "${#BETTER_AUTH_SECRET}" -ge 32 ] || { echo "BETTER_AUTH_SECRET ist zu kurz."; fehler=1; }
[ "$fehler" = 0 ] || exit 1

if [ "$neu" = 1 ]; then
  cat <<'HINWEIS'

  Neue Geheimnisse wurden in deploy/ionos/.env erzeugt.
  JETZT die Datei sichern: Inhalt in den Passwortmanager und einmal ausdrucken (Safe).
  Ohne LUMIVA_HAUPTSCHLUESSEL sind alle Akten unlesbar, auch aus einem Backup.
    Anzeigen mit:  cat .env

HINWEIS
  read -rp "Gesichert? Mit Enter weiter. " _
fi

docker compose up -d --build

if [ -z "${COMPOSE_PROFILES:-}" ]; then
  echo "KI ist aus (COMPOSE_PROFILES leer). Fertig: https://${LUMIVA_DOMAIN}"
  exit 0
fi

warten() { # $1 = Beschreibung, Rest = Befehl
  local was=$1; shift
  for _ in $(seq 1 60); do "$@" >/dev/null 2>&1 && return 0; sleep 5; done
  echo "$was antwortet nicht. Logs: docker compose logs"; exit 1
}

# Aus dem web-Container mit node:http, ohne Zeitgrenze: große Modelle laden mehrere Minuten.
http_post() {
  docker compose exec -T web node -e "
    const r = require('http').request('$1', { method: 'POST' }, (a) => {
      a.resume(); a.on('end', () => process.exit(a.statusCode < 300 ? 0 : 1));
    });
    r.on('error', () => process.exit(1)); r.end();"
}
http_get() {
  docker compose exec -T web node -e "
    require('http').get('$1', (a) => { a.resume(); process.exit(a.statusCode < 300 ? 0 : 1); })
      .on('error', () => process.exit(1));"
}

warten "Ollama" docker compose exec -T ollama ollama list
echo "Lade Sprachmodell ${SPRACHMODELL} …"
docker compose exec -T ollama ollama pull "${SPRACHMODELL}"

warten "Whisper" http_get "http://whisper:8000/health"
echo "Lade Whisper-Modell ${WHISPER_MODELL} …"
http_post "http://whisper:8000/v1/models/${WHISPER_MODELL}" || {
  echo "Whisper-Modell konnte nicht geladen werden. Logs: docker compose logs whisper"; exit 1;
}
echo "Fertig: https://${LUMIVA_DOMAIN}"
