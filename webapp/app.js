/**
 * rockstar v1.2 by Pixamation - Web Application
 * Browser-based audio playback application
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
  draggingFile: null, // Store file being dragged (handles can't be serialized)
  draggingDeckSlot: null, // Store deck/hot button slot being dragged for reordering
  layout: '20x1', // '20x1' or '10x2'
  clickToAssignMode: false, // True when a file is selected and waiting to be assigned
  slotInput: '', // Stores typed number for quick slot assignment (1-20)
  keyboardFocus: {
    area: null, // 'files', 'decks', 'hotbuttons', or 'dirslots'
    index: 0    // Index within the current area
  },
  focusFirstFileAfterNav: false, // Flag to focus first file after folder navigation
  debugMode: false, // Debug mode to show keystrokes
  keyboardEnabled: false, // Toggle for enabling/disabling keyboard shortcuts (default OFF)
  sortColumn: 'name', // Current sort column: 'name', 'title', 'artist', 'album'
  sortDirection: 'asc' // Sort direction: 'asc' or 'desc'
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
  currentPathDisplay: document.getElementById('currentPathDisplay'),
  btnLayoutToggle: document.getElementById('btnLayoutToggle'),
  audioDecksPanel: document.querySelector('.audio-decks-panel'),
  fileAssignMessage: document.getElementById('fileAssignMessage'),
  debugOverlay: document.getElementById('debugOverlay'),
  keyboardToggle: document.getElementById('keyboardToggle'),
  fileListHeader: document.getElementById('fileListHeader'),
  btnResetColumns: document.getElementById('btnResetColumns')
};

// Initialize Application
function init() {
  console.log('Initializing rockstar v1.2...');
  
  // Initialize audio elements and visualizers
  for (let i = 1; i <= DECK_COUNT; i++) {
    state.decks[i].audio = document.getElementById(`audio${i}`);
    setupDeckAudio(i);
    setupVisualizer(i);
  }
  
  // Setup event listeners
  setupEventListeners();
  
  // Load saved audio decks panel width preference
  const savedWidth = localStorage.getItem('audioDecksPanelWidth');
  if (savedWidth) {
    elements.audioDecksPanel.style.width = `${savedWidth}px`;
  }
  
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
  
  // Keyboard toggle
  if (elements.keyboardToggle) {
    elements.keyboardToggle.addEventListener('change', (e) => {
      state.keyboardEnabled = e.target.checked;
      // Clear any keyboard focus when disabling
      if (!state.keyboardEnabled) {
        clearKeyboardFocus();
        // Hide debug overlay if it was showing
        if (elements.debugOverlay) {
          elements.debugOverlay.classList.remove('visible');
        }
        state.debugMode = false;
      }
      setStatus(state.keyboardEnabled ? 'Keyboard shortcuts enabled' : 'Keyboard shortcuts disabled');
    });
  }
  
  // Layout toggle
  elements.btnLayoutToggle.addEventListener('click', toggleLayout);
  
  // Resize handle for audio decks panel
  setupResizeHandle();
  
  // Column resize handle for 10x2 layout
  setupColumnResizeHandle();
  
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
  
  // Hot buttons - click to play/assign, right-click to clear
  document.querySelectorAll('.hot-button').forEach(btn => {
    btn.addEventListener('click', () => {
      const slot = parseInt(btn.dataset.slot);
      
      // If in click-to-assign mode, load the selected file
      if (state.clickToAssignMode && state.selectedFile) {
        loadToDeck(slot, state.selectedFile);
        exitClickToAssignMode();
        return;
      }
      
      // Otherwise, play if has file
      if (state.decks[slot].file) {
        playDeck(slot);
      }
    });
    
    btn.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      clearDeck(btn.dataset.slot);
    });
    
    // Make hot buttons draggable for reordering
    btn.draggable = true;
    
    btn.addEventListener('dragstart', (e) => {
      const slot = parseInt(btn.dataset.slot);
      // Only allow dragging if the slot has a file
      if (state.decks[slot].file) {
        state.draggingDeckSlot = slot;
        e.dataTransfer.effectAllowed = 'move';
        btn.classList.add('dragging');
      } else {
        e.preventDefault();
      }
    });
    
    btn.addEventListener('dragend', () => {
      btn.classList.remove('dragging');
      state.draggingDeckSlot = null;
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
      const targetSlot = parseInt(btn.dataset.slot);
      
      // Check if we're swapping decks
      if (state.draggingDeckSlot !== null) {
        swapDecks(state.draggingDeckSlot, targetSlot);
        state.draggingDeckSlot = null;
      }
      // Otherwise load a file from file browser
      else if (state.draggingFile) {
        loadToDeck(targetSlot, state.draggingFile);
      }
    });
  });
  
  // Audio decks - click to assign, drag and drop
  document.querySelectorAll('.audio-deck').forEach(deck => {
    // Click on deck to assign selected file
    deck.addEventListener('click', (e) => {
      // Don't trigger if clicking on buttons or sliders
      if (e.target.matches('button, input')) return;
      
      const deckNum = parseInt(deck.dataset.deck);
      
      // If in click-to-assign mode, load the selected file
      if (state.clickToAssignMode && state.selectedFile) {
        loadToDeck(deckNum, state.selectedFile);
        exitClickToAssignMode();
      }
    });
    
    // Make audio decks draggable for reordering
    deck.draggable = true;
    
    deck.addEventListener('dragstart', (e) => {
      const deckNum = parseInt(deck.dataset.deck);
      // Only allow dragging if the deck has a file
      if (state.decks[deckNum].file) {
        state.draggingDeckSlot = deckNum;
        e.dataTransfer.effectAllowed = 'move';
        deck.classList.add('dragging');
      } else {
        e.preventDefault();
      }
    });
    
    deck.addEventListener('dragend', () => {
      deck.classList.remove('dragging');
      state.draggingDeckSlot = null;
    });
    
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
      const targetSlot = parseInt(deck.dataset.deck);
      
      // Check if we're swapping decks
      if (state.draggingDeckSlot !== null) {
        swapDecks(state.draggingDeckSlot, targetSlot);
        state.draggingDeckSlot = null;
      }
      // Otherwise load a file from file browser
      else if (state.draggingFile) {
        loadToDeck(targetSlot, state.draggingFile);
      }
    });
  });
  
  // Context menu and click-to-assign cancellation
  document.addEventListener('click', (e) => {
    elements.contextMenu.style.display = 'none';
    elements.deckSelectMenu.style.display = 'none';
    
    // Cancel click-to-assign mode if clicking outside file list, decks, or hot buttons
    if (state.clickToAssignMode) {
      const clickedOnDeck = e.target.closest('.audio-deck');
      const clickedOnHotButton = e.target.closest('.hot-button');
      const clickedOnFileItem = e.target.closest('.file-item');
      
      // Only cancel if not clicking on a valid target
      if (!clickedOnDeck && !clickedOnHotButton && !clickedOnFileItem) {
        exitClickToAssignMode();
        setStatus('Click-to-assign cancelled');
      }
    }
  });
  
  // File list column sorting
  if (elements.fileListHeader) {
    elements.fileListHeader.querySelectorAll('.sortable').forEach(col => {
      col.addEventListener('click', (e) => {
        // Don't sort if clicking on resize handle
        if (e.target.classList.contains('col-resize-handle')) return;
        
        const sortKey = col.dataset.sort;
        if (state.sortColumn === sortKey) {
          // Toggle direction
          state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          state.sortColumn = sortKey;
          state.sortDirection = 'asc';
        }
        updateSortIndicators();
        renderFileList();
      });
    });
    
    // Setup column resizing
    setupColumnResizing();
  }
  
  // Reset column widths button
  if (elements.btnResetColumns) {
    elements.btnResetColumns.addEventListener('click', resetColumnWidths);
  }
  
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
  state.currentPath = [];
  
  const slot = state.directorySlots[slotNum];
  if (slot.handle) {
    // Set flag to focus first file after loading
    state.focusFirstFileAfterNav = true;
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
    
    // Extract metadata in background
    extractAllMetadata();
  } catch (err) {
    console.error('Error loading directory:', err);
    setStatus('Error loading directory');
  }
}

// Update sort indicators in the column headers
function updateSortIndicators() {
  if (!elements.fileListHeader) return;
  
  elements.fileListHeader.querySelectorAll('.sortable').forEach(col => {
    const sortKey = col.dataset.sort;
    const indicator = col.querySelector('.sort-indicator');
    
    if (sortKey === state.sortColumn) {
      col.classList.add('active');
      indicator.textContent = state.sortDirection === 'asc' ? '▲' : '▼';
    } else {
      col.classList.remove('active');
      indicator.textContent = '';
    }
  });
}

// Sort items based on current sort column and direction
function sortItems(items) {
  const sorted = [...items];
  const col = state.sortColumn;
  const dir = state.sortDirection === 'asc' ? 1 : -1;
  
  sorted.sort((a, b) => {
    // Folders always come first
    if (a.type === 'folder' && b.type !== 'folder') return -1;
    if (a.type !== 'folder' && b.type === 'folder') return 1;
    
    let valA, valB;
    
    if (col === 'name') {
      valA = a.name.toLowerCase();
      valB = b.name.toLowerCase();
    } else {
      // For metadata columns
      valA = (a.metadata && a.metadata[col]) ? a.metadata[col].toLowerCase() : '';
      valB = (b.metadata && b.metadata[col]) ? b.metadata[col].toLowerCase() : '';
    }
    
    if (valA < valB) return -1 * dir;
    if (valA > valB) return 1 * dir;
    return 0;
  });
  
  return sorted;
}

// Extract metadata from an audio file
async function extractMetadata(fileItem) {
  if (!fileItem.handle || fileItem.type !== 'file') return;
  if (fileItem.metadata) return; // Already extracted
  
  try {
    const file = await fileItem.handle.getFile();
    fileItem.metadata = { title: '', artist: '', album: '' };
    
    // Try to read ID3 tags from MP3 files
    if (file.name.toLowerCase().endsWith('.mp3')) {
      const buffer = await file.slice(0, 128 * 1024).arrayBuffer(); // Read first 128KB
      const view = new DataView(buffer);
      
      // Check for ID3v2 header
      if (view.getUint8(0) === 0x49 && view.getUint8(1) === 0x44 && view.getUint8(2) === 0x33) {
        // ID3v2 found - parse it
        const version = view.getUint8(3);
        const size = ((view.getUint8(6) & 0x7f) << 21) |
                     ((view.getUint8(7) & 0x7f) << 14) |
                     ((view.getUint8(8) & 0x7f) << 7) |
                     (view.getUint8(9) & 0x7f);
        
        let offset = 10;
        const headerSize = Math.min(size + 10, buffer.byteLength);
        
        while (offset < headerSize - 10) {
          // Read frame header
          let frameId = '';
          for (let i = 0; i < 4; i++) {
            const char = view.getUint8(offset + i);
            if (char === 0) break;
            frameId += String.fromCharCode(char);
          }
          
          if (!frameId || frameId[0] === '\0') break;
          
          let frameSize;
          if (version === 4) {
            frameSize = ((view.getUint8(offset + 4) & 0x7f) << 21) |
                        ((view.getUint8(offset + 5) & 0x7f) << 14) |
                        ((view.getUint8(offset + 6) & 0x7f) << 7) |
                        (view.getUint8(offset + 7) & 0x7f);
          } else {
            frameSize = (view.getUint8(offset + 4) << 24) |
                        (view.getUint8(offset + 5) << 16) |
                        (view.getUint8(offset + 6) << 8) |
                        view.getUint8(offset + 7);
          }
          
          if (frameSize <= 0 || frameSize > headerSize) break;
          
          const frameStart = offset + 10;
          const frameEnd = Math.min(frameStart + frameSize, buffer.byteLength);
          
          if (frameId === 'TIT2' || frameId === 'TPE1' || frameId === 'TALB') {
            const encoding = view.getUint8(frameStart);
            let text = '';
            
            if (encoding === 0 || encoding === 3) {
              // ISO-8859-1 or UTF-8
              for (let i = frameStart + 1; i < frameEnd; i++) {
                const char = view.getUint8(i);
                if (char === 0) break;
                text += String.fromCharCode(char);
              }
            } else if (encoding === 1 || encoding === 2) {
              // UTF-16
              let start = frameStart + 1;
              // Skip BOM if present
              if (view.getUint8(start) === 0xFF || view.getUint8(start) === 0xFE) {
                start += 2;
              }
              for (let i = start; i < frameEnd - 1; i += 2) {
                const code = view.getUint16(i, true);
                if (code === 0) break;
                text += String.fromCharCode(code);
              }
            }
            
            if (frameId === 'TIT2') fileItem.metadata.title = text.trim();
            else if (frameId === 'TPE1') fileItem.metadata.artist = text.trim();
            else if (frameId === 'TALB') fileItem.metadata.album = text.trim();
          }
          
          offset += 10 + frameSize;
        }
      }
    }
  } catch (err) {
    console.log('Could not extract metadata:', err);
    fileItem.metadata = { title: '', artist: '', album: '' };
  }
}

// Extract metadata for all files in the current view
async function extractAllMetadata() {
  const audioFiles = state.currentFiles.filter(f => f.type === 'file');
  
  // Extract in batches to avoid blocking
  for (const file of audioFiles) {
    await extractMetadata(file);
  }
  
  // Re-render after extraction
  renderFileList();
}

function renderFileList() {
  elements.fileList.innerHTML = '';
  
  let items = state.currentFiles;
  
  // Apply search filter
  if (state.searchQuery) {
    const query = state.searchQuery.toLowerCase();
    items = items.filter(f => {
      if (f.name.toLowerCase().includes(query)) return true;
      if (f.metadata) {
        if (f.metadata.title && f.metadata.title.toLowerCase().includes(query)) return true;
        if (f.metadata.artist && f.metadata.artist.toLowerCase().includes(query)) return true;
        if (f.metadata.album && f.metadata.album.toLowerCase().includes(query)) return true;
      }
      return false;
    });
  }
  
  // Sort items
  items = sortItems(items);
  
  // Add parent folder navigation if in subfolder
  if (state.currentPath.length > 0) {
    const parentItem = document.createElement('div');
    parentItem.className = 'file-item folder-item';
    parentItem.innerHTML = `
      <div class="file-item-col file-col-name">
        <span class="file-icon">📁</span>
        <span class="file-name">Go Back</span>
      </div>
      <div class="file-item-col file-col-title"></div>
      <div class="file-item-col file-col-artist"></div>
      <div class="file-item-col file-col-album"></div>
    `;
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
    const title = item.metadata?.title || '';
    const artist = item.metadata?.artist || '';
    const album = item.metadata?.album || '';
    
    div.innerHTML = `
      <div class="file-item-col file-col-name">
        <span class="file-icon">${icon}</span>
        <span class="file-name">${item.name}</span>
      </div>
      <div class="file-item-col file-col-title" title="${escapeHtml(title)}">${escapeHtml(title)}</div>
      <div class="file-item-col file-col-artist" title="${escapeHtml(artist)}">${escapeHtml(artist)}</div>
      <div class="file-item-col file-col-album" title="${escapeHtml(album)}">${escapeHtml(album)}</div>
    `;
    
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
  
  // Apply saved column widths to new rows
  applyColumnWidthsToRows();
  
  // Check if we should focus the first file after navigation
  if (state.focusFirstFileAfterNav) {
    state.focusFirstFileAfterNav = false;
    const fileCount = getAreaItemCount('files');
    if (fileCount > 0) {
      setKeyboardFocus('files', 0);
    }
  }
}

// Helper to escape HTML
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Column resizing state
const columnResizeState = {
  isResizing: false,
  currentHandle: null,
  currentCol: null,
  startX: 0,
  startWidth: 0
};

// Setup column resizing functionality
function setupColumnResizing() {
  const resizableCols = ['name', 'title', 'artist']; // album is flex, doesn't need resize
  
  resizableCols.forEach(colName => {
    const headerCol = elements.fileListHeader.querySelector(`[data-sort="${colName}"]`);
    if (!headerCol) return;
    
    // Create resize handle
    const handle = document.createElement('div');
    handle.className = 'col-resize-handle';
    handle.dataset.col = colName;
    headerCol.appendChild(handle);
    
    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      startColumnResize(e, colName, headerCol);
    });
  });
  
  // Load saved column widths
  loadColumnWidths();
}

function startColumnResize(e, colName, headerCol) {
  columnResizeState.isResizing = true;
  columnResizeState.currentCol = colName;
  columnResizeState.startX = e.clientX;
  columnResizeState.startWidth = headerCol.offsetWidth;
  
  const handle = headerCol.querySelector('.col-resize-handle');
  if (handle) handle.classList.add('resizing');
  
  document.querySelector('.file-list-container').classList.add('resizing');
  
  document.addEventListener('mousemove', handleColumnResize);
  document.addEventListener('mouseup', stopColumnResize);
}

function handleColumnResize(e) {
  if (!columnResizeState.isResizing) return;
  
  const diff = e.clientX - columnResizeState.startX;
  const newWidth = Math.max(50, columnResizeState.startWidth + diff);
  
  setColumnWidth(columnResizeState.currentCol, newWidth);
}

function stopColumnResize() {
  if (!columnResizeState.isResizing) return;
  
  columnResizeState.isResizing = false;
  
  document.querySelectorAll('.col-resize-handle.resizing').forEach(h => {
    h.classList.remove('resizing');
  });
  
  document.querySelector('.file-list-container')?.classList.remove('resizing');
  
  document.removeEventListener('mousemove', handleColumnResize);
  document.removeEventListener('mouseup', stopColumnResize);
  
  // Save column widths
  saveColumnWidths();
}

function setColumnWidth(colName, width) {
  // Update header column
  const headerCol = elements.fileListHeader.querySelector(`[data-sort="${colName}"]`);
  if (headerCol) {
    headerCol.style.width = `${width}px`;
  }
  
  // Update all file rows
  document.querySelectorAll(`.file-item .file-col-${colName}`).forEach(col => {
    col.style.width = `${width}px`;
  });
}

function saveColumnWidths() {
  const widths = {};
  ['name', 'title', 'artist'].forEach(colName => {
    const headerCol = elements.fileListHeader.querySelector(`[data-sort="${colName}"]`);
    if (headerCol) {
      widths[colName] = headerCol.offsetWidth;
    }
  });
  localStorage.setItem('fileListColumnWidths', JSON.stringify(widths));
}

function loadColumnWidths() {
  try {
    const saved = localStorage.getItem('fileListColumnWidths');
    if (saved) {
      const widths = JSON.parse(saved);
      Object.entries(widths).forEach(([colName, width]) => {
        setColumnWidth(colName, width);
      });
    }
  } catch (err) {
    console.log('Could not load column widths:', err);
  }
}

// Apply saved column widths to newly rendered file rows
function applyColumnWidthsToRows() {
  try {
    const saved = localStorage.getItem('fileListColumnWidths');
    if (saved) {
      const widths = JSON.parse(saved);
      Object.entries(widths).forEach(([colName, width]) => {
        document.querySelectorAll(`.file-item .file-col-${colName}`).forEach(col => {
          col.style.width = `${width}px`;
        });
      });
    }
  } catch (err) {
    // Ignore
  }
}

// Default column widths
const DEFAULT_COLUMN_WIDTHS = {
  name: 200,
  title: 120,
  artist: 120
};

// Reset column widths to defaults
function resetColumnWidths() {
  // Clear saved widths
  localStorage.removeItem('fileListColumnWidths');
  
  // Apply default widths
  Object.entries(DEFAULT_COLUMN_WIDTHS).forEach(([colName, width]) => {
    // Reset header
    const headerCol = elements.fileListHeader?.querySelector(`[data-sort="${colName}"]`);
    if (headerCol) {
      headerCol.style.width = `${width}px`;
    }
    
    // Reset file rows
    document.querySelectorAll(`.file-item .file-col-${colName}`).forEach(col => {
      col.style.width = `${width}px`;
    });
  });
  
  setStatus('Column widths reset to default');
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

// Select file and enter click-to-assign mode
function selectFile(element, file) {
  document.querySelectorAll('.file-item').forEach(item => item.classList.remove('selected'));
  element.classList.add('selected');
  state.selectedFile = file;
  
  // Enter click-to-assign mode
  enterClickToAssignMode();
}

// Enter click-to-assign mode
function enterClickToAssignMode() {
  state.clickToAssignMode = true;
  state.slotInput = '';
  
  // Add visual indicator to all decks and hot buttons
  document.querySelectorAll('.audio-deck').forEach(deck => {
    deck.classList.add('awaiting-file');
  });
  document.querySelectorAll('.hot-button').forEach(btn => {
    btn.classList.add('awaiting-file');
  });
  
  setStatus(`"${state.selectedFile.name}" - Click a slot OR type 1-20 + Enter`);
}

// Exit click-to-assign mode
function exitClickToAssignMode() {
  state.clickToAssignMode = false;
  state.selectedFile = null;
  state.slotInput = '';
  
  // Remove visual indicators
  document.querySelectorAll('.audio-deck').forEach(deck => {
    deck.classList.remove('awaiting-file');
  });
  document.querySelectorAll('.hot-button').forEach(btn => {
    btn.classList.remove('awaiting-file');
  });
  document.querySelectorAll('.file-item').forEach(item => {
    item.classList.remove('selected');
  });
  
  // Clear file assign message
  updateFileAssignMessage('');
}

// Update the file assign message in the file browser
function updateFileAssignMessage(slotInput) {
  if (!elements.fileAssignMessage) return;
  
  if (slotInput && state.selectedFile) {
    elements.fileAssignMessage.textContent = `assign ${state.selectedFile.name} to hot button ${slotInput}`;
    elements.fileAssignMessage.classList.add('visible');
  } else {
    elements.fileAssignMessage.textContent = '';
    elements.fileAssignMessage.classList.remove('visible');
  }
}

// Toggle layout between 20x1 and 10x2
function toggleLayout() {
  const columnResizeHandle = document.getElementById('columnResizeHandle');
  
  if (state.layout === '20x1') {
    state.layout = '10x2';
    elements.audioDecksPanel.classList.add('layout-10x2');
    elements.btnLayoutToggle.classList.add('active');
    elements.btnLayoutToggle.querySelector('.layout-label').textContent = '10×2';
    elements.btnLayoutToggle.querySelector('.layout-icon').textContent = '▦';
    // Show column resize handle
    if (columnResizeHandle) columnResizeHandle.style.display = 'block';
    // Load saved column widths
    loadColumnWidths();
  } else {
    state.layout = '20x1';
    elements.audioDecksPanel.classList.remove('layout-10x2');
    elements.btnLayoutToggle.classList.remove('active');
    elements.btnLayoutToggle.querySelector('.layout-label').textContent = '20×1';
    elements.btnLayoutToggle.querySelector('.layout-icon').textContent = '▤';
    // Hide column resize handle
    if (columnResizeHandle) columnResizeHandle.style.display = 'none';
  }
  setStatus(`Layout changed to ${state.layout}`);
}

// Setup resize handle for audio decks panel
function setupResizeHandle() {
  const resizeHandle = document.getElementById('audioDecksResizeHandle');
  const audioDecksPanel = elements.audioDecksPanel;
  let isResizing = false;
  let startX = 0;
  let startWidth = 0;

  resizeHandle.addEventListener('mousedown', (e) => {
    isResizing = true;
    startX = e.clientX;
    startWidth = parseInt(window.getComputedStyle(audioDecksPanel).width, 10);
    audioDecksPanel.classList.add('resizing');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    
    const width = startWidth + e.clientX - startX;
    const minWidth = audioDecksPanel.classList.contains('layout-10x2') ? 480 : 340;
    const newWidth = Math.max(minWidth, width);
    
    audioDecksPanel.style.width = `${newWidth}px`;
    
    // For 10x2 layout, update the width
    if (audioDecksPanel.classList.contains('layout-10x2')) {
      // Width is set via style, so it overrides the CSS
    }
  });

  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      audioDecksPanel.classList.remove('resizing');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      
      // Save width preference
      const width = parseInt(window.getComputedStyle(audioDecksPanel).width, 10);
      localStorage.setItem('audioDecksPanelWidth', width);
    }
  });
}

// Setup column resize handle for 10x2 layout
function setupColumnResizeHandle() {
  const columnResizeHandle = document.getElementById('columnResizeHandle');
  const audioDecks = document.getElementById('audioDecks');
  if (!columnResizeHandle || !audioDecks) return;
  
  let isResizing = false;
  let startX = 0;
  let startCol1Percent = 50;

  columnResizeHandle.addEventListener('mousedown', (e) => {
    if (!elements.audioDecksPanel.classList.contains('layout-10x2')) return;
    
    isResizing = true;
    startX = e.clientX;
    startCol1Percent = parseFloat(audioDecks.style.getPropertyValue('--col1-width-percent') || '50');
    columnResizeHandle.classList.add('resizing');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
    e.stopPropagation();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    
    const panelWidth = elements.audioDecksPanel.offsetWidth;
    const panelPadding = 20; // Approximate padding
    const availableWidth = panelWidth - panelPadding;
    const deltaX = e.clientX - startX;
    const deltaPercent = (deltaX / availableWidth) * 100;
    
    let newCol1Percent = startCol1Percent + deltaPercent;
    // Constrain between 20% and 80%
    newCol1Percent = Math.max(20, Math.min(80, newCol1Percent));
    const col2Percent = 100 - newCol1Percent;
    
    // Update CSS variables
    audioDecks.style.setProperty('--col1-width-percent', `${newCol1Percent}%`);
    audioDecks.style.setProperty('--col1-width', `${newCol1Percent}%`);
    audioDecks.style.setProperty('--col2-width', `${col2Percent}%`);
    
    // Update handle position
    columnResizeHandle.style.left = `calc(${newCol1Percent}% - 2px)`;
  });

  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      columnResizeHandle.classList.remove('resizing');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      
      // Save column width preference
      const col1Percent = parseFloat(audioDecks.style.getPropertyValue('--col1-width-percent') || '50');
      localStorage.setItem('audioDecksColumnWidth', col1Percent);
    }
  });
}

// Load saved column widths for 10x2 layout
function loadColumnWidths() {
  const audioDecks = document.getElementById('audioDecks');
  const columnResizeHandle = document.getElementById('columnResizeHandle');
  if (!audioDecks || !elements.audioDecksPanel.classList.contains('layout-10x2')) return;
  
  const savedCol1Percent = localStorage.getItem('audioDecksColumnWidth');
  if (savedCol1Percent) {
    const col1Percent = parseFloat(savedCol1Percent);
    const col2Percent = 100 - col1Percent;
    
    audioDecks.style.setProperty('--col1-width-percent', `${col1Percent}%`);
    audioDecks.style.setProperty('--col1-width', `${col1Percent}%`);
    audioDecks.style.setProperty('--col2-width', `${col2Percent}%`);
    
    if (columnResizeHandle) {
      columnResizeHandle.style.left = `calc(${col1Percent}% - 2px)`;
    }
  }
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
    
    // Connect audio analyser for visualizer (if not already connected)
    connectAudioAnalyser(deckNum);
    
    // Update filename with marquee scrolling for long names
    updateDeckFilename(deckNum, file.name);
    updateDeckState(deckNum, 'loaded');
    
    // Sync with hot button display
    updateHotButtonDisplay(deckNum);
    
    setStatus(`Loaded: ${file.name}`);
  } catch (err) {
    console.error('Error loading file:', err);
    setStatus('Error loading file');
  }
}

// Update deck filename with marquee scrolling for long names
function updateDeckFilename(deckNum, filename) {
  const filenameEl = document.getElementById(`deckFilename${deckNum}`);
  
  // Create inner span for marquee animation
  filenameEl.innerHTML = `<span class="deck-filename-inner">${filename}</span>`;
  
  // Check if text is longer than container (needs scrolling)
  const innerSpan = filenameEl.querySelector('.deck-filename-inner');
  
  // Use requestAnimationFrame to ensure DOM is updated before measuring
  requestAnimationFrame(() => {
    const containerWidth = filenameEl.offsetWidth;
    const textWidth = innerSpan.scrollWidth;
    
    if (textWidth > containerWidth) {
      filenameEl.classList.add('scrolling');
    } else {
      filenameEl.classList.remove('scrolling');
    }
  });
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
  
  // Reset deck volume to 100%
  const volumeSlider = document.querySelector(`.deck-volume[data-deck="${deckNum}"]`);
  if (volumeSlider) {
    volumeSlider.value = 100;
    audio.volume = state.masterVolume;
  }
  
  // Reset filename display (remove scrolling class and inner span)
  const filenameEl = document.getElementById(`deckFilename${deckNum}`);
  filenameEl.classList.remove('scrolling');
  filenameEl.textContent = '-- Empty --';
  
  document.getElementById(`deckElapsed${deckNum}`).textContent = '00:00';
  document.getElementById(`deckLength${deckNum}`).textContent = '00:00';
  document.getElementById(`deckRemaining${deckNum}`).textContent = '-00:00';
  document.getElementById(`deckProgress${deckNum}`).style.width = '0%';
  
  updateDeckState(deckNum, 'empty');
  updateHotButtonDisplay(deckNum);
  updateQueueButtonState(deckNum);
}

// Swap contents between two decks
function swapDecks(slot1, slot2) {
  slot1 = parseInt(slot1);
  slot2 = parseInt(slot2);
  
  if (slot1 === slot2) return;
  
  const deck1 = state.decks[slot1];
  const deck2 = state.decks[slot2];
  
  // Stop both decks if playing
  if (deck1.playing) stopDeck(slot1);
  if (deck2.playing) stopDeck(slot2);
  
  // Store references to the files
  const file1 = deck1.file;
  const file2 = deck2.file;
  const queued1 = deck1.queued;
  const queued2 = deck2.queued;
  
  // Clear both decks first
  clearDeck(slot1);
  clearDeck(slot2);
  
  // Load files into swapped positions
  if (file2) {
    loadToDeck(slot1, file2);
    state.decks[slot1].queued = queued2;
    updateQueueButtonState(slot1);
  }
  if (file1) {
    loadToDeck(slot2, file1);
    state.decks[slot2].queued = queued1;
    updateQueueButtonState(slot2);
  }
  
  setStatus(`Swapped slots ${slot1} and ${slot2}`);
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

// Update hot button display (sync with deck) with marquee scrolling for long names
function updateHotButtonDisplay(deckNum) {
  const button = document.querySelector(`.hot-button[data-slot="${deckNum}"]`);
  const label = button.querySelector('.hot-label');
  
  if (state.decks[deckNum].file) {
    const filename = state.decks[deckNum].file.name.replace(/\.[^/.]+$/, '');
    label.innerHTML = `<span class="hot-label-inner">${filename}</span>`;
    button.classList.add('assigned');
    
    // Check if text is longer than container (needs scrolling)
    requestAnimationFrame(() => {
      const innerSpan = label.querySelector('.hot-label-inner');
      if (innerSpan) {
        const containerWidth = label.offsetWidth;
        const textWidth = innerSpan.scrollWidth;
        
        if (textWidth > containerWidth) {
          label.classList.add('scrolling');
        } else {
          label.classList.remove('scrolling');
        }
      }
    });
  } else {
    label.innerHTML = '<span class="hot-label-inner">Empty</span>';
    label.classList.remove('scrolling');
    button.classList.remove('assigned', 'playing');
  }
}

// On deck ended - check sequential queue, then auto-clear
function onDeckEnded(deckNum) {
  deckNum = parseInt(deckNum);
  state.decks[deckNum].playing = false;
  
  // Restore deck volume to 100%
  const volumeSlider = document.querySelector(`.deck-volume[data-deck="${deckNum}"]`);
  if (volumeSlider) {
    volumeSlider.value = 100;
    state.decks[deckNum].audio.volume = state.masterVolume;
  }
  
  // Check if next deck (N+1) is queued BEFORE clearing
  const nextDeck = deckNum + 1;
  const shouldPlayNext = nextDeck <= DECK_COUNT && state.decks[nextDeck].queued && state.decks[nextDeck].file;
  
  // Auto-clear the deck that just finished
  clearDeck(deckNum);
  setStatus(`Deck ${deckNum} finished and cleared`);
  
  // Now play the next queued deck if applicable
  if (shouldPlayNext) {
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

// Keyboard focus management
function clearKeyboardFocus() {
  document.querySelectorAll('.keyboard-focus').forEach(el => {
    el.classList.remove('keyboard-focus');
  });
}

function setKeyboardFocus(area, index) {
  clearKeyboardFocus();
  state.keyboardFocus.area = area;
  state.keyboardFocus.index = index;
  
  let element = null;
  
  if (area === 'files') {
    const fileItems = document.querySelectorAll('.file-item');
    if (fileItems.length > 0) {
      state.keyboardFocus.index = Math.max(0, Math.min(index, fileItems.length - 1));
      element = fileItems[state.keyboardFocus.index];
    }
  } else if (area === 'decks') {
    const decks = document.querySelectorAll('.audio-deck');
    if (decks.length > 0) {
      state.keyboardFocus.index = Math.max(0, Math.min(index, decks.length - 1));
      element = decks[state.keyboardFocus.index];
    }
  } else if (area === 'hotbuttons') {
    const buttons = document.querySelectorAll('.hot-button');
    if (buttons.length > 0) {
      state.keyboardFocus.index = Math.max(0, Math.min(index, buttons.length - 1));
      element = buttons[state.keyboardFocus.index];
    }
  } else if (area === 'dirslots') {
    const slots = document.querySelectorAll('.directory-slot');
    if (slots.length > 0) {
      state.keyboardFocus.index = Math.max(0, Math.min(index, slots.length - 1));
      element = slots[state.keyboardFocus.index];
    }
  }
  
  if (element) {
    element.classList.add('keyboard-focus');
    element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function getAreaItemCount(area) {
  if (area === 'files') {
    return document.querySelectorAll('.file-item').length;
  } else if (area === 'decks') {
    return document.querySelectorAll('.audio-deck').length;
  } else if (area === 'hotbuttons') {
    return document.querySelectorAll('.hot-button').length;
  } else if (area === 'dirslots') {
    return document.querySelectorAll('.directory-slot').length;
  }
  return 0;
}

function handleArrowNavigation(direction) {
  const { area, index } = state.keyboardFocus;
  
  // If no focus yet, start at Hot Button 5
  if (!area) {
    setKeyboardFocus('hotbuttons', 4); // Hot Button 5 (0-indexed)
    return;
  }
  
  // === AUDIO DECKS ===
  if (area === 'decks') {
    const deckCount = getAreaItemCount('decks');
    const deckNum = index + 1; // 1-based deck number
    
    // Check if we're in 10x2 layout (2 columns of decks)
    const is10x2 = state.layout === '10x2';
    
    if (is10x2) {
      // === 10x2 LAYOUT: Decks in 2 columns (1-10 left, 11-20 right) ===
      if (direction === 'up') {
        if (deckNum === 1) {
          // From deck 1, wrap to deck 10
          setKeyboardFocus('decks', 9);
        } else if (deckNum === 11) {
          // From deck 11, wrap to deck 20
          setKeyboardFocus('decks', 19);
        } else {
          setKeyboardFocus('decks', index - 1);
        }
      } else if (direction === 'down') {
        if (deckNum === 10) {
          // From deck 10, wrap to deck 1
          setKeyboardFocus('decks', 0);
        } else if (deckNum === 20) {
          // From deck 20, wrap to deck 11
          setKeyboardFocus('decks', 10);
        } else {
          setKeyboardFocus('decks', index + 1);
        }
      } else if (direction === 'right') {
        if (deckNum <= 10) {
          // Right from deck 1-10 goes to deck N+10 (right column)
          setKeyboardFocus('decks', index + 10);
        } else {
          // Right from deck 11-20 goes to hot button N-10
          setKeyboardFocus('hotbuttons', index - 10);
        }
      } else if (direction === 'left') {
        if (deckNum <= 10) {
          // Left from deck 1-10 goes to first file if exists, else Select Folder 2
          const fileCount = getAreaItemCount('files');
          if (fileCount > 0) {
            setKeyboardFocus('files', 0);
          } else {
            setKeyboardFocus('dirslots', 1);
          }
        } else {
          // Left from deck 11-20 goes to deck N-10 (left column)
          setKeyboardFocus('decks', index - 10);
        }
      }
    } else {
      // === 20x1 LAYOUT: Decks in single column (1-20 vertical) ===
      if (direction === 'up') {
        if (index === 0) {
          // From deck 1, wrap to deck 20
          setKeyboardFocus('decks', deckCount - 1);
        } else {
          setKeyboardFocus('decks', index - 1);
        }
      } else if (direction === 'down') {
        if (index === deckCount - 1) {
          // From deck 20, wrap to deck 1
          setKeyboardFocus('decks', 0);
        } else {
          setKeyboardFocus('decks', index + 1);
        }
      } else if (direction === 'right') {
        // Right from deck N goes to hot button N
        setKeyboardFocus('hotbuttons', index);
      } else if (direction === 'left') {
        // Any deck in 20x1: left goes to first file if exists, else Select Folder 2
        const fileCount = getAreaItemCount('files');
        if (fileCount > 0) {
          setKeyboardFocus('files', 0);
        } else {
          setKeyboardFocus('dirslots', 1);
        }
      }
    }
    return;
  }
  
  // === HOT BUTTONS (2-column: 1-10 left, 11-20 right, wrapping within columns) ===
  if (area === 'hotbuttons') {
    const slot = index + 1; // slot number is 1-based
    const is10x2 = state.layout === '10x2';
    
    if (direction === 'up') {
      if (slot === 1) {
        // From slot 1, wrap to slot 10
        setKeyboardFocus('hotbuttons', 9);
      } else if (slot === 11) {
        // From slot 11, wrap to slot 20
        setKeyboardFocus('hotbuttons', 19);
      } else {
        // Move up within column
        setKeyboardFocus('hotbuttons', index - 1);
      }
    } else if (direction === 'down') {
      if (slot === 10) {
        // From slot 10, wrap to slot 1
        setKeyboardFocus('hotbuttons', 0);
      } else if (slot === 20) {
        // From slot 20, wrap to slot 11
        setKeyboardFocus('hotbuttons', 10);
      } else {
        // Move down within column
        setKeyboardFocus('hotbuttons', index + 1);
      }
    } else if (direction === 'right') {
      if (slot <= 10) {
        // From left column (1-10), go to right column (11-20)
        setKeyboardFocus('hotbuttons', index + 10);
      } else if (slot <= 12) {
        // From slots 11-12, go to Select Folder 1
        setKeyboardFocus('dirslots', 0);
      } else {
        // From slots 13-20, go to first file in file list
        const fileCount = getAreaItemCount('files');
        if (fileCount > 0) {
          setKeyboardFocus('files', 0);
        } else {
          // If no files, go to Select Folder 1
          setKeyboardFocus('dirslots', 0);
        }
      }
    } else if (direction === 'left') {
      if (slot > 10) {
        // From right column (11-20), go to left column (1-10)
        setKeyboardFocus('hotbuttons', index - 10);
      } else {
        // From left column (1-10)
        if (is10x2) {
          // In 10x2 layout, go to deck N+10
          setKeyboardFocus('decks', index + 10);
        } else {
          // In 20x1 layout, go to corresponding deck N
          setKeyboardFocus('decks', index);
        }
      }
    }
    return;
  }
  
  // === DIRECTORY SLOTS (2x2 grid: SF1=top-left, SF2=top-right, SF3=bottom-left, SF4=bottom-right) ===
  if (area === 'dirslots') {
    const slotNum = index + 1; // 1-based: 1, 2, 3, 4
    
    if (direction === 'up') {
      if (slotNum === 3) {
        // SF3 -> SF1
        setKeyboardFocus('dirslots', 0);
      } else if (slotNum === 4) {
        // SF4 -> SF2
        setKeyboardFocus('dirslots', 1);
      }
      // SF1 and SF2 at top, no up action
    } else if (direction === 'down') {
      if (slotNum === 1) {
        // SF1 -> SF3
        setKeyboardFocus('dirslots', 2);
      } else if (slotNum === 2) {
        // SF2 -> SF4
        setKeyboardFocus('dirslots', 3);
      } else if (slotNum === 3 || slotNum === 4) {
        // SF3 or SF4 -> first file in search results
        const fileCount = getAreaItemCount('files');
        if (fileCount > 0) {
          setKeyboardFocus('files', 0);
        }
      }
    } else if (direction === 'left') {
      if (slotNum === 2) {
        // SF2 -> SF1
        setKeyboardFocus('dirslots', 0);
      } else if (slotNum === 4) {
        // SF4 -> SF3
        setKeyboardFocus('dirslots', 2);
      } else if (slotNum === 1 || slotNum === 3) {
        // SF1 or SF3 -> Hot Button 11
        setKeyboardFocus('hotbuttons', 10);
      }
    } else if (direction === 'right') {
      if (slotNum === 1) {
        // SF1 -> SF2
        setKeyboardFocus('dirslots', 1);
      } else if (slotNum === 3) {
        // SF3 -> SF4
        setKeyboardFocus('dirslots', 3);
      } else if (slotNum === 2 || slotNum === 4) {
        // SF2 or SF4 -> Audio Deck Card 1
        setKeyboardFocus('decks', 0);
      }
    }
    return;
  }
  
  // === FILES (with wrapping) ===
  if (area === 'files') {
    const count = getAreaItemCount('files');
    
    if (direction === 'up') {
      if (index === 0) {
        // From first file, wrap to last file
        setKeyboardFocus('files', count - 1);
      } else {
        setKeyboardFocus('files', index - 1);
      }
    } else if (direction === 'down') {
      if (index === count - 1) {
        // From last file, wrap to first file
        setKeyboardFocus('files', 0);
      } else {
        setKeyboardFocus('files', index + 1);
      }
    } else if (direction === 'left') {
      // Left from files goes to Hot Button 13
      setKeyboardFocus('hotbuttons', 12);
    } else if (direction === 'right') {
      // Right from files goes to decks
      setKeyboardFocus('decks', Math.min(index, getAreaItemCount('decks') - 1));
    }
    return;
  }
}

function handleFocusedItemAction(action) {
  const { area, index } = state.keyboardFocus;
  if (!area) return false;
  
  if (area === 'files') {
    const fileItems = document.querySelectorAll('.file-item');
    if (fileItems[index]) {
      if (action === 'enter') {
        // Check if it's a folder
        if (fileItems[index].classList.contains('folder-item')) {
          // Set flag to focus first file after navigation
          state.focusFirstFileAfterNav = true;
          // Click to navigate into folder
          fileItems[index].click();
        } else {
          // Regular file - click to select for assignment
          fileItems[index].click();
        }
        return true;
      }
    }
  } else if (area === 'decks') {
    const decks = document.querySelectorAll('.audio-deck');
    if (decks[index]) {
      const deckNum = parseInt(decks[index].dataset.deck);
      if (action === 'enter') {
        // Play the deck
        if (state.decks[deckNum].file) {
          playDeck(deckNum);
        }
        return true;
      } else if (action === 'backspace') {
        // Clear the deck
        clearDeck(deckNum);
        return true;
      } else if (action === 'queue') {
        // Toggle queue for the deck
        toggleQueue(deckNum);
        return true;
      }
    }
  } else if (area === 'hotbuttons') {
    const buttons = document.querySelectorAll('.hot-button');
    if (buttons[index]) {
      const slot = parseInt(buttons[index].dataset.slot);
      if (action === 'enter') {
        // Play the hot button
        if (state.decks[slot].file) {
          playDeck(slot);
        }
        return true;
      } else if (action === 'backspace') {
        // Clear the slot
        clearDeck(slot);
        return true;
      } else if (action === 'queue') {
        // Toggle queue for the slot
        toggleQueue(slot);
        return true;
      }
    }
  } else if (area === 'dirslots') {
    const slots = document.querySelectorAll('.directory-slot');
    if (slots[index]) {
      const slotNum = parseInt(slots[index].dataset.slot);
      if (action === 'enter') {
        // Trigger folder selection for this directory slot
        selectDirectory(slotNum);
        return true;
      }
    }
  }
  return false;
}

// Keyboard shortcuts
function handleKeyboard(e) {
  // Don't trigger shortcuts when typing in input fields
  if (e.target.matches('input')) return;
  
  // If keyboard shortcuts are disabled, exit early
  if (!state.keyboardEnabled) return;
  
  // Show debug info if debug mode is on
  if (state.debugMode && elements.debugOverlay) {
    elements.debugOverlay.textContent = `Key: ${e.key}`;
  }
  
  // Toggle debug mode with 'b' (only when not in click-to-assign mode)
  if ((e.key === 'b' || e.key === 'B') && !state.clickToAssignMode) {
    state.debugMode = !state.debugMode;
    if (elements.debugOverlay) {
      if (state.debugMode) {
        elements.debugOverlay.classList.add('visible');
        elements.debugOverlay.textContent = 'Debug ON';
      } else {
        elements.debugOverlay.classList.remove('visible');
      }
    }
    e.preventDefault();
    return;
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
    return;
  }
  
  // Escape to close context menu and exit click-to-assign mode
  if (e.key === 'Escape') {
    elements.contextMenu.style.display = 'none';
    elements.deckSelectMenu.style.display = 'none';
    if (state.clickToAssignMode) {
      state.slotInput = '';
      updateFileAssignMessage('');
      exitClickToAssignMode();
      setStatus('Assignment cancelled');
    }
    clearKeyboardFocus();
    return;
  }
  
  // Quick slot assignment: only active when in click-to-assign mode
  if (state.clickToAssignMode && state.selectedFile) {
    // Number keys 0-9 to build slot number
    if (e.key >= '0' && e.key <= '9') {
      state.slotInput += e.key;
      // Limit to 2 digits (max slot 20)
      if (state.slotInput.length > 2) {
        state.slotInput = state.slotInput.slice(-2);
      }
      setStatus(`Assign "${state.selectedFile.name}" to slot: ${state.slotInput}_ (Press Enter to confirm)`);
      updateFileAssignMessage(state.slotInput);
      e.preventDefault();
      return;
    }
    
    // Backspace to delete last digit (only if typing a slot number)
    if (e.key === 'Backspace' && state.slotInput.length > 0) {
      state.slotInput = state.slotInput.slice(0, -1);
      if (state.slotInput.length > 0) {
        setStatus(`Assign "${state.selectedFile.name}" to slot: ${state.slotInput}_ (Press Enter to confirm)`);
      } else {
        setStatus(`"${state.selectedFile.name}" - Click a slot OR type 1-20 + Enter`);
      }
      updateFileAssignMessage(state.slotInput);
      e.preventDefault();
      return;
    }
    
    // Enter to confirm assignment (only if typing a slot number)
    if (e.key === 'Enter' && state.slotInput.length > 0) {
      const slotNum = parseInt(state.slotInput);
      if (slotNum >= 1 && slotNum <= DECK_COUNT) {
        loadToDeck(slotNum, state.selectedFile);
        setStatus(`Assigned "${state.selectedFile.name}" to slot ${slotNum}`);
        state.slotInput = '';
        updateFileAssignMessage('');
        exitClickToAssignMode();
      } else {
        setStatus(`Invalid slot number. Enter 1-${DECK_COUNT}`);
        state.slotInput = '';
        updateFileAssignMessage('');
      }
      e.preventDefault();
      return;
    }
  }
  
  // Arrow key navigation
  if (e.key === 'ArrowUp') {
    handleArrowNavigation('up');
    e.preventDefault();
    return;
  }
  if (e.key === 'ArrowDown') {
    handleArrowNavigation('down');
    e.preventDefault();
    return;
  }
  if (e.key === 'ArrowLeft') {
    handleArrowNavigation('left');
    e.preventDefault();
    return;
  }
  if (e.key === 'ArrowRight') {
    handleArrowNavigation('right');
    e.preventDefault();
    return;
  }
  
  // Enter on focused item (when not in slot assignment mode)
  if (e.key === 'Enter' && !state.clickToAssignMode) {
    if (handleFocusedItemAction('enter')) {
      e.preventDefault();
      return;
    }
  }
  
  // Backspace on focused deck/hotbutton to clear it
  if (e.key === 'Backspace' && !state.clickToAssignMode) {
    if (handleFocusedItemAction('backspace')) {
      e.preventDefault();
      return;
    }
  }
  
  // Q on focused deck/hotbutton to toggle queue
  if (e.key === 'q' || e.key === 'Q') {
    if (handleFocusedItemAction('queue')) {
      e.preventDefault();
      return;
    }
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
