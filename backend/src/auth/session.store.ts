import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { RefreshSession, Session } from './auth.types.js';

export interface SessionStore {
  createSession(userId: string, ttlSeconds: number): Session;
  getSession(sessionId: string): Session | undefined;
  revokeSession(sessionId: string): void;

  createRefreshSession(sessionId: string, userId: string, ttlSeconds: number): RefreshSession;
  getRefreshSession(refreshId: string): RefreshSession | undefined;
  revokeRefreshSession(refreshId: string): void;

  revokeAllForSession(sessionId: string): void;
}

@Injectable()
export class InMemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, Session>();
  private readonly refreshSessions = new Map<string, RefreshSession>();

  createSession(userId: string, ttlSeconds: number): Session {
    const now = new Date();
    const session: Session = {
      sessionId: randomUUID(),
      userId,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttlSeconds * 1000).toISOString(),
    };
    this.sessions.set(session.sessionId, session);
    return session;
  }

  getSession(sessionId: string): Session | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;
    if (session.revokedAt) return undefined;
    if (Date.parse(session.expiresAt) <= Date.now()) return undefined;
    return session;
  }

  revokeSession(sessionId: string): void {
    const existing = this.sessions.get(sessionId);
    if (!existing) return;
    this.sessions.set(sessionId, { ...existing, revokedAt: new Date().toISOString() });
  }

  createRefreshSession(sessionId: string, userId: string, ttlSeconds: number): RefreshSession {
    const now = new Date();
    const refresh: RefreshSession = {
      refreshId: randomUUID(),
      sessionId,
      userId,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttlSeconds * 1000).toISOString(),
    };
    this.refreshSessions.set(refresh.refreshId, refresh);
    return refresh;
  }

  getRefreshSession(refreshId: string): RefreshSession | undefined {
    const refresh = this.refreshSessions.get(refreshId);
    if (!refresh) return undefined;
    if (refresh.revokedAt) return undefined;
    if (Date.parse(refresh.expiresAt) <= Date.now()) return undefined;
    return refresh;
  }

  revokeRefreshSession(refreshId: string): void {
    const existing = this.refreshSessions.get(refreshId);
    if (!existing) return;
    this.refreshSessions.set(refreshId, { ...existing, revokedAt: new Date().toISOString() });
  }

  revokeAllForSession(sessionId: string): void {
    for (const [rid, refresh] of this.refreshSessions.entries()) {
      if (refresh.sessionId === sessionId) {
        this.revokeRefreshSession(rid);
      }
    }
  }
}
