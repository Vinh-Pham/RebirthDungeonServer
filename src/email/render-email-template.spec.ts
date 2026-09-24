import { Logger } from '@nestjs/common';
import { createElement } from 'react';
import { EmailService } from './email.service.js';
import { renderEmailTemplate } from './render-email-template.js';
import TestEmail, { TEST_EMAIL_SUBJECT } from './templates/test-email.js';

const result = { status: 'accepted', messageId: 'test-message-id' };

afterEach(() => vi.restoreAllMocks());

describe('React Email templates', () => {
  it('renders a complete email with HTML and matching readable text', async () => {
    const content = await renderEmailTemplate(
      createElement(TestEmail, { recipientName: 'Dungeon Explorer' }),
    );
    expect(content.html).toContain('<!DOCTYPE html');
    expect(content.html).toContain('<html');
    expect(content.html).toContain('Dungeon Explorer');
    expect(content.html).toContain('background-color:');
    expect(content.text).toContain('Hello, Dungeon Explorer!');
    expect(content.text).toContain(
      'This is a test of Rebirth Dungeon transactional email sending.',
    );
    expect(content.text).not.toMatch(/<\/?(?:html|p|table)\b/);
    expect(content.text).not.toContain('background-color:');
  });

  it('escapes dynamic props instead of treating them as markup', async () => {
    const name = '<script>alert("hello")</script>';
    const content = await renderEmailTemplate(
      createElement(TestEmail, { recipientName: name }),
    );
    expect(content.html).not.toContain('<script>');
    expect(content.html).toContain('&lt;script&gt;');
    expect(content.text).toContain(name);
  });

  it('sends rendered HTML and plain text through the existing transport', async () => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    const send = vi.fn().mockResolvedValue(result);
    const service = new EmailService({ send });
    await expect(
      service.sendTemplate({
        to: 'reader@example.com',
        subject: TEST_EMAIL_SUBJECT,
        replyTo: 'support@example.com',
        template: createElement(TestEmail),
      }),
    ).resolves.toEqual(result);
    expect(send).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledWith({
      to: 'reader@example.com',
      subject: TEST_EMAIL_SUBJECT,
      replyTo: 'support@example.com',
      html: expect.stringContaining('Rebirth Dungeon'),
      text: expect.stringContaining('Hello, Adventurer!'),
    });
    expect(send.mock.calls[0][0]).not.toHaveProperty('template');
  });

  it('rejects invalid recipients before rendering or sending', async () => {
    const component = vi.fn(() => null);
    const send = vi.fn();
    await expect(
      new EmailService({ send }).sendTemplate({
        to: 'invalid',
        subject: TEST_EMAIL_SUBJECT,
        template: createElement(component),
      }),
    ).rejects.toMatchObject({ code: 'INVALID_MESSAGE' });
    expect(component).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('sanitizes render failures and does not send', async () => {
    const send = vi.fn();
    function BrokenEmail(): never {
      throw new Error('private-template-props');
    }
    const error: unknown = await new EmailService({ send })
      .sendTemplate({
        to: 'reader@example.com',
        subject: TEST_EMAIL_SUBJECT,
        template: createElement(BrokenEmail),
      })
      .catch((error: unknown) => error);
    expect(error).toMatchObject({ code: 'TEMPLATE_RENDER_FAILED' });
    expect(String(error)).not.toContain('private-template-props');
    expect(error).not.toHaveProperty('cause');
    expect(send).not.toHaveBeenCalled();
  });
});
