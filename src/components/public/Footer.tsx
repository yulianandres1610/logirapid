'use client'

import Link from 'next/link'
import Image from 'next/image'
import { MapPin, Phone, Mail, Facebook, Instagram, Twitter, Linkedin } from 'lucide-react'

const footerLinks = {
  empresa: [
    { label: 'Sobre Nosotros', href: '#sobre-nosotros' },
    { label: 'Servicios', href: '#servicios' },
    { label: 'Carreras', href: '#carreras' },
    { label: 'Blog', href: '#blog' },
  ],
  legal: [
    { label: 'Privacidad', href: '/privacy' },
    { label: 'Términos de Servicio', href: '/terms' },
    { label: 'Cookies', href: '/cookies' },
  ],
  soporte: [
    { label: 'Centro de Ayuda', href: '#ayuda' },
    { label: 'Rastrear Paquete', href: '/tracking' },
    { label: 'Contacto', href: '#contacto' },
    { label: 'FAQ', href: '#faq' },
  ],
}

const socialLinks = [
  { icon: Facebook, href: 'https://facebook.com/logirapid', label: 'Facebook' },
  { icon: Instagram, href: 'https://instagram.com/logirapid', label: 'Instagram' },
  { icon: Twitter, href: 'https://twitter.com/logirapid', label: 'Twitter' },
  { icon: Linkedin, href: 'https://linkedin.com/company/logirapid', label: 'LinkedIn' },
]

export function PublicFooter() {
  return (
    <footer className="bg-gray-900 border-t border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-12">
          {/* Brand Column */}
          <div className="lg:col-span-2">
            <Link href="/" className="inline-block mb-4">
              <Image
                src="/logo-blanco.png"
                alt="LogiRapid"
                width={150}
                height={40}
                className="h-10 w-auto"
              />
            </Link>
            <p className="text-gray-400 text-sm mb-6 max-w-sm">
              Soluciones de logística inteligentes para conectar tu negocio con el mundo.
              Entregas rápidas, confiables y a tu alcance.
            </p>
            <div className="space-y-3">
              <div className="flex items-center text-gray-400 text-sm">
                <MapPin className="w-4 h-4 mr-3 text-[#0374e5] flex-shrink-0" />
                <span>900 W 49th St, Suite 540, Hialeah, FL 33012</span>
              </div>
              <div className="flex items-center text-gray-400 text-sm">
                <Phone className="w-4 h-4 mr-3 text-[#0374e5]" />
                <span>+1 (645) 243-2403</span>
              </div>
              <div className="flex items-center text-gray-400 text-sm">
                <Mail className="w-4 h-4 mr-3 text-[#0374e5]" />
                <span>soporte@logirapid.com</span>
              </div>
            </div>
          </div>

          {/* Empresa Links */}
          <div>
            <h3 className="text-white font-semibold mb-4">Empresa</h3>
            <ul className="space-y-3">
              {footerLinks.empresa.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-gray-400 hover:text-white text-sm transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h3 className="text-white font-semibold mb-4">Legal</h3>
            <ul className="space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-gray-400 hover:text-white text-sm transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Soporte Links */}
          <div>
            <h3 className="text-white font-semibold mb-4">Soporte</h3>
            <ul className="space-y-3">
              {footerLinks.soporte.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-gray-400 hover:text-white text-sm transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="mt-12 pt-8 border-t border-gray-800 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-gray-500 text-sm">
            © {new Date().getFullYear()} LogiRapid. Todos los derechos reservados.
          </p>
          <div className="flex items-center space-x-4">
            {socialLinks.map((social) => (
              <a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                aria-label={social.label}
              >
                <social.icon className="w-5 h-5" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
