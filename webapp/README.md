# rockstar v1.2 by Pixamation - Web Version

This is the browser-based version of rockstar that can be deployed to any web server.

## Deployment

Simply upload the contents of this folder to your web server:

```
webapp/
├── index.html
├── styles.css
├── app.js
├── assets/
│   ├── icon.png
│   └── pixamation-logo.png
└── README.md
```

### Deploy to bitmapped.com/player

1. Upload all files to your server's `/player` directory
2. Access at `https://bitmapped.com/player`

### Local Testing

You can test locally by running a simple HTTP server:

```bash
# Using Python 3
cd webapp
python3 -m http.server 8080

# Using Node.js (npx)
npx serve .

# Using PHP
php -S localhost:8080
```

Then open `http://localhost:8080` in your browser.

## Features

All the same features as the desktop app:

- **4 Audio Decks** - Play multiple audio files simultaneously
- **10 Hot Buttons** - Quick access to frequently used sounds
- **Queue System** - Line up audio for automatic playback
- **Drag & Drop** - Add files by dragging onto the page
- **Search** - Filter your audio library
- **Keyboard Shortcuts** - Fast control during live use

## Differences from Desktop Version

| Feature | Desktop | Web |
|---------|---------|-----|
| File access | Browse local folders | Upload files or drag & drop |
| Persistence | Full (files stay) | Session only (files clear on refresh) |
| Hot buttons | Persist with files | Names persist, must re-add files |
| Master folder | Yes | No (use file uploads) |

## Browser Compatibility

Works in all modern browsers:
- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `1-4` | Play deck 1-4 |
| `Shift + 1-4` | Stop deck 1-4 |
| `F1-F10` | Play hot button 1-10 |
| `Space` | Toggle play/pause on deck 1 |

---

**rockstar v1.2 by Pixamation**
