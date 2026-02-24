// features/smartSnapshot.js
import { API, store } from '../state/store.js';
import { log, addSnapshotProgress, addSnapshotPreviewCard } from '../dom/elements.js';

export function initSmartSnapshot() {
    const btn = document.getElementById('btnSmartSnapshot');
    const modal = document.getElementById('smartSnapshotModal');
    const closeBtn = document.getElementById('snapClose');
    const backdrop = modal?.querySelector('.ss-modal-backdrop');

    if (!btn || !modal || !closeBtn) return;

    btn.addEventListener('click', () => {
        modal.classList.remove('hidden');
    });

    const closeModal = () => modal.classList.add('hidden');
    closeBtn.addEventListener('click', closeModal);
    backdrop?.addEventListener('click', closeModal);

    // Snapshot options
    const options = modal.querySelectorAll('.snap-option');
    options.forEach(opt => {
        opt.addEventListener('click', async () => {
            const format = opt.dataset.format;
            closeModal();
            await handleSnapshotRequest(format);
        });
    });
}

async function handleSnapshotRequest(format) {
    let progressCard = null;
    let taskId = null;

    try {
        log(`✨ Starting ${format.replace('_', ' ')} snapshot...`, "info");

        // 1. Get current tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) throw new Error("No active tab found");

        // 2. Extract DOM Data for the backend to parse
        log("🔍 Capturing current page...", "info");
        const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => document.documentElement.outerHTML
        });
        const rawHtml = results[0].result;

        // 3. Show progress bar
        progressCard = addSnapshotProgress(format);

        // 4. Initiate snapshot task
        const response = await fetch(API.SNAPSHOT, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                url: tab.url,
                format: format,
                rawHtml: rawHtml
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const { task_id } = await response.json();
        taskId = task_id;

        // 5. Poll for progress
        const pollInterval = setInterval(async () => {
            try {
                const statusResponse = await fetch(`${API.SNAPSHOT}/status/${taskId}`);
                const statusData = await statusResponse.json();

                // Update progress bar
                if (statusData.progress !== undefined && statusData.message) {
                    progressCard.update(statusData.progress, statusData.message);
                }

                // Check if completed
                if (statusData.status === 'completed') {
                    clearInterval(pollInterval);
                    progressCard.remove();

                    // Show preview card
                    addSnapshotPreviewCard(
                        statusData,
                        async () => {
                            // Download handler
                            const downloadUrl = `${API.SNAPSHOT}/download/${taskId}`;
                            const a = document.createElement('a');
                            a.href = downloadUrl;
                            a.download = statusData.filename || 'snapshot.pdf';
                            document.body.appendChild(a);
                            a.click();
                            a.remove();
                            log(`✅ ${format.replace('_', ' ')} downloaded!`, "success");
                        },
                        async () => {
                            // Delete handler
                            await fetch(`${API.SNAPSHOT}/${taskId}`, { method: 'DELETE' });
                            log(`🗑️ Snapshot deleted`, "info");
                            // Remove the preview card from DOM
                            document.querySelector('.snapshot-preview-card')?.remove();
                        }
                    );

                    log(`✅ ${format.replace('_', ' ')} snapshot ready!`, "success");
                } else if (statusData.status === 'error') {
                    clearInterval(pollInterval);
                    progressCard.remove();
                    throw new Error(statusData.error || 'Unknown error occurred');
                }
            } catch (pollError) {
                clearInterval(pollInterval);
                if (progressCard) progressCard.remove();
                throw pollError;
            }
        }, 1000); // Poll every second

    } catch (error) {
        console.error("Snapshot error:", error);
        log(`❌ Snapshot failed: ${error.message}`, "error");
        if (progressCard) progressCard.remove();
    }
}
