#!/bin/bash
# ============================================================
#  Agente de Impressão - Betsbar PDV
#  Configure as variáveis abaixo antes de usar
# ============================================================

export RAILWAY_API_URL="https://radiant-success-production-f5e3.up.railway.app"
export PRINTER_IP="192.168.2.15"
export PRINTER_PORT="9100"
export PRINTER_WIDTH="80"

# Impressora de cozinha (deixe igual ao PRINTER_IP se for a mesma)
export KITCHEN_PRINTER_IP="192.168.2.20"

# Intervalo de polling em ms (padrão: 5000)
# export POLL_MS="5000"

# ============================================================
#  NÃO ALTERE ABAIXO DESTA LINHA
# ============================================================

# Ir para a pasta onde este arquivo está
cd "$(dirname "$0")"

echo "========================================"
echo "  Agente de Impressão - Betsbar PDV"
echo "========================================"
echo ""
echo "  API:              $RAILWAY_API_URL"
echo "  Impressora:       $PRINTER_IP:$PRINTER_PORT"
echo "  Cozinha:          $KITCHEN_PRINTER_IP:$PRINTER_PORT"
echo ""

# Verificar se Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "ERRO: Node.js não encontrado."
    echo ""
    echo "Instale o Node.js em: https://nodejs.org"
    echo ""
    read -p "Pressione ENTER para fechar..."
    exit 1
fi

echo "  Node.js: $(node --version)"
echo ""

# Instalar dependências se necessário
if [ ! -d "node_modules" ]; then
    echo "Instalando dependências (primeira execução)..."
    npm install --silent
    echo "Dependências instaladas."
    echo ""
fi

echo "Iniciando agente... (pressione Ctrl+C para parar)"
echo ""

# Rodar o agente
node --import=tsx/esm agente.ts
