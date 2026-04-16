// ui/collapsible-block.js
/*
  Renders collapsible text blocks used inside recording cards.
  Exports:
    - renderCollapsibleField(options)
    - findBlockElements(cardEl, field)
*/

import { formatMultiline, nl2br, escapeHtml, unescapeHtml } from '../utils/text-helpers.js';
import { handleCopyField } from '../features/copy-actions.js';

// default preview lines when collapsed
export const DEFAULT_PREVIEW_LINES = 1;

// small copy icon used for per-block copy buttons (top-level so it's available)
const svgCopySmall = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" width="18" height="18" style="vertical-align:middle">
  <rect x="9" y="2" width="6" height="4" rx="1" stroke="currentColor" stroke-width="1.2"/>
  <rect x="5" y="6" width="14" height="14" rx="2" stroke="currentColor" stroke-width="1.2"/>
  <path d="M9 10h6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
</svg>`;

// storage helpers (string 'true' = collapsed)
function _collapsedKey(recId, field) {
  return `vn_collapsed:${recId}:${field}`;
}
export function isCollapsed(recId, field) {
  try {
    const v = localStorage.getItem(_collapsedKey(recId, field));
    // default collapsed so page uses less space
    return v === null ? true : v === 'true';
  } catch (e) {
    return true;
  }
}
export function setCollapsed(recId, field, collapsed) {
  try {
    localStorage.setItem(_collapsedKey(recId, field), collapsed ? 'true' : 'false');
  } catch (e) {
    console.warn('Could not persist collapsed state', e);
  }
}

// create safe HTML for display (reuse helpers)
// if isHtml flag is true, the provided text is treated as already-escaped HTML and used as-is
function _makeSafeHtmlForBlock(text, isHtml = false) {
  if (!text) return '';
  // First unescape any HTML entities that might be in the text from backend
  const unescapedText = unescapeHtml(text);
  return isHtml ? String(text) : nl2br(escapeHtml(formatMultiline(unescapedText)));
}

/**
 * renderCollapsibleField(options)
 *
 * options:
 *  - parentEl        DOM Element (required) — where to append the block
 *  - recId           string (required)
 *  - field           string (required) — used as data-field attr
 *  - headingText     string (label shown on header)
 *  - text            string (raw text or pre-escaped HTML depending on isHtml)
 *  - previewLines    number
 *  - isHtml          boolean — true if `text` is already escaped HTML (e.g., highlighted)
 */
export function renderCollapsibleField({ parentEl, recId, field, headingText, text, previewLines = DEFAULT_PREVIEW_LINES, isHtml = false }) {
  if (!parentEl) return;

  const safeHtml = _makeSafeHtmlForBlock(text || '', isHtml);
  const wrapper = document.createElement('div');
  wrapper.className = 'collapsible-block';
  wrapper.dataset.recId = recId;
  wrapper.dataset.field = field;
  // Store the original raw text for editing
  wrapper._rawText = text || '';

  const header = document.createElement('div');
  header.className = 'collapsible-header';
  header.tabIndex = 0;
  header.setAttribute('role', 'button');
  header.setAttribute('aria-pressed', 'false');
  header.textContent = headingText || field;

  const preview = document.createElement('div');
  preview.className = 'collapsible-preview';
  // webkit line clamp via style property
  preview.style.webkitLineClamp = String(previewLines);
  preview.innerHTML = safeHtml;

  const full = document.createElement('div');
  full.className = 'collapsible-full';
  full.innerHTML = safeHtml;

  const shortEnough = (String(text || '').trim().length <= previewLines * 120);

  if (shortEnough) {
    // Content is short, just show it all with no toggle
    header.classList.add('collapsible-header--static');
    preview.style.display = 'none';
    full.style.display = '';
    header.setAttribute('aria-pressed', 'false');
    header.style.cursor = 'default';
    preview.style.cursor = 'default';
  } else {
    // Content is long, add expand/collapse with new behavior
    const collapsed = isCollapsed(recId, field);
    if (collapsed) {
      preview.style.display = '';
      full.style.display = 'none';
      header.setAttribute('aria-pressed', 'false');
    } else {
      preview.style.display = 'none';
      full.style.display = '';
      header.setAttribute('aria-pressed', 'true');
    }

    // Click on preview (content) to expand
    preview.style.cursor = 'pointer';
    preview.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const nowCollapsed = isCollapsed(recId, field);
      if (nowCollapsed) {
        // Expand
        preview.style.display = 'none';
        full.style.display = '';
        header.setAttribute('aria-pressed', 'true');
        setCollapsed(recId, field, false);
      }
    });

    // Click on header to collapse
    header.style.cursor = 'pointer';
    header.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const nowCollapsed = isCollapsed(recId, field);
      if (!nowCollapsed) {
        // Collapse
        full.style.display = 'none';
        preview.style.display = '';
        header.setAttribute('aria-pressed', 'false');
        setCollapsed(recId, field, true);
      }
    });

    // Keyboard support for header
    header.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        const nowCollapsed = isCollapsed(recId, field);
        if (!nowCollapsed) {
          // Collapse
          full.style.display = 'none';
          preview.style.display = '';
          header.setAttribute('aria-pressed', 'false');
          setCollapsed(recId, field, true);
        }
      }
    });

    // Click on full content to do nothing (already expanded)
    full.style.cursor = 'default';
  }

  // --- Buttons container for Copy, Edit, and Delete ---
  const buttonsContainer = document.createElement('div');
  buttonsContainer.className = 'field-buttons-container';

  const copyBtn = document.createElement('button');
  copyBtn.className = 'btn-field-action';
  copyBtn.type = 'button';
  const labelText = (headingText || field).replace(/:$/,'');
  copyBtn.title = `Copy ${labelText}`;
  copyBtn.setAttribute('aria-label', `Copy ${labelText}`);
  copyBtn.textContent = 'Copy';

  // Ensure the button does not accidentally toggle the collapse (stopPropagation)
  copyBtn.addEventListener('click', (ev) => {
    ev.stopPropagation();
    // Try to find the card element that contains this wrapper (closest .card)
    const cardEl = parentEl.closest('.card');
    try {
      handleCopyField(recId, cardEl, field, labelText);
    } catch (e) {
      console.warn('Copy handler missing or failed', e);
    }
  });

  buttonsContainer.appendChild(copyBtn);

  // --- Add Edit button only for transcript field ---
  if (field === 'transcript') {
    const editBtn = document.createElement('button');
    editBtn.className = 'btn-field-action btn-edit';
    editBtn.type = 'button';
    editBtn.title = 'Edit Transcript';
    editBtn.setAttribute('aria-label', 'Edit Transcript');
    editBtn.textContent = 'Edit';

    editBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      // Use the stored raw text to avoid double-escaping
      enterEditMode(wrapper, recId, wrapper._rawText, full, preview, buttonsContainer);
    });

    buttonsContainer.appendChild(editBtn);
  }

  // --- Add Delete button for all fields EXCEPT transcript ---
  if (field !== 'transcript') {
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-field-action btn-delete';
    deleteBtn.type = 'button';
    deleteBtn.title = `Delete ${labelText}`;
    deleteBtn.setAttribute('aria-label', `Delete ${labelText}`);
    deleteBtn.textContent = 'Delete';

    deleteBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      handleDeleteField(recId, field, labelText, wrapper);
    });

    buttonsContainer.appendChild(deleteBtn);
  }

  // Append elements
  wrapper.appendChild(header);
  wrapper.appendChild(preview);
  wrapper.appendChild(full);
  wrapper.appendChild(buttonsContainer);

  parentEl.appendChild(wrapper);
}

/**
 * enterEditMode - Convert transcript display into inline editor
 */
function enterEditMode(wrapper, recId, originalText, fullDiv, previewDiv, buttonsContainer) {
  // Hide the display divs and buttons
  fullDiv.style.display = 'none';
  previewDiv.style.display = 'none';
  buttonsContainer.style.display = 'none';

  // Create editor container
  const editorContainer = document.createElement('div');
  editorContainer.className = 'transcript-editor-container';

  // Create textarea
  const textarea = document.createElement('textarea');
  textarea.className = 'transcript-editor-textarea';
  textarea.value = originalText || '';
  textarea.setAttribute('aria-label', 'Edit transcript text');

  // Create editor controls
  const controlsDiv = document.createElement('div');
  controlsDiv.className = 'transcript-editor-controls';

  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn-editor-save';
  saveBtn.type = 'button';
  saveBtn.textContent = 'Save';
  saveBtn.setAttribute('aria-label', 'Save changes');

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn-editor-cancel';
  cancelBtn.type = 'button';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.setAttribute('aria-label', 'Cancel editing');

  controlsDiv.appendChild(saveBtn);
  controlsDiv.appendChild(cancelBtn);

  editorContainer.appendChild(textarea);
  editorContainer.appendChild(controlsDiv);

  wrapper.appendChild(editorContainer);

  // Auto-resize textarea
  const autoResize = () => {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  };
  textarea.addEventListener('input', autoResize);

  // Focus and resize
  setTimeout(() => {
    textarea.focus();
    autoResize();
  }, 0);

  // Keyboard support
  textarea.addEventListener('keydown', (ev) => {
    // Ctrl/Cmd + Enter to save
    if ((ev.ctrlKey || ev.metaKey) && ev.key === 'Enter') {
      ev.preventDefault();
      saveBtn.click();
    }
    // Escape to cancel
    if (ev.key === 'Escape') {
      ev.preventDefault();
      cancelBtn.click();
    }
  });

  // Cancel handler
  const exitEditMode = () => {
    editorContainer.remove();
    buttonsContainer.style.display = '';
    // Restore the original view state
    if (fullDiv.style.display !== 'none' || previewDiv.style.display !== 'none') {
      fullDiv.style.display = fullDiv.dataset.originalDisplay || '';
      previewDiv.style.display = previewDiv.dataset.originalDisplay || 'none';
    } else {
      fullDiv.style.display = '';
    }
  };

  cancelBtn.addEventListener('click', (ev) => {
    ev.stopPropagation();
    exitEditMode();
  });

  // Save handler
  saveBtn.addEventListener('click', async (ev) => {
    ev.stopPropagation();
    const newText = textarea.value;

    // Call backend update first
    try {
      const response = await updateTranscriptBackend(recId, newText);
      console.log('Transcript updated successfully');

      // Update the stored raw text
      wrapper._rawText = newText;

      // Update the UI only after successful save
      const safeHtml = _makeSafeHtmlForBlock(newText, false);
      fullDiv.innerHTML = safeHtml;
      previewDiv.innerHTML = safeHtml;

      // Update the title in the card header if it was regenerated
      if (response && response.recording && response.recording.title) {
        const cardElement = wrapper.closest('.recording-card');
        if (cardElement) {
          const titleElement = cardElement.querySelector('.recording-title');
          if (titleElement) {
            titleElement.textContent = response.recording.title;
            console.log('Title updated to:', response.recording.title);
          }
        }
      }

      exitEditMode();
    } catch (e) {
      console.error('Failed to update transcript on backend', e);
      // Show error to user - could add a message element here
      alert('Failed to save transcript. Please try again.');
    }
  });
}

/**
 * Update transcript on backend
 */
async function updateTranscriptBackend(recId, newText) {
  const response = await fetch(`/edit_transcript/${recId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript: newText })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to update transcript');
  }

  return await response.json();
}

/**
 * Handle delete field with confirmation
 */
function handleDeleteField(recId, field, labelText, wrapper) {
  // Create confirmation dialog
  const confirmed = confirm(`Are you sure you want to delete ${labelText}?`);

  if (!confirmed) {
    return;
  }

  // Call backend to delete the field
  deleteFieldBackend(recId, field)
    .then(() => {
      console.log(`${labelText} deleted successfully`);
      // Remove the wrapper element from DOM
      wrapper.remove();
    })
    .catch((error) => {
      console.error(`Failed to delete ${labelText}`, error);
      alert(`Failed to delete ${labelText}. Please try again.`);
    });
}

/**
 * Delete field on backend
 */
async function deleteFieldBackend(recId, field) {
  const response = await fetch(`/delete_field/${recId}/${field}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' }
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to delete ${field}`);
  }

  return await response.json();
}

// Helper to find collapsible full / preview elements inside a card by field name
export function findBlockElements(cardEl, field) {
  if (!cardEl) return {};
  const wrapper = cardEl.querySelector(`.collapsible-block[data-field="${field}"]`);
  if (!wrapper) return {};
  const preview = wrapper.querySelector('.collapsible-preview');
  const full = wrapper.querySelector('.collapsible-full');
  const header = wrapper.querySelector('.collapsible-header');
  return { wrapper, preview, full, header };
}
