# LUMIVA auf einem eigenen IONOS-Server

Alles läuft auf **einem Server unter deiner Kontrolle**: LUMIVA, die Datenbank und die KI für die
Dokumentation. Keine Daten gehen an OpenAI, Google oder andere KI-Anbieter.

| Dienst      | Aufgabe                                                   | Software (frei)                   |
| ----------- | --------------------------------------------------------- | --------------------------------- |
| `caddy`     | HTTPS mit automatischem Zertifikat (Let's Encrypt)        | Caddy                             |
| `web`       | LUMIVA (Web-App und API für die mobile App)               | dieses Repo                       |
| `datenbank` | PostgreSQL, Gesundheitsdaten zusätzlich feldverschlüsselt | PostgreSQL 18                     |
| `whisper`   | Sprache zu Text für Diktat und Sitzungsaufnahme           | Whisper über Speaches             |
| `ollama`    | Doku-Entwurf aus dem Text                                 | Qwen 2.5 (oder Llama) über Ollama |

Nur Caddy ist von außen erreichbar (Port 80 und 443). Datenbank und KI hängen nur im internen
Docker-Netz.

## 1. Server bei IONOS bestellen

- **Cloud Server** oder **VPS** mit Ubuntu 24.04, Rechenzentrum in der EU (z. B. Deutschland).
- Größe ohne Grafikkarte: **mindestens 8 vCPU, 32 GB RAM, 100 GB SSD.**
  Damit dauert ein Diktat von 5 Minuten etwa 1 bis 2 Minuten. Eine ganze Sitzung (50 Minuten)
  braucht auf der CPU etwa 15 bis 25 Minuten; dafür lohnt sich später ein Server mit GPU.
- Mit IONOS den **Auftragsverarbeitungsvertrag** (AVV, Art. 28 DSGVO) abschließen. Das geht im
  IONOS-Kundenbereich.
- Bei der Domain einen **A-Record** auf die IP des Servers setzen, z. B. `praxis.deinedomain.at`.

## 2. Einrichten

Per SSH auf dem Server:

```bash
# Docker installieren
curl -fsSL https://get.docker.com | sh

# LUMIVA holen
git clone https://github.com/terra007/lumiva.git && cd lumiva/deploy/ionos

# Konfiguration
cp env.beispiel .env
nano .env   # Domain eintragen, drei Geheimnisse mit "openssl rand -base64 32" erzeugen

# Starten und KI-Modelle laden (dauert beim ersten Mal 10 bis 20 Minuten)
./einrichten.sh
```

Danach ist LUMIVA unter `https://deine-domain` erreichbar. Konto anlegen, Praxis einrichten,
in der Akte erscheinen „Diktat aufnehmen“ und „Sitzung aufnehmen“.

## 3. Wichtig für den Betrieb

- **Hauptschlüssel sichern.** `LUMIVA_HAUPTSCHLUESSEL` aus der `.env` getrennt vom Server
  aufbewahren (z. B. Passwortmanager und Ausdruck im Safe). Ohne ihn sind alle Akten unlesbar,
  auch aus einem Backup.
- **Backups** der Datenbank, z. B. täglich per Cronjob:
  `docker compose exec -T datenbank pg_dump -U lumiva lumiva | gzip > /backup/lumiva-$(date +%F).sql.gz`
  und die Dateien verschlüsselt außer Haus kopieren.
- **Updates:** `git pull && docker compose up -d --build`. Die Datenbank wird beim Start
  automatisch migriert.
- **Firewall:** In der IONOS-Firewall nur 22 (SSH), 80 und 443 freigeben.

## KI und Datenschutz

- Die Aufnahme geht vom Browser direkt an diesen Server, wird im Arbeitsspeicher in Text
  umgewandelt und zusammengefasst und **nicht gespeichert**. Gespeichert wird nur der Eintrag,
  den du geprüft und mit „Eintrag speichern“ bestätigt hast.
- **Diktat nach der Sitzung** (du sprichst selbst): keine Einwilligung der Patient:in nötig.
- **Aufnahme der ganzen Sitzung:** nur mit schriftlicher Einwilligung (DSGVO Art. 9 Abs. 2 lit. a).
  LUMIVA druckt die Vorlage aus der Akte („Einwilligung zum Unterschreiben drucken“). Erst mit
  eingetragenem Datum ist die Aufnahme freigeschaltet. Die Vorlage vor dem ersten Einsatz
  rechtlich prüfen lassen.
- Jeder KI-Entwurf steht im Zugriffsprotokoll (`ki-entwurf`), ohne Inhalte.
- Modelle wechseln: `WHISPER_MODELL` und `SPRACHMODELL` in der `.env` ändern und
  `./einrichten.sh` erneut ausführen. Genauer, aber langsamer: `Systran/faster-whisper-large-v3`.
