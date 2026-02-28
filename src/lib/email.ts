import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY || '')

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
