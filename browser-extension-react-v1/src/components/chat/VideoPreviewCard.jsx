import React, { useState, useEffect } from 'react';
import { X, MessageSquare, StickyNote, Play, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { useNotes } from '../../hooks/useNotes';
import { extractVideoId } from '../../utils/helpers';

export default function VideoPreviewCard({ video, onSummarizeVideo, onSummarizePage, onClose }) {
    const { state, dispatch } = useApp();
    const { saveNote, deleteNote } = useNotes();
    const [showNotes, setShowNotes] = useState(false);
    const [noteText, setNoteText] = useState('');

    if (!video) return null;

    const videoId = extractVideoId(video.url);
    const videoState = state.videoStates[videoId] || {};
    const notes = state.videoNotes[videoId] || [];
    const currentTime = videoState.currentTime || 0;

    const formatTime = (seconds) => {
        if (!seconds && seconds !== 0) return '0:00';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const handleAction = (type) => {
        const msg = type === 'video'
            ? `Summarize this YouTube video: ${video.url}`
            : `Summarize this YouTube page: ${video.url}`;
        if (type === 'video' && onSummarizeVideo) onSummarizeVideo(msg);
        else if (type === 'page' && onSummarizePage) onSummarizePage(msg);
    };

    const handleSaveNote = async () => {
        if (!noteText.trim()) return;

        const timestamp = currentTime;
        const noteContent = noteText;
        const video_url = video.url;
        const video_title = video.title || 'YouTube Video';

        const note = {
            id: Date.now(),
            timestamp,
            content: noteContent,
            videoUrl: video_url
        };

        dispatch({ type: 'ADD_VIDEO_NOTE', videoId, note });
        setNoteText('');

        try {
            const result = await saveNote(noteContent, 'video', {
                video_url,
                video_title,
                timestamp: timestamp.toString() // Explicit string conversion
            });
            if (result && result.status === 'success') {
                // We could update the local note ID with the backend ID if needed
            }
        } catch (e) {
            console.error('❌ Failed to sync note to backend:', e);
        }

        // Also save to chrome storage for persistence
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.get(['all_notes'], (result) => {
                const allNotes = result.all_notes || [];
                chrome.storage.local.set({ all_notes: [...allNotes, { ...note, type: 'video' }] });
            });
        }
    };

    const handleSeek = (time) => {
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.sendMessage({ type: 'VIDEO_SEEK', time });
        }
    };

    const handleDeleteNote = async (noteId) => {
        dispatch({ type: 'DELETE_VIDEO_NOTE', videoId, noteId });

        // Try backend delete if id is not timestamp-based (or just try anyway)
        try {
            await deleteNote(noteId);
        } catch (e) {
            // Might fail if it's a local-only note id
        }

        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.get(['all_notes'], (result) => {
                const allNotes = result.all_notes || [];
                chrome.storage.local.set({ all_notes: allNotes.filter(n => n.id !== noteId) });
            });
        }
    };

    const thumb = video.thumbnail || (videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : '');

    return (
        <div className="video-preview-card" style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            overflow: 'hidden',
            margin: '8px 0',
            display: 'flex',
            flexDirection: 'column'
        }}>
            <div style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: '16px' }}>🎥</span>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: 600, textTransform: 'uppercase' }}>YouTube Detected</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Ready to summarize or take notes</div>
                </div>
                {onClose && (
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}>
                        <X size={14} />
                    </button>
                )}
            </div>

            <div style={{ padding: '12px', display: 'flex', gap: '12px' }}>
                <div style={{ width: '80px', height: '60px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
                    <img src={thumb} alt={video.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                        <Play size={16} />
                    </div>
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {video.title || 'YouTube Video'}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {video.channel || 'Video'} • {formatTime(currentTime)} / {formatTime(videoState.duration)}
                    </div>
                </div>
            </div>

            <div style={{ padding: '0 12px 12px 12px', display: 'flex', gap: '8px' }}>
                <button
                    onClick={() => handleAction('video')}
                    style={{
                        flex: 1,
                        padding: '8px',
                        borderRadius: '8px',
                        background: 'var(--accent)',
                        color: 'white',
                        border: 'none',
                        fontSize: '12px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                    }}
                >
                    <MessageSquare size={14} /> Summarize
                </button>
                <button
                    onClick={() => setShowNotes(!showNotes)}
                    style={{
                        flex: 1,
                        padding: '8px',
                        borderRadius: '8px',
                        background: 'var(--bg-primary)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border)',
                        fontSize: '12px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                    }}
                >
                    <StickyNote size={14} /> Notes {notes.length > 0 && `(${notes.length})`} {showNotes ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
            </div>

            {showNotes && (
                <div style={{ padding: '12px', borderTop: '1px solid var(--border)', background: 'var(--bg-primary)' }}>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                        <input
                            type="text"
                            value={noteText}
                            onChange={(e) => setNoteText(e.target.value)}
                            placeholder={`Note at ${formatTime(currentTime)}...`}
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveNote()}
                            style={{
                                flex: 1,
                                padding: '6px 10px',
                                borderRadius: '6px',
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border)',
                                color: 'var(--text-primary)',
                                fontSize: '12px',
                                outline: 'none'
                            }}
                        />
                        <button
                            onClick={handleSaveNote}
                            style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                background: 'var(--accent)',
                                color: 'white',
                                border: 'none',
                                fontSize: '12px',
                                fontWeight: 500,
                                cursor: 'pointer'
                            }}
                        >
                            Save
                        </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '150px', overflowY: 'auto' }}>
                        {notes.length === 0 ? (
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textAlign: 'center', padding: '10px' }}>
                                No notes yet.
                            </div>
                        ) : (
                            notes.map((note) => (
                                <div key={note.id} style={{
                                    display: 'flex',
                                    gap: '8px',
                                    padding: '8px',
                                    background: 'var(--bg-secondary)',
                                    borderRadius: '6px',
                                    border: '1px solid var(--border)',
                                    alignItems: 'flex-start'
                                }}>
                                    <button
                                        onClick={() => handleSeek(note.timestamp)}
                                        style={{
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            background: 'var(--accent)',
                                            color: 'white',
                                            border: 'none',
                                            fontSize: '10px',
                                            cursor: 'pointer',
                                            flexShrink: 0
                                        }}
                                    >
                                        {formatTime(note.timestamp)}
                                    </button>
                                    <div style={{ flex: 1, fontSize: '11px', color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                                        {note.content || note.text}
                                    </div>
                                    <button
                                        onClick={() => handleDeleteNote(note.id)}
                                        style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px' }}
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
