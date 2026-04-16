// utils/constants.js
/*
  Global reusable constants, icons, and configuration.
  Used across UI and feature modules.
  Safe to import anywhere.
*/

// --- SVG ICONS (for reuse if needed) ---
export const ICONS = {
  copySmall: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="18" height="18">
    <rect x="9" y="2" width="6" height="4" rx="1" stroke="currentColor" stroke-width="1.2"/>
    <rect x="5" y="6" width="14" height="14" rx="2" stroke="currentColor" stroke-width="1.2"/>
    <path d="M9 10h6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
  </svg>`,

  aiStar: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L14 8L20 10L14 12L12 18L10 12L4 10L10 8L12 2Z"
      stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
  </svg>`,

  trash: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 6h18" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M8 6v12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V6"
      stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M10 11v6M14 11v6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"
      stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
  </svg>`
};

// --- CONFIGURATION CONSTANTS ---
export const SEARCH_WEIGHTS = {
  title: 10,
  summary: 6,
  meeting_notes: 4,
  transcript: 2
};

export const POLL = {
  INTERVAL_MS: 1500,
  MAX_ATTEMPTS: 400  // ~10 minutes
};

// --- STATUS VALUES ---
export const STATUS = {
  uploaded: 'uploaded',
  transcribed: 'transcribed',
  summarized: 'summarized',
  audio_missing: 'audio_missing',
  error: 'error'
};

// --- SHARED STATE KEYS ---
export const STORAGE_KEYS = {
  userId: 'user_id',
  collapsedPrefix: 'vn_collapsed:'
};
