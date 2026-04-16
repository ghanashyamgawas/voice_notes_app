// features/copy-actions.js
/*
  Handles:
  - handleCopyLink()
  - handleCopyNote()
  - handleCopyField()
  - handleWhatsAppShare()
  - handleOutlookShare()
*/

import { _showCopyToast } from '../ui/toast.js';

// Helper: build share URL for a recording
function getShareUrlForRecording(rec) {
  if (!rec) return null;
  if (rec.share_url) return rec.share_url;
  return `${window.location.origin}/app?recording_id=${encodeURIComponent(rec.id)}`;
}

// ---- COPY LINK ----
export async function handleCopyLink(urlOrRec, card) {
  try {
    let url = (typeof urlOrRec === 'object' && urlOrRec !== null)
      ? getShareUrlForRecording(urlOrRec)
      : String(urlOrRec || '');

    if (!url) {
      _showCopyToast('No link to copy', 1600);
      return;
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(url);
        _showCopyToast('Link copied', 1400);
        if (card) {
          const badge = card.querySelector('.status-badge');
          if (badge) {
            const prev = badge.textContent;
            badge.textContent = 'link copied';
            setTimeout(() => (badge.textContent = prev), 1400);
          }
        }
        return;
      } catch (err) {
        console.warn('clipboard.writeText failed, falling back', err);
      }
    }

    // fallback method
    const ta = document.createElement('textarea');
    ta.value = url;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    let copied = false;
    try { copied = document.execCommand('copy'); } catch { copied = false; }
    ta.remove();

    if (copied) {
      _showCopyToast('Link copied', 1400);
      return;
    }

    _showCopyToast('Copy failed – open prompt', 2600);
    window.prompt('Copy this link', url);
  } catch (e) {
    console.error('handleCopyLink error', e);
    alert('Could not copy link');
  }
}

// ---- WHATSAPP SHARE ----
export function handleWhatsAppShare(url, title = '') {
  const u = getShareUrlForRecording({ share_url: url, id: '' }) || url;
  const text = encodeURIComponent((title ? title + '\n' : '') + u);
  window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener');
}

// ---- OUTLOOK SHARE ----
export function handleOutlookShare(url, title = '') {
  const u = getShareUrlForRecording({ share_url: url, id: '' }) || url;
  const subject = encodeURIComponent(title || 'Recording');
  const body = encodeURIComponent(u);
  window.location.href = `mailto:?subject=${subject}&body=${body}`;
}

// ---- COPY NOTE ----
export async function handleCopyNote(recOrId, card) {
  try {
    let rec = typeof recOrId === 'object' ? recOrId : null;
    if (!rec) rec = (window.VN_STATE.recsCache || []).find(r => r.id === recOrId) || null;

    let title = rec?.title?.trim() || '';
    let transcript = rec?.transcript?.trim() || '';

    if (card) {
      const tBlock = card.querySelector('.collapsible-block[data-field="transcript"] .collapsible-full');
      if (tBlock?.textContent) transcript = tBlock.textContent.trim();
      const titleEl = card.querySelector('.recording-title');
      if (titleEl?.textContent) title = titleEl.textContent.trim();
    }

    if (!title) title = 'Untitled';
    if (!transcript) transcript = '';

    title = title.replace(/\*\*/g, '*');
    const markdown = `**${title}**\n\n${transcript}`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(markdown);
        _showCopyToast('Note copied', 1400);
        if (card) {
          const badge = card.querySelector('.status-badge');
          if (badge) {
            const prev = badge.textContent;
            badge.textContent = 'note copied';
            setTimeout(() => (badge.textContent = prev), 1400);
          }
        }
        return;
      } catch (err) {
        console.warn('clipboard.writeText failed for copy note, falling back', err);
      }
    }

    const ta = document.createElement('textarea');
    ta.value = markdown;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    let copied = false;
    try { copied = document.execCommand('copy'); } catch { copied = false; }
    ta.remove();

    if (copied) {
      _showCopyToast('Note copied', 1400);
      return;
    }

    _showCopyToast('Copy failed – open prompt', 2600);
    window.prompt('Copy this note', markdown);
  } catch (e) {
    console.error('handleCopyNote error', e);
    alert('Could not copy note');
  }
}

// ---- COPY FIELD ----
export async function handleCopyField(recOrId, cardEl, field, label) {
  try {
    let rec = typeof recOrId === 'object' ? recOrId : null;
    if (!rec) rec = (window.VN_STATE.recsCache || []).find(r => r.id === recOrId) || null;

    let content = '';
    let title = rec?.title?.trim() || '';

    if (cardEl) {
      const titleEl = cardEl.querySelector('.recording-title');
      if (titleEl?.textContent) title = titleEl.textContent.trim();

      const wrapper = cardEl.querySelector(`.collapsible-block[data-field="${field}"]`);
      if (wrapper) {
        const full = wrapper.querySelector('.collapsible-full');
        const preview = wrapper.querySelector('.collapsible-preview');
        if (full?.textContent?.trim()) content = full.textContent.trim();
        else if (preview?.textContent) content = preview.textContent.trim();
      }
    }

    if (!content && rec && rec[field]) content = String(rec[field]).trim();
    if (!title) title = 'Untitled';
    title = title.replace(/\*\*/g, '*');

    const body = `**${title}**\n\n${label}:\n\n${content}`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(body);
        _showCopyToast(`${label} copied`, 1400);
        if (cardEl) {
          const badge = cardEl.querySelector('.status-badge');
          if (badge) {
            const prev = badge.textContent;
            badge.textContent = `${label.toLowerCase()} copied`;
            setTimeout(() => (badge.textContent = prev), 1400);
          }
        }
        return;
      } catch (err) {
        console.warn('clipboard.writeText failed, falling back', err);
      }
    }

    const ta = document.createElement('textarea');
    ta.value = body;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    let copied = false;
    try { copied = document.execCommand('copy'); } catch { copied = false; }
    ta.remove();

    if (copied) {
      _showCopyToast(`${label} copied`, 1400);
      return;
    }

    _showCopyToast('Copy failed – open prompt', 2600);
    window.prompt(`Copy ${label}`, body);
  } catch (e) {
    console.error('handleCopyField error', e);
    alert('Could not copy');
  }
}
