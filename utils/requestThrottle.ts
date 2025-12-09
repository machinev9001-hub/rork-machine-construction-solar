const requestTimestampMap = new Map<string, number>();

const DEFAULT_WINDOW_MS = 10000;

export type RequestThrottleStatus = {
  blocked: boolean;
  remainingMs: number;
};

export function getRequestThrottleStatus(
  key: string,
  windowMs: number = DEFAULT_WINDOW_MS
): RequestThrottleStatus {
  const lastTimestamp = requestTimestampMap.get(key);
  if (!lastTimestamp) {
    return {
      blocked: false,
      remainingMs: 0,
    };
  }

  const now = Date.now();
  const elapsed = now - lastTimestamp;

  if (elapsed >= windowMs) {
    return {
      blocked: false,
      remainingMs: 0,
    };
  }

  return {
    blocked: true,
    remainingMs: windowMs - elapsed,
  };
}

export function markRequestThrottle(key: string): void {
  requestTimestampMap.set(key, Date.now());
}
