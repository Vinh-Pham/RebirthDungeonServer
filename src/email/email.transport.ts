import type { EmailMessage, EmailSendResult } from './email.schemas.js';

export const EMAIL_TRANSPORT = Symbol('EMAIL_TRANSPORT');
export interface EmailTransport {
  send(message: EmailMessage): Promise<EmailSendResult>;
}
