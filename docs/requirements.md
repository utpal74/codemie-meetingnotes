# ShareNotes Product Requirements

**Source story:** SN-101, Core Note Management & Sharing
**Status:** Existing baseline; pending re-import and approval from the source Word document.

## User Story

As a registered user of `sharenotes.com`, I want to create, edit, delete, and share my notes via a unique link so that I can store my thoughts and share information quickly and securely.

## Functional Requirements

### Note Creation

- An authenticated user can open a rich-text editor using the **New Note** action and save a note.
- The backend enforces a maximum aggregate note size of 30 MB, including text and attachments.
- An oversized note is rejected with a clear error message.

### Note Sharing

- An owner can generate a unique share URL for a saved note and copy it to the clipboard.
- An unauthenticated visitor with the link can view the note in read-only form.
- A share link must not grant edit or delete access.

### Note Editing

- Only the owner can edit an existing note.
- A successful save is reflected for the owner and visitors using the active shared link.

### Note Deletion

- A user must confirm the delete action.
- Only the owner can delete a note.
- After deletion, the note and its shared URL are no longer publicly accessible; requests return `404 Not Found` or an equivalent deleted-note message.

## Non-Functional Requirements

- The service is intended to be hosted at `sharenotes.com`.
- Backend validation is authoritative for payload limits and authorization.
- Only the note owner may create, edit, or delete that note.
- Public sharing is read-only and granted through a unique, non-guessable link.

## Acceptance Criteria

1. An authenticated user can create and save a note through the editor.
2. Payloads up to 30 MB are accepted; payloads exceeding 30 MB are rejected by the backend with a clear error.
3. An owner can generate and copy a unique share URL.
4. An unauthenticated visitor can read a shared note without mutation controls.
5. An owner can edit a note, and the saved change is visible through the active shared link.
6. A non-owner cannot edit or delete another user's note.
7. After deletion, the note and its share URL return `404 Not Found` or an equivalent deleted state.

## Assumptions and Open Questions

- The existing requirements were previously captured from chat and have not yet been reconciled with the source Word document.
- The Requirements Analyst must re-import the supplied `.docx`, resolve ambiguities with the user, and obtain approval before architecture work begins.