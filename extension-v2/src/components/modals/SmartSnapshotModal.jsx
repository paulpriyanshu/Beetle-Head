import React from 'react';
import { X } from 'lucide-react';
import { useApp } from '../../store/AppContext';

const SNAPSHOT_TYPES = [
    { type: 'marketing_pdf', icon: '📊', title: 'Marketing PDF', desc: 'Vibrant, branded summary report' },
    { type: 'business_report', icon: '📋', title: 'Business Report', desc: 'Professional executive format' },
    { type: 'smart_pdf', icon: '📄', title: 'Smart PDF', desc: 'Clean, readable document' },
    { type: 'ms_word', icon: '📝', title: 'MS Word', desc: 'Editable .docx format' },
    { type: 'exact_image', icon: '🖼️', title: 'Exact Image', desc: 'Pixel-perfect PNG snapshot' },
    { type: 'markdown', icon: '📑', title: 'Markdown', desc: 'Structured markdown data' },
    { type: 'research_paper', icon: '🔬', title: 'Research Paper', desc: 'Academic IEEE style' },
    { type: 'ppt_slides', icon: '📓', title: 'PPT Slides', desc: 'Presentation-ready slides' },
];

export default function SmartSnapshotModal() {
    const { state, dispatch } = useApp();

    if (!state.smartSnapshotModalOpen) return null;

    const close = () => dispatch({ type: 'CLOSE_SMART_SNAPSHOT_MODAL' });

    const handleSnapshot = async (snapshotType) => {
        close();
        if (typeof chrome === 'undefined' || !chrome.runtime) return;
        chrome.runtime.sendMessage({ type: 'SMART_SNAPSHOT', snapshotType });
    };

    return (
        <div
            style={{
                position: 'fixed', inset: 0, zIndex: 10010,
                background: 'rgba(0,0,0,0.6)',
                display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            }}
            onClick={close}
        >
            <div
                style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    borderRadius: '16px 16px 0 0',
                    padding: 16,
                    width: '100%',
                    maxHeight: '80vh',
                    overflowY: 'auto',
                    animation: 'slideUp 0.25s ease',
                }}
                onClick={e => e.stopPropagation()}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Smart Snapshot</h3>
                    <button
                        onClick={close}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="snap-options-grid">
                    {SNAPSHOT_TYPES.map(({ type, icon, title, desc }) => (
                        <button key={type} className="snap-option" onClick={() => handleSnapshot(type)}>
                            <span className="snap-icon">{icon}</span>
                            <span className="snap-text">
                                <span className="snap-title">{title}</span>
                                <span className="snap-desc">{desc}</span>
                            </span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
