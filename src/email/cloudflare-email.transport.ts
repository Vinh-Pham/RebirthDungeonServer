import { Inject, Injectable } from '@nestjs/common';
import { EMAIL_CONFIG, type EmailConfig } from './email.config.js';
import { EmailSendError, type EmailErrorCode } from './email.error.js';
import {
  emailFailureSchema,
  emailSuccessSchema,
  type EmailMessage,
  type EmailSendResult,
} from './email.schemas.js';
import type { EmailTransport } from './email.transport.js';

@Injectable()
export class CloudflareEmailTransport implements EmailTransport {
  constructor(@Inject(EMAIL_CONFIG) private readonly config: EmailConfig) {}

  async send(message: EmailMessage): Promise<EmailSendResult> {
    let response: Response;
    try {
      response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${this.config.accountId}/email/sending/send`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.config.apiToken}`,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(10_000),
          redirect: 'error',
          body: JSON.stringify({
            from: { address: this.config.from, name: this.config.fromName },
            to: message.to,
            subject: message.subject,
            text: message.text,
            html: message.html,
            ...(message.replyTo ? { reply_to: message.replyTo } : {}),
          }),
        },
      );
    } catch {
      // The provider may have accepted the message before the connection failed.
      throw new EmailSendError('UNCERTAIN_OUTCOME');
    }
    const body: unknown = await response.json().catch(() => undefined);
    const parsed = emailSuccessSchema.safeParse(body);
    if (!response.ok || !parsed.success) {
      const failure = emailFailureSchema.safeParse(body);
      const codes = failure.success
        ? failure.data.errors.map(({ code }) => code)
        : [];
      let code: EmailErrorCode;
      if (response.status === 401 || response.status === 403)
        code = 'AUTHORIZATION';
      else if (response.status === 429) code = 'RATE_LIMITED';
      else if (response.status >= 400 && response.status < 500)
        code = 'REJECTED';
      else if (
        response.status >= 500 ||
        (typeof body === 'object' &&
          body !== null &&
          'success' in body &&
          body.success === false)
      )
        code = 'PROVIDER_FAILURE';
      else code = 'UNCERTAIN_OUTCOME';
      throw new EmailSendError(code, codes, response.status);
    }
    const result = parsed.data.result;
    if (
      ![
        ...result.delivered,
        ...result.queued,
        ...result.permanentBounces,
        ...result.suppressedRecipients,
      ].includes(message.to)
    ) {
      throw new EmailSendError('UNCERTAIN_OUTCOME');
    }
    return result;
  }
}
