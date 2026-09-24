import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CloudflareEmailTransport } from './cloudflare-email.transport.js';
import { emailConfig, type EmailConfig } from './email.config.js';
import { EmailSendError } from './email.error.js';
import { EmailModule } from './email.module.js';
import { EmailService } from './email.service.js';
import { EMAIL_TRANSPORT } from './email.transport.js';
import type { EmailMessage } from './email.schemas.js';

const config: EmailConfig = {
  accountId: 'a'.repeat(32),
  apiToken: 'secret-token',
  from: 'noreply@rebirthdungeon.com',
  fromName: 'Rebirth Dungeon',
};
const message: EmailMessage = {
  to: 'recipient@example.com',
  subject: 'Private subject',
  text: 'Private text',
  html: '<p>Private html</p>',
  replyTo: 'support@example.com',
};
const emptyResult = {
  delivered: [],
  queued: [],
  permanentBounces: [],
  suppressedRecipients: [],
};
function configureEnv() {
  vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', config.accountId);
  vi.stubEnv('CLOUDFLARE_EMAIL_API_TOKEN', config.apiToken);
  vi.stubEnv('EMAIL_FROM', config.from);
  vi.stubEnv('EMAIL_FROM_NAME', undefined);
}
function providerResult(result: Record<string, unknown> = {}) {
  return {
    success: true,
    result: {
      delivered: [],
      queued: [],
      permanent_bounces: [],
      suppressed_recipients: [],
      ...result,
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('Email module configuration', () => {
  beforeEach(configureEnv);
  it.each([
    'CLOUDFLARE_ACCOUNT_ID',
    'CLOUDFLARE_EMAIL_API_TOKEN',
    'EMAIL_FROM',
  ])('fails module startup without %s', async (name) => {
    vi.stubEnv(name, undefined);
    await expect(
      Test.createTestingModule({ imports: [EmailModule] }).compile(),
    ).rejects.toMatchObject({ code: 'CONFIGURATION' });
  });
  it.each([
    ['CLOUDFLARE_ACCOUNT_ID', 'invalid'],
    ['CLOUDFLARE_EMAIL_API_TOKEN', 'token\nsecret'],
    ['EMAIL_FROM', 'invalid'],
    ['EMAIL_FROM_NAME', 'name\r\nheader'],
  ])('rejects invalid %s without exposing its value', (name, value) => {
    vi.stubEnv(name, value);
    expect(emailConfig).toThrow('Email configuration is missing or invalid');
  });
  it('starts without network requests and exports a service with injectable transport', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const send = vi
      .fn()
      .mockResolvedValue({ ...emptyResult, queued: [message.to] });
    const module = await Test.createTestingModule({ imports: [EmailModule] })
      .overrideProvider(EMAIL_TRANSPORT)
      .useValue({ send })
      .compile();
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    try {
      await module.init();
      expect(emailConfig().fromName).toBe('Rebirth Dungeon');
      await expect(
        module.get(EmailService).send(message),
      ).resolves.toMatchObject({ queued: [message.to] });
      expect(send).toHaveBeenCalledOnce();
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      await module.close();
    }
  });
});

describe('Cloudflare email transport', () => {
  const transport = new CloudflareEmailTransport(config);
  it('maps sender, reply-to and credentials and uses a 10 second timeout', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        Response.json(
          providerResult({ queued: [message.to], message_id: 'provider-id' }),
        ),
      );
    vi.stubGlobal('fetch', fetchMock);
    await expect(transport.send(message)).resolves.toEqual({
      ...emptyResult,
      queued: [message.to],
      messageId: 'provider-id',
    });
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/email/sending/send`,
    );
    expect(options.headers).toEqual({
      Authorization: 'Bearer secret-token',
      'Content-Type': 'application/json',
    });
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body as string)).toEqual({
      from: { address: config.from, name: config.fromName },
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
      reply_to: message.replyTo,
    });
    expect(timeout).toHaveBeenCalledWith(10000);
  });
  it.each([
    ['delivered', 'delivered'],
    ['queued', 'queued'],
    ['permanent_bounces', 'permanentBounces'],
    ['suppressed_recipients', 'suppressedRecipients'],
  ])('preserves %s outcomes', async (providerField, field) => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json(providerResult({ [providerField]: [message.to] })),
        ),
    );
    const result = await transport.send(message);
    expect(result).toEqual({ ...emptyResult, [field]: [message.to] });
  });
  it('supports older success responses without optional fields', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          success: true,
          result: {
            delivered: [message.to],
            queued: [],
            permanent_bounces: [],
          },
        }),
      ),
    );
    await expect(transport.send(message)).resolves.toEqual({
      ...emptyResult,
      delivered: [message.to],
    });
  });
  it.each([
    [400, 'REJECTED'],
    [401, 'AUTHORIZATION'],
    [403, 'AUTHORIZATION'],
    [429, 'RATE_LIMITED'],
    [500, 'PROVIDER_FAILURE'],
    [503, 'PROVIDER_FAILURE'],
    [200, 'PROVIDER_FAILURE'],
  ])(
    'classifies HTTP %s with no retries or provider text exposure',
    async (status, code) => {
      const fetchMock = vi.fn().mockResolvedValue(
        Response.json(
          {
            success: false,
            errors: [
              { code: 10001, message: 'secret-token recipient@example.com' },
            ],
          },
          { status: status as number },
        ),
      );
      vi.stubGlobal('fetch', fetchMock);
      const error = await transport
        .send(message)
        .catch((error: unknown) => error);
      expect(error).toMatchObject({ code, providerCodes: [10001], status });
      expect(String(error)).not.toContain('secret-token');
      expect(error).not.toHaveProperty('cause');
      expect(fetchMock).toHaveBeenCalledOnce();
    },
  );
  it.each([
    {},
    providerResult(),
    providerResult({ delivered: 'wrong' }),
    providerResult({ queued: ['someone-else@example.com'] }),
  ])('treats unusable successful responses as uncertain', async (body) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(body)));
    await expect(transport.send(message)).rejects.toMatchObject({
      code: 'UNCERTAIN_OUTCOME',
    });
  });
  it('preserves known HTTP failures when the provider returns non-JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response('private upstream error', { status: 429 }),
        ),
    );
    await expect(transport.send(message)).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      status: 429,
      providerCodes: [],
    });
  });
  it('treats malformed JSON as uncertain', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not-json')));
    await expect(transport.send(message)).rejects.toMatchObject({
      code: 'UNCERTAIN_OUTCOME',
    });
  });
  it.each([
    new TypeError('secret-token'),
    new DOMException('Timed out', 'TimeoutError'),
  ])('does not retry uncertain network failures', async (error) => {
    const fetchMock = vi.fn().mockRejectedValue(error);
    vi.stubGlobal('fetch', fetchMock);
    await expect(transport.send(message)).rejects.toMatchObject({
      code: 'UNCERTAIN_OUTCOME',
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});

describe('Email service validation and logging', () => {
  it.each([
    { ...message, to: 'invalid' },
    { ...message, subject: '\r\nInjected' },
    { ...message, text: '' },
    { ...message, html: '' },
    { ...message, replyTo: 'invalid' },
    { ...message, cc: ['extra@example.com'] },
  ])('rejects invalid input before transport', async (input) => {
    const send = vi.fn();
    await expect(new EmailService({ send }).send(input)).rejects.toMatchObject({
      code: 'INVALID_MESSAGE',
    });
    expect(send).not.toHaveBeenCalled();
  });
  it('logs counts and duration, never recipient or content', async () => {
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    const service = new EmailService({
      send: vi
        .fn()
        .mockResolvedValue({ ...emptyResult, delivered: [message.to] }),
    });
    await service.send(message);
    expect(log).toHaveBeenCalledWith({
      event: 'email_send_result',
      durationMs: expect.any(Number),
      delivered: 1,
      queued: 0,
      permanentBounces: 0,
      suppressedRecipients: 0,
    });
  });
  it.each([
    new EmailSendError('RATE_LIMITED', [10004], 429),
    new Error('secret-token Private text recipient@example.com'),
  ])('logs sanitized failures', async (failure) => {
    const warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => {});
    const service = new EmailService({
      send: vi.fn().mockRejectedValue(failure),
    });
    await expect(service.send(message)).rejects.toBeInstanceOf(EmailSendError);
    expect(warn).toHaveBeenCalledWith({
      event: 'email_send_failed',
      durationMs: expect.any(Number),
      code:
        failure instanceof EmailSendError ? failure.code : 'UNCERTAIN_OUTCOME',
      providerCodes:
        failure instanceof EmailSendError ? failure.providerCodes : [],
    });
  });
});
