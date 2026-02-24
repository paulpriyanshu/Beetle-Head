import { useCallback } from 'react';
import { useApp } from '../store/AppContext';
import { API } from '../constants/api';

export function useMedia() {
    const { state } = useApp();

    const fetchMedia = useCallback(async (filterType = 'all') => {
        const token = state.accessToken;
        const url = filterType === 'all' ? API.MEDIA : `${API.MEDIA}?file_type=${filterType}`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        return data.media || [];
    }, [state.accessToken]);

    const deleteMedia = useCallback(async (id) => {
        const token = state.accessToken;
        const res = await fetch(`${API.MEDIA}/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
        });
        return await res.json();
    }, [state.accessToken]);

    const uploadMedia = useCallback(async (base64Data, filename, fileType, source) => {
        const token = state.accessToken;
        const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
        const res = await fetch(API.MEDIA_UPLOAD, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ file_data: cleanBase64, filename, file_type: fileType, source })
        });
        return await res.json();
    }, [state.accessToken]);

    return { fetchMedia, deleteMedia, uploadMedia };
}
