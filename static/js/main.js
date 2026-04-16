// main.js — app entrypoint (type="module")
/*
  Responsibilities:
  - create shared state container (window.VN_STATE) so modules can share mutable state
  - query top-level DOM nodes (guarded)
  - wire event listeners to functions exported by feature/auth/ui modules
  - initialize small UI pieces (profile menu)
  - call showLogin()/showMainApp() depending on user session
*/

//
// Shared state (single source of truth for mutable app state).
// Other modules may read/write window.VN_STATE directly.
//
window.VN_STATE = window.VN_STATE || {
  recsCache: [],
  currentSearch: '',
  mediaRecorder: null,
  recordedChunks: [],
  recordedBlob: null,
  els: {}
};

// ---- Imports (other files will export these named functions) ----
import { showLogin, showMainApp, getUserId, logout as authLogout, initAuth, validateSession } from './auth/auth.js';
import { fetchRecordings, pollStatusAndUpdate, apiInit } from './api/recordings-api.js';
import { createRecordingCard, replaceCard, updateCacheWithRecording } from './ui/recording-card.js';
import { renderCollapsibleField, findBlockElements as _findBlockElements } from './ui/collapsible-block.js';
import { openEditTranscript } from './ui/modals.js';
import { openChatModal } from './ui/chat-modal.js';
import { openAskAiModal } from './ui/ask-ai-modal.js';
import { _showCopyToast } from './ui/toast.js';
import { handleUpload } from './features/upload.js';
import { startRecording, pauseRecording, resumeRecording, stopRecording } from './features/recording.js';
import { applySearchFilter } from './features/search.js';
import { handleSummarize, handleMeetingNotes, handleMainPoints, handleTodoList, handleEmailDraft, handleCleanup } from './features/ai-actions.js';
import { handleCopyLink, handleCopyNote, handleCopyField, handleWhatsAppShare, handleOutlookShare } from './features/copy-actions.js';
import { toggleCreateMenuForCard, openCreateMenu, closeAllCreateMenus } from './menus/create-menu.js';
import { toggleShareMenuForCard, openShareMenu, closeAllShareMenus } from './menus/share-menu.js';
import { initProfileMenu } from './menus/profile-menu.js';
import { debounce } from './utils/debounce.js';
import { formatMultiline } from './utils/text-helpers.js';
import { initDraggableCard } from './features/draggable-card.js';

// ---- DOM queries (guarded) ----
const recordingsEl = document.getElementById('recordings');
const emptyState = document.getElementById('emptyState');
const uploadBtn = document.getElementById('uploadBtn');
const audioInput = document.getElementById('audioFile');
const recordBtn = document.getElementById('recordBtn');
const stopBtn = document.getElementById('stopBtn');
const audioPreview = document.getElementById('audioPreview');
const searchInput = document.getElementById('searchInput');
const loginCard = document.getElementById('loginCard');
const mainApp = document.getElementById('mainApp');
const loginForm = document.getElementById('loginForm');
const loginBtn = document.getElementById('loginBtn');
const loginError = document.getElementById('loginError');
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const logoutOption = document.getElementById('logoutOption');
const profileBtn = document.getElementById('profileBtn');
const dropdownMenu = document.getElementById('dropdownMenu');
const logoutOptionEl = document.getElementById('logoutOption');
const aboutOptionEl = document.getElementById('aboutOption');
const helpOptionEl = document.getElementById('helpOption');
const askAiBtn = document.getElementById('askAiBtn');
const addFilterBtn = document.getElementById('addFilterBtn');

// stash DOM refs into shared state so feature modules can use them if needed
window.VN_STATE.els = {
  recordingsEl,
  emptyState,
  uploadBtn,
  audioInput,
  recordBtn,
  stopBtn,
  audioPreview,
  searchInput,
  loginCard,
  mainApp,
  loginForm,
  loginBtn,
  loginError,
  loginEmail,
  loginPassword,
  logoutOption,
  profileBtn,
  dropdownMenu,
  logoutOptionEl,
  aboutOptionEl,
  helpOptionEl,
  askAiBtn,
  addFilterBtn
};

// ---- Small helpers used in main wiring ----
async function render() {
  // fetch recordings via API module and update cache + UI
  try {
    const recs = await fetchRecordings();
    window.VN_STATE.recsCache = Array.isArray(recs) ? recs : [];
    window.VN_STATE.currentSearch = (searchInput && searchInput.value) ? searchInput.value : '';
    // apply search and render cards
    applySearchFilter();
  } catch (e) {
    console.error('render error', e);
  }
}

// expose render and a few helpers for debugging/other modules
export { render, createRecordingCard, replaceCard, updateCacheWithRecording, pollStatusAndUpdate };

// ---- Initialization: wire up UI event listeners, protected against missing DOM nodes ----
function attachListenersOnLoad() {
  if (uploadBtn) uploadBtn.addEventListener('click', (ev) => {
    ev.preventDefault();
    handleUpload();
  });

  if (recordBtn) recordBtn.addEventListener('click', (ev) => {
    ev.preventDefault();
    const { mediaRecorder } = window.VN_STATE;

    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      // Start new recording
      startRecording();
    } else if (mediaRecorder.state === 'recording') {
      // Pause current recording
      pauseRecording();
    } else if (mediaRecorder.state === 'paused') {
      // Resume/Continue recording
      resumeRecording();
    }
  });

  if (stopBtn) stopBtn.addEventListener('click', (ev) => {
    ev.preventDefault();

    // Check the button state
    const buttonState = stopBtn.dataset.state;

    if (buttonState === 'done') {
      // Stop the recording first, then upload
      stopRecording();
      // Wait a brief moment for the recording to stop and blob to be created
      setTimeout(() => {
        handleUpload();
      }, 100);
    } else if (buttonState === 'upload') {
      // Upload the recorded audio
      handleUpload();
    } else if (buttonState === 'stop') {
      // Stop the recording
      stopRecording();
    }
  });

  // Handle file input change
  if (audioInput) {
    audioInput.addEventListener('change', (ev) => {
      const file = ev.target.files[0];
      if (file) {
        console.log('File selected:', file.name);

        // Check file size (10 MB limit)
        const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
        if (file.size > MAX_FILE_SIZE) {
          alert(`File is too large (${(file.size / 1024 / 1024).toFixed(2)} MB). Maximum file size is 10 MB.`);
          audioInput.value = ''; // Clear the input
          return;
        }

        // Show audio preview if available
        if (audioPreview) {
          audioPreview.src = URL.createObjectURL(file);
          audioPreview.style.display = 'block';
        }
        // Auto-upload the file
        handleUpload();
      }
    });

    // Handle drag and drop on the label
    const fileLabel = document.querySelector('.upload-file-btn');
    if (fileLabel) {
      fileLabel.addEventListener('dragover', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        fileLabel.style.background = '#f0f1ff';
        fileLabel.style.borderColor = '#764ba2';
      });

      fileLabel.addEventListener('dragleave', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        fileLabel.style.background = '#ffffff';
        fileLabel.style.borderColor = '#d1d5db';
      });

      fileLabel.addEventListener('drop', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        fileLabel.style.background = '#ffffff';
        fileLabel.style.borderColor = '#d1d5db';

        const files = ev.dataTransfer.files;
        if (files.length > 0) {
          const file = files[0];
          // Check if it's an audio file
          if (file.type.startsWith('audio/')) {
            // Check file size (10 MB limit)
            const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
            if (file.size > MAX_FILE_SIZE) {
              alert(`File is too large (${(file.size / 1024 / 1024).toFixed(2)} MB). Maximum file size is 10 MB.`);
              return;
            }

            audioInput.files = files;
            console.log('File dropped:', file.name);
            // Show audio preview if available
            if (audioPreview) {
              audioPreview.src = URL.createObjectURL(file);
              audioPreview.style.display = 'block';
            }
            // Auto-upload the file
            handleUpload();
          } else {
            alert('Please drop an audio file');
          }
        }
      });
    }
  }

  if (searchInput) {
    // Debounced input handling, mirror original behavior
    searchInput.addEventListener('input', debounce((e) => {
      window.VN_STATE.currentSearch = e.target.value || '';
      applySearchFilter();
    }, 300));
  }

  // profile menu init
  try {
    initProfileMenu();
  } catch (e) {
    console.warn('initProfileMenu not ready yet', e);
  }

  // logout option (guards)
  if (logoutOptionEl) {
    logoutOptionEl.addEventListener('click', (ev) => {
      ev.preventDefault();
      try {
        authLogout();
      } catch (e) {
        localStorage.removeItem('user_id');
        if (typeof showLogin === 'function') showLogin();
      }
    });
  }

  // about option
  if (aboutOptionEl) {
    aboutOptionEl.addEventListener('click', (ev) => {
      ev.preventDefault();
      alert('Voice Notes MVP - AI-powered voice transcription and note-taking application.');
    });
  }

  // help option
  if (helpOptionEl) {
    helpOptionEl.addEventListener('click', (ev) => {
      ev.preventDefault();
      alert('Help: Upload audio files or record directly, then use AI features to transcribe, summarize, and generate meeting notes.');
    });
  }

  // ask ai button - Opens a modal to select which recording to ask about
  if (askAiBtn) {
    askAiBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      openAskAiModal();
    });
  }


  // listen for card-updated events from modals
  document.addEventListener('vn:recording-updated', (ev) => {
    const { recording, oldCard } = ev.detail || {};
    if (recording && oldCard) replaceCard(recording, oldCard);
  });
}

// Run on window load (like original script)
window.addEventListener('load', async () => {
  attachListenersOnLoad();

  // initialize API module if it needs bootstrapping
  try {
    apiInit && apiInit();
  } catch (e) { /* ignore */ }

  // initialize auth bindings (login form)
  try {
    initAuth && initAuth({ loginForm, loginBtn, loginError, loginEmail, loginPassword });
  } catch (e) { /* ignore */ }

  // initialize draggable upload card
  try {
    initDraggableCard();
  } catch (e) {
    console.warn('Failed to initialize draggable card', e);
  }

  // Now show either login or app based on session validation
  try {
    if (getUserId && getUserId()) {
      // User has stored credentials - optimistically show main app while validating
      showMainApp();
      // Validate session in background
      const isValid = await validateSession();
      if (!isValid) {
        // Session invalid - show login
        showLogin();
      }
    } else {
      showLogin();
    }
  } catch (e) {
    console.warn('Session check failed, showing login', e);
    showLogin();
  }
});

// expose some helpers to the console for debugging
window.VN = {
  render,
  state: window.VN_STATE,
  createRecordingCard,
  replaceCard,
  pollStatusAndUpdate
};
