@echo off
:: ============================================================
::  Agente de Impressao - Betsbar PDV
::  Configure as variaveis abaixo antes de usar
:: ============================================================

set RAILWAY_API_URL=https://radiant-success-production-f5e3.up.railway.app
set PRINTER_IP=192.168.2.15
set PRINTER_PORT=9100
set PRINTER_WIDTH=80

:: Impressora de cozinha (deixe em branco se for a mesma)
set KITCHEN_PRINTER_IP=192.168.2.20

:: Intervalo de polling em ms (padrao: 5000)
:: set POLL_MS=5000

:: USB no Windows (ex: POS-80). Descomente e ajuste se precisar.
:: set PRINTER_INTERFACE=printer:POS-80

print-agent.exe
pause
