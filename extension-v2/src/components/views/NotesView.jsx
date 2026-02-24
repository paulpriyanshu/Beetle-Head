import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { useNotes } from '../../hooks/useNotes';
import { formatTime, extractVideoId, getYouTubeThumbnail } from '../../utils/helpers';

export default function NotesView({ onBack }) {
    const [notes, setNotes] = useState([]);
    const [noteInput, setNoteInput] = useState('');
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const { fetchNotes, saveNote, deleteNote } = useNotes();

    const loadNotes = useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetchNotes();
            setNotes(data);
        } catch (e) {
            console.error('Load notes failed:', e);
        } finally {
            setLoading(false);
        }
    }, [fetchNotes]);

    useEffect(() => { loadNotes(); }, [loadNotes]);

    const handleSave = async () => {
        const text = noteInput.trim();
        if (!text) return;
        setSaving(true);
        try {
            await saveNote(text, 'general');
            setNoteInput('');
            await loadNotes();
        } catch (e) {
            console.error('Save failed:', e);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        try {
            await deleteNote(id);
            await loadNotes();
        } catch (e) {
            console.error('Delete failed:', e);
        }
    };

    return (
        <div
            id="notesTab"
            style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                background: 'var(--bg-primary)',
            }}
        >
            {/* Header */}
            {/* <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                     {onBack && (
                        <button
                            id="btnBackToNotes"
                            onClick={onBack}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}
                        >
                            <ArrowLeft size={16} />
                        </button>
                    )}
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Notes</h3>
                </div>
            </div> */}

            {/* Input */}
            <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                <textarea
                    id="generalNoteInput"
                    value={noteInput}
                    onChange={e => setNoteInput(e.target.value)}
                    placeholder="Take a general note..."
                    rows={2}
                    style={{
                        width: '100%',
                        background: 'var(--input-bg)',
                        border: '1px solid var(--input-border)',
                        borderRadius: 10,
                        padding: '8px 12px',
                        color: 'var(--text-primary)',
                        fontSize: 13,
                        resize: 'none',
                        outline: 'none',
                        fontFamily: 'inherit',
                        marginBottom: 8,
                    }}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSave())}
                />
                <button
                    id="saveGeneralNoteBtn"
                    onClick={handleSave}
                    disabled={saving}
                    style={{
                        width: '100%',
                        padding: '8px',
                        background: 'var(--accent)',
                        color: 'white',
                        border: 'none',
                        borderRadius: 8,
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                    }}
                >
                    {saving ? 'Saving...' : 'Save General Note'}
                </button>
            </div>

            {/* Notes list */}
            <div id="generalNotesList" style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
                {loading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {[1, 2, 3].map(i => (
                            <div key={i} className="skeleton" style={{ height: 80, borderRadius: 10 }} />
                        ))}
                    </div>
                ) : notes.length === 0 ? (
                    <div className="empty-notes">
                        <span className="empty-icon"><BookOpen size={36} style={{ opacity: 0.4 }} /></span>
                        <p>No notes yet.</p>
                    </div>
                ) : (
                    notes.map(note => (
                        <NoteCard key={note.id} note={note} onDelete={() => handleDelete(note.id)} />
                    ))
                )}
            </div>
        </div>
    );
}

function NoteCard({ note, onDelete }) {
    const isVideoNote = note.note_type === 'video' || note.video_url;
    const thumb = isVideoNote ? (note.thumbnail_url || getYouTubeThumbnail(note.video_url)) : null;

    return (
        <div className="note-card" style={{ cursor: isVideoNote ? 'pointer' : 'default' }}
            onClick={() => {
                if (isVideoNote && note.video_url) {
                    let url = note.video_url;
                    if (note.timestamp) {
                        const seconds = Math.floor(note.timestamp);
                        const separator = url.includes('?') ? '&' : '?';
                        url = `${url}${separator}t=${seconds}`;
                    }
                    if (typeof chrome !== 'undefined' && chrome.tabs) {
                        chrome.tabs.create({ url });
                    } else {
                        window.open(url, '_blank');
                    }
                }
            }}
        >
            <button className="delete-note" onClick={e => { e.stopPropagation(); onDelete(); }}>✕</button>

            {isVideoNote && thumb && (
                <div className="note-video-preview">
                    <img src={thumb} alt="Thumbnail" />
                    {note.timestamp && (
                        <span className="note-timestamp-badge">{formatTime(note.timestamp)}</span>
                    )}
                </div>
            )}

            <div className="note-content-area">
                {isVideoNote && (
                    <div className="note-video-title">{note.video_title || 'Video Note'}</div>
                )}
                <div className="note-text">{note.content}</div>
                <div className="note-date">
                    {new Date(note.created_at).toLocaleDateString()}
                </div>
            </div>
        </div>
    );
}
