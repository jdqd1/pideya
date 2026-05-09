import { Injectable, Logger } from '@nestjs/common'

@Injectable()
export class WhatsappService {
    private readonly logger = new Logger(WhatsappService.name)

    async sendResetCode(phone: string, code: string) {
        // START_MOCK_IMPLEMENTATION
        this.logger.log(`[WHATSAPP MOCK] Sending code ${code} to ${phone}`)
        this.logger.log(`
      --------------------------------------------------
      WHATSAPP MESSAGE TO: ${phone}
      
      Hola! Tu código de recuperación de Krums es: *${code}*
      
      Expira en 1 minuto.
      --------------------------------------------------
    `)
        return { status: 'sent', sid: 'mock-sid-' + Date.now() }
        // END_MOCK_IMPLEMENTATION
    }
}
