import React, { useRef, useEffect } from 'react';
import { MessageSquare, StickyNote, Bot, History } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import ProfileDropdown from '../ui/ProfileDropdown';

const AVATAR_URL = 'https://www.gstatic.com/images/branding/product/1x/avatar_circle_blue_512dp.png';

export default function Header({ onMediaGallery, onAuthAction }) {
    const { state, dispatch } = useApp();
    const { activeTab, profileDropdownOpen, isAuthenticated, userData } = state;
    const dropdownRef = useRef(null);

    const tabs = [
        { id: 'chats', icon: MessageSquare, label: 'Chats' },
        { id: 'notes', icon: StickyNote, label: 'Notes' },
        { id: 'agent', icon: Bot, label: 'Agent' },
        { id: 'history', icon: History, label: 'History' },
    ];

    const handleTabClick = (tabId) => {
        if (tabId === 'agent') {
            dispatch({ type: 'SET_AGENT_MODE', value: true });
            dispatch({ type: 'SET_TAB', tab: 'chats' });
            return;
        }
        dispatch({ type: 'SET_TAB', tab: tabId });
    };

    // Close dropdown on outside click
    useEffect(() => {
        const handleClick = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                dispatch({ type: 'CLOSE_PROFILE_DROPDOWN' });
            }
        };
        document.addEventListener('click', handleClick);
        return () => document.removeEventListener('click', handleClick);
    }, [dispatch]);

    const avatarSrc = isAuthenticated && userData?.picture ? userData.picture : AVATAR_URL;
    const isAgentTabActive = state.agentMode;

    return (
        <header
            className="sidebar-header"
            style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '8px 12px',
                background: 'var(--bg-primary)',
                borderBottom: '1px solid var(--border)',
                flexShrink: 0,
                height: 64,
                zIndex: 10001,
            }}
        >
            <nav
                className="nav-tabs"
                style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: 4,
                    background: 'var(--bg-secondary)',
                    padding: 3,
                    borderRadius: 9,
                    flex: 1,
                    maxWidth: 360,
                    overflow: 'visible',
                }}
            >
                {tabs.map(({ id, icon: Icon, label }) => {
                    const isActive = id === 'agent' ? isAgentTabActive : activeTab === id;
                    return (
                        <button
                            key={id}
                            id={`btn${label}`}
                            data-tab={id}
                            onClick={() => handleTabClick(id)}
                            style={{
                                flex: 1,
                                background: isActive ? 'var(--bg-primary)' : 'none',
                                border: 'none',
                                fontSize: 11,
                                fontWeight: isActive ? 600 : 500,
                                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                                cursor: 'pointer',
                                padding: '6px 4px',
                                borderRadius: 8,
                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 2,
                                boxShadow: isActive ? '0 1px 3px var(--shadow)' : 'none',
                            }}
                        >
                            <span><Icon size={16} strokeWidth={2} /></span>
                            <span style={{ fontSize: 10, fontWeight: 600 }}>{label}</span>
                        </button>
                    );
                })}

                {/* Profile Tab */}
                <div
                    id="userProfile"
                    className="nav-tab nav-profile-tab"
                    style={{
                        flex: 1,
                        cursor: 'pointer',
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 2,
                        padding: '6px 4px',
                        borderRadius: 8,
                    }}
                    ref={dropdownRef}
                >
                    <span
                        id="profileToggle"
                        className="profile-pic-container"
                        onClick={(e) => {
                            e.stopPropagation();
                            dispatch({ type: 'TOGGLE_PROFILE_DROPDOWN' });
                        }}
                        style={{
                            width: 24, height: 24, borderRadius: '50%',
                            border: '2px solid var(--border)', overflow: 'hidden',
                            cursor: 'pointer', transition: 'all 0.2s',
                        }}
                    >
                        <img
                            id="userAvatar"
                            src={avatarSrc}
                            alt="User"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)' }}>Profile</span>

                    {profileDropdownOpen && (
                        <ProfileDropdown
                            onMediaGallery={() => {
                                dispatch({ type: 'CLOSE_PROFILE_DROPDOWN' });
                                onMediaGallery();
                            }}
                            onAuth={() => {
                                dispatch({ type: 'CLOSE_PROFILE_DROPDOWN' });
                                onAuthAction();
                            }}
                        />
                    )}
                </div>
            </nav>
        </header>
    );
}
