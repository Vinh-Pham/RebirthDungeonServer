import { Module, type DynamicModule } from '@nestjs/common';
import { EMAIL_CONFIG, type EmailConfig } from './email.config.js';
import {
  EMAIL_BINDING,
  CloudflareEmailTransport,
} from './cloudflare-email.transport.js';
import { EmailService } from './email.service.js';
import { EMAIL_TRANSPORT } from './email.transport.js';

@Module({})
export class EmailModule {
  static register(config: EmailConfig, binding: SendEmail): DynamicModule {
    return {
      module: EmailModule,
      providers: [
        { provide: EMAIL_CONFIG, useValue: config },
        // Nest probes providers for lifecycle methods. RPC bindings must stay nested.
        { provide: EMAIL_BINDING, useValue: { client: binding } },
        { provide: EMAIL_TRANSPORT, useClass: CloudflareEmailTransport },
        EmailService,
      ],
      exports: [EmailService],
    };
  }
}
