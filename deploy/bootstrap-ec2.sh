#!/usr/bin/env bash
# One-time setup of an Amazon Linux 2023 host: Docker, Compose plugin, swap, app directory. Safe to re-run.
set -euo pipefail

sudo dnf install -y docker git
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"

if ! docker compose version >/dev/null 2>&1; then
  sudo mkdir -p /usr/local/lib/docker/cli-plugins
  sudo curl -fsSL "https://github.com/docker/compose/releases/download/v2.29.7/docker-compose-linux-$(uname -m)" -o /usr/local/lib/docker/cli-plugins/docker-compose
  sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
fi

# 2 GB swap so a small instance survives image pulls and spikes
if ! swapon --show | grep -q /swapfile; then
  sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

mkdir -p ~/fringlale
echo "bootstrap done"
