// DOM Executor - provides functions for DOM manipulation
// Functions are available globally for content.js

console.log("✅ DOM Executor loaded");

// ===============================
// MAIN EXECUTOR
// ===============================
async function executeDOMStep(step, context = {}) {
  switch (step.type) {
    case "SCRAPE_SEARCH_RESULTS":
      return scrapeSearchResults(step);

    case "SCROLL_AND_FIND":
      return scrollAndFind(step);

    case "SCRAPE_AND_OPEN_YOUTUBE_RESULTS":
    case "SCRAPE_YOUTUBE_RESULTS": // Handle both variations if needed
      return scrapeAndOpenYouTube(step);

    case "ANALYZE_PAGE":
      return analyzePage(step);

    case "NAVIGATE_TO":
      // Navigation is handled at background level usually, 
      // but we return success if we are already here.
      return { success: true, url: window.location.href };

    case "WAIT":
      return wait(step.ms);

    case "EXECUTE_MICRO_ACTIONS":
      return executeMicroActions(step.actions);

    default:
      throw new Error(`Unknown DOM step: ${step.type}`);
  }
}

// ===============================
// MICRO ACTIONS EXECUTOR
// ===============================
async function executeMicroActions(actions) {
  console.log(`⚡ Executing ${actions.length} micro actions`);
  const results = [];

  for (const action of actions) {
    console.log(`  🔹 Action: ${action.type}`, action);
    try {
      if (action.type === 'click') {
        const el = document.querySelector(action.selector);
        if (el) {
          el.click();
          await wait(500);
        } else {
          throw new Error(`Element not found: ${action.selector}`);
        }
      }
      else if (action.type === 'type') {
        const el = document.querySelector(action.selector);
        if (el) {
          el.focus();
          el.value = action.value;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          await wait(300);
        } else {
          throw new Error(`Element not found: ${action.selector}`);
        }
      }
      else if (action.type === 'scroll') {
        const amount = action.direction === 'up' ? -(action.amount || 500) : (action.amount || 500);
        window.scrollBy({ top: amount, behavior: "smooth" });
        await wait(600);
      }
      else if (action.type === 'extract') {
        const el = document.querySelector(action.selector);
        const val = el ? el.innerText : null;
        console.log(`  📝 Extracted ${action.variable}: ${val}`);
        // In a real scenario, we'd return this data
      }
      else if (action.type === 'wait') {
        await wait(action.duration || 1000);
      }
      else if (action.type === 'finish') {
        console.log("✅ Goal achieved (AI confirmed)");
        return { finished: true, results };
      }

      results.push({ success: true, action });
    } catch (e) {
      console.warn(`⚠️ Action failed: ${action.type}`, e);
      results.push({ success: false, error: e.message, action });
    }
  }
  return { finished: false, results };
}

// ===============================
// PAGE ANALYZER
// ===============================
async function analyzePage(step) {
  console.log("📄 Analyzing page content...");

  // Wait for body to be populated
  await waitForDOMStable(2000);

  const title = document.title;
  const url = window.location.href;

  // Simple extraction for now
  // In a real agent, we might use Readability.js or similar
  const text = document.body.innerText
    .replace(/\s+/g, ' ')
    .substring(0, 15000); // Cap at 15k chars for token limits

  console.log(`✅ Extracted ${text.length} chars from ${title}`);

  return {
    title,
    url,
    content: text,
    timestamp: new Date().toISOString()
  };
}

// ===============================
// SEARCH SCRAPERS
// ===============================
// ===============================
// SEARCH SCRAPERS
// ===============================
async function scrapeSearchResults(step) {
  console.log("🔍 Scraping Google Search Results...");
  await waitForElement('div.g', 10000); // Wait up to 10s for results

  const results = [];
  // Use multiple potential selectors for Google results
  const selector = "div.g, .tF2Cxc, .yuRUbf, .MjjYud";
  const nodes = document.querySelectorAll(selector);
  console.log(`🔍 Found ${nodes.length} nodes with selector: ${selector}`);

  const uniqueLinks = new Set();

  for (let i = 0; i < nodes.length; i++) {
    if (results.length >= (step.batchSize || 10)) break;

    const el = nodes[i];

    const linkEl = el.querySelector("a");
    const link = linkEl?.href;
    const title = el.querySelector("h3")?.innerText || linkEl?.innerText;
    const desc = el.querySelector(".VwiC3b, .IsZvec, .lyLwlc")?.innerText || "";

    // Basic filtering to ensure it's a real result
    if (link && title && link.startsWith('http') && !uniqueLinks.has(link)) {
      // Filter out internal Google links if possible, though 'div.g' usually contains organic results
      if (link.includes('google.com/search') || link.includes('google.com/url')) continue;

      uniqueLinks.add(link);
      results.push({ title, url: link, description: desc });
    }
  }

  console.log(`✅ Scraped ${results.length} valid results`);
  return results;
}

async function scrollAndFind(step) {
  const keywords = step.keywords.map(k => k.toLowerCase());
  let found = false;

  for (let i = 0; i < step.maxScrolls; i++) {
    const bodyText = document.body.innerText.toLowerCase();

    if (keywords.some(k => bodyText.includes(k))) {
      found = true;
      break;
    }

    window.scrollBy({ top: window.innerHeight, behavior: "smooth" });
    await wait(1200);
  }

  return { found };
}

// ===============================
// YOUTUBE SCRAPER
// ===============================
// ===============================
// YOUTUBE SCRAPER
// ===============================
async function scrapeAndOpenYouTube(step) {
  console.log(`🎥 Scraping and opening YouTube videos (max: ${step.maxVideos})...`);
  await waitForElement('ytd-video-renderer', 10000);

  const videos = [];
  const items = document.querySelectorAll("ytd-video-renderer");

  console.log(`🎥 Found ${items.length} total video results`);

  for (let i = 0; i < items.length && videos.length < step.maxVideos; i++) {
    const el = items[i];

    const titleEl = el.querySelector("#video-title");
    const title = titleEl?.innerText;
    const url = titleEl?.href;
    const viewsText = el.querySelector("#metadata-line span")?.innerText || "0";

    const views = parseViews(viewsText);

    // Check if video matches criteria
    const criteria = step.criteria || {};
    const meetsViewsThreshold = !criteria.minViews || views >= criteria.minViews;
    const matchesKeywords = !criteria.keywords || criteria.keywords.length === 0 ||
      criteria.keywords.some(k =>
        title?.toLowerCase().includes(k.toLowerCase())
      );

    if (url && title && meetsViewsThreshold && matchesKeywords) {
      videos.push({ title, url, views });

      console.log(`  🎬 Opening video ${videos.length}: "${title.substring(0, 50)}..."`);

      // Use message to background to open tab reliably
      chrome.runtime.sendMessage({
        type: "OPEN_TAB",
        url: url
      });

      await wait(800);
    }
  }

  console.log(`✅ Opened ${videos.length} YouTube videos`);
  return videos;
}

function parseViews(text) {
  if (text.includes("M")) return parseFloat(text) * 1_000_000;
  if (text.includes("K")) return parseFloat(text) * 1_000;
  return parseInt(text.replace(/\D/g, "")) || 0;
}

// ===============================
// UTILITIES
// ===============================
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function waitForElement(selector, timeout = 5000) {
  return new Promise(resolve => {
    if (document.querySelector(selector)) {
      return resolve(document.querySelector(selector));
    }

    const observer = new MutationObserver(() => {
      if (document.querySelector(selector)) {
        observer.disconnect();
        resolve(document.querySelector(selector));
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeout);
  });
}

async function waitForDOMStable(timeout = 8000) {
  return new Promise(resolve => {
    let timer;
    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        observer.disconnect();
        resolve();
      }, 500);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    setTimeout(() => {
      observer.disconnect();
      resolve();
    }, timeout);
  });
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ===============================
// STEP RUNNER
// ===============================
async function runDOMSteps(steps, context = {}) {
  const results = [];

  for (const step of steps) {
    console.log("▶ Executing DOM step:", step.type);

    try {
      const result = await executeDOMStep(step, context);
      results.push({ step: step.id, result, success: true });
    } catch (e) {
      console.error(`❌ Error in step ${step.id}:`, e);
      results.push({ step: step.id, error: e.message, success: false });
    }
  }

  return results;
}

// Export for usage if module system allows, or attach to window
window.DOMExecutor = {
  executeDOMStep,
  runDOMSteps
};
