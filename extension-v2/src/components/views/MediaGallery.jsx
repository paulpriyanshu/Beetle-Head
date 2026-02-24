import React, { useState, useEffect, useCallback } from 'react';
import { Download, Trash2, ImageOff } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { useMedia } from '../../hooks/useMedia';
import { getFileIcon } from '../../utils/helpers';

const FILTERS = ['all', 'image', 'pdf', 'docx'];

export default function MediaGallery() {
    const { state } = useApp();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const { fetchMedia, deleteMedia } = useMedia();

    const loadMedia = useCallback(async (f = 'all') => {
        setLoading(true);
        try {
            const data = await fetchMedia(f);
            setItems(data);
        } catch (e) {
            console.error('Load media failed:', e);
        } finally {
            setLoading(false);
        }
    }, [fetchMedia]);

    useEffect(() => { loadMedia(filter); }, [filter]);

    const handleDownload = (url, filename) => {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
    };

    const handleDelete = async (id) => {
        try {
            await deleteMedia(id);
            setItems(prev => prev.filter(item => item.id !== id));
        } catch (e) {
            console.error('Delete failed:', e);
        }
    };

    return (
        <div
            id="mediaTab"
            style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                background: 'var(--bg-primary)',
            }}
        >
            {/* Header */}
            <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>
                    Media Gallery
                </h3>
                {/* Filter buttons */}
                <div style={{ display: 'flex', gap: 6 }}>
                    {FILTERS.map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            style={{
                                padding: '4px 12px',
                                borderRadius: 20,
                                border: '1px solid',
                                borderColor: filter === f ? 'var(--accent)' : 'var(--border)',
                                background: filter === f ? 'rgba(16,163,127,0.1)' : 'none',
                                color: filter === f ? 'var(--accent)' : 'var(--text-secondary)',
                                fontSize: 12,
                                fontWeight: 500,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                textTransform: 'capitalize',
                            }}
                        >
                            {f === 'all' ? 'All' : f.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            {/* Grid */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
                {loading ? (
                    <div className="media-grid">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
                                <div className="skeleton" style={{ aspectRatio: 1 }} />
                                <div className="skeleton" style={{ height: 12, margin: '8px 8px', borderRadius: 4 }} />
                            </div>
                        ))}
                    </div>
                ) : items.length === 0 ? (
                    <div className="empty-media">
                        <span className="empty-icon"><ImageOff size={36} style={{ opacity: 0.4 }} /></span>
                        <p>No media files yet.</p>
                        <p style={{ fontSize: 12 }}>Upload files using the + menu below.</p>
                    </div>
                ) : (
                    <div id="mediaGrid" className="media-grid">
                        {items.map(item => (
                            <div
                                key={item.id}
                                className="media-item"
                                onClick={() => window.open(item.file_url, '_blank')}
                            >
                                {item.file_type === 'image' ? (
                                    <img src={item.file_url} alt={item.original_filename} loading="lazy" />
                                ) : (
                                    <div className="media-icon-large">{getFileIcon(item.file_type)}</div>
                                )}
                                <div className="item-overlay">
                                    <button
                                        className="item-action-btn"
                                        onClick={e => { e.stopPropagation(); handleDownload(item.file_url, item.original_filename); }}
                                        title="Download"
                                    >
                                        <Download size={12} />
                                    </button>
                                    <button
                                        className="item-action-btn"
                                        onClick={e => { e.stopPropagation(); handleDelete(item.id); }}
                                        title="Delete"
                                        style={{ background: 'rgba(239,68,68,0.7)' }}
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                                <div className="item-info">
                                    <div className="item-name">{item.original_filename}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
