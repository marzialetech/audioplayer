# AudioPlayer by Pixamation

<p align="center">
  <img src="assets/icon.png" alt="AudioPlayer by Pixamation" width="128" height="128">
</p>

<p align="center">
  <strong>Professional audio playback application for radio broadcasting and live audio management</strong>
</p>

---

## Features

### Audio Playback
- Support for **WAV** and **MP3** audio files (plus OGG, FLAC, AAC, M4A)
- **4 simultaneous audio decks** for parallel playback
- Individual play, pause, and stop controls per deck
- Real-time countdown timer and elapsed time display
- Progress bar visualization

### Audio Management
- **10 hot buttons** for instant audio access (keyboard shortcuts F1-F10)
- **Queue system** for playlist management
- Drag-and-drop support for loading audio to decks, hot buttons, and queue
- Configurable **master folder** with subfolder navigation
- **Search functionality** to quickly locate audio files

### User Interface
- **Master volume control** affecting all decks
- **Per-deck volume faders** for individual level control
- Real-time countdown/remaining time display
- Modern dark theme inspired by professional broadcasting software
- Status bar with current time and activity messages

## Installation

### Prerequisites
- [Node.js](https://nodejs.org/) (v16 or higher)
- npm (comes with Node.js)

### Setup

1. Clone the repository:
```bash
git clone https://github.com/marzialetech/audioplayer.git
cd audioplayer
```

2. Install dependencies:
```bash
npm install
```

3. Run the application:
```bash
npm start
```

### Development Mode
```bash
npm run dev
```

## Building for Distribution

### macOS
```bash
npm run build:mac
```

### Windows
```bash
npm run build:win
```

### Linux
```bash
npm run build:linux
```

Built applications will be in the `dist/` folder.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `1-4` | Play deck 1-4 |
| `Shift + 1-4` | Stop deck 1-4 |
| `F1-F10` | Play hot button 1-10 |
| `Space` | Toggle play/pause on deck 1 |
| `Ctrl/Cmd + O` | Set master folder |
| `Ctrl/Cmd + Q` | Quit application |

## Usage Guide

### Setting Up Your Audio Library

1. Click **Set Master Folder** or use `Ctrl/Cmd + O`
2. Select the root folder containing your audio files
3. Use the **Folder dropdown** to navigate between subfolders
4. Use the **Search box** to find specific audio files

### Loading Audio

- **Double-click** a file to load it to the first available deck
- **Drag and drop** files onto decks, hot buttons, or the queue
- **Right-click** for context menu options

### Hot Buttons

- **Drag** an audio file to a hot button to assign it
- **Click** a hot button to play its assigned audio
- **Right-click** a hot button to clear its assignment
- Press **F1-F10** to quickly trigger hot buttons

### Queue

- Drag files to the queue area to add them
- **Double-click** a queue item to load it immediately
- Queue items automatically load to decks when the current audio ends

## File Structure

```
audioplayer/
├── main.js          # Electron main process
├── preload.js       # Secure IPC bridge
├── index.html       # Main application UI
├── styles.css       # Application styling
├── renderer.js      # UI logic and audio control
├── package.json     # Dependencies and scripts
└── assets/          # Application icons
```

## Configuration

Settings are automatically saved and restored:
- Master folder location
- Hot button assignments
- Queue contents

Settings are stored using `electron-store` in the user's app data directory.

## Supported Audio Formats

| Format | Extension |
|--------|-----------|
| WAV | `.wav` |
| MP3 | `.mp3` |
| OGG | `.ogg` |
| FLAC | `.flac` |
| AAC | `.aac` |
| M4A | `.m4a` |

## Troubleshooting

### Audio won't play
- Ensure the audio file format is supported
- Check that the file path doesn't contain special characters
- Verify the audio file isn't corrupted

### Application won't start
- Ensure Node.js v16+ is installed
- Run `npm install` to ensure all dependencies are present
- Check the console for error messages with `npm run dev`

## License

MIT License - See [LICENSE](LICENSE) file for details.

## Author

Developed by **Pixamation**

- GitHub: [marzialetech](https://github.com/marzialetech)

## Acknowledgments

Inspired by WaveCart and similar professional broadcasting software used in radio stations worldwide.

---

<p align="center">
  <sub>AudioPlayer by Pixamation - Making audio management simple and powerful</sub>
</p>
