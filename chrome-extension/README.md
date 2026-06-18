# DISPARO WINC - Chrome Extension

Google Chrome extension version of DISPARO WINC, with a narrow dark neon popup inspired by the ZDG/Nexus style.

## Included

- Manifest V3
- Responsive popup in a compact side-panel format
- WPP Connect / Official API switch
- Demo online/offline session state
- Multiple-number input
- CSV upload
- Sample contact and group import
- Number, duplicate, and invalid-row validation
- Message variables
- Emoji support
- Image, video, PDF, and audio attachment field
- Minimum/maximum interval control
- Queue preparation
- Simulated safe-mode sending
- Pause, resume, and cancel controls
- Real-time logs
- Persistence in `chrome.storage.local`
- Options page for backend URL/token
- WhatsApp Web content script with DISPARO WINC badge

## Local Install

1. Open `chrome://extensions`
2. Enable `Developer mode`
3. Click `Load unpacked`
4. Select the `chrome-extension` folder
5. Pin the extension in Chrome

## Package

Use the generated `stable-public/disparo-winc-chrome-extension.zip` file, or create a new package with:

```powershell
Compress-Archive -Path chrome-extension\* -DestinationPath stable-public\disparo-winc-chrome-extension.zip -Force
```

## Real Sending

This version does not force direct automation inside WhatsApp Web. For real sending, configure the backend URL in `Options` and connect it to the Node.js/WPP/Official API backend.

Use only consent-based lists and respect WhatsApp/Meta policies, opt-out requests, volume limits, and sending windows.
