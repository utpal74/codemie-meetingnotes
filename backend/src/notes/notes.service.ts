import {
    ConflictException,
    Injectable,
    NotFoundException,
    PayloadTooLargeException,
    UnauthorizedException,
} from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import {
    CreateNoteInput,
    Note,
    ShareLink,
    UpdateNoteInput,
} from './notes.types.js';

const MAX_NOTE_BYTES = 30 * 1024 * 1024;
const DEFAULT_OWNER_ID = 'demo-user';

@Injectable()
export class NotesService {
    private readonly notes = new Map<string, Note>();
    private readonly shareLinks = new Map<string, ShareLink>();

    create(input: CreateNoteInput, ownerId = DEFAULT_OWNER_ID): Note {
        const title = input.title?.trim() || 'Untitled note';
        const content = input.content ?? '';
        const sizeBytes = this.measure(title, content);
        this.ensureSize(sizeBytes);
        const now = new Date().toISOString();
        const note: Note = {
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

    getOwned(noteId: string, ownerId = DEFAULT_OWNER_ID): Note {
        const note = this.findActive(noteId);
        this.ensureOwner(note, ownerId);
        return note;
    }

    update(noteId: string, input: UpdateNoteInput, ownerId = DEFAULT_OWNER_ID): Note {
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
        const updated: Note = {
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

    remove(noteId: string, ownerId = DEFAULT_OWNER_ID): void {
        const note = this.getOwned(noteId, ownerId);
        const deletedAt = new Date().toISOString();
        this.notes.set(noteId, { ...note, status: 'deleted', deletedAt, updatedAt: deletedAt });
        for (const [token, link] of this.shareLinks) {
            if (link.noteId === noteId) {
                this.shareLinks.set(token, { ...link, revokedAt: deletedAt });
            }
        }
    }

    createShareLink(noteId: string, ownerId = DEFAULT_OWNER_ID): ShareLink {
        this.getOwned(noteId, ownerId);
        const active = [...this.shareLinks.values()].find(
            (link) => link.noteId === noteId && !link.revokedAt,
        );
        if (active) return active;
        const link: ShareLink = {
            token: randomBytes(32).toString('base64url'),
            noteId,
            createdAt: new Date().toISOString(),
        };
        this.shareLinks.set(link.token, link);
        return link;
    }

    revokeShareLink(noteId: string, token: string, ownerId = DEFAULT_OWNER_ID): void {
        this.getOwned(noteId, ownerId);
        const link = this.shareLinks.get(token);
        if (!link || link.noteId !== noteId || link.revokedAt) {
            throw new NotFoundException('Share link not found');
        }
        this.shareLinks.set(token, { ...link, revokedAt: new Date().toISOString() });
    }

    getShared(token: string): Note {
        const link = this.shareLinks.get(token);
        if (!link || link.revokedAt) throw new NotFoundException('Shared note not found');
        return this.findActive(link.noteId);
    }

    private findActive(noteId: string): Note {
        const note = this.notes.get(noteId);
        if (!note || note.status === 'deleted') throw new NotFoundException('Note not found');
        return note;
    }

    private ensureOwner(note: Note, ownerId: string): void {
        if (note.ownerId !== ownerId) throw new UnauthorizedException('Only the owner can change this note');
    }

    private measure(title: string, content: string): number {
        return Buffer.byteLength(JSON.stringify({ title, content }), 'utf8');
    }

    private ensureSize(sizeBytes: number): void {
        if (sizeBytes > MAX_NOTE_BYTES) {
            throw new PayloadTooLargeException('A note, including attachments, cannot exceed 30 MB');
        }
    }
}
