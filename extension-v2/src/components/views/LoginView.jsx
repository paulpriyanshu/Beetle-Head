import React from 'react';
import { LogIn, ZapIcon, ShieldCheck, Cloud } from 'lucide-react';

export default function LoginView({ onLogin }) {
    return (
        <div
            id="loginView"
            className="flex flex-col justify-center items-center text-center"
            style={{
                flex: 1,
                padding: '40px 20px',
                background: 'var(--bg-primary)',
                animation: 'fadeIn 0.5s ease'
            }}
        >
            <div style={{ width: '100%', maxWidth: '280px' }}>
                {/* Logo */}
                <div style={{ marginBottom: '24px' }}>
                    <ZapIcon
                        style={{ width: 48, height: 48, color: 'var(--accent)', margin: '0 auto 12px' }}
                        strokeWidth={2}
                    />
                    <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
                        Quick Open
                    </h1>
                </div>

                <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 32, lineHeight: 1.5 }}>
                    Your personal AI browser companion.
                </p>

                <button
                    id="btnLoginPrimary"
                    onClick={onLogin}
                    className="flex items-center justify-center gap-2 w-full cursor-pointer transition-all duration-200"
                    style={{
                        padding: '14px',
                        background: 'var(--accent)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '12px',
                        fontSize: '15px',
                        fontWeight: 600,
                        boxShadow: '0 4px 12px rgba(16, 163, 127, 0.2)'
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.background = 'var(--accent-hover)';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.background = 'var(--accent)';
                        e.currentTarget.style.transform = 'translateY(0)';
                    }}
                >
                    <LogIn size={18} />
                    <span>Login with Google</span>
                </button>

                {/* Features */}
                <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column', gap: 16, opacity: 0.8 }}>
                    <div className="flex items-center gap-3" style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                        <ShieldCheck size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                        <span>Secure JWT Auth</span>
                    </div>
                    <div className="flex items-center gap-3" style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                        <Cloud size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                        <span>Cloud Sync</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
