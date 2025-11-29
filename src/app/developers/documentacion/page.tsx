'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import {
  BookOpen,
  Check,
  ChevronRight,
  ExternalLink,
  Key,
  Lock,
  Server,
  Shield,
  Terminal,
  AlertTriangle,
  Info
} from 'lucide-react'
import CodeBlock from './components/CodeBlock'
import ParameterTable from './components/ParameterTable'
import Sidebar from './components/Sidebar'
import {
  navigationItems,
  baseUrls,
  authEndpoints,
  errorCodes,
  userRoles,
  servicesEndpoints,
  availableServices
} from './data/auth-api'
import { trackerEndpoints, searchTypePatterns } from './data/tracker-api'
import { paqueteriaEndpoints, orderTypes, orderStatuses } from './data/paqueteria-api'
import { driverEndpoints, empaqueStates } from './data/driver-api'

const methodColors: Record<string, string> = {
  GET: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  POST: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  PUT: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  PATCH: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  DELETE: 'bg-red-500/20 text-red-400 border-red-500/30',
}

export default function DevelopersDocsPage() {
  const [activeSection, setActiveSection] = useState('overview')
  const [environment, setEnvironment] = useState<'production' | 'sandbox'>('sandbox')
  const contentRef = useRef<HTMLDivElement>(null)
  const isScrollingRef = useRef(false)

  // Read hash from URL on mount and scroll to section
  useEffect(() => {
    const hash = window.location.hash.replace('#', '')
    if (hash) {
      setActiveSection(hash)
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        const element = document.querySelector(`[data-section="${hash}"]`)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }, 100)
    }
  }, [])

  // Update active section based on scroll position
  useEffect(() => {
    const handleScroll = () => {
      if (!contentRef.current || isScrollingRef.current) return

      const sections = contentRef.current.querySelectorAll('[data-section]')
      let currentSection = 'overview'

      sections.forEach((section) => {
        const rect = section.getBoundingClientRect()
        if (rect.top <= 150) {
          currentSection = section.getAttribute('data-section') || 'overview'
        }
      })

      // Update URL hash without triggering scroll
      if (currentSection !== activeSection) {
        setActiveSection(currentSection)
        window.history.replaceState(null, '', `#${currentSection}`)
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [activeSection])

  const scrollToSection = (id: string) => {
    const element = document.querySelector(`[data-section="${id}"]`)
    if (element) {
      isScrollingRef.current = true
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
      // Reset scrolling flag after animation
      setTimeout(() => {
        isScrollingRef.current = false
      }, 1000)
    }
    setActiveSection(id)
    // Update URL hash
    window.history.pushState(null, '', `#${id}`)
  }

  const baseUrl = environment === 'production' ? baseUrls.production : baseUrls.sandbox

  return (
    <div className="min-h-screen bg-[#0b0f1a] text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0b0f1a]/95 backdrop-blur-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <a href="/developers" className="flex items-center gap-3">
              <div className="relative h-10 w-32">
                <Image src="/logo-blanco.png" alt="LogiRapid" fill className="object-contain" priority />
              </div>
            </a>
            <nav className="hidden items-center gap-1 md:flex">
              <a
                href="/developers/documentacion"
                className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium text-white"
              >
                Docs
              </a>
              <a
                href="/developers/playground"
                className="rounded-lg px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Playground
              </a>
            </nav>
          </div>

          {/* Environment Switcher */}
          <div className="flex items-center gap-3">
            <a
              href="/api/openapi.json"
              target="_blank"
              className="hidden sm:flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-gray-400 hover:text-white hover:border-white/20 transition-colors"
            >
              <Server className="h-3.5 w-3.5" />
              OpenAPI
            </a>
            <div className="flex items-center rounded-lg border border-white/10 bg-white/5 p-1">
              <button
                onClick={() => setEnvironment('sandbox')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  environment === 'sandbox'
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Sandbox
              </button>
              <button
                onClick={() => setEnvironment('production')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  environment === 'production'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Production
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl">
        {/* Sidebar */}
        <aside className="hidden lg:block w-64 shrink-0 border-r border-white/10">
          <div className="sticky top-20 h-[calc(100vh-5rem)] overflow-y-auto p-6">
            <div className="mb-6">
              <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
                Base URL
              </span>
              <div className="mt-2 rounded-lg bg-white/5 border border-white/10 px-3 py-2">
                <code className="text-xs text-[#cc0a46] break-all">{baseUrl}</code>
              </div>
            </div>
            <Sidebar
              items={navigationItems}
              activeSection={activeSection}
              onNavigate={scrollToSection}
            />
          </div>
        </aside>

        {/* Main Content */}
        <main ref={contentRef} className="flex-1 min-w-0">
          <div className="px-6 py-10 lg:px-12">

            {/* Introduction Section */}
            <section data-section="overview" className="mb-16">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-xl bg-[#cc0a46]/20">
                  <BookOpen className="h-6 w-6 text-[#cc0a46]" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-white">API Reference</h1>
                  <p className="text-gray-400 text-sm">Documentacion completa de la API de LogiRapid</p>
                </div>
              </div>

              <div className="prose prose-invert max-w-none">
                <p className="text-gray-300 text-lg leading-relaxed">
                  La API de LogiRapid te permite integrar funcionalidades de logistica y envios en tu aplicacion.
                  Esta documentacion cubre todos los endpoints disponibles, con ejemplos de codigo en multiples lenguajes.
                </p>
              </div>

              <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  { icon: Shield, title: 'Autenticacion JWT', desc: 'Tokens seguros con expiracion de 7 dias' },
                  { icon: Server, title: 'RESTful API', desc: 'Endpoints estandar con JSON' },
                  { icon: Terminal, title: 'Multi-plataforma', desc: 'Ejemplos para Web, Mobile y Backend' },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="rounded-xl border border-white/10 bg-white/5 p-4 hover:border-white/20 transition-colors"
                  >
                    <item.icon className="h-5 w-5 text-[#cc0a46] mb-3" />
                    <h3 className="font-semibold text-white text-sm">{item.title}</h3>
                    <p className="text-gray-400 text-xs mt-1">{item.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Base URL Section */}
            <section data-section="base-url" className="mb-16">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Server className="h-5 w-5 text-gray-400" />
                URL Base
              </h2>

              <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-white/10">
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-500/20 text-amber-400">
                        Sandbox
                      </span>
                    </div>
                    <code className="text-sm text-gray-300">{baseUrls.sandbox}</code>
                    <p className="text-xs text-gray-500 mt-2">Para desarrollo y pruebas</p>
                  </div>
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/20 text-emerald-400">
                        Production
                      </span>
                    </div>
                    <code className="text-sm text-gray-300">{baseUrls.production}</code>
                    <p className="text-xs text-gray-500 mt-2">Para produccion</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Authentication Overview */}
            <section data-section="authentication" className="mb-16">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Key className="h-5 w-5 text-gray-400" />
                Autenticacion
              </h2>

              <div className="prose prose-invert max-w-none mb-6">
                <p className="text-gray-300">
                  LogiRapid utiliza autenticacion basada en JWT (JSON Web Tokens). Despues de iniciar sesion,
                  recibiras un token que debes incluir en el header <code className="text-[#cc0a46]">Authorization</code> de
                  todas las solicitudes autenticadas.
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-4 mb-6">
                <h4 className="text-sm font-semibold text-white mb-3">Formato del Header</h4>
                <div className="rounded-lg bg-[#1a1f2e] p-3 font-mono text-sm">
                  <span className="text-gray-400">Authorization:</span>{' '}
                  <span className="text-emerald-400">Bearer</span>{' '}
                  <span className="text-amber-400">{'<tu_token_jwt>'}</span>
                </div>
              </div>

              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                <div className="flex gap-3">
                  <Info className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-amber-400">Nota importante</h4>
                    <p className="text-sm text-amber-200/80 mt-1">
                      El token JWT expira despues de 7 dias. Asegurate de implementar logica de renovacion
                      o re-autenticacion en tu aplicacion.
                    </p>
                  </div>
                </div>
              </div>

              {/* User Roles */}
              <div className="mt-8">
                <h3 className="text-lg font-semibold text-white mb-4">Roles de Usuario</h3>
                <div className="rounded-xl border border-white/10 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-white/5 border-b border-white/10">
                        <th className="text-left px-4 py-3 text-gray-400 font-medium">Rol</th>
                        <th className="text-left px-4 py-3 text-gray-400 font-medium">Descripcion</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {userRoles.map((item) => (
                        <tr key={item.role} className="hover:bg-white/5 transition-colors">
                          <td className="px-4 py-3">
                            <code className="text-[#cc0a46] font-mono text-xs bg-[#cc0a46]/10 px-2 py-1 rounded">
                              {item.role}
                            </code>
                          </td>
                          <td className="px-4 py-3 text-gray-400">{item.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            {/* Auth Endpoints */}
            {authEndpoints.map((endpoint) => (
              <section
                key={endpoint.id}
                data-section={endpoint.id}
                className="mb-16 scroll-mt-24"
              >
                <div className="lg:grid lg:grid-cols-2 lg:gap-8">
                  {/* Left Column - Description */}
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${methodColors[endpoint.method]}`}>
                        {endpoint.method}
                      </span>
                      <code className="text-sm text-gray-300 font-mono">{endpoint.path}</code>
                    </div>

                    <h2 className="text-2xl font-bold text-white mb-3">{endpoint.title}</h2>
                    <p className="text-gray-400 mb-6">{endpoint.description}</p>

                    {/* Headers */}
                    {endpoint.headers && endpoint.headers.length > 0 && (
                      <ParameterTable
                        parameters={endpoint.headers}
                        title="Headers"
                      />
                    )}

                    {/* Request Body */}
                    {endpoint.requestBody && endpoint.requestBody.length > 0 && (
                      <ParameterTable
                        parameters={endpoint.requestBody}
                        title="Request Body"
                      />
                    )}

                    {/* Responses */}
                    <div className="mt-6">
                      <h4 className="text-sm font-semibold text-white mb-3">Respuestas</h4>
                      <div className="space-y-3">
                        {endpoint.responses.map((response) => (
                          <div
                            key={response.status}
                            className="rounded-lg border border-white/10 overflow-hidden"
                          >
                            <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border-b border-white/10">
                              <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                response.status === 200
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : response.status >= 400
                                    ? 'bg-red-500/20 text-red-400'
                                    : 'bg-amber-500/20 text-amber-400'
                              }`}>
                                {response.status}
                              </span>
                              <span className="text-sm text-gray-400">{response.description}</span>
                            </div>
                            <pre className="p-4 text-xs text-gray-300 font-mono overflow-x-auto bg-[#1a1f2e]">
                              {response.body}
                            </pre>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right Column - Code Examples */}
                  <div className="mt-8 lg:mt-0 lg:sticky lg:top-24 lg:self-start">
                    <CodeBlock
                      examples={endpoint.examples}
                      title="Request"
                    />
                  </div>
                </div>
              </section>
            ))}

            {/* Services Endpoints */}
            {servicesEndpoints.map((endpoint) => (
              <section
                key={endpoint.id}
                data-section={endpoint.id}
                className="mb-16 scroll-mt-24"
              >
                <div className="lg:grid lg:grid-cols-2 lg:gap-8">
                  {/* Left Column - Description */}
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${methodColors[endpoint.method]}`}>
                        {endpoint.method}
                      </span>
                      <code className="text-sm text-gray-300 font-mono">{endpoint.path}</code>
                    </div>

                    <h2 className="text-2xl font-bold text-white mb-3">{endpoint.title}</h2>
                    <p className="text-gray-400 mb-6">{endpoint.description}</p>

                    {/* Headers */}
                    {endpoint.headers && endpoint.headers.length > 0 && (
                      <ParameterTable
                        parameters={endpoint.headers}
                        title="Headers"
                      />
                    )}

                    {/* Parameters */}
                    {endpoint.parameters && endpoint.parameters.length > 0 && (
                      <ParameterTable
                        parameters={endpoint.parameters}
                        title="Parametros de URL"
                      />
                    )}

                    {/* Responses */}
                    <div className="mt-6">
                      <h4 className="text-sm font-semibold text-white mb-3">Respuestas</h4>
                      <div className="space-y-3">
                        {endpoint.responses.map((response) => (
                          <div
                            key={response.status}
                            className="rounded-lg border border-white/10 overflow-hidden"
                          >
                            <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border-b border-white/10">
                              <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                response.status === 200
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : response.status >= 400
                                    ? 'bg-red-500/20 text-red-400'
                                    : 'bg-amber-500/20 text-amber-400'
                              }`}>
                                {response.status}
                              </span>
                              <span className="text-sm text-gray-400">{response.description}</span>
                            </div>
                            <pre className="p-4 text-xs text-gray-300 font-mono overflow-x-auto bg-[#1a1f2e]">
                              {response.body}
                            </pre>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Available Services Table */}
                    <div className="mt-6">
                      <h4 className="text-sm font-semibold text-white mb-3">Servicios Disponibles</h4>
                      <div className="rounded-xl border border-white/10 overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-white/5 border-b border-white/10">
                              <th className="text-left px-4 py-3 text-gray-400 font-medium">Key</th>
                              <th className="text-left px-4 py-3 text-gray-400 font-medium">Nombre</th>
                              <th className="text-left px-4 py-3 text-gray-400 font-medium">Descripcion</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {availableServices.map((service) => (
                              <tr key={service.key} className="hover:bg-white/5 transition-colors">
                                <td className="px-4 py-3">
                                  <code className="text-[#cc0a46] font-mono text-xs bg-[#cc0a46]/10 px-2 py-1 rounded">
                                    {service.key}
                                  </code>
                                </td>
                                <td className="px-4 py-3 text-gray-300">{service.name}</td>
                                <td className="px-4 py-3 text-gray-400">{service.description}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Right Column - Code Examples */}
                  <div className="mt-8 lg:mt-0 lg:sticky lg:top-24 lg:self-start">
                    <CodeBlock
                      examples={endpoint.examples}
                      title="Request"
                    />
                  </div>
                </div>
              </section>
            ))}

            {/* Tracker Endpoints */}
            {trackerEndpoints.map((endpoint) => (
              <section
                key={endpoint.id}
                data-section={endpoint.id}
                className="mb-16 scroll-mt-24"
              >
                <div className="lg:grid lg:grid-cols-2 lg:gap-8">
                  {/* Left Column - Description */}
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${methodColors[endpoint.method]}`}>
                        {endpoint.method}
                      </span>
                      <code className="text-sm text-gray-300 font-mono">{endpoint.path}</code>
                    </div>

                    <h2 className="text-2xl font-bold text-white mb-3">{endpoint.title}</h2>
                    <p className="text-gray-400 mb-6">{endpoint.description}</p>

                    {/* Headers */}
                    {endpoint.headers && endpoint.headers.length > 0 && (
                      <ParameterTable
                        parameters={endpoint.headers}
                        title="Headers"
                      />
                    )}

                    {/* Query Parameters */}
                    {endpoint.parameters && endpoint.parameters.length > 0 && (
                      <ParameterTable
                        parameters={endpoint.parameters}
                        title="Query Parameters"
                      />
                    )}

                    {/* Auto-detection patterns */}
                    <div className="mt-6">
                      <h4 className="text-sm font-semibold text-white mb-3">Auto-deteccion de Tipo</h4>
                      <div className="rounded-xl border border-white/10 overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-white/5 border-b border-white/10">
                              <th className="text-left px-4 py-3 text-gray-400 font-medium">Tipo</th>
                              <th className="text-left px-4 py-3 text-gray-400 font-medium">Patron</th>
                              <th className="text-left px-4 py-3 text-gray-400 font-medium">Ejemplo</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {searchTypePatterns.map((pattern) => (
                              <tr key={pattern.type} className="hover:bg-white/5 transition-colors">
                                <td className="px-4 py-3">
                                  <code className="text-[#cc0a46] font-mono text-xs bg-[#cc0a46]/10 px-2 py-1 rounded">
                                    {pattern.type}
                                  </code>
                                </td>
                                <td className="px-4 py-3 text-gray-300 text-xs">{pattern.patterns.join(', ')}</td>
                                <td className="px-4 py-3 text-gray-400 text-xs font-mono">{pattern.example}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Responses */}
                    <div className="mt-6">
                      <h4 className="text-sm font-semibold text-white mb-3">Respuestas</h4>
                      <div className="space-y-3">
                        {endpoint.responses.map((response) => (
                          <div
                            key={response.status + response.description}
                            className="rounded-lg border border-white/10 overflow-hidden"
                          >
                            <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border-b border-white/10">
                              <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                response.status === 200
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : response.status >= 400
                                    ? 'bg-red-500/20 text-red-400'
                                    : 'bg-amber-500/20 text-amber-400'
                              }`}>
                                {response.status}
                              </span>
                              <span className="text-sm text-gray-400">{response.description}</span>
                            </div>
                            <pre className="p-4 text-xs text-gray-300 font-mono overflow-x-auto bg-[#1a1f2e] max-h-96">
                              {response.body}
                            </pre>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right Column - Code Examples */}
                  <div className="mt-8 lg:mt-0 lg:sticky lg:top-24 lg:self-start">
                    <CodeBlock
                      examples={endpoint.examples}
                      title="Request"
                    />
                  </div>
                </div>
              </section>
            ))}

            {/* Paqueteria Endpoints */}
            {paqueteriaEndpoints.map((endpoint) => (
              <section
                key={endpoint.id}
                data-section={endpoint.id}
                className="mb-16 scroll-mt-24"
              >
                <div className="lg:grid lg:grid-cols-2 lg:gap-8">
                  {/* Left Column - Description */}
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${methodColors[endpoint.method]}`}>
                        {endpoint.method}
                      </span>
                      <code className="text-sm text-gray-300 font-mono">{endpoint.path}</code>
                    </div>

                    <h2 className="text-2xl font-bold text-white mb-3">{endpoint.title}</h2>
                    <p className="text-gray-400 mb-6">{endpoint.description}</p>

                    {/* Headers */}
                    {endpoint.headers && endpoint.headers.length > 0 && (
                      <ParameterTable
                        parameters={endpoint.headers}
                        title="Headers"
                      />
                    )}

                    {/* URL Parameters */}
                    {endpoint.parameters && endpoint.parameters.length > 0 && (
                      <ParameterTable
                        parameters={endpoint.parameters}
                        title="Parametros"
                      />
                    )}

                    {/* Request Body */}
                    {endpoint.requestBody && endpoint.requestBody.length > 0 && (
                      <ParameterTable
                        parameters={endpoint.requestBody}
                        title="Request Body"
                      />
                    )}

                    {/* Responses */}
                    <div className="mt-6">
                      <h4 className="text-sm font-semibold text-white mb-3">Respuestas</h4>
                      <div className="space-y-3">
                        {endpoint.responses.map((response) => (
                          <div
                            key={response.status + response.description}
                            className="rounded-lg border border-white/10 overflow-hidden"
                          >
                            <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border-b border-white/10">
                              <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                response.status === 200
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : response.status >= 400
                                    ? 'bg-red-500/20 text-red-400'
                                    : 'bg-amber-500/20 text-amber-400'
                              }`}>
                                {response.status}
                              </span>
                              <span className="text-sm text-gray-400">{response.description}</span>
                            </div>
                            <pre className="p-4 text-xs text-gray-300 font-mono overflow-x-auto bg-[#1a1f2e] max-h-96">
                              {response.body}
                            </pre>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right Column - Code Examples */}
                  <div className="mt-8 lg:mt-0 lg:sticky lg:top-24 lg:self-start">
                    <CodeBlock
                      examples={endpoint.examples}
                      title="Request"
                    />
                  </div>
                </div>
              </section>
            ))}

            {/* Driver Endpoints */}
            {driverEndpoints.map((endpoint) => (
              <section
                key={endpoint.id}
                data-section={endpoint.id}
                className="mb-16 scroll-mt-24"
              >
                <div className="lg:grid lg:grid-cols-2 lg:gap-8">
                  {/* Left Column - Description */}
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${methodColors[endpoint.method]}`}>
                        {endpoint.method}
                      </span>
                      <code className="text-sm text-gray-300 font-mono">{endpoint.path}</code>
                    </div>

                    <h2 className="text-2xl font-bold text-white mb-3">{endpoint.title}</h2>
                    <p className="text-gray-400 mb-6">{endpoint.description}</p>

                    {/* Headers */}
                    {endpoint.headers && endpoint.headers.length > 0 && (
                      <ParameterTable
                        parameters={endpoint.headers}
                        title="Headers"
                      />
                    )}

                    {/* Query Parameters */}
                    {endpoint.queryParams && endpoint.queryParams.length > 0 && (
                      <ParameterTable
                        parameters={endpoint.queryParams}
                        title="Query Parameters"
                      />
                    )}

                    {/* Request Body */}
                    {endpoint.requestBody && endpoint.requestBody.length > 0 && (
                      <ParameterTable
                        parameters={endpoint.requestBody}
                        title="Request Body"
                      />
                    )}

                    {/* Responses */}
                    <div className="mt-6">
                      <h4 className="text-sm font-semibold text-white mb-3">Respuestas</h4>
                      <div className="space-y-3">
                        {endpoint.responses.map((response) => (
                          <div
                            key={response.status + response.description}
                            className="rounded-lg border border-white/10 overflow-hidden"
                          >
                            <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border-b border-white/10">
                              <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                response.status === 200
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : response.status >= 400
                                    ? 'bg-red-500/20 text-red-400'
                                    : 'bg-amber-500/20 text-amber-400'
                              }`}>
                                {response.status}
                              </span>
                              <span className="text-sm text-gray-400">{response.description}</span>
                            </div>
                            <pre className="p-4 text-xs text-gray-300 font-mono overflow-x-auto bg-[#1a1f2e] max-h-96">
                              {response.body}
                            </pre>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right Column - Code Examples */}
                  <div className="mt-8 lg:mt-0 lg:sticky lg:top-24 lg:self-start">
                    <CodeBlock
                      examples={endpoint.examples}
                      title="Request"
                    />
                  </div>
                </div>
              </section>
            ))}

            {/* Empaque States Reference */}
            <section data-section="empaque-states" className="mb-16">
              <h2 className="text-xl font-bold text-white mb-4">Estados de Empaques</h2>
              <p className="text-gray-400 mb-4">
                Los empaques (cajas y bultos) siguen un flujo de estados que representa su ciclo de vida en el sistema.
              </p>
              <div className="rounded-xl border border-white/10 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-white/5 border-b border-white/10">
                      <th className="text-left px-4 py-3 text-gray-400 font-medium">Estado</th>
                      <th className="text-left px-4 py-3 text-gray-400 font-medium">Descripcion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {empaqueStates.map((state) => (
                      <tr key={state.estado} className="hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3">
                          <code className="text-[#cc0a46] font-mono text-xs bg-[#cc0a46]/10 px-2 py-1 rounded">
                            {state.estado}
                          </code>
                        </td>
                        <td className="px-4 py-3 text-gray-400">{state.descripcion}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Flujo de estados */}
              <div className="mt-6 p-4 rounded-xl border border-white/10 bg-white/5">
                <h4 className="text-sm font-semibold text-white mb-3">Flujo de Estados</h4>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-400">Caja Vacía:</span>
                    <code className="ml-2 text-xs text-emerald-400">disponible → en_reparto → recogida</code>
                  </div>
                  <div>
                    <span className="text-gray-400">Bulto (Paquete):</span>
                    <code className="ml-2 text-xs text-blue-400">recogida → en_almacen → en_transito → recibido_destino → en_reparto → entregado</code>
                  </div>
                </div>
              </div>
            </section>

            {/* Order Types Reference */}
            <section data-section="order-types" className="mb-16">
              <h2 className="text-xl font-bold text-white mb-4">Tipos de Orden</h2>
              <div className="rounded-xl border border-white/10 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-white/5 border-b border-white/10">
                      <th className="text-left px-4 py-3 text-gray-400 font-medium">Tipo</th>
                      <th className="text-left px-4 py-3 text-gray-400 font-medium">Prefijo</th>
                      <th className="text-left px-4 py-3 text-gray-400 font-medium">Descripcion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {orderTypes.map((type) => (
                      <tr key={type.type} className="hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3">
                          <code className="text-[#cc0a46] font-mono text-xs bg-[#cc0a46]/10 px-2 py-1 rounded">
                            {type.type}
                          </code>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-300">{type.prefix}</td>
                        <td className="px-4 py-3 text-gray-400">{type.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Order Statuses Reference */}
            <section data-section="order-statuses" className="mb-16">
              <h2 className="text-xl font-bold text-white mb-4">Estados de Orden</h2>
              <div className="rounded-xl border border-white/10 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-white/5 border-b border-white/10">
                      <th className="text-left px-4 py-3 text-gray-400 font-medium">Estado</th>
                      <th className="text-left px-4 py-3 text-gray-400 font-medium">Label</th>
                      <th className="text-left px-4 py-3 text-gray-400 font-medium">Descripcion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {orderStatuses.map((status) => (
                      <tr key={status.status} className="hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3">
                          <code className="text-[#cc0a46] font-mono text-xs bg-[#cc0a46]/10 px-2 py-1 rounded">
                            {status.status}
                          </code>
                        </td>
                        <td className="px-4 py-3 text-gray-300">{status.label}</td>
                        <td className="px-4 py-3 text-gray-400">{status.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Webhooks - Coming Soon */}
            <section data-section="webhooks" className="mb-16">
              <div className="rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-8">
                <div className="flex items-center gap-3 mb-4">
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-500/20 text-gray-400 border border-gray-500/30">
                    Proximamente
                  </span>
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Webhooks</h2>
                <p className="text-gray-400 mb-6">
                  Recibe notificaciones automaticas cuando ocurran eventos importantes como cambios de estado,
                  entregas completadas o problemas de entrega.
                </p>
                <div className="flex flex-wrap gap-2">
                  {['order.created', 'order.shipped', 'order.delivered', 'order.failed'].map((event) => (
                    <span key={event} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-400 font-mono">
                      {event}
                    </span>
                  ))}
                </div>
              </div>
            </section>

            {/* Error Codes Section */}
            <section data-section="errors" className="mb-16">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-gray-400" />
                Codigos de Error
              </h2>

              <p className="text-gray-400 mb-6">
                La API utiliza codigos de estado HTTP convencionales para indicar el exito o fracaso de una solicitud.
              </p>

              <div className="rounded-xl border border-white/10 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-white/5 border-b border-white/10">
                      <th className="text-left px-4 py-3 text-gray-400 font-medium w-24">Codigo</th>
                      <th className="text-left px-4 py-3 text-gray-400 font-medium w-40">Nombre</th>
                      <th className="text-left px-4 py-3 text-gray-400 font-medium">Descripcion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {errorCodes.map((error) => (
                      <tr key={error.code} className="hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                            error.code >= 500
                              ? 'bg-red-500/20 text-red-400'
                              : error.code >= 400
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-blue-500/20 text-blue-400'
                          }`}>
                            {error.code}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-300">{error.name}</td>
                        <td className="px-4 py-3 text-gray-400">{error.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Footer CTA */}
            <section className="rounded-xl border border-white/10 bg-gradient-to-br from-[#cc0a46]/10 to-transparent p-8">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">Listo para comenzar?</h3>
                  <p className="text-gray-400">
                    Prueba los endpoints en nuestro Playground interactivo o contacta a soporte tecnico.
                  </p>
                </div>
                <div className="flex gap-3">
                  <a
                    href="/developers/playground"
                    className="inline-flex items-center gap-2 rounded-lg bg-[#cc0a46] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#cc0a46]/90 transition-colors"
                  >
                    <Terminal className="h-4 w-4" />
                    Ir al Playground
                  </a>
                  <a
                    href="/developers"
                    className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Portal Developers
                  </a>
                </div>
              </div>
            </section>

          </div>
        </main>
      </div>

      {/* Footer */}
      <footer className="mt-12 border-t border-white/10 bg-[#0d1117]">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="relative h-8 w-24">
                <Image src="/logo-blanco.png" alt="LogiRapid" fill className="object-contain" />
              </div>
              <span className="text-sm text-gray-500">API Documentation v1.0</span>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-400">
              <a href="/developers" className="hover:text-white transition-colors">Portal</a>
              <a href="/developers/playground" className="hover:text-white transition-colors">Playground</a>
              <span className="text-gray-600">|</span>
              <span>Soporte: <span className="text-white">645 2432404</span></span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
