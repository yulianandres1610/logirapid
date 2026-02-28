import { Resend } from 'resend'

let resendInstance: Resend | null = null

function getResend(): Resend {
  if (!resendInstance) {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      throw new Error('RESEND_API_KEY no configurada')
    }
    resendInstance = new Resend(apiKey)
  }
  return resendInstance
}

interface SendEmailOptions {
  to: string
  subject: string
  html: string
  attachments?: Array<{
    filename: string
    content: Buffer
    contentType?: string
  }>
  from?: string
}

export async function sendEmail({ to, subject, html, attachments, from }: SendEmailOptions) {
  const fromAddress = from || process.env.EMAIL_FROM || 'LogiRapid <noreply@logirapid.com>'

  try {
    const resend = getResend()
    const result = await resend.emails.send({
      from: fromAddress,
      to,
      subject,
      html,
      attachments: attachments?.map(a => ({
        filename: a.filename,
        content: a.content
      }))
    })

    return { success: true, data: result }
  } catch (error) {
    console.error('[Email] Error sending email:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Error al enviar email' }
  }
}
