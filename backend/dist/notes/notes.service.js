var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { ConflictException, Injectable, NotFoundException, PayloadTooLargeException, UnauthorizedException, } from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
const MAX_NOTE_BYTES = 30 * 1024 * 1024;
const DEFAULT_OWNER_ID = 'demo-user';
let NotesService = class NotesService {
    notes = new Map();
    shareLinks = new Map();
    create(input, ownerId = DEFAULT_OWNER_ID) {
        const title = input.title?.trim() || 'Untitled note';
        const content = input.content ?? '';
        const sizeBytes = this.measure(title, content);
        this.ensureSize(sizeBytes);
        const now = new Date().toISOString();
        const note = {
            id: randomUUID(),
            ownerId,
            title,
            content,
            version: 1,
            sizeBytes,
            status: 'active',
            createdAt: now,
            updatedAt: now,
        };
        this.notes.set(note.id, note);
        return note;
    }
    list(ownerId = DEFAULT_OWNER_ID, limit = 20, offset = 0) {
        const notes = [...this.notes.values()]
            .filter((note) => note.ownerId === ownerId && note.status === 'active')
            .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
        const boundedLimit = Math.min(Math.max(limit, 1), 100);
        const data = notes.slice(offset, offset + boundedLimit).map((note) => ({
            id: note.id,
            title: note.title,
            sizeBytes: note.sizeBytes,
            version: note.version,
            updatedAt: note.updatedAt,
        }));
        return {
            data,
            meta: {
                limit: boundedLimit,
                offset,
                total: notes.length,
                hasMore: offset + boundedLimit < notes.length,
            },
        };
    }
    getOwned(noteId, ownerId = DEFAULT_OWNER_ID) {
        const note = this.findActive(noteId);
        this.ensureOwner(note, ownerId);
        return note;
    }
    update(noteId, input, ownerId = DEFAULT_OWNER_ID) {
        const note = this.getOwned(noteId, ownerId);
        if (input.version !== note.version) {
            throw new ConflictException({
                code: 'NOTE_VERSION_CONFLICT',
                message: 'This note changed since it was opened. Reload before saving.',
                currentVersion: note.version,
            });
        }
        const title = input.title?.trim() || note.title;
        const content = input.content ?? note.content;
        const sizeBytes = this.measure(title, content);
        this.ensureSize(sizeBytes);
        const updated = {
            ...note,
            title,
            content,
            sizeBytes,
            version: note.version + 1,
            updatedAt: new Date().toISOString(),
        };
        this.notes.set(noteId, updated);
        return updated;
    }
    remove(noteId, ownerId = DEFAULT_OWNER_ID) {
        const note = this.getOwned(noteId, ownerId);
        const deletedAt = new Date().toISOString();
        this.notes.set(noteId, { ...note, status: 'deleted', deletedAt, updatedAt: deletedAt });
        for (const [token, link] of this.shareLinks) {
            if (link.noteId === noteId) {
                this.shareLinks.set(token, { ...link, revokedAt: deletedAt });
            }
        }
    }
    createShareLink(noteId, ownerId = DEFAULT_OWNER_ID) {
        this.getOwned(noteId, ownerId);
        const active = [...this.shareLinks.values()].find((link) => link.noteId === noteId && !link.revokedAt);
        if (active)
            return active;
        const link = {
            token: randomBytes(32).toString('base64url'),
            noteId,
            createdAt: new Date().toISOString(),
        };
        this.shareLinks.set(link.token, link);
        return link;
    }
    revokeShareLink(noteId, token, ownerId = DEFAULT_OWNER_ID) {
        this.getOwned(noteId, ownerId);
        const link = this.shareLinks.get(token);
        if (!link || link.noteId !== noteId || link.revokedAt) {
            throw new NotFoundException('Share link not found');
        }
        this.shareLinks.set(token, { ...link, revokedAt: new Date().toISOString() });
    }
    getShared(token) {
        const link = this.shareLinks.get(token);
        if (!link || link.revokedAt)
            throw new NotFoundException('Shared note not found');
        return this.findActive(link.noteId);
    }
    findActive(noteId) {
        const note = this.notes.get(noteId);
        if (!note || note.status === 'deleted')
            throw new NotFoundException('Note not found');
        return note;
    }
    ensureOwner(note, ownerId) {
        if (note.ownerId !== ownerId)
            throw new UnauthorizedException('Only the owner can change this note');
    }
    measure(title, content) {
        return Buffer.byteLength(JSON.stringify({ title, content }), 'utf8');
    }
    ensureSize(sizeBytes) {
        if (sizeBytes > MAX_NOTE_BYTES) {
            throw new PayloadTooLargeException('A note, including attachments, cannot exceed 30 MB');
        }
    }
};
NotesService = __decorate([
    Injectable()
], NotesService);
export { NotesService };
//# sourceMappingURL=notes.service.js.map