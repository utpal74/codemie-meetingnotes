import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { CsrfService } from './csrf.service.js';
import { InMemorySessionStore } from './session.store.js';

@Module({
  controllers: [AuthController],
  providers: [AuthService, CsrfService, InMemorySessionStore],
  exports: [AuthService, CsrfService, InMemorySessionStore],
})
export class AuthModule {}
