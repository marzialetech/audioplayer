const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Folder management
  selectMasterFolder: () => ipcRenderer.invoke('select-master-folder'),
  getMasterFolder: () => ipcRenderer.invoke('get-master-folder'),
  saveMasterFolder: (folderPath) => ipcRenderer.invoke('save-master-folder', folderPath),
  getFolderContents: (folderPath) => ipcRenderer.invoke('get-folder-contents', folderPath),
  getSubfolders: (masterPath) => ipcRenderer.invoke('get-subfolders', masterPath),
  
  // Search
  searchAudioFiles: (searchPath, query) => ipcRenderer.invoke('search-audio-files', searchPath, query),
  
  // Hot buttons
  saveHotButtons: (buttons) => ipcRenderer.invoke('save-hot-buttons', buttons),
  loadHotButtons: () => ipcRenderer.invoke('load-hot-buttons'),
  
  // Queue
  saveQueue: (queue) => ipcRenderer.invoke('save-queue', queue),
  loadQueue: () => ipcRenderer.invoke('load-queue'),
  
  // Event listeners
  onMasterFolderSelected: (callback) => {
    ipcRenderer.on('master-folder-selected', (event, path) => callback(path));
  }
});
