import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { NotesService } from './notes.service.js';
import type { CreateNoteInput, UpdateNoteInput } from './notes.types.js';
import { Req } from '@nestjs/common';

@Controller()
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Post('notes')
  @UseGuards(AuthGuard)
  create(@Body() input: CreateNoteInput, @Req() req: AuthenticatedRequest) {
    return this.notesService.create(input, req.user!.userId);
  }

  @Get('notes')
  @UseGuards(AuthGuard)
  list(
    @Query('limit') limit = '20',
    @Query('offset') offset = '0',
    @Req() req: AuthenticatedRequest,
  ) {
    return this.notesService.list(req.user!.userId, Number(limit), Number(offset));
  }

  @Get('notes/:noteId')
  @UseGuards(AuthGuard)
  get(@Param('noteId') noteId: string, @Req() req: AuthenticatedRequest) {
    return this.notesService.getOwned(noteId, req.user!.userId);
  }

  @Patch('notes/:noteId')
  @UseGuards(AuthGuard)
  update(
    @Param('noteId') noteId: string,
    @Body() input: UpdateNoteInput,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.notesService.update(noteId, input, req.user!.userId);
  }

  @Delete('notes/:noteId')
  @UseGuards(AuthGuard)
  @HttpCode(204)
  remove(@Param('noteId') noteId: string, @Req() req: AuthenticatedRequest): void {
    this.notesService.remove(noteId, req.user!.userId);
  }

  @Post('notes/:noteId/share')
  @UseGuards(AuthGuard)
  share(@Param('noteId') noteId: string, @Req() req: AuthenticatedRequest) {
    const link = this.notesService.createShareLink(noteId, req.user!.userId);
    return { ...link, shareUrl: `/shared/${link.token}` };
  }

  @Delete('notes/:noteId/share/:token')
  @UseGuards(AuthGuard)
  @HttpCode(204)
  revoke(
    @Param('noteId') noteId: string,
    @Param('token') token: string,
    @Req() req: AuthenticatedRequest,
  ): void {
    this.notesService.revokeShareLink(noteId, token, req.user!.userId);
  }

  @Get('shared/:token')
  shared(@Param('token') token: string, @Res({ passthrough: true }) response: Response) {
    const note = this.notesService.getShared(token);
    response.setHeader('Cache-Control', 'no-cache, must-revalidate');
    response.setHeader('ETag', `"note-${note.id}-${note.version}"`);
    return {
      id: note.id,
      title: note.title,
      content: note.content,
      version: note.version,
      updatedAt: note.updatedAt,
    };
  }
}
