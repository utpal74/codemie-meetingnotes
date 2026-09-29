import {
  Injectable,
  NestMiddleware,
  TooManyRequestsException,
} from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { InMemoryRateLimiter } from './rate-limit.service.js';

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  constructor(private readonly limiter: InMemoryRateLimiter) {}

  use(req: Request, res: Response, next: NextFunction) {
    // Minimal default policy for prototype.
    // Auth endpoints: per-IP
    // Mutations: per-user or per-IP if unauth
    const isAuth = req.path.startsWith('/api/v1/auth/');
    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase());

    let key = '';
    let limit = 0;
    let windowSeconds = 0;

    if (isAuth) {
      key = `ip:${req.ip}:auth`;
      limit = 20;
      windowSeconds = 60;
    } else if (isMutation) {
      const userId = (req as any).user?.userId as string | undefined;
      key = userId ? `user:${userId}:mut` : `ip:${req.ip}:mut`;
      limit = 120;
      windowSeconds = 60;
    } else {
      return next();
    }

    const decision = this.limiter.take(key, limit, windowSeconds);
    res.setHeader('X-RateLimit-Limit', String(limit));
    if (decision.allowed) {
      res.setHeader('X-RateLimit-Remaining', String(decision.remaining));
      res.setHeader('X-RateLimit-Reset', String(decision.resetSeconds));
      return next();
    }

    res.setHeader('Retry-After', String(decision.retryAfterSeconds));
    throw new TooManyRequestsException('Rate limit exceeded');
  }
}
