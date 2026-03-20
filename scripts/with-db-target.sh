#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="${1:-}"

if [[ -z "${TARGET}" ]]; then
  echo "Usage: ./scripts/with-db-target.sh <preview|production> <command...>" >&2
  exit 1
fi

shift

if [[ "$#" -eq 0 ]]; then
  echo "A command is required after the target." >&2
  echo "Example: ./scripts/with-db-target.sh preview npx prisma migrate status" >&2
  exit 1
fi

case "${TARGET}" in
  preview|production)
    ;;
  *)
    echo "Unsupported target '${TARGET}'. Use 'preview' or 'production'." >&2
    exit 1
    ;;
esac

TARGET_ENV_FILE="${ROOT_DIR}/.env.${TARGET}.local"

if [[ ! -f "${TARGET_ENV_FILE}" ]]; then
  echo "Missing ${TARGET_ENV_FILE}" >&2
  echo "Create it with XD_POSTGRESS=<connection string>." >&2
  exit 1
fi

load_env_file() {
  local file="$1"
  if [[ -f "${file}" ]]; then
    set -a
    # shellcheck source=/dev/null
    source "${file}"
    set +a
  fi
}

load_env_file "${ROOT_DIR}/.env"
load_env_file "${ROOT_DIR}/.env.local"
load_env_file "${TARGET_ENV_FILE}"

unset DATABASE_URL || true

if [[ -z "${XD_POSTGRESS:-}" ]]; then
  echo "XD_POSTGRESS is not set after loading ${TARGET_ENV_FILE}" >&2
  exit 1
fi

echo "[db-target] ${TARGET} via ${TARGET_ENV_FILE##*/}" >&2
exec "$@"
