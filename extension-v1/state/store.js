// ==================================================
// STATE MANAGEMENT MODULE
// Centralized application state
// ==================================================

class Store {
  constructor() {
    this.state = {
      agentMode: false,
      autoScroll: true,
      isUserScrolling: false,
      isRecording: false,
      isStreaming: false,
      domMode: false,
      conversationId: null,
      currentAbortController: null
    };
  }

  getState() {
    return this.state;
  }

  setState(updates) {
    this.state = { ...this.state, ...updates };
  }

  // Specific state methods
  setAgentMode(value) {
    this.state.agentMode = value;
  }

  setDomMode(value) {
    this.state.domMode = value;
  }

  setConversationId(value) {
    this.state.conversationId = value;
  }

  setAutoScroll(value) {
    this.state.autoScroll = value;
  }

  setRecording(value) {
    this.state.isRecording = value;
  }

  setStreaming(value) {
    this.state.isStreaming = value;
  }

  setAbortController(controller) {
    this.state.currentAbortController = controller;
  }

  abortCurrentStream() {
    if (this.state.currentAbortController) {
      this.state.currentAbortController.abort();
    }
  }
}

// ==================================================
// STORAGE HELPERS
// ==================================================

export const STORAGE_KEYS = {
  FORM_FIELDS: 'quickopen_detected_forms',
  FORM_VALUES: 'quickopen_form_values',
  CURRENT_FORM: 'quickopen_current_form'
};

export function saveToStorage(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error(`Storage save error for ${key}:`, error);
    return false;
  }
}

export function getFromStorage(key, defaultValue = null) {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
  } catch (error) {
    console.error(`Storage read error for ${key}:`, error);
    return defaultValue;
  }
}

export function removeFromStorage(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error(`Storage remove error for ${key}:`, error);
    return false;
  }
}

// ==================================================
// API ENDPOINTS
// ==================================================

export const API = {
  CHAT: "http://127.0.0.1:8000/generate/stream",
  AGENT: "http://127.0.0.1:8000/agent/stream",
  AGENT_STEP: "http://127.0.0.1:8000/agent/step",
  PREVIEW: "http://127.0.0.1:8000/preview",
  CUSTOMIZE_DOM: "http://127.0.0.1:8000/dom/customize",
  FILL_FORM: "http://127.0.0.1:8000/fill-form-from-chat",
  GENERATE_MANIFEST: "http://127.0.0.1:8000/agent/generate-manifest",
  CONVERSATIONS: "http://127.0.0.1:8000/conversations",
  NOTES: "http://127.0.0.1:8000/notes",
  SNAPSHOT: "http://127.0.0.1:8000/snapshot",
  MEDIA: "http://127.0.0.1:8000/media",
  CONTEXT: "http://127.0.0.1:8000/context/save"
};

// Create singleton instance
export const store = new Store();