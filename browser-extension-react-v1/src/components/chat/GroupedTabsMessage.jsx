import React, { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { useApp } from '../../store/AppContext';

export default function GroupedTabsMessage({ groups }) {
    if (!groups || groups.length === 0) return null;

    const totalTabs = groups.reduce((sum, g) => sum + g.tabs.length, 0);

    return (
        <div className="grouped-tabs-msg" style={{ margin: '8px 0' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginBottom: '12px' }}>
                ✨ I've organized your {totalTabs} tabs into {groups.length} topic groups:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {groups.map((group, idx) => (
                    <TabGroup key={idx} group={group} />
                ))}
            </div>
        </div>
    );
}

function TabGroup({ group }) {
    const [expanded, setExpanded] = useState(false);

    const getGroupEmoji = (topic) => {
        const topicLower = topic.toLowerCase();
        if (topicLower.includes('shop') || topicLower.includes('buy')) return '🛍️';
        if (topicLower.includes('news')) return '📰';
        if (topicLower.includes('video') || topicLower.includes('youtube')) return '🎬';
        if (topicLower.includes('social')) return '💬';
        if (topicLower.includes('doc') || topicLower.includes('read')) return '📚';
        if (topicLower.includes('code') || topicLower.includes('dev')) return '💻';
        return '📂';
    };

    return (
        <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            overflow: 'hidden'
        }}>
            <button
                onClick={() => setExpanded(!expanded)}
                style={{
                    width: '100%',
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px' }}>{getGroupEmoji(group.topic)}</span>
                    <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>{group.topic}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{group.tabs.length} tabs</span>
                    {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </div>
            </button>

            {expanded && (
                <div style={{ padding: '4px 12px 12px', background: 'var(--bg-primary)', borderTop: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                        {group.tabs.map((tab, i) => (
                            <div key={i}
                                onClick={() => {
                                    if (typeof chrome !== 'undefined' && chrome.runtime) {
                                        chrome.runtime.sendMessage({ type: 'SWITCH_TO_TAB', tabId: tab.id });
                                    }
                                }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    padding: '6px',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    transition: '0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                            >
                                <img
                                    src={tab.favIconUrl || 'vite.svg'}
                                    style={{ width: '16px', height: '16px', borderRadius: '4px' }}
                                    alt=""
                                />
                                <div style={{ flex: 1, overflow: 'hidden' }}>
                                    <div style={{ fontSize: '12px', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {tab.title}
                                    </div>
                                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {new URL(tab.url).hostname}
                                    </div>
                                </div>
                                <ExternalLink size={10} style={{ color: 'var(--text-secondary)' }} />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
