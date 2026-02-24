import React, { useState } from 'react';
import { Search, Globe } from 'lucide-react';
import { useApp } from '../../store/AppContext';

const COUNTRIES = [
    { code: 'in', name: 'India', flag: '🇮🇳' },
    { code: 'us', name: 'USA', flag: '🇺🇸' },
    { code: 'gb', name: 'UK', flag: '🇬🇧' },
    { code: 'ca', name: 'Canada', flag: '🇨🇦' },
    { code: 'au', name: 'Australia', flag: '🇦🇺' },
];

export default function NewsSearchInterface() {
    const { state, dispatch } = useApp();
    const [query, setQuery] = useState(state.newsData.lastQuery || '');
    const [country, setCountry] = useState(state.newsData.currentCountry || 'in');
    const [loading, setLoading] = useState(false);

    const handleSearch = async () => {
        setLoading(true);
        dispatch({ type: 'SET_NEWS_LOADING', value: true });

        if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.sendMessage({
                type: 'FETCH_NEWS',
                query,
                country
            }, (response) => {
                setLoading(false);
                if (response && response.success && response.data.results) {
                    dispatch({
                        type: 'SET_NEWS_ARTICLES',
                        articles: response.data.results,
                        country,
                        query
                    });
                } else {
                    dispatch({ type: 'SET_NEWS_LOADING', value: false });
                    console.error('Failed to fetch news:', response?.error);
                }
            });
        }
    };

    return (
        <div className="news-search-interface" style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '12px',
            margin: '8px 0',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                <span>📰</span> News Search
            </div>

            <div style={{ position: 'relative' }}>
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search news..."
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    style={{
                        width: '100%',
                        padding: '8px 32px 8px 12px',
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        color: 'var(--text-primary)',
                        fontSize: '13px',
                        outline: 'none'
                    }}
                />
                <Search size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            </div>

            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                {COUNTRIES.map((c) => (
                    <button
                        key={c.code}
                        onClick={() => setCountry(c.code)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            background: country === c.code ? 'var(--accent)' : 'var(--bg-primary)',
                            color: country === c.code ? 'white' : 'var(--text-secondary)',
                            border: '1px solid var(--border)',
                            fontSize: '11px',
                            whiteSpace: 'nowrap',
                            cursor: 'pointer',
                            transition: '0.2s'
                        }}
                    >
                        <span>{c.flag}</span> {c.name}
                    </button>
                ))}
            </div>

            <button
                onClick={handleSearch}
                disabled={loading}
                style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '8px',
                    background: 'var(--accent)',
                    color: 'white',
                    border: 'none',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.7 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                }}
            >
                {loading ? 'Searching...' : 'Search Top News'}
            </button>
        </div>
    );
}
