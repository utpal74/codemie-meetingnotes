import { ForbiddenException, Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { loadAuthConfig } from './auth.config.js';
import { CsrfService } from './csrf.service.js';

const STATE_CHANGING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  private readonly config = loadAuthConfig(process.env);

  constructor(private readonly csrf: CsrfService) {}

  use(req: Request, _res: Response, next: NextFunction) {
    if (!STATE_CHANGING.has(req.method.toUpperCase())) return next();

    // Ignore auth endpoints that establish tokens
    if (req.path.startsWith('/api/v1/auth/')) return next();

    const cookieToken = req.cookies?.[this.config.CSRF_COOKIE_NAME];
    const headerToken = (req.header('x-csrf-token') ?? '').trim();

    if (!cookieToken || !headerToken || !this.csrf.safeEquals(cookieToken, headerToken)) {
      throw new ForbiddenException('CSRF token missing or invalid');
    }

    return next();
  }
}
