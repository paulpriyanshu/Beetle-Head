import React from 'react';
import { Image, LogOut, LogIn } from 'lucide-react';
import { useApp } from '../../store/AppContext';

export default function ProfileDropdown({ onMediaGallery, onAuth }) {
    const { state } = useApp();
    const { userData, isAuthenticated } = state;

    return (
        <div className="profile-dropdown" onClick={e => e.stopPropagation()}>
            <div className="dropdown-header">
                <div className="user-email" id="displayEmail">
                    {isAuthenticated && userData ? userData.email : 'Not logged in'}
                </div>
            </div>

            <div className="dropdown-divider" />

            <button className="dropdown-item" id="btnMedia" onClick={onMediaGallery}>
                <Image size={16} />
                <span>Media Gallery</span>
            </button>

            <div className="dropdown-divider" />

            <button className="dropdown-item" id="btnAuth" onClick={onAuth}>
                {isAuthenticated ? <LogOut size={16} /> : <LogIn size={16} />}
                <span id="authText">{isAuthenticated ? 'Logout' : 'Login with Google'}</span>
            </button>
        </div>
    );
}
