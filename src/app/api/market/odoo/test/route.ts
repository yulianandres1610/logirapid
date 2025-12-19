import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { url, database, username, apiKey } = body

    if (!url) {
      return NextResponse.json({ success: false, error: 'URL requerida' }, { status: 400 })
    }

    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'API Key requerida' }, { status: 400 })
    }

    if (!database) {
      return NextResponse.json({ success: false, error: 'Base de datos requerida' }, { status: 400 })
    }

    const baseUrl = url.replace(/\/$/, '')
    console.log('[Odoo Test] Testing:', { url: baseUrl, database, username })

    // Step 1: Test server connectivity and get version
    let version = null
    try {
      const versionResponse = await fetch(`${baseUrl}/web/webclient/version_info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: {},
          id: Date.now()
        }),
        signal: AbortSignal.timeout(10000) // 10 second timeout
      })

      if (!versionResponse.ok) {
        return NextResponse.json({
          success: false,
          error: `Servidor no accesible (HTTP ${versionResponse.status})`
        })
      }

      const versionData = await versionResponse.json()
      version = versionData.result?.server_version
      console.log('[Odoo Test] Server version:', version)
    } catch (error) {
      console.error('[Odoo Test] Version check failed:', error)
      return NextResponse.json({
        success: false,
        error: 'No se pudo conectar al servidor. Verifica la URL.'
      })
    }

    // Step 2: Authenticate using XML-RPC (most reliable method)
    const login = username || 'admin'

    try {
      const authResponse = await fetch(`${baseUrl}/jsonrpc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: {
            service: 'common',
            method: 'authenticate',
            args: [database, login, apiKey, {}]
          },
          id: Date.now()
        }),
        signal: AbortSignal.timeout(15000) // 15 second timeout
      })

      if (!authResponse.ok) {
        return NextResponse.json({
          success: false,
          error: `Error de autenticación (HTTP ${authResponse.status})`,
          version
        })
      }

      const authData = await authResponse.json()

      if (authData.error) {
        return NextResponse.json({
          success: false,
          error: authData.error.data?.message || authData.error.message || 'Error de autenticación',
          version
        })
      }

      const uid = authData.result

      if (!uid || uid === false || (typeof uid === 'number' && uid <= 0)) {
        return NextResponse.json({
          success: false,
          error: 'Credenciales inválidas. Verifica usuario y API Key.',
          version
        })
      }

      console.log('[Odoo Test] Auth successful, UID:', uid)

      // Step 3: Test a simple query to verify full access
      try {
        const testResponse = await fetch(`${baseUrl}/jsonrpc`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'call',
            params: {
              service: 'object',
              method: 'execute_kw',
              args: [database, uid, apiKey, 'product.product', 'search_count', [[['active', '=', true]]]]
            },
            id: Date.now()
          }),
          signal: AbortSignal.timeout(15000)
        })

        const testData = await testResponse.json()
        const productCount = testData.result

        return NextResponse.json({
          success: true,
          message: `Conexión exitosa. Usuario: ${login}, UID: ${uid}`,
          version,
          productCount: typeof productCount === 'number' ? productCount : undefined
        })
      } catch {
        // Even if product count fails, auth worked
        return NextResponse.json({
          success: true,
          message: `Conexión exitosa. Usuario: ${login}, UID: ${uid}`,
          version
        })
      }

    } catch (error) {
      console.error('[Odoo Test] Auth error:', error)
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Error de autenticación',
        version
      })
    }

  } catch (error) {
    console.error('[Odoo Test] General error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error de conexión'
    }, { status: 500 })
  }
}
