/**
 * Twitter Bookmarks Exporter - Popup Script
 * 
 * This script handles the user interface and main functionality
 * for the Twitter Bookmarks Exporter extension.
 */

// Initialize the popup UI when the DOM content is loaded
document.addEventListener('DOMContentLoaded', function () {
  // Cache DOM elements
  const popupContent = document.getElementById('popup-content');
  const statusDiv = document.getElementById('status');
  
  // Set up the bookmarks list container
  setupBookmarksContainer();
  
  // Set up the export button
  setupExportButton();
  
  // Update the initial status text
  statusDiv.textContent = 'Ready to export your Twitter bookmarks';

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

      // Verify we're on Twitter
      if (!tab.url.includes('twitter.com') && !tab.url.includes('x.com')) {
        statusDiv.textContent = 'Opening Twitter/X for you...';
        chrome.tabs.update(tab.id, { url: 'https://twitter.com/i/bookmarks' });
        
        // Add a listener to automatically click the export button once Twitter loads
        chrome.tabs.onUpdated.addListener(function tabUpdateListener(tabId, changeInfo, updatedTab) {
          // Check if this is our tab and it has finished loading
          if (tabId === tab.id && changeInfo.status === 'complete' && 
              (updatedTab.url.includes('twitter.com') || updatedTab.url.includes('x.com'))) {
            // Remove this listener to avoid duplicate calls
            chrome.tabs.onUpdated.removeListener(tabUpdateListener);
            // Wait a moment for the page to fully render then trigger export
            setTimeout(() => handleExportButtonClick(), 1500);
          }
        });
        
        return;
      }

      // Update UI to show we're working
      statusDiv.textContent = 'Checking for authentication tokens...';
      showLoadingMessage('Looking for authentication tokens...');

      // Request tokens from the background script
      chrome.runtime.sendMessage({ action: 'getAuthTokens' }, async response => {
        console.log('Token response from background:', response);

        if (!response || !response.success) {
          // No tokens available yet
          handleMissingTokens(statusDiv, document.getElementById('bookmarksList'));
          return;
        }

        // We have tokens! Now fetch bookmarks
        const tokens = response.tokens;
        statusDiv.textContent = 'Authentication tokens found! Fetching bookmarks...';

        try {
          // Fetch bookmarks using the API
          const csrfToken = tokens.csrfToken;
          const authToken = tokens.authToken;

          console.log('Using tokens to fetch bookmarks:');
          console.log('CSRF Token:', csrfToken.substring(0, 10) + '...');
          console.log('Auth Token:', authToken.substring(0, 20) + '...');

          // Show loading message
          showLoadingMessage('Fetching bookmarks via API...');

          // Fetch bookmarks directly
          const bookmarks = await fetchTwitterBookmarks(csrfToken, authToken, document.cookie);

          if (!bookmarks || bookmarks.length === 0) {
            throw new Error('No bookmarks returned from API');
          }

          // Success! Display the bookmarks
          displayBookmarks(bookmarks, statusDiv, document.getElementById('bookmarksList'));
        } catch (fetchError) {
          console.error('Error fetching bookmarks:', fetchError);
          statusDiv.textContent = 'Error fetching bookmarks from Twitter API';
          
          showErrorMessage(
            `Error fetching bookmarks: ${fetchError.message}`,
            'Please try again after refreshing Twitter.'
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
 */
function handleMissingTokens(statusDiv, bookmarksList) {
  statusDiv.textContent = 'No authentication tokens found yet.';
  bookmarksList.innerHTML = `
    <div class="centered-message">
      <div class="error-message" style="margin-bottom: 15px;">
        <strong>No authentication tokens detected yet.</strong>
      </div>
      <div style="margin-bottom: 15px;">
        Please interact with Twitter to generate some API requests:
      </div>
      <ol style="text-align: left; margin: 15px auto; max-width: 400px;">
        <li>Make sure you're logged in to Twitter/X</li>
        <li>Navigate to your <a href="https://twitter.com/i/bookmarks" target="_blank">bookmarks page</a></li>
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
 */
function displayBookmarks(bookmarks, statusDiv, bookmarksList) {
  // Update status
  statusDiv.textContent = `Found ${bookmarks.length} bookmarks!`;

  // Clear previous content
  bookmarksList.innerHTML = '';

  // Add sort options and export button
  const sortOptions = document.createElement('div');
  sortOptions.className = 'sort-options';
  sortOptions.innerHTML = `
    <label>Sort by: 
      <select id="sort-bookmarks">
        <option value="newest">Newest first</option>
        <option value="oldest">Oldest first</option>
      </select>
    </label>
    <button id="export-json">Export JSON</button>
  `;
  bookmarksList.appendChild(sortOptions);

  // Add export functionality
  document.getElementById('export-json').addEventListener('click', () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(bookmarks, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute('href', dataStr);
    downloadAnchorNode.setAttribute('download', 'twitter_bookmarks.json');
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  });

  // Define a function to render the bookmarks
  const renderBookmarks = sortedBookmarks => {
    // Clear previous bookmarks
    while (bookmarksList.children.length > 1) {
      bookmarksList.removeChild(bookmarksList.lastChild);
    }

    // Display the bookmarks
    sortedBookmarks.forEach(bookmark => {
      const bookmarkElement = document.createElement('div');
      bookmarkElement.className = 'bookmark-item';

      // Generate HTML for media items (images/videos)
      let mediaHTML = '';
      if (bookmark.media && bookmark.media.length > 0) {
        mediaHTML = '<div class="media-container">';
        bookmark.media.forEach(mediaItem => {
          if (mediaItem.type === 'image') {
            // Render image
            mediaHTML += `<img src="${mediaItem.url}" class="tweet-image">`;
          } else if (mediaItem.type === 'video') {
            if (mediaItem.isVideoThumbnail) {
              // For video thumbnails, show the image with a play button overlay and link to original tweet
              mediaHTML += `
                <a href="${bookmark.link}" target="_blank" style="display: block; text-decoration: none; cursor: pointer;">
                  <div class="video-container">
                    <img src="${mediaItem.url}" class="tweet-image">
                    <div class="video-overlay">
                      <div class="play-button"></div>
                    </div>
                    <div class="video-caption">
                      Click to watch on Twitter/X
                    </div>
                  </div>
                </a>
              `;
            } else {
              // For actual video URLs that we can play directly
              const videoExtension = mediaItem.url.split('.').pop().toLowerCase();
              const mimeType = videoExtension === 'mp4' ? 'video/mp4' : 
                               videoExtension === 'm3u8' ? 'application/x-mpegURL' : 
                               'video/mp4'; // default fallback

              mediaHTML += `
                <div class="video-container">
                  <video controls class="video-player">
                    <source src="${mediaItem.url}" type="${mimeType}">
                    Your browser does not support the video tag.
                  </video>
                  <a href="${bookmark.link}" target="_blank" class="twitter-link">
                    Open in Twitter
                  </a>
                </div>
              `;
            }
          }
        });
        mediaHTML += '</div>';
      }

      // Populate bookmark element with content
      bookmarkElement.innerHTML = `
        <strong>${bookmark.text}</strong><br>
        ${mediaHTML}
        <div class="author-info">
          ${
            bookmark.authorPhoto
              ? `<img src="${bookmark.authorPhoto}" class="author-photo">`
              : ''
          }
          <span class="author-username">@${bookmark.authorUsername || 'Unknown'}</span>
        </div>
        <div class="timestamp">
          ${bookmark.timestamp || ''}
        </div>
        <a href="${bookmark.link}" target="_blank">View Tweet</a>
      `;
      bookmarksList.appendChild(bookmarkElement);
    });
  };

  // Sort the bookmarks by timestamp (newest first by default)
  let sortedBookmarks = [...bookmarks].sort((a, b) => {
    return new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
  });

  // Render the bookmarks
  renderBookmarks(sortedBookmarks);

  // Add event listener for sorting
  document.getElementById('sort-bookmarks').addEventListener('change', e => {
    const sortOrder = e.target.value;
    if (sortOrder === 'newest') {
      sortedBookmarks = [...bookmarks].sort((a, b) => {
        return new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
      });
    } else {
      sortedBookmarks = [...bookmarks].sort((a, b) => {
        return new Date(a.timestamp || 0) - new Date(b.timestamp || 0);
      });
    }
    renderBookmarks(sortedBookmarks);
  });

  // Log to console
  console.log('Scraped Bookmarks:', bookmarks);
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
          tweetId: tweetData.id_str,
          text: tweetData.full_text,
          authorUsername: userData.screen_name,
          authorName: userData.name,
          authorPhoto: userData.profile_image_url_https,
          timestamp: new Date(tweetData.created_at).toLocaleString(),
          originalTimestamp: tweetData.created_at,
          link: `https://twitter.com/${userData.screen_name}/status/${tweetData.id_str}`,
          media: mediaItems,
          likes: tweetData.favorite_count,
          retweets: tweetData.retweet_count,
          replies: tweetData.reply_count,
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