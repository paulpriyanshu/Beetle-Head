import React from 'react';
import { X, Monitor, FileCode } from 'lucide-react';
import { useApp } from '../../store/AppContext';

export default function ScreenshotModal() {
    const { state, dispatch } = useApp();

    if (!state.screenshotModalOpen) return null;

    const close = () => dispatch({ type: 'CLOSE_SCREENSHOT_MODAL' });

    const handleScreenshot = async (type) => {
        close();
        if (typeof chrome === 'undefined' || !chrome.runtime) return;
        chrome.runtime.sendMessage({ type: 'TAKE_SCREENSHOT', screenshotType: type });
    };

    return (
        <div
            className="modal-overlay"
            style={{
                position: 'fixed', inset: 0, zIndex: 10010,
                background: 'rgba(0,0,0,0.6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 16,
            }}
            onClick={close}
        >
            <div
                style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    borderRadius: 16,
                    padding: 20,
                    width: '100%',
                    maxWidth: 280,
                    animation: 'modalFadeIn 0.2s ease',
                }}
                onClick={e => e.stopPropagation()}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Screenshot</h3>
                    <button
                        onClick={close}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}
                    >
                        <X size={18} />
                    </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <button
                        className="snap-option"
                        onClick={() => handleScreenshot('visible')}
                    >
                        <span className="snap-icon"><Monitor size={24} /></span>
                        <span className="snap-text">
                            <span className="snap-title">Visible Screen</span>
                            <span className="snap-desc">Capture what's currently visible</span>
                        </span>
                    </button>
                    <button
                        className="snap-option"
                        onClick={() => handleScreenshot('fullpage')}
                    >
                        <span className="snap-icon"><FileCode size={24} /></span>
                        <span className="snap-text">
                            <span className="snap-title">Full Web Page</span>
                            <span className="snap-desc">Capture the entire scrollable page</span>
                        </span>
                    </button>
                </div>
            </div>
        </div>
    );
}
