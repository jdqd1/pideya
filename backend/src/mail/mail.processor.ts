import { Process, Processor } from '@nestjs/bull'
import { Logger } from '@nestjs/common'
import { Job } from 'bull'
import { Resend } from 'resend'

@Processor('mail')
export class MailProcessor {
    private resend: Resend | null = null
    private readonly logger = new Logger(MailProcessor.name)

    constructor() {
        const apiKey = process.env.RESEND_API_KEY?.trim()
        if (apiKey) {
            this.resend = new Resend(apiKey)
        } else {
            this.logger.warn('Email delivery disabled: missing RESEND_API_KEY')
        }
    }

    @Process('send-reset')
    async handleSendResetCode(job: Job<{ email: string; code: string }>) {
        const { email, code } = job.data
        this.logger.log(`Processing send-reset job for ${email}...`)

        try {
            if (!this.resend) {
                this.logger.warn(`Reset email skipped for ${email}: RESEND_API_KEY is not configured`)
                return { skipped: true }
            }

            const data = await this.resend.emails.send({
                from: 'Krums <onboarding@resend.dev>',
                to: email,
                subject: `Tu codigo de recuperacion es: ${code}`,
                html: `
        <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
          <h2 style="color: #4338ca; text-align: center;">Recuperacion de Contrasena</h2>
          <p style="font-size: 16px; line-height: 1.5;">Hola,</p>
          <p style="font-size: 16px; line-height: 1.5;">Usa el siguiente codigo para restablecer tu contrasena:</p>
          <div style="background-color: #f3f4f6; padding: 24px; border-radius: 12px; text-align: center; margin: 30px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #4338ca;">${code}</span>
          </div>
          <p style="font-size: 14px; color: #666; text-align: center;">Este codigo es valido por 10 minutos.</p>
          <p style="font-size: 14px; color: #888; margin-top: 30px; text-align: center;">Si no solicitaste este cambio, puedes ignorar este correo.</p>
        </div>
      `,
            })
            this.logger.log(`Email sent to ${email} (ID: ${data.data?.id})`)
            return data
        } catch (error: any) {
            this.logger.error(`Error sending email to ${email}. Message: ${error.message}`)
            throw error
        }
    }
}
