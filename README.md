# rockstar v1.1 by Pixamation

<p align="center">
  <img src="assets/icon.png" alt="rockstar v1.1 by Pixamation" width="128" height="128">
</p>

<p align="center">
  <strong>Professional audio playback application for radio broadcasting and live audio management</strong>
</p>

<p align="center">
  <a href="webapp/">Web App</a> •
  <a href="macos/">Download for macOS</a> •
  <a href="windows/">Download for Windows</a>
</p>

---

## Project Structure

```
player/
├── index.html          # Landing page (bitmapped.com/player)
├── styles.css          # Landing page styles
├── assets/             # Landing page assets
│
├── webapp/             # Browser-based web application
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   └── assets/
│
├── macos/              # macOS downloads
│   ├── Rockstar by Pixamation-1.0.0-arm64.dmg
│   └── Rockstar by Pixamation-1.0.0-arm64-mac.zip
│
├── windows/            # Windows downloads
│   └── Rockstar by Pixamation Setup 1.0.0.exe
│
└── desktop-src/        # Desktop app source code
    ├── package.json
    ├── main.js
    └── ...
```

## Platforms

### Web App
Use rockstar directly in your browser with no installation required.
- Works on any device with a modern browser
- Drag & drop audio files to add them
- Files stored in browser session

### macOS Desktop
Native Electron app for macOS.
- Full file system access
- Persistent settings and hot buttons
- System menu integration

### Windows Desktop
Native Electron app for Windows.
- Full file system access
- Persistent settings and hot buttons
- System tray integration

## Features

- **4 Simultaneous Audio Decks** - Play multiple audio files at once
- **10 Hot Buttons** - Instant access to frequently used sounds
- **Queue System** - Automatic playback of queued items
- **Drag & Drop** - Intuitive file management
- **Volume Controls** - Master and per-deck volume faders
- **Real-time Timers** - Elapsed, remaining, and total time display
- **Search** - Find audio files quickly
- **Keyboard Shortcuts** - Fast control during live use

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `1-4` | Play deck 1-4 |
| `Shift + 1-4` | Stop deck 1-4 |
| `F1-F10` | Play hot button 1-10 |
| `Space` | Toggle play/pause on deck 1 |

## Building from Source

```bash
cd desktop-src
npm install

# Build for macOS
npm run build:mac

# Build for Windows
npm run build:win

# Build for Linux
npm run build:linux
```

## Deployment

To deploy to bitmapped.com/player:

1. Upload the entire `player/` folder contents to the web server
2. The landing page will be at `/player/`
3. Web app will be at `/player/webapp/`
4. Downloads will be available from `/player/macos/` and `/player/windows/`

## License

MIT License - See [LICENSE](LICENSE) file for details.

---

<p align="center">
  <strong>rockstar v1.1 by Pixamation</strong><br>
  Making audio management simple and powerful
</p>
