# LUMIVA auf einem eigenen IONOS-Server

Alles läuft auf **einem Server unter deiner Kontrolle** in einem Rechenzentrum in der EU: LUMIVA, die
Datenbank und (wenn eingeschaltet, standardmäßig aus) die KI für die Dokumentation. Keine Daten gehen an OpenAI, Google
oder andere KI-Anbieter.

| Dienst      | Aufgabe                                                   | Software (frei)                   |
| ----------- | --------------------------------------------------------- | --------------------------------- |
| `caddy`     | HTTPS mit automatischem Zertifikat (Let's Encrypt)        | Caddy                             |
| `web`       | LUMIVA (Web-App und API für die mobile App)               | dieses Repo                       |
| `datenbank` | PostgreSQL, Gesundheitsdaten zusätzlich feldverschlüsselt | PostgreSQL 18                     |
| `whisper`   | Sprache zu Text für Diktat und Sitzungsaufnahme (KI)      | Whisper über Speaches             |
| `ollama`    | Doku-Entwurf aus dem Text (KI)                            | Qwen 2.5 (oder Llama) über Ollama |

Nur Caddy ist von außen erreichbar (Port 80 und 443). Datenbank und KI hängen nur im internen
Docker-Netz. Die Skripte in diesem Ordner:

| Skript                  | Wann                                                         |
| ----------------------- | ------------------------------------------------------------ |
| `server-vorbereiten.sh` | einmal auf dem frischen Server (Firewall, Updates, Docker …) |
| `einrichten.sh`         | erster Start; legt `.env` mit neuen Geheimnissen an          |
| `sicherung.sh`          | Backup; läuft täglich um 2 Uhr von selbst                    |
| `aktualisieren.sh`      | neue Version einspielen (macht vorher ein Backup)            |
| `wiederherstellen.sh`   | Backup zurückspielen                                         |

## 1. Bei IONOS bestellen

- **VPS** oder **Cloud Server** mit **Ubuntu 24.04**, Rechenzentrum in der EU (z. B. Deutschland).
  - **Ohne KI:** 2 bis 4 vCPU, 8 GB RAM, 80 GB SSD reichen für eine Praxis.
  - **Mit KI** (Diktat und Sitzungsaufnahme): mindestens 8 vCPU, 32 GB RAM, 100 GB SSD. Ein Diktat
    von 5 Minuten dauert dann etwa 1 bis 2 Minuten, eine ganze Sitzung (50 Minuten) auf der CPU
    etwa 15 bis 25 Minuten.
  - Die KI lässt sich jederzeit später zuschalten (Abschnitt 5), dann den Server vergrößern.
- Bei der Bestellung einen **SSH-Schlüssel** hinterlegen statt nur ein Root-Passwort
  (Windows: `ssh-keygen -t ed25519` in PowerShell, dann den Inhalt von `~\.ssh\id_ed25519.pub`
  einfügen).
- Im IONOS-Kundenbereich den **Auftragsverarbeitungsvertrag** (AVV, Art. 28 DSGVO) abschließen.
- **Firewall** im Cloud Panel (Netzwerk → Firewall-Richtlinien): nur TCP 22, 80, 443 und UDP 443
  eingehend erlauben.
- **DNS:** Bei der Domain einen **A-Record** (z. B. `praxis.deinedomain.at`) auf die IPv4 des
  Servers setzen. Erst wenn er auflöst (`nslookup praxis.deinedomain.at`), bekommt Caddy ein Zertifikat.
- Für Backups außer Haus: **IONOS S3 Object Storage** in einer EU-Region, einen Bucket
  (z. B. `lumiva-sicherung`) anlegen, Zugangsschlüssel erzeugen. Eine Lebenszyklus-Regel setzt die
  Aufbewahrung (z. B. 90 Tage); wer Schutz vor Löschen will, schaltet Object Lock ein.

## 2. Server vorbereiten

Per SSH als root auf den Server (`ssh root@<IP>`):

```bash
curl -fsSLO https://raw.githubusercontent.com/terra007/lumiva/main/deploy/ionos/server-vorbereiten.sh
less server-vorbereiten.sh     # kurz ansehen, was es tut
bash server-vorbereiten.sh
```

Das Skript spielt Updates ein, schaltet automatische Sicherheitsupdates ein (Neustart bei Bedarf um
4 Uhr), richtet die Firewall (ufw: 22, 80, 443) und fail2ban ein, stellt SSH auf Anmeldung nur mit
Schlüssel um, installiert Docker, age und rclone, holt LUMIVA nach `/opt/lumiva` und richtet den
täglichen Backup-Timer ein.

Ist das Repo privat, braucht der Server Lesezugriff: auf dem Server `ssh-keygen -t ed25519`, den
öffentlichen Schlüssel auf GitHub unter Repo → Settings → Deploy keys (nur lesen) eintragen und
`git clone git@github.com:terra007/lumiva.git /opt/lumiva` ausführen.

## 3. LUMIVA starten

```bash
cd /opt/lumiva/deploy/ionos
./einrichten.sh
```

Das Skript fragt nach der Domain, erzeugt Datenbank-Passwort, Hauptschlüssel und Sitzungs-Geheimnis
in `.env`, prüft alles und startet. Die KI ist zunächst aus; zuschalten siehe Abschnitt 5.

**Den Inhalt der `.env` sofort sichern** (Passwortmanager und Ausdruck im Safe). Ohne
`LUMIVA_HAUPTSCHLUESSEL` sind alle Akten unlesbar, auch aus jedem Backup.

Danach ist LUMIVA unter `https://deine-domain` erreichbar: Konto anlegen, Praxis einrichten.

## 4. Backups

Backups sind mit [age](https://age-encryption.org) für einen öffentlichen Schlüssel verschlüsselt.
Der private Schlüssel liegt **nicht** auf dem Server, damit ein Angreifer auf dem Server auch die
Backups nicht lesen kann.

1. Schlüsselpaar **auf deinem eigenen Rechner** erzeugen (age gibt es für Windows, macOS, Linux):
   `age-keygen -o lumiva-sicherung.key`. Die Datei in den Passwortmanager, die Zeile
   `# public key: age1…` notieren.
2. In `.env` eintragen: `SICHERUNG_EMPFAENGER=age1…`
3. Außer Haus (empfohlen): `rclone config` → neues Ziel `ionos-s3`, Typ „s3“, Anbieter „IONOS“,
   Region und Zugangsschlüssel aus Schritt 1. In `.env`: `SICHERUNG_ZIEL=ionos-s3:lumiva-sicherung`
4. Testen: `./sicherung.sh`. Danach läuft es täglich um 2 Uhr (`systemctl list-timers lumiva*`,
   Protokoll: `journalctl -u lumiva-sicherung`).

**Wiederherstellen** (vorher einmal zur Probe machen, z. B. auf einem Testserver):

```bash
./wiederherstellen.sh /var/backups/lumiva/lumiva-2026-11-11_0200.dump.age /root/lumiva-sicherung.key
shred -u /root/lumiva-sicherung.key
```

Auf einem neuen Server: Schritte 2 und 3 wie oben, aber vorher die gesicherte `.env` nach
`/opt/lumiva/deploy/ionos/.env` kopieren, damit derselbe Hauptschlüssel verwendet wird.

## 5. Betrieb

- **Updates:** `./aktualisieren.sh` (Backup, `git pull`, neu bauen). Die Datenbank wird beim Start
  automatisch migriert.
- **KI zuschalten:** Server auf 8 vCPU / 32 GB vergrößern, in `.env` `COMPOSE_PROFILES=ki` setzen,
  `./einrichten.sh` ausführen. Abschalten: Zeile leeren und `docker compose up -d --remove-orphans`.
- **Zustand:** `docker compose ps`, Logs: `docker compose logs -f web`.
- **Mobile App:** Beim Bauen der App `EXPO_PUBLIC_API_URL=https://deine-domain` setzen.
- **Zugriff aufs Server-Konto** nur für dich; SSH-Schlüssel nicht weitergeben.

## KI und Datenschutz

- Die Aufnahme geht vom Browser direkt an diesen Server, wird im Arbeitsspeicher in Text
  umgewandelt und zusammengefasst und **nicht gespeichert**. Gespeichert wird nur der Eintrag,
  den du geprüft und mit „Eintrag speichern“ bestätigt hast.
- **Diktat nach der Sitzung** (du sprichst selbst): keine Einwilligung des Patienten nötig.
- **Aufnahme der ganzen Sitzung:** nur mit schriftlicher Einwilligung (DSGVO Art. 9 Abs. 2 lit. a).
  LUMIVA druckt die Vorlage aus der Akte („Einwilligung zum Unterschreiben drucken“). Erst mit
  eingetragenem Datum ist die Aufnahme freigeschaltet. Die Vorlage vor dem ersten Einsatz
  rechtlich prüfen lassen.
- Jeder KI-Entwurf steht im Zugriffsprotokoll (`ki-entwurf`), ohne Inhalte.
- Modelle wechseln: `WHISPER_MODELL` und `SPRACHMODELL` in der `.env` ändern und
  `./einrichten.sh` erneut ausführen. Genauer, aber langsamer: `Systran/faster-whisper-large-v3`.
