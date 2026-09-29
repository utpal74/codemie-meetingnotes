import { Test, TestingModule } from '@nestjs/testing';
import { NotesController } from './notes.controller.js';
import { NotesService } from './notes.service.js';
import type { Response } from 'express';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildMockResponse(): jest.Mocked<Pick<Response, 'setHeader'>> {
    return { setHeader: vi.fn() } as unknown as jest.Mocked<Pick<Response, 'setHeader'>>;
}

async function buildModule() {
    const module: TestingModule = await Test.createTestingModule({
        controllers: [NotesController],
        providers: [NotesService],
    }).compile();

    return {
        controller: module.get<NotesController>(NotesController),
        service: module.get<NotesService>(NotesService),
    };
}

// ---------------------------------------------------------------------------
// POST /notes  →  create()
// ---------------------------------------------------------------------------

describe('NotesController.create()', () => {
    it('delegates to NotesService and returns the created note', async () => {
        const { controller } = await buildModule();
        const note = controller.create({ title: 'Hello', content: 'World' }, 'alice');
        expect(note.title).toBe('Hello');
        expect(note.content).toBe('World');
        expect(note.ownerId).toBe('alice');
    });

    it('passes undefined userId → NotesService defaults to "demo-user"', async () => {
        const { controller } = await buildModule();
        const note = controller.create({ title: 'T' }, undefined);
        expect(note.ownerId).toBe('demo-user');
    });
});

// ---------------------------------------------------------------------------
// GET /notes  →  list()
// ---------------------------------------------------------------------------

describe('NotesController.list()', () => {
    it('returns paginated data and meta', async () => {
        const { controller } = await buildModule();
        controller.create({ title: 'Note 1' }, 'alice');
        controller.create({ title: 'Note 2' }, 'alice');
        const result = controller.list('20', '0', 'alice');
        expect(result.data).toHaveLength(2);
        expect(result.meta.total).toBe(2);
    });

    it('respects limit and offset strings from query params', async () => {
        const { controller } = await buildModule();
        for (let i = 0; i < 5; i++) controller.create({ title: `N${i}` }, 'alice');
        const page = controller.list('3', '3', 'alice');
        expect(page.data).toHaveLength(2);
        expect(page.meta.offset).toBe(3);
    });

    it('scopes notes to the requesting user', async () => {
        const { controller } = await buildModule();
        controller.create({ title: 'Alice note' }, 'alice');
        controller.create({ title: 'Bob note' }, 'bob');
        expect(controller.list('20', '0', 'alice').meta.total).toBe(1);
        expect(controller.list('20', '0', 'bob').meta.total).toBe(1);
    });

    it('defaults to "demo-user" when userId header is absent', async () => {
        const { controller } = await buildModule();
        controller.create({ title: 'T' }, undefined);
        expect(controller.list('20', '0', undefined).meta.total).toBe(1);
    });
});

// ---------------------------------------------------------------------------
// GET /notes/:noteId  →  get()
// ---------------------------------------------------------------------------

describe('NotesController.get()', () => {
    it('returns the full note for the owner', async () => {
        const { controller } = await buildModule();
        const created = controller.create({ title: 'Detail', content: 'body' }, 'alice');
        const fetched = controller.get(created.id, 'alice');
        expect(fetched.content).toBe('body');
    });

    it('throws when note does not exist', async () => {
        const { controller } = await buildModule();
        expect(() => controller.get('no-id', 'alice')).toThrow();
    });

    it('throws when userId does not match the owner', async () => {
        const { controller } = await buildModule();
        const created = controller.create({ title: 'T' }, 'alice');
        expect(() => controller.get(created.id, 'bob')).toThrow();
    });
});

// ---------------------------------------------------------------------------
// PATCH /notes/:noteId  →  update()
// ---------------------------------------------------------------------------

describe('NotesController.update()', () => {
    it('updates the note and returns the updated version', async () => {
        const { controller } = await buildModule();
        const created = controller.create({ title: 'Original' }, 'alice');
        const updated = controller.update(created.id, { version: 1, title: 'Updated' }, 'alice');
        expect(updated.title).toBe('Updated');
        expect(updated.version).toBe(2);
    });

    it('throws ConflictException on version mismatch', async () => {
        const { controller } = await buildModule();
        const created = controller.create({ title: 'T' }, 'alice');
        expect(() => controller.update(created.id, { version: 99, title: 'T' }, 'alice')).toThrow();
    });

    it('throws when note does not exist', async () => {
        const { controller } = await buildModule();
        expect(() => controller.update('bad-id', { version: 1 }, 'alice')).toThrow();
    });
});

// ---------------------------------------------------------------------------
// DELETE /notes/:noteId  →  remove()
// ---------------------------------------------------------------------------

describe('NotesController.remove()', () => {
    it('soft-deletes the note and returns undefined (204)', async () => {
        const { controller } = await buildModule();
        const created = controller.create({ title: 'T' }, 'alice');
        const result = controller.remove(created.id, 'alice');
        expect(result).toBeUndefined();
        // Subsequent get should throw
        expect(() => controller.get(created.id, 'alice')).toThrow();
    });

    it('throws when note does not exist', async () => {
        const { controller } = await buildModule();
        expect(() => controller.remove('bad-id', 'alice')).toThrow();
    });

    it('throws when caller is not the owner', async () => {
        const { controller } = await buildModule();
        const created = controller.create({ title: 'T' }, 'alice');
        expect(() => controller.remove(created.id, 'bob')).toThrow();
    });
});

// ---------------------------------------------------------------------------
// POST /notes/:noteId/share  →  share()
// ---------------------------------------------------------------------------

describe('NotesController.share()', () => {
    it('returns a share link with token and shareUrl', async () => {
        const { controller } = await buildModule();
        const created = controller.create({ title: 'T' }, 'alice');
        const result = controller.share(created.id, 'alice');
        expect(typeof result.token).toBe('string');
        expect(result.shareUrl).toBe(`/shared/${result.token}`);
        expect(result.noteId).toBe(created.id);
    });

    it('is idempotent – returns the same token on repeated calls', async () => {
        const { controller } = await buildModule();
        const created = controller.create({ title: 'T' }, 'alice');
        const first = controller.share(created.id, 'alice');
        const second = controller.share(created.id, 'alice');
        expect(first.token).toBe(second.token);
    });

    it('throws when note does not exist', async () => {
        const { controller } = await buildModule();
        expect(() => controller.share('bad-id', 'alice')).toThrow();
    });

    it('throws when caller is not the owner', async () => {
        const { controller } = await buildModule();
        const created = controller.create({ title: 'T' }, 'alice');
        expect(() => controller.share(created.id, 'bob')).toThrow();
    });
});

// ---------------------------------------------------------------------------
// DELETE /notes/:noteId/share/:token  →  revoke()
// ---------------------------------------------------------------------------

describe('NotesController.revoke()', () => {
    it('revokes the share link and returns undefined (204)', async () => {
        const { controller } = await buildModule();
        const created = controller.create({ title: 'T' }, 'alice');
        const { token } = controller.share(created.id, 'alice');
        const result = controller.revoke(created.id, token, 'alice');
        expect(result).toBeUndefined();
    });

    it('throws when token is invalid', async () => {
        const { controller } = await buildModule();
        const created = controller.create({ title: 'T' }, 'alice');
        expect(() => controller.revoke(created.id, 'invalid-token', 'alice')).toThrow();
    });

    it('throws when caller is not the owner', async () => {
        const { controller } = await buildModule();
        const created = controller.create({ title: 'T' }, 'alice');
        const { token } = controller.share(created.id, 'alice');
        expect(() => controller.revoke(created.id, token, 'bob')).toThrow();
    });
});

// ---------------------------------------------------------------------------
// GET /shared/:token  →  shared()
// ---------------------------------------------------------------------------

describe('NotesController.shared()', () => {
    it('returns a read-only view of the note and sets cache headers', async () => {
        const { controller } = await buildModule();
        const created = controller.create({ title: 'Public', content: 'open' }, 'alice');
        const { token } = controller.share(created.id, 'alice');
        const res = buildMockResponse() as unknown as Response;
        const result = controller.shared(token, res);
        expect(result.id).toBe(created.id);
        expect(result.title).toBe('Public');
        expect(result.content).toBe('open');
        expect(result.version).toBe(1);
        expect(result.updatedAt).toBeTruthy();
        // Cache headers
        expect((res as unknown as ReturnType<typeof buildMockResponse>).setHeader).toHaveBeenCalledWith(
            'Cache-Control',
            'no-cache, must-revalidate',
        );
        expect((res as unknown as ReturnType<typeof buildMockResponse>).setHeader).toHaveBeenCalledWith(
            'ETag',
            `"note-${created.id}-1"`,
        );
    });

    it('does not expose ownerId in the response', async () => {
        const { controller } = await buildModule();
        const created = controller.create({ title: 'T', content: '' }, 'alice');
        const { token } = controller.share(created.id, 'alice');
        const res = buildMockResponse() as unknown as Response;
        const result = controller.shared(token, res);
        expect(result).not.toHaveProperty('ownerId');
        expect(result).not.toHaveProperty('status');
        expect(result).not.toHaveProperty('sizeBytes');
    });

    it('throws for an invalid token', async () => {
        const { controller } = await buildModule();
        const res = buildMockResponse() as unknown as Response;
        expect(() => controller.shared('bad-token', res)).toThrow();
    });

    it('throws for a revoked token', async () => {
        const { controller } = await buildModule();
        const created = controller.create({ title: 'T' }, 'alice');
        const { token } = controller.share(created.id, 'alice');
        controller.revoke(created.id, token, 'alice');
        const res = buildMockResponse() as unknown as Response;
        expect(() => controller.shared(token, res)).toThrow();
    });
});
