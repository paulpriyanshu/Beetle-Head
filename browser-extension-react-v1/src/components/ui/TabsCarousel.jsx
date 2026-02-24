import React, { useState, useEffect, useCallback } from 'react';
import { X, ChevronDown } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { groupTabsByDomain, getFaviconUrl, isRestrictedPage } from '../../utils/helpers';

export default function TabsCarousel({ onTabSelected }) {
    const { state, dispatch } = useApp();
    const { tabsCarouselOpen, tabsDrawerOpen, tabsDrawerData, activeContextTabId, browserFocusedTabId, isManualContext } = state;
    const [domains, setDomains] = useState({});

    const loadTabs = useCallback(async () => {
        if (typeof chrome === 'undefined' || !chrome.runtime) return;
        const response = await new Promise(resolve =>
            chrome.runtime.sendMessage({ type: 'GET_ALL_TABS', currentWindow: true }, r => resolve(r))
        );
        const tabs = (response?.tabs || []).filter(t => t.url && !isRestrictedPage(t.url) && t.title !== 'New Tab');
        const grouped = groupTabsByDomain(tabs);
        setDomains(grouped);
    }, []);

    useEffect(() => {
        if (tabsCarouselOpen) loadTabs();
    }, [tabsCarouselOpen, loadTabs]);

    const handleTabGroupClick = useCallback((domain, tabs) => {
        if (tabs.length === 1) {
            selectTab(tabs[0]);
        } else {
            dispatch({ type: 'OPEN_TABS_DRAWER', data: { domain, tabs, icon: '🌐' } });
        }
    }, [dispatch]);

    const selectTab = useCallback(async (tab) => {
        const isSelected = activeContextTabId === tab.id && isManualContext;
        if (isSelected) {
            dispatch({ type: 'CLEAR_CONTEXT' });
            return;
        }

        dispatch({ type: 'SET_CONTEXT', tabId: tab.id, content: null, url: tab.url });

        if (onTabSelected) {
            onTabSelected(tab.id, tab.url, tab.title);
        }
    }, [activeContextTabId, isManualContext, dispatch, onTabSelected]);

    if (!tabsCarouselOpen) return null;

    const sortedDomains = Object.entries(domains);

    return (
        <>
            <div className="tabs-carousel" id="tabsCarousel">
                {sortedDomains.map(([domain, tabs]) => {
                    const isSelected = tabs.some(t => t.id === activeContextTabId);
                    const isActive = tabs.some(t => t.id === browserFocusedTabId);
                    const firstTab = tabs[0];

                    return (
                        <div
                            key={domain}
                            className={`tab-carousel-group ${isSelected ? 'selected' : ''} ${isActive ? 'active' : ''}`}
                            onClick={() => handleTabGroupClick(domain, tabs)}
                        >
                            <img
                                src={firstTab.favIconUrl || getFaviconUrl(firstTab.url)}
                                className="group-favicon"
                                alt=""
                                onError={e => { e.target.style.display = 'none'; }}
                            />
                            <div className="group-info">
                                <span className="group-domain">{domain}</span>
                                <span className="group-count">{tabs.length}</span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Tabs Drawer (The "Nice Box") */}
            {tabsDrawerOpen && tabsDrawerData && (
                <div className="tabs-drawer-overlay">
                    <div className="tabs-drawer-backdrop" onClick={() => dispatch({ type: 'CLOSE_TABS_DRAWER' })} />
                    <div className="tabs-drawer-card">
                        <div className="tabs-drawer-header">
                            <div className="drawer-header-left">
                                <img
                                    src={getFaviconUrl(tabsDrawerData.tabs[0].url)}
                                    className="drawer-domain-icon"
                                    alt=""
                                />
                                <span className="drawer-domain-name">{tabsDrawerData.domain}</span>
                            </div>
                            <button className="drawer-close-x" onClick={() => dispatch({ type: 'CLOSE_TABS_DRAWER' })}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="tabs-drawer-content">
                            {tabsDrawerData.tabs.map(tab => {
                                const isSelected = activeContextTabId === tab.id;
                                const isActive = browserFocusedTabId === tab.id;
                                try {
                                    const hostname = new URL(tab.url).hostname;
                                    return (
                                        <div
                                            key={tab.id}
                                            className={`drawer-tab-item ${isSelected ? 'selected' : ''} ${isActive ? 'active' : ''}`}
                                            onClick={() => { selectTab(tab); dispatch({ type: 'CLOSE_TABS_DRAWER' }); }}
                                        >
                                            <img
                                                src={tab.favIconUrl || getFaviconUrl(tab.url)}
                                                className="tab-item-icon"
                                                alt=""
                                                onError={e => { e.target.style.display = 'none'; }}
                                            />
                                            <div className="tab-item-info">
                                                <div className="tab-item-title">{tab.title}</div>
                                                <div className="tab-item-url">{hostname}</div>
                                            </div>
                                        </div>
                                    );
                                } catch { return null; }
                            })}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
