import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CloudflareEmailTransport } from './cloudflare-email.transport.js';
import { emailConfig } from './email.config.js';
import { EmailSendError } from './email.error.js';
import { EmailModule } from './email.module.js';
import { EmailService } from './email.service.js';
import type { EmailMessage } from './email.schemas.js';

const config = emailConfig({ from: 'noreply@rebirthdungeon.com' });
const message: EmailMessage = {
  to: 'recipient@example.com',
  subject: 'Private subject',
  text: 'Private text',
  html: '<p>Private html</p>',
  replyTo: 'support@example.com',
};
const accepted = { status: 'accepted', messageId: 'provider-id' };
function fixture() {
  const send = vi
    .fn<
      (
        message: globalThis.EmailMessage | EmailMessageBuilder,
      ) => ReturnType<SendEmail['send']>
    >()
    .mockResolvedValue({ messageId: 'provider-id' });
  return {
    send,
    transport: new CloudflareEmailTransport(config, { client: { send } }),
  };
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('Email binding', () => {
  it.each([
    {},
    { from: 'invalid' },
    { from: config.from, fromName: 'private\r\nheader' },
  ])('rejects invalid configuration without exposing it', (input) => {
    expect(() => emailConfig(input)).toThrow(
      'Email configuration is missing or invalid',
    );
  });
  it('starts without sending and exports the configured service', async () => {
    const { send } = fixture();
    const binding = new Proxy(
      { send },
      {
        get(target, key) {
          if (key === 'send') return target.send;
          throw new Error(
            'Nest must not probe native binding lifecycle methods',
          );
        },
      },
    );
    const module = await Test.createTestingModule({
      imports: [EmailModule.register(config, binding)],
    }).compile();
    try {
      await module.init();
      expect(send).not.toHaveBeenCalled();
      expect(module.get(EmailService)).toBeInstanceOf(EmailService);
      expect(config.fromName).toBe('Rebirth Dungeon');
    } finally {
      await module.close();
    }
  });
  it('maps the structured binding payload and returns acceptance, not delivery', async () => {
    const { send, transport } = fixture();
    await expect(transport.send(message)).resolves.toEqual(accepted);
    expect(send).toHaveBeenCalledExactlyOnceWith({
      ...message,
      from: { email: config.from, name: config.fromName },
    });
  });
  it.each([
    ['E_SENDER_NOT_VERIFIED', 'AUTHORIZATION'],
    ['E_SENDER_DOMAIN_NOT_AVAILABLE', 'AUTHORIZATION'],
    ['E_RATE_LIMIT_EXCEEDED', 'RATE_LIMITED'],
    ['E_DAILY_LIMIT_EXCEEDED', 'RATE_LIMITED'],
    ['E_RECIPIENT_SUPPRESSED', 'REJECTED'],
    ['E_DELIVERY_FAILED', 'REJECTED'],
    ['E_VALIDATION_ERROR', 'REJECTED'],
    ['E_INTERNAL_SERVER_ERROR', 'PROVIDER_FAILURE'],
  ])('sanitizes %s without retries', async (providerCode, code) => {
    const { send, transport } = fixture();
    send.mockRejectedValue(
      Object.assign(new Error('recipient@example.com Private text'), {
        code: providerCode,
      }),
    );
    const error: unknown = await transport
      .send(message)
      .catch((error: unknown) => error);
    expect(error).toMatchObject({ code, providerCodes: [providerCode] });
    expect(String(error)).not.toContain(message.to);
    expect(error).not.toHaveProperty('cause');
    expect(send).toHaveBeenCalledOnce();
  });
  it('does not log unknown provider codes', async () => {
    const { send, transport } = fixture();
    send.mockRejectedValue({
      code: 'private-recipient@example.com',
      message: 'private',
    });
    await expect(transport.send(message)).rejects.toMatchObject({
      code: 'UNCERTAIN_OUTCOME',
      providerCodes: [],
    });
  });
  it('rejects an empty message ID as uncertain', async () => {
    const { send, transport } = fixture();
    send.mockResolvedValue({ messageId: '' });
    await expect(transport.send(message)).rejects.toMatchObject({
      code: 'UNCERTAIN_OUTCOME',
    });
  });
  it('times out at ten seconds, does not retry, and handles a late rejection', async () => {
    vi.useFakeTimers();
    const { send, transport } = fixture();
    let rejectDelivery!: (reason: Error) => void;
    send.mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectDelivery = reject;
      }),
    );
    const result = expect(transport.send(message)).rejects.toMatchObject({
      code: 'UNCERTAIN_OUTCOME',
    });
    await vi.advanceTimersByTimeAsync(10000);
    await result;
    rejectDelivery(new Error('late private provider failure'));
    await Promise.resolve();
    expect(send).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('clears its timeout on success', async () => {
    vi.useFakeTimers();
    await fixture().transport.send(message);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('Email validation and safe logging', () => {
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
  it('logs only acceptance and duration', async () => {
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    await new EmailService({ send: vi.fn().mockResolvedValue(accepted) }).send(
      message,
    );
    expect(log).toHaveBeenCalledWith({
      event: 'email_send_result',
      durationMs: expect.any(Number),
      status: 'accepted',
    });
  });
  it.each([
    new EmailSendError('RATE_LIMITED', ['E_RATE_LIMIT_EXCEEDED']),
    new Error('private recipient@example.com'),
  ])('sanitizes failures', async (failure) => {
    const warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => {});
    await expect(
      new EmailService({ send: vi.fn().mockRejectedValue(failure) }).send(
        message,
      ),
    ).rejects.toBeInstanceOf(EmailSendError);
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
