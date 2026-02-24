import React from 'react';
import { ExternalLink, MessageSquare } from 'lucide-react';

export default function NewsCard({ article, onAskAI }) {
    if (!article) return null;

    return (
        <div className="news-card" style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            overflow: 'hidden',
            margin: '8px 0',
            transition: '0.3s',
            display: 'flex',
            flexDirection: 'column'
        }}>
            {article.image_url && (
                <div style={{ width: '100%', height: '120px', overflow: 'hidden' }}>
                    <img src={article.image_url} alt={article.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
            )}

            <div style={{ padding: '12px' }}>
                <div style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>
                    {article.source_id?.replace('_', ' ') || 'NEWS'}
                </div>

                <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px 0', lineHeight: '1.4' }}>
                    {article.title}
                </h3>

                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 12px 0', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {article.description || article.content?.substring(0, 150) + '...'}
                </p>

                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={() => onAskAI(`Tell me more about this news: "${article.title}"\n\nLink: ${article.link}`)}
                        style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            padding: '6px 0',
                            borderRadius: '6px',
                            background: 'var(--bg-primary)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border)',
                            fontSize: '11px',
                            fontWeight: 500,
                            cursor: 'pointer'
                        }}
                    >
                        <MessageSquare size={12} /> Ask AI
                    </button>

                    <a
                        href={article.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            padding: '6px 0',
                            borderRadius: '6px',
                            background: 'var(--bg-primary)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border)',
                            fontSize: '11px',
                            fontWeight: 500,
                            textDecoration: 'none',
                            cursor: 'pointer'
                        }}
                    >
                        <ExternalLink size={12} /> Read Full
                    </a>
                </div>
            </div>
        </div>
    );
}
