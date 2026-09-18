#!/usr/bin/env bash
# Deploy de produção: build sempre limpo (--no-cache) e tag da imagem
# amarrada ao commit atual, para que um "docker compose up -d" sem
# --build nunca sirva silenciosamente uma imagem desatualizada.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

IMAGE_TAG="$(git rev-parse --short HEAD)"
export IMAGE_TAG

echo "==> Deploy da tag ${IMAGE_TAG}"

echo "==> Build (--no-cache)"
docker compose build --no-cache

echo "==> Subindo containers"
docker compose up -d --force-recreate --remove-orphans

echo "==> Publicado: joguinho-sobrinhos:${IMAGE_TAG} / joguinho-signaling:${IMAGE_TAG}"
echo "==> Para limpar imagens antigas não usadas: docker image prune -f"
