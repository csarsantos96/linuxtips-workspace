#!/usr/bin/env bash
# =============================================================================
# setup-permissions.sh - prepara usuario, grupo e permissoes (cap 4)
# =============================================================================
# Cria o usuario de servico 'giropops' (sem login interativo), o grupo
# 'giropops' e aplica chown/chmod corretos em /opt/giropops-status.
#
# Uso:
#   sudo ./scripts/setup-permissions.sh
#
# Variaveis opcionais:
#   APP_USER  - usuario de servico (default: giropops)
#   APP_GROUP - grupo dos arquivos compartilhados (default: giropops)
#   APP_DIR   - diretorio base da aplicacao (default: /opt/giropops-status)
#   ADMIN     - usuario humano que tambem precisa acessar (default: $SUDO_USER)
#
# Modelo de permissoes aplicado:
#   /opt/giropops-status/         giropops:giropops 2750
#   /opt/giropops-status/app/     giropops:giropops 2750
#   /opt/giropops-status/config/  giropops:giropops 2750
#   /opt/giropops-status/config/.env             giropops:giropops 0640
#   /opt/giropops-status/logs/    giropops:giropops 2770   (SGID)
#   /opt/giropops-status/backups/ giropops:giropops 2770   (SGID)
# =============================================================================

set -euo pipefail

APP_USER="${APP_USER:-giropops}"
APP_GROUP="${APP_GROUP:-giropops}"
APP_DIR="${APP_DIR:-/opt/giropops-status}"
ADMIN="${ADMIN:-${SUDO_USER:-}}"

if [[ "${EUID}" -ne 0 ]]; then
    echo "Erro: rode com sudo (precisa de root para criar usuario/grupo)." >&2
    exit 1
fi

echo "[1/5] Garantindo grupo '${APP_GROUP}'..."
if ! getent group "${APP_GROUP}" >/dev/null; then
    groupadd --system "${APP_GROUP}"
    echo "      grupo criado"
else
    echo "      ja existe"
fi

echo "[2/5] Garantindo usuario de servico '${APP_USER}'..."
if ! id -u "${APP_USER}" >/dev/null 2>&1; then
    useradd --system \
            --gid "${APP_GROUP}" \
            --home-dir "${APP_DIR}" \
            --no-create-home \
            --shell /usr/sbin/nologin \
            "${APP_USER}"
    echo "      usuario criado (nologin, system, home=${APP_DIR})"
else
    echo "      ja existe"
fi

if [[ -n "${ADMIN}" ]] && id -u "${ADMIN}" >/dev/null 2>&1; then
    echo "[3/5] Adicionando '${ADMIN}' ao grupo '${APP_GROUP}'..."
    usermod -aG "${APP_GROUP}" "${ADMIN}"
    echo "      ok (precisa abrir nova sessao para o grupo entrar em vigor)"
else
    echo "[3/5] (pulando) defina ADMIN= ou rode com sudo a partir do seu usuario."
fi

echo "[4/5] Garantindo estrutura em ${APP_DIR}..."
install -d -o "${APP_USER}" -g "${APP_GROUP}" -m 2750 "${APP_DIR}"
install -d -o "${APP_USER}" -g "${APP_GROUP}" -m 2750 "${APP_DIR}/app"
install -d -o "${APP_USER}" -g "${APP_GROUP}" -m 2750 "${APP_DIR}/config"
install -d -o "${APP_USER}" -g "${APP_GROUP}" -m 2770 "${APP_DIR}/logs"
install -d -o "${APP_USER}" -g "${APP_GROUP}" -m 2770 "${APP_DIR}/backups"

echo "[5/5] Ajustando permissoes recursivas..."
chown -R "${APP_USER}:${APP_GROUP}" "${APP_DIR}"
# arquivos: 640 (dono RW, grupo R, outros nada)
find "${APP_DIR}" -type f -exec chmod 0640 {} \;
# diretorios: 2750 / 2770 ja foram aplicados via install -d acima nos principais.
# Subdiretorios criados pelo aluno herdam o grupo via SGID.
find "${APP_DIR}/app" "${APP_DIR}/config" -type d -exec chmod 2750 {} \;
find "${APP_DIR}/logs" "${APP_DIR}/backups" -type d -exec chmod 2770 {} \;

# .env merece tratamento especial: 0600 (so o dono le)
if [[ -f "${APP_DIR}/config/.env" ]]; then
    chmod 0600 "${APP_DIR}/config/.env"
    echo "      ${APP_DIR}/config/.env -> 0600"
fi

echo
echo "=== Resumo ==="
ls -ld "${APP_DIR}" "${APP_DIR}/app" "${APP_DIR}/config" "${APP_DIR}/logs" "${APP_DIR}/backups"
id "${APP_USER}"
echo
echo "Pronto. Para o ADMIN ver o grupo novo, abra uma nova sessao SSH."
