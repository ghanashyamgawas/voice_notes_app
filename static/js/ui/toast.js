// ui/toast.js
/*
  Toast notifications for copy feedback or quick status messages.

  Exports:
    - _showCopyToast(message, duration)
  (Matches the helper used in copy-actions.js and other modules)
*/

let __copyToast = null;
let __copyToastTimeout = null;

export function _showCopyToast(msg, duration = 1800) {
  try {
    if (!__copyToast) {
      __copyToast = document.createElement('div');
      __copyToast.className = 'toast';
      __copyToast.style.position = 'fixed';
      __copyToast.style.right = '20px';
      __copyToast.style.bottom = '20px';
      __copyToast.style.padding = '10px 14px';
      __copyToast.style.background = 'rgba(17,24,39,0.95)';
      __copyToast.style.color = '#fff';
      __copyToast.style.borderRadius = '10px';
      __copyToast.style.zIndex = '1200';
      __copyToast.style.display = 'flex';
      __copyToast.style.alignItems = 'center';
      __copyToast.style.gap = '8px';
      __copyToast.style.transition = 'opacity .2s ease, transform .2s ease';
      document.body.appendChild(__copyToast);
    }

    __copyToast.textContent = msg;
    __copyToast.style.opacity = '1';
    __copyToast.style.transform = 'translateY(0)';

    if (__copyToastTimeout) clearTimeout(__copyToastTimeout);
    __copyToastTimeout = setTimeout(() => {
      if (__copyToast) __copyToast.style.opacity = '0';
    }, duration);
  } catch (e) {
    console.warn('Toast failed', e);
  }
}
