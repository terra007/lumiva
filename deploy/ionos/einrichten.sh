#!/usr/bin/env bash
# Startet LUMIVA und lädt die KI-Modelle einmalig herunter. Im Ordner deploy/ionos ausführen.
set -euo pipefail
cd "$(dirname "$0")"
[ -f .env ] || { echo "Zuerst env.beispiel nach .env kopieren und ausfüllen."; exit 1; }
set -a; . ./.env; set +a

docker compose up -d --build

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
