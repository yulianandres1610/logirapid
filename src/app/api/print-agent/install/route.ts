import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

/**
 * GET /api/print-agent/install?os=mac|windows
 *
 * Returns a self-contained install script that downloads server.js + package.json
 * from this same server and installs the print agent locally.
 *
 * Usage:
 *   Mac:     curl -fsSL https://yourserver.com/api/print-agent/install?os=mac | bash
 *   Windows: powershell -c "irm https://yourserver.com/api/print-agent/install?os=windows | iex"
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const osParam = (searchParams.get('os') || 'mac').toLowerCase()

  // Determine the base URL from the request
  const proto = request.headers.get('x-forwarded-proto') || 'https'
  const host = request.headers.get('host') || 'localhost:3000'
  const baseUrl = `${proto}://${host}`

  if (osParam === 'windows' || osParam === 'win') {
    const script = generateWindowsScript(baseUrl)
    return new NextResponse(script, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': 'inline',
      },
    })
  }

  // Default: Mac/Linux bash script
  const script = generateMacScript(baseUrl)
  return new NextResponse(script, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': 'inline',
    },
  })
}

function generateMacScript(baseUrl: string): string {
  return `#!/bin/bash
# ─── LogiRapid Print Service - Instalador Remoto Mac/Linux ───
# Generado automaticamente desde ${baseUrl}

set -e

INSTALL_DIR="$HOME/.logirapid-print-service"
PLIST_PATH="$HOME/Library/LaunchAgents/com.logirapid.print-service.plist"
BASE_URL="${baseUrl}"

echo ""
echo "  ==========================================="
echo "   LogiRapid Print Service - Instalador"
echo "  ==========================================="
echo ""

# ─── 1. Verificar e instalar dependencias ───

# Homebrew (macOS package manager)
if [ "$(uname)" = "Darwin" ]; then
  if ! command -v brew &> /dev/null; then
    echo "  [!] Homebrew no encontrado. Instalando..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" < /dev/tty
    # Add brew to PATH for Apple Silicon and Intel
    if [ -f /opt/homebrew/bin/brew ]; then
      eval "$(/opt/homebrew/bin/brew shellenv)"
    elif [ -f /usr/local/bin/brew ]; then
      eval "$(/usr/local/bin/brew shellenv)"
    fi
    echo "  [OK] Homebrew instalado"
  else
    echo "  [OK] Homebrew encontrado"
  fi
fi

# Node.js
if command -v node &> /dev/null; then
  echo "  [OK] Node.js: $(node -v)"
else
  echo "  [!] Node.js no encontrado. Instalando..."
  if command -v brew &> /dev/null; then
    brew install node
    echo "  [OK] Node.js instalado: $(node -v)"
  elif [ "$(uname)" = "Linux" ]; then
    # Linux: use NodeSource
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - 2>/dev/null
    sudo apt-get install -y nodejs 2>/dev/null || sudo yum install -y nodejs 2>/dev/null
    echo "  [OK] Node.js instalado: $(node -v)"
  else
    echo "  [ERROR] No se pudo instalar Node.js automaticamente."
    echo "  Instalalo desde: https://nodejs.org/"
    exit 1
  fi
fi

# npm (viene con Node pero verificamos)
if ! command -v npm &> /dev/null; then
  echo "  [ERROR] npm no encontrado. Reinstala Node.js desde https://nodejs.org/"
  exit 1
fi
echo "  [OK] npm: $(npm -v)"

# curl (necesario para descargas)
if ! command -v curl &> /dev/null; then
  echo "  [!] curl no encontrado. Instalando..."
  if command -v brew &> /dev/null; then
    brew install curl
  elif command -v apt-get &> /dev/null; then
    sudo apt-get install -y curl
  fi
fi

NODE_PATH=$(which node)

# ─── 2. Detener servicio previo ───

launchctl unload "$PLIST_PATH" 2>/dev/null || true
pkill -f "logirapid-print-service/server.js" 2>/dev/null || true

# ─── 3. Descargar archivos desde el servidor ───

mkdir -p "$INSTALL_DIR"

echo "  Descargando server.js..."
curl -fsSL "$BASE_URL/print-service/server.js" -o "$INSTALL_DIR/server.js" 2>/dev/null \\
  || curl -fsSL "$BASE_URL/api/print-agent/install/files?name=server.js" -o "$INSTALL_DIR/server.js"
echo "  [OK] server.js descargado"

echo "  Descargando package.json..."
curl -fsSL "$BASE_URL/print-service/package.json" -o "$INSTALL_DIR/package.json" 2>/dev/null \\
  || curl -fsSL "$BASE_URL/api/print-agent/install/files?name=package.json" -o "$INSTALL_DIR/package.json"
echo "  [OK] package.json descargado"

echo "  Descargando uninstall.sh..."
curl -fsSL "$BASE_URL/api/print-agent/install/files?name=uninstall-mac.sh" -o "$INSTALL_DIR/uninstall.sh"
chmod +x "$INSTALL_DIR/uninstall.sh"
echo "  [OK] uninstall.sh descargado"

# ─── 4. Instalar dependencias ───

cd "$INSTALL_DIR"
npm install --omit=dev --silent 2>/dev/null
echo "  [OK] Dependencias instaladas"

# ─── 5. Configurar ───
# Note: read from /dev/tty because stdin is consumed by curl|bash

if [ -f "$INSTALL_DIR/config.json" ]; then
  echo "  [OK] Configuracion existente encontrada"
  echo ""
  echo "  Departamentos emparejados:"
  node -e "const c=JSON.parse(require('fs').readFileSync('$INSTALL_DIR/config.json','utf8')); (c.tokens||[]).forEach((t,i)=>console.log('    '+(i+1)+'. '+t.name))"
  echo ""
else
  echo ""
  echo "  ─── Configuracion inicial ───"
  echo ""
  echo "  Servidor: $BASE_URL"
  echo ""
  printf "  Token de emparejamiento: "
  read PAIRING_TOKEN < /dev/tty

  if [ -z "$PAIRING_TOKEN" ]; then
    echo ""
    echo "  [!] Sin token. Puedes configurarlo despues:"
    echo "      cd ~/.logirapid-print-service && node server.js --setup"
    echo "      O abre http://localhost:9100 y agrega el token desde la UI"
    echo ""
    # Create empty config so the service starts with the web UI
    cat > "$INSTALL_DIR/config.json" << CONF
{
  "server": "$BASE_URL",
  "tokens": []
}
CONF
  else
    echo "  Verificando token..."
    RESULT=\$(node -e "
      fetch('$BASE_URL/api/print-agent?token=$PAIRING_TOKEN&version=1.0.0')
        .then(r => { if(!r.ok) throw new Error('invalido'); return r.json(); })
        .then(d => console.log(d.service_name))
        .catch(() => { console.error('ERROR'); process.exit(1); });
    " 2>&1)

    if [ "\$RESULT" = "ERROR" ]; then
      echo "  [!] Token invalido. Puedes configurarlo desde http://localhost:9100"
      cat > "$INSTALL_DIR/config.json" << CONF
{
  "server": "$BASE_URL",
  "tokens": []
}
CONF
    else
      echo "  [OK] Conectado a: \$RESULT"
      cat > "$INSTALL_DIR/config.json" << CONF
{
  "server": "$BASE_URL",
  "tokens": [
    { "token": "$PAIRING_TOKEN", "name": "\$RESULT" }
  ]
}
CONF
      echo "  [OK] Configuracion guardada"
    fi
  fi
fi

# ─── 6. Crear LaunchAgent (solo macOS) ───

if [ "$(uname)" = "Darwin" ]; then
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
        <string>$NODE_PATH</string>
        <string>$INSTALL_DIR/server.js</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$INSTALL_DIR/print-service.log</string>
    <key>StandardErrorPath</key>
    <string>$INSTALL_DIR/print-service-error.log</string>
    <key>WorkingDirectory</key>
    <string>$INSTALL_DIR</string>
</dict>
</plist>
PLIST

  launchctl load "$PLIST_PATH"
  echo "  [OK] Servicio registrado como LaunchAgent"
fi

echo ""
echo "  ==========================================="
echo "   Instalacion Completa!"
echo "  ==========================================="
echo ""
echo "  El servicio esta corriendo y escuchando trabajos de impresion."
echo "  Panel web: http://localhost:9100"
echo ""
echo "  Comandos utiles:"
echo "    Ver departamentos:     cd ~/.logirapid-print-service && node server.js --list"
echo "    Agregar departamento:  cd ~/.logirapid-print-service && node server.js --add-token"
echo "    Quitar departamento:   cd ~/.logirapid-print-service && node server.js --remove-token"
echo "    Ver logs:              tail -f ~/.logirapid-print-service/print-service.log"
echo "    Desinstalar:           bash ~/.logirapid-print-service/uninstall.sh"
echo ""
`
}

function generateWindowsScript(baseUrl: string): string {
  return `# ─── LogiRapid Print Service - Instalador Remoto Windows ───
# Generado automaticamente desde ${baseUrl}
# Ejecutar en PowerShell como: irm ${baseUrl}/api/print-agent/install?os=windows | iex

$ErrorActionPreference = "Stop"
$InstallDir = "$env:USERPROFILE\\.logirapid-print-service"
$BaseUrl = "${baseUrl}"

Write-Host ""
Write-Host "  =============================================="
Write-Host "   LogiRapid Print Service - Instalador Windows"
Write-Host "  =============================================="
Write-Host ""

# ─── 1. Verificar e instalar dependencias ───

$nodeInstalled = $false
try {
    $nodeVersion = & node -v 2>$null
    if ($nodeVersion) {
        Write-Host "  [OK] Node.js: $nodeVersion"
        $nodeInstalled = $true
    }
} catch {}

if (-not $nodeInstalled) {
    Write-Host "  [!] Node.js no encontrado. Instalando automaticamente..."
    Write-Host ""

    # Intentar con winget primero (Windows 10/11 moderno)
    $wingetAvailable = $false
    try {
        $wv = & winget --version 2>$null
        if ($wv) { $wingetAvailable = $true }
    } catch {}

    if ($wingetAvailable) {
        Write-Host "  Instalando Node.js via winget..."
        & winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements --silent 2>$null
        # Refrescar PATH
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    } else {
        # Descargar instalador MSI directamente
        Write-Host "  Descargando Node.js LTS installer..."
        $nodeInstallerUrl = "https://nodejs.org/dist/v20.18.1/node-v20.18.1-x64.msi"
        $nodeInstallerPath = "$env:TEMP\\node-installer.msi"
        Invoke-WebRequest -Uri $nodeInstallerUrl -OutFile $nodeInstallerPath -UseBasicParsing
        Write-Host "  Instalando Node.js (esto puede tomar un minuto)..."
        Start-Process msiexec.exe -ArgumentList "/i $nodeInstallerPath /qn /norestart" -Wait -NoNewWindow
        Remove-Item $nodeInstallerPath -ErrorAction SilentlyContinue
        # Refrescar PATH
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    }

    # Verificar instalacion
    try {
        $nodeVersion = & node -v 2>$null
        if ($nodeVersion) {
            Write-Host "  [OK] Node.js instalado: $nodeVersion"
        } else {
            throw "node not found"
        }
    } catch {
        Write-Host ""
        Write-Host "  [ERROR] No se pudo instalar Node.js automaticamente."
        Write-Host "  Descargalo manualmente de: https://nodejs.org/"
        Write-Host "  Despues ejecuta este instalador de nuevo."
        Write-Host ""
        Read-Host "  Presiona Enter para salir"
        exit 1
    }
}

# Verificar npm
try {
    $npmVersion = & npm -v 2>$null
    Write-Host "  [OK] npm: $npmVersion"
} catch {
    Write-Host "  [ERROR] npm no encontrado. Reinstala Node.js desde https://nodejs.org/"
    Read-Host "  Presiona Enter para salir"
    exit 1
}

# ─── 2. Detener servicio previo ───

Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
    $_.MainWindowTitle -like "*LogiRapid Print Service*"
} | Stop-Process -Force -ErrorAction SilentlyContinue

# ─── 3. Descargar archivos ───

if (!(Test-Path $InstallDir)) { New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null }

Write-Host "  Descargando server.js..."
try {
    Invoke-WebRequest -Uri "$BaseUrl/print-service/server.js" -OutFile "$InstallDir\\server.js" -UseBasicParsing
} catch {
    Invoke-WebRequest -Uri "$BaseUrl/api/print-agent/install/files?name=server.js" -OutFile "$InstallDir\\server.js" -UseBasicParsing
}
Write-Host "  [OK] server.js descargado"

Write-Host "  Descargando package.json..."
try {
    Invoke-WebRequest -Uri "$BaseUrl/print-service/package.json" -OutFile "$InstallDir\\package.json" -UseBasicParsing
} catch {
    Invoke-WebRequest -Uri "$BaseUrl/api/print-agent/install/files?name=package.json" -OutFile "$InstallDir\\package.json" -UseBasicParsing
}
Write-Host "  [OK] package.json descargado"

Write-Host "  Descargando uninstall.bat..."
Invoke-WebRequest -Uri "$BaseUrl/api/print-agent/install/files?name=uninstall-windows.bat" -OutFile "$InstallDir\\uninstall.bat" -UseBasicParsing
Write-Host "  [OK] uninstall.bat descargado"

# ─── 4. Instalar dependencias ───

Write-Host "  Instalando dependencias..."
Push-Location $InstallDir
& npm install --omit=dev --silent 2>$null
Pop-Location
Write-Host "  [OK] Dependencias instaladas"

# ─── 5. Configurar ───

$configPath = "$InstallDir\\config.json"

if (Test-Path $configPath) {
    Write-Host "  [OK] Configuracion existente encontrada"
    Write-Host ""
    $config = Get-Content $configPath | ConvertFrom-Json
    for ($i = 0; $i -lt $config.tokens.Count; $i++) {
        Write-Host "    $($i+1). $($config.tokens[$i].name)"
    }
    Write-Host ""
    $addMore = Read-Host "  Agregar otro departamento? (s/n, default: n)"
    if ($addMore -eq "s" -or $addMore -eq "S") {
        $newToken = Read-Host "  Token del nuevo departamento"
        if ($newToken) {
            Push-Location $InstallDir
            & node -e "const fs=require('fs');const c=JSON.parse(fs.readFileSync('config.json','utf8'));if(c.tokens.some(t=>t.token==='$newToken')){console.log('[!] Ya registrado');process.exit(0)}fetch(c.server+'/api/print-agent?token=$newToken&version=1.0.0').then(r=>{if(!r.ok)throw new Error();return r.json()}).then(d=>{c.tokens.push({token:'$newToken',name:d.service_name});fs.writeFileSync('config.json',JSON.stringify(c,null,2));console.log('[OK] '+d.service_name)}).catch(()=>{console.error('[ERROR]');process.exit(1)})"
            Pop-Location
        }
    }
} else {
    Write-Host ""
    Write-Host "  --- Configuracion inicial ---"
    Write-Host ""
    Write-Host "  Servidor: $BaseUrl"
    Write-Host ""
    $pairingToken = Read-Host "  Token de emparejamiento"

    if (!$pairingToken) {
        Write-Host "  [ERROR] Token requerido."
        Read-Host "  Presiona Enter para salir"
        exit 1
    }

    Write-Host "  Verificando token..."
    Push-Location $InstallDir
    & node -e "fetch('$BaseUrl/api/print-agent?token=$pairingToken&version=1.0.0').then(r=>{if(!r.ok)throw new Error();return r.json()}).then(d=>{const c={server:'$BaseUrl',tokens:[{token:'$pairingToken',name:d.service_name}]};require('fs').writeFileSync('config.json',JSON.stringify(c,null,2));console.log('[OK] '+d.service_name)}).catch(()=>{console.error('[ERROR]');process.exit(1)})"
    Pop-Location

    if ($LASTEXITCODE -ne 0) {
        Write-Host "  [ERROR] Token invalido o servidor no accesible."
        Read-Host "  Presiona Enter para salir"
        exit 1
    }

    Write-Host "  [OK] Configuracion guardada"
}

# ─── 6. Crear script de inicio ───

@"
@echo off
title LogiRapid Print Service
cd /d "$InstallDir"
node server.js
"@ | Set-Content "$InstallDir\\start.bat" -Encoding ASCII

# ─── 7. Inicio automatico ───

$startupDir = "$env:APPDATA\\Microsoft\\Windows\\Start Menu\\Programs\\Startup"
$vbsPath = "$env:TEMP\\create-shortcut.vbs"
@"
Set WshShell = CreateObject("WScript.Shell")
Set Shortcut = WshShell.CreateShortcut("$startupDir\\LogiRapid Print Service.lnk")
Shortcut.TargetPath = "cmd.exe"
Shortcut.Arguments = "/c ""$InstallDir\\start.bat"""
Shortcut.WorkingDirectory = "$InstallDir"
Shortcut.WindowStyle = 7
Shortcut.Description = "LogiRapid Print Service"
Shortcut.Save
"@ | Set-Content $vbsPath -Encoding ASCII
& cscript //nologo $vbsPath 2>$null
Remove-Item $vbsPath -ErrorAction SilentlyContinue
Write-Host "  [OK] Inicio automatico configurado"

# ─── 8. Iniciar servicio ───

Write-Host "  Iniciando servicio..."
Start-Process -FilePath "cmd.exe" -ArgumentList "/c $InstallDir\\start.bat" -WindowStyle Minimized

Write-Host ""
Write-Host "  =============================================="
Write-Host "   Instalacion Completa!"
Write-Host "  =============================================="
Write-Host ""
Write-Host "  El servicio esta corriendo y escuchando trabajos de impresion."
Write-Host "  Panel web: http://localhost:9100"
Write-Host ""
Write-Host "  Comandos utiles:"
Write-Host "    Ver departamentos:     cd $InstallDir; node server.js --list"
Write-Host "    Agregar departamento:  cd $InstallDir; node server.js --add-token"
Write-Host "    Quitar departamento:   cd $InstallDir; node server.js --remove-token"
Write-Host "    Desinstalar:           $InstallDir\\uninstall.bat"
Write-Host ""
`
}
