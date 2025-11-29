'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  HeroSection,
  FeaturesSection,
  HowItWorksSection,
  PricingSection,
  FAQSection,
  ContactSection,
} from '@/components/public/landing'
import { PublicHeader } from '@/components/public/Header'
import { PublicFooter } from '@/components/public/Footer'

export default function HomePage() {
  const router = useRouter()
  const [showLanding, setShowLanding] = useState<boolean | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const hostname = window.location.hostname

    // Check if we're on the main domain (logirapid.com) or localhost
    const isMainDomain = hostname === 'logirapid.com' || hostname === 'www.logirapid.com'
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1'

    // If on agencias subdomain, redirect to dashboard/login
    const isAgenciasSubdomain = hostname.includes('agencias.')

    if (isAgenciasSubdomain) {
      // Check if user is authenticated and redirect accordingly
      const token = localStorage.getItem('auth-token')
      if (token) {
        router.push('/dashboard/admin')
      } else {
        router.push('/login')
      }
    } else if (isMainDomain || isLocalhost) {
      // Show landing page for main domain or localhost
      setShowLanding(true)
    } else {
      // Unknown domain - show landing as default
      setShowLanding(true)
    }
  }, [router])

  // Loading state while determining which view to show
  if (showLanding === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-exa-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white text-lg">Cargando...</p>
        </div>
      </div>
    )
  }

  // Show landing page
  if (showLanding) {
    return (
      <div className="min-h-screen bg-gray-900 text-white">
        <PublicHeader />
        <main>
          <HeroSection />
          <FeaturesSection />
          <HowItWorksSection />
          <PricingSection />
          <FAQSection />
          <ContactSection />
        </main>
        <PublicFooter />
      </div>
    )
  }

  // Fallback loading (should never reach here)
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-exa-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-white text-lg">Redirigiendo...</p>
      </div>
    </div>
  )
}