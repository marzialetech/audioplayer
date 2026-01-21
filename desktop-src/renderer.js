/**
 * AudioPlayer - WaveCart-style Audio Playback Application
 * Main Renderer Process
 */

// State Management
const state = {
  masterFolder: '',
  currentFolder: '',
  decks: {
    1: { audio: null, file: null, playing: false },
    2: { audio: null, file: null, playing: false },
    3: { audio: null, file: null, playing: false },
    4: { audio: null, file: null, playing: false }
  },
  hotButtons: {},
  queue: [],
  selectedFile: null,
  masterVolume: 1,
  searchResults: []
};

// DOM Elements
const elements = {
  masterVolume: document.getElementById('masterVolume'),
  masterVolumeValue: document.getElementById('masterVolumeValue'),
  btnSetMasterFolder: document.getElementById('btnSetMasterFolder'),
  masterFolderPath: document.getElementById('masterFolderPath'),
  subfolderSelect: document.getElementById('subfolderSelect'),
  searchInput: document.getElementById('searchInput'),
  btnSearch: document.getElementById('btnSearch'),
  fileList: document.getElementById('fileList'),
  queueList: document.getElementById('queueList'),
  hotButtonsGrid: document.getElementById('hotButtonsGrid'),
  contextMenu: document.getElementById('contextMenu'),
  statusMessage: document.getElementById('statusMessage'),
  statusTime: document.getElementById('statusTime')
};

// Initialize Application
async function init() {
  console.log('Initializing AudioPlayer...');
  
  // Initialize audio elements
  for (let i = 1; i <= 4; i++) {
    state.decks[i].audio = document.getElementById(`audio${i}`);
    setupDeckAudio(i);
  }
  
  // Load saved settings
  await loadSettings();
  
  // Setup event listeners
  setupEventListeners();
  
  // Update status time
  updateStatusTime();
  setInterval(updateStatusTime, 1000);
  
  setStatus('Ready');
}

// Load saved settings
async function loadSettings() {
  try {
    // Load master folder
    const masterFolder = await window.electronAPI.getMasterFolder();
    if (masterFolder) {
      state.masterFolder = masterFolder;
      state.currentFolder = masterFolder;
      elements.masterFolderPath.textContent = masterFolder;
      await loadFolderContents(masterFolder);
      await loadSubfolders(masterFolder);
    }
    
    // Load hot buttons
    const hotButtons = await window.electronAPI.loadHotButtons();
    if (hotButtons) {
      state.hotButtons = hotButtons;
      updateHotButtonsDisplay();
    }
    
    // Load queue
    const queue = await window.electronAPI.loadQueue();
    if (queue && queue.length > 0) {
      state.queue = queue;
      updateQueueDisplay();
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

// Setup audio deck
function setupDeckAudio(deckNum) {
  const audio = state.decks[deckNum].audio;
  
  audio.addEventListener('loadedmetadata', () => {
    updateDeckDisplay(deckNum);
  });
  
  audio.addEventListener('timeupdate', () => {
    updateDeckProgress(deckNum);
  });
  
  audio.addEventListener('ended', () => {
    onDeckEnded(deckNum);
  });
  
  audio.addEventListener('play', () => {
    state.decks[deckNum].playing = true;
    updateDeckState(deckNum, 'playing');
  });
  
  audio.addEventListener('pause', () => {
    state.decks[deckNum].playing = false;
    updateDeckState(deckNum, 'paused');
  });
}

// Setup event listeners
function setupEventListeners() {
  // Master volume
  elements.masterVolume.addEventListener('input', (e) => {
    state.masterVolume = e.target.value / 100;
    elements.masterVolumeValue.textContent = `${e.target.value}%`;
    updateAllDeckVolumes();
  });
  
  // Master folder button
  elements.btnSetMasterFolder.addEventListener('click', selectMasterFolder);
  
  // Subfolder select
  elements.subfolderSelect.addEventListener('change', (e) => {
    const path = e.target.value || state.masterFolder;
    if (path) {
      loadFolderContents(path);
    }
  });
  
  // Search
  elements.btnSearch.addEventListener('click', performSearch);
  elements.searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch();
  });
  
  // Deck controls
  document.querySelectorAll('.btn-play').forEach(btn => {
    btn.addEventListener('click', () => playDeck(btn.dataset.deck));
  });
  
  document.querySelectorAll('.btn-pause').forEach(btn => {
    btn.addEventListener('click', () => pauseDeck(btn.dataset.deck));
  });
  
  document.querySelectorAll('.btn-stop').forEach(btn => {
    btn.addEventListener('click', () => stopDeck(btn.dataset.deck));
  });
  
  document.querySelectorAll('.btn-remove').forEach(btn => {
    btn.addEventListener('click', () => removeDeck(btn.dataset.deck));
  });
  
  document.querySelectorAll('.deck-volume').forEach(slider => {
    slider.addEventListener('input', (e) => {
      const deckNum = e.target.dataset.deck;
      const audio = state.decks[deckNum].audio;
      audio.volume = (e.target.value / 100) * state.masterVolume;
    });
  });
  
  // Hot buttons
  document.querySelectorAll('.hot-button').forEach(btn => {
    btn.addEventListener('click', () => playHotButton(btn.dataset.slot));
    btn.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      clearHotButton(btn.dataset.slot);
    });
    
    // Drag and drop for hot buttons
    btn.addEventListener('dragover', (e) => {
      e.preventDefault();
      btn.classList.add('drag-over');
    });
    
    btn.addEventListener('dragleave', () => {
      btn.classList.remove('drag-over');
    });
    
    btn.addEventListener('drop', (e) => {
      e.preventDefault();
      btn.classList.remove('drag-over');
      const filePath = e.dataTransfer.getData('text/plain');
      const fileName = e.dataTransfer.getData('text/filename');
      if (filePath) {
        assignHotButton(btn.dataset.slot, filePath, fileName);
      }
    });
  });
  
  // Audio decks drag and drop
  document.querySelectorAll('.audio-deck').forEach(deck => {
    deck.addEventListener('dragover', (e) => {
      e.preventDefault();
      deck.classList.add('drag-over');
    });
    
    deck.addEventListener('dragleave', () => {
      deck.classList.remove('drag-over');
    });
    
    deck.addEventListener('drop', (e) => {
      e.preventDefault();
      deck.classList.remove('drag-over');
      const filePath = e.dataTransfer.getData('text/plain');
      const fileName = e.dataTransfer.getData('text/filename');
      if (filePath) {
        loadToDeck(deck.dataset.deck, filePath, fileName);
      }
    });
  });
  
  // Queue drag and drop
  elements.queueList.addEventListener('dragover', (e) => {
    e.preventDefault();
    elements.queueList.classList.add('drag-over');
  });
  
  elements.queueList.addEventListener('dragleave', () => {
    elements.queueList.classList.remove('drag-over');
  });
  
  elements.queueList.addEventListener('drop', (e) => {
    e.preventDefault();
    elements.queueList.classList.remove('drag-over');
    const filePath = e.dataTransfer.getData('text/plain');
    const fileName = e.dataTransfer.getData('text/filename');
    if (filePath) {
      addToQueue(filePath, fileName);
    }
  });
  
  // Context menu
  document.addEventListener('click', () => {
    elements.contextMenu.style.display = 'none';
  });
  
  // IPC events
  window.electronAPI.onMasterFolderSelected((path) => {
    state.masterFolder = path;
    state.currentFolder = path;
    elements.masterFolderPath.textContent = path;
    loadFolderContents(path);
    loadSubfolders(path);
    window.electronAPI.saveMasterFolder(path);
  });
  
  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeyboard);
}

// Select master folder
async function selectMasterFolder() {
  const path = await window.electronAPI.selectMasterFolder();
  if (path) {
    state.masterFolder = path;
    state.currentFolder = path;
    elements.masterFolderPath.textContent = path;
    await loadFolderContents(path);
    await loadSubfolders(path);
    setStatus('Master folder set: ' + path);
  }
}

// Load folder contents
async function loadFolderContents(folderPath) {
  setStatus('Loading folder...');
  state.currentFolder = folderPath;
  
  const contents = await window.electronAPI.getFolderContents(folderPath);
  
  if (contents.error) {
    elements.fileList.innerHTML = `<p class="file-list-empty">Error: ${contents.error}</p>`;
    setStatus('Error loading folder');
    return;
  }
  
  renderFileList(contents);
  setStatus(`Loaded ${contents.files.length} audio files`);
}

// Load subfolders
async function loadSubfolders(masterPath) {
  const subfolders = await window.electronAPI.getSubfolders(masterPath);
  
  elements.subfolderSelect.innerHTML = '<option value="">All Folders</option>';
  
  subfolders.forEach(folder => {
    const option = document.createElement('option');
    option.value = folder.path;
    option.textContent = folder.name;
    elements.subfolderSelect.appendChild(option);
  });
}

// Render file list
function renderFileList(contents) {
  elements.fileList.innerHTML = '';
  
  // Add parent folder if not at master level
  if (state.currentFolder !== state.masterFolder) {
    const parentItem = document.createElement('div');
    parentItem.className = 'file-item folder-item';
    parentItem.innerHTML = `<span class="file-icon">📁</span><span class="file-name">..</span>`;
    parentItem.addEventListener('click', () => {
      const parentPath = state.currentFolder.split('/').slice(0, -1).join('/') || state.masterFolder;
      loadFolderContents(parentPath);
    });
    elements.fileList.appendChild(parentItem);
  }
  
  // Add folders
  contents.folders.forEach(folder => {
    const item = document.createElement('div');
    item.className = 'file-item folder-item';
    item.innerHTML = `<span class="file-icon">📁</span><span class="file-name">${folder.name}</span>`;
    item.addEventListener('click', () => loadFolderContents(folder.path));
    item.addEventListener('dblclick', () => loadFolderContents(folder.path));
    elements.fileList.appendChild(item);
  });
  
  // Add files
  contents.files.forEach(file => {
    const item = document.createElement('div');
    item.className = 'file-item';
    item.draggable = true;
    item.innerHTML = `<span class="file-icon">🎵</span><span class="file-name">${file.name}</span>`;
    
    item.addEventListener('click', () => selectFile(item, file));
    item.addEventListener('dblclick', () => loadToFirstEmptyDeck(file.path, file.name));
    
    item.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', file.path);
      e.dataTransfer.setData('text/filename', file.name);
      item.classList.add('dragging');
    });
    
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
    });
    
    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showContextMenu(e, file);
    });
    
    elements.fileList.appendChild(item);
  });
  
  if (contents.folders.length === 0 && contents.files.length === 0) {
    elements.fileList.innerHTML = '<p class="file-list-empty">No audio files found in this folder.</p>';
  }
}

// Select file
function selectFile(element, file) {
  document.querySelectorAll('.file-item').forEach(item => item.classList.remove('selected'));
  element.classList.add('selected');
  state.selectedFile = file;
}

// Show context menu
function showContextMenu(e, file) {
  state.selectedFile = file;
  elements.contextMenu.style.display = 'block';
  elements.contextMenu.style.left = `${e.clientX}px`;
  elements.contextMenu.style.top = `${e.clientY}px`;
  
  // Setup context menu actions
  elements.contextMenu.querySelectorAll('.context-item').forEach(item => {
    item.onclick = () => {
      const action = item.dataset.action;
      handleContextAction(action, file);
      elements.contextMenu.style.display = 'none';
    };
  });
}

// Handle context menu action
function handleContextAction(action, file) {
  switch (action) {
    case 'load-deck':
      loadToFirstEmptyDeck(file.path, file.name);
      break;
    case 'add-queue':
      addToQueue(file.path, file.name);
      break;
    case 'assign-hot':
      // Find first empty hot button
      for (let i = 1; i <= 10; i++) {
        if (!state.hotButtons[i]) {
          assignHotButton(i, file.path, file.name);
          break;
        }
      }
      break;
  }
}

// Perform search
async function performSearch() {
  const query = elements.searchInput.value.trim();
  if (!query) {
    loadFolderContents(state.currentFolder);
    return;
  }
  
  if (!state.masterFolder) {
    setStatus('Please set a master folder first');
    return;
  }
  
  setStatus('Searching...');
  const results = await window.electronAPI.searchAudioFiles(state.masterFolder, query);
  
  elements.fileList.innerHTML = '';
  
  if (results.length === 0) {
    elements.fileList.innerHTML = '<p class="file-list-empty">No files found matching your search.</p>';
    setStatus('No results found');
    return;
  }
  
  results.forEach(file => {
    const item = document.createElement('div');
    item.className = 'file-item';
    item.draggable = true;
    item.innerHTML = `<span class="file-icon">🎵</span><span class="file-name">${file.name}</span>`;
    
    item.addEventListener('click', () => selectFile(item, file));
    item.addEventListener('dblclick', () => loadToFirstEmptyDeck(file.path, file.name));
    
    item.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', file.path);
      e.dataTransfer.setData('text/filename', file.name);
    });
    
    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showContextMenu(e, file);
    });
    
    elements.fileList.appendChild(item);
  });
  
  setStatus(`Found ${results.length} files`);
}

// Load to deck
function loadToDeck(deckNum, filePath, fileName) {
  const audio = state.decks[deckNum].audio;
  audio.src = filePath;
  state.decks[deckNum].file = { path: filePath, name: fileName };
  
  document.getElementById(`deckFilename${deckNum}`).textContent = fileName || 'Loading...';
  updateDeckState(deckNum, 'loaded');
  setStatus(`Loaded: ${fileName}`);
}

// Load to first empty deck
function loadToFirstEmptyDeck(filePath, fileName) {
  for (let i = 1; i <= 4; i++) {
    if (!state.decks[i].file) {
      loadToDeck(i, filePath, fileName);
      return;
    }
  }
  // All decks full, load to deck 1
  loadToDeck(1, filePath, fileName);
}

// Play deck
function playDeck(deckNum) {
  const audio = state.decks[deckNum].audio;
  if (audio.src) {
    audio.play();
    setStatus(`Playing deck ${deckNum}`);
  }
}

// Pause deck
function pauseDeck(deckNum) {
  const audio = state.decks[deckNum].audio;
  if (!audio.paused) {
    audio.pause();
    setStatus(`Paused deck ${deckNum}`);
  }
}

// Stop deck
function stopDeck(deckNum) {
  const audio = state.decks[deckNum].audio;
  audio.pause();
  audio.currentTime = 0;
  updateDeckState(deckNum, 'stopped');
  setStatus(`Stopped deck ${deckNum}`);
}

// Remove deck
function removeDeck(deckNum) {
  const audio = state.decks[deckNum].audio;
  audio.pause();
  audio.src = '';
  audio.currentTime = 0;
  state.decks[deckNum].file = null;
  state.decks[deckNum].playing = false;
  
  document.getElementById(`deckFilename${deckNum}`).textContent = '-- Empty --';
  document.getElementById(`deckElapsed${deckNum}`).textContent = '00:00';
  document.getElementById(`deckLength${deckNum}`).textContent = '00:00';
  document.getElementById(`deckRemaining${deckNum}`).textContent = '00:00';
  document.getElementById(`deckProgress${deckNum}`).style.width = '0%';
  
  updateDeckState(deckNum, 'empty');
  setStatus(`Cleared deck ${deckNum}`);
  
  // Load next from queue
  loadNextFromQueue(deckNum);
}

// Update deck display
function updateDeckDisplay(deckNum) {
  const audio = state.decks[deckNum].audio;
  const duration = audio.duration || 0;
  
  document.getElementById(`deckLength${deckNum}`).textContent = formatTime(duration);
  document.getElementById(`deckRemaining${deckNum}`).textContent = formatTime(duration);
}

// Update deck progress
function updateDeckProgress(deckNum) {
  const audio = state.decks[deckNum].audio;
  const currentTime = audio.currentTime || 0;
  const duration = audio.duration || 0;
  const remaining = duration - currentTime;
  const progress = duration ? (currentTime / duration) * 100 : 0;
  
  document.getElementById(`deckElapsed${deckNum}`).textContent = formatTime(currentTime);
  document.getElementById(`deckRemaining${deckNum}`).textContent = formatTime(remaining);
  document.getElementById(`deckProgress${deckNum}`).style.width = `${progress}%`;
}

// Update deck state
function updateDeckState(deckNum, state) {
  const deck = document.querySelector(`.audio-deck[data-deck="${deckNum}"]`);
  deck.classList.remove('playing', 'paused', 'stopped', 'loaded', 'empty');
  deck.classList.add(state);
}

// On deck ended
function onDeckEnded(deckNum) {
  updateDeckState(deckNum, 'loaded');
  state.decks[deckNum].playing = false;
  
  // Auto-load next from queue
  loadNextFromQueue(deckNum);
}

// Load next from queue
function loadNextFromQueue(deckNum) {
  if (state.queue.length > 0) {
    const next = state.queue.shift();
    loadToDeck(deckNum, next.path, next.name);
    updateQueueDisplay();
    saveQueue();
  }
}

// Update all deck volumes
function updateAllDeckVolumes() {
  for (let i = 1; i <= 4; i++) {
    const slider = document.querySelector(`.deck-volume[data-deck="${i}"]`);
    const audio = state.decks[i].audio;
    audio.volume = (slider.value / 100) * state.masterVolume;
  }
}

// Format time
function formatTime(seconds) {
  if (isNaN(seconds) || !isFinite(seconds)) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Hot button functions
function assignHotButton(slot, filePath, fileName) {
  state.hotButtons[slot] = { path: filePath, name: fileName };
  updateHotButtonsDisplay();
  saveHotButtons();
  setStatus(`Assigned hot button ${slot}: ${fileName}`);
}

function playHotButton(slot) {
  const btn = state.hotButtons[slot];
  if (btn) {
    loadToFirstEmptyDeck(btn.path, btn.name);
    playDeck(findDeckWithFile(btn.path));
    
    // Visual feedback
    const button = document.querySelector(`.hot-button[data-slot="${slot}"]`);
    button.classList.add('playing');
    setTimeout(() => button.classList.remove('playing'), 1000);
  }
}

function clearHotButton(slot) {
  if (state.hotButtons[slot]) {
    delete state.hotButtons[slot];
    updateHotButtonsDisplay();
    saveHotButtons();
    setStatus(`Cleared hot button ${slot}`);
  }
}

function updateHotButtonsDisplay() {
  for (let i = 1; i <= 10; i++) {
    const button = document.querySelector(`.hot-button[data-slot="${i}"]`);
    const label = button.querySelector('.hot-label');
    
    if (state.hotButtons[i]) {
      label.textContent = state.hotButtons[i].name.replace(/\.[^/.]+$/, '');
      button.classList.add('assigned');
    } else {
      label.textContent = 'Empty';
      button.classList.remove('assigned');
    }
  }
}

function findDeckWithFile(filePath) {
  for (let i = 1; i <= 4; i++) {
    if (state.decks[i].file && state.decks[i].file.path === filePath) {
      return i;
    }
  }
  // Return first deck with the file loaded or deck 1
  for (let i = 1; i <= 4; i++) {
    const audio = state.decks[i].audio;
    if (audio.src && audio.src.includes(filePath)) {
      return i;
    }
  }
  return 1;
}

async function saveHotButtons() {
  await window.electronAPI.saveHotButtons(state.hotButtons);
}

// Queue functions
function addToQueue(filePath, fileName) {
  state.queue.push({ path: filePath, name: fileName });
  updateQueueDisplay();
  saveQueue();
  setStatus(`Added to queue: ${fileName}`);
}

function removeFromQueue(index) {
  state.queue.splice(index, 1);
  updateQueueDisplay();
  saveQueue();
}

function updateQueueDisplay() {
  if (state.queue.length === 0) {
    elements.queueList.innerHTML = '<p class="queue-empty">Queue is empty. Drag files here or use the Queue button.</p>';
    return;
  }
  
  elements.queueList.innerHTML = '';
  state.queue.forEach((item, index) => {
    const queueItem = document.createElement('div');
    queueItem.className = 'queue-item';
    queueItem.draggable = true;
    queueItem.innerHTML = `
      <span>${index + 1}. ${item.name}</span>
      <button class="queue-remove" data-index="${index}">×</button>
    `;
    
    queueItem.querySelector('.queue-remove').addEventListener('click', () => {
      removeFromQueue(index);
    });
    
    queueItem.addEventListener('dblclick', () => {
      loadToFirstEmptyDeck(item.path, item.name);
      removeFromQueue(index);
    });
    
    elements.queueList.appendChild(queueItem);
  });
}

async function saveQueue() {
  await window.electronAPI.saveQueue(state.queue);
}

// Keyboard shortcuts
function handleKeyboard(e) {
  // Number keys 1-4 for decks
  if (e.key >= '1' && e.key <= '4' && !e.ctrlKey && !e.altKey && !e.target.matches('input')) {
    if (e.shiftKey) {
      stopDeck(e.key);
    } else {
      playDeck(e.key);
    }
    e.preventDefault();
  }
  
  // Function keys F1-F10 for hot buttons
  if (e.key.startsWith('F') && !e.ctrlKey && !e.altKey) {
    const num = parseInt(e.key.slice(1));
    if (num >= 1 && num <= 10) {
      playHotButton(num);
      e.preventDefault();
    }
  }
  
  // Space to play/pause deck 1
  if (e.key === ' ' && !e.target.matches('input')) {
    const deck1 = state.decks[1];
    if (deck1.audio.src) {
      if (deck1.playing) {
        pauseDeck(1);
      } else {
        playDeck(1);
      }
    }
    e.preventDefault();
  }
  
  // Escape to close context menu
  if (e.key === 'Escape') {
    elements.contextMenu.style.display = 'none';
  }
}

// Status functions
function setStatus(message) {
  elements.statusMessage.textContent = message;
}

function updateStatusTime() {
  const now = new Date();
  elements.statusTime.textContent = now.toLocaleTimeString();
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
