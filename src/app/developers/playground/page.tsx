'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { BookOpen, Copy, ShieldCheck, Zap } from 'lucide-react'

type PlaygroundResult = {
  status: number
  body: unknown
  durationMs?: number
}

const cardClass =
  'rounded-2xl border border-white/10 bg-gray-900/70 backdrop-blur-lg shadow-2xl shadow-exa-primary/10'

export default function DevelopersPlaygroundPage() {
  const [baseUrl, setBaseUrl] = useState('https://dev.logirapid.com')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<PlaygroundResult | null>(null)

  const loginUrl = useMemo(() => `${(baseUrl || '').replace(/\/+$/, '')}/api/auth/login`, [baseUrl])

  const copyToClipboard = async (text: string, tag: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(tag)
      setTimeout(() => setCopied(null), 1500)
    } catch (error) {
      console.error('No se pudo copiar', error)
    }
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsLoading(true)
    setResult(null)

    const startedAt = performance.now()

    try {
      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })

      const body = await response.json().catch(() => ({}))
      setResult({
        status: response.status,
        body,
        durationMs: Math.round(performance.now() - startedAt)
      })
    } catch (error) {
      setResult({
        status: 0,
        body: {
          error: 'No se pudo contactar el endpoint',
          details: error instanceof Error ? error.message : String(error)
        }
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0f1c] text-white">
      <header className="border-b border-white/5 bg-gray-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="relative h-12 w-40">
              <Image src="/logo-blanco.png" alt="LogiRapid" fill className="object-contain" priority />
            </div>
          </div>
          <nav className="hidden items-center gap-4 text-sm text-white/75 md:flex">
            <a href="/" className="hover:text-white transition-colors">Inicio</a>
            <a href="/developers" className="hover:text-white transition-colors">Developers</a>
            <a href="/developers/documentacion" className="hover:text-white transition-colors">Documentación</a>
          </nav>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-12">
        <section className={`${cardClass} p-6 space-y-4`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-white/50">Playground</p>
              <h1 className="text-3xl font-bold text-white">Prueba el login en vivo</h1>
              <p className="text-sm text-white/70">Define la base URL, envía tus credenciales y observa el cuerpo de la respuesta.</p>
            </div>
            <div className="rounded-full bg-exa-secondary/15 px-3 py-1 text-xs font-semibold text-exa-secondary">En vivo</div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-white/70" htmlFor="baseUrl">Base URL</label>
              <div className="flex gap-2">
                <input
                  id="baseUrl"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-exa-secondary focus:outline-none"
                  placeholder="https://api.logirapid.com"
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(loginUrl, 'url')}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 text-xs text-white/80 transition hover:border-white/20"
                >
                  {copied === 'url' ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm text-white/70" htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-exa-secondary focus:outline-none"
                  placeholder="admin@logirapid.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-white/70" htmlFor="password">Contraseña</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-exa-secondary focus:outline-none"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#cc0a46] px-4 py-3 text-sm font-semibold shadow-lg shadow-exa-primary/30 transition hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isLoading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Ejecutando...
                </>
              ) : (
                <>
                  Ejecutar prueba
                  <Zap size={16} />
                </>
              )}
            </button>

            <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-xs text-white/70">
              Se emiten cookies (`auth-token`, `user-id`, `user-role`, `user-company-id`, `user-company-name`) y el token también viene en el body.
            </div>
          </form>
        </section>

        <section className={`${cardClass} p-6`}>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white/10 p-2">
              <BookOpen className="h-5 w-5 text-exa-secondary" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-white/50">Resultado</p>
              <h2 className="text-xl font-semibold text-white">Respuesta del endpoint</h2>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3 text-sm">
            <span className="rounded-full bg-white/5 px-3 py-1 text-white/70">Status</span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                result
                  ? result.status >= 200 && result.status < 300
                    ? 'bg-emerald-500/15 text-emerald-200'
                    : 'bg-red-500/15 text-red-200'
                  : 'bg-white/5 text-white/60'
              }`}
            >
              {result ? (result.status === 0 ? 'sin conexión' : result.status) : '—'}
            </span>
            {result?.durationMs !== undefined && (
              <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-white/70">
                {result.durationMs} ms
              </span>
            )}
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-black/40 p-4">
            <div className="mb-2 flex items-center justify-between text-xs text-white/60">
              <span>Body</span>
              <button
                onClick={() => copyToClipboard(JSON.stringify(result?.body ?? {}, null, 2), 'body')}
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-1.5 text-[11px] text-white/70 transition hover:border-white/25"
              >
                <Copy size={12} />
                {copied === 'body' ? 'Copiado' : 'Copiar'}
              </button>
            </div>
            <pre className="max-h-[300px] overflow-auto whitespace-pre-wrap text-sm leading-relaxed text-white/80">
              {result ? JSON.stringify(result.body, null, 2) : '// Ejecuta el endpoint para ver la respuesta'}
            </pre>
          </div>
        </section>

        <section className={`${cardClass} p-6`}>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white/10 p-2">
              <ShieldCheck className="h-5 w-5 text-exa-secondary" />
            </div>
            <h2 className="text-xl font-semibold text-white">Consejos rápidos</h2>
          </div>
          <ul className="mt-3 space-y-2 text-sm text-white/80">
            <li>Usa `COOKIE_DOMAIN` en producción para compartir sesión entre subdominios.</li>
            <li>Propaga `x-auth-token` en integraciones server-to-server.</li>
            <li>Los tokens expiran en 7 días; rota credenciales si la app es headless.</li>
          </ul>
        </section>
      </main>

      <footer className="mt-12 border-t border-white/5 bg-gray-900">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="relative h-10 w-28">
              <Image src="/logo-blanco.png" alt="LogiRapid" fill className="object-contain" />
            </div>
            <p className="text-sm text-white/60">Construido para desarrolladores · LogiRapid LLC</p>
          </div>
          <div className="flex items-center gap-3 text-sm text-white/70">
            <div className="rounded-full bg-exa-primary/15 px-3 py-1 text-exa-primary">Soporte técnico</div>
            <span className="text-white/80">645 2432404</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
