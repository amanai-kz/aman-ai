# AMAN AI Chrome Extension

AI-powered medical consultation assistant. Record and analyze patient consultations with SOAP format.

## Features

- **Quick Access**: Start consultations from any webpage via the floating action button
- **Recent Consultations**: View your recent consultations in the popup
- **Dashboard Access**: Quick links to the AMAN AI dashboard

## Installation (Development)

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right corner
3. Click "Load unpacked" and select the `chrome-extension` folder
4. The extension icon will appear in your browser toolbar

## Generating PNG Icons

The icons are provided as SVGs. To convert them to PNG (required by Chrome):

### Using ImageMagick:
```bash
cd icons
for size in 16 32 48 128; do
  convert icon${size}.svg icon${size}.png
done
```

### Using online tools:
1. Go to https://cloudconvert.com/svg-to-png
2. Upload each SVG file
3. Set output size matching the filename (16x16, 32x32, etc.)
4. Download and rename to `.png`

## Usage

1. **Popup**: Click the extension icon to see recent consultations and quick actions
2. **Floating Button**: On any webpage, a floating button appears in the bottom-right corner
3. Click to open a new consultation in AMAN AI

## Files

- `manifest.json` - Extension configuration
- `popup.html/css/js` - Popup UI when clicking the extension icon
- `background.js` - Background service worker for handling messages
- `content.js/css` - Content script injected into webpages (floating button)
- `icons/` - Extension icons in various sizes

## Privacy

This extension:
- Only communicates with amanai.kz servers
- Does not collect any browsing data
- Does not access page content
- Only activates when you click the extension or floating button

## Version

1.0.0 - Initial release

