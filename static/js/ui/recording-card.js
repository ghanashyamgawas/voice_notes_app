// ui/recording-card.js - Redesigned to match Home main.png
import { renderCollapsibleField } from './collapsible-block.js';
import { pollStatusAndUpdate, deleteRecording, fetchRelatedNotes } from '../api/recordings-api.js';
import { handleSummarize, handleMeetingNotes, handleMainPoints, handleTodoList, handleEmailDraft, handleCleanup, handleSummarizeSubnotes } from '../features/ai-actions.js';
import { handleCopyNote, handleCopyField } from '../features/copy-actions.js';
import { formatMultiline, formatShortDate } from '../utils/text-helpers.js';
import { openEditTranscript } from './modals.js';
import { openChatModal } from './chat-modal.js';
import { toggleCreateMenuForCard } from '../menus/create-menu.js';
import { toggleMoreMenuForCard } from '../menus/more-menu.js';
import { applySearchFilter } from '../features/search.js';

// Full-screen image viewer
function openImageViewer(imageUrl, onDelete) {
  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'image-viewer-overlay';

  // Create viewer container
  const viewer = document.createElement('div');
  viewer.className = 'image-viewer';

  // Create button container
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'image-viewer-buttons';

  // Create delete button
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'image-viewer-btn image-viewer-delete';
  deleteBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 6h18M8 6v12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M10 11v5M14 11v5M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    Delete
  `;
  deleteBtn.addEventListener('click', async () => {
    if (confirm('Delete this image?')) {
      // Show loading state
      deleteBtn.disabled = true;
      deleteBtn.innerHTML = 'Deleting...';

      await onDelete();

      document.body.removeChild(overlay);
    }
  });

  // Create close button
  const closeBtn = document.createElement('button');
  closeBtn.className = 'image-viewer-btn image-viewer-close';
  closeBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>
    Close
  `;
  closeBtn.addEventListener('click', () => {
    document.body.removeChild(overlay);
  });

  buttonContainer.appendChild(deleteBtn);
  buttonContainer.appendChild(closeBtn);

  // Create image
  const img = document.createElement('img');
  img.src = imageUrl;
  img.className = 'image-viewer-img';
  img.alt = 'Full screen image';

  viewer.appendChild(buttonContainer);
  viewer.appendChild(img);
  overlay.appendChild(viewer);

  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      document.body.removeChild(overlay);
    }
  });

  // Close on Escape key
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      document.body.removeChild(overlay);
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);

  document.body.appendChild(overlay);
}

// Function to show link input modal
function showLinkInputModal(callback) {
  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'link-modal-overlay';

  // Create modal container
  const modal = document.createElement('div');
  modal.className = 'link-modal';

  // Create modal content
  modal.innerHTML = `
    <div class="link-modal-header">
      <h3>Insert Link</h3>
      <button class="link-modal-close" type="button">&times;</button>
    </div>
    <div class="link-modal-body">
      <div class="link-modal-field">
        <label for="link-url-input">URL</label>
        <input type="text" id="link-url-input" class="link-modal-input" placeholder="https://example.com" autofocus>
      </div>
    </div>
    <div class="link-modal-footer">
      <button class="link-modal-btn link-modal-cancel" type="button">Cancel</button>
      <button class="link-modal-btn link-modal-insert" type="button">Insert</button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Get elements
  const urlInput = modal.querySelector('#link-url-input');
  const closeBtn = modal.querySelector('.link-modal-close');
  const cancelBtn = modal.querySelector('.link-modal-cancel');
  const insertBtn = modal.querySelector('.link-modal-insert');

  // Close handlers
  const closeModal = () => {
    document.body.removeChild(overlay);
  };

  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  // Insert handler
  const handleInsert = () => {
    const url = urlInput.value.trim();

    if (!url) {
      urlInput.focus();
      urlInput.style.borderColor = '#ef4444';
      return;
    }

    callback(url, url); // Use URL as text as well
    closeModal();
  };

  insertBtn.addEventListener('click', handleInsert);

  // Enter key to insert
  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleInsert();
  });

  // Escape to close
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      closeModal();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);

  // Focus URL input
  setTimeout(() => urlInput.focus(), 100);
}

// Helper function to create link element
function createLinkElement(url, text, recId) {
  const linkWrapper = document.createElement('div');
  linkWrapper.className = 'attached-link-wrapper';
  linkWrapper.contentEditable = 'false';

  // Ensure URL has protocol
  let finalUrl = url;
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    finalUrl = 'https://' + url;
  }

  // Create link icon
  const linkIcon = document.createElement('span');
  linkIcon.className = 'attached-link-icon';
  linkIcon.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;

  const link = document.createElement('a');
  link.href = finalUrl;
  link.className = 'attached-link';
  link.textContent = text;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';

  // Create delete button - only visible on hover
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'link-delete-btn-inline';
  deleteBtn.type = 'button';
  deleteBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 6h18M8 6v12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V6M10 3h4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M10 11v5M14 11v5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
  deleteBtn.title = 'Delete link';

  linkWrapper.appendChild(linkIcon);
  linkWrapper.appendChild(link);
  linkWrapper.appendChild(deleteBtn);
  return linkWrapper;
}

// Function to render a subnote under its parent card
export function renderSubnote(subnoteRec, parentCard) {
  console.log('renderSubnote called with:', subnoteRec, parentCard);

  // Find the card-content section inside the parent card
  const cardContent = parentCard.querySelector('.card-content');
  console.log('Card content found:', cardContent);

  if (!cardContent) {
    console.error('Could not find card-content in parent card');
    return;
  }

  // Check if subnotes container already exists
  let subnotesContainer = cardContent.querySelector('.subnotes-container');

  if (!subnotesContainer) {
    console.log('Creating new subnotes container');
    // Create subnotes container
    subnotesContainer = document.createElement('div');
    subnotesContainer.className = 'subnotes-container';

    // Create label
    const subnoteLabel = document.createElement('div');
    subnoteLabel.className = 'subnote-label';
    subnoteLabel.textContent = 'Subnote';
    subnotesContainer.appendChild(subnoteLabel);

    // Append inside the card-content at the end (after action buttons)
    cardContent.appendChild(subnotesContainer);
    console.log('Subnotes container appended to card-content');
  }

  // Create the subnote card using the same createRecordingCard function
  console.log('Creating subnote card...');
  const subnoteCard = createRecordingCard(subnoteRec);
  subnoteCard.classList.add('subnote-card');
  subnoteCard.setAttribute('data-rec-id', subnoteRec.id);

  // Append to subnotes container
  subnotesContainer.appendChild(subnoteCard);
  console.log('Subnote card appended, total subnotes:', subnotesContainer.children.length - 1);
}

// Function to open subnote recorder modal
function openSubnoteRecorder(rec) {
  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'subnote-recorder-overlay';

  // Create modal
  const modal = document.createElement('div');
  modal.className = 'subnote-recorder-modal';

  // Recording state
  const MAX_SUBNOTE_RECORDING_SECONDS = 600; // 10 minutes
  let mediaRecorder = null;
  let audioChunks = [];
  let recordingSeconds = 0;
  let timerInterval = null;
  let isPaused = false;

  // Create timer display
  const timerDisplay = document.createElement('div');
  timerDisplay.className = 'subnote-timer';
  timerDisplay.textContent = '00:00';

  // Create record button
  const recordBtn = document.createElement('button');
  recordBtn.className = 'subnote-record-btn';
  recordBtn.type = 'button';
  recordBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none"/>
      <circle cx="12" cy="12" r="4" fill="currentColor"/>
    </svg>
    <span>Record</span>
  `;

  // Create stop button (hidden initially)
  const stopBtn = document.createElement('button');
  stopBtn.className = 'subnote-control-btn subnote-stop-btn';
  stopBtn.type = 'button';
  stopBtn.style.display = 'none';
  stopBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="6" y="6" width="12" height="12" fill="currentColor" rx="2"/>
    </svg>
    <span>Stop</span>
  `;

  // Create continue button (hidden initially)
  const continueBtn = document.createElement('button');
  continueBtn.className = 'subnote-control-btn subnote-continue-btn';
  continueBtn.type = 'button';
  continueBtn.style.display = 'none';
  continueBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none"/>
      <circle cx="12" cy="12" r="4" fill="currentColor"/>
    </svg>
    <span>Continue</span>
  `;

  // Create done button (hidden initially)
  const doneBtn = document.createElement('button');
  doneBtn.className = 'subnote-control-btn subnote-done-btn';
  doneBtn.type = 'button';
  doneBtn.style.display = 'none';
  doneBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polyline points="20 6 9 17 4 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <span>Done</span>
  `;

  // Create close button
  const closeBtn = document.createElement('button');
  closeBtn.className = 'subnote-close-btn';
  closeBtn.type = 'button';
  closeBtn.innerHTML = '&times;';

  // Helper to format time
  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  // Start timer
  function startTimer() {
    timerInterval = setInterval(() => {
      recordingSeconds++;

      // Check if 10 minutes limit is reached
      if (recordingSeconds >= MAX_SUBNOTE_RECORDING_SECONDS) {
        console.log('10-minute subnote recording limit reached, stopping automatically');
        finishRecording();
        alert('Recording limit of 10 minutes reached. Subnote recording has been stopped automatically.');
        return;
      }

      const remaining = MAX_SUBNOTE_RECORDING_SECONDS - recordingSeconds;

      // Show time remaining in last minute
      if (recordingSeconds >= MAX_SUBNOTE_RECORDING_SECONDS - 60) {
        timerDisplay.textContent = `${formatTime(recordingSeconds)} (${remaining}s left)`;
        timerDisplay.style.color = '#ef4444'; // Red color
        timerDisplay.style.fontWeight = 'bold';
      } else {
        timerDisplay.textContent = formatTime(recordingSeconds);
        timerDisplay.style.color = ''; // Default color
        timerDisplay.style.fontWeight = '';
      }
    }, 1000);
  }

  // Stop timer
  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  // Start recording
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorder.start();
      isPaused = false;
      startTimer();

      // Update UI
      recordBtn.style.display = 'none';
      stopBtn.style.display = 'flex';
      doneBtn.style.display = 'flex';
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  }

  // Pause recording
  function pauseRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.pause();
      isPaused = true;
      stopTimer();

      // Update UI
      stopBtn.style.display = 'none';
      continueBtn.style.display = 'flex';
    }
  }

  // Continue recording
  function resumeRecording() {
    if (mediaRecorder && mediaRecorder.state === 'paused') {
      mediaRecorder.resume();
      isPaused = false;
      startTimer();

      // Update UI
      continueBtn.style.display = 'none';
      stopBtn.style.display = 'flex';
    }
  }

  // Finish recording
  async function finishRecording() {
    if (mediaRecorder) {
      mediaRecorder.stop();
      stopTimer();

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });

        // Close modal
        document.body.removeChild(overlay);

        // Upload subnote to backend
        try {
          const formData = new FormData();
          formData.append('file', audioBlob, 'subnote.webm');
          formData.append('parent_id', rec.id);

          const response = await fetch('/upload', {
            method: 'POST',
            body: formData
          });

          if (!response.ok) {
            throw new Error('Failed to upload subnote');
          }

          const result = await response.json();
          console.log('Subnote upload result:', result);

          // Get the parent card element using data-id attribute
          const parentCard = document.querySelector(`[data-id="${rec.id}"]`);
          console.log('Parent card found:', parentCard);

          if (parentCard && result.recording) {
            // Add subnote label and render the subnote card
            renderSubnote(result.recording, parentCard);

            // Start polling for transcription status
            const { pollStatusAndUpdate } = await import('../api/recordings-api.js');
            const subnoteCard = parentCard.querySelector(`.subnote-card[data-rec-id="${result.recording.id}"]`);
            console.log('Subnote card found for polling:', subnoteCard);
            if (subnoteCard && result.status_url) {
              pollStatusAndUpdate(result.status_url, subnoteCard, result.recording.id);
            }
          } else {
            console.error('Parent card not found or no recording in result');
          }

        } catch (error) {
          console.error('Error uploading subnote:', error);
          alert('Failed to upload subnote. Please try again.');
        }
      };

      // Stop all tracks
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
  }

  // Event listeners
  recordBtn.addEventListener('click', startRecording);
  stopBtn.addEventListener('click', pauseRecording);
  continueBtn.addEventListener('click', resumeRecording);
  doneBtn.addEventListener('click', finishRecording);

  closeBtn.addEventListener('click', () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      if (confirm('Recording in progress. Are you sure you want to cancel?')) {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
        stopTimer();
        document.body.removeChild(overlay);
      }
    } else {
      document.body.removeChild(overlay);
    }
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        if (confirm('Recording in progress. Are you sure you want to cancel?')) {
          mediaRecorder.stop();
          mediaRecorder.stream.getTracks().forEach(track => track.stop());
          stopTimer();
          document.body.removeChild(overlay);
        }
      } else {
        document.body.removeChild(overlay);
      }
    }
  });

  // Assemble modal
  const controlsContainer = document.createElement('div');
  controlsContainer.className = 'subnote-controls-container';
  controlsContainer.appendChild(stopBtn);
  controlsContainer.appendChild(continueBtn);
  controlsContainer.appendChild(doneBtn);

  modal.appendChild(closeBtn);
  modal.appendChild(timerDisplay);
  modal.appendChild(recordBtn);
  modal.appendChild(controlsContainer);
  overlay.appendChild(modal);

  document.body.appendChild(overlay);
}


// small helper: sanitize HTML string to plain text
function sanitizeHtmlToText(html) {
  if (!html && html !== '') return '';
  let s = String(html);
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<\/?[^>]+(>|$)/g, '');
  s = s.replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

// Helper function to format time in MM:SS format
function formatTime(seconds) {
  if (isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Cache management
export function updateCacheWithRecording(rec) {
  const cache = window.VN_STATE.recsCache;
  const idx = cache.findIndex(r => r.id === rec.id);
  if (idx >= 0) cache[idx] = rec;
  else cache.unshift(rec);
}

// --- CREATE RECORDING CARD ---
export function createRecordingCard(rec) {
  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.id = rec.id;
  card.setAttribute('data-id', rec.id);
  card.style.position = 'relative';

  // Top section with mic icon, title, timestamp, and player inline
  const topSection = document.createElement('div');
  topSection.className = 'card-top-section';

  // Mic icon container
  const micIcon = document.createElement('div');
  micIcon.className = 'card-mic-icon';
  micIcon.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="11.5" fill="#001648" stroke="#001648"/>
      <rect x="10" y="6" width="4" height="8" rx="2" stroke="white" stroke-width="1.5" fill="none"/>
      <path d="M8 12v1a4 4 0 0 0 8 0v-1" stroke="white" stroke-width="1.5" fill="none" stroke-linecap="round"/>
      <line x1="12" y1="17" x2="12" y2="19" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
  `;

  // Title and timestamp container
  const titleInfo = document.createElement('div');
  titleInfo.className = 'card-title-info';

  const titleText = document.createElement('h3');
  titleText.className = 'recording-title';

  // Show "New Recording" for processing/transcribing states
  let fullTitle = (rec.title || 'Untitled Recording').trim();
  if (rec.status === 'processing' || rec.status === 'transcribing') {
    fullTitle = 'New Recording';
  }
  titleText.textContent = fullTitle;

  titleInfo.appendChild(titleText);

  // Add status indicator for processing/transcribing
  if (rec.status === 'processing' || rec.status === 'transcribing') {
    const statusIndicator = document.createElement('div');
    statusIndicator.className = 'recording-status-indicator';

    const statusDot = document.createElement('span');
    statusDot.className = 'status-dot';

    const statusText = document.createElement('span');
    statusText.className = 'status-text';
    statusText.textContent = rec.status === 'processing' ? 'Uploading...' : 'Transcribing...';

    statusIndicator.appendChild(statusDot);
    statusIndicator.appendChild(statusText);
    titleInfo.appendChild(statusIndicator);
  }

  // Audio player section (inline)
  const playerSection = document.createElement('div');
  playerSection.className = 'card-player-section';

  const timer = document.createElement('span');
  timer.className = 'player-timer';
  timer.textContent = '0:00 / 1:00';

  const playPauseBtn = document.createElement('button');
  playPauseBtn.className = 'play-pause-btn';
  playPauseBtn.innerHTML = `
    <svg class="play-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 5v14l11-7z" fill="currentColor"/>
    </svg>
    <svg class="pause-icon" style="display: none;" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="6" y="4" width="4" height="16" fill="currentColor"/>
      <rect x="14" y="4" width="4" height="16" fill="currentColor"/>
    </svg>
  `;

  if (rec.audio_url) {
    const playerControls = document.createElement('div');
    playerControls.className = 'player-controls';

    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar-container';
    progressBar.innerHTML = `
      <div class="progress-bar">
        <div class="progress-fill"></div>
        <div class="progress-handle"></div>
      </div>
    `;

    playerControls.appendChild(playPauseBtn);
    playerControls.appendChild(timer);
    playerControls.appendChild(progressBar);
    playerSection.appendChild(playerControls);

    // Hidden audio element
    const audio = document.createElement('audio');
    audio.src = rec.audio_url;
    audio.id = `audio-${rec.id}`;
    audio.style.display = 'none';
    playerSection.appendChild(audio);

    // Audio player functionality
    playPauseBtn.addEventListener('click', () => {
      if (audio.paused) {
        audio.play();
        playPauseBtn.querySelector('.play-icon').style.display = 'none';
        playPauseBtn.querySelector('.pause-icon').style.display = 'block';
      } else {
        audio.pause();
        playPauseBtn.querySelector('.play-icon').style.display = 'block';
        playPauseBtn.querySelector('.pause-icon').style.display = 'none';
      }
    });

    audio.addEventListener('timeupdate', () => {
      const progress = (audio.currentTime / audio.duration) * 100;
      const progressFill = progressBar.querySelector('.progress-fill');
      const progressHandle = progressBar.querySelector('.progress-handle');
      if (progressFill) progressFill.style.width = `${progress}%`;
      if (progressHandle) progressHandle.style.left = `${progress}%`;

      const currentTime = formatTime(audio.currentTime);
      const duration = formatTime(audio.duration);
      timer.textContent = `${currentTime} / ${duration}`;
    });

    audio.addEventListener('ended', () => {
      playPauseBtn.querySelector('.play-icon').style.display = 'block';
      playPauseBtn.querySelector('.pause-icon').style.display = 'none';
    });

    audio.addEventListener('loadedmetadata', () => {
      timer.textContent = `0:00 / ${formatTime(audio.duration)}`;
    });

    // Click on progress bar to seek
    progressBar.addEventListener('click', (e) => {
      const rect = progressBar.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      audio.currentTime = percent * audio.duration;
    });
  }

  topSection.appendChild(micIcon);
  topSection.appendChild(titleInfo);
  topSection.appendChild(playerSection);
  card.appendChild(topSection);

  // CONTENT - Transcription section
  const content = document.createElement('div');
  content.className = 'card-content';

  // Add collapsible transcript
  const collapsibles = [
    { field: 'transcript', heading: 'Transcription:', html: rec._transcript_html, text: rec.transcript, lines: 4 },
    { field: 'summary', heading: 'Summary:', html: rec._summary_html, text: rec.summary, lines: 3 },
    { field: 'subnotes_summary', heading: 'Subnotes Summary:', html: rec._subnotes_summary_html, text: rec.subnotes_summary, lines: 3 },
    { field: 'meeting_notes', heading: 'Meeting Notes:', html: rec._meeting_notes_html, text: rec.meeting_notes, lines: 3 },
    { field: 'main_points', heading: 'Main Points:', html: rec._main_points_html, text: rec.main_points, lines: 3 },
    { field: 'todo_list', heading: 'To-Do List:', html: rec._todo_list_html, text: rec.todo_list, lines: 3 },
    {
      field: 'email_draft',
      heading: 'Email Draft:',
      html: null,
      text: sanitizeHtmlToText(rec.email_draft || rec._email_draft_html || ''),
      lines: 3
    },
    {
      field: 'clean_transcript',
      heading: 'Cleaned Transcript:',
      html: null,
      text: sanitizeHtmlToText(rec.clean_transcript || rec._clean_transcript_html || ''),
      lines: 3
    }
  ];

  collapsibles.forEach(block => {
    if (block.text && String(block.text).trim()) {
      const div = document.createElement('div');
      content.appendChild(div);
      renderCollapsibleField({
        parentEl: div,
        recId: rec.id,
        field: block.field,
        headingText: block.heading,
        text: block.html || block.text,
        previewLines: block.lines,
        isHtml: Boolean(block.html)
      });
    }
  });

  // Create attachments container (images and links) AFTER all content blocks
  const attachmentsContainer = document.createElement('div');
  attachmentsContainer.className = 'attachments-container';
  attachmentsContainer.dataset.recId = rec.id;
  content.appendChild(attachmentsContainer);

  // Helper function to render image with delete handler
  function renderImage(image) {
    const photoWrapper = document.createElement('div');
    photoWrapper.className = 'attached-photo-wrapper';
    photoWrapper.contentEditable = 'false';
    photoWrapper.dataset.imageUrl = image.url;

    const img = document.createElement('img');
    img.src = image.url;
    img.className = 'attached-photo';
    img.alt = 'Attached photo';

    // Add click handler to open full-screen viewer
    img.addEventListener('click', () => {
      openImageViewer(image.url, async () => {
        // Delete callback
        try {
          const response = await fetch(`/delete_image/${rec.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image_url: image.url })
          });

          if (!response.ok) {
            throw new Error('Failed to delete image');
          }

          // Remove from DOM
          const allImages = attachmentsContainer.querySelectorAll(`.attached-photo-wrapper[data-image-url="${image.url}"]`);
          allImages.forEach(wrapper => wrapper.remove());
        } catch (error) {
          console.error('Error deleting image:', error);
          alert('Failed to delete image. Please try again.');
        }
      });
    });

    photoWrapper.appendChild(img);
    return photoWrapper;
  }

  // Helper function to render link with delete handler
  function renderLink(link) {
    const linkWrapper = createLinkElement(link.url, link.text, rec.id);
    linkWrapper.dataset.linkUrl = link.url;

    const deleteBtn = linkWrapper.querySelector('.link-delete-btn-inline');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (confirm('Delete this link permanently?')) {
          try {
            const response = await fetch(`/delete_link/${rec.id}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ link_url: link.url })
            });

            if (!response.ok) {
              throw new Error('Failed to delete link');
            }

            // Remove from DOM
            const allLinks = attachmentsContainer.querySelectorAll(`.attached-link-wrapper[data-link-url="${link.url}"]`);
            allLinks.forEach(wrapper => wrapper.remove());
          } catch (error) {
            console.error('Error deleting link:', error);
            alert('Failed to delete link. Please try again.');
          }
        }
      });
    }

    return linkWrapper;
  }

  // Extract images and links from metadata
  const metadata = rec.metadata || {};
  const images = rec.images || metadata.images || [];
  const links = rec.links || metadata.links || [];

  // Load existing images
  if (images && images.length > 0) {
    images.forEach(image => {
      const photoWrapper = renderImage(image);
      attachmentsContainer.appendChild(photoWrapper);
    });
  }

  // Load existing links after images
  if (links && links.length > 0) {
    links.forEach(link => {
      const linkWrapper = renderLink(link);
      attachmentsContainer.appendChild(linkWrapper);
    });
  }

  // Action buttons row - moved inside content section
  const actionsRow = document.createElement('div');
  actionsRow.className = 'card-actions-row';

  // makeBtn function for creating buttons
  function makeBtn(cls, label, onClick, svg = '') {
    const btn = document.createElement('button');
    btn.className = cls;
    btn.type = 'button';
    btn.innerHTML = `${svg}<span class="btn-label">${label}</span>`;
    if (onClick) btn.addEventListener('click', onClick);
    return btn;
  }

  // SVG Icons
  const svgAskAI = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" stroke-width="1.4"/><path d="M2 17l10 5 10-5" stroke="currentColor" stroke-width="1.4"/><path d="M2 12l10 5 10-5" stroke="currentColor" stroke-width="1.4"/></svg>`;
  const svgCreate = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L14.3 8.2L21 10L14.3 11.8L12 18L9.7 11.8L3 10L9.7 8.2L12 2Z" stroke="currentColor" stroke-width="1.4"/></svg>`;
  const svgSummarize = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 6h16M4 12h10M4 18h7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const svgCleanup = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M17 1L21 5L9 17L5 21L1 17L5 13L17 1Z" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M13 5L19 11" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const svgMore = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="6" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="18" r="1.5" fill="currentColor"/></svg>`;

  const askAiBtn = makeBtn('card-action-btn', 'Ask AI', () => {
    openChatModal(rec.id, rec.title || 'Untitled Recording');
  }, svgAskAI);

  const createBtn = makeBtn('card-action-btn', 'Create', (e) => {
    e.stopPropagation();
    toggleCreateMenuForCard(card, rec);
  }, svgCreate);

  const summarizeBtn = makeBtn('card-action-btn', 'Summarize', () => handleSummarize(rec.id, card), svgSummarize);

  const cleanupBtn = makeBtn('card-action-btn', 'CleanUp', () => handleCleanup(rec.id, card), svgCleanup);

  // const shareBtn = makeBtn('card-action-btn', 'Share', () => {
  //   alert('Share feature - Coming soon!');
  // }, svgShare);

  const moreBtn = makeBtn('card-action-btn btn-more', '', (e) => {
    e.stopPropagation();
    toggleMoreMenuForCard(card, rec);
  }, svgMore);

  // Wrap createBtn in a container for proper positioning
  const createBtnWrapper = document.createElement('div');
  createBtnWrapper.style.position = 'relative';
  createBtnWrapper.appendChild(createBtn);

  // Wrap moreBtn in a container for proper positioning
  const moreBtnWrapper = document.createElement('div');
  moreBtnWrapper.style.position = 'relative';
  moreBtnWrapper.appendChild(moreBtn);

  actionsRow.appendChild(askAiBtn);
  actionsRow.appendChild(summarizeBtn);
  actionsRow.appendChild(cleanupBtn);
  // actionsRow.appendChild(shareBtn);
  actionsRow.appendChild(createBtnWrapper);
  actionsRow.appendChild(moreBtnWrapper);

  // Append actions row inside content section
  content.appendChild(actionsRow);

  // Append content to card
  card.appendChild(content);

  // CREATE and MORE menus (keeping existing functionality)
  const createMenu = document.createElement('div');
  createMenu.className = 'create-menu';
  createMenu.setAttribute('aria-hidden', 'true');

  // Check if this is a subnote (has parent_id) - same check as for More menu
  const isSubnoteForCreate = rec.parent_id ? true : false;

  createMenu.innerHTML = `
    <div class="create-menu-arrow" aria-hidden="true"></div>
    <button class="create-option summarize-option" type="button" title="Summarize">
      <span class="create-icon">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 6h16M4 12h10M4 18h7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </span>
      <span class="create-label">Summarize</span>
    </button>
    <button class="create-option meeting-notes-option" type="button" title="Meeting Notes">
      <span class="create-icon">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="14" height="18" rx="2" stroke="currentColor" stroke-width="1.2" fill="none"/><path d="M7 7h6M7 11h6M7 15h4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </span>
      <span class="create-label">Meeting Notes</span>
    </button>
    <button class="create-option main-points-option" type="button" title="Main Points">
      <span class="create-icon">•</span>
      <span class="create-label">Main Points</span>
    </button>
    <button class="create-option todo-list-option" type="button" title="To-Do List">
      <span class="create-icon">✓</span>
      <span class="create-label">To-Do List</span>
    </button>
    <button class="create-option email-draft-option" type="button" title="Email Draft">
      <span class="create-icon">@</span>
      <span class="create-label">Email Draft</span>
    </button>
    <button class="create-option cleanup-option" type="button" title="CleanUp">
      <span class="create-icon">♻</span>
      <span class="create-label">CleanUp</span>
    </button>
    ${!isSubnoteForCreate ? `
    <button class="create-option summarize-subnotes-option" type="button" title="Summarize subnotes">
      <span class="create-icon">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 6h16M4 12h10M4 18h7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="18" cy="18" r="3" fill="currentColor"/>
        </svg>
      </span>
      <span class="create-label">Summarize subnotes</span>
    </button>
    ` : ''}
  `;
  createBtnWrapper.appendChild(createMenu);

  // Attach option handlers
  const summOpt = createMenu.querySelector('.summarize-option');
  const meetOpt = createMenu.querySelector('.meeting-notes-option');
  const mainOpt = createMenu.querySelector('.main-points-option');
  const todoOpt = createMenu.querySelector('.todo-list-option');
  const emailOpt = createMenu.querySelector('.email-draft-option');
  const cleanupOpt = createMenu.querySelector('.cleanup-option');
  const summarizeSubnotesOpt = createMenu.querySelector('.summarize-subnotes-option');

  if (summOpt) summOpt.addEventListener('click', (ev) => { ev.stopPropagation(); toggleCreateMenuForCard(card, rec); handleSummarize(rec.id, card); });
  if (meetOpt) meetOpt.addEventListener('click', (ev) => { ev.stopPropagation(); toggleCreateMenuForCard(card, rec); handleMeetingNotes(rec.id, card); });
  if (mainOpt) mainOpt.addEventListener('click', (ev) => { ev.stopPropagation(); toggleCreateMenuForCard(card, rec); handleMainPoints(rec.id, card); });
  if (todoOpt) todoOpt.addEventListener('click', (ev) => { ev.stopPropagation(); toggleCreateMenuForCard(card, rec); handleTodoList(rec.id, card); });
  if (emailOpt) emailOpt.addEventListener('click', (ev) => { ev.stopPropagation(); toggleCreateMenuForCard(card, rec); handleEmailDraft(rec.id, card); });
  if (cleanupOpt) cleanupOpt.addEventListener('click', (ev) => { ev.stopPropagation(); toggleCreateMenuForCard(card, rec); handleCleanup(rec.id, card); });
  if (summarizeSubnotesOpt) summarizeSubnotesOpt.addEventListener('click', (ev) => {
    ev.stopPropagation();
    toggleCreateMenuForCard(card, rec);
    handleSummarizeSubnotes(rec.id, card);
  });

  // MORE menu
  const moreMenu = document.createElement('div');
  moreMenu.className = 'more-menu';
  moreMenu.setAttribute('aria-hidden', 'true');

  // Check if this is a subnote (has parent_id)
  const isSubnote = rec.parent_id ? true : false;

  // Build menu HTML - conditionally include "Record subnote" button only for parent recordings
  moreMenu.innerHTML = `
    <div class="more-menu-arrow" aria-hidden="true"></div>
    <button class="more-option edit-option" type="button" title="Edit">
      <span class="more-icon">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 17.25V21h3.75L17.81 9.94a1 1 0 0 0 0-1.41L15.47 6.2a1 1 0 0 0-1.41 0L3 17.25z" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>
      <span class="more-label">Edit</span>
    </button>
    <button class="more-option attach-option" type="button" title="Attach">
      <span class="more-icon">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>
      <span class="more-label">Attach</span>
    </button>
    ${!isSubnote ? `
    <button class="more-option record-subnote-option" type="button" title="Record subnote">
      <span class="more-icon">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.4" fill="currentColor"/>
          <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
        </svg>
      </span>
      <span class="more-label">Record subnote</span>
    </button>
    ` : ''}
    <!--
    <button class="more-option download-option" type="button" title="Download">
      <span class="more-icon">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
          <polyline points="7 10 12 15 17 10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
          <line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>
      <span class="more-label">Download</span>
    </button>
    -->
    <button class="more-option delete-option" type="button" title="Delete">
      <span class="more-icon">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 6h18M8 6v12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M10 11v5M14 11v5M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>
      <span class="more-label">Delete</span>
    </button>
  `;
  moreBtnWrapper.appendChild(moreMenu);

  const editOpt = moreMenu.querySelector('.edit-option');
  const attachOpt = moreMenu.querySelector('.attach-option');
  const recordSubnoteOpt = moreMenu.querySelector('.record-subnote-option');
  const deleteOpt = moreMenu.querySelector('.delete-option');

  if (editOpt) editOpt.addEventListener('click', (ev) => {
    ev.stopPropagation();
    toggleMoreMenuForCard(card, rec);

    // Trigger the inline edit button in the transcript block
    const transcriptBlock = card.querySelector('.collapsible-block[data-field="transcript"]');
    if (transcriptBlock) {
      const editBtn = transcriptBlock.querySelector('.btn-field-action.btn-edit');
      if (editBtn) {
        // Click the edit button in the transcript block to trigger inline editing
        editBtn.click();
      } else {
        // Fallback to modal edit if inline edit button not found
        openEditTranscript(rec.id, card);
      }
    } else {
      // Fallback to modal edit if transcript block not found
      openEditTranscript(rec.id, card);
    }
  });

  if (recordSubnoteOpt) recordSubnoteOpt.addEventListener('click', (ev) => {
    ev.stopPropagation();
    toggleMoreMenuForCard(card, rec);
    openSubnoteRecorder(rec);
  });

  // Create attach submenu
  const attachSubmenu = document.createElement('div');
  attachSubmenu.className = 'attach-submenu';
  attachSubmenu.setAttribute('aria-hidden', 'true');
  attachSubmenu.innerHTML = `
    <button class="attach-submenu-option add-photo-option" type="button" title="Add Photo">
      <span class="attach-submenu-icon">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="1.4"/>
          <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
          <path d="M21 15l-5-5L5 21" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>
      <span class="attach-submenu-label">Add Photo</span>
    </button>
    <button class="attach-submenu-option attach-link-option" type="button" title="Attach Link">
      <span class="attach-submenu-icon">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>
      <span class="attach-submenu-label">Attach Link</span>
    </button>
  `;

  // Append submenu to the more menu
  moreMenu.appendChild(attachSubmenu);

  if (attachOpt) {
    attachOpt.addEventListener('click', (ev) => {
      ev.stopPropagation();

      // Toggle submenu visibility
      const isSubmenuOpen = attachSubmenu.getAttribute('data-open') === 'true';
      if (isSubmenuOpen) {
        attachSubmenu.setAttribute('data-open', 'false');
        attachSubmenu.style.display = 'none';
        attachSubmenu.classList.remove('attach-submenu-open');
      } else {
        attachSubmenu.setAttribute('data-open', 'true');
        attachSubmenu.style.display = 'block';
        attachSubmenu.classList.add('attach-submenu-open');
      }
    });
  }

  // Add Photo option handler
  const addPhotoOpt = attachSubmenu.querySelector('.add-photo-option');
  if (addPhotoOpt) {
    addPhotoOpt.addEventListener('click', (ev) => {
      ev.stopPropagation();
      attachSubmenu.setAttribute('data-open', 'false');
      attachSubmenu.style.display = 'none';
      attachSubmenu.classList.remove('attach-submenu-open');
      toggleMoreMenuForCard(card, rec);

      // Create file input for image selection
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/*';
      fileInput.style.display = 'none';

      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
          // Find the attachments container
          const cardContent = card.querySelector('.card-content');
          const attachmentsContainer = cardContent?.querySelector('.attachments-container');

          if (!attachmentsContainer) {
            console.error('Attachments container not found');
            alert('Failed to upload image. Please try again.');
            document.body.removeChild(fileInput);
            return;
          }

          // Show loading state
          const loadingWrapper = document.createElement('div');
          loadingWrapper.className = 'attached-photo-wrapper loading';
          loadingWrapper.innerHTML = `
            <div class="attachment-loading">
              <div class="loading-spinner"></div>
              <span class="loading-text">Uploading image...</span>
            </div>
          `;
          attachmentsContainer.appendChild(loadingWrapper);

          // Upload image to server
          const formData = new FormData();
          formData.append('image', file);

          try {
            const response = await fetch(`/upload_image/${rec.id}`, {
              method: 'POST',
              body: formData
            });

            if (!response.ok) {
              throw new Error('Failed to upload image');
            }

            const result = await response.json();

            // Remove loading state
            loadingWrapper.remove();

            // Add the actual image
            const photoWrapper = renderImage({ url: result.url });
            attachmentsContainer.appendChild(photoWrapper);

          } catch (error) {
            console.error('Error uploading image:', error);
            loadingWrapper.remove();
            alert('Failed to upload image. Please try again.');
          }
        }

        // Clean up
        document.body.removeChild(fileInput);
      });

      // Trigger file picker
      document.body.appendChild(fileInput);
      fileInput.click();
    });
  }

  // Attach Link option handler
  const attachLinkOpt = attachSubmenu.querySelector('.attach-link-option');
  if (attachLinkOpt) {
    attachLinkOpt.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      attachSubmenu.setAttribute('data-open', 'false');
      attachSubmenu.style.display = 'none';
      attachSubmenu.classList.remove('attach-submenu-open');
      toggleMoreMenuForCard(card, rec);

      // Show link input modal
      showLinkInputModal(async (linkUrl, linkText) => {
        // Find the attachments container
        const cardContent = card.querySelector('.card-content');
        const attachmentsContainer = cardContent?.querySelector('.attachments-container');

        if (!attachmentsContainer) {
          console.error('Attachments container not found');
          alert('Failed to add link. Please try again.');
          return;
        }

        // Show loading state
        const loadingWrapper = document.createElement('div');
        loadingWrapper.className = 'attached-link-wrapper loading';
        loadingWrapper.innerHTML = `
          <div class="attachment-loading">
            <div class="loading-spinner"></div>
            <span class="loading-text">Adding link...</span>
          </div>
        `;
        attachmentsContainer.appendChild(loadingWrapper);

        try {
          // Upload link to server
          const response = await fetch(`/add_link/${rec.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              link_url: linkUrl.trim(),
              link_text: linkText?.trim() || linkUrl.trim()
            })
          });

          if (!response.ok) {
            throw new Error('Failed to add link');
          }

          const result = await response.json();
          const link = result.link;

          // Remove loading state
          loadingWrapper.remove();

          // Add the actual link
          const linkWrapper = renderLink(link);
          attachmentsContainer.appendChild(linkWrapper);

        } catch (error) {
          console.error('Error adding link:', error);
          loadingWrapper.remove();
          alert('Failed to add link. Please try again.');
        }
      });
    });
  }

  // COMMENTED OUT - Download functionality to be fixed later
  /*
  if (downloadOpt) {
    downloadOpt.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      toggleMoreMenuForCard(card, rec);

      // Download the audio file
      if (rec.audio_url) {
        try {
          // Extract filename from audio_url (e.g., /audio/filename.wav -> filename.m4a)
          const filename = rec.audio_url.split('/').pop().split('?')[0];

          // Use the download endpoint
          const downloadUrl = `/download/${filename}`;

          // Fetch the file to ensure it exists and get it as a blob
          const response = await fetch(downloadUrl);

          if (!response.ok) {
            throw new Error(`Download failed: ${response.status} ${response.statusText}`);
          }

          // Get the blob from response
          const blob = await response.blob();

          // Create blob URL and download link
          const blobUrl = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;

          // Determine file extension from filename
          const extension = filename.substring(filename.lastIndexOf('.'));
          link.download = (rec.title || 'recording').replace(/[/\\?%*:|"<>]/g, '-') + extension;

          link.style.display = 'none';
          document.body.appendChild(link);
          link.click();

          // Clean up
          setTimeout(() => {
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
          }, 100);

        } catch (error) {
          console.error('Download error:', error);
          alert('Failed to download audio file: ' + error.message);
        }
      } else {
        alert('No audio file available for download');
      }
    });
  }
  */

  if (deleteOpt) {
    deleteOpt.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      toggleMoreMenuForCard(card, rec);

      // Create custom confirmation dialog
      const noteTitle = rec.title || 'Untitled Recording';

      // Create modal overlay
      const modalOverlay = document.createElement('div');
      modalOverlay.className = 'delete-confirm-overlay';

      const modal = document.createElement('div');
      modal.className = 'delete-confirm-modal';
      modal.innerHTML = `
        <div class="delete-confirm-header">Delete Recording</div>
        <div class="delete-confirm-message">
          Are you sure you want to delete this recording?
          <div class="delete-confirm-title">"${noteTitle}"</div>
          <div class="delete-confirm-warning">This action cannot be undone.</div>
        </div>
        <div class="delete-confirm-buttons">
          <button class="delete-confirm-cancel">Cancel</button>
          <button class="delete-confirm-ok">Delete</button>
        </div>
      `;

      modalOverlay.appendChild(modal);
      document.body.appendChild(modalOverlay);

      // Handle button clicks
      const cancelBtn = modal.querySelector('.delete-confirm-cancel');
      const okBtn = modal.querySelector('.delete-confirm-ok');

      const closeModal = () => {
        document.body.removeChild(modalOverlay);
      };

      cancelBtn.addEventListener('click', closeModal);
      modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
      });

      // Wait for user confirmation
      const confirmed = await new Promise((resolve) => {
        okBtn.addEventListener('click', () => {
          closeModal();
          resolve(true);
        });
        cancelBtn.addEventListener('click', () => resolve(false));
        modalOverlay.addEventListener('click', (e) => {
          if (e.target === modalOverlay) resolve(false);
        });
      });

      if (!confirmed) return;

      try {
        // Create and show deleting overlay
        const deletingOverlay = document.createElement('div');
        deletingOverlay.className = 'deleting-overlay';
        deletingOverlay.innerHTML = `
          <div class="deleting-spinner"></div>
          <div class="deleting-text">Deleting...</div>
        `;
        card.style.position = 'relative';
        card.appendChild(deletingOverlay);

        // Disable card interaction during delete
        card.style.pointerEvents = 'none';
        card.style.opacity = '0.6';

        await deleteRecording(rec.id);
        window.VN_STATE.recsCache = (window.VN_STATE.recsCache || []).filter(r => r.id !== rec.id);

        // Check if this is a subnote before removing
        const isSubnote = card && card.classList.contains('subnote-card');
        let subnotesContainer = null;
        if (isSubnote && card.parentNode) {
          // Store reference to the subnotes container
          subnotesContainer = card.parentNode;
        }

        if (card && card.parentNode) card.parentNode.removeChild(card);

        // If this was a subnote, check if the subnotes container is now empty
        if (subnotesContainer) {
          // Count remaining subnote cards (excluding the label)
          const remainingSubnotes = subnotesContainer.querySelectorAll('.subnote-card');
          if (remainingSubnotes.length === 0) {
            // No more subnotes, remove the entire subnotes container
            if (subnotesContainer.parentNode) {
              subnotesContainer.parentNode.removeChild(subnotesContainer);
            }
          }
        }

        const recordingsEl = window.VN_STATE.els.recordingsEl;
        const emptyState = window.VN_STATE.els.emptyState;
        if (recordingsEl && !recordingsEl.querySelector('.card') && emptyState) recordingsEl.appendChild(emptyState);
        if (window.VN_STATE.currentSearch) applySearchFilter();
      } catch (e) {
        // Remove overlay and restore card on error
        const overlay = card.querySelector('.deleting-overlay');
        if (overlay) overlay.remove();
        card.style.pointerEvents = '';
        card.style.opacity = '';

        alert((e && e.message) || 'Delete failed. Please try again.');
      }
    });
  }

  // Start polling if needed
  if (rec.status_url) {
    setTimeout(() => {
      const cardEl = document.querySelector(`[data-id="${rec.id}"]`);
      if (cardEl) pollStatusAndUpdate(rec.status_url, cardEl, rec.id);
    }, 100);
  }

  // Related Notes Section - Load asynchronously after card is ready
  // Show related notes for all transcribed/summarized notes (persists across refreshes)
  if (rec.status === 'transcribed' || rec.status === 'summarized') {
    // Create placeholder for related notes
    const relatedNotesContainer = document.createElement('div');
    relatedNotesContainer.className = 'related-notes-container';
    relatedNotesContainer.style.display = 'none'; // Hidden initially
    card.appendChild(relatedNotesContainer);

    // Fetch related notes after a short delay to not block card rendering
    setTimeout(async () => {
      try {
        const relatedNotes = await fetchRelatedNotes(rec.id, 5);

        if (relatedNotes && relatedNotes.length > 0) {
          // Build the related notes UI
          const header = document.createElement('div');
          header.className = 'related-notes-header';
          header.textContent = 'Related Notes';

          const notesList = document.createElement('div');
          notesList.className = 'related-notes-list';

          relatedNotes.forEach(note => {
            const noteItem = document.createElement('div');
            noteItem.className = 'related-note-item';
            noteItem.dataset.noteId = note.id;

            const noteTitle = document.createElement('div');
            noteTitle.className = 'related-note-title';
            noteTitle.textContent = note.title || 'Untitled Recording';

            const noteDate = document.createElement('div');
            noteDate.className = 'related-note-date';
            noteDate.textContent = formatShortDate(note.created_at);

            noteItem.appendChild(noteTitle);
            noteItem.appendChild(noteDate);

            // Click handler to open the related note
            noteItem.addEventListener('click', () => {
              // Find the note card by ID
              const targetCard = document.querySelector(`[data-id="${note.id}"]`);
              if (targetCard) {
                // Scroll to the card
                targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Add highlight animation
                targetCard.classList.add('highlight-flash');
                setTimeout(() => targetCard.classList.remove('highlight-flash'), 2000);

                // Mark this note as clicked in the related notes list
                noteItem.classList.add('clicked');
              }
            });

            notesList.appendChild(noteItem);
          });

          relatedNotesContainer.appendChild(header);
          relatedNotesContainer.appendChild(notesList);

          // Smooth slide-in animation
          relatedNotesContainer.style.display = 'block';
          relatedNotesContainer.style.opacity = '0';
          relatedNotesContainer.style.transform = 'translateY(20px)';

          // Trigger animation
          setTimeout(() => {
            relatedNotesContainer.style.transition = 'all 0.4s ease-out';
            relatedNotesContainer.style.opacity = '1';
            relatedNotesContainer.style.transform = 'translateY(0)';
          }, 50);
        }
      } catch (error) {
        console.error('Error loading related notes:', error);
      }
    }, 500); // Small delay to prioritize main content
  }

  return card;
}

// --- REPLACE CARD ---
export function replaceCard(rec, oldCard) {
  updateCacheWithRecording(rec);
  const newCard = createRecordingCard(rec);

  // If this is a subnote card, preserve the subnote styling
  if (oldCard && oldCard.classList.contains('subnote-card')) {
    newCard.classList.add('subnote-card');
    newCard.setAttribute('data-rec-id', rec.id);
  }

  // IMPORTANT: Preserve subnotes before replacing the card
  // Find all subnote cards in the old card's subnotes container
  let subnoteCards = [];
  if (oldCard && !oldCard.classList.contains('subnote-card')) {
    // This is a parent card, preserve its subnotes
    const subnotesContainer = oldCard.querySelector('.subnotes-container');
    if (subnotesContainer) {
      // Get all subnote cards (but not the label)
      const subnoteElements = subnotesContainer.querySelectorAll('.subnote-card');
      subnoteCards = Array.from(subnoteElements);
    }
  }

  if (oldCard && oldCard.parentNode) oldCard.parentNode.replaceChild(newCard, oldCard);

  // Re-render subnotes if any were found
  if (subnoteCards.length > 0) {
    // Get or create the subnotes container in the new card
    const cardContent = newCard.querySelector('.card-content');
    if (cardContent) {
      let newSubnotesContainer = cardContent.querySelector('.subnotes-container');

      if (!newSubnotesContainer) {
        // Create subnotes container
        newSubnotesContainer = document.createElement('div');
        newSubnotesContainer.className = 'subnotes-container';

        // Create label
        const subnoteLabel = document.createElement('div');
        subnoteLabel.className = 'subnote-label';
        subnoteLabel.textContent = 'Subnote';
        newSubnotesContainer.appendChild(subnoteLabel);

        // Append to card content
        cardContent.appendChild(newSubnotesContainer);
      }

      // Re-attach all subnote cards
      subnoteCards.forEach(subnoteCard => {
        newSubnotesContainer.appendChild(subnoteCard);
      });
    }
  }

  const search = window.VN_STATE.currentSearch;
  if (search) applySearchFilter();
}
