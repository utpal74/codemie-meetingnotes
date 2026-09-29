var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { Body, Controller, Delete, Get, Headers, HttpCode, Param, Patch, Post, Query, Res, } from '@nestjs/common';
import { NotesService } from './notes.service.js';
let NotesController = class NotesController {
    notesService;
    constructor(notesService) {
        this.notesService = notesService;
    }
    create(input, userId) {
        return this.notesService.create(input, userId);
    }
    list(limit = '20', offset = '0', userId) {
        return this.notesService.list(userId, Number(limit), Number(offset));
    }
    get(noteId, userId) {
        return this.notesService.getOwned(noteId, userId);
    }
    update(noteId, input, userId) {
        return this.notesService.update(noteId, input, userId);
    }
    remove(noteId, userId) {
        this.notesService.remove(noteId, userId);
    }
    share(noteId, userId) {
        const link = this.notesService.createShareLink(noteId, userId);
        return { ...link, shareUrl: `/shared/${link.token}` };
    }
    revoke(noteId, token, userId) {
        this.notesService.revokeShareLink(noteId, token, userId);
    }
    shared(token, response) {
        const note = this.notesService.getShared(token);
        response.setHeader('Cache-Control', 'no-cache, must-revalidate');
        response.setHeader('ETag', `"note-${note.id}-${note.version}"`);
        return { id: note.id, title: note.title, content: note.content, version: note.version, updatedAt: note.updatedAt };
    }
};
__decorate([
    Post('notes'),
    __param(0, Body()),
    __param(1, Headers('x-user-id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], NotesController.prototype, "create", null);
__decorate([
    Get('notes'),
    __param(0, Query('limit')),
    __param(1, Query('offset')),
    __param(2, Headers('x-user-id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", void 0)
], NotesController.prototype, "list", null);
__decorate([
    Get('notes/:noteId'),
    __param(0, Param('noteId')),
    __param(1, Headers('x-user-id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], NotesController.prototype, "get", null);
__decorate([
    Patch('notes/:noteId'),
    __param(0, Param('noteId')),
    __param(1, Body()),
    __param(2, Headers('x-user-id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", void 0)
], NotesController.prototype, "update", null);
__decorate([
    Delete('notes/:noteId'),
    HttpCode(204),
    __param(0, Param('noteId')),
    __param(1, Headers('x-user-id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], NotesController.prototype, "remove", null);
__decorate([
    Post('notes/:noteId/share'),
    __param(0, Param('noteId')),
    __param(1, Headers('x-user-id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], NotesController.prototype, "share", null);
__decorate([
    Delete('notes/:noteId/share/:token'),
    HttpCode(204),
    __param(0, Param('noteId')),
    __param(1, Param('token')),
    __param(2, Headers('x-user-id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], NotesController.prototype, "revoke", null);
__decorate([
    Get('shared/:token'),
    __param(0, Param('token')),
    __param(1, Res({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], NotesController.prototype, "shared", null);
NotesController = __decorate([
    Controller(),
    __metadata("design:paramtypes", [NotesService])
], NotesController);
export { NotesController };
//# sourceMappingURL=notes.controller.js.map