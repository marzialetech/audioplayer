const { app, BrowserWindow, ipcMain, dialog, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');

const store = new Store();

let mainWindow;

// Set app name (important for macOS dock and menu bar)
app.setName('AudioPlayer by Pixamation');

// Set dock icon on macOS before app is ready
if (process.platform === 'darwin') {
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  if (fs.existsSync(iconPath)) {
    app.dock.setIcon(iconPath);
  }
}

function createWindow() {
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    icon: iconPath,
    title: 'AudioPlayer by Pixamation'
  });
  
  // Set dock icon again after window creation (ensures it sticks)
  if (process.platform === 'darwin' && app.dock) {
    app.dock.setIcon(iconPath);
  }

  mainWindow.loadFile('index.html');

  // Create application menu
  const menuTemplate = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Set Master Folder',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ['openDirectory'],
              title: 'Select Master Audio Folder'
            });
            if (!result.canceled && result.filePaths.length > 0) {
              mainWindow.webContents.send('master-folder-selected', result.filePaths[0]);
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => app.quit()
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About AudioPlayer',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About AudioPlayer by Pixamation',
              message: 'AudioPlayer by Pixamation v1.0.0',
              detail: 'Professional audio playback application for radio broadcasting and live audio management.\n\nDeveloped by Pixamation\nhttps://pixamation.com',
              icon: path.join(__dirname, 'assets', 'icon.png')
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  // Open DevTools in development
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC Handlers

// Select master folder
ipcMain.handle('select-master-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select Master Audio Folder'
  });
  if (!result.canceled && result.filePaths.length > 0) {
    store.set('masterFolder', result.filePaths[0]);
    return result.filePaths[0];
  }
  return null;
});

// Get stored master folder
ipcMain.handle('get-master-folder', () => {
  return store.get('masterFolder', '');
});

// Save master folder
ipcMain.handle('save-master-folder', (event, folderPath) => {
  store.set('masterFolder', folderPath);
  return true;
});

// Get folder contents
ipcMain.handle('get-folder-contents', async (event, folderPath) => {
  try {
    const items = await fs.promises.readdir(folderPath, { withFileTypes: true });
    const result = {
      folders: [],
      files: []
    };

    for (const item of items) {
      if (item.isDirectory()) {
        result.folders.push({
          name: item.name,
          path: path.join(folderPath, item.name)
        });
      } else if (item.isFile()) {
        const ext = path.extname(item.name).toLowerCase();
        if (['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a'].includes(ext)) {
          const filePath = path.join(folderPath, item.name);
          const stats = await fs.promises.stat(filePath);
          result.files.push({
            name: item.name,
            path: filePath,
            size: stats.size,
            modified: stats.mtime
          });
        }
      }
    }

    // Sort alphabetically
    result.folders.sort((a, b) => a.name.localeCompare(b.name));
    result.files.sort((a, b) => a.name.localeCompare(b.name));

    return result;
  } catch (error) {
    console.error('Error reading folder:', error);
    return { folders: [], files: [], error: error.message };
  }
});

// Get subfolders of master folder
ipcMain.handle('get-subfolders', async (event, masterPath) => {
  try {
    const items = await fs.promises.readdir(masterPath, { withFileTypes: true });
    const folders = items
      .filter(item => item.isDirectory())
      .map(item => ({
        name: item.name,
        path: path.join(masterPath, item.name)
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    
    return folders;
  } catch (error) {
    console.error('Error reading subfolders:', error);
    return [];
  }
});

// Search for audio files
ipcMain.handle('search-audio-files', async (event, searchPath, query) => {
  const results = [];
  
  async function searchRecursive(dir) {
    try {
      const items = await fs.promises.readdir(dir, { withFileTypes: true });
      
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        
        if (item.isDirectory()) {
          await searchRecursive(fullPath);
        } else if (item.isFile()) {
          const ext = path.extname(item.name).toLowerCase();
          if (['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a'].includes(ext)) {
            if (item.name.toLowerCase().includes(query.toLowerCase())) {
              results.push({
                name: item.name,
                path: fullPath
              });
            }
          }
        }
      }
    } catch (error) {
      // Skip directories we can't access
    }
  }
  
  await searchRecursive(searchPath);
  return results.slice(0, 100); // Limit to 100 results
});

// Save hot button configuration
ipcMain.handle('save-hot-buttons', (event, buttons) => {
  store.set('hotButtons', buttons);
  return true;
});

// Load hot button configuration
ipcMain.handle('load-hot-buttons', () => {
  return store.get('hotButtons', {});
});

// Save queue
ipcMain.handle('save-queue', (event, queue) => {
  store.set('queue', queue);
  return true;
});

// Load queue
ipcMain.handle('load-queue', () => {
  return store.get('queue', []);
});
