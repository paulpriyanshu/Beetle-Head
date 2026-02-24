import asyncio
from playwright.async_api import async_playwright, Browser, Page
from typing import Optional, Dict, Any
import json

class BrowserAutomation:
    def __init__(self):
        self.playwright = None
        self.browser: Optional[Browser] = None
        self.pages: Dict[str, Page] = {}
        self.context = None
        
    async def start(self, use_existing_browser: bool = True):
        """Initialize Playwright browser
        
        Args:
            use_existing_browser: If True, connects to existing Chrome instance
                                 If False, launches new browser
        """
        if not self.playwright:
            self.playwright = await async_playwright().start()
            
            if use_existing_browser:
                # Connect to existing Chrome instance via CDP
                # Chrome must be launched with --remote-debugging-port=9222
                try:
                    self.browser = await self.playwright.chromium.connect_over_cdp(
                        "http://localhost:9222"
                    )
                    self.context = self.browser.contexts[0]  # Use existing context
                    print("✅ Connected to existing Chrome browser")
                except Exception as e:
                    print(f"⚠️ Could not connect to existing browser: {e}")
                    print("💡 Launch Chrome with: chrome.exe --remote-debugging-port=9222")
                    # Fallback to new browser
                    await self._launch_new_browser()
            else:
                await self._launch_new_browser()
    
    async def _launch_new_browser(self):
        """Launch a new browser instance"""
        self.browser = await self.playwright.chromium.launch(
            headless=False,
            args=['--start-maximized']
        )
        self.context = await self.browser.new_context(viewport=None)
        print("✅ Launched new Chrome browser")
    
    async def stop(self):
        """Clean up resources"""
        # Don't close browser if we connected to existing one
        if self.context and hasattr(self.browser, '_is_connected'):
            # Only close context if it's a new browser
            pass
        if self.browser and not hasattr(self.browser, '_is_connected'):
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()
    
    async def get_or_create_page(self, url: str) -> Page:
        """Get existing page with URL or create new one"""
        # Check if page already exists
        for page in self.context.pages:
            if url in page.url:
                return page
        
        # Create new page
        page = await self.context.new_page()
        return page
    
    # ===== SPOTIFY AUTOMATIONS =====
    
    async def spotify_play_song(self, query: str) -> Dict[str, Any]:
        """Search and play a song on Spotify"""
        try:
            # Find or create Spotify tab
            page = None
            for p in self.context.pages:
                if "spotify.com" in p.url:
                    page = p
                    break
            
            if not page:
                page = await self.context.new_page()
            
            # Go to Spotify search
            search_url = f"https://open.spotify.com/search/{query.replace(' ', '%20')}"
            await page.goto(search_url)
            await page.wait_for_load_state("networkidle")
            await asyncio.sleep(2)
            
            # Click first song
            selectors = [
                'div[data-testid="tracklist-row"]:first-child',
                'div[data-testid="top-result-card"]',
                'a[href*="/track/"]',
            ]
            
            for selector in selectors:
                try:
                    await page.click(selector, timeout=3000)
                    break
                except:
                    continue
            
            # Bring page to front
            await page.bring_to_front()
            
            return {
                "success": True,
                "message": f"Playing '{query}' on Spotify",
                "url": page.url
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    # ===== NETFLIX AUTOMATIONS =====
    
    async def netflix_select_profile(self, profile_name: str = "Main") -> Dict[str, Any]:
        """Open Netflix and select a profile"""
        try:
            # Find or create Netflix tab
            page = None
            for p in self.context.pages:
                if "netflix.com" in p.url:
                    page = p
                    break
            
            if not page:
                page = await self.context.new_page()
            
            await page.goto("https://www.netflix.com/browse")
            await page.wait_for_load_state("networkidle")
            await asyncio.sleep(2)
            
            # Look for profile selection screen
            try:
                profile_selector = f'a[aria-label*="{profile_name}" i], span:has-text("{profile_name}")'
                await page.click(profile_selector, timeout=5000)
            except:
                await page.click('.profile-link:first-child, .profile-icon:first-child', timeout=5000)
            
            await page.wait_for_load_state("networkidle")
            await page.bring_to_front()
            
            return {
                "success": True,
                "message": f"Selected profile '{profile_name}' on Netflix",
                "url": page.url
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    # ===== YOUTUBE AUTOMATIONS =====
    
    async def youtube_latest_video(self, channel: str) -> Dict[str, Any]:
        """Open latest video from a YouTube channel"""
        try:
            # Find or create YouTube tab
            page = None
            for p in self.context.pages:
                if "youtube.com" in p.url:
                    page = p
                    break
            
            if not page:
                page = await self.context.new_page()
            
            channel = channel.replace('@', '')
            channel_url = f"https://www.youtube.com/@{channel}/videos"
            await page.goto(channel_url)
            await page.wait_for_load_state("networkidle")
            await asyncio.sleep(2)
            
            # Click first video
            await page.click('#video-title-link:first-child, a#video-title:first-child', timeout=5000)
            await page.wait_for_load_state("networkidle")
            await page.bring_to_front()
            
            return {
                "success": True,
                "message": f"Playing latest video from {channel}",
                "url": page.url
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    async def youtube_play_video(self, query: str) -> Dict[str, Any]:
        """Search and play a YouTube video"""
        try:
            # Find or create YouTube tab
            page = None
            for p in self.context.pages:
                if "youtube.com" in p.url:
                    page = p
                    break
            
            if not page:
                page = await self.context.new_page()
            
            search_url = f"https://www.youtube.com/results?search_query={query.replace(' ', '+')}"
            await page.goto(search_url)
            await page.wait_for_load_state("networkidle")
            await asyncio.sleep(2)
            
            # Click first video
            await page.click('a#video-title:first-child', timeout=5000)
            await page.wait_for_load_state("networkidle")
            await page.bring_to_front()
            
            return {
                "success": True,
                "message": f"Playing '{query}' on YouTube",
                "url": page.url
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    # ===== GENERIC AUTOMATIONS =====
    
    async def open_url(self, url: str) -> Dict[str, Any]:
        """Open any URL in existing or new tab"""
        try:
            page = await self.context.new_page()
            await page.goto(url)
            await page.wait_for_load_state("networkidle")
            await page.bring_to_front()
            
            return {
                "success": True,
                "message": f"Opened {url}",
                "url": page.url
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    async def execute_custom_script(self, url: str, script: str) -> Dict[str, Any]:
        """Execute custom JavaScript on a page"""
        try:
            # Find existing page or create new
            page = None
            for p in self.context.pages:
                if url in p.url:
                    page = p
                    break
            
            if not page:
                page = await self.context.new_page()
                await page.goto(url)
                await page.wait_for_load_state("networkidle")
            
            result = await page.evaluate(script)
            await page.bring_to_front()
            
            return {
                "success": True,
                "message": "Script executed",
                "result": result,
                "url": page.url
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

# ===== GLOBAL AUTOMATION INSTANCE =====
automation = BrowserAutomation()

async def execute_action(action: Dict[str, Any]) -> Dict[str, Any]:
    """Execute a single automation action"""
    
    # Ensure browser is started and connected
    await automation.start(use_existing_browser=True)
    
    action_type = action.get("type")
    
    if action_type == "spotify_play_song":
        return await automation.spotify_play_song(action.get("query", ""))
    
    elif action_type == "netflix_profile":
        return await automation.netflix_select_profile(action.get("profile", "Main"))
    
    elif action_type == "youtube_latest_video":
        return await automation.youtube_latest_video(action.get("channel", ""))
    
    elif action_type == "youtube_play_video":
        return await automation.youtube_play_video(action.get("query", ""))
    
    elif action_type == "open_url":
        return await automation.open_url(action.get("url", ""))
    
    elif action_type == "execute_script":
        return await automation.execute_custom_script(
            action.get("url", ""),
            action.get("script", "")
        )
    
    else:
        return {
            "success": False,
            "error": f"Unknown action type: {action_type}"
        }

async def execute_actions_sequence(actions: list) -> list:
    """Execute multiple actions in sequence"""
    results = []
    
    for action in actions:
        if action.get("auto"):
            result = await execute_action(action)
            results.append({
                "action": action,
                "result": result
            })
            
            # Small delay between actions
            await asyncio.sleep(1)
    
    return results