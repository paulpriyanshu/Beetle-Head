import { useEffect, useCallback, useRef } from 'react';
import { useApp } from '../store/AppContext';
import { API } from '../constants/api';
import { isRestrictedPage, downloadJSON } from '../utils/helpers';
import { extractDOMTree } from '../utils/domExtractor';

export function useContextSync() {
    const { state, dispatch } = useApp();
    const lastSavedUrl = useRef(null);
    const syncedUrls = useRef(new Set());
    const lastConvId = useRef(state.conversationId);

    // Clear cache if conversation changes
    if (lastConvId.current !== state.conversationId) {
        syncedUrls.current.clear();
        lastConvId.current = state.conversationId;
    }

    const saveContext = useCallback(async (tabId, url, title) => {
        if (!tabId || !url || isRestrictedPage(url)) return;

        // Skip if already synced for this conversation
        if (state.conversationId && syncedUrls.current.has(`${state.conversationId}-${url}`)) {
            console.log("Skipping redundant context save (already synced for this conv):", url);
            return;
        }

        try {
            const results = await chrome.scripting.executeScript({
                target: { tabId },
                func: extractDOMTree
            });

            const pageContext = results?.[0]?.result;

            if (pageContext) {
                const token = state.accessToken;
                if (!token) return;

                fetch(API.CONTEXT, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        url,
                        title,
                        raw_html: pageContext,
                        conversation_id: state.conversationId || undefined
                    })
                }).then(res => res.json()).then(data => {
                    console.log("Context saved successfully:", data);
                    // Add to cache on success
                    if (state.conversationId) {
                        syncedUrls.current.add(`${state.conversationId}-${url}`);
                    }
                }).catch(err => console.error("Context save failed:", err));
            }
        } catch (error) {
            console.error("Error extracting context for save:", error);
        }
    }, [state.accessToken, state.conversationId]);

    useEffect(() => {
        if (typeof chrome === 'undefined' || !chrome.tabs) return;

        const handleTabUpdated = (tabId, changeInfo, tab) => {
            if (changeInfo.status === 'complete' && tab.active) {
                if (!state.isManualContext && tab.url && !isRestrictedPage(tab.url)) {
                    dispatch({ type: 'SET_BROWSER_FOCUSED_TAB', tabId: tab.id, url: tab.url });
                }
                saveContext(tab.id, tab.url, tab.title);
            }
        };

        const handleTabActivated = async (activeInfo) => {
            try {
                const tab = await chrome.tabs.get(activeInfo.tabId);
                if (!state.isManualContext && tab.url && !isRestrictedPage(tab.url)) {
                    dispatch({ type: 'SET_BROWSER_FOCUSED_TAB', tabId: tab.id, url: tab.url });
                }
                saveContext(tab.id, tab.url, tab.title);
            } catch (err) {
                console.error("Tab activation error:", err);
            }
        };

        chrome.tabs.onUpdated.addListener(handleTabUpdated);
        chrome.tabs.onActivated.addListener(handleTabActivated);

        // Initial save for active tab
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                const tab = tabs[0];
                if (!state.isManualContext && tab.url && !isRestrictedPage(tab.url)) {
                    dispatch({ type: 'SET_BROWSER_FOCUSED_TAB', tabId: tab.id, url: tab.url });
                }
                // avoid duplicate initial saves if context already processed
                const cacheKey = `${state.conversationId}-${tab.url}`;
                if (lastSavedUrl.current !== tab.url || !syncedUrls.current.has(cacheKey)) {
                    saveContext(tab.id, tab.url, tab.title);
                    lastSavedUrl.current = tab.url;
                }
            }
        });

        return () => {
            chrome.tabs.onUpdated.removeListener(handleTabUpdated);
            chrome.tabs.onActivated.removeListener(handleTabActivated);
        };
    }, [saveContext, dispatch, state.isManualContext, state.conversationId]);

    return { saveContext };
}
