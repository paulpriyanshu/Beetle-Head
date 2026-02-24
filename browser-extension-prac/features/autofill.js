// ==================================================
// AUTOFILL FEATURE MODULE
// Form detection and auto-filling
// ==================================================

import { log, DOM, scrollToBottom } from '../dom/elements.js';
import { STORAGE_KEYS, saveToStorage, getFromStorage, API } from '../state/store.js';

// ==================================================
// INTENT DETECTION
// ==================================================

export function detectFormFillIntent(text) {
  const fillKeywords = [
    'fill this form', 'fill the form', 'fill form',
    'auto fill', 'autofill', 'populate form',
    'enter my details', 'use my info', 'my information is',
    'fill it with', 'complete the form', 'submit form with',
    'fill with', 'my name is', 'my email is'
  ];
  
  const lowerText = text.toLowerCase();
  return fillKeywords.some(keyword => lowerText.includes(keyword));
}

// ==================================================
// STORAGE FUNCTIONS
// ==================================================

export function saveDetectedForms(formData, url) {
  try {
    const stored = getFromStorage(STORAGE_KEYS.FORM_FIELDS, {});
    stored[url] = {
      formData: formData,
      timestamp: Date.now(),
      url: url
    };
    saveToStorage(STORAGE_KEYS.FORM_FIELDS, stored);
    log(`💾 Saved ${formData.inputs.length} form fields`, "success");
    
    saveToStorage(STORAGE_KEYS.CURRENT_FORM, {
      formData: formData,
      url: url,
      timestamp: Date.now()
    });
  } catch (error) {
    log("⚠️ Failed to save form data: " + error.message, "warning");
  }
}

export function getCurrentForm() {
  return getFromStorage(STORAGE_KEYS.CURRENT_FORM, null);
}

export function saveFormValues(values, url) {
  try {
    const stored = getFromStorage(STORAGE_KEYS.FORM_VALUES, {});
    stored[url] = {
      values: values,
      timestamp: Date.now()
    };
    saveToStorage(STORAGE_KEYS.FORM_VALUES, stored);
    log("💾 Saved form values", "success");
  } catch (error) {
    log("⚠️ Failed to save form values", "warning");
  }
}

export function getFormValues(url) {
  try {
    const stored = getFromStorage(STORAGE_KEYS.FORM_VALUES, {});
    return stored[url]?.values || {};
  } catch (error) {
    return {};
  }
}

// ==================================================
// FORM DETECTION (runs in page context)
// ==================================================

export function detectFormFields() {
  const formData = {
    inputs: [],
    buttons: [],
    forms: []
  };

  const inputSelectors = [
    'input[type="text"]',
    'input[type="email"]',
    'input[type="password"]',
    'input[type="tel"]',
    'input[type="number"]',
    'input[type="search"]',
    'input[type="url"]',
    'input:not([type])',
    'textarea',
    'select'
  ];

  inputSelectors.forEach(selector => {
    document.querySelectorAll(selector).forEach((input, index) => {
      const style = window.getComputedStyle(input);
      const rect = input.getBoundingClientRect();
      
      if (style.display === 'none' || style.visibility === 'hidden' || 
          style.opacity === '0' || input.disabled || input.readOnly ||
          rect.width === 0 || rect.height === 0) {
        return;
      }
      
      let label = '';
      
      if (input.id) {
        const labelEl = document.querySelector(`label[for="${input.id}"]`);
        if (labelEl) label = labelEl.textContent.trim();
      }
      
      if (!label) {
        const parentLabel = input.closest('label');
        if (parentLabel) label = parentLabel.textContent.trim();
      }
      
      if (!label && input.getAttribute('aria-labelledby')) {
        const labelId = input.getAttribute('aria-labelledby');
        const labelEl = document.getElementById(labelId);
        if (labelEl) label = labelEl.textContent.trim();
      }
      
      if (!label && input.getAttribute('aria-label')) {
        label = input.getAttribute('aria-label');
      }
      
      if (!label && input.placeholder) {
        label = input.placeholder;
      }
      
      if (!label && input.name) {
        label = input.name.replace(/[-_]/g, ' ').replace(/([A-Z])/g, ' $1').trim();
      }
      
      if (!label) {
        const fieldType = input.type || input.tagName.toLowerCase();
        label = fieldType.charAt(0).toUpperCase() + fieldType.slice(1) + ' Field';
      }

      label = label.replace(/\*/g, '').replace(/\s+/g, ' ').trim();

      let uniqueSelector = '';
      if (input.id) {
        uniqueSelector = `#${input.id}`;
      } else if (input.name) {
        uniqueSelector = `[name="${input.name}"]`;
      } else {
        uniqueSelector = input.tagName.toLowerCase() + ':nth-of-type(' + (index + 1) + ')';
      }

      formData.inputs.push({
        type: input.type || input.tagName.toLowerCase(),
        name: input.name || '',
        id: input.id || '',
        label: label,
        placeholder: input.placeholder || '',
        value: input.value || '',
        required: input.required || false,
        selector: uniqueSelector,
        tagName: input.tagName.toLowerCase()
      });
    });
  });

  return formData;
}

// ==================================================
// FILL FORM FIELDS (runs in page context)
// ==================================================

export function fillFormFields(fillValues) {
  let filledCount = 0;
  const results = [];

  for (const [selector, value] of Object.entries(fillValues)) {
    try {
      const element = document.querySelector(selector);
      
      if (!element) {
        results.push({ selector, success: false, reason: 'Not found' });
        continue;
      }

      element.focus();
      element.value = value;

      const events = [
        new Event('input', { bubbles: true }),
        new Event('change', { bubbles: true }),
        new Event('blur', { bubbles: true })
      ];

      events.forEach(event => element.dispatchEvent(event));

      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      ).set;
      nativeInputValueSetter.call(element, value);
      element.dispatchEvent(new Event('input', { bubbles: true }));

      const originalBorder = element.style.border;
      element.style.border = '2px solid #4ade80';
      setTimeout(() => {
        element.style.border = originalBorder;
      }, 1000);

      filledCount++;
      results.push({ selector, success: true, value });
      
    } catch (error) {
      results.push({ selector, success: false, reason: error.message });
    }
  }

  return {
    success: filledCount > 0,
    filledCount: filledCount,
    totalAttempted: Object.keys(fillValues).length,
    results: results
  };
}

// ==================================================
// HANDLE FORM FILL FROM CHAT
// ==================================================

export async function handleFormFillRequest(userMessage) {
  log("🤖 Form fill request detected in chat", "info");
  
  const currentForm = getCurrentForm();
  
  if (!currentForm || !currentForm.formData) {
    addSystemBotMessage("⚠️ No form detected. Click the '🧠 Auto-Fill' button first!");
    log("❌ No form data in storage", "error");
    return false;
  }
  
  const formData = currentForm.formData;
  
  const processingMsg = addMessage("", "bot");
  const textEl = processingMsg.querySelector(".bot-text");
  const typing = addTypingLoader(textEl);
  
  try {
    log(`📤 Sending to AI: ${formData.inputs.length} fields`, "info");
    
    const response = await fetch(API.FILL_FORM, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_message: userMessage,
        form_fields: formData.inputs,
        form_url: currentForm.url
      })
    });

    const result = await response.json();
    typing.remove();

    if (result.success && result.filled_values) {
      log(`✅ AI extracted ${Object.keys(result.filled_values).length} values`, "success");
      
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
      });

      const fillValues = {};
      formData.inputs.forEach(field => {
        const label = field.label;
        if (result.filled_values[label]) {
          fillValues[field.selector] = result.filled_values[label];
        }
      });

      log(`📝 Filling ${Object.keys(fillValues).length} fields`, "info");

      const fillResults = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: fillFormFields,
        args: [fillValues]
      });

      const fillResult = fillResults?.[0]?.result;

      if (fillResult?.success) {
        textEl.innerHTML = `
          <div class="fill-success-card">
            <div class="fill-success-icon">✅</div>
            <div class="fill-success-content">
              <div class="fill-success-title">Form Filled Successfully!</div>
              <div class="fill-success-details">
                Filled ${fillResult.filledCount} out of ${formData.inputs.length} fields
              </div>
            </div>
          </div>
          <div class="filled-fields-list">
            ${Object.entries(result.filled_values).map(([label, value]) => `
              <div class="filled-field-item">
                <span class="filled-field-label">${label}:</span>
                <span class="filled-field-value">${value}</span>
              </div>
            `).join('')}
          </div>
        `;
        
        log(`✅ Successfully filled ${fillResult.filledCount} fields`, "success");
        saveFormValues(fillValues, currentForm.url);
        scrollToBottom();
        return true;
      } else {
        textEl.textContent = "⚠️ Some fields could not be filled.";
        log("⚠️ Fill operation partially failed", "warning");
        scrollToBottom();
        return false;
      }
    } else {
      textEl.textContent = "⚠️ Could not understand your details. Try:\n'Fill form with name John Smith, email john@test.com, phone 555-0123'";
      log("❌ AI failed to extract values: " + (result.error || "Unknown error"), "error");
      scrollToBottom();
      return false;
    }

  } catch (error) {
    typing.remove();
    textEl.textContent = "⚠️ Error: " + error.message;
    log("❌ Form fill error: " + error.message, "error");
    scrollToBottom();
    return false;
  }
}

// ==================================================
// SHOW FORM ANALYSIS UI
// ==================================================

export function showFormAnalysis(formData, savedValues = {}, currentUrl = '') {
  const bot = addMessage("", "bot");
  const textEl = bot.querySelector(".bot-text");

  const analysisCard = document.createElement("div");
  analysisCard.className = "form-analysis-card";
  analysisCard.innerHTML = `
    <div class="form-analysis-header">
      <span class="form-icon">📋</span>
      <div class="form-analysis-title">
        <div>Form Fields Detected</div>
        <div class="form-analysis-subtitle">
          ${formData.inputs.length} inputs detected
        </div>
      </div>
    </div>
  `;
  textEl.appendChild(analysisCard);

  if (formData.inputs.length > 0) {
    const inputsList = document.createElement("div");
    inputsList.className = "form-fields-list";
    
    formData.inputs.slice(0, 15).forEach((input, index) => {
      const fieldCard = document.createElement("div");
      fieldCard.className = "form-field-card";
      
      const typeEmoji = {
        'email': '📧',
        'password': '🔒',
        'tel': '📞',
        'text': '📝'
      }[input.type] || '✍️';

      const savedValue = savedValues[input.selector] || '';

      fieldCard.innerHTML = `
        <div class="form-field-header">
          <span class="form-field-icon">${typeEmoji}</span>
          <div class="form-field-info">
            <div class="form-field-label">${input.label}</div>
            <div class="form-field-type">${input.type}${input.required ? ' · Required' : ''}</div>
          </div>
        </div>
        <input 
          type="${input.type === 'password' ? 'password' : 'text'}" 
          class="form-field-input" 
          placeholder="Enter value..."
          value="${savedValue}"
          data-selector="${input.selector}"
        />
      `;

      inputsList.appendChild(fieldCard);
    });

    textEl.appendChild(inputsList);
  }

  const actionsContainer = document.createElement("div");
  actionsContainer.className = "form-actions-container";

  const fillBtn = document.createElement("button");
  fillBtn.className = "agent-action-btn form-action-primary";
  fillBtn.innerHTML = "🧠 Fill Form Now";
  fillBtn.onclick = async () => {
    const inputs = textEl.querySelectorAll('.form-field-input');
    const fillValues = {};

    inputs.forEach(input => {
      const selector = input.dataset.selector;
      const value = input.value.trim();
      if (value) {
        fillValues[selector] = value;
      }
    });

    if (Object.keys(fillValues).length === 0) {
      addSystemBotMessage("⚠️ Please enter values first");
      return;
    }

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: fillFormFields,
        args: [fillValues]
      });

      const result = results?.[0]?.result;

      if (result?.success) {
        addSystemBotMessage(`✅ Filled ${result.filledCount} fields!`);
        saveFormValues(fillValues, currentUrl);
      }
    } catch (error) {
      addSystemBotMessage("⚠️ Failed to fill form");
    }
  };

  actionsContainer.appendChild(fillBtn);
  textEl.appendChild(actionsContainer);

  scrollToBottom();
}

// ==================================================
// INITIALIZE AUTOFILL BUTTON
// ==================================================

export function initAutofill() {
  if (DOM.btnAutoFill) {
    DOM.btnAutoFill.onclick = async () => {
      log("🧠 Auto-fill button clicked", "info");
      
      try {
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true
        });

        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: detectFormFields
        });

        const formData = results?.[0]?.result;

        if (!formData || formData.inputs.length === 0) {
          addSystemBotMessage("⚠️ No form fields detected");
          log("❌ No forms found", "warning");
          return;
        }

        log(`✅ Found ${formData.inputs.length} inputs`, "success");
        
        saveDetectedForms(formData, tab.url);
        showFormAnalysis(formData, getFormValues(tab.url), tab.url);
        
        addSystemBotMessage(`✅ Found ${formData.inputs.length} fields!\n\nYou can:\n1. Fill values above and click "Fill Form Now"\n2. OR type: "Fill form with name John, email john@test.com"`);
        
      } catch (error) {
        log("❌ Error: " + error.message, "error");
        addSystemBotMessage("⚠️ Failed to detect forms");
      }
    };
  }
}

// Helper functions (these need to be imported from sidebar.js or created here)
function addMessage(text, type) {
  const wrapper = document.createElement("div");
  wrapper.className = type === "user" ? "user-msg" : "bot-msg";

  if (type === "user") wrapper.textContent = text;

  if (type === "bot") {
    const textDiv = document.createElement("div");
    textDiv.className = "bot-text";
    wrapper.appendChild(textDiv);
  }

  DOM.messages.appendChild(wrapper);
  scrollToBottom();
  return wrapper;
}

function addTypingLoader(parent) {
  const loader = document.createElement("div");
  loader.className = "typing";
  loader.innerHTML = "<span></span><span></span><span></span>";
  parent.appendChild(loader);
  scrollToBottom();
  return loader;
}

function addSystemBotMessage(text) {
  const wrapper = document.createElement("div");
  wrapper.className = "bot-msg";
  const textDiv = document.createElement("div");
  textDiv.className = "bot-text";
  textDiv.textContent = text;
  wrapper.appendChild(textDiv);
  DOM.messages.appendChild(wrapper);
  scrollToBottom();
}