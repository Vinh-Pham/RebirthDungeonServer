import { Injectable } from '@nestjs/common';

export const EXAMPLE_CRON = '* * * * *';
export type ScheduledInvocation = Pick<
  ScheduledController,
  'cron' | 'scheduledTime'
>;

@Injectable()
export class SchedulingService {
  async run(invocation: ScheduledInvocation): Promise<void> {
    switch (invocation.cron) {
      case EXAMPLE_CRON:
        console.log('Hello from cron');
        return;
      default:
        throw new Error('Unsupported cron expression');
    }
  }
}
