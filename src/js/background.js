/**
 * Background script for Twitter Bookmarks Exporter
 * Monitors Twitter/X API requests and captures authentication tokens needed for bookmark export
 */

// Authentication token storage
const authTokenStorage = {
  // In-memory cache of current auth tokens
  tokens: {
    csrfToken: null,
    authToken: null,
    lastUpdated: null
  },

  // Save tokens to persistent storage
  saveTokens() {
    chrome.storage.local.set({ 'twitter_auth_tokens': this.tokens });
  },

  // Load tokens from persistent storage
  async loadTokens() {
    return new Promise(resolve => {
      chrome.storage.local.get(['twitter_auth_tokens'], result => {
        if (result.twitter_auth_tokens) {
          this.tokens = result.twitter_auth_tokens;
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });
  },

  // Update tokens with new values
  updateTokens(csrfToken, authToken) {
    this.tokens = {
      csrfToken,
      authToken,
      lastUpdated: new Date().toISOString()
    };
    this.saveTokens();
    
    console.log('[Markly] Captured authentication tokens');
    console.log('[Markly] CSRF Token:', csrfToken.substring(0, 10) + '...');
    console.log('[Markly] Auth Token:', authToken.substring(0, 20) + '...');
  }
};

/**
 * Monitor web requests to Twitter/X API endpoints to capture auth tokens
 */
chrome.webRequest.onSendHeaders.addListener(
  (details) => {
    // Only process Twitter/X API requests
    if (details.url.includes('twitter.com/i/api') || details.url.includes('x.com/i/api')) {
      let csrfToken = null;
      let authToken = null;
      
      // Extract authentication headers
      for (const header of details.requestHeaders) {
        const headerName = header.name.toLowerCase();
        
        if (headerName === 'x-csrf-token') {
          csrfToken = header.value;
        } else if (headerName === 'authorization') {
          authToken = header.value;
        }
        
        // Stop searching if we found both tokens
        if (csrfToken && authToken) break;
      }
      
      // Store the tokens if both were found
      if (csrfToken && authToken) {
        authTokenStorage.updateTokens(csrfToken, authToken);
      }
    }
  },
  { urls: ["*://twitter.com/*", "*://x.com/*"] },
  ["requestHeaders"]
);

/**
 * Handle messages from the popup
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getAuthTokens') {
    console.log('[Markly] Popup requested auth tokens');
    
    // Check if we have tokens in memory
    if (authTokenStorage.tokens.csrfToken && authTokenStorage.tokens.authToken) {
      console.log('[Markly] Returning tokens from memory');
      sendResponse({ success: true, tokens: authTokenStorage.tokens });
      return true;
    }
    
    // Try to load tokens from storage
    authTokenStorage.loadTokens().then(found => {
      if (found) {
        console.log('[Markly] Returning tokens from storage');
        sendResponse({ success: true, tokens: authTokenStorage.tokens });
      } else {
        console.log('[Markly] No tokens available');
        sendResponse({ 
          success: false, 
          error: 'No authentication tokens captured yet'
        });
      }
    });
    
    // Return true to indicate we'll respond asynchronously
    return true;
  }
});

console.log('[Markly] Background script loaded and monitoring Twitter API requests'); 