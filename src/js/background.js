/**
 * Background script for Social Bookmarks Exporter
 * Monitors Twitter/X and LinkedIn API requests and captures authentication tokens needed for bookmark export
 */

// Authentication token storage
const authTokenStorage = {
  // In-memory cache of current auth tokens
  tokens: {
    // Twitter tokens
    twitter: {
      csrfToken: null,
      authToken: null,
      lastUpdated: null
    },
    // LinkedIn tokens
    linkedin: {
      csrfToken: null,
      cookie: null,
      lastUpdated: null
    }
  },

  // Save tokens to persistent storage
  saveTokens() {
    chrome.storage.local.set({ 'auth_tokens': this.tokens });
  },

  // Load tokens from persistent storage
  async loadTokens() {
    return new Promise(resolve => {
      chrome.storage.local.get(['auth_tokens'], result => {
        if (result.auth_tokens) {
          this.tokens = result.auth_tokens;
          resolve(true);
        } else {
          // Try legacy format for backward compatibility
          chrome.storage.local.get(['twitter_auth_tokens'], legacyResult => {
            if (legacyResult.twitter_auth_tokens) {
              this.tokens.twitter = legacyResult.twitter_auth_tokens;
              this.saveTokens();
              resolve(true);
            } else {
              resolve(false);
            }
          });
        }
      });
    });
  },

  // Update Twitter tokens with new values
  updateTwitterTokens(csrfToken, authToken) {
    this.tokens.twitter = {
      csrfToken,
      authToken,
      lastUpdated: new Date().toISOString()
    };
    this.saveTokens();
    
    console.log('[Markly] Captured Twitter authentication tokens');
    console.log('[Markly] Twitter CSRF Token:', csrfToken.substring(0, 10) + '...');
    console.log('[Markly] Twitter Auth Token:', authToken.substring(0, 20) + '...');
  },

  // Update LinkedIn tokens with new values
  updateLinkedInTokens(csrfToken, cookie) {
    this.tokens.linkedin = {
      csrfToken,
      cookie,
      lastUpdated: new Date().toISOString()
    };
    this.saveTokens();
    
    console.log('[Markly] Captured LinkedIn authentication tokens');
    console.log('[Markly] LinkedIn CSRF Token:', csrfToken.substring(0, 10) + '...');
    console.log('[Markly] LinkedIn Cookie captured:', cookie ? 'Yes (length: ' + cookie.length + ')' : 'No');
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
        authTokenStorage.updateTwitterTokens(csrfToken, authToken);
      }
    }
    
    // Process LinkedIn API requests
    if (details.url.includes('linkedin.com/voyager/api')) {
      let csrfToken = null;
      let cookie = null;
      
      // Extract authentication headers
      for (const header of details.requestHeaders) {
        const headerName = header.name.toLowerCase();
        
        if (headerName === 'csrf-token') {
          csrfToken = header.value;
        } else if (headerName === 'cookie') {
          cookie = header.value;
          
          // Try to extract the JSESSIONID from the cookie if no csrf-token was found
          if (!csrfToken) {
            const jsessionMatch = cookie.match(/JSESSIONID="?([^;"]+)"?/);
            if (jsessionMatch && jsessionMatch[1]) {
              // Use the full JSESSIONID value including the "ajax:" prefix
              csrfToken = jsessionMatch[1];
              console.log('[Markly] Extracted JSESSIONID from cookie as CSRF token:',
                csrfToken.length > 15 ? csrfToken.substring(0, 15) + '...' : csrfToken);
            }
          }
        }
      }
      
      // Store the tokens if both were found
      if (csrfToken && cookie) {
        authTokenStorage.updateLinkedInTokens(csrfToken, cookie);
      }
    }
  },
  { urls: ["*://twitter.com/*", "*://x.com/*", "*://www.linkedin.com/*"] },
  ["requestHeaders"]
);

/**
 * Handle messages from the popup
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getAuthTokens') {
    const platform = message.platform || 'twitter';
    console.log(`[Markly] Popup requested ${platform} auth tokens`);
    
    // Check if we have tokens in memory
    if (platform === 'twitter' && 
        authTokenStorage.tokens.twitter.csrfToken && 
        authTokenStorage.tokens.twitter.authToken) {
      console.log('[Markly] Returning Twitter tokens from memory');
      sendResponse({ success: true, tokens: authTokenStorage.tokens.twitter });
      return true;
    } 
    else if (platform === 'linkedin' && 
        authTokenStorage.tokens.linkedin.csrfToken && 
        authTokenStorage.tokens.linkedin.cookie) {
      console.log('[Markly] Returning LinkedIn tokens from memory');
      sendResponse({ success: true, tokens: authTokenStorage.tokens.linkedin });
      return true;
    }
    
    // Try to load tokens from storage
    authTokenStorage.loadTokens().then(found => {
      if (found) {
        if (platform === 'twitter' && 
            authTokenStorage.tokens.twitter.csrfToken && 
            authTokenStorage.tokens.twitter.authToken) {
          console.log('[Markly] Returning Twitter tokens from storage');
          sendResponse({ success: true, tokens: authTokenStorage.tokens.twitter });
        }
        else if (platform === 'linkedin' && 
            authTokenStorage.tokens.linkedin.csrfToken && 
            authTokenStorage.tokens.linkedin.cookie) {
          console.log('[Markly] Returning LinkedIn tokens from storage');
          sendResponse({ success: true, tokens: authTokenStorage.tokens.linkedin });
        }
        else {
          console.log(`[Markly] No ${platform} tokens available`);
          sendResponse({ 
            success: false, 
            error: `No ${platform} authentication tokens captured yet`
          });
        }
      } else {
        console.log(`[Markly] No ${platform} tokens available`);
        sendResponse({ 
          success: false, 
          error: `No ${platform} authentication tokens captured yet`
        });
      }
    });
    
    // Return true to indicate we'll respond asynchronously
    return true;
  }
});

console.log('[Markly] Background script loaded and monitoring API requests'); 