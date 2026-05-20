#!/bin/bash
# ============================================================
#  Agente de Impressão - Betsbar PDV
#  Configure as variáveis abaixo antes de usar
# ============================================================

export RAILWAY_API_URL="https://radiant-success-production-f5e3.up.railway.app"

# ── MODO DE CONEXÃO DA IMPRESSORA ───────────────────────────
#
#  Escolha UM dos modos abaixo e comente o outro.
#
#  MODO REDE (TCP/IP) — impressora conectada via cabo de rede ou Wi-Fi:
export PRINTER_IP="192.168.2.15"
export PRINTER_PORT="9100"
#
#  MODO USB — impressora conectada via cabo USB no Mac:
#  1. Conecte a impressora e rode no Terminal: ls /dev/cu.*
#  2. Copie o nome do dispositivo (ex: /dev/cu.usbserial-1410) e cole abaixo
#  3. Comente as linhas PRINTER_IP e PRINTER_PORT acima
# export PRINTER_INTERFACE="/dev/cu.usbserial-1410"
#
# ────────────────────────────────────────────────────────────

export PRINTER_WIDTH="80"

# Impressora de cozinha (deixe igual ao PRINTER_IP se for a mesma)
export KITCHEN_PRINTER_IP="192.168.2.20"

# Intervalo de polling em ms (padrão: 5000)
# export POLL_MS="5000"

# ============================================================
#  NÃO ALTERE ABAIXO DESTA LINHA
# ============================================================

cd "$(dirname "$0")"

echo "========================================"
echo "  Agente de Impressão - Betsbar PDV"
echo "========================================"
echo ""
if [ -n "$PRINTER_INTERFACE" ]; then
  echo "  Modo:             USB"
  echo "  Dispositivo:      $PRINTER_INTERFACE"
else
  echo "  Modo:             Rede (TCP)"
  echo "  Impressora:       $PRINTER_IP:$PRINTER_PORT"
fi
echo "  Cozinha:          ${KITCHEN_PRINTER_IP:-$PRINTER_IP}:${PRINTER_PORT:-9100}"
echo "  API:              $RAILWAY_API_URL"
echo ""

if ! command -v node &> /dev/null; then
    echo "ERRO: Node.js não encontrado."
    echo "Instale em: https://nodejs.org"
    echo ""
    read -p "Pressione ENTER para fechar..."
    exit 1
fi

echo "  Node.js: $(node --version)"
echo ""

if [ ! -d "node_modules" ]; then
    echo "Instalando dependências (primeira execução)..."
    npm install --silent
    echo "Dependências instaladas."
    echo ""
fi

echo "Iniciando agente... (pressione Ctrl+C para parar)"
echo ""

node --import=tsx/esm agente.ts
