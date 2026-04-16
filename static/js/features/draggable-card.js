// draggable-card.js - Makes the upload card draggable while maintaining its default position

export function initDraggableCard() {
  const uploadCard = document.querySelector('.upload-card-new');

  if (!uploadCard) {
    console.warn('Upload card not found for draggable initialization');
    return;
  }

  // Store the default position
  const defaultPosition = {
    bottom: '12px',
    left: '50%',
    transform: 'translateX(-50%)'
  };

  // Current position tracking
  let currentX = null;
  let currentY = null;
  let initialX = null;
  let initialY = null;
  let isDragging = false;

  // Save position to localStorage
  function savePosition(x, y) {
    localStorage.setItem('uploadCardPosition', JSON.stringify({ x, y }));
  }

  // Load position from localStorage
  function loadPosition() {
    const saved = localStorage.getItem('uploadCardPosition');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  // Apply saved position or default
  function applyPosition() {
    const saved = loadPosition();
    if (saved) {
      uploadCard.style.left = `${saved.x}px`;
      uploadCard.style.top = `${saved.y}px`;
      uploadCard.style.bottom = 'auto';
      uploadCard.style.transform = 'none';
    }
  }

  // Reset to default position
  function resetPosition() {
    uploadCard.style.left = defaultPosition.left;
    uploadCard.style.bottom = defaultPosition.bottom;
    uploadCard.style.top = 'auto';
    uploadCard.style.transform = defaultPosition.transform;
    localStorage.removeItem('uploadCardPosition');
    currentX = null;
    currentY = null;
  }

  // Mouse/Touch start handler
  function handleDragStart(e) {
    // Don't drag if clicking on buttons or inputs
    if (e.target.closest('button') ||
        e.target.closest('input') ||
        e.target.closest('label')) {
      return;
    }

    isDragging = true;
    uploadCard.classList.add('dragging');

    // Get current position
    const rect = uploadCard.getBoundingClientRect();

    if (e.type === 'touchstart') {
      initialX = e.touches[0].clientX - rect.left;
      initialY = e.touches[0].clientY - rect.top;
    } else {
      initialX = e.clientX - rect.left;
      initialY = e.clientY - rect.top;
    }

    // Temporarily switch to absolute positioning during drag
    uploadCard.style.transform = 'none';
    uploadCard.style.left = `${rect.left}px`;
    uploadCard.style.top = `${rect.top}px`;
    uploadCard.style.bottom = 'auto';

    e.preventDefault();
  }

  // Mouse/Touch move handler
  function handleDragMove(e) {
    if (!isDragging) return;

    e.preventDefault();

    let clientX, clientY;
    if (e.type === 'touchmove') {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    // Calculate new position (from top-left corner)
    const newX = clientX - initialX;
    const newY = clientY - initialY;

    // Constrain to viewport
    const maxX = window.innerWidth - uploadCard.offsetWidth;
    const maxY = window.innerHeight - uploadCard.offsetHeight;

    currentX = Math.max(0, Math.min(newX, maxX));
    currentY = Math.max(0, Math.min(newY, maxY));

    // Apply position
    uploadCard.style.left = `${currentX}px`;
    uploadCard.style.top = `${currentY}px`;
  }

  // Mouse/Touch end handler
  function handleDragEnd(e) {
    if (!isDragging) return;

    isDragging = false;
    uploadCard.classList.remove('dragging');

    // Save the final position
    if (currentX !== null && currentY !== null) {
      savePosition(currentX, currentY);
    }

    e.preventDefault();
  }

  // Double-click to reset position
  function handleDoubleClick(e) {
    // Don't reset if double-clicking on buttons or inputs
    if (e.target.closest('button') ||
        e.target.closest('input') ||
        e.target.closest('label')) {
      return;
    }
    resetPosition();
  }

  // Add event listeners for mouse
  uploadCard.addEventListener('mousedown', handleDragStart);
  document.addEventListener('mousemove', handleDragMove);
  document.addEventListener('mouseup', handleDragEnd);

  // Add event listeners for touch
  uploadCard.addEventListener('touchstart', handleDragStart, { passive: false });
  document.addEventListener('touchmove', handleDragMove, { passive: false });
  document.addEventListener('touchend', handleDragEnd);

  // Double-click to reset
  uploadCard.addEventListener('dblclick', handleDoubleClick);

  // Apply saved position on load
  applyPosition();

  // Re-apply position on window resize
  window.addEventListener('resize', () => {
    const saved = loadPosition();
    if (saved) {
      // Constrain to new viewport size
      const maxX = window.innerWidth - uploadCard.offsetWidth;
      const maxY = window.innerHeight - uploadCard.offsetHeight;

      const newX = Math.max(0, Math.min(saved.x, maxX));
      const newY = Math.max(0, Math.min(saved.y, maxY));

      if (newX !== saved.x || newY !== saved.y) {
        savePosition(newX, newY);
        uploadCard.style.left = `${newX}px`;
        uploadCard.style.top = `${newY}px`;
      }
    }
  });

  console.log('Draggable card initialized. Double-click to reset position.');
}
