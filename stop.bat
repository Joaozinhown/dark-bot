@echo off
echo ========================================
echo   Dark Bot - Parando...
echo ========================================
echo.

:: Verifica se está rodando
tasklist /FI "IMAGENAME eq node.exe" | find /I "node.exe" >nul
if %ERRORLEVEL% neq 0 (
    echo [INFO] Bot não está rodando.
    pause
    exit /b 0
)

:: Pergunta confirmação
set /p confirmar="Tem certeza que deseja parar o bot? (S/N): "
if /I not "%confirmar%"=="S" (
    echo [INFO] Operação cancelada.
    pause
    exit /b 0
)

:: Para o bot
taskkill /F /IM node.exe >nul 2>&1
echo [OK] Bot parado com sucesso!
echo.
pause
