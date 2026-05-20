#!/bin/bash
# ============================================================
#  Agente de Impressão - Betsbar PDV
#  Configure as variáveis abaixo antes de usar
# ============================================================

export RAILWAY_API_URL="https://radiant-success-production-f5e3.up.railway.app"

# ── IMPRESSORA BALCÃO (USB via sistema do Mac) ───────────────
#
#  Impressora instalada via USB no Mac — usa o sistema CUPS do macOS.
#  O nome abaixo é o nome exato que aparece em: lpstat -p -d
#
export PRINTER_INTERFACE="cups:PrinterCMD_ESCPO_POS80_Printer_USB"
#
# ────────────────────────────────────────────────────────────

export PRINTER_WIDTH="80"

# ── IMPRESSORA COZINHA (rede TCP/IP) ─────────────────────────
export KITCHEN_PRINTER_IP="192.168.2.122"
export KITCHEN_PRINTER_PORT="9100"

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
if [[ "$PRINTER_INTERFACE" == cups:* ]]; then
  echo "  Balcão:           CUPS (USB Mac)"
  echo "  Impressora:       ${PRINTER_INTERFACE#cups:}"
elif [ -n "$PRINTER_INTERFACE" ]; then
  echo "  Balcão:           USB Serial"
  echo "  Dispositivo:      $PRINTER_INTERFACE"
else
  echo "  Balcão:           Rede (TCP)"
  echo "  Impressora:       $PRINTER_IP:$PRINTER_PORT"
fi
echo "  Cozinha:          ${KITCHEN_PRINTER_IP}:${KITCHEN_PRINTER_PORT:-9100}"
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
