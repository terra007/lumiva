#!/usr/bin/env bash
# Bereitet einen frischen IONOS-Server (Ubuntu 24.04) für LUMIVA vor. Einmal als root ausführen:
#   bash server-vorbereiten.sh
# Macht: Updates, automatische Sicherheitsupdates, Firewall (nur 22, 80, 443), Schutz gegen
# Passwort-Raten, SSH nur mit Schlüssel, Docker mit begrenzten Logs, age und rclone für Backups,
# täglicher Backup-Timer.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Bitte als root ausführen."; exit 1; }
LUMIVA=/opt/lumiva

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get -y upgrade
apt-get -y install ca-certificates curl git ufw fail2ban unattended-upgrades age rclone openssl

timedatectl set-timezone Europe/Vienna

# Sicherheitsupdates automatisch, Neustart bei Bedarf nachts um 4 Uhr.
cat >/etc/apt/apt.conf.d/52lumiva <<'EOF'
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "04:00";
EOF
dpkg-reconfigure -f noninteractive unattended-upgrades

# Firewall. Docker-Ports umgehen ufw; deshalb veröffentlicht docker-compose.yml nur Caddy.
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443
ufw --force enable

systemctl enable --now fail2ban

# SSH nur mit Schlüssel, aber nur wenn schon einer hinterlegt ist (sonst sperrt man sich aus).
if [ -s /root/.ssh/authorized_keys ]; then
  cat >/etc/ssh/sshd_config.d/50-lumiva.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
EOF
  systemctl reload ssh
  echo "SSH: Anmeldung nur noch mit Schlüssel."
else
  echo "WARNUNG: Kein SSH-Schlüssel in /root/.ssh/authorized_keys. Passwort-Anmeldung bleibt an."
  echo "         Schlüssel hinterlegen (ssh-copy-id) und dieses Skript erneut ausführen."
fi

# Docker mit begrenzten Logs.
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi
mkdir -p /etc/docker
[ -f /etc/docker/daemon.json ] || cat >/etc/docker/daemon.json <<'EOF'
{ "log-driver": "local", "log-opts": { "max-size": "10m", "max-file": "5" } }
EOF
systemctl restart docker

# LUMIVA holen.
[ -d "$LUMIVA/.git" ] || git clone https://github.com/terra007/lumiva.git "$LUMIVA"

# Tägliches Backup um 2 Uhr.
cat >/etc/systemd/system/lumiva-sicherung.service <<EOF
[Unit]
Description=LUMIVA Backup der Datenbank
After=docker.service

[Service]
Type=oneshot
ExecStart=$LUMIVA/deploy/ionos/sicherung.sh
EOF
cat >/etc/systemd/system/lumiva-sicherung.timer <<'EOF'
[Unit]
Description=LUMIVA Backup täglich

[Timer]
OnCalendar=*-*-* 02:00
Persistent=true
RandomizedDelaySec=10m

[Install]
WantedBy=timers.target
EOF
systemctl daemon-reload
systemctl enable lumiva-sicherung.timer

echo
echo "Server vorbereitet. Weiter mit:  cd $LUMIVA/deploy/ionos && ./einrichten.sh"
