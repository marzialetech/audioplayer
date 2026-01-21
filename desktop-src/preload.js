const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Folder management
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  getFolderContents: (folderPath) => ipcRenderer.invoke('get-folder-contents', folderPath),
  
  // Directory slots
  saveDirectorySlots: (slots) => ipcRenderer.invoke('save-directory-slots', slots),
  getDirectorySlots: () => ipcRenderer.invoke('get-directory-slots'),
  
  // Search
  searchAudioFiles: (searchPath, query) => ipcRenderer.invoke('search-audio-files', searchPath, query),
  
  // Hot buttons
  saveHotButtons: (buttons) => ipcRenderer.invoke('save-hot-buttons', buttons),
  loadHotButtons: () => ipcRenderer.invoke('load-hot-buttons')
});
