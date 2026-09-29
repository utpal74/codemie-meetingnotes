import { ConflictException, NotFoundException, PayloadTooLargeException, UnauthorizedException } from '@nestjs/common';
import { NotesService } from './notes.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a service with a fresh in-memory store for each test. */
function buildService() {
    return new NotesService();
}

// ---------------------------------------------------------------------------
// create()
// ---------------------------------------------------------------------------

describe('NotesService.create()', () => {
    it('returns a note with the supplied title and content', () => {
        const svc = buildService();
        const note = svc.create({ title: 'My Note', content: 'Hello' });
        expect(note.title).toBe('My Note');
        expect(note.content).toBe('Hello');
    });

    it('trims whitespace from the title', () => {
        const svc = buildService();
        const note = svc.create({ title: '  Spaced  ', content: '' });
        expect(note.title).toBe('Spaced');
    });

    it('defaults to "Untitled note" when title is empty/whitespace', () => {
        const svc = buildService();
        expect(svc.create({ title: '' }).title).toBe('Untitled note');
        expect(svc.create({ title: '   ' }).title).toBe('Untitled note');
        expect(svc.create({}).title).toBe('Untitled note');
    });

    it('defaults content to empty string when omitted', () => {
        const svc = buildService();
        const note = svc.create({ title: 'T' });
        expect(note.content).toBe('');
    });

    it('sets initial version to 1', () => {
        const svc = buildService();
        expect(svc.create({ title: 'T' }).version).toBe(1);
    });

    it('sets status to "active"', () => {
        const svc = buildService();
        expect(svc.create({ title: 'T' }).status).toBe('active');
    });

    it('assigns the supplied ownerId', () => {
        const svc = buildService();
        const note = svc.create({ title: 'T' }, 'user-abc');
        expect(note.ownerId).toBe('user-abc');
    });

    it('defaults ownerId to "demo-user"', () => {
        const svc = buildService();
        const note = svc.create({ title: 'T' });
        expect(note.ownerId).toBe('demo-user');
    });

    it('assigns a unique UUID id', () => {
        const svc = buildService();
        const a = svc.create({ title: 'A' });
        const b = svc.create({ title: 'B' });
        expect(a.id).toMatch(/^[0-9a-f-]{36}$/);
        expect(a.id).not.toBe(b.id);
    });

    it('populates createdAt and updatedAt as ISO strings', () => {
        const svc = buildService();
        const note = svc.create({ title: 'T' });
        expect(() => new Date(note.createdAt)).not.toThrow();
        expect(() => new Date(note.updatedAt)).not.toThrow();
        expect(note.createdAt).toBe(note.updatedAt);
    });

    it('throws PayloadTooLargeException when payload exceeds 30 MB', () => {
        const svc = buildService();
        const bigContent = 'x'.repeat(31 * 1024 * 1024);
        expect(() => svc.create({ title: 'T', content: bigContent })).toThrow(PayloadTooLargeException);
    });

    it('computes and stores sizeBytes', () => {
        const svc = buildService();
        const note = svc.create({ title: 'Hi', content: 'World' });
        expect(note.sizeBytes).toBeGreaterThan(0);
    });
});

// ---------------------------------------------------------------------------
// list()
// ---------------------------------------------------------------------------

describe('NotesService.list()', () => {
    it('returns an empty list when no notes exist', () => {
        const svc = buildService();
        const result = svc.list('demo-user');
        expect(result.data).toHaveLength(0);
        expect(result.meta.total).toBe(0);
    });

    it('only returns notes belonging to the given owner', () => {
        const svc = buildService();
        svc.create({ title: 'Mine' }, 'alice');
        svc.create({ title: 'Theirs' }, 'bob');
        const result = svc.list('alice');
        expect(result.data).toHaveLength(1);
        expect(result.data[0].title).toBe('Mine');
    });

    it('excludes soft-deleted notes', () => {
        const svc = buildService();
        const note = svc.create({ title: 'Gone' }, 'alice');
        svc.remove(note.id, 'alice');
        expect(svc.list('alice').meta.total).toBe(0);
    });

    it('returns list items sorted by updatedAt descending', async () => {
        const svc = buildService();
        const first = svc.create({ title: 'First' }, 'alice');
        // Ensure second note has a later timestamp
        await new Promise((r) => setTimeout(r, 5));
        svc.create({ title: 'Second' }, 'alice');
        const titles = svc.list('alice').data.map((n) => n.title);
        expect(titles[0]).toBe('Second');
        expect(titles[1]).toBe('First');
        // updating first note should bump it to the front
        await new Promise((r) => setTimeout(r, 5));
        svc.update(first.id, { version: 1, title: 'First (updated)' }, 'alice');
        const updated = svc.list('alice').data.map((n) => n.title);
        expect(updated[0]).toBe('First (updated)');
    });

    it('respects limit parameter and caps at 100', () => {
        const svc = buildService();
        for (let i = 0; i < 10; i++) svc.create({ title: `N${i}` }, 'alice');
        expect(svc.list('alice', 3).data).toHaveLength(3);
        // limit > 100 should be capped
        expect(svc.list('alice', 200).data).toHaveLength(10);
    });

    it('enforces minimum limit of 1', () => {
        const svc = buildService();
        svc.create({ title: 'A' }, 'alice');
        expect(svc.list('alice', 0).data).toHaveLength(1);
        expect(svc.list('alice', -5).data).toHaveLength(1);
    });

    it('respects offset parameter', () => {
        const svc = buildService();
        for (let i = 0; i < 5; i++) svc.create({ title: `N${i}` }, 'alice');
        const page2 = svc.list('alice', 3, 3);
        expect(page2.data).toHaveLength(2);
        expect(page2.meta.offset).toBe(3);
    });

    it('sets hasMore correctly', () => {
        const svc = buildService();
        for (let i = 0; i < 5; i++) svc.create({ title: `N${i}` }, 'alice');
        expect(svc.list('alice', 3, 0).meta.hasMore).toBe(true);
        expect(svc.list('alice', 3, 3).meta.hasMore).toBe(false);
    });

    it('returns only summary fields (no content)', () => {
        const svc = buildService();
        svc.create({ title: 'T', content: 'secret' }, 'alice');
        const item = svc.list('alice').data[0];
        expect(item).not.toHaveProperty('content');
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('title');
        expect(item).toHaveProperty('version');
        expect(item).toHaveProperty('sizeBytes');
        expect(item).toHaveProperty('updatedAt');
    });
});

// ---------------------------------------------------------------------------
// getOwned()
// ---------------------------------------------------------------------------

describe('NotesService.getOwned()', () => {
    it('returns the full note when owner matches', () => {
        const svc = buildService();
        const created = svc.create({ title: 'Mine', content: 'body' }, 'alice');
        const fetched = svc.getOwned(created.id, 'alice');
        expect(fetched).toEqual(created);
    });

    it('throws NotFoundException for a non-existent id', () => {
        const svc = buildService();
        expect(() => svc.getOwned('no-such-id', 'alice')).toThrow(NotFoundException);
    });

    it('throws NotFoundException for a soft-deleted note', () => {
        const svc = buildService();
        const note = svc.create({ title: 'T' }, 'alice');
        svc.remove(note.id, 'alice');
        expect(() => svc.getOwned(note.id, 'alice')).toThrow(NotFoundException);
    });

    it('throws UnauthorizedException when caller is not the owner', () => {
        const svc = buildService();
        const note = svc.create({ title: 'T' }, 'alice');
        expect(() => svc.getOwned(note.id, 'bob')).toThrow(UnauthorizedException);
    });
});

// ---------------------------------------------------------------------------
// update()
// ---------------------------------------------------------------------------

describe('NotesService.update()', () => {
    it('updates title and content, increments version', () => {
        const svc = buildService();
        const note = svc.create({ title: 'Old', content: 'old body' }, 'alice');
        const updated = svc.update(note.id, { version: 1, title: 'New', content: 'new body' }, 'alice');
        expect(updated.title).toBe('New');
        expect(updated.content).toBe('new body');
        expect(updated.version).toBe(2);
    });

    it('trims whitespace from the updated title', () => {
        const svc = buildService();
        const note = svc.create({ title: 'T' }, 'alice');
        const updated = svc.update(note.id, { version: 1, title: '  Padded  ' }, 'alice');
        expect(updated.title).toBe('Padded');
    });

    it('falls back to old title when new title is empty/whitespace', () => {
        const svc = buildService();
        const note = svc.create({ title: 'Keep me' }, 'alice');
        const updated = svc.update(note.id, { version: 1, title: '' }, 'alice');
        expect(updated.title).toBe('Keep me');
    });

    it('keeps old content when content is not supplied', () => {
        const svc = buildService();
        const note = svc.create({ title: 'T', content: 'original' }, 'alice');
        const updated = svc.update(note.id, { version: 1, title: 'T' }, 'alice');
        expect(updated.content).toBe('original');
    });

    it('throws ConflictException when version does not match', () => {
        const svc = buildService();
        const note = svc.create({ title: 'T' }, 'alice');
        expect(() => svc.update(note.id, { version: 99, title: 'T' }, 'alice')).toThrow(ConflictException);
    });

    it('ConflictException carries NOTE_VERSION_CONFLICT code and currentVersion', () => {
        const svc = buildService();
        const note = svc.create({ title: 'T' }, 'alice');
        try {
            svc.update(note.id, { version: 99, title: 'T' }, 'alice');
        } catch (err: unknown) {
            expect(err).toBeInstanceOf(ConflictException);
            const body = (err as ConflictException).getResponse() as Record<string, unknown>;
            expect(body.code).toBe('NOTE_VERSION_CONFLICT');
            expect(body.currentVersion).toBe(1);
        }
    });

    it('throws PayloadTooLargeException when updated payload exceeds 30 MB', () => {
        const svc = buildService();
        const note = svc.create({ title: 'T' }, 'alice');
        const bigContent = 'x'.repeat(31 * 1024 * 1024);
        expect(() => svc.update(note.id, { version: 1, content: bigContent }, 'alice')).toThrow(PayloadTooLargeException);
    });

    it('throws NotFoundException for a non-existent note', () => {
        const svc = buildService();
        expect(() => svc.update('bad-id', { version: 1 }, 'alice')).toThrow(NotFoundException);
    });

    it('throws UnauthorizedException when caller is not the owner', () => {
        const svc = buildService();
        const note = svc.create({ title: 'T' }, 'alice');
        expect(() => svc.update(note.id, { version: 1, title: 'X' }, 'bob')).toThrow(UnauthorizedException);
    });

    it('updates updatedAt timestamp', async () => {
        const svc = buildService();
        const note = svc.create({ title: 'T' }, 'alice');
        await new Promise((r) => setTimeout(r, 5));
        const updated = svc.update(note.id, { version: 1 }, 'alice');
        expect(updated.updatedAt > note.updatedAt).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// remove()
// ---------------------------------------------------------------------------

describe('NotesService.remove()', () => {
    it('soft-deletes the note (status becomes "deleted")', () => {
        const svc = buildService();
        const note = svc.create({ title: 'T' }, 'alice');
        svc.remove(note.id, 'alice');
        // note should no longer be accessible
        expect(() => svc.getOwned(note.id, 'alice')).toThrow(NotFoundException);
    });

    it('revokes all active share links for the note', () => {
        const svc = buildService();
        const note = svc.create({ title: 'T' }, 'alice');
        const link = svc.createShareLink(note.id, 'alice');
        svc.remove(note.id, 'alice');
        // the shared view should no longer work
        expect(() => svc.getShared(link.token)).toThrow(NotFoundException);
    });

    it('throws NotFoundException for a non-existent note', () => {
        const svc = buildService();
        expect(() => svc.remove('bad-id', 'alice')).toThrow(NotFoundException);
    });

    it('throws UnauthorizedException when caller is not the owner', () => {
        const svc = buildService();
        const note = svc.create({ title: 'T' }, 'alice');
        expect(() => svc.remove(note.id, 'bob')).toThrow(UnauthorizedException);
    });
});

// ---------------------------------------------------------------------------
// createShareLink()
// ---------------------------------------------------------------------------

describe('NotesService.createShareLink()', () => {
    it('creates a share link with a non-empty token', () => {
        const svc = buildService();
        const note = svc.create({ title: 'T' }, 'alice');
        const link = svc.createShareLink(note.id, 'alice');
        expect(typeof link.token).toBe('string');
        expect(link.token.length).toBeGreaterThan(0);
        expect(link.noteId).toBe(note.id);
        expect(link.revokedAt).toBeUndefined();
    });

    it('is idempotent – returns the same token on repeated calls', () => {
        const svc = buildService();
        const note = svc.create({ title: 'T' }, 'alice');
        const first = svc.createShareLink(note.id, 'alice');
        const second = svc.createShareLink(note.id, 'alice');
        expect(first.token).toBe(second.token);
    });

    it('throws NotFoundException for a non-existent note', () => {
        const svc = buildService();
        expect(() => svc.createShareLink('bad-id', 'alice')).toThrow(NotFoundException);
    });

    it('throws UnauthorizedException when caller is not the owner', () => {
        const svc = buildService();
        const note = svc.create({ title: 'T' }, 'alice');
        expect(() => svc.createShareLink(note.id, 'bob')).toThrow(UnauthorizedException);
    });

    it('creates a new link after the previous one was revoked', () => {
        const svc = buildService();
        const note = svc.create({ title: 'T' }, 'alice');
        const first = svc.createShareLink(note.id, 'alice');
        svc.revokeShareLink(note.id, first.token, 'alice');
        const second = svc.createShareLink(note.id, 'alice');
        expect(second.token).not.toBe(first.token);
        expect(second.revokedAt).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// revokeShareLink()
// ---------------------------------------------------------------------------

describe('NotesService.revokeShareLink()', () => {
    it('marks the share link as revoked', () => {
        const svc = buildService();
        const note = svc.create({ title: 'T' }, 'alice');
        const link = svc.createShareLink(note.id, 'alice');
        svc.revokeShareLink(note.id, link.token, 'alice');
        // getShared should now throw
        expect(() => svc.getShared(link.token)).toThrow(NotFoundException);
    });

    it('throws NotFoundException for a non-existent token', () => {
        const svc = buildService();
        const note = svc.create({ title: 'T' }, 'alice');
        expect(() => svc.revokeShareLink(note.id, 'bad-token', 'alice')).toThrow(NotFoundException);
    });

    it('throws NotFoundException when token belongs to a different note', () => {
        const svc = buildService();
        const a = svc.create({ title: 'A' }, 'alice');
        const b = svc.create({ title: 'B' }, 'alice');
        const linkA = svc.createShareLink(a.id, 'alice');
        expect(() => svc.revokeShareLink(b.id, linkA.token, 'alice')).toThrow(NotFoundException);
    });

    it('throws NotFoundException when token is already revoked', () => {
        const svc = buildService();
        const note = svc.create({ title: 'T' }, 'alice');
        const link = svc.createShareLink(note.id, 'alice');
        svc.revokeShareLink(note.id, link.token, 'alice');
        expect(() => svc.revokeShareLink(note.id, link.token, 'alice')).toThrow(NotFoundException);
    });

    it('throws UnauthorizedException when caller is not the owner', () => {
        const svc = buildService();
        const note = svc.create({ title: 'T' }, 'alice');
        const link = svc.createShareLink(note.id, 'alice');
        expect(() => svc.revokeShareLink(note.id, link.token, 'bob')).toThrow(UnauthorizedException);
    });
});

// ---------------------------------------------------------------------------
// getShared()
// ---------------------------------------------------------------------------

describe('NotesService.getShared()', () => {
    it('returns the full note via a valid share token', () => {
        const svc = buildService();
        const note = svc.create({ title: 'Public', content: 'hello' }, 'alice');
        const link = svc.createShareLink(note.id, 'alice');
        const shared = svc.getShared(link.token);
        expect(shared.id).toBe(note.id);
        expect(shared.title).toBe('Public');
        expect(shared.content).toBe('hello');
    });

    it('throws NotFoundException for an unknown token', () => {
        const svc = buildService();
        expect(() => svc.getShared('unknown-token')).toThrow(NotFoundException);
    });

    it('throws NotFoundException for a revoked token', () => {
        const svc = buildService();
        const note = svc.create({ title: 'T' }, 'alice');
        const link = svc.createShareLink(note.id, 'alice');
        svc.revokeShareLink(note.id, link.token, 'alice');
        expect(() => svc.getShared(link.token)).toThrow(NotFoundException);
    });

    it('throws NotFoundException when the underlying note is deleted', () => {
        const svc = buildService();
        const note = svc.create({ title: 'T' }, 'alice');
        const link = svc.createShareLink(note.id, 'alice');
        svc.remove(note.id, 'alice');
        expect(() => svc.getShared(link.token)).toThrow(NotFoundException);
    });
});
