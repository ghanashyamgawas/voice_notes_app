// api/recordings-api.js
import { getUserId } from '../auth/auth.js';
import { updateCacheWithRecording, replaceCard, createRecordingCard } from '../ui/recording-card.js';
import { escapeHtml, nl2br, formatMultiline } from '../utils/text-helpers.js';
import { applySearchFilter } from '../features/search.js';

export function apiInit() {
  console.log('[API] initialized');
}

export async function fetchRecordings() {
  const user_id = getUserId();
  if (!user_id) return [];
  try {
    const res = await fetch(`/recordings?user_id=${encodeURIComponent(user_id)}`, { cache: 'no-store' });
    if (!res.ok) return [];
    return await res.json();
  } catch (e) {
    console.error('fetchRecordings failed', e);
    return [];
  }
}

export async function searchRecordings(query) {
  const user_id = getUserId();
  if (!user_id) return [];
  if (!query || !query.trim()) return [];

  try {
    const res = await fetch(
      `/search?user_id=${encodeURIComponent(user_id)}&q=${encodeURIComponent(query.trim())}`,
      { cache: 'no-store' }
    );
    if (!res.ok) {
      console.error('Search request failed:', res.status);
      return [];
    }
    return await res.json();
  } catch (e) {
    console.error('searchRecordings failed', e);
    return [];
  }
}

export async function pollStatusAndUpdate(statusUrl, cardEl, recId) {
  try {
    let attempts = 0;
    const MAX_ATTEMPTS = 400;
    const poll = async () => {
      attempts++;
      if (attempts > MAX_ATTEMPTS) return;
      const res = await fetch(statusUrl, { cache: 'no-store' });
      if (!res.ok) {
        setTimeout(poll, 1500);
        return;
      }
      const json = await res.json();

      // Update status indicator and title
      const statusIndicator = cardEl.querySelector('.recording-status-indicator');
      const titleElement = cardEl.querySelector('.recording-title');

      if (json.status === 'processing') {
        // Show "Uploading..." status
        if (statusIndicator) {
          const statusText = statusIndicator.querySelector('.status-text');
          if (statusText) statusText.textContent = 'Uploading...';
        }
        if (titleElement && titleElement.textContent !== 'New Recording') {
          titleElement.textContent = 'New Recording';
        }
      } else if (json.status === 'transcribing') {
        // Show "Transcribing..." status
        if (statusIndicator) {
          const statusText = statusIndicator.querySelector('.status-text');
          if (statusText) statusText.textContent = 'Transcribing...';
        }
        if (titleElement && titleElement.textContent !== 'New Recording') {
          titleElement.textContent = 'New Recording';
        }
      } else if (['transcribed', 'summarized', 'audio_missing', 'error'].includes(json.status)) {
        // Remove status indicator and update title when complete
        if (statusIndicator) {
          statusIndicator.remove();
        }
        // Update title if available
        if (titleElement && json.title) {
          titleElement.textContent = json.title;
        }
      }

      const statusBadge = cardEl.querySelector('.status-badge');
      if (statusBadge) {
        statusBadge.textContent = json.status || statusBadge.textContent;
        statusBadge.className = 'status-badge ' + (json.status ? `status-${json.status}` : '');
      }

      const updateBlock = (field, htmlProp) => {
        const full = cardEl.querySelector(`.collapsible-block[data-field="${field}"] .collapsible-full`);
        const preview = cardEl.querySelector(`.collapsible-block[data-field="${field}"] .collapsible-preview`);
        const newText = json[field]
          ? (json[htmlProp] || nl2br(escapeHtml(formatMultiline(json[field]))))
          : null;
        if (newText) {
          if (full) full.innerHTML = newText;
          if (preview) preview.innerHTML = newText;
        }
      };

      // Check if transcript is now available and needs to be displayed
      const hasTranscript = json.transcript && String(json.transcript).trim();
      const transcriptBlock = cardEl.querySelector(`.collapsible-block[data-field="transcript"]`);

      // If we have a transcript but no transcript block, we need to replace the entire card
      if (hasTranscript && !transcriptBlock) {
        const recRes = await fetch(`/recordings?user_id=${encodeURIComponent(getUserId())}`, { cache: 'no-store' });
        if (recRes.ok) {
          const recs = await recRes.json();
          const rec = (recs || []).find(r => r.id === recId);
          if (rec) {
            replaceCard(rec, cardEl);
            // Continue polling if still transcribing
            if (!['transcribed', 'summarized', 'audio_missing', 'error'].includes(json.status)) {
              setTimeout(poll, 1500);
            }
            return;
          }
        }
      }

      updateBlock('transcript', '_transcript_html');
      updateBlock('summary', '_summary_html');
      updateBlock('meeting_notes', '_meeting_notes_html');

      if (['transcribed', 'summarized', 'audio_missing', 'error'].includes(json.status)) {
        const recRes = await fetch(`/recordings?user_id=${encodeURIComponent(getUserId())}`, { cache: 'no-store' });
        if (recRes.ok) {
          const recs = await recRes.json();
          const rec = (recs || []).find(r => r.id === recId);
          if (rec) replaceCard(rec, cardEl);
        }
        return;
      }
      setTimeout(poll, 1500);
    };
    poll();
  } catch (e) {
    console.error('Polling error', e);
  }
}

/* ------------------------
   New: deleteRecording(id)
   ------------------------
   - POSTs to /delete/:id (same as original)
   - returns JSON from server (or throws)
   - caller should update cache/UI on success
*/
export async function deleteRecording(id) {
  try {
    const res = await fetch(`/delete/${encodeURIComponent(id)}`, { method: 'POST', cache: 'no-store' });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error((json && json.error) ? json.error : 'Delete failed');
    }
    return json;
  } catch (e) {
    console.error('deleteRecording error', e);
    throw e;
  }
}

/* ------------------------
   fetchRelatedNotes(noteId)
   ------------------------
   - Fetches related notes based on semantic similarity
   - Returns array of related notes with title, date, similarity score
*/
export async function fetchRelatedNotes(noteId, limit = 5) {
  const user_id = getUserId();
  if (!user_id || !noteId) return [];

  try {
    const res = await fetch(
      `/related/${encodeURIComponent(noteId)}?user_id=${encodeURIComponent(user_id)}&limit=${limit}`,
      { cache: 'no-store' }
    );
    if (!res.ok) {
      console.error('Related notes request failed:', res.status);
      return [];
    }
    const data = await res.json();
    return data.related_notes || [];
  } catch (e) {
    console.error('fetchRelatedNotes failed', e);
    return [];
  }
}
