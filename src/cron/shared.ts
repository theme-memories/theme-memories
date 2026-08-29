// Shared helpers for cron tasks: structured JSON logging and error naming.
//
// Every log line is a single JSON object with a canonical `event` field, so cron
// output is greppable/queryable in log ingestion (e.g. `event:vault_unlock_cleanup_ok`).
// logError always attaches the error `name` for triage; unknown throwables collapse
// to "UnknownError".

export function errorName(error: unknown): string {
  // Collapse unknown throwables to a stable label for log queries.
  return error instanceof Error ? error.name : "UnknownError";
}

export function logEvent(eventName: string, eventData: object = {}): void {
  // Success/info line. `event` is the canonical log field name.
  console.log(JSON.stringify({ event: eventName, ...eventData }));
}

export function logError(
  eventName: string,
  error: unknown,
  eventData: object = {},
): void {
  // Failure line; always includes the error name for triage.
  console.error(
    JSON.stringify({ event: eventName, name: errorName(error), ...eventData }),
  );
}

export function warnUnknownSchedule(cronExpression: string): void {
  // Emitted when Cloudflare fires a schedule this worker does not handle.
  console.warn(
    JSON.stringify({ event: "unknown_cron_schedule", cron: cronExpression }),
  );
}
