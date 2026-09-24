import { Module } from '@nestjs/common';
import { EMAIL_CONFIG, emailConfig } from './email.config.js';
import { CloudflareEmailTransport } from './cloudflare-email.transport.js';
import { EmailService } from './email.service.js';
import { EMAIL_TRANSPORT } from './email.transport.js';

@Module({
  providers: [
    { provide: EMAIL_CONFIG, useFactory: emailConfig },
    { provide: EMAIL_TRANSPORT, useClass: CloudflareEmailTransport },
    EmailService,
  ],
  exports: [EmailService],
})
export class EmailModule {}
