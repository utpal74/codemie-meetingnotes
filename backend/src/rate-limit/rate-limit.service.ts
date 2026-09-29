import { Injectable } from '@nestjs/common';

export type RateLimitDecision =
  | { allowed: true; remaining: number; resetSeconds: number }
  | { allowed: false; retryAfterSeconds: number; resetSeconds: number };

export interface RateLimiter {
  take(key: string, limit: number, windowSeconds: number): RateLimitDecision;
}

@Injectable()
export class InMemoryRateLimiter implements RateLimiter {
  private readonly buckets = new Map<
    string,
    { count: number; resetAtMs: number; limit: number; windowSeconds: number }
  >();

  take(key: string, limit: number, windowSeconds: number): RateLimitDecision {
    const now = Date.now();
    const existing = this.buckets.get(key);

    if (!existing || existing.resetAtMs <= now || existing.limit !== limit || existing.windowSeconds !== windowSeconds) {
      const resetAtMs = now + windowSeconds * 1000;
      this.buckets.set(key, { count: 1, resetAtMs, limit, windowSeconds });
      return { allowed: true, remaining: Math.max(0, limit - 1), resetSeconds: windowSeconds };
    }

    if (existing.count >= limit) {
      const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAtMs - now) / 1000));
      return { allowed: false, retryAfterSeconds, resetSeconds: retryAfterSeconds };
    }

    existing.count += 1;
    const remaining = Math.max(0, limit - existing.count);
    const resetSeconds = Math.max(1, Math.ceil((existing.resetAtMs - now) / 1000));
    return { allowed: true, remaining, resetSeconds };
  }
}
