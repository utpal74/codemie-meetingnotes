import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { loadAuthConfig } from './auth.config.js';
import { AuthService } from './auth.service.js';
import { CsrfService } from './csrf.service.js';

type LoginDto = { userId: string };

@Controller('auth')
export class AuthController {
  private readonly config = loadAuthConfig(process.env);

  constructor(
    private readonly auth: AuthService,
    private readonly csrf: CsrfService,
  ) {}

  @Post('login')
  login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { login, session, refreshId } = this.auth.login(dto.userId);

    res.cookie(this.config.SESSION_COOKIE_NAME, session.sessionId, {
      httpOnly: true,
      secure: this.config.COOKIE_SECURE,
      sameSite: 'lax',
      path: '/',
      maxAge: this.config.SESSION_TTL_SECONDS * 1000,
    });

    res.cookie(this.config.REFRESH_COOKIE_NAME, refreshId, {
      httpOnly: true,
      secure: this.config.COOKIE_SECURE,
      sameSite: 'lax',
      path: '/api/v1/auth/refresh',
      maxAge: this.config.REFRESH_TTL_SECONDS * 1000,
    });

    const csrfToken = this.csrf.generateToken();
    res.cookie(this.config.CSRF_COOKIE_NAME, csrfToken, {
      httpOnly: false,
      secure: this.config.COOKIE_SECURE,
      sameSite: 'lax',
      path: '/',
      maxAge: this.config.REFRESH_TTL_SECONDS * 1000,
    });

    return login;
  }

  @Post('refresh')
  refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshId = req.cookies?.[this.config.REFRESH_COOKIE_NAME];
    const { session, refreshId: newRefreshId } = this.auth.refresh(refreshId);

    res.cookie(this.config.SESSION_COOKIE_NAME, session.sessionId, {
      httpOnly: true,
      secure: this.config.COOKIE_SECURE,
      sameSite: 'lax',
      path: '/',
      maxAge: this.config.SESSION_TTL_SECONDS * 1000,
    });

    res.cookie(this.config.REFRESH_COOKIE_NAME, newRefreshId, {
      httpOnly: true,
      secure: this.config.COOKIE_SECURE,
      sameSite: 'lax',
      path: '/api/v1/auth/refresh',
      maxAge: this.config.REFRESH_TTL_SECONDS * 1000,
    });

    return { ok: true };
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const sessionId = req.cookies?.[this.config.SESSION_COOKIE_NAME];
    const refreshId = req.cookies?.[this.config.REFRESH_COOKIE_NAME];
    this.auth.logout(sessionId, refreshId);

    res.clearCookie(this.config.SESSION_COOKIE_NAME, { path: '/' });
    res.clearCookie(this.config.REFRESH_COOKIE_NAME, { path: '/api/v1/auth/refresh' });
    res.clearCookie(this.config.CSRF_COOKIE_NAME, { path: '/' });
  }

  @Get('csrf')
  csrfToken(@Req() req: Request) {
    const token = req.cookies?.[this.config.CSRF_COOKIE_NAME];
    return { csrfToken: token ?? '' };
  }
}
