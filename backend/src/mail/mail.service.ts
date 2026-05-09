import { Injectable, Logger } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bull'
import { Queue } from 'bull'

@Injectable()
export class MailService {
    private readonly logger = new Logger(MailService.name)

    constructor(
        @InjectQueue('mail') private mailQueue: Queue,
    ) { }

    async sendResetCode(email: string, code: string) {
        try {
            await this.mailQueue.add('send-reset', { email, code }, {
                attempts: 3,
                backoff: 5000, // 5 seconds
                removeOnComplete: true,
            })
            this.logger.log(`Email job queued for ${email}`)
            return { queued: true }
        } catch (error: any) {
            this.logger.error(`Error queuing email for ${email}. Message: ${error.message}`)
            throw error
        }
    }
}
