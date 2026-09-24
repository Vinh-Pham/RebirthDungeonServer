export type EmailErrorCode =
  | 'TEMPLATE_RENDER_FAILED'
  | 'CONFIGURATION'
  | 'INVALID_MESSAGE'
  | 'REJECTED'
  | 'AUTHORIZATION'
  | 'RATE_LIMITED'
  | 'PROVIDER_FAILURE'
  | 'UNCERTAIN_OUTCOME';

const messages: Record<EmailErrorCode, string> = {
  TEMPLATE_RENDER_FAILED: 'Email template could not be rendered',
  CONFIGURATION: 'Email configuration is missing or invalid',
  INVALID_MESSAGE: 'Email message is invalid',
  REJECTED: 'Email provider rejected the request',
  AUTHORIZATION: 'Email provider authorization or account configuration failed',
  RATE_LIMITED: 'Email provider rate limit exceeded',
  PROVIDER_FAILURE: 'Email provider failed to process the request',
  UNCERTAIN_OUTCOME: 'Email outcome is unknown; do not automatically resend',
};

/** Contains safe diagnostics only, never raw provider messages or request data. */
export class EmailSendError extends Error {
  constructor(
    readonly code: EmailErrorCode,
    readonly providerCodes: number[] = [],
    readonly status?: number,
  ) {
    super(messages[code]);
    this.name = 'EmailSendError';
  }
}
