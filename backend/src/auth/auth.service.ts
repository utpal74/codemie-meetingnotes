import { Injectable, UnauthorizedException } from '@nestjs/common';
import { loadAuthConfig } from './auth.config.js';
import type { LoginResponse, Session } from './auth.types.js';
import type { SessionStore } from './session.store.js';

@Injectable()
export class AuthService {
  private readonly config = loadAuthConfig(process.env);

  constructor(private readonly store: SessionStore) {}

  login(userId: string): { login: LoginResponse; session: Session; refreshId: string } {
    const trimmed = userId.trim();
    if (!trimmed) throw new UnauthorizedException('Invalid credentials');

    const session = this.store.createSession(trimmed, this.config.SESSION_TTL_SECONDS);
    const refresh = this.store.createRefreshSession(
      session.sessionId,
      trimmed,
      this.config.REFRESH_TTL_SECONDS,
    );

    return { login: { userId: trimmed }, session, refreshId: refresh.refreshId };
  }

  refresh(refreshId: string): { session: Session; refreshId: string } {
    const existing = this.store.getRefreshSession(refreshId);
    if (!existing) throw new UnauthorizedException('Refresh session invalid or expired');

    // rotate refresh token
    this.store.revokeRefreshSession(refreshId);

    const session = this.store.createSession(existing.userId, this.config.SESSION_TTL_SECONDS);
    const refresh = this.store.createRefreshSession(
      session.sessionId,
      existing.userId,
      this.config.REFRESH_TTL_SECONDS,
    );

    return { session, refreshId: refresh.refreshId };
  }

  logout(sessionId?: string, refreshId?: string): void {
    if (sessionId) {
      this.store.revokeSession(sessionId);
      this.store.revokeAllForSession(sessionId);
    }
    if (refreshId) {
      this.store.revokeRefreshSession(refreshId);
    }
  }

  validateSession(sessionId: string): Session {
    const session = this.store.getSession(sessionId);
    if (!session) throw new UnauthorizedException('Session invalid or expired');
    return session;
  }

  getConfig() {
    return this.config;
  }
}
