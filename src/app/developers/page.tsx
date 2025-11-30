'use client'

import { useMemo } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { ExternalLink, KeyRound, ShieldCheck } from 'lucide-react'

const normalizeBaseUrl = (url: string) => url.trim().replace(/\/+$/, '')

const sectionTitle = 'text-2xl font-semibold text-white tracking-tight'
const pillClass =
  'inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white/80 border border-white/10 backdrop-blur'
const cardClass =
  'rounded-2xl border border-white/10 bg-gray-900/70 backdrop-blur-lg shadow-2xl shadow-exa-primary/10'

const services = [
  { title: 'Rastreo en tiempo real', desc: 'Visibilidad de estado y ubicación de cada orden.' },
  { title: 'Órdenes de recogida', desc: 'Crea recogidas y logística inversa desde tu app.' },
  { title: 'Notificaciones', desc: 'Eventos automáticos para clientes y operadores.' },
  { title: 'Delivery en vivo', desc: 'Geolocalización y rutas optimizadas para entrega.' },
  { title: 'Etiquetas de envío', desc: 'Genera y imprime etiquetas listas para despachar.' }
]

const steps = [
  'Autentica en /api/auth/login y guarda el JWT.',
  'Incluye x-auth-token en llamadas de servidor.',
  'Prueba en dev.logirapid.com y luego pasa a producción.',
  'Conecta tus flujos de órdenes, tracking y notificaciones.'
]

export default function DevelopersPage() {
  const baseUrl = 'https://loogirapid.com'

  const loginUrl = useMemo(() => {
    const safeBase = normalizeBaseUrl(baseUrl)
    return `${safeBase ? safeBase : ''}/api/auth/login`
  }, [baseUrl])

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0b0f1a] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(204,10,70,0.14),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(3,116,229,0.12),transparent_30%),radial-gradient(circle_at_50%_80%,rgba(204,10,70,0.1),transparent_30%)]" />
      </div>

      <div className="relative z-10">
        <header className="border-b border-white/5 bg-gray-900">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-40 relative">
                <Image src="/logo-blanco.png" alt="LogiRapid" fill className="object-contain" priority />
              </div>
            </div>
            <nav className="hidden items-center gap-4 text-sm text-white/75 md:flex">
              <a href="/" className="hover:text-white transition-colors">Inicio</a>
              <a href="/developers/documentacion" className="hover:text-white transition-colors">Documentación</a>
              <a href="/developers/playground" className="hover:text-white transition-colors">Playground</a>
              <a href="/login" className="inline-flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/10">
                Ir al dashboard
                <ExternalLink size={16} />
              </a>
            </nav>
          </div>
        </header>

        <main className="mx-auto flex max-w-6xl flex-col gap-16 px-6 py-12 md:py-16">
          <section className="grid gap-10 rounded-3xl border border-white/5 bg-gray-950/70 p-8 shadow-2xl shadow-exa-primary/15 lg:grid-cols-[1.15fr_0.95fr]">
            <div className="space-y-8">
              <div className={pillClass}>
                <ShieldCheck size={18} className="text-exa-secondary" />
                Integraciones listas para partners
              </div>
              <div className="space-y-3">
                <h1 className="text-4xl font-bold leading-tight text-white md:text-5xl">
                  Portal de Integraciones LogiRapid
                </h1>
                <p className="max-w-2xl text-lg text-white/75">
                  Integra rastreo en tiempo real, órdenes de recogida, notificaciones, delivery geolocalizado y etiquetas de envío usando nuestras APIs. Onboarding claro, ejemplos listos y soporte dedicado.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {services.map((item, idx) => (
                  <motion.div
                    key={item.title}
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.04 * idx, duration: 0.35 }}
                    viewport={{ once: true }}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80"
                  >
                    <p className="font-semibold text-white">{item.title}</p>
                    <p className="text-xs text-white/60">{item.desc}</p>
                  </motion.div>
                ))}
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.08em] text-white/50">Producción</p>
                  <p className="text-sm font-semibold text-white">https://loogirapid.com</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.08em] text-white/50">Sandbox</p>
                  <p className="text-sm font-semibold text-white">https://dev.logirapid.com</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.08em] text-white/50">API disponible</p>
                  <p className="text-sm font-semibold text-white">Auth (Exa)</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <a
                  href="/developers/documentacion"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#cc0a46] px-5 py-3 text-sm font-semibold shadow-lg shadow-exa-primary/30 transition hover:shadow-xl"
                >
                  Ver Auth Docs
                </a>
                <a
                  href="/developers/playground"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#0374e5] px-5 py-3 text-sm font-semibold shadow-lg shadow-exa-secondary/30 transition hover:shadow-xl"
                >
                  Probar endpoint
                </a>
              </div>
            </div>

            <div className="space-y-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                viewport={{ once: true }}
                className={`${cardClass} p-5`}
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-white">Endpoint en vivo · Auth</div>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] text-white/70">Listo para usar</span>
                </div>
                <div className="mt-4 rounded-xl bg-black/40 p-4 font-mono text-sm text-white">
                  <p className="text-[#0374e5]">POST</p>
                  <p>{loginUrl}</p>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-3">
                    <div className="rounded-lg bg-white/10 p-2 text-exa-primary">
                      <ShieldCheck size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Seguridad</p>
                      <p className="text-xs text-white/60">JWT + cookies configurables por dominio.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-3">
                    <div className="rounded-lg bg-white/10 p-2 text-exa-primary">
                      <ShieldCheck size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Tenancy</p>
                      <p className="text-xs text-white/60">Cabeceras multiempresa desde middleware.</p>
                    </div>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 22 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45 }}
                viewport={{ once: true }}
                className={`${cardClass} p-5`}
              >
                <p className="text-sm font-semibold text-white mb-3">Pasos para integrar</p>
                <ol className="space-y-2 text-sm text-white/80">
                  {steps.map((step, idx) => (
                    <li key={step}>
                      <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white/80">
                        {idx + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </motion.div>
            </div>
          </section>

          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-[#cc0a46] p-2.5 shadow-lg shadow-exa-primary/30">
                <KeyRound className="h-full w-full" />
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-white/50">Rutas separadas</p>
                <h2 className={sectionTitle}>Documentación y playground dedicados</h2>
              </div>
            </div>

            <div className={`grid gap-6 lg:grid-cols-2 ${cardClass} p-6`}>
              <div className="space-y-3">
                <p className="text-lg text-white/80">
                  Usa estas páginas dedicadas para navegar, leer y probar sin distracciones. Diseñadas para transmitir confianza y claridad
                  a empresas que desean integrar sus productos con LogiRapid.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <a
                    href="/developers/documentacion"
                    className="rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-white/20 hover:bg-white/10"
                  >
                    <p className="text-sm font-semibold text-white">/developers/documentacion</p>
                    <p className="text-xs text-white/60">Guía Auth + ejemplos (web, Flutter, React Native, Kotlin, Swift).</p>
                  </a>
                  <a
                    href="/developers/playground"
                    className="rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-white/20 hover:bg-white/10"
                  >
                    <p className="text-sm font-semibold text-white">/developers/playground</p>
                    <p className="text-xs text-white/60">Prueba el login en vivo con tu base URL y credenciales.</p>
                  </a>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-white/60">Quick start</p>
                <pre className="mt-3 whitespace-pre-wrap text-sm text-white/80">
{`GET /developers/documentacion   # Lee y copia ejemplos
GET /developers/playground       # Ejecuta el login y ve la respuesta`}
                </pre>
              </div>
            </div>
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
    </div>
  )
}
