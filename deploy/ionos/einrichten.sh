#!/usr/bin/env bash
# Startet LUMIVA und lädt die KI-Modelle einmalig herunter. Im Ordner deploy/ionos ausführen.
set -euo pipefail
cd "$(dirname "$0")"
[ -f .env ] || { echo "Zuerst env.beispiel nach .env kopieren und ausfüllen."; exit 1; }
set -a; . ./.env; set +a

docker compose up -d --build
echo "Lade Sprachmodell ${SPRACHMODELL} …"
docker compose exec -T ollama ollama pull "${SPRACHMODELL}"
echo "Lade Whisper-Modell ${WHISPER_MODELL} …"
docker compose exec -T web node -e "
  fetch('http://whisper:8000/v1/models/${WHISPER_MODELL}', { method: 'POST' })
    .then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1));
"
echo "Fertig: https://${LUMIVA_DOMAIN}"
