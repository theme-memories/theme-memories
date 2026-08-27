export function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "UnknownError";
}

export function logEvent(eventName: string, eventData: object = {}): void {
  console.log(JSON.stringify({ event: eventName, ...eventData }));
}

export function logError(
  eventName: string,
  error: unknown,
  eventData: object = {},
): void {
  console.error(
    JSON.stringify({ event: eventName, name: errorName(error), ...eventData }),
  );
}

export function warnUnknownSchedule(cronExpression: string): void {
  console.warn(
    JSON.stringify({ event: "unknown_cron_schedule", cron: cronExpression }),
  );
}
