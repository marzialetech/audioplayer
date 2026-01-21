/**
 * AudioPlayer by Pixamation - Web Application
 * Browser-based audio playback application
 */

// Constants
const DECK_COUNT = 20;

// State Management
const state = {
  audioLibrary: [], // Array of {name, file, url}
  decks: {},
  selectedFile: null,
  masterVolume: 1,
  searchQuery: ''
};

// Initialize decks 1-10
for (let i = 1; i <= DECK_COUNT; i++) {
  state.decks[i] = { audio: null, file: null, playing: false, queued: false };
}

// DOM Elements
const elements = {
  masterVolume: document.getElementById('masterVolume'),
  masterVolumeValue: document.getElementById('masterVolumeValue'),
  btnAddFiles: document.getElementById('btnAddFiles'),
  btnClearLibrary: document.getElementById('btnClearLibrary'),
  fileInput: document.getElementById('fileInput'),
  searchInput: document.getElementById('searchInput'),
  btnSearch: document.getElementById('btnSearch'),
  fileList: document.getElementById('fileList'),
  hotButtonsGrid: document.getElementById('hotButtonsGrid'),
  contextMenu: document.getElementById('contextMenu'),
  deckSelectMenu: document.getElementById('deckSelectMenu'),
  dropOverlay: document.getElementById('dropOverlay'),
  statusMessage: document.getElementById('statusMessage'),
  statusTime: document.getElementById('statusTime')
};

// Initialize Application
function init() {
  console.log('Initializing AudioPlayer Web App...');
  
  // Initialize audio elements
  for (let i = 1; i <= DECK_COUNT; i++) {
    state.decks[i].audio = document.getElementById(`audio${i}`);
    setupDeckAudio(i);
  }
  
  // Load saved settings from localStorage
  loadSettings();
  
  // Setup event listeners
  setupEventListeners();
  
  // Update status time
  updateStatusTime();
  setInterval(updateStatusTime, 1000);
  
  setStatus('Ready - Add audio files to get started');
}

// Load saved settings from localStorage
function loadSettings() {
  try {
    // Hot buttons can't fully persist in web version (no file access)
    // But we can show the names
    const hotButtons = localStorage.getItem('audioPlayerHotButtons');
    if (hotButtons) {
      const data = JSON.parse(hotButtons);
      // Just update display with names (files need to be re-added)
      for (const [slot, info] of Object.entries(data)) {
        if (info && info.name) {
          const button = document.querySelector(`.hot-button[data-slot="${slot}"]`);
          const label = button.querySelector('.hot-label');
          label.textContent = info.name.replace(/\.[^/.]+$/, '') + ' (reload)';
        }
      }
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
  
  // Add files button
  elements.btnAddFiles.addEventListener('click', () => {
    elements.fileInput.click();
  });
  
  // File input change
  elements.fileInput.addEventListener('change', (e) => {
    handleFileSelect(e.target.files);
    e.target.value = ''; // Reset for re-selection
  });
  
  // Clear library button
  elements.btnClearLibrary.addEventListener('click', clearLibrary);
  
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
      const fileIndex = e.dataTransfer.getData('text/fileindex');
      if (fileIndex !== '') {
        const file = state.audioLibrary[parseInt(fileIndex)];
        if (file) {
          // Load to both hot button and corresponding deck
          loadToDeck(btn.dataset.slot, file);
        }
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
      const fileIndex = e.dataTransfer.getData('text/fileindex');
      if (fileIndex !== '') {
        const file = state.audioLibrary[parseInt(fileIndex)];
        if (file) {
          loadToDeck(deck.dataset.deck, file);
        }
      }
    });
  });
  
  // Global drag and drop for adding files
  document.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('Files')) {
      elements.dropOverlay.classList.add('active');
    }
  });
  
  document.addEventListener('dragleave', (e) => {
    if (e.relatedTarget === null) {
      elements.dropOverlay.classList.remove('active');
    }
  });
  
  document.addEventListener('drop', (e) => {
    e.preventDefault();
    elements.dropOverlay.classList.remove('active');
    
    if (e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files);
    }
  });
  
  // Context menu
  document.addEventListener('click', () => {
    elements.contextMenu.style.display = 'none';
    elements.deckSelectMenu.style.display = 'none';
  });
  
  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeyboard);
}

// Handle file selection
function handleFileSelect(files) {
  const audioFiles = Array.from(files).filter(file => 
    file.type.startsWith('audio/') || 
    /\.(mp3|wav|ogg|flac|aac|m4a)$/i.test(file.name)
  );
  
  if (audioFiles.length === 0) {
    setStatus('No audio files found in selection');
    return;
  }
  
  audioFiles.forEach(file => {
    const url = URL.createObjectURL(file);
    state.audioLibrary.push({
      name: file.name,
      file: file,
      url: url
    });
  });
  
  renderFileList();
  setStatus(`Added ${audioFiles.length} audio file(s)`);
}

// Clear library
function clearLibrary() {
  // Revoke all object URLs
  state.audioLibrary.forEach(item => {
    URL.revokeObjectURL(item.url);
  });
  
  state.audioLibrary = [];
  
  // Clear all decks
  for (let i = 1; i <= DECK_COUNT; i++) {
    clearDeck(i);
  }
  
  renderFileList();
  setStatus('Library cleared');
}

// Render file list
function renderFileList() {
  elements.fileList.innerHTML = '';
  
  let files = state.audioLibrary;
  
  // Apply search filter
  if (state.searchQuery) {
    files = files.filter(f => 
      f.name.toLowerCase().includes(state.searchQuery.toLowerCase())
    );
  }
  
  if (files.length === 0) {
    elements.fileList.innerHTML = state.searchQuery 
      ? '<p class="file-list-empty">No files match your search.</p>'
      : '<p class="file-list-empty">Add audio files to get started.</p>';
    return;
  }
  
  files.forEach((file, index) => {
    const actualIndex = state.audioLibrary.indexOf(file);
    const item = document.createElement('div');
    item.className = 'file-item';
    item.draggable = true;
    item.innerHTML = `<span class="file-icon">🎵</span><span class="file-name">${file.name}</span>`;
    
    item.addEventListener('click', () => selectFile(item, file));
    item.addEventListener('dblclick', () => loadToFirstEmptyDeck(file));
    
    item.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/fileindex', actualIndex.toString());
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
    const count = state.audioLibrary.filter(f => 
      f.name.toLowerCase().includes(state.searchQuery.toLowerCase())
    ).length;
    setStatus(`Found ${count} file(s) matching "${state.searchQuery}"`);
  }
}

// Load to deck (and sync with hot button)
function loadToDeck(deckNum, file) {
  deckNum = parseInt(deckNum);
  const audio = state.decks[deckNum].audio;
  audio.src = file.url;
  state.decks[deckNum].file = file;
  
  document.getElementById(`deckFilename${deckNum}`).textContent = file.name;
  updateDeckState(deckNum, 'loaded');
  
  // Sync with hot button display
  updateHotButtonDisplay(deckNum);
  
  // Save to localStorage (names only for web)
  saveHotButtons();
  
  setStatus(`Loaded: ${file.name}`);
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
  
  // Save to localStorage
  saveHotButtons();
  
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

// Save hot buttons (names only for web - files can't persist)
function saveHotButtons() {
  const hotButtonData = {};
  for (let i = 1; i <= DECK_COUNT; i++) {
    if (state.decks[i].file) {
      hotButtonData[i] = { name: state.decks[i].file.name };
    }
  }
  localStorage.setItem('audioPlayerHotButtons', JSON.stringify(hotButtonData));
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
  
  // Function keys F1-F10 for hot buttons (same as decks now)
  if (e.key.startsWith('F') && !e.ctrlKey && !e.altKey) {
    const num = parseInt(e.key.slice(1));
    if (num >= 1 && num <= 10) {
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
