#!/bin/bash
# ─── LogiRapid Print Service - Instalador Mac ───

set -e

INSTALL_DIR="$HOME/.logirapid-print-service"
PLIST_PATH="$HOME/Library/LaunchAgents/com.logirapid.print-service.plist"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "  ==========================================="
echo "   LogiRapid Print Service - Instalador Mac"
echo "  ==========================================="
echo ""

# ─── 1. Verificar Node.js ───

if command -v node &> /dev/null; then
  NODE_PATH=$(which node)
  echo "  [OK] Node.js: $(node -v)"
else
  echo "  [!] Node.js no encontrado."
  if command -v brew &> /dev/null; then
    echo "  Instalando via Homebrew..."
    brew install node
    NODE_PATH=$(which node)
    echo "  [OK] Node.js instalado: $(node -v)"
  else
    echo "  Instala Node.js desde: https://nodejs.org/"
    exit 1
  fi
fi

NODE_PATH=$(which node)

# ─── 2. Detener servicio previo ───

launchctl unload "$PLIST_PATH" 2>/dev/null || true
pkill -f "logirapid-print-service/server.js" 2>/dev/null || true

# ─── 3. Instalar archivos ───

mkdir -p "$INSTALL_DIR"
cp "$SCRIPT_DIR/package.json" "$INSTALL_DIR/"
cp "$SCRIPT_DIR/server.js" "$INSTALL_DIR/"
echo "  [OK] Archivos instalados en $INSTALL_DIR"

# ─── 4. Instalar dependencias ───

cd "$INSTALL_DIR"
npm install --omit=dev --silent 2>/dev/null
echo "  [OK] Dependencias instaladas"

# ─── 5. Configurar ───

if [ -f "$INSTALL_DIR/config.json" ]; then
  echo "  [OK] Configuracion existente encontrada"
  echo ""
  echo "  Departamentos emparejados:"
  node -e "const c=JSON.parse(require('fs').readFileSync('$INSTALL_DIR/config.json','utf8')); (c.tokens||[]).forEach((t,i)=>console.log('    '+(i+1)+'. '+t.name))"
  echo ""
  read -p "  Agregar otro departamento? (s/n, default: n): " ADD_MORE
  if [ "$ADD_MORE" = "s" ] || [ "$ADD_MORE" = "S" ]; then
    read -p "  Token del nuevo departamento: " NEW_TOKEN
    if [ -n "$NEW_TOKEN" ]; then
      cd "$INSTALL_DIR" && node -e "
        const fs = require('fs');
        const config = JSON.parse(fs.readFileSync('config.json','utf8'));
        if (config.tokens.some(t => t.token === '$NEW_TOKEN')) { console.log('  [!] Token ya registrado.'); process.exit(0); }
        fetch(config.server + '/api/print-agent?token=$NEW_TOKEN&version=1.0.0')
          .then(r => { if(!r.ok) throw new Error('Token invalido'); return r.json(); })
          .then(d => {
            config.tokens.push({ token: '$NEW_TOKEN', name: d.service_name });
            fs.writeFileSync('config.json', JSON.stringify(config, null, 2));
            console.log('  [OK] Departamento agregado: ' + d.service_name);
          })
          .catch(e => { console.error('  [ERROR] ' + e.message); process.exit(1); });
      " 2>&1
    fi
  fi
else
  echo ""
  echo "  ─── Configuracion inicial ───"
  echo ""
  read -p "  URL del servidor: " SERVER_URL

  if [ -z "$SERVER_URL" ]; then
    echo "  [ERROR] URL del servidor requerida."
    exit 1
  fi

  read -p "  Token de emparejamiento: " PAIRING_TOKEN

  if [ -z "$PAIRING_TOKEN" ]; then
    echo "  [ERROR] Token requerido. Obtienelo desde Settings en el departamento."
    exit 1
  fi

  echo "  Verificando token..."
  RESULT=$(node -e "
    fetch('${SERVER_URL}/api/print-agent?token=${PAIRING_TOKEN}&version=1.0.0')
      .then(r => { if(!r.ok) throw new Error('invalido'); return r.json(); })
      .then(d => console.log(d.service_name))
      .catch(() => { console.error('ERROR'); process.exit(1); });
  " 2>&1)

  if [ "$RESULT" = "ERROR" ]; then
    echo "  [ERROR] Token invalido o servidor no accesible."
    exit 1
  fi

  echo "  [OK] Conectado a: $RESULT"

  cat > "$INSTALL_DIR/config.json" << CONF
{
  "server": "${SERVER_URL}",
  "tokens": [
    { "token": "${PAIRING_TOKEN}", "name": "${RESULT}" }
  ]
}
CONF
  echo "  [OK] Configuracion guardada"
fi

# ─── 6. Crear LaunchAgent ───

mkdir -p "$HOME/Library/LaunchAgents"

cat > "$PLIST_PATH" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.logirapid.print-service</string>
    <key>ProgramArguments</key>
    <array>
        <string>${NODE_PATH}</string>
        <string>${INSTALL_DIR}/server.js</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${INSTALL_DIR}/print-service.log</string>
    <key>StandardErrorPath</key>
    <string>${INSTALL_DIR}/print-service-error.log</string>
    <key>WorkingDirectory</key>
    <string>${INSTALL_DIR}</string>
</dict>
</plist>
PLIST

# ─── 7. Iniciar servicio ───

launchctl load "$PLIST_PATH"

echo ""
echo "  ==========================================="
echo "   Instalacion Completa"
echo "  ==========================================="
echo ""
echo "  El servicio esta corriendo y escuchando trabajos de impresion."
echo "  Se inicia automaticamente al encender la Mac."
echo ""
echo "  Comandos utiles:"
echo "    Ver departamentos:     cd ~/.logirapid-print-service && node server.js --list"
echo "    Agregar departamento:  cd ~/.logirapid-print-service && node server.js --add-token"
echo "    Quitar departamento:   cd ~/.logirapid-print-service && node server.js --remove-token"
echo "    Ver logs:              tail -f ~/.logirapid-print-service/print-service.log"
echo "    Reiniciar:             launchctl unload ~/Library/LaunchAgents/com.logirapid.print-service.plist && launchctl load ~/Library/LaunchAgents/com.logirapid.print-service.plist"
echo "    Desinstalar:           bash $(dirname "$0")/uninstall-mac.sh"
echo ""
