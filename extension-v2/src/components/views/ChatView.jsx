import React, { useRef, useEffect, useCallback } from 'react';
import { Maximize2 } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import MessageBubble from '../chat/MessageBubble';
import VideoPreviewCard from '../chat/VideoPreviewCard';
import SystemStatusMessage from '../chat/SystemStatusMessage';
import TypingIndicator from '../chat/TypingIndicator';
import NewsSearchInterface from '../chat/NewsSearchInterface';
import NewsCard from '../chat/NewsCard';
import GroupedTabsMessage from '../chat/GroupedTabsMessage';

export default function ChatView({ onSendMessage }) {
    const { state, dispatch } = useApp();
    const { messages, isStreaming, autoScroll } = state;
    const messagesEndRef = useRef(null);
    const messagesRef = useRef(null);

    // Auto-scroll
    useEffect(() => {
        if (autoScroll && messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, autoScroll, isStreaming]);

    const handleScroll = useCallback(() => {
        if (!messagesRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = messagesRef.current;
        const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
        dispatch({ type: 'SET_AUTO_SCROLL', value: isAtBottom });
    }, [dispatch]);

    return (
        <div
            id="messages"
            ref={messagesRef}
            onScroll={handleScroll}
            style={{
                flex: 1,
                overflowY: 'auto',
                padding: '12px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 0,
                background: 'var(--bg-primary)',
            }}
        >
            {/* Initial greeting */}
            {messages.length === 0 && !isStreaming && (
                <div style={{ color: 'var(--text-secondary)', fontSize: 14, padding: '4px 0 12px' }}>
                    How can I help you today?
                </div>
            )}

            {/* Message list */}
            {messages.map((msg) => {
                if (msg.role === 'system' && msg.videoPreview) {
                    return (
                        <VideoPreviewCard
                            key={msg.id}
                            video={msg.videoPreview}
                            onSummarizeVideo={onSendMessage}
                            onSummarizePage={onSendMessage}
                        />
                    );
                }
                if (msg.role === 'system' && msg.type === 'news-search') {
                    return (
                        <div key={msg.id}>
                            <NewsSearchInterface />
                            {state.newsData.articles.length > 0 && (
                                <div style={{ marginTop: '12px' }}>
                                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', padding: '0 4px' }}>
                                        Latest Results:
                                    </div>
                                    {state.newsData.articles.map((article, idx) => (
                                        <NewsCard key={`${msg.id}-art-${idx}`} article={article} onAskAI={onSendMessage} />
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                }
                if (msg.role === 'tabs-grouped' || msg.groups) {
                    return (
                        <GroupedTabsMessage key={msg.id} groups={msg.groups} />
                    );
                }
                if (msg.role === 'system-status') {
                    return (
                        <SystemStatusMessage key={msg.id} content={msg.content} />
                    );
                }
                if (msg.role === 'tab-preview' && msg.tabData) {
                    return (
                        <div key={msg.id} className="tab-preview-msg" style={{
                            margin: '8px 0',
                            padding: '12px',
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border)',
                            borderRadius: '12px',
                            display: 'flex',
                            gap: '12px',
                            alignItems: 'center'
                        }}>
                            <img
                                src={msg.tabData.favIconUrl || 'vite.svg'}
                                style={{ width: 32, height: 32, borderRadius: '6px', objectFit: 'cover' }}
                                alt="favicon"
                            />
                            <div style={{ flex: 1, overflow: 'hidden' }}>
                                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {msg.tabData.title}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {msg.tabData.url}
                                </div>
                            </div>
                        </div>
                    );
                }
                return (
                    <MessageBubble key={msg.id} message={msg} onSendMessage={onSendMessage} />
                );
            })}

            {/* Streaming indicator on a new bot turn */}
            {isStreaming && messages.length > 0 && messages[messages.length - 1]?.role === 'user' && (
                <div style={{ padding: '4px 0 12px' }}>
                    <TypingIndicator />
                </div>
            )}

            <div ref={messagesEndRef} />
        </div>
    );
}
