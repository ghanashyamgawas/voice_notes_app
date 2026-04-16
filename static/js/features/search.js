// features/search.js
/*
  Search, highlight and ordering logic.
  Exports:
    - applySearchFilter()
    - highlightHtml(escapedText, query)
    - countOccurrences(text, query)
    - computeSearchScore(rec, query)
    - shortenTitle(text, maxWords)
*/

import { escapeHtml, nl2br, formatMultiline } from '../utils/text-helpers.js';
import { createRecordingCard, renderSubnote } from '../ui/recording-card.js';
import { searchRecordings } from '../api/recordings-api.js';

// small copy icon used for per-block copy buttons (kept in original codebase elsewhere)
// (not needed here but preserved design-wise in UI modules)

// ---------------------- Search & highlight utilities ----------------------

// Shorten a title to N words (default 4). Keeps it readable and adds "..." if trimmed.
export function shortenTitle(text, maxWords = 4) {
  if (!text) return '';
  const t = String(text).trim();
  const words = t.split(/\s+/);
  if (words.length <= maxWords) return t;
  return words.slice(0, maxWords).join(' ') + '...';
}

// Highlight matched occurrences in the escaped HTML string.
// - query may contain spaces (will be treated as a phrase).
// - performs case-insensitive matching.
// Returns HTML safe string with <mark> around matches.
export function highlightHtml(escapedText, query) {
  if (!query || !escapedText) return escapedText;
  const q = query.trim();
  if (!q) return escapedText;

  // Escape regex special chars in query
  const esc = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // If query is multiple words, match the phrase first (preserve spaces)
  const pattern = new RegExp(`(${esc})`, 'ig');

  // Replace matches with <mark>
  return escapedText.replace(pattern, '<mark>$1</mark>');
}

// Count occurrences of query in a text (case-insensitive)
export function countOccurrences(text, query) {
  if (!text || !query) return 0;
  const q = query.trim();
  if (!q) return 0;
  const esc = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(esc, 'ig');
  const matches = text.match(re);
  return matches ? matches.length : 0;
}

// Compute weighted score for a recording given query – used for sorting
export function computeSearchScore(rec, query) {
  if (!query || !query.trim()) return 0;
  const q = query.trim().toLowerCase();
  // weights from original
  const W = { title: 10, summary: 6, meeting_notes: 4, transcript: 2 };

  const t = (rec.title || '').toLowerCase();
  const s = (rec.summary || '').toLowerCase();
  const m = (rec.meeting_notes || '').toLowerCase();
  const tr = (rec.transcript || '').toLowerCase();

  const score =
    W.title * countOccurrences(t, q) +
    W.summary * countOccurrences(s, q) +
    W.meeting_notes * countOccurrences(m, q) +
    W.transcript * countOccurrences(tr, q);

  return score;
}

// apply search filter and render matching cards
export async function applySearchFilter() {
  const recordingsEl = window.VN_STATE.els.recordingsEl;
  const emptyState = window.VN_STATE.els.emptyState;
  const searchTerm = (window.VN_STATE.currentSearch || '').trim();

  if (!recordingsEl) return;
  // Clear current list
  recordingsEl.innerHTML = '';

  let list = [];
  let subnotes = [];

  if (!searchTerm) {
    // No search term - use cached data (already sorted newest first from backend)
    const all = (window.VN_STATE.recsCache || []).slice();
    const parentRecordings = all.filter(r => !r.parent_id);
    subnotes = all.filter(r => r.parent_id);
    list = parentRecordings;
  } else {
    // Use backend search for better performance
    try {
      const searchResults = await searchRecordings(searchTerm);

      if (searchResults && searchResults.length > 0) {
        // Separate parent recordings and subnotes from search results
        const parentRecordings = searchResults.filter(r => !r.parent_id);
        subnotes = searchResults.filter(r => r.parent_id);
        list = parentRecordings;

        console.log(`[Search] Backend search found ${list.length} parent notes and ${subnotes.length} subnotes`);
      } else {
        list = [];
        subnotes = [];
      }
    } catch (error) {
      console.error('[Search] Backend search failed, falling back to client-side search', error);

      // Fallback to client-side search
      const all = (window.VN_STATE.recsCache || []).slice();
      const parentRecordings = all.filter(r => !r.parent_id);
      subnotes = all.filter(r => r.parent_id);

      list = parentRecordings
        .map(rec => {
          const score = computeSearchScore(rec, searchTerm);
          return Object.assign({}, rec, { __search_score: score });
        })
        .filter(r => r.__search_score > 0)
        .sort((a, b) => {
          if (b.__search_score !== a.__search_score) return b.__search_score - a.__search_score;
          if (a.recorded_at && b.recorded_at) return new Date(b.recorded_at) - new Date(a.recorded_at);
          return 0;
        });
    }
  }

  if (!list || list.length === 0) {
    if (emptyState) recordingsEl.appendChild(emptyState);
    return;
  }

  // Remove empty state if present
  if (emptyState && emptyState.parentNode) emptyState.parentNode.removeChild(emptyState);

  list.forEach(r => {
    // prepare highlighted HTML snippets and attach them to object so UI can use them
    const q = searchTerm;
    // Title: escape -> highlight (no nl2br)
    r._title_html = highlightHtml(escapeHtml(r.title || r.id || ''), q);

    // Summary / notes / transcript: escape -> nl2br -> highlight
    r._summary_html = r.summary ? highlightHtml(nl2br(escapeHtml(formatMultiline(r.summary))), q) : '';
    r._meeting_notes_html = r.meeting_notes ? highlightHtml(nl2br(escapeHtml(formatMultiline(r.meeting_notes))), q) : '';
    r._transcript_html = r.transcript ? highlightHtml(nl2br(escapeHtml(formatMultiline(r.transcript))), q) : '';

    // Append card element
    const card = createRecordingCard(r);
    recordingsEl.appendChild(card);

    // After rendering parent card, render its subnotes
    const childSubnotes = subnotes.filter(subnote => subnote.parent_id === r.id);
    if (childSubnotes.length > 0) {
      childSubnotes.forEach(subnote => {
        // Prepare highlighted HTML for subnote too
        subnote._title_html = highlightHtml(escapeHtml(subnote.title || subnote.id || ''), q);
        subnote._summary_html = subnote.summary ? highlightHtml(nl2br(escapeHtml(formatMultiline(subnote.summary))), q) : '';
        subnote._meeting_notes_html = subnote.meeting_notes ? highlightHtml(nl2br(escapeHtml(formatMultiline(subnote.meeting_notes))), q) : '';
        subnote._transcript_html = subnote.transcript ? highlightHtml(nl2br(escapeHtml(formatMultiline(subnote.transcript))), q) : '';

        renderSubnote(subnote, card);
      });
    }
  });
}
