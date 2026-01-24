/**
 * rockstar v1.1 by Pixamation - Desktop Application
 * Main Renderer Process with Visualizers and Enhanced Features
 */

// Constants
const DECK_COUNT = 20;
const DIR_SLOT_COUNT = 4;
const VISUALIZER_BARS = 16;
const VISUALIZER_COLORS = [
  '#00ff88', '#00ffaa', '#00ffcc', '#00ffee',
  '#00eeff', '#00ccff', '#00aaff', '#0088ff',
  '#ff8800', '#ffaa00', '#ffcc00', '#ffee00',
  '#ff0088', '#ff00aa', '#ff00cc', '#ff00ee'
];

// Audio Context for visualizers
let audioContext = null;

// State Management
const state = {
  directorySlots: {
    1: { path: '', currentPath: '' },
    2: { path: '', currentPath: '' },
    3: { path: '', currentPath: '' },
    4: { path: '', currentPath: '' }
  },
  activeDirectorySlot: 1,
  decks: {},
  selectedFile: null,
  masterVolume: 1,
  searchResults: [],
  searchQuery: '',
  draggingFile: null
};

// Initialize decks 1-20
for (let i = 1; i <= DECK_COUNT; i++) {
  state.decks[i] = { 
    audio: null, 
    file: null, 
    playing: false, 
    queued: false,
    analyser: null,
    source: null,
    visualizerCtx: null,
    dataArray: null
  };
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
async function init() {
  console.log('Initializing rockstar v1.1...');
  
  // Initialize audio elements and visualizers
  for (let i = 1; i <= DECK_COUNT; i++) {
    state.decks[i].audio = document.getElementById(`audio${i}`);
    setupDeckAudio(i);
    setupVisualizer(i);
  }
  
  // Load saved settings
  await loadSettings();
  
  // Setup event listeners
  setupEventListeners();
  
  // Start visualizer animation loop
  requestAnimationFrame(drawAllVisualizers);
  
  // Update status time
  updateStatusTime();
  setInterval(updateStatusTime, 1000);
  
  setStatus('Ready - Select a directory to browse audio files');
}

// Initialize Audio Context (must be done after user interaction)
function initAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

// Setup visualizer for a deck
function setupVisualizer(deckNum) {
  const canvas = document.getElementById(`visualizer${deckNum}`);
  if (canvas) {
    state.decks[deckNum].visualizerCtx = canvas.getContext('2d');
  }
}

// Connect audio to analyser (called when audio is loaded)
function connectAudioAnalyser(deckNum) {
  const deck = state.decks[deckNum];
  const audio = deck.audio;
  
  // Initialize audio context if needed
  const ctx = initAudioContext();
  
  // Only create source once per audio element
  if (!deck.source) {
    deck.source = ctx.createMediaElementSource(audio);
    deck.analyser = ctx.createAnalyser();
    deck.analyser.fftSize = 64;
    deck.dataArray = new Uint8Array(deck.analyser.frequencyBinCount);
    
    deck.source.connect(deck.analyser);
    deck.analyser.connect(ctx.destination);
  }
}

// Draw visualizer for a single deck
function drawVisualizer(deckNum) {
  const deck = state.decks[deckNum];
  const ctx = deck.visualizerCtx;
  const canvas = document.getElementById(`visualizer${deckNum}`);
  
  if (!ctx || !canvas) return;
  
  const width = canvas.width;
  const height = canvas.height;
  
  // Clear canvas
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.fillRect(0, 0, width, height);
  
  // If no analyser or not playing, draw flat bars
  if (!deck.analyser || !deck.playing) {
    ctx.fillStyle = 'rgba(100, 100, 100, 0.3)';
    const barWidth = (width / VISUALIZER_BARS) - 1;
    for (let i = 0; i < VISUALIZER_BARS; i++) {
      const x = i * (barWidth + 1);
      ctx.fillRect(x, height - 2, barWidth, 2);
    }
    return;
  }
  
  // Get frequency data
  deck.analyser.getByteFrequencyData(deck.dataArray);
  
  const barWidth = (width / VISUALIZER_BARS) - 1;
  const dataStep = Math.floor(deck.dataArray.length / VISUALIZER_BARS);
  
  for (let i = 0; i < VISUALIZER_BARS; i++) {
    // Average a range of frequency bins for smoother visualization
    let sum = 0;
    for (let j = 0; j < dataStep; j++) {
      sum += deck.dataArray[i * dataStep + j] || 0;
    }
    const value = sum / dataStep;
    
    const barHeight = (value / 255) * height;
    const x = i * (barWidth + 1);
    
    // Create gradient from green to cyan
    const hue = 120 + (i / VISUALIZER_BARS) * 60; // 120 (green) to 180 (cyan)
    ctx.fillStyle = `hsl(${hue}, 100%, ${50 + (value / 255) * 30}%)`;
    
    ctx.fillRect(x, height - barHeight, barWidth, barHeight);
  }
}

// Animation loop for all visualizers
function drawAllVisualizers() {
  for (let i = 1; i <= DECK_COUNT; i++) {
    drawVisualizer(i);
  }
  requestAnimationFrame(drawAllVisualizers);
}

// Load saved settings
async function loadSettings() {
  try {
    // Load directory slots
    const savedSlots = await window.electronAPI.getDirectorySlots();
    if (savedSlots) {
      for (let i = 1; i <= DIR_SLOT_COUNT; i++) {
        if (savedSlots[i]) {
          state.directorySlots[i].path = savedSlots[i];
          state.directorySlots[i].currentPath = savedSlots[i];
          const folderName = savedSlots[i].split('/').pop() || savedSlots[i];
          document.getElementById(`dirPath${i}`).textContent = folderName;
        }
      }
      // Load first slot if it has content
      if (savedSlots[1]) {
        switchToDirectorySlot(1);
      }
    }
    
    // Load hot buttons (which are synced with decks)
    const hotButtons = await window.electronAPI.loadHotButtons();
    if (hotButtons) {
      for (const [slot, data] of Object.entries(hotButtons)) {
        const deckNum = parseInt(slot);
        if (data && data.path) {
          loadToDeck(deckNum, data.path, data.name);
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
      if (state.directorySlots[slotNum].path) {
        switchToDirectorySlot(slotNum);
      }
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
      const slot = state.directorySlots[state.activeDirectorySlot];
      if (slot.currentPath) {
        loadFolderContents(slot.currentPath);
      }
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
      const filePath = e.dataTransfer.getData('text/plain');
      const fileName = e.dataTransfer.getData('text/filename');
      if (filePath) {
        loadToDeck(btn.dataset.slot, filePath, fileName);
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
  const path = await window.electronAPI.selectFolder();
  if (path) {
    state.directorySlots[slotNum].path = path;
    state.directorySlots[slotNum].currentPath = path;
    
    const folderName = path.split('/').pop() || path;
    document.getElementById(`dirPath${slotNum}`).textContent = folderName;
    
    // Save to settings
    await window.electronAPI.saveDirectorySlots(getDirectorySlotsForSave());
    
    // Switch to this slot
    switchToDirectorySlot(slotNum);
    
    setStatus(`Directory ${slotNum} set: ${folderName}`);
  }
}

// Get directory slots for saving
function getDirectorySlotsForSave() {
  const slots = {};
  for (let i = 1; i <= DIR_SLOT_COUNT; i++) {
    if (state.directorySlots[i].path) {
      slots[i] = state.directorySlots[i].path;
    }
  }
  return slots;
}

// Switch to a directory slot
function switchToDirectorySlot(slotNum) {
  // Update active state on directory slots
  document.querySelectorAll('.directory-slot').forEach(slot => {
    slot.classList.remove('active');
  });
  document.querySelector(`.directory-slot[data-slot="${slotNum}"]`).classList.add('active');
  
  // Update file browser panel color theme
  const panel = document.querySelector('.file-browser-panel');
  panel.classList.remove('slot-1-active', 'slot-2-active', 'slot-3-active', 'slot-4-active');
  panel.classList.add(`slot-${slotNum}-active`);
  
  state.activeDirectorySlot = slotNum;
  
  const slot = state.directorySlots[slotNum];
  if (slot.path) {
    loadFolderContents(slot.currentPath || slot.path);
  } else {
    elements.fileList.innerHTML = '<p class="file-list-empty">Click the button to select a directory.</p>';
    elements.currentPathDisplay.textContent = 'No directory selected';
  }
}

// Load folder contents
async function loadFolderContents(folderPath) {
  setStatus('Loading folder...');
  
  const slot = state.directorySlots[state.activeDirectorySlot];
  slot.currentPath = folderPath;
  
  const contents = await window.electronAPI.getFolderContents(folderPath);
  
  if (contents.error) {
    elements.fileList.innerHTML = `<p class="file-list-empty">Error: ${contents.error}</p>`;
    setStatus('Error loading folder');
    return;
  }
  
  // Update path display
  elements.currentPathDisplay.textContent = folderPath;
  
  renderFileList(contents, folderPath);
  setStatus(`Loaded ${contents.files.length} audio files, ${contents.folders.length} folders`);
}

// Render file list
function renderFileList(contents, currentPath) {
  elements.fileList.innerHTML = '';
  
  const slot = state.directorySlots[state.activeDirectorySlot];
  
  // Add parent folder if not at root
  if (currentPath !== slot.path) {
    const parentItem = document.createElement('div');
    parentItem.className = 'file-item folder-item';
    parentItem.innerHTML = `<span class="file-icon">📁</span><span class="file-name">..</span>`;
    parentItem.addEventListener('click', () => {
      const parentPath = currentPath.split('/').slice(0, -1).join('/') || slot.path;
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
    elements.deckSelectMenu.style.display = 'block';
    elements.deckSelectMenu.style.left = `${e.clientX + 150}px`;
    elements.deckSelectMenu.style.top = `${e.clientY}px`;
    
    elements.deckSelectMenu.querySelectorAll('.deck-select-item').forEach(item => {
      item.onclick = () => {
        const deckNum = item.dataset.deck;
        loadToDeck(deckNum, file.path, file.name);
        elements.deckSelectMenu.style.display = 'none';
      };
    });
  }
}

// Perform search
async function performSearch() {
  const query = elements.searchInput.value.trim();
  if (!query) {
    state.searchQuery = '';
    const slot = state.directorySlots[state.activeDirectorySlot];
    if (slot.currentPath) {
      loadFolderContents(slot.currentPath);
    }
    return;
  }
  
  const slot = state.directorySlots[state.activeDirectorySlot];
  if (!slot.path) {
    setStatus('Please select a directory first');
    return;
  }
  
  state.searchQuery = query;
  setStatus('Searching...');
  const results = await window.electronAPI.searchAudioFiles(slot.path, query);
  
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
  
  setStatus(`Found ${results.length} files`);
}

// Load to deck (and sync with hot button)
function loadToDeck(deckNum, filePath, fileName) {
  deckNum = parseInt(deckNum);
  const audio = state.decks[deckNum].audio;
  audio.src = filePath;
  state.decks[deckNum].file = { path: filePath, name: fileName };
  
  // Connect audio analyser for visualizer (if not already connected)
  connectAudioAnalyser(deckNum);
  
  document.getElementById(`deckFilename${deckNum}`).textContent = fileName || 'Loading...';
  updateDeckState(deckNum, 'loaded');
  updateHotButtonDisplay(deckNum);
  saveHotButtons();
  
  setStatus(`Loaded: ${fileName}`);
}

// Load to first empty deck
function loadToFirstEmptyDeck(filePath, fileName) {
  for (let i = 1; i <= DECK_COUNT; i++) {
    if (!state.decks[i].file) {
      loadToDeck(i, filePath, fileName);
      return i;
    }
  }
  loadToDeck(1, filePath, fileName);
  return 1;
}

// Play deck
function playDeck(deckNum) {
  deckNum = parseInt(deckNum);
  const audio = state.decks[deckNum].audio;
  if (audio.src) {
    // Resume audio context if suspended (requires user gesture)
    if (audioContext && audioContext.state === 'suspended') {
      audioContext.resume();
    }
    // Connect analyser if not already connected
    if (!state.decks[deckNum].analyser) {
      connectAudioAnalyser(deckNum);
    }
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
  
  const nextDeck = deckNum + 1;
  if (nextDeck <= DECK_COUNT && state.decks[nextDeck].queued && state.decks[nextDeck].file) {
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

// Save hot buttons (synced with decks)
async function saveHotButtons() {
  const hotButtonData = {};
  for (let i = 1; i <= DECK_COUNT; i++) {
    if (state.decks[i].file) {
      hotButtonData[i] = {
        path: state.decks[i].file.path,
        name: state.decks[i].file.name
      };
    }
  }
  await window.electronAPI.saveHotButtons(hotButtonData);
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
    const slot = state.directorySlots[state.activeDirectorySlot];
    if (slot.currentPath && slot.currentPath !== slot.path) {
      const parentPath = slot.currentPath.split('/').slice(0, -1).join('/') || slot.path;
      loadFolderContents(parentPath);
    }
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
