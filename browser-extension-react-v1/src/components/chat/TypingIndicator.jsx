import React from 'react';

export default function TypingIndicator() {
    return (
        <div
            className="typing"
            style={{
                display: 'inline-flex',
                gap: 4,
                padding: '8px 4px',
                alignItems: 'center',
            }}
        >
            {[0, 0.2, 0.4].map((delay, i) => (
                <span
                    key={i}
                    style={{
                        width: 6,
                        height: 6,
                        background: 'var(--text-secondary)',
                        borderRadius: '50%',
                        animation: `typingPulse 1.4s infinite ease-in-out ${delay}s`,
                    }}
                />
            ))}
        </div>
    );
}
