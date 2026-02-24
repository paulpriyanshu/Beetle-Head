import React from 'react';

export default function RichContent({ blocks, onAction }) {
    if (!blocks) return null;

    const executeAction = (type, query, target) => {
        const urls = {
            youtube: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
            amazon: `https://www.amazon.in/s?k=${encodeURIComponent(query)}`,
            flipkart: `https://www.flipkart.com/search?q=${encodeURIComponent(query)}`,
            spotify: `https://open.spotify.com/search/${encodeURIComponent(query)}`,
            web: `https://www.google.com/search?q=${encodeURIComponent(query)}`
        };
        const url = urls[target] || urls.web;
        if (typeof chrome !== 'undefined' && chrome.tabs) {
            chrome.tabs.create({ url });
        } else {
            window.open(url, '_blank');
        }
    };

    return (
        <div>
            {blocks.products?.length > 0 && (
                <div>
                    <div className="content-section-header">🛍️ Product Recommendations</div>
                    <div className="product-cards">
                        {blocks.products.map((p, i) => (
                            <div key={i} className="product-card">
                                <div className="product-title">{p.title}</div>
                                {p.price && <div className="product-price">{p.price}</div>}
                                <div className="product-reason">{p.reason}</div>
                                <button
                                    className="product-btn"
                                    onClick={() => executeAction('search', p.query, p.platform)}
                                >
                                    View on {p.platform}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {blocks.youtube_videos?.length > 0 && (
                <div>
                    <div className="content-section-header">🎥 Related Videos</div>
                    <div className="youtube-cards">
                        {blocks.youtube_videos.map((v, i) => (
                            <div
                                key={i}
                                className="youtube-card"
                                onClick={() => executeAction('search', v.query, 'youtube')}
                            >
                                <div className="yt-icon">▶</div>
                                <div className="yt-content">
                                    <div className="yt-title">{v.title}</div>
                                    <div className="yt-reason">{v.reason}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {blocks.images?.length > 0 && (
                <div>
                    <div className="content-section-header">🖼️ Visual Gallery</div>
                    <div className="image-carousel">
                        {blocks.images.map((img, i) => (
                            <div key={i} className="image-wrapper">
                                <img
                                    src={img.url || img.src}
                                    alt={img.caption || img.alt || 'Image'}
                                    loading="lazy"
                                    onError={e => e.currentTarget.parentElement.remove()}
                                />
                                <div className="image-caption">{img.caption || img.alt || 'Image'}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
