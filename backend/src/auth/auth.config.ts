import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.string().optional(),
  SESSION_COOKIE_NAME: z.string().default('sn_session'),
  REFRESH_COOKIE_NAME: z.string().default('sn_refresh'),
  CSRF_COOKIE_NAME: z.string().default('sn_csrf'),
  SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60),
  REFRESH_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 24 * 30),
  COOKIE_SECURE: z.coerce.boolean().default(false),
});

export type AuthConfig = z.infer<typeof envSchema>;

export function loadAuthConfig(env: NodeJS.ProcessEnv): AuthConfig {
  return envSchema.parse(env);
}
