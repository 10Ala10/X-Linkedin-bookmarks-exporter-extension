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
  
  // Set up the bookmarks list container
  setupBookmarksContainer();
  
  // Set up the export button
  setupExportButton();
  
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
        
        // Clear bookmarks list
        const bookmarksList = document.getElementById('bookmarksList');
        bookmarksList.innerHTML = '';
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
        
        // Clear bookmarks list
        const bookmarksList = document.getElementById('bookmarksList');
        bookmarksList.innerHTML = '';
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
   * Sets up the bookmarks container element
   */
  function setupBookmarksContainer() {
    // Create or use existing bookmarks list container
    let bookmarksList = document.getElementById('bookmarksList');
    if (!bookmarksList) {
      bookmarksList = document.createElement('div');
      bookmarksList.id = 'bookmarksList';
      popupContent.appendChild(bookmarksList);
    }
  }
  
  /**
   * Sets up the main export button and its event listener
   */
  function setupExportButton() {
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

    // Create export button
    const exportButton = document.createElement('button');
    exportButton.id = 'export-bookmarks-btn';
    exportButton.textContent = 'Get My Bookmarks';
    exportButton.title = 'Automatically extracts authentication tokens from your active Twitter session and exports your bookmarks';

    // Add button to container and container to popup
    buttonContainer.appendChild(exportButton);
    popupContent.insertBefore(buttonContainer, document.getElementById('bookmarksList'));
    
    // Add click event listener to the export button
    exportButton.addEventListener('click', handleExportButtonClick);
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
      showLoadingMessage(`Looking for ${currentPlatform} authentication tokens...`);

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
          This may take a moment if we need to monitor network traffic.
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
        <strong>No ${platformName} authentication tokens detected yet.</strong>
      </div>
      <div style="margin-bottom: 15px;">
        Please interact with ${platformName} to generate some API requests:
      </div>
      <ol style="text-align: left; margin: 15px auto; max-width: 400px;">
        <li>Make sure you're logged in to ${platformName}</li>
        <li>Navigate to your <a href="${platformUrl}" target="_blank">${platform === 'twitter' ? 'bookmarks' : 'saved posts'} page</a></li>
        <li>Scroll down a bit to load more content</li>
        <li>Try clicking on a few items or refreshing the page</li>
        <li>Then click "Get My Bookmarks" again</li>
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
  
  // Update status
  statusDiv.textContent = `Found ${bookmarksArray.length} ${platformName} ${itemName}!`;
  console.log(`Displaying ${bookmarksArray.length} ${platformName} ${itemName}`);

  // Clear previous content
  bookmarksList.innerHTML = '';

  // Add options and export buttons
  const optionsBar = document.createElement('div');
  optionsBar.className = 'sort-options';
  
  // Basic sort options
  let optionsHTML = `
    <label>Sort by: 
      <select id="sort-bookmarks">
        <option value="newest">Newest first</option>
        <option value="oldest">Oldest first</option>
      </select>
    </label>
    <button id="export-json">Export JSON</button>
  `;
  
  // Add debug button in development
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1' || true) { // Always show for now
    optionsHTML += `<button id="show-raw-json" style="margin-left: 10px;">Show Raw JSON</button>`;
  }
  
  optionsBar.innerHTML = optionsHTML;
  bookmarksList.appendChild(optionsBar);

  // Add export functionality
  document.getElementById('export-json').addEventListener('click', () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(bookmarksArray, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute('href', dataStr);
    downloadAnchorNode.setAttribute('download', `${platform}-${itemName}-${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  });
  
  // Add debug JSON view functionality
  const rawJsonButton = document.getElementById('show-raw-json');
  if (rawJsonButton) {
    rawJsonButton.addEventListener('click', () => {
      const jsonContainer = document.createElement('div');
      jsonContainer.style.margin = '10px 0';
      jsonContainer.style.padding = '10px';
      jsonContainer.style.border = '1px solid #ccc';
      jsonContainer.style.backgroundColor = '#f9f9f9';
      jsonContainer.style.maxHeight = '300px';
      jsonContainer.style.overflow = 'auto';
      jsonContainer.style.whiteSpace = 'pre-wrap';
      jsonContainer.style.fontSize = '12px';
      jsonContainer.style.fontFamily = 'monospace';
      
      jsonContainer.textContent = JSON.stringify(bookmarksArray, null, 2);
      
      // If there's already a JSON container, replace it, otherwise add it
      const existingContainer = document.querySelector('.json-debug-container');
      if (existingContainer) {
        existingContainer.remove();
        rawJsonButton.textContent = 'Show Raw JSON';
      } else {
        jsonContainer.className = 'json-debug-container';
        bookmarksList.insertBefore(jsonContainer, document.querySelector('.bookmarks-container'));
        rawJsonButton.textContent = 'Hide Raw JSON';
      }
    });
  }

  // Add sort functionality
  document.getElementById('sort-bookmarks').addEventListener('change', function() {
    const sortValue = this.value;
    const sortedBookmarks = [...bookmarksArray];
    
    if (sortValue === 'oldest') {
      // For Twitter bookmarks with createdAt, sort by that
      // For LinkedIn, we may not have this info
      sortedBookmarks.sort((a, b) => {
        if (a.createdAt && b.createdAt) {
          return new Date(a.createdAt) - new Date(b.createdAt);
        }
        return 0; // No reliable date to sort by
      });
    } else {
      // Newest first (default)
      sortedBookmarks.sort((a, b) => {
        if (a.createdAt && b.createdAt) {
          return new Date(b.createdAt) - new Date(a.createdAt);
        }
        return 0; // No reliable date to sort by
      });
    }
    
    renderBookmarks(sortedBookmarks);
  });

  // Create container for the bookmarks
  const bookmarksContainer = document.createElement('div');
  bookmarksContainer.className = 'bookmarks-container';
  bookmarksList.appendChild(bookmarksContainer);

  // Render initial bookmarks
  renderBookmarks(bookmarksArray);

  /**
   * Renders the bookmark items in the container
   * @param {Array} items - The bookmarks to render
   */
  function renderBookmarks(items) {
    const container = document.querySelector('.bookmarks-container');
    container.innerHTML = '';
    
    // Show message if no bookmarks
    if (items.length === 0) {
      container.innerHTML = `
        <div class="no-bookmarks-message">
          ${platform === 'linkedin' 
            ? `No ${itemName} found. It looks like you haven't saved any LinkedIn posts yet, or they couldn't be retrieved.`
            : `No ${itemName} found. Try visiting your ${platformName} ${itemName} page and try again.`}
        </div>
      `;
      return;
    }
    
    // Create bookmarks HTML
    items.forEach(bookmark => {
      const card = document.createElement('div');
      card.className = 'bookmark-card';
      
      // Common card header with author info
      let cardHeader = `
        <div class="bookmark-header">
          <div class="bookmark-author">
            ${bookmark.author && bookmark.author.photo ? 
              `<img src="${bookmark.author.photo}" alt="${bookmark.author.name || 'Author'}" class="author-photo" onerror="this.style.display='none';" />` : 
              ''}
            <a href="${bookmark.author && bookmark.author.profileUrl ? bookmark.author.profileUrl : '#'}" target="_blank" class="author-link">
              ${bookmark.author && bookmark.author.name ? bookmark.author.name : 'Unknown'}
            </a>
          </div>
      `;
      
      // Add date if available
      if (bookmark.createdAt) {
        let date;
        // Check if the date is already a Date object or needs to be parsed
        if (typeof bookmark.createdAt === 'string') {
          date = new Date(bookmark.createdAt); // This handles Twitter's format
        } else {
          date = bookmark.createdAt; // This handles LinkedIn's parsed Date objects
        }
        
        // Format the date consistently
        const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
        cardHeader += `<div class="bookmark-date">${formattedDate}</div>`;
      }
      
      cardHeader += `</div>`;
      
      // Bookmark content with text
      let cardContent = `
        <div class="bookmark-content">
          <div class="bookmark-text">${bookmark.text || 'No text content'}</div>
      `;
      
      // Add media if available
      if (bookmark.media && bookmark.media.length > 0) {
        cardContent += `<div class="bookmark-media">`;
        
        bookmark.media.forEach(media => {
          if (media.type === 'image') {
            cardContent += `
              <div class="media-item">
                <img src="${media.url}" alt="Bookmark image" class="media-image" onerror="this.onerror=null; this.src='data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22100%22%20height%3D%22100%22%3E%3Crect%20fill%3D%22%23f2f2f2%22%20width%3D%22100%22%20height%3D%22100%22%2F%3E%3Ctext%20fill%3D%22%23999%22%20font-family%3D%22sans-serif%22%20font-size%3D%2212%22%20x%3D%2210%22%20y%3D%2255%22%3EImage%20unavailable%3C%2Ftext%3E%3C%2Fsvg%3E';" />
              </div>
            `;
          } else if (media.type === 'video') {
            if (media.isVideoThumbnail) {
              // Show image as thumbnail for video
              cardContent += `
                <div class="media-item">
                  <div class="video-thumbnail">
                    <img src="${media.url}" alt="Video thumbnail" class="media-image" onerror="this.onerror=null; this.src='data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22100%22%20height%3D%22100%22%3E%3Crect%20fill%3D%22%23f2f2f2%22%20width%3D%22100%22%20height%3D%22100%22%2F%3E%3Ctext%20fill%3D%22%23999%22%20font-family%3D%22sans-serif%22%20font-size%3D%2212%22%20x%3D%2210%22%20y%3D%2255%22%3EVideo%20thumbnail%20unavailable%3C%2Ftext%3E%3C%2Fsvg%3E';" />
                    <div class="video-play-icon">▶</div>
                  </div>
                </div>
              `;
            } else {
              // Show video player
              cardContent += `
                <div class="media-item">
                  <video controls class="media-video">
                    <source src="${media.url}" type="video/mp4">
                    Your browser does not support the video tag.
                  </video>
                </div>
              `;
            }
          }
        });
        
        cardContent += `</div>`;
      }
      
      cardContent += `</div>`;
      
      // Card footer with link to original post
      const cardFooter = `
        <div class="bookmark-footer">
          <a href="${bookmark.url || '#'}" target="_blank" class="bookmark-link">
            Open original ${platform === 'twitter' ? 'tweet' : 'post'}
          </a>
        </div>
      `;
      
      // Combine all parts
      card.innerHTML = cardHeader + cardContent + cardFooter;
      container.appendChild(card);
    });
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
        count: 50, // Request more bookmarks per page
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
    while (hasMore && retryCount < MAX_RETRIES) {
      try {
        // Construct the variables for the GraphQL query
        const variables = {
          start: start,
          query: {
            flagshipSearchIntent: 'SEARCH_MY_ITEMS_SAVED_POSTS'
          }
        };

        // Add pagination token if we have one
        if (paginationToken) {
          variables.paginationToken = paginationToken;
        }

        // Build URL - use LinkedIn's preferred format instead of encoding the entire JSON
        // Format: (start:0,query:(flagshipSearchIntent:SEARCH_MY_ITEMS_SAVED_POSTS))
        let variablesString = `(start:${start},query:(flagshipSearchIntent:SEARCH_MY_ITEMS_SAVED_POSTS))`;
        
        // Add pagination token to the variables string if available
        if (paginationToken) {
          variablesString = variablesString.replace(')', `,paginationToken:${encodeURIComponent(paginationToken)})`);
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

        console.log(`Making LinkedIn API request (page ${start > 0 ? start/10 + 1 : 1})...`);

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
          const metadata = data?.data?.searchDashClustersByAll?.metadata;
          if (metadata && metadata.paginationToken) {
            paginationToken = metadata.paginationToken;
            console.log('Found pagination token for next page:', paginationToken.substring(0, 20) + '...');
          } else {
            paginationToken = null;
          }
          
          // Check if there are more items to fetch
          hasMore = !!paginationToken;
          
          // Reset retry count on successful request
          retryCount = 0;
          
          // Update start for next page
          if (hasMore) {
            // Increment by the page size (typically 10)
            start += 10;
          }
        } else {
          console.error('Failed to extract LinkedIn posts:', extractionResult.error);
          console.log('Original response sample:', JSON.stringify(data).substring(0, 500) + '...');
          
          // Fallback to the original method if extraction failed
          if (data.data && data.data.searchDashClustersByAll) {
            // Get pagination info from metadata
            const metadata = data.data.searchDashClustersByAll.metadata;
            if (metadata && metadata.paginationToken) {
              paginationToken = metadata.paginationToken;
            } else {
              paginationToken = null;
            }
            
            // Check if there are more items to fetch
            hasMore = !!paginationToken;
            
            // Process elements array if it exists using the older method
            processLinkedInResponseLegacy(data, allBookmarks);
            
            // Update start for next page
            if (hasMore) {
              // Increment by the page size (typically 10)
              start += 10;
            }
            
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

    console.log(`LinkedIn bookmarks fetched: ${allBookmarks.length}`);
    
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
        imageUrl: item.image?.attributes?.[0]?.detailData?.nonEntityProfilePicture?.vectorImage?.artifacts?.[0]?.fileIdentifyingUrlPathSegment || null
      };

      // Extract and parse timestamp
      let timestamp = null;
      if (item.secondarySubtitle?.text) {
        const timeText = item.secondarySubtitle.text.trim();
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
          
          timestamp = date;
        }
      }

      const post = {
        content: item.summary?.text || '',
        title: item.primarySubtitle?.text || '',
        postUrl: item.navigationUrl || (item.navigationContext?.url) || null,
        timestamp: timestamp,
        imageUrl: item.entityEmbeddedObject?.image?.attributes?.[0]?.detailData?.vectorImage.rootUrl + item.entityEmbeddedObject?.image?.attributes?.[0]?.detailData?.vectorImage?.artifacts?.[0]?.fileIdentifyingUrlPathSegment || null
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
                
                if (largestImage.fileIdentifyingUrlPathSegment) {
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
