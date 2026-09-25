import { env } from 'cloudflare:workers';
import { afterEach, expect, it, vi } from 'vitest';
import {
  prepareTestEmail,
  sendTestEmail,
  TEST_EMAIL_SUBJECT,
} from '../src/email/service.js';

afterEach(() => vi.restoreAllMocks());

it('renders the default template as HTML and plain text in Workers', async () => {
  const message = await prepareTestEmail(env, { to: 'preview@example.com' });
  expect(message.subject).toBe(TEST_EMAIL_SUBJECT);
  expect(message.from).toEqual({
    email: 'noreply@rebirthdungeon.com',
    name: 'Rebirth Dungeon',
  });
  expect(message.html).toContain('<!DOCTYPE');
  expect(message.html).toContain('Adventurer');
  expect(message.html).toContain('No action required');
  expect(message.text).toContain('Hello, Adventurer.');
  expect(message.text).toContain('No action required');
  expect(message.text).not.toContain('<table');
  expect(message.html).not.toMatch(
    /<script|<img|https?:\/\/[^" ]+\.(?:woff|png)/i,
  );
});

it('escapes a custom greeting without interpreting markup', async () => {
  const message = await prepareTestEmail(env, {
    to: 'preview@example.com',
    recipientName: '<script>alert("test")</script> & Adventurer',
  });
  expect(message.html).toContain('&lt;script&gt;');
  expect(message.html).not.toContain('<script>');
  expect(message.text).toContain('Adventurer');
});

it('awaits the complete email payload and returns the provider message ID', async () => {
  const send = vi
    .spyOn(env.EMAIL, 'send')
    .mockResolvedValue({ messageId: 'test-message-id' });
  expect(
    await sendTestEmail(env, {
      to: 'preview@example.com',
      recipientName: 'Vinh',
    }),
  ).toEqual({ messageId: 'test-message-id' });
  expect(send).toHaveBeenCalledOnce();
  expect(send.mock.calls[0][0]).toMatchObject({
    to: 'preview@example.com',
    subject: TEST_EMAIL_SUBJECT,
    html: expect.stringContaining('Vinh'),
    text: expect.stringContaining('Hello, Vinh.'),
  });
});

it('does not expose provider errors or retry uncertain failures', async () => {
  const send = vi
    .spyOn(env.EMAIL, 'send')
    .mockRejectedValue(
      new Error('private-recipient@example.com: private body'),
    );
  await expect(
    sendTestEmail(env, { to: 'preview@example.com' }),
  ).rejects.toThrow(
    'Email sending failed. Check Cloudflare Email Sending configuration and provider logs.',
  );
  expect(send).toHaveBeenCalledOnce();
});

it('rejects invalid inputs before calling the provider', async () => {
  const send = vi.spyOn(env.EMAIL, 'send');
  await expect(sendTestEmail(env, { to: 'invalid' })).rejects.toThrow();
  await expect(
    sendTestEmail(env, { to: 'preview@example.com', recipientName: '' }),
  ).rejects.toThrow();
  expect(send).not.toHaveBeenCalled();
});
