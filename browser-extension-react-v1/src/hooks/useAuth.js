import { useCallback } from 'react';
import { useApp } from '../store/AppContext';

const CLIENT_ID = '921978485918-2uqrhk7g5ggvirst73b601mg3o6951at.apps.googleusercontent.com';

export function useAuth() {
    const { state, dispatch } = useApp();

    const fetchUserInfo = async (token) => {
        try {
            const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (!response.ok) throw new Error('Failed to fetch user info');
            return await response.json();
        } catch (error) {
            console.error('Error fetching user info:', error);
            return null;
        }
    };

    const authenticateWithBackend = useCallback(async (googleToken, googleUser) => {
        try {
            const backendRes = await fetch('http://localhost:8000/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ googleToken, user: googleUser })
            });
            const backendData = await backendRes.json();

            if (backendData.status === 'success') {
                const userData = {
                    name: backendData.user.name || googleUser?.name,
                    email: backendData.user.email || googleUser?.email,
                    picture: backendData.user.user_dp || googleUser?.picture,
                    backend: backendData.user
                };
                chrome.storage.local.set({ userData, access_token: backendData.access_token }, () => {
                    dispatch({ type: 'SET_AUTH', userData, token: backendData.access_token });
                });
            } else {
                console.error('Backend login failed:', backendData.message);
            }
        } catch (err) {
            console.error('Failed to authenticate with backend:', err);
        }
    }, [dispatch]);

    const checkAuthStatus = useCallback(() => {
        if (typeof chrome === 'undefined' || !chrome.storage) return;
        chrome.storage.local.get(['userData', 'access_token', 'userLoggedOut'], async (result) => {
            if (result.access_token) {
                dispatch({ type: 'SET_AUTH', userData: result.userData, token: result.access_token });
            }
            // Note: launchWebAuthFlow doesn't support silent re-auth as easily as getAuthToken.
            // We rely on the access_token stored in local storage for session persistence.
        });
    }, [dispatch]);

    const loginWithGoogle = useCallback(async () => {
        if (typeof chrome === 'undefined' || !chrome.identity) return;

        const redirectUri = chrome.identity.getRedirectURL();
        const scopes = [
            'https://www.googleapis.com/auth/userinfo.profile',
            'https://www.googleapis.com/auth/userinfo.email'
        ].join(' ');

        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
            `client_id=${CLIENT_ID}&` +
            `response_type=token&` +
            `redirect_uri=${encodeURIComponent(redirectUri)}&` +
            `scope=${encodeURIComponent(scopes)}`;

        chrome.storage.local.set({ userLoggedOut: false });

        chrome.identity.launchWebAuthFlow({
            url: authUrl,
            interactive: true
        }, async (responseUrl) => {
            if (chrome.runtime.lastError || !responseUrl) {
                console.error('Auth error:', chrome.runtime.lastError?.message);
                return;
            }

            // Parse token from hash fragment
            const url = new URL(responseUrl);
            const params = new URLSearchParams(url.hash.substring(1));
            const token = params.get('access_token');

            if (token) {
                const googleUser = await fetchUserInfo(token);
                await authenticateWithBackend(token, googleUser);
            } else {
                console.error('No token found in response URL');
            }
        });
    }, [authenticateWithBackend]);

    const logoutGoogle = useCallback(() => {
        if (typeof chrome === 'undefined') return;

        chrome.storage.local.get(['access_token'], async (result) => {
            const token = result.access_token;
            if (token) {
                try {
                    await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`);
                } catch (e) {
                    console.error('Token revocation failed:', e);
                }
            }

            try {
                fetch('http://localhost:8000/auth/logout', { method: 'POST' }).catch(() => { });
            } catch { }

            chrome.storage.local.remove(['userData', 'access_token'], () => {
                chrome.storage.local.set({ userLoggedOut: true }, () => {
                    dispatch({ type: 'CLEAR_AUTH' });
                });
            });
        });
    }, [dispatch]);

    return { checkAuthStatus, loginWithGoogle, logoutGoogle };
}
