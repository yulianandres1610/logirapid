'use client'

import { motion } from 'framer-motion'
import { useBrandSafe } from '@/contexts/brand-context'

interface BrandedLoginBackgroundProps {
  children: React.ReactNode
}

/**
 * Componente de fondo para las páginas de login con soporte multi-marca.
 *
 * - LogiRapid: Tema oscuro con colores rojo/azul
 * - Servisumic: Tema claro con colores naranja/marrón
 */
export function BrandedLoginBackground({ children }: BrandedLoginBackgroundProps) {
  const { isServisumic } = useBrandSafe()

  // Clases dinámicas basadas en la marca
  const bgClass = isServisumic
    ? 'bg-gradient-to-br from-stone-100 via-white to-orange-50'
    : 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900'

  return (
    <div className={`min-h-screen ${bgClass} flex items-center justify-center p-4 relative overflow-hidden`}>
      {/* Animated Background Elements */}
      <div className="absolute inset-0">
        {isServisumic ? (
          // Servisumic: Reflejos naranjas y marrones para tema claro
          <>
            <div className="absolute top-0 left-0 w-96 h-96 bg-orange-400/15 rounded-full filter blur-3xl animate-pulse" />
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-stone-400/15 rounded-full filter blur-3xl animate-pulse delay-1000" />
            <div className="absolute top-20 right-1/4 w-72 h-72 bg-orange-300/12 rounded-full filter blur-3xl animate-pulse delay-700" />
            <div className="absolute bottom-32 left-1/3 w-80 h-80 bg-orange-400/10 rounded-full filter blur-3xl animate-pulse delay-300" />
            <div className="absolute top-1/3 right-1/5 w-64 h-64 bg-orange-500/15 rounded-full filter blur-3xl animate-pulse delay-1200" />
            <div className="absolute bottom-1/4 left-1/6 w-56 h-56 bg-stone-300/12 rounded-full filter blur-2xl animate-pulse delay-900" />
            <div className="absolute top-3/4 right-1/3 w-48 h-48 bg-orange-400/12 rounded-full filter blur-2xl animate-pulse delay-600" />
            <div className="absolute left-1/5 top-1/6 w-68 h-68 bg-orange-300/10 rounded-full filter blur-3xl animate-pulse delay-1500" />
            <div className="absolute right-1/6 bottom-1/5 w-60 h-60 bg-stone-400/14 rounded-full filter blur-2xl animate-pulse delay-400" />
            <div className="absolute top-2/3 left-1/4 w-52 h-52 bg-orange-400/8 rounded-full filter blur-3xl animate-pulse delay-1100" />
            <div className="absolute bottom-1/3 right-1/4 w-76 h-76 bg-stone-300/12 rounded-full filter blur-3xl animate-pulse delay-800" />
            <div className="absolute top-1/5 left-1/2 w-64 h-64 bg-stone-400/10 rounded-full filter blur-2xl animate-pulse delay-1400" />
          </>
        ) : (
          // LogiRapid: Reflejos rojo/azul para tema oscuro
          <>
            <div className="absolute top-0 left-0 w-96 h-96 bg-exa-primary/25 rounded-full filter blur-3xl animate-pulse" />
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-exa-secondary/25 rounded-full filter blur-3xl animate-pulse delay-1000" />
            <div className="absolute top-20 right-1/4 w-72 h-72 bg-exa-primary/18 rounded-full filter blur-3xl animate-pulse delay-700" />
            <div className="absolute bottom-32 left-1/3 w-80 h-80 bg-exa-primary/15 rounded-full filter blur-3xl animate-pulse delay-300" />
            <div className="absolute top-1/3 right-1/5 w-64 h-64 bg-exa-primary/20 rounded-full filter blur-3xl animate-pulse delay-1200" />
            <div className="absolute bottom-1/4 left-1/6 w-56 h-56 bg-exa-primary/12 rounded-full filter blur-2xl animate-pulse delay-900" />
            <div className="absolute top-3/4 right-1/3 w-48 h-48 bg-exa-primary/16 rounded-full filter blur-2xl animate-pulse delay-600" />
            <div className="absolute left-1/5 top-1/6 w-68 h-68 bg-exa-primary/14 rounded-full filter blur-3xl animate-pulse delay-1500" />
            <div className="absolute right-1/6 bottom-1/5 w-60 h-60 bg-exa-primary/18 rounded-full filter blur-2xl animate-pulse delay-400" />
            <div className="absolute top-2/3 left-1/4 w-52 h-52 bg-exa-primary/10 rounded-full filter blur-3xl animate-pulse delay-1100" />
            <div className="absolute bottom-1/3 right-1/4 w-76 h-76 bg-exa-secondary/15 rounded-full filter blur-3xl animate-pulse delay-800" />
            <div className="absolute top-1/5 left-1/2 w-64 h-64 bg-exa-secondary/12 rounded-full filter blur-2xl animate-pulse delay-1400" />
            <div className="absolute top-3/5 left-1/6 w-56 h-56 bg-exa-secondary/18 rounded-full filter blur-3xl animate-pulse delay-200" />
            <div className="absolute bottom-2/5 right-1/5 w-48 h-48 bg-exa-secondary/14 rounded-full filter blur-2xl animate-pulse delay-1700" />
            <div className="absolute left-2/5 top-1/4 w-72 h-72 bg-exa-secondary/16 rounded-full filter blur-3xl animate-pulse delay-500" />
            <div className="absolute right-2/5 bottom-1/6 w-40 h-40 bg-exa-secondary/20 rounded-full filter blur-2xl animate-pulse delay-1300" />
            <div className="absolute top-4/5 left-1/3 w-52 h-52 bg-exa-secondary/12 rounded-full filter blur-2xl animate-pulse delay-900" />
            <div className="absolute bottom-1/6 right-2/3 w-44 h-44 bg-exa-secondary/16 rounded-full filter blur-2xl animate-pulse delay-1600" />
          </>
        )}
      </div>

      {children}

      {/* Floating Elements */}
      <FloatingElements isServisumic={isServisumic} />
    </div>
  )
}

function FloatingElements({ isServisumic }: { isServisumic: boolean }) {
  const primaryColor = isServisumic ? 'bg-orange-500' : 'bg-exa-primary'
  const secondaryColor = isServisumic ? 'bg-stone-500' : 'bg-exa-secondary'

  return (
    <>
      <motion.div
        className={`absolute top-20 right-20 w-4 h-4 ${primaryColor} rounded-full opacity-80`}
        animate={{ y: [0, -40, 0], x: [0, 25, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className={`absolute bottom-32 left-16 w-3 h-3 ${secondaryColor} rounded-full opacity-70`}
        animate={{ y: [0, -25, 0], x: [0, -20, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      />
      <motion.div
        className={`absolute top-1/3 left-1/4 w-3 h-3 ${primaryColor} rounded-full opacity-60`}
        animate={{ y: [0, -30, 0], x: [0, 15, 0] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
      />
      <motion.div
        className={`absolute bottom-1/4 right-1/3 w-2 h-2 ${secondaryColor} rounded-full opacity-70`}
        animate={{ y: [0, -20, 0], x: [0, -18, 0] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
      />
      <motion.div
        className={`absolute top-2/3 right-1/5 w-3 h-3 ${primaryColor} rounded-full opacity-60`}
        animate={{ y: [0, -35, 0], x: [0, 20, 0] }}
        transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
      />
      <motion.div
        className={`absolute left-1/6 top-1/4 w-2 h-2 ${secondaryColor} rounded-full opacity-80`}
        animate={{ y: [0, -25, 0], x: [0, -15, 0] }}
        transition={{ duration: 3.3, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
      />
      <motion.div
        className={`absolute top-1/5 right-1/3 w-3 h-3 ${primaryColor} rounded-full opacity-70`}
        animate={{ y: [0, -30, 0], x: [0, 20, 0] }}
        transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut", delay: 1.8 }}
      />
      <motion.div
        className={`absolute bottom-1/5 left-1/3 w-2 h-2 ${secondaryColor} rounded-full opacity-75`}
        animate={{ y: [0, -25, 0], x: [0, -18, 0] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
      />
    </>
  )
}

/**
 * Componente de tarjeta de login con estilos de marca
 */
export function BrandedLoginCard({ children }: { children: React.ReactNode }) {
  const { isServisumic } = useBrandSafe()

  const cardClass = isServisumic
    ? 'bg-white/90 backdrop-blur-xl border border-stone-200 shadow-xl shadow-stone-200/50'
    : 'bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl'

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.6 }}
      className={`${cardClass} rounded-3xl`}
    >
      {children}
    </motion.div>
  )
}

/**
 * Componente de logo con soporte multi-marca
 *
 * Para Servisumic: El logo ya incluye el nombre de la marca, no se muestra texto adicional
 * Para LogiRapid: Se muestra el logo y opcionalmente un subtítulo
 */
export function BrandedLogo({ subtitle }: { subtitle?: string }) {
  const { brand, isServisumic } = useBrandSafe()

  const logoSrc = isServisumic ? brand.logos.light : brand.logos.dark
  const textClass = isServisumic ? 'text-stone-900' : 'text-white'
  const subtitleClass = isServisumic ? 'text-orange-600' : 'text-exa-secondary'

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.2, duration: 0.6 }}
      className="flex flex-col items-center pt-8 pb-4"
    >
      <img
        src={logoSrc}
        alt={brand.displayName}
        className={`object-contain w-full h-auto ${isServisumic ? 'max-w-[380px]' : 'max-w-xs'}`}
        onError={(e) => {
          const target = e.target as HTMLImageElement
          target.style.display = 'none'
          const parent = target.parentElement
          if (parent) {
            // Solo mostrar texto de fallback si NO es Servisumic (ya que su logo incluye el texto)
            parent.innerHTML = `
              <div class="${textClass} font-bold text-3xl tracking-wider px-4 py-2">
                ${brand.displayName}
              </div>
              ${subtitle && !isServisumic ? `<p class="${subtitleClass} text-sm mt-2">${subtitle}</p>` : ''}
            `
          }
        }}
      />
      {/* Para Servisumic no mostramos subtítulo ya que el logo incluye el nombre completo */}
      {subtitle && !isServisumic && (
        <p className={`${subtitleClass} text-sm mt-2 font-medium`}>{subtitle}</p>
      )}
    </motion.div>
  )
}

/**
 * Componente de footer con copyright de la marca
 */
export function BrandedFooter({ additionalText }: { additionalText?: string }) {
  const { brand, isServisumic } = useBrandSafe()

  const textClass = isServisumic ? 'text-stone-500' : 'text-gray-500'

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.8 }}
      className="text-center mt-8"
    >
      {additionalText && (
        <p className={`${textClass} text-xs mb-1`}>{additionalText}</p>
      )}
      <p className={`${textClass} text-xs`}>
        {brand.footer}
      </p>
    </motion.div>
  )
}

/**
 * Componente de loading overlay con estilos de marca
 */
export function BrandedLoadingOverlay({
  isVisible,
  title,
  subtitle,
  icon: Icon
}: {
  isVisible: boolean
  title: string
  subtitle?: string
  icon?: React.ComponentType<{ className?: string }>
}) {
  const { isServisumic } = useBrandSafe()

  const bgClass = isServisumic
    ? 'bg-white/95 backdrop-blur-sm'
    : 'bg-gray-900/95 backdrop-blur-sm'

  const textClass = isServisumic ? 'text-stone-900' : 'text-white'
  const subtitleTextClass = isServisumic ? 'text-stone-500' : 'text-gray-400'
  const spinnerClass = isServisumic ? 'border-orange-500' : 'border-exa-secondary'
  const iconClass = isServisumic ? 'text-orange-500' : 'text-exa-secondary'
  const primaryDot = isServisumic ? 'bg-orange-500' : 'bg-exa-primary'
  const secondaryDot = isServisumic ? 'bg-stone-500' : 'bg-exa-secondary'

  if (!isVisible) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`fixed inset-0 ${bgClass} flex items-center justify-center z-50`}
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="flex flex-col items-center justify-center space-y-6"
      >
        <div className="relative">
          <div className={`animate-spin rounded-full h-24 w-24 border-b-4 border-t-4 ${spinnerClass}`} />
          {Icon && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Icon className={`h-12 w-12 ${iconClass} animate-pulse`} />
            </div>
          )}
        </div>

        <div className="text-center space-y-3">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className={`text-2xl font-semibold ${textClass}`}
          >
            {title}
          </motion.p>
          {subtitle && (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className={`text-sm ${subtitleTextClass}`}
            >
              {subtitle}
            </motion.p>
          )}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="flex space-x-2"
        >
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1, repeat: Infinity, delay: 0 }}
            className={`w-3 h-3 ${primaryDot} rounded-full`}
          />
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
            className={`w-3 h-3 ${secondaryDot} rounded-full`}
          />
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
            className={`w-3 h-3 ${primaryDot} rounded-full`}
          />
        </motion.div>
      </motion.div>
    </motion.div>
  )
}

/**
 * Hook para obtener los estilos de formulario basados en la marca
 */
export function useBrandedFormStyles() {
  const { isServisumic } = useBrandSafe()

  return {
    inputBase: isServisumic
      ? 'bg-stone-50 border border-stone-300 text-stone-900 placeholder-stone-400 focus:ring-orange-500 focus:border-orange-500'
      : 'bg-white/5 border border-exa-secondary/30 text-white placeholder-gray-400 focus:ring-exa-secondary focus:border-exa-secondary',

    inputFilled: isServisumic
      ? 'bg-stone-100 border-orange-400/50'
      : 'bg-white/10 border-exa-secondary/50',

    buttonPrimary: isServisumic
      ? 'bg-orange-500 hover:bg-orange-600 text-white hover:shadow-xl hover:shadow-orange-500/25'
      : 'bg-exa-secondary hover:bg-exa-secondary/90 text-white hover:shadow-xl hover:shadow-exa-secondary/25',

    linkPrimary: isServisumic
      ? 'text-orange-600 hover:text-orange-700'
      : 'text-exa-primary hover:text-exa-secondary',

    linkSecondary: isServisumic
      ? 'text-stone-600 hover:text-orange-600'
      : 'text-gray-400 hover:text-white',

    textMuted: isServisumic ? 'text-stone-500' : 'text-gray-400',

    iconColor: isServisumic ? 'text-stone-400' : 'text-gray-400',
  }
}

/**
 * Componente de verificación de sesión
 */
export function BrandedSessionCheck() {
  const { isServisumic } = useBrandSafe()

  const bgClass = isServisumic
    ? 'bg-gradient-to-br from-stone-100 via-white to-orange-50'
    : 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900'

  const spinnerClass = isServisumic ? 'border-orange-500' : 'border-exa-primary'
  const textClass = isServisumic ? 'text-stone-900' : 'text-white'

  return (
    <div className={`min-h-screen ${bgClass} flex items-center justify-center p-4`}>
      <div className="text-center">
        <div className={`w-16 h-16 border-4 ${spinnerClass} border-t-transparent rounded-full animate-spin mx-auto mb-4`} />
        <p className={`${textClass} text-lg`}>Verificando sesión...</p>
      </div>
    </div>
  )
}
