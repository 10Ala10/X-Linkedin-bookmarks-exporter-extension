/**
 * Twitter and LinkedIn Bookmarks Exporter - Popup Script
 * 
 * This script handles the user interface and main functionality
 * for the Social Bookmarks Exporter extension.
 */

// Initialize the popup UI when the DOM content is loaded
document.addEventListener('DOMContentLoaded', function () {
  // Cache DOM elements
  const popupContent = document.getElementById('popup-content');
  const statusDiv = document.getElementById('status');
  
  // Track the currently selected platform
  let currentPlatform = 'twitter';
  
  // Set up platform selection
  setupPlatformSelection();
  
  // Set up the bookmarks fetch button
  setupFetchButton();
  
  // Set up settings section
  setupSettings();
  
  // Update the initial status text
  statusDiv.textContent = 'Ready to export your Twitter bookmarks';

  /**
   * Sets up platform selection buttons and handlers
   */
  function setupPlatformSelection() {
    const twitterButton = document.getElementById('twitter-platform');
    const linkedinButton = document.getElementById('linkedin-platform');
    
    // Add click handlers for platform buttons
    twitterButton.addEventListener('click', function() {
      if (currentPlatform !== 'twitter') {
        currentPlatform = 'twitter';
        updateSelectedPlatform();
        
        // Show Twitter instructions, hide LinkedIn instructions
        document.getElementById('twitter-instructions').style.display = 'block';
        document.getElementById('linkedin-instructions').style.display = 'none';
        
        // Update status
        statusDiv.textContent = 'Ready to export your Twitter bookmarks';
      }
    });
    
    linkedinButton.addEventListener('click', function() {
      if (currentPlatform !== 'linkedin') {
        currentPlatform = 'linkedin';
        updateSelectedPlatform();
        
        // Show LinkedIn instructions, hide Twitter instructions
        document.getElementById('twitter-instructions').style.display = 'none';
        document.getElementById('linkedin-instructions').style.display = 'block';
        
        // Update status
        statusDiv.textContent = 'Ready to export your LinkedIn bookmarks';
      }
    });
    
    // Update visual selection
    function updateSelectedPlatform() {
      // Remove selection from both buttons
      twitterButton.classList.remove('platform-selected', 'twitter');
      linkedinButton.classList.remove('platform-selected', 'linkedin');
      
      // Add to the correct button
      if (currentPlatform === 'twitter') {
        twitterButton.classList.add('platform-selected', 'twitter');
      } else {
        linkedinButton.classList.add('platform-selected', 'linkedin');
      }
    }
  }
  
  /**
   * Sets up the main fetch button and its event listener
   */
  function setupFetchButton() {
    // Remove any existing button
    const oldButton = document.getElementById('scrapeBookmarks');
    if (oldButton) {
      oldButton.remove();
    }

    // Create button container
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.justifyContent = 'center';
    buttonContainer.style.marginBottom = '15px';

    // Create fetch button
    const fetchButton = document.createElement('button');
    fetchButton.id = 'export-bookmarks-btn';
    fetchButton.textContent = 'Save My Bookmarks';
    fetchButton.title = 'Automatically extracts bookmarks and saves them to your database';

    // Add button to container and container to popup
    buttonContainer.appendChild(fetchButton);
    popupContent.insertBefore(buttonContainer, document.getElementById('bookmarksList'));
    
    // Add click event listener to the fetch button
    fetchButton.addEventListener('click', handleExportButtonClick);
  }
  
  /**
   * Sets up the settings section for configuring backend URL
   */
  function setupSettings() {
    // Load the saved backend URL from storage
    chrome.storage.sync.get('backendUrl', function(data) {
      const defaultBackendUrl = 'http://localhost:8000/api/bookmarks/bulk';
      const savedBackendUrl = data.backendUrl || defaultBackendUrl;
      
      // Create settings icon in the header
      const headerSection = document.querySelector('.header');
      if (headerSection) {
        const settingsIcon = document.createElement('div');
        settingsIcon.className = 'settings-icon';
        settingsIcon.innerHTML = '⚙️';
        settingsIcon.title = 'Settings';
        headerSection.appendChild(settingsIcon);
        
        // Create settings panel (hidden by default)
        const settingsPanel = document.createElement('div');
        settingsPanel.className = 'settings-panel';
        settingsPanel.style.display = 'none';
        
        settingsPanel.innerHTML = `
          <h3>Settings</h3>
          <div class="settings-form">
            <label for="backend-url">Backend API URL:</label>
            <input type="text" id="backend-url" value="${savedBackendUrl}" placeholder="http://localhost:8000/api/bookmarks/bulk">
            <div class="settings-buttons">
              <button id="save-settings">Save</button>
              <button id="cancel-settings">Cancel</button>
            </div>
          </div>
        `;
        
        // Add settings panel to the popup
        popupContent.insertBefore(settingsPanel, popupContent.firstChild);
        
        // Toggle settings panel when icon is clicked
        settingsIcon.addEventListener('click', function() {
          settingsPanel.style.display = settingsPanel.style.display === 'none' ? 'block' : 'none';
        });
        
        // Handle save button click
        document.getElementById('save-settings').addEventListener('click', function() {
          const backendUrl = document.getElementById('backend-url').value.trim();
          
          // Save to storage
          chrome.storage.sync.set({ backendUrl: backendUrl }, function() {
            console.log('Backend URL saved:', backendUrl);
            
            // Hide settings panel
            settingsPanel.style.display = 'none';
            
            // Show success message
            statusDiv.textContent = 'Settings saved';
            setTimeout(() => {
              statusDiv.textContent = `Ready to export your ${currentPlatform === 'twitter' ? 'Twitter' : 'LinkedIn'} ${currentPlatform === 'twitter' ? 'bookmarks' : 'saved posts'}`;
            }, 2000);
          });
        });
        
        // Handle cancel button click
        document.getElementById('cancel-settings').addEventListener('click', function() {
          // Reset to saved value
          document.getElementById('backend-url').value = savedBackendUrl;
          
          // Hide settings panel
          settingsPanel.style.display = 'none';
        });
      }
    });
  }
  
  /**
   * Handles the click event on the export button
   */
  async function handleExportButtonClick() {
    try {
      // Get the active tab
      let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      // Check if we're on the correct platform site based on current selection
      let expectedDomain = currentPlatform === 'twitter' ? 
        ['twitter.com', 'x.com'] : 
        ['linkedin.com'];
      
      let isOnCorrectSite = expectedDomain.some(domain => tab.url.includes(domain));
      
      if (!isOnCorrectSite) {
        // Redirect to the appropriate site
        let targetUrl = currentPlatform === 'twitter' ? 
          'https://twitter.com/i/bookmarks' : 
          'https://www.linkedin.com/my-items/saved-posts/';
        
        statusDiv.textContent = `Opening ${currentPlatform} for you...`;
        chrome.tabs.update(tab.id, { url: targetUrl });
        
        // Add a listener to automatically try again when the page loads
        chrome.tabs.onUpdated.addListener(function tabUpdateListener(tabId, changeInfo, updatedTab) {
          // Check if this is our tab and it has finished loading
          if (tabId === tab.id && changeInfo.status === 'complete') {
            // Check if we're now on the correct domain
            const onCorrectDomain = expectedDomain.some(domain => updatedTab.url.includes(domain));
            
            if (onCorrectDomain) {
              // Remove this listener to avoid duplicate calls
              chrome.tabs.onUpdated.removeListener(tabUpdateListener);
              // Wait a moment for the page to fully render then trigger export
              setTimeout(() => handleExportButtonClick(), 1500);
            }
          }
        });
        
        return;
      }

      // Update UI to show we're working
      statusDiv.textContent = 'Checking for authentication tokens...';
      showLoadingMessage('Looking for authentication tokens...');

      // For LinkedIn, we need to get the cookies from the tab itself to avoid CSP issues
      if (currentPlatform === 'linkedin') {
        try {
          // Execute a script in the LinkedIn tab to get document.cookie
          const cookieResults = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              return { 
                cookie: document.cookie,
                // Also check if we can find JSESSIONID directly in the cookie
                jsessionId: document.cookie.match(/JSESSIONID="?([^;"]+)"?/)?.[1] || null
              };
            }
          });
          
          if (cookieResults && cookieResults[0] && cookieResults[0].result) {
            const result = cookieResults[0].result;
            console.log('Retrieved cookies from LinkedIn tab:', 
              result.cookie ? `Cookie length: ${result.cookie.length}` : 'No cookie found',
              result.jsessionId ? `JSESSIONID found: ${result.jsessionId.substring(0, 15)}...` : 'No JSESSIONID found'
            );
            
            // If we have the cookie and JSESSIONID, we can proceed directly
            if (result.cookie && result.jsessionId) {
              // Use the full JSESSIONID as the CSRF token, including the "ajax:" prefix if present
              const csrfToken = result.jsessionId;
                
              showLoadingMessage('Fetching LinkedIn bookmarks via API...');
              const bookmarks = await fetchLinkedInBookmarks(csrfToken, result.cookie);
              
              console.log(`LinkedIn API returned ${bookmarks.length} bookmarks directly from tab`);
              
              // Only throw for undefined/null bookmarks which indicates API failure
              // Empty arrays are valid for LinkedIn (user might not have saved any posts)
              if (bookmarks === undefined || bookmarks === null) {
                throw new Error(`LinkedIn API failed to return a valid response`);
              }
              
              // Success! Display the bookmarks (even if empty array)
              displayBookmarks(bookmarks, statusDiv, document.getElementById('bookmarksList'), currentPlatform);
              return;
            }
          }
        } catch (scriptError) {
          console.error('Error executing script in LinkedIn tab:', scriptError);
          // If script execution fails, fall back to normal token method
        }
      }

      // Request tokens from the background script, specifying the platform
      chrome.runtime.sendMessage({ 
        action: 'getAuthTokens', 
        platform: currentPlatform 
      }, async response => {
        console.log(`${currentPlatform} token response from background:`, response);

        if (!response || !response.success) {
          // No tokens available yet
          handleMissingTokens(statusDiv, document.getElementById('bookmarksList'), currentPlatform);
          return;
        }

        // We have tokens! Now fetch bookmarks
        const tokens = response.tokens;
        statusDiv.textContent = 'Authentication tokens found! Fetching bookmarks...';

        try {
          let bookmarks = [];
          
          // Fetch bookmarks based on the current platform
          if (currentPlatform === 'twitter') {
            const csrfToken = tokens.csrfToken;
            const authToken = tokens.authToken;
            
            console.log('Using Twitter tokens to fetch bookmarks:');
            console.log('CSRF Token:', csrfToken.substring(0, 10) + '...');
            console.log('Auth Token:', authToken.substring(0, 20) + '...');

            showLoadingMessage('Fetching Twitter bookmarks via API...');
            bookmarks = await fetchTwitterBookmarks(csrfToken, authToken, document.cookie);
            
            // Twitter should always return bookmarks if API call is successful
            if (!bookmarks || bookmarks.length === 0) {
              throw new Error(`No Twitter bookmarks returned from API`);
            }
          } else {
            // LinkedIn
            const csrfToken = tokens.csrfToken;
            const cookie = tokens.cookie;
            
            console.log('Using LinkedIn tokens to fetch bookmarks:');
            console.log('CSRF Token:', csrfToken.substring(0, 10) + '...');
            
            showLoadingMessage('Fetching LinkedIn bookmarks via API...');
            bookmarks = await fetchLinkedInBookmarks(csrfToken, cookie);
            
            console.log(`LinkedIn API returned ${bookmarks.length} bookmarks`);
            
            // For LinkedIn, null/undefined indicates an API failure
            // Empty array might mean the user has no saved posts
            if (bookmarks === undefined || bookmarks === null) {
              throw new Error(`LinkedIn API failed to return a valid response`);
            }
          }

          // Display the bookmarks (even if empty for LinkedIn)
          displayBookmarks(bookmarks, statusDiv, document.getElementById('bookmarksList'), currentPlatform);
        } catch (fetchError) {
          console.error(`Error fetching ${currentPlatform} bookmarks:`, fetchError);
          statusDiv.textContent = `Error fetching bookmarks from ${currentPlatform} API`;
          
          showErrorMessage(
            `Error fetching ${currentPlatform} bookmarks: ${fetchError.message}`,
            `Please try again after refreshing ${currentPlatform}.`
          );
        }
      });
    } catch (error) {
      statusDiv.textContent = 'Error: ' + error.message;
      console.error('Error using browser context:', error);
      showErrorMessage(error.message);
    }
  }
  
  /**
   * Displays a loading message in the bookmarks list area
   * @param {string} message - The message to display
   */
  function showLoadingMessage(message) {
    const bookmarksList = document.getElementById('bookmarksList');
    bookmarksList.innerHTML = `
      <div class="centered-message">
        <div class="loading-text">${message}</div>
        <div class="loading-subtext">
          Please wait while we process your request.
        </div>
      </div>
    `;
  }
  
  /**
   * Displays an error message in the bookmarks list area
   * @param {string} mainMessage - The main error message
   * @param {string} subMessage - Optional submessage with additional instructions
   */
  function showErrorMessage(mainMessage, subMessage = '') {
    const bookmarksList = document.getElementById('bookmarksList');
    bookmarksList.innerHTML = `
      <div class="centered-message error-message">
        <div class="loading-text">
          <strong>${mainMessage}</strong>
        </div>
        ${subMessage ? `<div>${subMessage}</div>` : ''}
      </div>
    `;
  }
});

/**
 * Handles the case when authentication tokens are missing
 * @param {HTMLElement} statusDiv - The status display element
 * @param {HTMLElement} bookmarksList - The bookmarks list container element
 * @param {string} platform - The current platform ('twitter' or 'linkedin')
 */
function handleMissingTokens(statusDiv, bookmarksList, platform) {
  const platformName = platform === 'twitter' ? 'Twitter/X' : 'LinkedIn';
  const platformUrl = platform === 'twitter' ? 
    'https://twitter.com/i/bookmarks' : 
    'https://www.linkedin.com/my-items/saved-posts/';
  
  statusDiv.textContent = `No ${platformName} authentication tokens found yet.`;
  bookmarksList.innerHTML = `
    <div class="centered-message">
      <div class="error-message" style="margin-bottom: 15px;">
        <strong>No ${platformName} authentication tokens detected.</strong>
      </div>
      <div style="margin-bottom: 15px;">
        Please interact with ${platformName} to generate some API requests:
      </div>
      <ol style="text-align: left; margin: 15px auto; max-width: 400px;">
        <li>Make sure you're logged in to ${platformName}</li>
        <li>Navigate to your <a href="${platformUrl}" target="_blank">${platform === 'twitter' ? 'bookmarks' : 'saved posts'} page</a></li>
        <li>Scroll down a bit to load more content</li>
        <li>Then click "Save My Bookmarks" again</li>
      </ol>
      <div style="margin-top: 15px;">
        <button id="retry-tokens">
          Check Again
        </button>
      </div>
    </div>
  `;

  // Add event listener for retry button
  document.getElementById('retry-tokens').addEventListener('click', () => {
    document.getElementById('export-bookmarks-btn').click();
  });
}

/**
 * Displays the retrieved bookmarks in the UI
 * @param {Array} bookmarks - Array of bookmark objects
 * @param {HTMLElement} statusDiv - The status display element
 * @param {HTMLElement} bookmarksList - The bookmarks list container element
 * @param {string} platform - The current platform ('twitter' or 'linkedin')
 */
function displayBookmarks(bookmarks, statusDiv, bookmarksList, platform) {
  // Platform-specific labels
  const platformName = platform === 'twitter' ? 'Twitter' : 'LinkedIn';
  const itemName = platform === 'twitter' ? 'bookmarks' : 'saved posts';
  
  // Ensure bookmarks is an array
  const bookmarksArray = Array.isArray(bookmarks) ? bookmarks : [];
  
  // Send bookmarks to the backend
  sendBookmarksToBackend(bookmarksArray, platform, statusDiv);

  // Update status
  statusDiv.textContent = `Successfully processed ${bookmarksArray.length} ${platformName} ${itemName}!`;
  console.log(`Processed ${bookmarksArray.length} ${platformName} ${itemName}`);

  // Clear previous content and show simple success message
  bookmarksList.innerHTML = `
    <div class="centered-message">
      <div class="success-message">
        <strong>✓ ${bookmarksArray.length} ${itemName} successfully saved to your database!</strong>
      </div>
    </div>
  `;
}

/**
 * Sends bookmarks to the user's backend API
 * @param {Array} bookmarks - Array of bookmark objects to send
 * @param {string} platform - The platform these bookmarks are from ('twitter' or 'linkedin')
 * @param {HTMLElement} statusDiv - Status element to update with progress
 */
async function sendBookmarksToBackend(bookmarks, platform, statusDiv) {
  try {
    // Get the backend URL from storage or use the default one
    chrome.storage.sync.get('backendUrl', async function(data) {
      // Default backend URL or from settings
      const backendUrl = data.backendUrl || 'http://localhost:8000/api/bookmarks/bulk';
      console.log(`Sending ${bookmarks.length} ${platform} bookmarks to backend: ${backendUrl}`);
      
      // Update status to show we're saving to backend
      statusDiv.textContent = `Saving ${bookmarks.length} ${platform} bookmarks to your database...`;
      
      // Transform bookmarks to match the expected backend format
      const transformedBookmarks = bookmarks.map(bookmark => ({
        externalId: bookmark.id,
        text: bookmark.text || '',
        authorName: bookmark.author?.name || '',
        authorUsername: bookmark.author?.username || '',
        authorProfileUrl: bookmark.author?.profileUrl || '',
        authorPhoto: bookmark.author?.photo || '',
        createdAt: bookmark.createdAt instanceof Date ? bookmark.createdAt.toISOString() : bookmark.createdAt,
        url: bookmark.url || '',
        media: bookmark.media || [],
        platform: platform === 'twitter' ? 'x' : platform
      }));
      
      const authToken = "eyJhbGciOiJIUzI1NiIsImtpZCI6ImVJQnVYdEJWa3R1SXJaaUkiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL3lxa2NzdWNobnBsenZod2htaG1yLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI0NjZkYmYxOS03ODlmLTQxOGItOGIxYy1iZDMxNWVjMGMyMDciLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzQ3MTYyNjYyLCJpYXQiOjE3NDcxNTkwNjIsImVtYWlsIjoiYWxhYmFjY2FyaTIwMjJAZ21haWwuY29tIiwicGhvbmUiOiIiLCJhcHBfbWV0YWRhdGEiOnsicHJvdmlkZXIiOiJnb29nbGUiLCJwcm92aWRlcnMiOlsiZ29vZ2xlIl19LCJ1c2VyX21ldGFkYXRhIjp7ImF2YXRhcl91cmwiOiJodHRwczovL2xoMy5nb29nbGV1c2VyY29udGVudC5jb20vYS9BQ2c4b2NJblJDODJUQlFtdGx5V3RpV25fd21sOW5kLVNWeDUzb3EzMDNBR0dlcFVZT3ZKaHRvPXM5Ni1jIiwiZW1haWwiOiJhbGFiYWNjYXJpMjAyMkBnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwiZnVsbF9uYW1lIjoiQmFjY2FyaSBBbGEiLCJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJuYW1lIjoiQmFjY2FyaSBBbGEiLCJwaG9uZV92ZXJpZmllZCI6ZmFsc2UsInBpY3R1cmUiOiJodHRwczovL2xoMy5nb29nbGV1c2VyY29udGVudC5jb20vYS9BQ2c4b2NJblJDODJUQlFtdGx5V3RpV25fd21sOW5kLVNWeDUzb3EzMDNBR0dlcFVZT3ZKaHRvPXM5Ni1jIiwicHJvdmlkZXJfaWQiOiIxMDk0OTY0OTgyMTUxNzg5NjI1NzIiLCJzdWIiOiIxMDk0OTY0OTgyMTUxNzg5NjI1NzIifSwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJhYWwiOiJhYWwxIiwiYW1yIjpbeyJtZXRob2QiOiJvYXV0aCIsInRpbWVzdGFtcCI6MTc0NzE1NTUyM31dLCJzZXNzaW9uX2lkIjoiNzM0MzVhMWQtZmY3My00YzU1LWE3OTMtY2JlMGM0NzQxN2JiIiwiaXNfYW5vbnltb3VzIjpmYWxzZX0.AsX7tEP9Td-970y42Q818iIupzImJ_j0MU_VhwByfBI"      
      try {
        // Send POST request to the backend
        const response = await fetch(backendUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify(transformedBookmarks)
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Backend API error (${response.status}): ${errorText}`);
        }
        
        console.log('Bookmarks successfully saved to backend');
      } catch (fetchError) {
        console.error('Error saving bookmarks to backend:', fetchError);
        statusDiv.textContent = `Error: Failed to save to database: ${fetchError.message}`;
      }
    });
  } catch (error) {
    console.error('Error in sendBookmarksToBackend:', error);
    statusDiv.textContent = 'Error saving to database';
  }
}

/**
 * Fetches bookmarks from Twitter's API
 * @param {string} csrfToken - The CSRF token for authentication
 * @param {string} authToken - The authentication token
 * @param {string} cookies - The cookies from the current session
 * @returns {Promise<Array>} - Promise resolving to an array of bookmark objects
 */
async function fetchTwitterBookmarks(csrfToken, authToken, cookies) {
  console.log('Starting to fetch bookmarks via Twitter API...');

  // API endpoint for bookmarks
  const baseEndpoint = 'https://x.com/i/api/graphql/3rmMnGpXCYmivkSUIz0IaQ/Bookmarks';
  const allBookmarks = [];
  let cursor = null;

  try {
    // Extract the ct0 value from cookies if not provided directly
    let actualCsrfToken = csrfToken;
    const ctMatch = cookies.match(/ct0=([^;]+)/);
    if (ctMatch && ctMatch[1]) {
      actualCsrfToken = ctMatch[1];
      console.log('Using ct0 value from cookies:', actualCsrfToken);
    }

    /**
     * Makes a single API request to fetch a page of bookmarks
     * @param {string|null} cursor - Pagination cursor
     * @returns {Promise<Object>} - Promise resolving to an object with tweets and next cursor
     */
    async function makeRequest(cursor) {
      // Build request variables
      const variables = {
        count: 100, // Request more bookmarks per page
        includePromotedContent: true,
      };

      if (cursor) {
        variables.cursor = cursor;
      }

      // Required API features
      const features = {
        rweb_video_screen_enabled: false,
        profile_label_improvements_pcf_label_in_post_enabled: true,
        rweb_tipjar_consumption_enabled: true,
        verified_phone_label_enabled: false,
        creator_subscriptions_tweet_preview_api_enabled: true,
        responsive_web_graphql_timeline_navigation_enabled: true,
        responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
        premium_content_api_read_enabled: false,
        communities_web_enable_tweet_community_results_fetch: true,
        c9s_tweet_anatomy_moderator_badge_enabled: true,
        responsive_web_grok_analyze_button_fetch_trends_enabled: false,
        responsive_web_grok_analyze_post_followups_enabled: true,
        responsive_web_jetfuel_frame: false,
        responsive_web_grok_share_attachment_enabled: true,
        articles_preview_enabled: true,
        responsive_web_edit_tweet_api_enabled: true,
        graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
        view_counts_everywhere_api_enabled: true,
        longform_notetweets_consumption_enabled: true,
        responsive_web_twitter_article_tweet_consumption_enabled: true,
        tweet_awards_web_tipping_enabled: false,
        responsive_web_grok_show_grok_translated_post: false,
        responsive_web_grok_analysis_button_from_backend: true,
        creator_subscriptions_quote_tweet_preview_enabled: false,
        freedom_of_speech_not_reach_fetch_enabled: true,
        standardized_nudges_misinfo: true,
        tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
        longform_notetweets_rich_text_read_enabled: true,
        longform_notetweets_inline_media_enabled: true,
        responsive_web_grok_image_annotation_enabled: true,
        responsive_web_enhance_cards_enabled: false,
      };

      // Build URL with params
      const url = `${baseEndpoint}?variables=${encodeURIComponent(JSON.stringify(variables))}&features=${encodeURIComponent(
        JSON.stringify(features)
      )}`;

      // Set up request headers
      const headers = {
        'x-csrf-token': actualCsrfToken,
        authorization: authToken,
        'content-type': 'application/json',
        'x-twitter-auth-type': 'OAuth2Session',
        'x-twitter-client-language': 'en',
        'x-twitter-active-user': 'yes',
        Referer: 'https://twitter.com/i/bookmarks',
        Origin: 'https://twitter.com',
        Cookie: cookies,
      };

      console.log('Making request with headers:', {
        'x-csrf-token': actualCsrfToken,
        authorization: authToken.substring(0, 20) + '...', // Log partial auth for debugging
      });

      // Make the API request
      const response = await fetch(url, {
        method: 'GET',
        headers: headers,
      });

      // Handle errors
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API request failed:', response.status, response.statusText, errorText);
        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      // Parse response
      const data = await response.json();
      console.log('API response received');

      // Extract tweets and next cursor
      const timeline = data?.data?.bookmark_timeline_v2?.timeline;
      if (!timeline || !timeline.instructions) {
        return { tweets: [], nextCursor: null };
      }

      // Find the AddEntries instruction
      const addEntriesInstruction = timeline.instructions.find(instruction => instruction.type === 'TimelineAddEntries');

      if (!addEntriesInstruction || !addEntriesInstruction.entries) {
        return { tweets: [], nextCursor: null };
      }

      // Process timeline entries
      const tweets = [];
      let nextCursor = null;

      for (const entry of addEntriesInstruction.entries) {
        // Check if this entry is a cursor
        if (entry.content && entry.content.entryType === 'TimelineTimelineCursor' && entry.content.cursorType === 'Bottom') {
          nextCursor = entry.content.value;
          continue;
        }

        // Skip non-tweet entries
        if (
          !entry.content ||
          entry.content.entryType !== 'TimelineTimelineItem' ||
          !entry.content.itemContent ||
          entry.content.itemContent.itemType !== 'TimelineTweet'
        ) {
          continue;
        }

        // Extract tweet data
        const tweetContent = entry.content.itemContent;
        const tweetResult = tweetContent.tweet_results?.result;

        if (!tweetResult) continue;

        const tweetData = tweetResult.legacy;
        const userData = tweetResult.core?.user_results?.result?.legacy;

        if (!tweetData || !userData) continue;

        // Process media items
        const mediaItems = [];
        if (tweetData.extended_entities && tweetData.extended_entities.media) {
          for (const media of tweetData.extended_entities.media) {
            if (media.type === 'photo') {
              mediaItems.push({
                type: 'image',
                url: media.media_url_https,
              });
            } else if (media.type === 'video' || media.type === 'animated_gif') {
              // Find the best video variant
              const videoVariants = media.video_info?.variants || [];
              let bestVideo = null;
              let highestBitrate = 0;

              for (const variant of videoVariants) {
                if (variant.content_type === 'video/mp4' && variant.bitrate > highestBitrate) {
                  highestBitrate = variant.bitrate;
                  bestVideo = variant;
                }
              }

              if (bestVideo) {
                mediaItems.push({
                  type: 'video',
                  url: bestVideo.url,
                  isVideoThumbnail: false,
                });
              } else {
                // Fallback to thumbnail
                mediaItems.push({
                  type: 'video',
                  url: media.media_url_https,
                  isVideoThumbnail: true,
                });
              }
            }
          }
        }

        // Create normalized tweet object
        const tweet = {
          id: tweetData.id_str,
          text: tweetData.full_text,
          author: {
            name: userData.name,
            username: userData.screen_name,
            profileUrl: `https://twitter.com/${userData.screen_name}`,
            photo: userData.profile_image_url_https
          },
          createdAt: new Date(tweetData.created_at),
          url: `https://twitter.com/${userData.screen_name}/status/${tweetData.id_str}`,
          media: mediaItems,
          stats: {
            likes: tweetData.favorite_count,
            retweets: tweetData.retweet_count,
            replies: tweetData.reply_count
          }
        };

        tweets.push(tweet);
      }

      return { tweets, nextCursor };
    }

    // Make initial request
    let response = await makeRequest(null);
    allBookmarks.push(...response.tweets);
    cursor = response.nextCursor;

    // Fetch additional pages if more tweets are available
    const MAX_PAGES = 10; // Limit to 10 pages (up to 500 tweets) for safety
    let pageCount = 1;

    while (cursor && pageCount < MAX_PAGES) {
      console.log(`Fetching page ${pageCount + 1}, cursor: ${cursor}`);
      response = await makeRequest(cursor);

      if (response.tweets.length === 0) {
        break;
      }

      allBookmarks.push(...response.tweets);
      cursor = response.nextCursor;
      pageCount++;

      // Add a small delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`Fetched ${allBookmarks.length} bookmarks from ${pageCount} pages`);
    return allBookmarks;
  } catch (error) {
    console.error('Error fetching bookmarks via API:', error);
    throw error; // Rethrow to allow caller to handle
  }
}

/**
 * Fetches bookmarks from LinkedIn using their API
 * @param {string} csrfToken - LinkedIn CSRF token
 * @param {string} cookies - The cookies from the current LinkedIn session
 * @returns {Promise<Array>} - Promise resolving to an array of LinkedIn bookmark objects
 */
async function fetchLinkedInBookmarks(csrfToken, cookies) {
  console.log('Starting to fetch bookmarks via LinkedIn API...');

  // API endpoint for LinkedIn saved posts
  const baseEndpoint = 'https://www.linkedin.com/voyager/api/graphql';
  const queryId = 'voyagerSearchDashClusters.ed237181fcdbbd288bfcde627a5e2a07';
  const allBookmarks = [];
  let paginationToken = null;
  let start = 0;
  let hasMore = true;
  let retryCount = 0;
  const MAX_RETRIES = 3;
  const MAX_PAGES = 50; // Reduced from 400 since we'll fetch more per request
  const COUNT_PER_REQUEST = 100; // Increased count to get more posts per request
  let pageCount = 0;

  try {
    // Ensure we have the csrf token
    if (!csrfToken || !cookies) {
      throw new Error('Missing required authentication data');
    }

    // Attempt to extract JSESSIONID from cookies if not already provided
    if (cookies.includes('JSESSIONID') && !csrfToken.includes('JSESSIONID')) {
      const jsessionMatch = cookies.match(/JSESSIONID="?([^;"]+)"?/);
      if (jsessionMatch && jsessionMatch[1]) {
        // Use the full JSESSIONID value including "ajax:" prefix
        csrfToken = jsessionMatch[1];
        console.log('[LinkedIn] Using JSESSIONID from cookies as CSRF token:', 
          csrfToken.length > 15 ? csrfToken.substring(0, 15) + '...' : csrfToken);
      }
    }

    console.log('Using LinkedIn tokens to fetch bookmarks:');
    console.log('CSRF Token:', csrfToken.substring(0, 15) + '...');
    console.log('Cookies available:', cookies ? 'Yes (length: ' + cookies.length + ')' : 'No');

    // Keep requesting pages until we have all bookmarks or hit an error
    while (hasMore && retryCount < MAX_RETRIES && pageCount < MAX_PAGES) {
      try {
        // Build URL with proper pagination parameters and count parameter
        let variablesString = `(start:${start},count:${COUNT_PER_REQUEST},query:(flagshipSearchIntent:SEARCH_MY_ITEMS_SAVED_POSTS))`;
        
        // Add pagination token to the variables string if available
        if (paginationToken) {
          variablesString = `(start:${start},count:${COUNT_PER_REQUEST},paginationToken:${encodeURIComponent(paginationToken)},query:(flagshipSearchIntent:SEARCH_MY_ITEMS_SAVED_POSTS))`;
        }
        
        const url = `${baseEndpoint}?variables=${variablesString}&queryId=${queryId}`;

        // Set up request headers
        const headers = {
          'csrf-token': csrfToken,
          'x-restli-protocol-version': '2.0.0',
          'accept': 'application/vnd.linkedin.normalized+json+2.1',
          'x-li-lang': 'en_US',
          'x-li-track': '{"clientVersion":"1.13.*"}',
          'content-type': 'application/json',
          'Origin': 'https://www.linkedin.com',
          'Referer': 'https://www.linkedin.com/my-items/saved-posts/',
          'Cookie': cookies
        };

        console.log(`Making LinkedIn API request (page ${pageCount + 1}, start=${start}, count=${COUNT_PER_REQUEST})...`);
        if (paginationToken) {
          console.log(`Using pagination token: ${paginationToken.substring(0, 20)}...`);
        }

        // Make the API request
        const response = await fetch(url, {
          method: 'GET',
          headers: headers,
          credentials: 'include'
        });

        // Handle errors
        if (!response.ok) {
          const errorText = await response.text();
          console.error('LinkedIn API request failed:', response.status, response.statusText, errorText);
          
          if (response.status === 401 || response.status === 403) {
            throw new Error(`LinkedIn authentication failed. Please ensure you're logged in.`);
          }
          
          throw new Error(`LinkedIn API request failed: ${response.status} ${response.statusText}`);
        }

        // Parse response
        const data = await response.json();
        console.log('LinkedIn API response received');
        
        // Debug logging for response structure
        console.log('Response structure check:', JSON.stringify({
          hasData: !!data.data,
          hasSearchResults: data.data && !!data.data.searchDashClustersByAll,
          hasElements: data.data && data.data.searchDashClustersByAll && !!data.data.searchDashClustersByAll.elements,
          elementsLength: data.data && data.data.searchDashClustersByAll && data.data.searchDashClustersByAll.elements ? 
            data.data.searchDashClustersByAll.elements.length : 0
        }));

        // Use the provided extraction function
        const extractionResult = extractLinkedInSavedPosts(data);
        
        if (extractionResult.success) {
          console.log(`Successfully extracted ${extractionResult.count} posts from LinkedIn response`);
          
          // Add the extracted posts to our bookmarks array
          extractionResult.posts.forEach(item => {
            // Convert to our standard bookmark format
            const bookmark = {
              id: `linkedin-post-${Date.now()}-${allBookmarks.length}`,
              text: item.post.content || item.post.title,
              author: {
                name: item.user.name,
                profileUrl: item.user.profileUrl
              },
              url: item.post.postUrl,
              createdAt: item.post.timestamp, // Use the parsed timestamp
              media: []
            };
            
            // Add user image if available
            if (item.user.imageUrl) {
              // Store author profile image URL without modifying it
              bookmark.author.photo = item.user.imageUrl;
            }
            
            // Add post image if available
            if (item.post.imageUrl) {
              bookmark.media.push({
                type: 'image',
                url: item.post.imageUrl
              });
            }
            
            allBookmarks.push(bookmark);
          });
          
          // Get pagination information
          const metadata = data?.data?.data?.searchDashClustersByAll?.metadata;
          if (metadata && metadata.paginationToken) {
            paginationToken = metadata.paginationToken;
            console.log('Found pagination token for next page:', paginationToken.substring(0, 20) + '...');
            hasMore = true;
          } else {
            paginationToken = null;
            hasMore = false;
          }
          
          // Update start for next page (increment by COUNT_PER_REQUEST)
          start += COUNT_PER_REQUEST;
          
          // Increment page count
          pageCount++;
          
          // Reset retry count on successful request
          retryCount = 0;
        } else {
          console.error('Failed to extract LinkedIn posts:', extractionResult.error);
          console.log('Original response sample:', JSON.stringify(data).substring(0, 500) + '...');
          
          // Fallback to the original method if extraction failed
          if (data.data && data.data.searchDashClustersByAll) {
            // Get pagination info from metadata
            const metadata = data.data.searchDashClustersByAll.metadata;
            if (metadata && metadata.paginationToken) {
              paginationToken = metadata.paginationToken;
              hasMore = true;
            } else {
              paginationToken = null;
              hasMore = false;
            }
            
            // Process elements array if it exists using the older method
            processLinkedInResponseLegacy(data, allBookmarks);
            
            // Update start for next page (use COUNT_PER_REQUEST)
            start += COUNT_PER_REQUEST;
            
            // Increment page count
            pageCount++;
            
            // Reset retry count even if extraction failed but we have data
            retryCount = 0;
          } else {
            // No data at all, try again
            if (retryCount < MAX_RETRIES - 1) {
              retryCount++;
              console.log(`Retrying (${retryCount}/${MAX_RETRIES})...`);
              await new Promise(resolve => setTimeout(resolve, 1000)); // Wait before retry
              continue;
            } else {
              hasMore = false;
            }
          }
        }

        // If no posts were found in this page, stop pagination
        if (extractionResult.count === 0 && (!data.data || !data.data.searchDashClustersByAll || !data.data.searchDashClustersByAll.elements || data.data.searchDashClustersByAll.elements.length === 0)) {
          console.log('No more posts found in this page, stopping pagination');
          hasMore = false;
        }

        // Add a small delay between requests to avoid rate limiting
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (requestError) {
        console.error('Error in LinkedIn API request:', requestError);
        if (retryCount < MAX_RETRIES - 1) {
          retryCount++;
          console.log(`Retrying after error (${retryCount}/${MAX_RETRIES})...`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait before retry
        } else {
          throw requestError; // Give up after MAX_RETRIES attempts
        }
      }
    }

    console.log(`LinkedIn bookmarks fetched: ${allBookmarks.length} from ${pageCount} pages`);
    
    // Return the bookmarks we found (may be empty array if none found)
    return allBookmarks;
  } catch (error) {
    console.error('Error fetching LinkedIn bookmarks:', error);
    throw error; // Rethrow to allow caller to handle
  }
}

/**
 * Extracts saved posts data from LinkedIn API response using the provided approach
 * @param {Object} apiResponse - The raw API response from LinkedIn
 * @returns {Object} - Object with success flag, count and extracted posts
 */
function extractLinkedInSavedPosts(apiResponse) {
  try {
    // const items = apiResponse?.data?.searchDashClustersByAll?.elements?.[0]?.items || [];
    const items = apiResponse?.included?.filter(item => item.template !== undefined) || [];

    const extractedData = [];
    console.log('items[0]:', items[0]);
    for (const item of items) {
      // const entityResult = item?.item?.entityResult;
      // if (!entityResult) continue;

      const user = {
        name: item.title?.text || 'Unknown',
        profileUrl: item.actorNavigationUrl || item.actorNavigationContext?.url || null,
        imageUrl: item.image?.attributes?.[0]?.detailData?.nonEntityProfilePicture?.vectorImage?.artifacts?.[0]?.fileIdentifyingUrlPathSegment || item.image?.attributes?.[0]?.detailData?.nonEntityCompanyLogo?.vectorImage?.artifacts?.[0]?.fileIdentifyingUrlPathSegment
      };

      // Extract and parse timestamp
      let timestamp = null;
      if (item.secondarySubtitle?.text) {
        const timeText = item.secondarySubtitle.text.trim();
        // Parse relative time strings like "1h •", "1d •", "3d •", "2d â\u0080¢ ", "5m •", "3w •", "30s •", "2mo •", "1y •"
        const timeMatch = timeText.match(/(\d+)([hdwms]|mo|y)/i);
        
        if (timeMatch) {
          const value = parseInt(timeMatch[1], 10);
          const unit = timeMatch[2].toLowerCase();
          
          // Create a date object for the current time
          const date = new Date();
          
          // Subtract the appropriate amount of time
          if (unit === 'h') {
            // Hours ago
            date.setHours(date.getHours() - value);
          } else if (unit === 'd') {
            // Days ago
            date.setDate(date.getDate() - value);
          } else if (unit === 'w') {
            // Weeks ago
            date.setDate(date.getDate() - (value * 7));
          } else if (unit === 'm') {
            // Minutes ago
            date.setMinutes(date.getMinutes() - value);
          } else if (unit === 's') {
            // Seconds ago
            date.setSeconds(date.getSeconds() - value);
          } else if (unit === 'mo') {
            // Months ago
            date.setMonth(date.getMonth() - value);
          } else if (unit === 'y') {
            // Years ago
            date.setFullYear(date.getFullYear() - value);
          }
          
          timestamp = date;
        }
      }

      const post = {
        content: item.summary?.text || '',
        title: item.primarySubtitle?.text || '',
        postUrl: item.navigationUrl || (item.navigationContext?.url) || null,
        timestamp: timestamp,
        imageUrl: (() => {
          const rootUrl = item.entityEmbeddedObject?.image?.attributes?.[0]?.detailData?.vectorImage?.rootUrl;
          const pathSegment = item.entityEmbeddedObject?.image?.attributes?.[0]?.detailData?.vectorImage?.artifacts?.[0]?.fileIdentifyingUrlPathSegment;
          return (rootUrl && pathSegment) ? rootUrl + pathSegment : null;
        })()
      };
      console.log('user:', user, 'post:', post);
      extractedData.push({ user, post });
    }

    return {
      success: extractedData.length > 0,
      count: extractedData.length,
      posts: extractedData
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      originalResponse: JSON.stringify(apiResponse).substring(0, 500) + '...'
    };
  }
}

/**
 * Legacy method to process LinkedIn response data if the new extraction fails
 * @param {Object} data - The API response data
 * @param {Array} allBookmarks - Array to add the extracted bookmarks to
 */
function processLinkedInResponseLegacy(data, allBookmarks) {
  if (!data.data || !data.data.searchDashClustersByAll || !data.data.searchDashClustersByAll.elements) {
    return;
  }
  
  const elements = data.data.searchDashClustersByAll.elements || [];
  console.log(`Legacy processing: Found ${elements.length} element clusters`);
  
  for (const cluster of elements) {
    if (!cluster.items || !Array.isArray(cluster.items)) {
      continue;
    }
    
    for (const item of cluster.items) {
      try {
        if (!item.item || !item.item.entityResult) {
          continue;
        }
        
        const result = item.item.entityResult;
        
        // Extract author name (from title)
        let authorName = 'Unknown';
        let authorProfileUrl = '#';
        
        if (result.title && result.title.text) {
          authorName = result.title.text;
        }
        
        if (result.actorNavigationContext && result.actorNavigationContext.url) {
          authorProfileUrl = result.actorNavigationContext.url;
        }
        
        // Extract post text (from summary)
        let postText = '';
        if (result.summary && result.summary.text) {
          postText = result.summary.text;
        } else if (result.primarySubtitle && result.primarySubtitle.text) {
          // Fallback to primarySubtitle if summary is missing
          postText = result.primarySubtitle.text;
        }
        
        // Get the post URL
        const postUrl = result.navigationUrl || 
                        (result.navigationContext && result.navigationContext.url) || 
                        '#';
        
        // Get image URL if available
        let imageUrl = '';
        if (result.entityEmbeddedObject && result.entityEmbeddedObject.image) {
          const image = result.entityEmbeddedObject.image;
          if (image.attributes && image.attributes.length > 0) {
            const attribute = image.attributes[0];
            if (attribute.detailData && attribute.detailData.vectorImage) {
              const vectorImage = attribute.detailData.vectorImage;
              if (vectorImage.artifacts && vectorImage.artifacts.length > 0) {
                // Get the largest image
                const largestImage = vectorImage.artifacts.reduce((prev, curr) => 
                  (curr.width > prev.width) ? curr : prev, { width: 0 });
                
                if (largestImage.fileIdentifyingUrlPathSegment && vectorImage.rootUrl) {
                  imageUrl = vectorImage.rootUrl + largestImage.fileIdentifyingUrlPathSegment;
                }
              }
            }
          }
        }
        //Get the createdAt date
        let createdAt = null;
        if (result.secondarySubtitle && result.secondarySubtitle.text) {
          const timeText = result.secondarySubtitle.text.trim();
          // Parse relative time strings like "1h •", "1d •", "3d •", "2d â\u0080¢ ", "5m •", "30s •", "2mo •", "1y •"
          const timeMatch = timeText.match(/(\d+)([hdms]|mo|y)/i);
          
          if (timeMatch) {
            const value = parseInt(timeMatch[1], 10);
            const unit = timeMatch[2].toLowerCase();
            
            // Create a date object for the current time
            const date = new Date();
            
            // Subtract the appropriate amount of time
            if (unit === 'h') {
              // Hours ago
              date.setHours(date.getHours() - value);
            } else if (unit === 'd') {
              // Days ago
              date.setDate(date.getDate() - value);
            } else if (unit === 'm') {
              // Minutes ago
              date.setMinutes(date.getMinutes() - value);
            } else if (unit === 's') {
              // Seconds ago
              date.setSeconds(date.getSeconds() - value);
            } else if (unit === 'mo') {
              // Months ago
              date.setMonth(date.getMonth() - value);
            } else if (unit === 'y') {
              // Years ago
              date.setFullYear(date.getFullYear() - value);
            }
            
            createdAt = date;
          }
        }

        
        // Create a normalized bookmark object
        const bookmark = {
          id: result.trackingUrn || `linkedin-post-${Date.now()}-${allBookmarks.length}`,
          text: postText,
          author: {
            name: authorName,
            profileUrl: authorProfileUrl
          },
          url: postUrl,
          createdAt: createdAt, // Now using the parsed date
          media: []
        };
        
        // Add image if available
        if (imageUrl) {
          bookmark.media.push({
            type: 'image',
            url: imageUrl
          });
        }
        
        allBookmarks.push(bookmark);
      } catch (itemError) {
        console.error('Error processing LinkedIn post item:', itemError);
        // Continue with next item
      }
    }
  }
}
