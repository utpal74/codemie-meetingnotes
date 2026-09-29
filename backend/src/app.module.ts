import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { CsrfMiddleware } from './auth/csrf.middleware.js';
import { NotesController } from './notes/notes.controller.js';
import { NotesService } from './notes/notes.service.js';
import { RateLimitMiddleware } from './rate-limit/rate-limit.middleware.js';
import { InMemoryRateLimiter } from './rate-limit/rate-limit.service.js';

@Module({
  imports: [AuthModule],
  controllers: [AppController, NotesController],
  providers: [AppService, NotesService, InMemoryRateLimiter],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(cookieParser()).forRoutes('*');
    consumer.apply(RateLimitMiddleware).forRoutes('*');
    consumer.apply(CsrfMiddleware).forRoutes('*');
  }
}
