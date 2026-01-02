// AMAN AI Chrome Extension - Background Service Worker

const API_BASE = 'https://amanai.kz';

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Open welcome page on install
    chrome.tabs.create({ url: `${API_BASE}/dashboard` });
  }
});

// Handle messages from content scripts or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'OPEN_CONSULTATION') {
    chrome.tabs.create({ url: `${API_BASE}/dashboard/consultation` });
    sendResponse({ success: true });
  }
  
  if (message.type === 'GET_AUTH_STATUS') {
    checkAuthStatus().then(sendResponse);
    return true; // Keep channel open for async response
  }
  
  if (message.type === 'OPEN_DASHBOARD') {
    chrome.tabs.create({ url: `${API_BASE}/dashboard` });
    sendResponse({ success: true });
  }
});

async function checkAuthStatus() {
  try {
    const response = await fetch(`${API_BASE}/api/user/me`, {
      credentials: 'include'
    });
    
    if (response.ok) {
      const user = await response.json();
      return { authenticated: true, user };
    }
    
    return { authenticated: false };
  } catch (error) {
    return { authenticated: false, error: error.message };
  }
}

// Handle keyboard shortcut (if configured)
chrome.commands?.onCommand.addListener((command) => {
  if (command === 'open-consultation') {
    chrome.tabs.create({ url: `${API_BASE}/dashboard/consultation` });
  }
});

