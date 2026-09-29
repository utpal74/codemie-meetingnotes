export type Session = {
  sessionId: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
  revokedAt?: string;
};

export type RefreshSession = {
  refreshId: string;
  sessionId: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
  revokedAt?: string;
};

export type LoginResponse = {
  userId: string;
};

export type CsrfTokenResponse = {
  csrfToken: string;
};
