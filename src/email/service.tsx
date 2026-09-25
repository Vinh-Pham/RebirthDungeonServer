import { render, toPlainText } from 'react-email';
import { z } from 'zod';
import TestEmail from './templates/test-email.js';

export const testEmailInputSchema = z.strictObject({
  to: z.email().max(254),
  recipientName: z.string().trim().min(1).max(100).default('Adventurer'),
});
export type TestEmailInput = z.input<typeof testEmailInputSchema>;
export type EmailConfig = Pick<
  CloudflareBindings,
  'EMAIL_FROM' | 'EMAIL_FROM_NAME'
>;
export const TEST_EMAIL_SUBJECT = 'Rebirth Dungeon — Test email';

export async function prepareTestEmail(
  config: EmailConfig,
  input: TestEmailInput,
) {
  const parsed = testEmailInputSchema.parse(input);
  const from = z
    .strictObject({ email: z.email(), name: z.string().trim().min(1).max(100) })
    .parse({ email: config.EMAIL_FROM, name: config.EMAIL_FROM_NAME });
  const html = await render(<TestEmail recipientName={parsed.recipientName} />);
  return {
    from,
    to: parsed.to,
    subject: TEST_EMAIL_SUBJECT,
    html,
    text: toPlainText(html),
  } satisfies EmailMessageBuilder;
}

export async function sendTestEmail(
  env: EmailConfig & Pick<CloudflareBindings, 'EMAIL'>,
  input: TestEmailInput,
): Promise<EmailSendResult> {
  const message = await prepareTestEmail(env, input);
  try {
    const result = await env.EMAIL.send(message);
    return { messageId: result.messageId };
  } catch {
    // Provider errors may contain addresses or message contents.
    throw new Error(
      'Email sending failed. Check Cloudflare Email Sending configuration and provider logs.',
    );
  }
}
