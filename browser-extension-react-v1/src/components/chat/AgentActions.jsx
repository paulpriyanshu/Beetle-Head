import React from 'react';

export default function AgentActions({ actions, onExecute }) {
    if (!actions || actions.length === 0) return null;

    return (
        <div className="agent-actions">
            {actions.map((action, i) => (
                <button
                    key={i}
                    className="agent-action-btn"
                    onClick={() => !action.auto && onExecute && onExecute(action)}
                    style={action.auto ? {
                        opacity: 0.75,
                        fontStyle: 'italic',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        cursor: 'default',
                        border: '1px solid transparent',
                    } : {}}
                >
                    {action.auto ? `✓ ${action.label}` : action.label}
                </button>
            ))}
        </div>
    );
}
