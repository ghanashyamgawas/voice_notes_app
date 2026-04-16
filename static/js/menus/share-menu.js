// menus/share-menu.js
/*
  Manages:
    - toggleShareMenuForCard(cardEl, rec)
    - openShareMenu(cardEl, rec)
    - closeAllShareMenus()

  Responsibilities:
    - open/close share menu dropdown inside a card
    - handle outside clicks, ESC key, scroll/resize dismissal
*/

let _openShareMenuCard = null;
let _outsideShareHandler = null;
let _dismissOnScrollOrResize = null;

export function toggleShareMenuForCard(cardEl, rec) {
  if (!cardEl) return;
  const menu = cardEl.querySelector('.share-menu');
  if (!menu) return;
  const isOpen = menu.getAttribute('data-open') === 'true';
  if (isOpen) {
    closeAllShareMenus();
  } else {
    closeAllShareMenus(); // ensure only one open
    openShareMenu(cardEl, rec);
  }
}

export function openShareMenu(cardEl, rec) {
  if (!cardEl) return;
  const menu = cardEl.querySelector('.share-menu');
  if (!menu) return;

  menu.setAttribute('aria-hidden', 'false');
  menu.setAttribute('data-open', 'true');
  menu.style.display = 'block';
  _openShareMenuCard = cardEl;

  // Style and positioning same as original
  menu.style.position = 'absolute';
  menu.style.right = '16px';
  menu.style.bottom = '56px';
  menu.style.zIndex = 600;

  menu.classList.add('share-menu-open');

  const first = menu.querySelector('.share-option');
  if (first) first.focus();

  _outsideShareHandler = function (ev) {
    if (!_openShareMenuCard) { closeAllShareMenus(); return; }
    const menuEl = _openShareMenuCard.querySelector('.share-menu');
    if (menuEl && (menuEl.contains(ev.target) || _openShareMenuCard.contains(ev.target))) return;
    closeAllShareMenus();
  };
  document.addEventListener('click', _outsideShareHandler, { capture: true });
  document.addEventListener('touchstart', _outsideShareHandler, { capture: true });

  document.addEventListener('keydown', _shareMenuEscHandler);

  // Also close on scroll or resize (for dynamic layouts)
  _dismissOnScrollOrResize = function () { closeAllShareMenus(); };
  window.addEventListener('scroll', _dismissOnScrollOrResize, { passive: true });
  window.addEventListener('resize', _dismissOnScrollOrResize);
}

export function closeAllShareMenus() {
  const openMenus = document.querySelectorAll('.share-menu');
  openMenus.forEach(m => {
    m.setAttribute('aria-hidden', 'true');
    m.setAttribute('data-open', 'false');
    m.style.display = 'none';
    m.classList.remove('share-menu-open');
  });

  if (_outsideShareHandler) {
    document.removeEventListener('click', _outsideShareHandler, { capture: true });
    document.removeEventListener('touchstart', _outsideShareHandler, { capture: true });
    _outsideShareHandler = null;
  }

  document.removeEventListener('keydown', _shareMenuEscHandler);

  if (_dismissOnScrollOrResize) {
    window.removeEventListener('scroll', _dismissOnScrollOrResize);
    window.removeEventListener('resize', _dismissOnScrollOrResize);
    _dismissOnScrollOrResize = null;
  }

  _openShareMenuCard = null;
}

function _shareMenuEscHandler(e) {
  if (e.key === 'Escape' || e.key === 'Esc') {
    closeAllShareMenus();
  }
}
