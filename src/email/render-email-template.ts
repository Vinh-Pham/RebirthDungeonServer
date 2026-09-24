import { render, toPlainText } from 'react-email';
import { isValidElement, type ReactElement } from 'react';
import { EmailSendError } from './email.error.js';

/** Render once so HTML and plain text contain the same message. */
export async function renderEmailTemplate(
  template: ReactElement,
): Promise<{ html: string; text: string }> {
  try {
    if (!isValidElement(template)) throw new Error('Invalid template');
    const html = await render(template);
    return { html, text: toPlainText(html) };
  } catch {
    // Template errors can contain props or message content; never expose the cause.
    throw new EmailSendError('TEMPLATE_RENDER_FAILED');
  }
}
