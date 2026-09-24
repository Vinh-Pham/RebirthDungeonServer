import { renderEmailTemplate } from './render-email-template.js';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { EmailSendError } from './email.error.js';
import {
  emailMessageSchema,
  emailEnvelopeSchema,
  type EmailTemplateMessage,
  type EmailMessage,
  type EmailSendResult,
} from './email.schemas.js';
import { EMAIL_TRANSPORT, type EmailTransport } from './email.transport.js';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  constructor(
    @Inject(EMAIL_TRANSPORT) private readonly transport: EmailTransport,
  ) {}

  async sendTemplate({
    template,
    ...envelope
  }: EmailTemplateMessage): Promise<EmailSendResult> {
    const input = emailEnvelopeSchema.safeParse(envelope);
    if (!input.success) throw new EmailSendError('INVALID_MESSAGE');
    const content = await renderEmailTemplate(template);
    return this.send({ ...input.data, ...content });
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const input = emailMessageSchema.safeParse(message);
    if (!input.success) throw new EmailSendError('INVALID_MESSAGE');
    const start = performance.now();
    try {
      const result = await this.transport.send(input.data);
      this.logger.log({
        event: 'email_send_result',
        durationMs: Math.round(performance.now() - start),
        status: result.status,
      });
      return result;
    } catch (error) {
      const safeError =
        error instanceof EmailSendError
          ? error
          : new EmailSendError('UNCERTAIN_OUTCOME');
      this.logger.warn({
        event: 'email_send_failed',
        durationMs: Math.round(performance.now() - start),
        code: safeError.code,
        providerCodes: safeError.providerCodes,
      });
      throw safeError;
    }
  }
}
