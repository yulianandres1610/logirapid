#!/bin/bash
# ─── LogiRapid Print Service - Desinstalador Mac ───

echo ""
echo "  Desinstalando LogiRapid Print Service..."
echo ""

PLIST_PATH="$HOME/Library/LaunchAgents/com.logirapid.print-service.plist"
INSTALL_DIR="$HOME/.logirapid-print-service"

# Detener servicio
launchctl unload "$PLIST_PATH" 2>/dev/null || true
echo "  Servicio detenido."

# Eliminar plist
rm -f "$PLIST_PATH"
echo "  LaunchAgent eliminado."

# Eliminar directorio
rm -rf "$INSTALL_DIR"
echo "  Archivos eliminados."

echo ""
echo "  Desinstalacion completa."
echo ""
