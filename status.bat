@echo off
title Dark Bot - Status
echo ========================================
echo   Dark Bot - Status
echo ========================================
echo.

:: Verifica processos node
echo Processos Node.js:
echo -------------------
tasklist /FI "IMAGENAME eq node.exe" /FO TABLE 2>nul | find /I "node"
if %ERRORLEVEL% neq 0 (
    echo Nenhum processo Node.js encontrado.
)

echo.
echo ===================

:: Verifica se o banco existe
if exist "prisma\darkbot.db" (
    echo Banco de dados: OK
) else (
    echo Banco de dados: NÃO ENCONTRADO
)

:: Verifica se o dist existe
if exist "dist\index.js" (
    echo Build: OK
) else (
    echo Build: NÃO COMPILADO
)

echo.
pause
