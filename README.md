# Social Bookmarks Exporter Chrome Extension

A Chrome extension that allows you to export your bookmarks and saved posts from Twitter/X and LinkedIn in a convenient format.

## Features

- Automatically captures authentication tokens
- Extracts bookmarks directly from platform APIs
- Displays bookmarks with images and videos
- Allows sorting by newest or oldest first
- Export bookmarks as JSON
- Supports both Twitter/X and LinkedIn

## How to Install

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" in the top right corner
3. Click "Load unpacked" and select this folder
4. The extension should now appear in your Chrome toolbar

## How to Use

### For Twitter/X Bookmarks:

1. Navigate to Twitter/X and log in
2. Click the extension icon in your Chrome toolbar
3. Ensure "Twitter/X" is selected in the platform selector
4. Click "Get My Bookmarks" 
5. If needed, interact with Twitter to generate API requests
6. Your bookmarks will be displayed and you can export them

### For LinkedIn Saved Posts:

1. Navigate to LinkedIn and log in
2. Click the extension icon in your Chrome toolbar
3. Select "LinkedIn" in the platform selector
4. Click "Get My Bookmarks" 
5. If needed, interact with LinkedIn to generate API requests
6. Your saved posts will be displayed and you can export them

## Project Structure

```
├── manifest.json         # Extension configuration
├── README.md             # This file
├── src/                  # Source code
│   ├── css/              # Stylesheets
│   │   └── styles.css    # Main styles
│   ├── html/             # HTML files
│   │   └── popup.html    # Popup interface
│   ├── images/           # Icons and images
│   │   ├── icon16.png    # 16x16 icon
│   │   ├── icon48.png    # 48x48 icon
│   │   └── icon128.png   # 128x128 icon
│   └── js/               # JavaScript files
│       ├── background.js # Background service worker
│       └── popup.js      # Popup interface logic
```

## Development

### Requirements

- Chrome browser
- Knowledge of HTML, CSS, and JavaScript

### Local Development

1. Clone this repository
2. Make your changes to the files in the `src` directory
3. Load the extension in Chrome using Developer mode

## Notes

- The extension requires a set of authentication tokens from each platform to function
- It automatically captures these tokens from your active sessions
- No data is sent to any third-party servers - all processing happens locally 