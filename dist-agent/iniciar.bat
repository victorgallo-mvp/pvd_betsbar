@echo off
:: ============================================================
::  Agente de Impressao - Betsbar PDV
::  Configure as variaveis abaixo antes de usar
:: ============================================================

set RAILWAY_API_URL=https://radiant-success-production-f5e3.up.railway.app

:: ── IMPRESSORA BALCAO (USB) ─────────────────────────────────
:: Nome exato conforme aparece em: Painel de Controle > Dispositivos e Impressoras
set PRINTER_INTERFACE=printer:POS-80
set PRINTER_WIDTH=80

:: ── IMPRESSORA COZINHA (rede TCP/IP) ────────────────────────
set KITCHEN_PRINTER_IP=192.168.2.122
set KITCHEN_PRINTER_PORT=9100

:: Intervalo de polling em ms (padrao: 5000)
:: set POLL_MS=5000

:: Instala driver USB automaticamente se necessario
if not exist "node_modules\@thiagoelg\node-printer" (
    echo Instalando driver de impressora USB...
    npm install @thiagoelg/node-printer
    echo.
)

node print-agent.bundle.js
pause
