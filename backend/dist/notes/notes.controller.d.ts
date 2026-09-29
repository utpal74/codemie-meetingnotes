import type { Response } from 'express';
import { NotesService } from './notes.service.js';
import type { CreateNoteInput, UpdateNoteInput } from './notes.types.js';
export declare class NotesController {
    private readonly notesService;
    constructor(notesService: NotesService);
    create(input: CreateNoteInput, userId?: string): import("./notes.types.js").Note;
    list(limit?: string, offset?: string, userId?: string): {
        data: {
            id: string;
            title: string;
            sizeBytes: number;
            version: number;
            updatedAt: string;
        }[];
        meta: {
            limit: number;
            offset: number;
            total: number;
            hasMore: boolean;
        };
    };
    get(noteId: string, userId?: string): import("./notes.types.js").Note;
    update(noteId: string, input: UpdateNoteInput, userId?: string): import("./notes.types.js").Note;
    remove(noteId: string, userId?: string): void;
    share(noteId: string, userId?: string): {
        shareUrl: string;
        token: string;
        noteId: string;
        createdAt: string;
        revokedAt?: string;
    };
    revoke(noteId: string, token: string, userId?: string): void;
    shared(token: string, response: Response): {
        id: string;
        title: string;
        content: string;
        version: number;
        updatedAt: string;
    };
}
