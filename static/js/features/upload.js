// features/upload.js
/*
  Handles:
  - Uploading a selected or recorded audio file
  - Updating UI when new recording is added
  - Starts polling for status after upload
*/

import { createRecordingCard } from '../ui/recording-card.js';
import { pollStatusAndUpdate } from '../api/recordings-api.js';
import { getUserId } from '../auth/auth.js';
import { applySearchFilter } from './search.js';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB in bytes

export async function handleUpload() {
  const { uploadBtn, audioInput, audioPreview, emptyState } = window.VN_STATE.els;
  if (!uploadBtn) return;
  uploadBtn.disabled = true;

  try {
    const fd = new FormData();
    const { recordedBlob } = window.VN_STATE;

    if (recordedBlob) {
      console.log('Uploading recorded blob:', recordedBlob.size, 'bytes, type:', recordedBlob.type);
      if (recordedBlob.size === 0) {
        alert('Recording is empty. Please record some audio first.');
        uploadBtn.disabled = false;
        return;
      }
      // Check file size limit (10 MB)
      if (recordedBlob.size > MAX_FILE_SIZE) {
        alert(`Recording is too large (${(recordedBlob.size / 1024 / 1024).toFixed(2)} MB). Maximum file size is 10 MB.`);
        uploadBtn.disabled = false;
        return;
      }
      fd.append('file', recordedBlob, 'recorded.webm');
    } else if (audioInput && audioInput.files && audioInput.files[0]) {
      const selectedFile = audioInput.files[0];
      console.log('Uploading selected file:', selectedFile.name, selectedFile.size, 'bytes, type:', selectedFile.type);
      if (selectedFile.size === 0) {
        alert('Selected file is empty. Please choose a valid audio file.');
        uploadBtn.disabled = false;
        return;
      }
      // Check file size limit (10 MB)
      if (selectedFile.size > MAX_FILE_SIZE) {
        alert(`File is too large (${(selectedFile.size / 1024 / 1024).toFixed(2)} MB). Maximum file size is 10 MB.`);
        uploadBtn.disabled = false;
        return;
      }
      fd.append('file', selectedFile);
    } else {
      alert('No file selected to upload');
      uploadBtn.disabled = false;
      return;
    }

    const user_id = getUserId();
    if (user_id) fd.append('user_id', user_id);

    const res = await fetch('/upload', { method: 'POST', body: fd, cache: 'no-store' });
    const json = await res.json();

    if (res.ok && json.recording) {
      // Update cache
      window.VN_STATE.recsCache.unshift(json.recording);

      // Remove empty state placeholder if visible
      if (emptyState && emptyState.parentNode) emptyState.parentNode.removeChild(emptyState);

      // Add to DOM
      const recordingsEl = window.VN_STATE.els.recordingsEl;
      if (recordingsEl) {
        const card = createRecordingCard(json.recording);
        recordingsEl.insertBefore(card, recordingsEl.firstChild);

        // Auto-scroll to the new note at the top with smooth animation
        setTimeout(() => {
          card.scrollIntoView({ behavior: 'smooth', block: 'start' });
          // Add a brief highlight to show the new note
          card.classList.add('highlight-flash');
          setTimeout(() => card.classList.remove('highlight-flash'), 2000);
        }, 100);
      }

      // Start polling status if available
      if (json.status_url) {
        pollStatusAndUpdate(json.status_url, document.querySelector(`[data-id="${json.recording.id}"]`), json.recording.id);
      } else {
        pollStatusAndUpdate(`/status/${json.recording.id}`, document.querySelector(`[data-id="${json.recording.id}"]`), json.recording.id);
      }

      // Reset input + preview
      if (audioInput) audioInput.value = '';
      window.VN_STATE.recordedBlob = null;
      if (audioPreview) {
        audioPreview.src = '';
        audioPreview.style.display = 'none';
      }

      // Re-apply search if needed
      const { currentSearch } = window.VN_STATE;
      if (currentSearch) applySearchFilter();

    } else {
      const errorMsg = json.error || 'Upload failed';
      console.error('Upload failed:', errorMsg);
      alert(`Upload failed: ${errorMsg}`);
    }
  } catch (err) {
    console.error('Upload error', err);
    alert(`Upload error: ${err.message || 'Unknown error'}`);
  } finally {
    uploadBtn.disabled = false;
  }
}
