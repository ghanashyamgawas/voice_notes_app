// menus/create-menu.js
/*
  Manage the "Create" dropdown menu for a card (open/close/toggle).
  - toggleCreateMenuForCard(cardEl, rec)
  - openCreateMenu(cardEl, rec)
  - closeAllCreateMenus()
*/

import { closeAllMoreMenus } from './more-menu.js';

let _openCreateMenuCard = null;
let _outsideCreateHandler = null;

export function toggleCreateMenuForCard(cardEl, rec) {
  if (!cardEl) return;
  const menu = cardEl.querySelector('.create-menu');
  if (!menu) return;
  const isOpen = menu.getAttribute('data-open') === 'true';
  if (isOpen) {
    closeAllCreateMenus();
  } else {
    closeAllCreateMenus(); // ensure only one open
    closeAllMoreMenus(); // close more menu if open
    openCreateMenu(cardEl, rec);
  }
}

export function openCreateMenu(cardEl, rec) {
  if (!cardEl) return;
  const menu = cardEl.querySelector('.create-menu');
  if (!menu) return;
  const menuParent = menu.parentElement;
  if (menuParent) menuParent.style.position = 'relative';

  menu.setAttribute('aria-hidden', 'false');
  menu.setAttribute('data-open', 'true');
  menu.style.display = 'block';
  menu.classList.add('create-menu-open');
  _openCreateMenuCard = cardEl;

  // focus first actionable option for accessibility without scrolling
  const first = menu.querySelector('.create-option');
  if (first) first.focus({ preventScroll: true });

  // outside click/touch handler -> close if clicking outside the open card/menu
  _outsideCreateHandler = function (ev) {
    if (!_openCreateMenuCard) { closeAllCreateMenus(); return; }
    const menuEl = _openCreateMenuCard.querySelector('.create-menu');
    if (menuEl && (menuEl.contains(ev.target) || _openCreateMenuCard.contains(ev.target))) return;
    closeAllCreateMenus();
  };
  document.addEventListener('click', _outsideCreateHandler, { capture: true });
  document.addEventListener('touchstart', _outsideCreateHandler, { capture: true });

  document.addEventListener('keydown', _createMenuEscHandler);
}

export function closeAllCreateMenus() {
  const openMenus = document.querySelectorAll('.create-menu');
  openMenus.forEach(m => {
    m.setAttribute('aria-hidden', 'true');
    m.setAttribute('data-open', 'false');
    m.style.display = 'none';
    m.classList.remove('create-menu-open');
  });
  if (_outsideCreateHandler) {
    document.removeEventListener('click', _outsideCreateHandler, { capture: true });
    document.removeEventListener('touchstart', _outsideCreateHandler, { capture: true });
    _outsideCreateHandler = null;
  }
  document.removeEventListener('keydown', _createMenuEscHandler);
  _openCreateMenuCard = null;
}

function _createMenuEscHandler(e) {
  if (e.key === 'Escape' || e.key === 'Esc') {
    closeAllCreateMenus();
  }
}
