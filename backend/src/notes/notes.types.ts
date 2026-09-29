export type NoteStatus = 'active' | 'deleted';

export interface Note {
    id: string;
    ownerId: string;
    title: string;
    content: string;
    version: number;
    sizeBytes: number;
    status: NoteStatus;
    createdAt: string;
    updatedAt: string;
    deletedAt?: string;
}

export interface ShareLink {
    token: string;
    noteId: string;
    createdAt: string;
    revokedAt?: string;
}

export interface CreateNoteInput {
    title?: string;
    content?: string;
}

export interface UpdateNoteInput extends CreateNoteInput {
    version?: number;
}
