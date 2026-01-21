/**
 * AudioPlayer by Pixamation - Web Application
 * Browser-based audio playback application
 */

// Constants
const DECK_COUNT = 20;
const DIR_SLOT_COUNT = 4;

// State Management
const state = {
  directorySlots: {
    1: { handle: null, path: '', files: [] },
    2: { handle: null, path: '', files: [] },
    3: { handle: null, path: '', files: [] },
    4: { handle: null, path: '', files: [] }
  },
  activeDirectorySlot: 1,
  currentPath: [], // Breadcrumb for navigation within directory
  currentFiles: [], // Files in current view
  decks: {},
  selectedFile: null,
  masterVolume: 1,
  searchQuery: '',
  draggingFile: null // Store file being dragged (handles can't be serialized)
};

// Initialize decks 1-20
for (let i = 1; i <= DECK_COUNT; i++) {
  state.decks[i] = { audio: null, file: null, playing: false, queued: false };
}

// DOM Elements
const elements = {
  masterVolume: document.getElementById('masterVolume'),
  masterVolumeValue: document.getElementById('masterVolumeValue'),
  searchInput: document.getElementById('searchInput'),
  btnSearch: document.getElementById('btnSearch'),
  fileList: document.getElementById('fileList'),
  hotButtonsGrid: document.getElementById('hotButtonsGrid'),
  contextMenu: document.getElementById('contextMenu'),
  deckSelectMenu: document.getElementById('deckSelectMenu'),
  dropOverlay: document.getElementById('dropOverlay'),
  statusMessage: document.getElementById('statusMessage'),
  statusTime: document.getElementById('statusTime'),
  currentPathDisplay: document.getElementById('currentPathDisplay')
};

// Initialize Application
function init() {
  console.log('Initializing AudioPlayer Web App...');
  
  // Initialize audio elements
  for (let i = 1; i <= DECK_COUNT; i++) {
    state.decks[i].audio = document.getElementById(`audio${i}`);
    setupDeckAudio(i);
  }
  
  // Setup event listeners
  setupEventListeners();
  
  // Update status time
  updateStatusTime();
  setInterval(updateStatusTime, 1000);
  
  setStatus('Ready - Select a directory to browse audio files');
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
    updateHotButtonState(deckNum, 'playing');
  });
  
  audio.addEventListener('pause', () => {
    state.decks[deckNum].playing = false;
    updateDeckState(deckNum, 'paused');
    updateHotButtonState(deckNum, 'paused');
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
  
  // Directory slot buttons
  document.querySelectorAll('.btn-select-dir').forEach(btn => {
    btn.addEventListener('click', () => selectDirectory(parseInt(btn.dataset.slot)));
  });
  
  // Directory slot switching (click on the slot container)
  document.querySelectorAll('.directory-slot').forEach(slot => {
    slot.addEventListener('click', (e) => {
      // Don't switch if clicking the button itself
      if (e.target.classList.contains('btn-select-dir')) return;
      const slotNum = parseInt(slot.dataset.slot);
      switchToDirectorySlot(slotNum);
    });
  });
  
  // Search
  elements.btnSearch.addEventListener('click', performSearch);
  elements.searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch();
  });
  elements.searchInput.addEventListener('input', (e) => {
    if (e.target.value === '') {
      state.searchQuery = '';
      renderFileList();
    }
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
    btn.addEventListener('click', () => clearDeck(btn.dataset.deck));
  });
  
  // Queue toggle buttons
  document.querySelectorAll('.btn-queue').forEach(btn => {
    btn.addEventListener('click', () => toggleQueue(btn.dataset.deck));
  });
  
  document.querySelectorAll('.deck-volume').forEach(slider => {
    slider.addEventListener('input', (e) => {
      const deckNum = e.target.dataset.deck;
      const audio = state.decks[deckNum].audio;
      audio.volume = (e.target.value / 100) * state.masterVolume;
    });
  });
  
  // Progress bar seeking
  document.querySelectorAll('.deck-progress').forEach(progress => {
    progress.addEventListener('click', (e) => {
      const deckNum = progress.closest('.audio-deck').dataset.deck;
      const audio = state.decks[deckNum].audio;
      if (audio.duration) {
        const rect = progress.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        audio.currentTime = percent * audio.duration;
      }
    });
  });
  
  // Hot buttons - click to play, right-click to clear
  document.querySelectorAll('.hot-button').forEach(btn => {
    btn.addEventListener('click', () => {
      const slot = parseInt(btn.dataset.slot);
      if (state.decks[slot].file) {
        playDeck(slot);
      }
    });
    
    btn.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      clearDeck(btn.dataset.slot);
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
      // Use the stored dragging file (handles can't be serialized to JSON)
      if (state.draggingFile) {
        loadToDeck(btn.dataset.slot, state.draggingFile);
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
      // Use the stored dragging file (handles can't be serialized to JSON)
      if (state.draggingFile) {
        loadToDeck(deck.dataset.deck, state.draggingFile);
      }
    });
  });
  
  // Context menu
  document.addEventListener('click', () => {
    elements.contextMenu.style.display = 'none';
    elements.deckSelectMenu.style.display = 'none';
  });
  
  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeyboard);
}

// Select directory for a slot
async function selectDirectory(slotNum) {
  try {
    // Check if File System Access API is supported
    if (!('showDirectoryPicker' in window)) {
      setStatus('Directory selection not supported in this browser. Try Chrome or Edge.');
      return;
    }
    
    const dirHandle = await window.showDirectoryPicker({
      mode: 'read'
    });
    
    state.directorySlots[slotNum].handle = dirHandle;
    state.directorySlots[slotNum].path = dirHandle.name;
    
    // Update UI
    document.getElementById(`dirPath${slotNum}`).textContent = dirHandle.name;
    
    // Switch to this slot and load contents
    switchToDirectorySlot(slotNum);
    
    setStatus(`Directory ${slotNum} set: ${dirHandle.name}`);
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('Error selecting directory:', err);
      setStatus('Error selecting directory');
    }
  }
}

// Switch to a directory slot
function switchToDirectorySlot(slotNum) {
  // Update active state
  document.querySelectorAll('.directory-slot').forEach(slot => {
    slot.classList.remove('active');
  });
  document.querySelector(`.directory-slot[data-slot="${slotNum}"]`).classList.add('active');
  
  state.activeDirectorySlot = slotNum;
  state.currentPath = [];
  
  const slot = state.directorySlots[slotNum];
  if (slot.handle) {
    loadDirectoryContents(slot.handle);
    elements.currentPathDisplay.textContent = slot.path;
  } else {
    elements.fileList.innerHTML = '<p class="file-list-empty">Click the button to select a directory.</p>';
    elements.currentPathDisplay.textContent = 'No directory selected';
  }
}

// Load directory contents
async function loadDirectoryContents(dirHandle, subPath = []) {
  try {
    setStatus('Loading directory...');
    
    const folders = [];
    const files = [];
    
    // Navigate to subpath if needed
    let currentHandle = dirHandle;
    for (const folder of subPath) {
      currentHandle = await currentHandle.getDirectoryHandle(folder);
    }
    
    // Read directory contents
    for await (const entry of currentHandle.values()) {
      if (entry.kind === 'directory') {
        folders.push({
          name: entry.name,
          type: 'folder',
          handle: entry
        });
      } else if (entry.kind === 'file') {
        // Check if it's an audio file
        const ext = entry.name.split('.').pop().toLowerCase();
        if (['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma'].includes(ext)) {
          files.push({
            name: entry.name,
            type: 'file',
            handle: entry
          });
        }
      }
    }
    
    // Sort alphabetically
    folders.sort((a, b) => a.name.localeCompare(b.name));
    files.sort((a, b) => a.name.localeCompare(b.name));
    
    state.currentFiles = [...folders, ...files];
    state.currentPath = subPath;
    
    // Update path display
    const slot = state.directorySlots[state.activeDirectorySlot];
    const fullPath = [slot.path, ...subPath].join(' / ');
    elements.currentPathDisplay.textContent = fullPath;
    
    renderFileList();
    setStatus(`Loaded ${files.length} audio files, ${folders.length} folders`);
  } catch (err) {
    console.error('Error loading directory:', err);
    setStatus('Error loading directory');
  }
}

// Render file list
function renderFileList() {
  elements.fileList.innerHTML = '';
  
  let items = state.currentFiles;
  
  // Apply search filter
  if (state.searchQuery) {
    items = items.filter(f => 
      f.name.toLowerCase().includes(state.searchQuery.toLowerCase())
    );
  }
  
  // Add parent folder navigation if in subfolder
  if (state.currentPath.length > 0) {
    const parentItem = document.createElement('div');
    parentItem.className = 'file-item folder-item';
    parentItem.innerHTML = `<span class="file-icon">📁</span><span class="file-name">..</span>`;
    parentItem.addEventListener('click', () => navigateUp());
    elements.fileList.appendChild(parentItem);
  }
  
  if (items.length === 0 && state.currentPath.length === 0) {
    elements.fileList.innerHTML = state.searchQuery 
      ? '<p class="file-list-empty">No files match your search.</p>'
      : '<p class="file-list-empty">Select a directory to browse audio files.</p>';
    return;
  }
  
  items.forEach((item) => {
    const div = document.createElement('div');
    div.className = item.type === 'folder' ? 'file-item folder-item' : 'file-item';
    div.draggable = item.type === 'file';
    
    const icon = item.type === 'folder' ? '📁' : '🎵';
    div.innerHTML = `<span class="file-icon">${icon}</span><span class="file-name">${item.name}</span>`;
    
    if (item.type === 'folder') {
      div.addEventListener('click', () => navigateToFolder(item.name));
      div.addEventListener('dblclick', () => navigateToFolder(item.name));
    } else {
      div.addEventListener('click', () => selectFile(div, item));
      div.addEventListener('dblclick', () => loadToFirstEmptyDeck(item));
      
      div.addEventListener('dragstart', (e) => {
        // Store file in state (handles can't be serialized to JSON)
        state.draggingFile = item;
        e.dataTransfer.setData('text/plain', item.name);
        e.dataTransfer.effectAllowed = 'copy';
        div.classList.add('dragging');
      });
      
      div.addEventListener('dragend', () => {
        div.classList.remove('dragging');
        // Clear after a short delay to allow drop to complete
        setTimeout(() => { state.draggingFile = null; }, 100);
      });
      
      div.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showContextMenu(e, item);
      });
    }
    
    elements.fileList.appendChild(div);
  });
}

// Navigate to a subfolder
function navigateToFolder(folderName) {
  const newPath = [...state.currentPath, folderName];
  const slot = state.directorySlots[state.activeDirectorySlot];
  if (slot.handle) {
    loadDirectoryContents(slot.handle, newPath);
  }
}

// Navigate up one level
function navigateUp() {
  if (state.currentPath.length > 0) {
    const newPath = state.currentPath.slice(0, -1);
    const slot = state.directorySlots[state.activeDirectorySlot];
    if (slot.handle) {
      loadDirectoryContents(slot.handle, newPath);
    }
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
      handleContextAction(action, file, e);
    };
  });
}

// Handle context menu action
function handleContextAction(action, file, e) {
  elements.contextMenu.style.display = 'none';
  
  if (action === 'load-deck' || action === 'assign-hot') {
    // Show deck selection submenu
    elements.deckSelectMenu.style.display = 'block';
    elements.deckSelectMenu.style.left = `${e.clientX + 150}px`;
    elements.deckSelectMenu.style.top = `${e.clientY}px`;
    
    // Setup deck selection
    elements.deckSelectMenu.querySelectorAll('.deck-select-item').forEach(item => {
      item.onclick = () => {
        const deckNum = item.dataset.deck;
        loadToDeck(deckNum, file);
        elements.deckSelectMenu.style.display = 'none';
      };
    });
  }
}

// Perform search
function performSearch() {
  state.searchQuery = elements.searchInput.value.trim();
  renderFileList();
  
  if (state.searchQuery) {
    const count = state.currentFiles.filter(f => 
      f.name.toLowerCase().includes(state.searchQuery.toLowerCase())
    ).length;
    setStatus(`Found ${count} item(s) matching "${state.searchQuery}"`);
  }
}

// Load to deck (and sync with hot button)
async function loadToDeck(deckNum, file) {
  deckNum = parseInt(deckNum);
  
  try {
    // Get file from handle
    const fileData = await file.handle.getFile();
    const url = URL.createObjectURL(fileData);
    
    const audio = state.decks[deckNum].audio;
    
    // Revoke old URL if exists
    if (state.decks[deckNum].file && state.decks[deckNum].file.url) {
      URL.revokeObjectURL(state.decks[deckNum].file.url);
    }
    
    audio.src = url;
    state.decks[deckNum].file = { name: file.name, url: url, handle: file.handle };
    
    document.getElementById(`deckFilename${deckNum}`).textContent = file.name;
    updateDeckState(deckNum, 'loaded');
    
    // Sync with hot button display
    updateHotButtonDisplay(deckNum);
    
    setStatus(`Loaded: ${file.name}`);
  } catch (err) {
    console.error('Error loading file:', err);
    setStatus('Error loading file');
  }
}

// Load to first empty deck
function loadToFirstEmptyDeck(file) {
  for (let i = 1; i <= DECK_COUNT; i++) {
    if (!state.decks[i].file) {
      loadToDeck(i, file);
      return i;
    }
  }
  // All decks full, load to deck 1
  loadToDeck(1, file);
  return 1;
}

// Play deck
function playDeck(deckNum) {
  deckNum = parseInt(deckNum);
  const audio = state.decks[deckNum].audio;
  if (audio.src) {
    audio.play();
    setStatus(`Playing deck ${deckNum}`);
  }
}

// Pause deck
function pauseDeck(deckNum) {
  deckNum = parseInt(deckNum);
  const audio = state.decks[deckNum].audio;
  if (!audio.paused) {
    audio.pause();
    setStatus(`Paused deck ${deckNum}`);
  }
}

// Stop deck
function stopDeck(deckNum) {
  deckNum = parseInt(deckNum);
  const audio = state.decks[deckNum].audio;
  audio.pause();
  audio.currentTime = 0;
  updateDeckState(deckNum, 'stopped');
  updateHotButtonState(deckNum, 'stopped');
  setStatus(`Stopped deck ${deckNum}`);
}

// Clear deck and synced hot button
function clearDeck(deckNum) {
  deckNum = parseInt(deckNum);
  const audio = state.decks[deckNum].audio;
  
  // Revoke URL
  if (state.decks[deckNum].file && state.decks[deckNum].file.url) {
    URL.revokeObjectURL(state.decks[deckNum].file.url);
  }
  
  audio.pause();
  audio.src = '';
  audio.currentTime = 0;
  state.decks[deckNum].file = null;
  state.decks[deckNum].playing = false;
  state.decks[deckNum].queued = false;
  
  document.getElementById(`deckFilename${deckNum}`).textContent = '-- Empty --';
  document.getElementById(`deckElapsed${deckNum}`).textContent = '00:00';
  document.getElementById(`deckLength${deckNum}`).textContent = '00:00';
  document.getElementById(`deckRemaining${deckNum}`).textContent = '-00:00';
  document.getElementById(`deckProgress${deckNum}`).style.width = '0%';
  
  updateDeckState(deckNum, 'empty');
  updateHotButtonDisplay(deckNum);
  updateQueueButtonState(deckNum);
  
  setStatus(`Cleared deck ${deckNum}`);
}

// Toggle queue state for a deck
function toggleQueue(deckNum) {
  deckNum = parseInt(deckNum);
  state.decks[deckNum].queued = !state.decks[deckNum].queued;
  updateQueueButtonState(deckNum);
  
  if (state.decks[deckNum].queued) {
    setStatus(`Deck ${deckNum} queued to play after deck ${deckNum - 1}`);
  } else {
    setStatus(`Deck ${deckNum} removed from queue`);
  }
}

// Update queue button visual state
function updateQueueButtonState(deckNum) {
  const btn = document.querySelector(`.btn-queue[data-deck="${deckNum}"]`);
  if (state.decks[deckNum].queued) {
    btn.classList.add('active');
  } else {
    btn.classList.remove('active');
  }
}

// Update deck display
function updateDeckDisplay(deckNum) {
  const audio = state.decks[deckNum].audio;
  const duration = audio.duration || 0;
  
  document.getElementById(`deckLength${deckNum}`).textContent = formatTime(duration);
  document.getElementById(`deckRemaining${deckNum}`).textContent = '-' + formatTime(duration);
}

// Update deck progress
function updateDeckProgress(deckNum) {
  const audio = state.decks[deckNum].audio;
  const currentTime = audio.currentTime || 0;
  const duration = audio.duration || 0;
  const remaining = duration - currentTime;
  const progress = duration ? (currentTime / duration) * 100 : 0;
  
  document.getElementById(`deckElapsed${deckNum}`).textContent = formatTime(currentTime);
  document.getElementById(`deckRemaining${deckNum}`).textContent = '-' + formatTime(remaining);
  document.getElementById(`deckProgress${deckNum}`).style.width = `${progress}%`;
}

// Update deck state
function updateDeckState(deckNum, deckState) {
  const deck = document.querySelector(`.audio-deck[data-deck="${deckNum}"]`);
  deck.classList.remove('playing', 'paused', 'stopped', 'loaded', 'empty');
  deck.classList.add(deckState);
}

// Update hot button state
function updateHotButtonState(deckNum, buttonState) {
  const button = document.querySelector(`.hot-button[data-slot="${deckNum}"]`);
  button.classList.remove('playing', 'paused', 'stopped');
  if (buttonState === 'playing') {
    button.classList.add('playing');
  }
}

// Update hot button display (sync with deck)
function updateHotButtonDisplay(deckNum) {
  const button = document.querySelector(`.hot-button[data-slot="${deckNum}"]`);
  const label = button.querySelector('.hot-label');
  
  if (state.decks[deckNum].file) {
    label.textContent = state.decks[deckNum].file.name.replace(/\.[^/.]+$/, '');
    button.classList.add('assigned');
  } else {
    label.textContent = 'Empty';
    button.classList.remove('assigned', 'playing');
  }
}

// On deck ended - check sequential queue
function onDeckEnded(deckNum) {
  deckNum = parseInt(deckNum);
  updateDeckState(deckNum, 'loaded');
  updateHotButtonState(deckNum, 'stopped');
  state.decks[deckNum].playing = false;
  
  // Check if next deck (N+1) is queued
  const nextDeck = deckNum + 1;
  if (nextDeck <= DECK_COUNT && state.decks[nextDeck].queued && state.decks[nextDeck].file) {
    // Play the next deck
    playDeck(nextDeck);
    setStatus(`Auto-playing queued deck ${nextDeck}`);
  }
}

// Update all deck volumes
function updateAllDeckVolumes() {
  for (let i = 1; i <= DECK_COUNT; i++) {
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

// Keyboard shortcuts
function handleKeyboard(e) {
  // Don't trigger shortcuts when typing in input
  if (e.target.matches('input')) return;
  
  // Number keys 1-9 and 0 for decks (0 = deck 10)
  if (!e.ctrlKey && !e.altKey) {
    if (e.key >= '1' && e.key <= '9') {
      const deckNum = parseInt(e.key);
      if (e.shiftKey) {
        stopDeck(deckNum);
      } else {
        playDeck(deckNum);
      }
      e.preventDefault();
    } else if (e.key === '0') {
      if (e.shiftKey) {
        stopDeck(10);
      } else {
        playDeck(10);
      }
      e.preventDefault();
    }
  }
  
  // Function keys F1-F12 for decks 1-12
  if (e.key.startsWith('F') && !e.ctrlKey && !e.altKey) {
    const num = parseInt(e.key.slice(1));
    if (num >= 1 && num <= 12) {
      if (state.decks[num].file) {
        playDeck(num);
      }
      e.preventDefault();
    }
  }
  
  // Space to play/pause deck 1
  if (e.key === ' ') {
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
    elements.deckSelectMenu.style.display = 'none';
  }
  
  // Backspace to navigate up
  if (e.key === 'Backspace' && !e.target.matches('input')) {
    navigateUp();
    e.preventDefault();
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
