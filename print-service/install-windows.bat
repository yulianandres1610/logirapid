@echo off
setlocal enabledelayedexpansion
REM ─── LogiRapid Print Service - Instalador Windows ───

echo.
echo   ==============================================
echo    LogiRapid Print Service - Instalador Windows
echo   ==============================================
echo.

REM ─── 1. Verificar Node.js ───

where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo   [ERROR] Node.js no esta instalado.
    echo   Descargalo de: https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo   [OK] Node.js: %NODE_VERSION%

REM ─── 2. Detener servicio previo ───

taskkill /FI "WINDOWTITLE eq LogiRapid Print Service*" /F >nul 2>nul

REM ─── 3. Instalar archivos ───

set INSTALL_DIR=%USERPROFILE%\.logirapid-print-service

if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
copy /Y "%~dp0package.json" "%INSTALL_DIR%\" >nul
copy /Y "%~dp0server.js" "%INSTALL_DIR%\" >nul
echo   [OK] Archivos instalados en %INSTALL_DIR%

REM ─── 4. Instalar dependencias ───

echo   Instalando dependencias...
cd /d "%INSTALL_DIR%"
call npm install --omit=dev --silent 2>nul
echo   [OK] Dependencias instaladas

REM ─── 5. Configurar (si no hay config) ───

if not exist "%INSTALL_DIR%\config.json" (
    echo.
    echo   --- Configuracion inicial ---
    echo.

    set /p SERVER_URL="  URL del servidor: "

    if "!SERVER_URL!"=="" (
        echo   [ERROR] URL del servidor requerida.
        pause
        exit /b 1
    )

    set /p PAIRING_TOKEN="  Token de emparejamiento: "

    if "!PAIRING_TOKEN!"=="" (
        echo   [ERROR] Token requerido. Obtienelo desde Settings en el departamento.
        pause
        exit /b 1
    )

    echo   Verificando token...

    cd /d "%INSTALL_DIR%"
    node -e "fetch('!SERVER_URL!/api/print-agent?token=!PAIRING_TOKEN!&version=1.0.0').then(r=>{if(!r.ok)throw new Error();return r.json()}).then(d=>{const c={server:'!SERVER_URL!',tokens:[{token:'!PAIRING_TOKEN!',name:d.service_name}]};require('fs').writeFileSync('config.json',JSON.stringify(c,null,2));console.log('[OK] '+d.service_name)}).catch(()=>{console.error('[ERROR]');process.exit(1)})" 2>nul

    if %ERRORLEVEL% neq 0 (
        echo   [ERROR] Token invalido o servidor no accesible.
        pause
        exit /b 1
    )

    echo   [OK] Configuracion guardada
) else (
    echo   [OK] Configuracion existente encontrada
    echo.
    echo   Para agregar otro departamento ejecuta:
    echo     cd %INSTALL_DIR% ^&^& node server.js --add-token
)

REM ─── 6. Crear script de inicio ───

echo @echo off > "%INSTALL_DIR%\start.bat"
echo title LogiRapid Print Service >> "%INSTALL_DIR%\start.bat"
echo cd /d "%INSTALL_DIR%" >> "%INSTALL_DIR%\start.bat"
echo node server.js >> "%INSTALL_DIR%\start.bat"

REM ─── 7. Inicio automatico ───

set STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
set SHORTCUT_VBS=%TEMP%\create-shortcut.vbs

echo Set WshShell = CreateObject("WScript.Shell") > "%SHORTCUT_VBS%"
echo Set Shortcut = WshShell.CreateShortcut("%STARTUP_DIR%\LogiRapid Print Service.lnk") >> "%SHORTCUT_VBS%"
echo Shortcut.TargetPath = "cmd.exe" >> "%SHORTCUT_VBS%"
echo Shortcut.Arguments = "/c ""%INSTALL_DIR%\start.bat""" >> "%SHORTCUT_VBS%"
echo Shortcut.WorkingDirectory = "%INSTALL_DIR%" >> "%SHORTCUT_VBS%"
echo Shortcut.WindowStyle = 7 >> "%SHORTCUT_VBS%"
echo Shortcut.Description = "LogiRapid Print Service" >> "%SHORTCUT_VBS%"
echo Shortcut.Save >> "%SHORTCUT_VBS%"
cscript //nologo "%SHORTCUT_VBS%"
del "%SHORTCUT_VBS%"
echo   [OK] Inicio automatico configurado

REM ─── 8. Iniciar servicio ───

echo   Iniciando servicio...
start "LogiRapid Print Service" /min cmd /c "%INSTALL_DIR%\start.bat"

echo.
echo   ==============================================
echo    Instalacion Completa
echo   ==============================================
echo.
echo   El servicio esta corriendo y escuchando trabajos de impresion.
echo   Se inicia automaticamente con Windows.
echo.
echo   Comandos utiles:
echo     Ver departamentos:     cd %INSTALL_DIR% ^&^& node server.js --list
echo     Agregar departamento:  cd %INSTALL_DIR% ^&^& node server.js --add-token
echo     Quitar departamento:   cd %INSTALL_DIR% ^&^& node server.js --remove-token
echo     Desinstalar:           uninstall-windows.bat
echo.
pause
