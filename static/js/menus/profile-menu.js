// menus/profile-menu.js
/*
  Profile dropdown menu management.
  - initProfileMenu()
    Attaches toggle and outside-click logic to profile menu.
*/

import { logout } from '../auth/auth.js';

export function initProfileMenu() {
  const profileBtn = document.getElementById('profileBtn');
  const dropdownMenu = document.getElementById('dropdownMenu');
  const logoutOptionEl = document.getElementById('logoutOption');
  const profileOptionEl = document.getElementById('profileOption');

  if (!profileBtn || !dropdownMenu) return;

  // toggle dropdown visibility
  profileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdownMenu.style.display = dropdownMenu.style.display === 'block' ? 'none' : 'block';
  });

  // hide dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!profileBtn.contains(e.target) && !dropdownMenu.contains(e.target)) {
      dropdownMenu.style.display = 'none';
    }
  });

  // bind logout
  if (logoutOptionEl) {
    logoutOptionEl.addEventListener('click', (e) => {
      e.preventDefault();
      logout();
    });
  }

  // profile option (currently just logs, placeholder for future)
  if (profileOptionEl) {
    profileOptionEl.addEventListener('click', () => {
      console.log('Profile clicked');
      alert('Profile section coming soon!');
    });
  }
}
