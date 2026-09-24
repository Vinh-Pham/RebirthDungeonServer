import type { ThrottlerStorage } from '@nestjs/throttler';

// Worker timers belong to a request and can stop after its response. Expire
// counters by timestamps instead, retaining the existing per-isolate limits.
export class WorkerThrottlerStorage implements ThrottlerStorage {
  private readonly records = new Map<
    string,
    { hits: number[]; blockedUntil: number; expiresAt: number }
  >();
  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): ReturnType<ThrottlerStorage['increment']> {
    const now = Date.now();
    for (const [storedKey, record] of this.records) {
      if (record.expiresAt <= now && record.blockedUntil <= now)
        this.records.delete(storedKey);
    }
    const storageKey = `${throttlerName}:${key}`;
    const record = this.records.get(storageKey) ?? {
      hits: [],
      blockedUntil: 0,
      expiresAt: now + ttl,
    };
    record.hits = record.hits.filter((time) => time + ttl > now);
    if (record.blockedUntil > 0 && record.blockedUntil <= now) {
      record.hits = [];
      record.blockedUntil = 0;
    }
    if (record.blockedUntil <= now) {
      record.hits.push(now);
      record.expiresAt = now + ttl;
      if (record.hits.length > limit) record.blockedUntil = now + blockDuration;
    }
    this.records.set(storageKey, record);
    return {
      totalHits: record.hits.length,
      timeToExpire: Math.max(0, Math.ceil((record.expiresAt - now) / 1000)),
      isBlocked: record.blockedUntil > now,
      timeToBlockExpire: Math.max(
        0,
        Math.ceil((record.blockedUntil - now) / 1000),
      ),
    };
  }
}
