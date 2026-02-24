import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Clock, MessageSquare } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { API } from '../../constants/api';
import { formatTime } from '../../utils/helpers';

export default function HistoryView({ onBack, onLoadChat }) {
    const { state, dispatch } = useApp();
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadHistory = useCallback(async () => {
        setLoading(true);
        try {
            const token = state.accessToken;
            const res = await fetch(API.CONVERSATIONS, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            setHistory(data.conversations || []);
        } catch (e) {
            console.error('Load history failed:', e);
        } finally {
            setLoading(false);
        }
    }, [state.accessToken]);

    useEffect(() => { loadHistory(); }, [loadHistory]);

    const handleLoadChat = async (convId) => {
        try {
            const token = state.accessToken;
            const res = await fetch(`${API.CONVERSATIONS}/${convId}/messages`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.messages) {
                const msgs = data.messages.map(m => ({
                    id: Math.random(),
                    role: m.role === 'user' ? 'user' : 'bot',
                    content: m.content,
                }));
                dispatch({ type: 'SET_MESSAGES', messages: msgs });
                dispatch({ type: 'SET_CONVERSATION_ID', id: convId });
                dispatch({ type: 'SET_TAB', tab: 'chats' });
            }
        } catch (e) {
            console.error('Load chat failed:', e);
        }
    };

    return (
        <div
            id="chatHistoryView"
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {onBack && (
                        <button
                            id="btnBackToChats"
                            onClick={onBack}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}
                        >
                            <ArrowLeft size={16} />
                        </button>
                    )}
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Past Chats</h3>
                </div>
            </div>

            {/* List */}
            <div id="chatHistoryList" style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
                {loading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 70, borderRadius: 10 }} />)}
                    </div>
                ) : history.length === 0 ? (
                    <div className="empty-history">
                        <span className="empty-icon"><Clock size={36} style={{ opacity: 0.4 }} /></span>
                        <p>No conversations yet.</p>
                        <p style={{ fontSize: 12 }}>Start chatting to build your history!</p>
                    </div>
                ) : (
                    history.map(conv => (
                        <div
                            key={conv.id}
                            className="history-item"
                            onClick={() => handleLoadChat(conv.id)}
                        >
                            <div className="history-item-title">
                                <MessageSquare size={12} style={{ display: 'inline', marginRight: 6 }} />
                                {conv.title || 'Untitled Conversation'}
                            </div>
                            <div className="history-item-meta">
                                <span>{conv.message_count || 0} messages</span>
                                <span>{new Date(conv.created_at || conv.updatedAt).toLocaleDateString()}</span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
