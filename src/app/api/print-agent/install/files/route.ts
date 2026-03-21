import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

const ALLOWED_FILES: Record<string, { path: string; contentType: string }> = {
  'server.js': {
    path: 'print-service/server.js',
    contentType: 'application/javascript; charset=utf-8',
  },
  'package.json': {
    path: 'print-service/package.json',
    contentType: 'application/json; charset=utf-8',
  },
  'uninstall-mac.sh': {
    path: 'print-service/uninstall-mac.sh',
    contentType: 'text/plain; charset=utf-8',
  },
  'uninstall-windows.bat': {
    path: 'print-service/uninstall-windows.bat',
    contentType: 'text/plain; charset=utf-8',
  },
}

/**
 * GET /api/print-agent/install/files?name=server.js
 *
 * Serves print service files for remote installation.
 * Only allows downloading specific whitelisted files.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const fileName = searchParams.get('name')

  if (!fileName || !ALLOWED_FILES[fileName]) {
    return NextResponse.json(
      { error: 'File not found. Allowed: ' + Object.keys(ALLOWED_FILES).join(', ') },
      { status: 404 }
    )
  }

  const fileInfo = ALLOWED_FILES[fileName]

  // Try to read from the filesystem (works in development and self-hosted)
  try {
    // Try multiple possible locations for the file
    const possiblePaths = [
      path.join(process.cwd(), fileInfo.path),
      path.join(process.cwd(), 'public', fileInfo.path),
      path.join(process.cwd(), '..', fileInfo.path),
    ]

    for (const filePath of possiblePaths) {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8')
        return new NextResponse(content, {
          headers: {
            'Content-Type': fileInfo.contentType,
            'Content-Disposition': `inline; filename="${fileName}"`,
            'Cache-Control': 'public, max-age=300',
          },
        })
      }
    }
  } catch {
    // Fall through to embedded content
  }

  // Fallback: serve embedded content for Vercel/serverless where filesystem isn't available
  const embedded = getEmbeddedFile(fileName)
  if (embedded) {
    return new NextResponse(embedded, {
      headers: {
        'Content-Type': fileInfo.contentType,
        'Content-Disposition': `inline; filename="${fileName}"`,
        'Cache-Control': 'public, max-age=300',
      },
    })
  }

  return NextResponse.json(
    { error: `File ${fileName} not available on this deployment` },
    { status: 404 }
  )
}

function getEmbeddedFile(name: string): string | null {
  switch (name) {
    case 'package.json':
      return JSON.stringify({
        name: 'logirapid-print-service',
        version: '1.2.2',
        description: 'LogiRapid Print Service - Agente local de impresion',
        main: 'server.js',
        scripts: {
          start: 'node server.js',
          setup: 'node server.js --setup',
        },
        optionalDependencies: {
          'pdf-to-printer': '^5.6.0',
        },
      }, null, 2)

    case 'uninstall-mac.sh':
      return `#!/bin/bash
# ─── LogiRapid Print Service - Desinstalador Mac ───

echo ""
echo "  Desinstalando LogiRapid Print Service..."
echo ""

PLIST_PATH="$HOME/Library/LaunchAgents/com.logirapid.print-service.plist"
INSTALL_DIR="$HOME/.logirapid-print-service"

launchctl unload "$PLIST_PATH" 2>/dev/null || true
echo "  Servicio detenido."

rm -f "$PLIST_PATH"
echo "  LaunchAgent eliminado."

rm -rf "$INSTALL_DIR"
echo "  Archivos eliminados."

echo ""
echo "  Desinstalacion completa."
echo ""
`

    case 'uninstall-windows.bat':
      return `@echo off
REM ─── LogiRapid Print Service - Desinstalador Windows ───

echo.
echo   Desinstalando LogiRapid Print Service...
echo.

set INSTALL_DIR=%USERPROFILE%\\.logirapid-print-service
set STARTUP_DIR=%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\Startup

taskkill /FI "WINDOWTITLE eq LogiRapid Print Service" /F >nul 2>nul
echo   Servicio detenido.

del /F "%STARTUP_DIR%\\LogiRapid Print Service.lnk" 2>nul
echo   Inicio automatico eliminado.

rmdir /S /Q "%INSTALL_DIR%" 2>nul
echo   Archivos eliminados.

echo.
echo   Desinstalacion completa.
echo.
pause
`

    default:
      return null
  }
}
