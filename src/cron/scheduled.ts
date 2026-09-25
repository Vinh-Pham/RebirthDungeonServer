export async function runScheduled(
  controller: ScheduledController,
): Promise<void> {
  // Harmless example: completion is recorded in Worker logs.
  // Run this with: curl "http://localhost:8787/cdn-cgi/local/scheduled?cron=*+*+*+*+*"
  console.log(
    JSON.stringify({
      event: 'cron_task_completed',
      cron: controller.cron,
      scheduledTime: new Date(controller.scheduledTime).toISOString(),
      message: 'Hello from cron',
    }),
  );
}
