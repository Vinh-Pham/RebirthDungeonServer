import { Inject, Injectable } from '@nestjs/common';
import { EMAIL_CONFIG, type EmailConfig } from './email.config.js';
import { EmailSendError, type EmailErrorCode } from './email.error.js';
import {
  emailAcceptanceSchema,
  type EmailMessage,
  type EmailSendResult,
} from './email.schemas.js';
import type { EmailTransport } from './email.transport.js';

export const EMAIL_BINDING = Symbol('EMAIL_BINDING');
const FAILURE_CODES: Record<string, EmailErrorCode> = {
  E_VALIDATION_ERROR: 'REJECTED',
  E_FIELD_MISSING: 'REJECTED',
  E_TOO_MANY_RECIPIENTS: 'REJECTED',
  E_TOO_MANY_ATTACHMENTS: 'REJECTED',
  E_RECIPIENT_NOT_ALLOWED: 'REJECTED',
  E_RECIPIENT_SUPPRESSED: 'REJECTED',
  E_CONTENT_TOO_LARGE: 'REJECTED',
  E_DELIVERY_FAILED: 'REJECTED',
  E_HEADER_NOT_ALLOWED: 'REJECTED',
  E_HEADER_USE_API_FIELD: 'REJECTED',
  E_HEADER_VALUE_INVALID: 'REJECTED',
  E_HEADER_VALUE_TOO_LONG: 'REJECTED',
  E_HEADER_NAME_INVALID: 'REJECTED',
  E_HEADERS_TOO_LARGE: 'REJECTED',
  E_HEADERS_TOO_MANY: 'REJECTED',
  E_SENDER_NOT_VERIFIED: 'AUTHORIZATION',
  E_SENDER_DOMAIN_NOT_AVAILABLE: 'AUTHORIZATION',
  E_RATE_LIMIT_EXCEEDED: 'RATE_LIMITED',
  E_DAILY_LIMIT_EXCEEDED: 'RATE_LIMITED',
  E_INTERNAL_SERVER_ERROR: 'PROVIDER_FAILURE',
};

@Injectable()
export class CloudflareEmailTransport implements EmailTransport {
  constructor(
    @Inject(EMAIL_CONFIG) private readonly config: EmailConfig,
    @Inject(EMAIL_BINDING) private readonly binding: { client: SendEmail },
  ) {}

  async send(message: EmailMessage): Promise<EmailSendResult> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        this.binding.client.send({
          from: { email: this.config.from, name: this.config.fromName },
          to: message.to,
          subject: message.subject,
          text: message.text,
          html: message.html,
          ...(message.replyTo ? { replyTo: message.replyTo } : {}),
        }),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () => reject(new EmailSendError('UNCERTAIN_OUTCOME')),
            10_000,
          );
        }),
      ]);
      const parsed = emailAcceptanceSchema.safeParse(result);
      if (!parsed.success) throw new EmailSendError('UNCERTAIN_OUTCOME');
      return { status: 'accepted', messageId: parsed.data.messageId };
    } catch (error) {
      if (error instanceof EmailSendError) throw error;
      const providerCode =
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        typeof error.code === 'string'
          ? error.code
          : undefined;
      // Only allowlisted codes are safe to log; raw provider messages can contain recipients.
      const code =
        providerCode && Object.hasOwn(FAILURE_CODES, providerCode)
          ? FAILURE_CODES[providerCode]
          : undefined;
      throw new EmailSendError(
        code ?? 'UNCERTAIN_OUTCOME',
        code && providerCode ? [providerCode] : [],
      );
    } finally {
      clearTimeout(timer);
    }
    // A caller timeout does not cancel delivery. Never automatically retry.
  }
}
