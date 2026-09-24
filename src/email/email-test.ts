import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { z } from 'zod';
import { EmailModule } from './email.module.js';
import { EmailService } from './email.service.js';
import { EmailSendError } from './email.error.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (
    args.length !== 2 ||
    args[0] !== '--to' ||
    !z.email().safeParse(args[1]).success
  ) {
    console.error('Usage: npm run email:test -- --to <address-you-control>');
    process.exitCode = 1;
    return;
  }
  const app = await NestFactory.createApplicationContext(EmailModule, {
    logger: false,
    abortOnError: false,
  });
  try {
    const result = await app.get(EmailService).send({
      to: args[1],
      subject: 'Rebirth Dungeon email delivery test',
      text: 'This is a test of Rebirth Dungeon transactional email sending.',
      html: '<p>This is a test of Rebirth Dungeon transactional email sending.</p>',
    });
    console.log(
      JSON.stringify({
        delivered: result.delivered.length,
        queued: result.queued.length,
        permanentBounces: result.permanentBounces.length,
        suppressedRecipients: result.suppressedRecipients.length,
      }),
    );
    if (result.permanentBounces.length || result.suppressedRecipients.length)
      process.exitCode = 1;
  } finally {
    await app.close();
  }
}

try {
  await main();
} catch (error) {
  console.error(
    error instanceof EmailSendError
      ? `${error.code}: ${error.message}`
      : 'Email test failed',
  );
  process.exitCode = 1;
}
