// menus/more-menu.js
/*
  Manage the "More" dropdown menu for a card (open/close/toggle).
  - toggleMoreMenuForCard(cardEl, rec)
  - openMoreMenu(cardEl, rec)
  - closeAllMoreMenus()
*/

import { closeAllCreateMenus } from './create-menu.js';

let _openMoreMenuCard = null;
let _outsideMoreHandler = null;

export function toggleMoreMenuForCard(cardEl, rec) {
  if (!cardEl) return;
  const menu = cardEl.querySelector('.more-menu');
  if (!menu) return;
  const isOpen = menu.getAttribute('data-open') === 'true';
  if (isOpen) {
    closeAllMoreMenus();
  } else {
    closeAllMoreMenus(); // ensure only one open
    closeAllCreateMenus(); // close create menu if open
    openMoreMenu(cardEl, rec);
  }
}

export function openMoreMenu(cardEl, rec) {
  if (!cardEl) return;
  const menu = cardEl.querySelector('.more-menu');
  if (!menu) return;

  menu.setAttribute('aria-hidden', 'false');
  menu.setAttribute('data-open', 'true');
  menu.style.display = 'block';
  menu.classList.add('more-menu-open');
  _openMoreMenuCard = cardEl;

  // focus first actionable option for accessibility without scrolling
  const first = menu.querySelector('.more-option');
  if (first) first.focus({ preventScroll: true });

  // outside click/touch handler -> close if clicking outside the open card/menu
  _outsideMoreHandler = function (ev) {
    if (!_openMoreMenuCard) { closeAllMoreMenus(); return; }
    const menuEl = _openMoreMenuCard.querySelector('.more-menu');
    if (menuEl && (menuEl.contains(ev.target) || _openMoreMenuCard.contains(ev.target))) return;
    closeAllMoreMenus();
  };
  document.addEventListener('click', _outsideMoreHandler, { capture: true });
  document.addEventListener('touchstart', _outsideMoreHandler, { capture: true });

  document.addEventListener('keydown', _moreMenuEscHandler);
}

export function closeAllMoreMenus() {
  const openMenus = document.querySelectorAll('.more-menu');
  openMenus.forEach(m => {
    m.setAttribute('aria-hidden', 'true');
    m.setAttribute('data-open', 'false');
    m.style.display = 'none';
    m.classList.remove('more-menu-open');
  });
  if (_outsideMoreHandler) {
    document.removeEventListener('click', _outsideMoreHandler, { capture: true });
    document.removeEventListener('touchstart', _outsideMoreHandler, { capture: true });
    _outsideMoreHandler = null;
  }
  document.removeEventListener('keydown', _moreMenuEscHandler);
  _openMoreMenuCard = null;
}

function _moreMenuEscHandler(e) {
  if (e.key === 'Escape' || e.key === 'Esc') {
    closeAllMoreMenus();
  }
}
