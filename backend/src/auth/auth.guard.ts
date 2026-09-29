import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service.js';

export type AuthenticatedRequest = Request & { user?: { userId: string; sessionId: string } };

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const sessionId = request.cookies?.[this.auth.getConfig().SESSION_COOKIE_NAME];
    if (!sessionId) throw new UnauthorizedException('Missing session');

    const session = this.auth.validateSession(sessionId);
    request.user = { userId: session.userId, sessionId: session.sessionId };
    return true;
  }
}
