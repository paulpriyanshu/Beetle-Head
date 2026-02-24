import React from 'react';

export default function SystemStatusMessage({ content }) {
    // Add icon based on content
    let icon = "⚙️";
    if (content.includes("✅")) icon = "✅";
    if (content.includes("❌")) icon = "❌";
    if (content.includes("🚀")) icon = "🚀";
    if (content.includes("🔍")) icon = "🔍";
    if (content.includes("🔗")) icon = "🔗";
    if (content.includes("📄")) icon = "📄";

    return (
        <div className="system-status-msg" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px' }}>{icon}</span>
            <div className="system-status-text">{content}</div>
        </div>
    );
}
