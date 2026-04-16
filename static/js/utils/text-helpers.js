// utils/text-helpers.js
/*
  Text formatting utilities.
  Exports:
    - escapeHtml(str)
    - unescapeHtml(str)
    - nl2br(htmlEscaped)
    - formatMultiline(text)
*/

export function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function unescapeHtml(str) {
  if (str == null) return '';
  const textarea = document.createElement('textarea');
  textarea.innerHTML = str;
  return textarea.value;
}

// Convert newlines to <br> for HTML display while preserving escaping
export function nl2br(htmlEscaped) {
  if (!htmlEscaped) return '';
  return htmlEscaped.replace(/\r\n|\r|\n/g, '<br>');
}

// Clean and reformat multiline text for improved readability
// Example: turn "- item" style into line breaks with dashes spaced properly
export function formatMultiline(text) {
  if (!text) return '';
  return text.replace(/\s*-\s*/g, '\n- ').trim();
}

// Format date as "25 Nov" or "12 Jan" style
export function formatShortDate(dateString) {
  if (!dateString) return '';

  try {
    const date = new Date(dateString);
    const day = date.getDate();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[date.getMonth()];

    return `${day} ${month}`;
  } catch (e) {
    console.error('Error formatting date:', e);
    return '';
  }
}
