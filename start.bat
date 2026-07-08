@echo off
title Dark Bot
echo ========================================
echo   Dark Bot - Iniciando...
echo ========================================
echo.

:: Verifica se já está rodando
tasklist /FI "IMAGENAME eq node.exe" | find /I "node.exe" >nul
if %ERRORLEVEL% == 0 (
    echo [AVISO] Bot já está rodando!
    echo.
    pause
    exit /b 1
)

:: Compila o TypeScript
echo [1/2] Compilando TypeScript...
call npx tsc
if %ERRORLEVEL% neq 0 (
    echo [ERRO] Falha na compilação!
    pause
    exit /b 1
)

:: Inicia o bot
echo [2/2] Iniciando bot...
echo.
start /min "Dark Bot" node dist/index.js
echo [OK] Bot iniciado em background!
echo.
pause
