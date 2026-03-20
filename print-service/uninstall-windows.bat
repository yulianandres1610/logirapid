@echo off
REM ─── LogiRapid Print Service - Desinstalador Windows ───

echo.
echo   Desinstalando LogiRapid Print Service...
echo.

set INSTALL_DIR=%USERPROFILE%\.logirapid-print-service
set STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup

REM Detener proceso
taskkill /FI "WINDOWTITLE eq LogiRapid Print Service" /F >nul 2>nul
echo   Servicio detenido.

REM Eliminar acceso directo de Startup
del /F "%STARTUP_DIR%\LogiRapid Print Service.lnk" 2>nul
echo   Inicio automatico eliminado.

REM Eliminar directorio
rmdir /S /Q "%INSTALL_DIR%" 2>nul
echo   Archivos eliminados.

echo.
echo   Desinstalacion completa.
echo.
pause
