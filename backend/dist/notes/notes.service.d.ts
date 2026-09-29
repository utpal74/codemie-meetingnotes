import { CreateNoteInput, Note, ShareLink, UpdateNoteInput } from './notes.types.js';
export declare class NotesService {
    private readonly notes;
    private readonly shareLinks;
    create(input: CreateNoteInput, ownerId?: string): Note;
    list(ownerId?: string, limit?: number, offset?: number): {
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
    getOwned(noteId: string, ownerId?: string): Note;
    update(noteId: string, input: UpdateNoteInput, ownerId?: string): Note;
    remove(noteId: string, ownerId?: string): void;
    createShareLink(noteId: string, ownerId?: string): ShareLink;
    revokeShareLink(noteId: string, token: string, ownerId?: string): void;
    getShared(token: string): Note;
    private findActive;
    private ensureOwner;
    private measure;
    private ensureSize;
}
