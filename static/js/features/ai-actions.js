// features/ai-actions.js
/*
  AI action handlers:
    - handleSummarize(id, cardEl)
    - handleMeetingNotes(id, cardEl)
    - handleMainPoints(id, cardEl)
    - handleTodoList(id, cardEl)
    - handleEmailDraft(id, cardEl)
    - handleCleanup(id, cardEl)

  Each calls the backend POST endpoint and replaces the card when the backend returns
  an updated recording object. Errors and unexpected responses mirror original behavior.
*/

import { replaceCard } from '../ui/recording-card.js';
import { applySearchFilter } from './search.js';

// Helper to show loading state
function showLoadingState(cardEl, field, loadingText) {
  if (!cardEl) return null;

  // Find the collapsible block for this field
  let block = cardEl.querySelector(`.collapsible-block[data-field="${field}"]`);

  // If block doesn't exist, create it
  if (!block) {
    const content = cardEl.querySelector('.card-content');
    if (!content) return null;

    block = document.createElement('div');
    block.className = 'collapsible-block';
    block.setAttribute('data-field', field);

    // Insert BEFORE the action buttons row
    const actionsRow = content.querySelector('.card-actions-row');
    if (actionsRow) {
      content.insertBefore(block, actionsRow);
    } else {
      // Fallback: append at the end if actions row not found
      content.appendChild(block);
    }
  }

  // Add loading indicator
  block.innerHTML = `
    <div class="ai-loading-state">
      <div class="ai-loading-indicator">
        <span class="ai-loading-dot"></span>
        <span class="ai-loading-text">${loadingText}</span>
      </div>
    </div>
  `;

  return block;
}

// Helper to remove loading state
function removeLoadingState(cardEl, field) {
  if (!cardEl) return;
  const block = cardEl.querySelector(`.collapsible-block[data-field="${field}"]`);
  if (block) {
    const loadingState = block.querySelector('.ai-loading-state');
    if (loadingState) {
      loadingState.remove();
    }
  }
}

async function _postAndReplace(url, id, cardEl, btnSelector, fallbackMsg, field, loadingText) {
  const btn = cardEl ? cardEl.querySelector(btnSelector) : null;
  if (btn) btn.disabled = true;

  // Show loading state
  showLoadingState(cardEl, field, loadingText);

  try {
    const res = await fetch(url, { method: 'POST', cache: 'no-store' });
    const contentType = (res.headers && res.headers.get('content-type')) || '';

    if (!res.ok) {
      removeLoadingState(cardEl, field);
      const text = await res.text();
      alert((text && text.trim().slice(0, 250)) || `${fallbackMsg} (server error)`);
      return;
    }

    if (!contentType.includes('application/json')) {
      removeLoadingState(cardEl, field);
      const text = await res.text();
      alert((text && text.trim().slice(0, 250)) || `${fallbackMsg} (unexpected response)`);
      return;
    }

    const json = await res.json();
    if (res.ok && json.recording) {
      removeLoadingState(cardEl, field);
      replaceCard(json.recording, cardEl);
      // Update title in-place if present (preserve original behavior)
      if (json.recording.title && cardEl) {
        const titleEl = cardEl.querySelector('.recording-title');
        if (titleEl) titleEl.textContent = json.recording.title;
      }
    } else {
      removeLoadingState(cardEl, field);
      alert((json && json.error) || `${fallbackMsg} failed`);
    }
  } catch (e) {
    removeLoadingState(cardEl, field);
    console.error(`${fallbackMsg} error`, e);
    alert(`${fallbackMsg} error`);
  } finally {
    if (btn) btn.disabled = false;
  }
}

export async function handleSummarize(id, cardEl) {
  return _postAndReplace(
    `/summarize/${encodeURIComponent(id)}`,
    id, cardEl, '.btn-summarize', 'Summarize',
    'summary', 'Generating summary...'
  );
}

export async function handleMeetingNotes(id, cardEl) {
  return _postAndReplace(
    `/meeting_notes/${encodeURIComponent(id)}`,
    id, cardEl, '.btn-notes', 'Meeting notes',
    'meeting_notes', 'Generating meeting notes...'
  );
}

export async function handleMainPoints(id, cardEl) {
  return _postAndReplace(
    `/main_points/${encodeURIComponent(id)}`,
    id, cardEl, '.btn-main-points', 'Main points',
    'main_points', 'Extracting main points...'
  );
}

export async function handleTodoList(id, cardEl) {
  return _postAndReplace(
    `/todo_list/${encodeURIComponent(id)}`,
    id, cardEl, '.btn-todo', 'To-do list',
    'todo_list', 'Creating to-do list...'
  );
}

export async function handleEmailDraft(id, cardEl) {
  return _postAndReplace(
    `/email_draft/${encodeURIComponent(id)}`,
    id, cardEl, '.btn-email-draft', 'Email draft',
    'email_draft', 'Drafting email...'
  );
}

export async function handleCleanup(id, cardEl) {
  return _postAndReplace(
    `/cleanup_transcript/${encodeURIComponent(id)}`,
    id, cardEl, '.btn-cleanup', 'Cleanup',
    'clean_transcript', 'Cleaning transcript...'
  );
}

export async function handleSummarizeSubnotes(parentId, cardEl) {
  // Find all subnote cards under this parent
  const subnotesContainer = cardEl.querySelector('.subnotes-container');

  if (!subnotesContainer) {
    alert('No subnotes found for this recording.');
    return;
  }

  const subnoteCards = subnotesContainer.querySelectorAll('.subnote-card');

  if (subnoteCards.length === 0) {
    alert('No subnotes found for this recording.');
    return;
  }

  // Extract subnote IDs
  const subnoteIds = Array.from(subnoteCards).map(card => card.getAttribute('data-rec-id')).filter(id => id);

  if (subnoteIds.length === 0) {
    alert('No valid subnotes found.');
    return;
  }

  // Show loading state
  showLoadingState(cardEl, 'subnotes_summary', `Summarizing ${subnoteIds.length} subnote${subnoteIds.length > 1 ? 's' : ''}...`);

  try {
    // Call backend to summarize subnotes
    const res = await fetch(`/summarize_subnotes/${encodeURIComponent(parentId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subnote_ids: subnoteIds }),
      cache: 'no-store'
    });

    if (!res.ok) {
      removeLoadingState(cardEl, 'subnotes_summary');
      const text = await res.text();
      alert(text || 'Failed to summarize subnotes');
      return;
    }

    const json = await res.json();

    if (json.recording) {
      removeLoadingState(cardEl, 'subnotes_summary');
      // Replace card to show the new subnotes_summary field (like normal Summary)
      replaceCard(json.recording, cardEl);
    } else {
      removeLoadingState(cardEl, 'subnotes_summary');
      alert(json.error || 'Failed to summarize subnotes');
    }
  } catch (e) {
    removeLoadingState(cardEl, 'subnotes_summary');
    console.error('Error summarizing subnotes', e);
    alert('Error summarizing subnotes');
  }
}
