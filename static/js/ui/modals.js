// ui/modals.js
/*
  edit transcript UI used inside recording cards.

  Exports:
    - openEditTranscript(id, cardEl)

  Behaviour:
    - Inserts a textarea + action buttons into the card (or under the transcript block)
    - POSTs edited transcript to /edit_transcript/:id
    - On success: dispatches CustomEvent 'vn:recording-updated' with detail { recording, oldCard }
      (listeners may call replaceCard(recording, oldCard))
    - Preserves original behavior + error handling from script.js
*/

export function openEditTranscript(id, cardEl) {
  if (!cardEl) return;
  // Prevent opening multiple editors in same card
  if (cardEl.querySelector('.transcript-editor')) return;

  // Try to find existing transcript full block
  const wrapper = cardEl.querySelector(`.collapsible-block[data-field="transcript"]`);
  const tFull = wrapper ? wrapper.querySelector('.collapsible-full') : null;

  // Fallback: any element with class 'transcript-body'
  let currentText = '';
  if (tFull) {
    currentText = (tFull.textContent === '(processing or not transcribed)') ? '' : tFull.textContent;
  } else {
    const oldT = cardEl.querySelector('.transcript-body');
    currentText = oldT ? (oldT.textContent === '(processing or not transcribed)' ? '' : oldT.textContent) : '';
  }

  // Create editor elements
  const editor = document.createElement('textarea');
  editor.className = 'transcript-editor';
  editor.style.width = '100%';
  editor.style.minHeight = '120px';
  editor.value = currentText || '';

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.textContent = 'Save Transcript';
  saveBtn.className = 'btn-save-transcript';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.className = 'btn-cancel-transcript';

  const actionRow = document.createElement('div');
  actionRow.className = 'card-actions';
  actionRow.style.marginTop = '8px';
  actionRow.appendChild(saveBtn);
  actionRow.appendChild(cancelBtn);

  // Insert editor after the full content if present, otherwise at end of card content
  if (tFull && tFull.parentNode) {
    tFull.style.display = 'none';
    tFull.parentNode.insertBefore(editor, tFull.nextSibling);
    tFull.parentNode.insertBefore(actionRow, editor.nextSibling);
  } else {
    // append near actions if no transcript block found
    cardEl.appendChild(editor);
    cardEl.appendChild(actionRow);
  }

  // Cancel handler
  cancelBtn.onclick = () => {
    editor.remove();
    actionRow.remove();
    if (tFull) tFull.style.display = '';
  };

  // Save handler
  saveBtn.onclick = async () => {
    saveBtn.disabled = true;
    try {
      const res = await fetch(`/edit_transcript/${encodeURIComponent(id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: editor.value }),
        cache: 'no-store'
      });

      // Parse response safely
      let json = null;
      try { json = await res.json(); } catch (e) { json = null; }

      if (res.ok && json && json.recording) {
        // Dispatch event with updated recording and the old card element
        const ev = new CustomEvent('vn:recording-updated', {
          bubbles: true,
          detail: { recording: json.recording, oldCard: cardEl }
        });
        (cardEl || document).dispatchEvent(ev);
      } else {
        const errMsg = (json && json.error) || 'Failed to save transcript';
        alert(errMsg);
      }
    } catch (e) {
      console.error('Save transcript error', e);
      alert('Save error');
    } finally {
      saveBtn.disabled = false;
      // Remove editor UI after save attempt (original behaviour replaced card on success)
      try { editor.remove(); actionRow.remove(); } catch (e) {}
      if (tFull) tFull.style.display = '';
    }
  };
}
