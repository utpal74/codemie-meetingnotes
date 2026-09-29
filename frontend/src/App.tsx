import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

type NoteSummary = { id: string; title: string; sizeBytes: number; version: number; updatedAt: string }
type Note = NoteSummary & { content: string }

const API = 'http://localhost:3000/api/v1'
const userHeaders = { 'Content-Type': 'application/json', 'x-user-id': 'demo-user' }

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${API}${path}`, { ...options, headers: { ...userHeaders, ...options.headers } })
    if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.message ?? body.error?.message ?? `Request failed (${response.status})`)
    }
    return response.status === 204 ? (undefined as T) : response.json()
}

function App() {
    const [notes, setNotes] = useState<NoteSummary[]>([])
    const [selected, setSelected] = useState<Note | null>(null)
    const [title, setTitle] = useState('')
    const [content, setContent] = useState('')
    const [notice, setNotice] = useState('')
    const [shareLink, setShareLink] = useState('')
    const [shareCopied, setShareCopied] = useState(false)
    const [loading, setLoading] = useState(true)

    const loadNotes = async () => {
        setLoading(true)
        try {
            const result = await request<{ data: NoteSummary[] }>('/notes')
            setNotes(result.data)
        } catch (error) {
            setNotice(error instanceof Error ? error.message : 'Could not load notes')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { void loadNotes() }, [])

    const openNote = async (id: string) => {
        try {
            const note = await request<Note>(`/notes/${id}`)
            setSelected(note); setTitle(note.title); setContent(note.content); setNotice('')
        } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not open note') }
    }

    const saveNote = async (event: FormEvent) => {
        event.preventDefault()
        try {
            if (new Blob([JSON.stringify({ title, content })]).size > 30 * 1024 * 1024) throw new Error('This note exceeds the 30 MB limit.')
            if (selected) {
                const updated = await request<Note>(`/notes/${selected.id}`, { method: 'PATCH', body: JSON.stringify({ title, content, version: selected.version }) })
                setSelected(updated); setNotice('Saved just now')
            } else {
                const created = await request<Note>('/notes', { method: 'POST', body: JSON.stringify({ title, content }) })
                setSelected(created); setNotice('Note created')
            }
            await loadNotes()
        } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not save note') }
    }

    const createNew = () => { setSelected(null); setTitle(''); setContent(''); setNotice('Draft ready'); setShareLink(''); setShareCopied(false) }

    const deleteNote = async () => {
        if (!selected || !window.confirm('Delete this note?')) return
        try { await request(`/notes/${selected.id}`, { method: 'DELETE' }); createNew(); await loadNotes(); setNotice('Note deleted') }
        catch (error) { setNotice(error instanceof Error ? error.message : 'Could not delete note') }
    }

    const shareNote = async () => {
        if (!selected) return
        try {
            const result = await request<{ shareUrl: string }>(`/notes/${selected.id}/share`, { method: 'POST' })
            const link = `${window.location.origin}${result.shareUrl}`
            await navigator.clipboard.writeText(link)
            setShareLink(link)
            setShareCopied(true)
            setNotice('Share link copied')
            window.setTimeout(() => setShareCopied(false), 2600)
        } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not create share link') }
    }

    if (window.location.pathname.startsWith('/shared/')) return <SharedNote token={window.location.pathname.split('/').pop() ?? ''} />

    return (
        <main className="shell">
            <header className="topbar"><div className="brand"><span className="brand-mark">S</span><span>ShareNotes</span></div><div className="account"><span className="status-dot" /> Demo workspace <span className="avatar">DU</span></div></header>
            <div className="workspace">
                <aside className="sidebar"><div className="eyebrow">Your library</div><button className="new-note" onClick={createNew}><span>+</span> New note</button><div className="note-list">
                    {loading ? <p className="muted">Loading notes...</p> : notes.length === 0 ? <p className="muted">Your first note is waiting.</p> : notes.map((note) => <button className={`note-item ${selected?.id === note.id ? 'active' : ''}`} key={note.id} onClick={() => void openNote(note.id)}><strong>{note.title}</strong><span>{new Date(note.updatedAt).toLocaleDateString()}</span></button>)}
                </div><div className="sidebar-foot"><span className="storage-icon">◈</span><span><strong>Local workspace</strong><small>Encrypted sync coming next</small></span></div></aside>
                <section className="editor-panel"><div className="editor-head"><div><span className="crumb">Notes / {selected ? 'Edit note' : 'New note'}</span><h1>{selected ? 'Edit your note' : 'Capture a thought'}</h1></div><div className="actions"><button className={`ghost share-button ${shareCopied ? 'copied' : ''}`} onClick={() => void shareNote()} disabled={!selected}><span className="share-icon">{shareCopied ? '✓' : '↗'}</span>{shareCopied ? 'Copied' : 'Share'}</button><button className="danger" onClick={() => void deleteNote()} disabled={!selected}>Delete</button></div></div>
                    {shareLink && <div className={`share-preview ${shareCopied ? 'is-visible' : ''}`} role="status" aria-live="polite"><span className="preview-check">✓</span><span className="preview-copy"><strong>Link copied to clipboard</strong><span>{shareLink}</span></span><button type="button" className="preview-dismiss" aria-label="Dismiss copied link" onClick={() => setShareLink('')}>×</button></div>}
                    <form className="note-form" onSubmit={(event) => void saveNote(event)}><input className="title-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Note title" aria-label="Note title" /><div className="toolbar" aria-label="Editor toolbar"><button type="button"><strong>B</strong></button><button type="button"><em>I</em></button><button type="button">• List</button><span className="toolbar-rule" /><span className="format-label">Rich text</span></div><textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="Start writing something worth remembering..." aria-label="Note content" /><div className="form-foot"><span className="save-state">{notice || 'Private by default · changes stay in your workspace'}</span><button className="save" type="submit">{selected ? 'Save changes' : 'Save note'} <span>→</span></button></div></form>
                </section>
            </div>
        </main>
    )
}

function SharedNote({ token }: { token: string }) {
    const [note, setNote] = useState<Note | null>(null); const [error, setError] = useState('')
    useEffect(() => { fetch(`${API}/shared/${token}`).then(async (response) => response.ok ? setNote(await response.json()) : setError('This note has been deleted or the link has been revoked.')).catch(() => setError('Shared note unavailable.')) }, [token])
    return <main className="shared-shell"><div className="shared-brand"><span className="brand-mark">S</span> ShareNotes <span>Read-only view</span></div>{note ? <article className="shared-note"><span className="crumb">Shared note</span><h1>{note.title}</h1><p className="shared-date">Updated {new Date(note.updatedAt).toLocaleString()}</p><div className="shared-content">{note.content || 'This note is empty.'}</div></article> : <div className="shared-empty"><span>○</span><h1>{error || 'Loading note...'}</h1><p>Check the link and try again.</p></div>}</main>
}

export default App
