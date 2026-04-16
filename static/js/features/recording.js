// features/recording.js
/*
  Handles:
  - startRecording() : capture mic audio via MediaRecorder
  - pauseRecording() : pause the current recording
  - resumeRecording() : continue/resume a paused recording
  - stopRecording()  : stop capture and prepare playback blob
*/

// Timer functionality
const MAX_RECORDING_SECONDS = 600; // 10 minutes

function startTimer() {
  const timerEl = document.getElementById('recordingTimer');
  if (!timerEl) return;

  window.VN_STATE.recordingStartTime = Date.now();
  window.VN_STATE.recordingElapsedTime = 0;

  timerEl.style.display = 'flex';

  window.VN_STATE.timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - window.VN_STATE.recordingStartTime + window.VN_STATE.recordingElapsedTime) / 1000);

    // Check if 10 minutes limit is reached
    if (elapsed >= MAX_RECORDING_SECONDS) {
      console.log('10-minute recording limit reached, stopping automatically');
      stopRecording();
      alert('Recording limit of 10 minutes reached. Recording has been stopped automatically.');
      return;
    }

    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    const remaining = MAX_RECORDING_SECONDS - elapsed;
    const remainingMinutes = Math.floor(remaining / 60);
    const remainingSeconds = remaining % 60;

    // Show time remaining in last minute
    if (elapsed >= MAX_RECORDING_SECONDS - 60) {
      timerEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')} (${remainingSeconds}s left)`;
      timerEl.style.color = '#ef4444'; // Red color
      timerEl.style.fontWeight = 'bold';
    } else {
      timerEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      timerEl.style.color = ''; // Default color
      timerEl.style.fontWeight = '';
    }
  }, 1000);
}

function pauseTimer() {
  if (window.VN_STATE.timerInterval) {
    clearInterval(window.VN_STATE.timerInterval);
    window.VN_STATE.recordingElapsedTime += Date.now() - window.VN_STATE.recordingStartTime;
  }
}

function resumeTimer() {
  window.VN_STATE.recordingStartTime = Date.now();

  window.VN_STATE.timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - window.VN_STATE.recordingStartTime + window.VN_STATE.recordingElapsedTime) / 1000);

    // Check if 10 minutes limit is reached
    if (elapsed >= MAX_RECORDING_SECONDS) {
      console.log('10-minute recording limit reached, stopping automatically');
      stopRecording();
      alert('Recording limit of 10 minutes reached. Recording has been stopped automatically.');
      return;
    }

    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    const remaining = MAX_RECORDING_SECONDS - elapsed;
    const remainingSeconds = remaining % 60;

    const timerEl = document.getElementById('recordingTimer');
    if (timerEl) {
      // Show time remaining in last minute
      if (elapsed >= MAX_RECORDING_SECONDS - 60) {
        timerEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')} (${remainingSeconds}s left)`;
        timerEl.style.color = '#ef4444'; // Red color
        timerEl.style.fontWeight = 'bold';
      } else {
        timerEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        timerEl.style.color = ''; // Default color
        timerEl.style.fontWeight = '';
      }
    }
  }, 1000);
}

function stopTimer() {
  if (window.VN_STATE.timerInterval) {
    clearInterval(window.VN_STATE.timerInterval);
    window.VN_STATE.timerInterval = null;
  }

  const timerEl = document.getElementById('recordingTimer');
  if (timerEl) {
    timerEl.style.display = 'none';
    timerEl.textContent = '0:00';
  }

  window.VN_STATE.recordingStartTime = 0;
  window.VN_STATE.recordingElapsedTime = 0;
}

export async function startRecording() {
  const { recordBtn, stopBtn, audioPreview } = window.VN_STATE.els;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert('Media devices not supported in this browser');
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    window.VN_STATE.recordedChunks = [];
    window.VN_STATE.audioStream = stream; // Store stream for pause/resume

    let options = {};
    try {
      options = { mimeType: 'audio/webm' };
      window.VN_STATE.mediaRecorder = new MediaRecorder(stream, options);
    } catch (e) {
      window.VN_STATE.mediaRecorder = new MediaRecorder(stream);
    }

    const recorder = window.VN_STATE.mediaRecorder;
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) window.VN_STATE.recordedChunks.push(e.data);
    };

    recorder.onstop = () => {
      const chunks = window.VN_STATE.recordedChunks;
      if (!chunks.length) return;

      const blob = new Blob(chunks, { type: chunks[0]?.type || 'audio/webm' });
      window.VN_STATE.recordedBlob = blob;

      if (audioPreview) {
        audioPreview.src = URL.createObjectURL(blob);
        audioPreview.style.display = 'block';
        audioPreview.load();
      }

      try {
        if (window.VN_STATE.audioStream) {
          window.VN_STATE.audioStream.getTracks().forEach((t) => t.stop());
          window.VN_STATE.audioStream = null;
        }
      } catch (e) {
        console.warn('stream stop failed', e);
      }
    };

    recorder.start();
    startTimer();
    updateRecordingUI('recording');

  } catch (err) {
    console.error('startRecording error', err);
    alert('Could not start recording: ' + (err.message || err));
  }
}

export function pauseRecording() {
  const { mediaRecorder } = window.VN_STATE;

  if (mediaRecorder && mediaRecorder.state === 'recording') {
    try {
      mediaRecorder.pause();
      pauseTimer();
      updateRecordingUI('paused');
    } catch (e) {
      console.warn('mediaRecorder.pause failed', e);
    }
  }
}

export function resumeRecording() {
  const { mediaRecorder } = window.VN_STATE;

  if (mediaRecorder && mediaRecorder.state === 'paused') {
    try {
      mediaRecorder.resume();
      resumeTimer();
      updateRecordingUI('recording');
    } catch (e) {
      console.warn('mediaRecorder.resume failed', e);
    }
  }
}

export function stopRecording() {
  const { mediaRecorder } = window.VN_STATE;

  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    try {
      mediaRecorder.stop();
    } catch (e) {
      console.warn('mediaRecorder.stop failed', e);
    }
  }

  stopTimer();
  updateRecordingUI('stopped');
}

// Helper function to update UI based on recording state
function updateRecordingUI(state) {
  const { recordBtn, stopBtn } = window.VN_STATE.els;

  if (state === 'recording') {
    // Recording: show Pause + Done (green)
    if (recordBtn) {
      recordBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="4" width="4" height="16"></rect>
          <rect x="14" y="4" width="4" height="16"></rect>
        </svg>
        Pause
      `;
      recordBtn.disabled = false;
    }
    if (stopBtn) {
      stopBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        Done
      `;
      stopBtn.disabled = false;
      stopBtn.dataset.state = 'done';
      stopBtn.classList.add('done-btn');
    }
  } else if (state === 'paused') {
    // Paused: show Continue + Done (green)
    if (recordBtn) {
      recordBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="5 3 19 12 5 21 5 3"></polygon>
        </svg>
        Continue
      `;
      recordBtn.disabled = false;
    }
    if (stopBtn) {
      stopBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        Done
      `;
      stopBtn.disabled = false;
      stopBtn.dataset.state = 'done';
      stopBtn.classList.add('done-btn');
    }
  } else if (state === 'stopped') {
    // Stopped: Hide the button or reset to default gray
    if (recordBtn) {
      recordBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="12" r="5"></circle>
        </svg>
        Record
      `;
      recordBtn.disabled = false;
    }
    if (stopBtn) {
      stopBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <rect x="7" y="7" width="10" height="10"></rect>
        </svg>
        Stop
      `;
      stopBtn.disabled = true;
      stopBtn.dataset.state = 'stop';
      stopBtn.classList.remove('done-btn');
    }
  }
}
