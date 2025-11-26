'use client'

import React from 'react'
import Link from 'next/link'
import { Shield, MessageSquare, Phone, Mail, MapPin, ArrowLeft } from 'lucide-react'

export default function ConsentimientoSMSPage() {
  const currentDate = new Date().toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <header className="bg-gray-900/80 backdrop-blur-md border-b border-gray-700 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-red-700 flex items-center justify-center shadow-lg shadow-red-500/20">
                <span className="text-white font-bold text-lg">LR</span>
              </div>
              <span className="text-xl font-bold text-white group-hover:text-red-400 transition-colors">
                LogiRapid
              </span>
            </Link>
            <Link
              href="/"
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver al inicio
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-blue-600 to-blue-700 shadow-2xl shadow-blue-500/30 mb-6">
            <MessageSquare className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Politica de Consentimiento para Mensajes SMS
          </h1>
          <p className="text-gray-400 text-lg">
            (OPT-IN)
          </p>
        </div>

        {/* Policy Content */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 p-6 sm:p-10 shadow-xl">
          {/* Company Info */}
          <div className="text-center mb-8 pb-8 border-b border-gray-700">
            <h2 className="text-2xl font-bold text-white mb-2">LogiRapid LLC</h2>
            <p className="text-gray-400">Ultima actualizacion: {currentDate}</p>
          </div>

          {/* Sections */}
          <div className="space-y-10 text-gray-300">
            {/* Section 1 */}
            <section>
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-sm font-bold">1</span>
                Introduccion
              </h3>
              <p className="leading-relaxed">
                Esta Politica de Consentimiento para Mensajes SMS describe como <strong className="text-white">LogiRapid LLC</strong> obtiene,
                verifica y administra el consentimiento explicito ("opt-in") de los usuarios para enviar mensajes de texto (SMS/MMS)
                relacionados con nuestros servicios.
              </p>
              <p className="mt-4 leading-relaxed">
                Esta politica cumple los requisitos establecidos por Twilio, CTIA, FCC y las operadoras moviles de Estados Unidos.
              </p>
            </section>

            {/* Section 2 */}
            <section>
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-sm font-bold">2</span>
                Forma en que recopilamos el consentimiento (Opt-In)
              </h3>
              <p className="mb-4 leading-relaxed">
                Los usuarios otorgan su consentimiento de manera clara, afirmativa y verificable a traves de cualquiera de los siguientes metodos:
              </p>

              {/* Method A */}
              <div className="bg-gray-700/30 rounded-xl p-5 mb-4">
                <h4 className="font-semibold text-white mb-3">A. Formulario Web</h4>
                <p className="mb-3 leading-relaxed">
                  El usuario ingresa voluntariamente su numero telefonico en un formulario que incluye la siguiente declaracion visible:
                </p>
                <blockquote className="border-l-4 border-blue-500 pl-4 py-2 bg-gray-700/50 rounded-r-lg italic text-gray-200">
                  "Al ingresar tu numero telefonico y continuar, aceptas recibir mensajes SMS de LogiRapid LLC relacionados con
                  promociones, notificaciones y actualizaciones. Puedes cancelar en cualquier momento respondiendo STOP.
                  Se pueden aplicar tarifas de mensajes y datos."
                </blockquote>
                <p className="mt-3 leading-relaxed">
                  El usuario debe hacer clic en un boton con una accion afirmativa como:
                </p>
                <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
                  <li>"Aceptar y continuar"</li>
                  <li>"Deseo recibir SMS"</li>
                  <li>"Enviar"</li>
                </ul>
              </div>

              {/* Method B */}
              <div className="bg-gray-700/30 rounded-xl p-5 mb-4">
                <h4 className="font-semibold text-white mb-3">B. Registro en Cuenta o Aplicacion</h4>
                <p className="mb-3 leading-relaxed">
                  El usuario proporciona su numero telefonico durante el proceso de registro y acepta explicitamente recibir
                  mensajes SMS al marcar una casilla:
                </p>
                <blockquote className="border-l-4 border-blue-500 pl-4 py-2 bg-gray-700/50 rounded-r-lg italic text-gray-200">
                  "Si, autorizo recibir mensajes SMS de LogiRapid LLC."
                </blockquote>
                <p className="mt-3 text-amber-400 text-sm">
                  La casilla no puede venir marcada por defecto.
                </p>
              </div>

              {/* Method C */}
              <div className="bg-gray-700/30 rounded-xl p-5 mb-4">
                <h4 className="font-semibold text-white mb-3">C. Opt-In por Palabra Clave (Keyword SMS)</h4>
                <p className="mb-3 leading-relaxed">
                  El usuario envia un mensaje con una palabra clave opt-in, por ejemplo:
                </p>
                <p className="text-gray-200">
                  Enviando <span className="bg-blue-600 px-2 py-1 rounded font-mono text-sm">"YES"</span> o{' '}
                  <span className="bg-blue-600 px-2 py-1 rounded font-mono text-sm">"START"</span> al numero de LogiRapid.
                </p>
                <p className="mt-3 leading-relaxed">
                  La accion queda registrada automaticamente en el sistema como consentimiento verificable.
                </p>
              </div>

              {/* Method D */}
              <div className="bg-gray-700/30 rounded-xl p-5">
                <h4 className="font-semibold text-white mb-3">D. Consentimiento por Terminos y Condiciones</h4>
                <p className="mb-3 leading-relaxed">
                  Cuando el usuario acepta nuestros Terminos y Condiciones que incluyen un apartado explicito de comunicaciones SMS:
                </p>
                <blockquote className="border-l-4 border-blue-500 pl-4 py-2 bg-gray-700/50 rounded-r-lg italic text-gray-200">
                  "Al crear una cuenta o usar nuestros servicios, autorizas recibir mensajes SMS transaccionales o informativos
                  de LogiRapid LLC. Puedes cancelar en cualquier momento enviando STOP."
                </blockquote>
              </div>
            </section>

            {/* Section 3 */}
            <section>
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-sm font-bold">3</span>
                Informacion proporcionada al usuario al momento del Opt-In
              </h3>
              <p className="mb-4 leading-relaxed">Al solicitar el numero telefonico, informamos claramente:</p>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>La identidad de la empresa: <strong className="text-white">LogiRapid LLC</strong></span>
                </li>
                <li className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>El proposito de los mensajes (transaccionales, alertas, promociones, verificacion, etc.)</span>
                </li>
                <li className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Frecuencia estimada de mensajes (por ejemplo, "hasta 10 mensajes al mes")</span>
                </li>
                <li className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Aviso de que se aplican tarifas estandar de mensajes y datos</span>
                </li>
                <li className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Instrucciones de Opt-Out: <span className="bg-red-600 px-2 py-0.5 rounded font-mono text-sm">"responde STOP para cancelar"</span></span>
                </li>
                <li className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Instrucciones de ayuda: <span className="bg-blue-600 px-2 py-0.5 rounded font-mono text-sm">"responde HELP para obtener soporte"</span></span>
                </li>
              </ul>
            </section>

            {/* Section 4 */}
            <section>
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-sm font-bold">4</span>
                Como almacenamos y verificamos el consentimiento
              </h3>
              <p className="mb-4 leading-relaxed">Registramos y almacenamos evidencia del consentimiento del usuario, incluyendo:</p>
              <ul className="space-y-2 text-gray-300">
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  Numero telefonico proporcionado
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  Direccion IP del usuario (si aplica)
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  Fecha y hora del consentimiento
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  Metodo usado (web form, checkbox, keyword, app, etc.)
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  URL del formulario donde dio el consentimiento
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  Registro del mensaje SMS si fue opt-in por palabra clave
                </li>
              </ul>
              <p className="mt-4 text-gray-400 text-sm">
                Esta informacion se conserva como prueba verificable de consentimiento conforme a los requisitos de Twilio y los carriers.
              </p>
            </section>

            {/* Section 5 */}
            <section>
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-sm font-bold">5</span>
                Mecanismo de Opt-Out (Cancelacion)
              </h3>
              <p className="mb-4 leading-relaxed">El usuario puede cancelar su suscripcion en cualquier momento mediante:</p>
              <div className="space-y-3">
                <div className="bg-gray-700/30 rounded-lg p-4 flex items-center gap-3">
                  <span className="bg-red-600 px-3 py-1 rounded font-mono text-sm font-bold">STOP</span>
                  <span className="bg-red-600 px-3 py-1 rounded font-mono text-sm font-bold">CANCEL</span>
                  <span className="bg-red-600 px-3 py-1 rounded font-mono text-sm font-bold">END</span>
                  <span className="bg-red-600 px-3 py-1 rounded font-mono text-sm font-bold">UNSUBSCRIBE</span>
                </div>
                <p className="leading-relaxed">Responder cualquiera de estas palabras a cualquier mensaje recibido.</p>
                <p className="leading-relaxed">Enviando un email a: <a href="mailto:support@logirapid.com" className="text-blue-400 hover:underline">support@logirapid.com</a></p>
                <p className="leading-relaxed">Desde su perfil en la plataforma, desactivando la opcion de comunicaciones SMS.</p>
              </div>
              <div className="mt-4 bg-green-900/30 border border-green-700 rounded-lg p-4">
                <p className="text-green-400 font-medium">
                  Al recibir un STOP, detenemos inmediatamente todos los mensajes al numero afectado.
                </p>
              </div>
            </section>

            {/* Section 6 */}
            <section>
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-sm font-bold">6</span>
                Mensaje de Confirmacion de Opt-In
              </h3>
              <p className="mb-4 leading-relaxed">Despues de que el usuario da su consentimiento, enviamos automaticamente:</p>
              <div className="bg-gray-700/50 rounded-xl p-5 border-l-4 border-green-500">
                <p className="text-gray-200 italic">
                  "Gracias. Has aceptado recibir mensajes SMS de LogiRapid LLC. Para cancelar responde STOP. Para ayuda responde HELP."
                </p>
              </div>
              <p className="mt-3 text-gray-400 text-sm">Este mensaje cumple con las normas CTIA.</p>
            </section>

            {/* Section 7 */}
            <section>
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-sm font-bold">7</span>
                Mensaje de Ayuda
              </h3>
              <p className="mb-4 leading-relaxed">Cuando el usuario responde HELP:</p>
              <div className="bg-gray-700/50 rounded-xl p-5 border-l-4 border-blue-500">
                <p className="text-gray-200 italic">
                  "LogiRapid LLC: Para ayuda contactanos en support@logirapid.com o visita logirapid.com. Para cancelar responde STOP."
                </p>
              </div>
            </section>

            {/* Section 8 */}
            <section>
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-sm font-bold">8</span>
                Finalidad de los SMS Enviados
              </h3>
              <p className="mb-4 leading-relaxed">Los mensajes enviados pueden incluir:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-gray-700/30 rounded-lg p-3 flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  Confirmaciones de pedidos
                </div>
                <div className="bg-gray-700/30 rounded-lg p-3 flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  Actualizaciones de entrega
                </div>
                <div className="bg-gray-700/30 rounded-lg p-3 flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  Alertas importantes sobre la cuenta
                </div>
                <div className="bg-gray-700/30 rounded-lg p-3 flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  Codigos de verificacion (OTP)
                </div>
                <div className="bg-gray-700/30 rounded-lg p-3 flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  Promociones autorizadas
                </div>
              </div>
              <div className="mt-4 bg-amber-900/30 border border-amber-700 rounded-lg p-4">
                <p className="text-amber-400 font-medium">
                  No enviamos mensajes no solicitados. Cumplimos estrictamente con el consentimiento otorgado.
                </p>
              </div>
            </section>

            {/* Section 9 */}
            <section>
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-sm font-bold">9</span>
                Contacto
              </h3>
              <p className="mb-4 leading-relaxed">Si tienes preguntas sobre esta politica, contactanos en:</p>
              <div className="bg-gray-700/30 rounded-xl p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center">
                    <span className="text-white font-bold">LR</span>
                  </div>
                  <span className="text-white font-bold text-lg">LogiRapid LLC</span>
                </div>
                <div className="flex items-center gap-3 text-gray-300">
                  <Mail className="w-5 h-5 text-blue-400" />
                  <a href="mailto:support@logirapid.com" className="hover:text-blue-400 transition-colors">
                    support@logirapid.com
                  </a>
                </div>
                <div className="flex items-center gap-3 text-gray-300">
                  <Phone className="w-5 h-5 text-blue-400" />
                  <span>+1 (786) 000-0000</span>
                </div>
                <div className="flex items-center gap-3 text-gray-300">
                  <MapPin className="w-5 h-5 text-blue-400" />
                  <span>Miami, Florida, USA</span>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900/80 backdrop-blur-md border-t border-gray-700 mt-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-600 to-red-700 flex items-center justify-center">
                <span className="text-white font-bold text-sm">LR</span>
              </div>
              <span className="text-gray-400 text-sm">
                &copy; {new Date().getFullYear()} LogiRapid LLC. Todos los derechos reservados.
              </span>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <Link href="/privacy" className="text-gray-400 hover:text-white transition-colors">
                Privacidad
              </Link>
              <Link href="/terms" className="text-gray-400 hover:text-white transition-colors">
                Terminos
              </Link>
              <Link href="/" className="text-gray-400 hover:text-white transition-colors">
                Inicio
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
