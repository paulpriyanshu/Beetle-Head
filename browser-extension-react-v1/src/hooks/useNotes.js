import { useCallback } from 'react';
import { useApp } from '../store/AppContext';
import { API } from '../constants/api';

export function useNotes() {
    const { state } = useApp();

    const fetchNotes = useCallback(async () => {
        const token = state.accessToken;
        const res = await fetch(API.NOTES, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        return data.notes || [];
    }, [state.accessToken]);

    const saveNote = useCallback(async (content, noteType = 'general', extraData = {}) => {
        const token = state.accessToken;
        console.log('📝 Saving note to backend:', { content, noteType, extraData });
        const res = await fetch(API.NOTES, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
                content,
                note_type: noteType,
                created_at: new Date().toISOString(),
                ...extraData
            })
        });
        const data = await res.json();
        if (res.ok) {
            console.log('✅ Note saved successfully:', data);
        } else {
            console.error('❌ Failed to save note:', data);
        }
        return data;
    }, [state.accessToken]);

    const deleteNote = useCallback(async (id) => {
        const token = state.accessToken;
        const res = await fetch(`${API.NOTES}/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
        });
        return await res.json();
    }, [state.accessToken]);

    return { fetchNotes, saveNote, deleteNote };
}
