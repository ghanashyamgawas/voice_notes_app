// ui/ask-ai-modal.js
/*
  Ask AI Modal - Shows a modal with tabs (Ask/Create) and a list of notes to select from
*/

import { getUserId } from '../auth/auth.js';

export function openAskAiModal() {
  // Get all recordings from cache
  const recordings = window.VN_STATE.recsCache || [];

  if (recordings.length === 0) {
    alert('No recordings available. Please create a recording first.');
    return;
  }

  // Track active chat state
  let activeChatRecIds = [];
  let chatHistory = [];
  let currentHistoryId = null; // Track if this is a restored chat

  // Create modal overlay
  const overlay = document.createElement('div');
  overlay.className = 'ask-ai-modal-overlay';

  // Create modal container
  const modal = document.createElement('div');
  modal.className = 'ask-ai-modal';

  // Create modal header with tabs and close button
  const header = document.createElement('div');
  header.className = 'ask-ai-modal-header';

  // History icon button (top left)
  const historyBtn = document.createElement('button');
  historyBtn.className = 'ask-ai-history-btn';
  historyBtn.type = 'button';
  historyBtn.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"></circle>
      <polyline points="12 6 12 12 16 14"></polyline>
    </svg>
  `;

  // Tab buttons
  const tabsContainer = document.createElement('div');
  tabsContainer.className = 'ask-ai-tabs';

  const askTab = document.createElement('button');
  askTab.className = 'ask-ai-tab active';
  askTab.textContent = 'Ask';
  askTab.type = 'button';

  const createTab = document.createElement('button');
  createTab.className = 'ask-ai-tab';
  createTab.textContent = 'Create';
  createTab.type = 'button';

  tabsContainer.appendChild(askTab);
  tabsContainer.appendChild(createTab);

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.className = 'ask-ai-modal-close';
  closeBtn.type = 'button';
  closeBtn.innerHTML = '&times;';

  header.appendChild(historyBtn);
  header.appendChild(tabsContainer);
  header.appendChild(closeBtn);

  // Create dropdown button container (centered, small)
  const dropdownContainer = document.createElement('div');
  dropdownContainer.className = 'ask-ai-dropdown-container';

  const recentNotesBtn = document.createElement('button');
  recentNotesBtn.className = 'ask-ai-dropdown-btn';
  recentNotesBtn.innerHTML = `
    <span class="ask-ai-dropdown-btn-text">recent notes</span>
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  `;
  recentNotesBtn.type = 'button';

  dropdownContainer.appendChild(recentNotesBtn);

  // Create active titles container (shows selected titles with close buttons)
  const activeTitlesContainer = document.createElement('div');
  activeTitlesContainer.className = 'ask-ai-active-titles';
  activeTitlesContainer.style.display = 'none';

  // Create dropdown content (search + notes list) - hidden by default
  const dropdownContent = document.createElement('div');
  dropdownContent.className = 'ask-ai-dropdown-content';
  dropdownContent.style.display = 'none';

  // Create search input
  const searchContainer = document.createElement('div');
  searchContainer.className = 'ask-ai-search-container';

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.className = 'ask-ai-search-input';
  searchInput.placeholder = 'Search notes';

  const searchIcon = document.createElement('span');
  searchIcon.className = 'ask-ai-search-icon';
  searchIcon.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#999" stroke-width="2">
      <circle cx="11" cy="11" r="8"></circle>
      <path d="m21 21-4.35-4.35"></path>
    </svg>
  `;

  searchContainer.appendChild(searchIcon);
  searchContainer.appendChild(searchInput);

  // Create notes list
  const notesList = document.createElement('div');
  notesList.className = 'ask-ai-notes-list';

  // Add checkboxes for each recording
  recordings.forEach((rec, index) => {
    const noteItem = document.createElement('label');
    noteItem.className = 'ask-ai-note-item';
    noteItem.dataset.recId = rec.id;
    noteItem.dataset.index = index;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'ask-ai-note-checkbox';
    checkbox.dataset.recId = rec.id;

    const noteTitle = document.createElement('span');
    noteTitle.className = 'ask-ai-note-title';
    noteTitle.textContent = rec.title || 'Untitled Recording';

    noteItem.appendChild(checkbox);
    noteItem.appendChild(noteTitle);
    notesList.appendChild(noteItem);

    // By default, show only recent notes (first 5)
    if (index >= 5) {
      noteItem.style.display = 'none';
      noteItem.dataset.filter = 'all';
    } else {
      noteItem.dataset.filter = 'recent';
    }
  });

  // Show more notes link
  const showMoreLink = document.createElement('a');
  showMoreLink.href = '#';
  showMoreLink.className = 'ask-ai-show-more';
  showMoreLink.textContent = 'Show more notes';

  // Hide if there are 5 or fewer notes
  if (recordings.length <= 5) {
    showMoreLink.style.display = 'none';
  }

  showMoreLink.addEventListener('click', (e) => {
    e.preventDefault();

    // Show all notes
    const noteItems = notesList.querySelectorAll('.ask-ai-note-item');
    noteItems.forEach(item => {
      item.style.display = 'flex';
    });

    // Hide this link
    showMoreLink.style.display = 'none';
  });

  // Add "All notes" item at the bottom
  const allNotesItem = document.createElement('label');
  allNotesItem.className = 'ask-ai-note-item ask-ai-all-notes-item';

  const allNotesCheckbox = document.createElement('input');
  allNotesCheckbox.type = 'checkbox';
  allNotesCheckbox.className = 'ask-ai-note-checkbox';
  allNotesCheckbox.id = 'all-notes-checkbox';

  const allNotesTitle = document.createElement('span');
  allNotesTitle.className = 'ask-ai-note-title';
  allNotesTitle.textContent = 'All notes';

  allNotesItem.appendChild(allNotesCheckbox);
  allNotesItem.appendChild(allNotesTitle);

  // Function to update the recent notes button text
  function updateRecentNotesButtonText() {
    const noteCheckboxes = Array.from(notesList.querySelectorAll('.ask-ai-note-checkbox'));
    const checkedBoxes = noteCheckboxes.filter(cb => cb.checked);
    const checkedCount = checkedBoxes.length;

    // Get button text span
    const buttonTextSpan = recentNotesBtn.querySelector('.ask-ai-dropdown-btn-text');

    if (checkedCount === 0) {
      // No selection
      if (buttonTextSpan) buttonTextSpan.textContent = 'recent notes';
    } else if (checkedCount === 1) {
      // One item selected - show the title
      const selectedCheckbox = checkedBoxes[0];
      const selectedItem = selectedCheckbox.closest('.ask-ai-note-item');
      const titleText = selectedItem.querySelector('.ask-ai-note-title').textContent;
      if (buttonTextSpan) buttonTextSpan.textContent = titleText;
    } else if (checkedCount === recordings.length || allNotesCheckbox.checked) {
      // All notes selected
      if (buttonTextSpan) buttonTextSpan.textContent = 'All notes';
    } else {
      // Multiple items selected
      if (buttonTextSpan) buttonTextSpan.textContent = `${checkedCount} notes`;
    }
  }

  // Add click handler for "All notes" checkbox
  allNotesCheckbox.addEventListener('change', (e) => {
    const isChecked = e.target.checked;
    const noteCheckboxes = notesList.querySelectorAll('.ask-ai-note-checkbox');

    noteCheckboxes.forEach(cb => {
      cb.checked = isChecked;
    });

    updateRecentNotesButtonText();
  });

  // Add change listeners to all note checkboxes
  const allNoteCheckboxes = notesList.querySelectorAll('.ask-ai-note-checkbox');
  allNoteCheckboxes.forEach(cb => {
    cb.addEventListener('change', () => {
      // Check if all individual notes are selected
      const allChecked = Array.from(allNoteCheckboxes).every(checkbox => checkbox.checked);
      allNotesCheckbox.checked = allChecked;

      updateRecentNotesButtonText();
    });
  });

  // Create footer with info text
  const footer = document.createElement('div');
  footer.className = 'ask-ai-modal-footer';
  footer.innerHTML = `
    <p class="ask-ai-info-text">
      Total notes: ${recordings.length}
    </p>
  `;

  // Create input section
  const inputSection = document.createElement('div');
  inputSection.className = 'ask-ai-input-section';

  const inputContainer = document.createElement('div');
  inputContainer.className = 'ask-ai-input-container';

  const menuBtn = document.createElement('button');
  menuBtn.className = 'ask-ai-menu-btn';
  menuBtn.type = 'button';
  menuBtn.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <line x1="3" y1="12" x2="21" y2="12"></line>
      <line x1="3" y1="6" x2="21" y2="6"></line>
      <line x1="3" y1="18" x2="21" y2="18"></line>
    </svg>
  `;

  const questionInput = document.createElement('input');
  questionInput.type = 'text';
  questionInput.className = 'ask-ai-question-input';
  questionInput.placeholder = 'Ask a question';

  // inputContainer.appendChild(menuBtn);
  inputContainer.appendChild(questionInput);
  inputSection.appendChild(inputContainer);

  // Create chat display area (hidden by default)
  const chatSection = document.createElement('div');
  chatSection.className = 'ask-ai-chat-section';
  chatSection.style.display = 'none';

  const chatMessages = document.createElement('div');
  chatMessages.className = 'ask-ai-chat-messages';
  chatMessages.id = 'ask-ai-chat-messages';

  chatSection.appendChild(chatMessages);

  // Assemble dropdown content
  dropdownContent.appendChild(searchContainer);
  dropdownContent.appendChild(notesList);
  dropdownContent.appendChild(showMoreLink);
  dropdownContent.appendChild(allNotesItem);

  // Create page content (for Create tab)
  const createPageSection = document.createElement('div');
  createPageSection.className = 'ask-ai-create-page';
  createPageSection.style.display = 'none';

  const createPageContent = document.createElement('div');
  createPageContent.className = 'ask-ai-create-content';

  // Step 1: What do you want to create?
  const step1 = document.createElement('div');
  step1.className = 'create-step';
  step1.innerHTML = `
    <div class="create-step-header">
      <span class="create-step-number">1</span>
      <h3 class="create-step-title">What do you want to create?</h3>
    </div>
    <div class="create-options">
      <button class="create-option-btn" data-option="summary">Summary</button>
      <button class="create-option-btn" data-option="meeting-report">Meeting Report</button>
      <button class="create-option-btn" data-option="todo">To-do list</button>
      <button class="create-option-btn" data-option="email">Email</button>
      <button class="create-option-btn" data-option="main-points">Main points</button>
      <button class="create-option-btn" data-option="cleanup">Cleanup</button>
    </div>
  `;

  // Step 2: Select the note(s) to create with
  const step2 = document.createElement('div');
  step2.className = 'create-step';
  step2.innerHTML = `
    <div class="create-step-header">
      <span class="create-step-number">2</span>
      <h3 class="create-step-title">Select the note(s) to create with</h3>
    </div>
    <div class="create-notes-list" id="create-notes-list">
      <!-- Notes checkboxes will be added here -->
    </div>
  `;

  // Add notes checkboxes
  const createNotesList = step2.querySelector('#create-notes-list');
  recordings.forEach(rec => {
    const noteItem = document.createElement('label');
    noteItem.className = 'create-note-item';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'create-note-checkbox';
    checkbox.dataset.recId = rec.id;

    const noteTitle = document.createElement('span');
    noteTitle.className = 'create-note-title';
    noteTitle.textContent = rec.title || 'Untitled Recording';

    noteItem.appendChild(checkbox);
    noteItem.appendChild(noteTitle);
    createNotesList.appendChild(noteItem);
  });

  // Step 3: Create button
  const step3 = document.createElement('div');
  step3.className = 'create-step';
  step3.innerHTML = `
    <div class="create-step-header">
      <span class="create-step-number">3</span>
    </div>
    <button class="create-submit-btn" type="button">Create</button>
  `;

  // Create loading screen
  const createLoadingSection = document.createElement('div');
  createLoadingSection.className = 'ask-ai-create-loading';
  createLoadingSection.style.display = 'none';

  createPageContent.appendChild(step1);
  createPageContent.appendChild(step2);
  createPageContent.appendChild(step3);

  createPageSection.appendChild(createPageContent);
  createPageSection.appendChild(createLoadingSection);

  // Create page option buttons functionality
  const createOptionBtns = createPageContent.querySelectorAll('.create-option-btn');
  const createSubmitBtn = createPageContent.querySelector('.create-submit-btn');
  let selectedOption = null;

  // Option name mapping for button text
  const optionNames = {
    'summary': 'Summary',
    'meeting-report': 'Meeting Report',
    'todo': 'To-do list',
    'email': 'Email',
    'main-points': 'Main points',
    'cleanup': 'Cleanup'
  };

  createOptionBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Remove active class from all buttons
      createOptionBtns.forEach(b => b.classList.remove('active'));

      // Add active class to clicked button
      btn.classList.add('active');
      selectedOption = btn.dataset.option;

      // Update Create button text
      if (selectedOption && optionNames[selectedOption]) {
        createSubmitBtn.textContent = `Create ${optionNames[selectedOption]}`;
      } else {
        createSubmitBtn.textContent = 'Create';
      }
    });
  });

  // Handle Create button click
  createSubmitBtn.addEventListener('click', async () => {
    // Validate selection
    if (!selectedOption) {
      alert('Please select what you want to create.');
      return;
    }

    // Get selected notes
    const selectedNotes = Array.from(createPageContent.querySelectorAll('.create-note-checkbox:checked'));
    if (selectedNotes.length === 0) {
      alert('Please select at least one note.');
      return;
    }

    const selectedRecIds = selectedNotes.map(cb => cb.dataset.recId);
    const optionName = optionNames[selectedOption] || 'content';

    // Show loading screen
    createLoadingSection.innerHTML = `
      <div class="create-loading-content">
        <h2 class="create-loading-title">${optionName}</h2>
        <div class="create-loading-message">
          <svg class="create-loading-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M9 12l2 2 4-4"></path>
          </svg>
          <span class="create-loading-text">Creating a ${optionName.toLowerCase()} from your note</span>
          <span class="create-loading-dots">
            <span>.</span><span>.</span><span>.</span>
          </span>
        </div>
      </div>
    `;

    createPageContent.style.display = 'none';
    createLoadingSection.style.display = 'flex';

    try {
      // Make API call to create content
      const response = await fetch('/create_content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          option: selectedOption,
          rec_ids: selectedRecIds
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create content');
      }

      // Show result
      createLoadingSection.innerHTML = `
        <div class="create-result-content">
          <h2 class="create-result-title">${optionName}</h2>
          <div class="create-result-box">
            ${result.result}
          </div>
          <div class="create-result-actions">
            <button class="create-copy-btn" type="button">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              Copy
            </button>
            <button class="create-new-btn" type="button">Create New</button>
          </div>
        </div>
      `;

      // Add handler for "Copy" button
      const copyBtn = createLoadingSection.querySelector('.create-copy-btn');
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(result.result);
          // Show feedback
          const originalText = copyBtn.innerHTML;
          copyBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            Copied!
          `;
          copyBtn.style.background = '#22c55e';
          copyBtn.style.color = 'white';

          setTimeout(() => {
            copyBtn.innerHTML = originalText;
            copyBtn.style.background = '';
            copyBtn.style.color = '';
          }, 2000);
        } catch (err) {
          console.error('Failed to copy:', err);
          alert('Failed to copy to clipboard');
        }
      });

      // Add handler for "Create New" button
      const createNewBtn = createLoadingSection.querySelector('.create-new-btn');
      createNewBtn.addEventListener('click', () => {
        // Reset selections
        createOptionBtns.forEach(b => b.classList.remove('active'));
        const checkboxes = createPageContent.querySelectorAll('.create-note-checkbox');
        checkboxes.forEach(cb => cb.checked = false);
        selectedOption = null;
        createSubmitBtn.textContent = 'Create';

        // Show create form again
        createPageContent.style.display = 'block';
        createLoadingSection.style.display = 'none';
      });

    } catch (error) {
      console.error('Error creating:', error);

      createLoadingSection.innerHTML = `
        <div class="create-result-content">
          <h2 class="create-result-title">Error</h2>
          <div class="create-result-box create-error">
            ${error.message || 'Failed to create. Please try again.'}
          </div>
          <button class="create-new-btn" type="button">Try Again</button>
        </div>
      `;

      const tryAgainBtn = createLoadingSection.querySelector('.create-new-btn');
      tryAgainBtn.addEventListener('click', () => {
        createPageContent.style.display = 'block';
        createLoadingSection.style.display = 'none';
      });
    }
  });

  // Create a content wrapper to hold dropdown and chat sections
  const contentWrapper = document.createElement('div');
  contentWrapper.className = 'ask-ai-content-wrapper';
  contentWrapper.appendChild(dropdownContainer);
  contentWrapper.appendChild(activeTitlesContainer);
  contentWrapper.appendChild(dropdownContent);
  contentWrapper.appendChild(chatSection);
  contentWrapper.appendChild(createPageSection);

  // Assemble modal
  modal.appendChild(header);
  modal.appendChild(contentWrapper);
  modal.appendChild(footer);
  modal.appendChild(inputSection);
  overlay.appendChild(modal);

  // Function to close modal with cleanup
  const closeModal = async () => {
    await saveAllActiveChats();
    window.removeEventListener('beforeunload', handleBeforeUnload);
    document.body.removeChild(overlay);
    // Re-enable body scrolling
    document.body.style.overflow = '';
  };

  // Event handlers (will be defined after handleBeforeUnload)
  let handleBeforeUnload;

  // Tab switching
  askTab.addEventListener('click', () => {
    askTab.classList.add('active');
    createTab.classList.remove('active');

    // Show Ask tab content, hide Create tab content
    createPageSection.style.display = 'none';

    // Show footer, input section, and history button for Ask tab
    footer.style.display = 'block';
    inputSection.style.display = 'block';
    historyBtn.style.display = 'flex';

    // Show appropriate Ask tab content based on state
    if (activeChatRecIds.length > 0) {
      // Show active chat
      activeTitlesContainer.style.display = 'flex';
      chatSection.style.display = 'block';
      dropdownContainer.style.display = 'none';
      dropdownContent.style.display = 'none';
    } else {
      // Show dropdown
      dropdownContainer.style.display = 'flex';
      activeTitlesContainer.style.display = 'none';
      chatSection.style.display = 'none';
    }
  });

  createTab.addEventListener('click', () => {
    createTab.classList.add('active');
    askTab.classList.remove('active');

    // Hide Ask tab content
    dropdownContainer.style.display = 'none';
    dropdownContent.style.display = 'none';
    activeTitlesContainer.style.display = 'none';
    chatSection.style.display = 'none';

    // Hide footer, input section, and history button for Create tab
    footer.style.display = 'none';
    inputSection.style.display = 'none';
    historyBtn.style.display = 'none';

    // Show Create tab content
    createPageSection.style.display = 'block';
  });

  // Function to close dropdown
  function closeDropdown() {
    dropdownContent.style.display = 'none';
    recentNotesBtn.classList.remove('active');
  }

  // Function to open dropdown
  function openDropdown() {
    dropdownContent.style.display = 'block';
    recentNotesBtn.classList.add('active');

    // Show only recent notes (first 5)
    const noteItems = notesList.querySelectorAll('.ask-ai-note-item');
    noteItems.forEach((item, index) => {
      if (index < 5) {
        item.style.display = 'flex';
      } else {
        item.style.display = 'none';
      }
    });

    // Show the "Show more notes" link
    if (recordings.length > 5) {
      showMoreLink.style.display = 'block';
    }
  }

  // Dropdown toggle functionality
  recentNotesBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = dropdownContent.style.display === 'block';

    if (isOpen) {
      closeDropdown();
    } else {
      openDropdown();
    }
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    const isClickInsideDropdown = dropdownContent.contains(e.target);
    const isClickOnButton = recentNotesBtn.contains(e.target);

    if (!isClickInsideDropdown && !isClickOnButton && dropdownContent.style.display === 'block') {
      closeDropdown();
    }
  });

  // Close dropdown when clicking on the question input
  questionInput.addEventListener('focus', () => {
    if (dropdownContent.style.display === 'block') {
      closeDropdown();
    }
  });

  // Search functionality
  searchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const noteItems = notesList.querySelectorAll('.ask-ai-note-item');

    noteItems.forEach(item => {
      const title = item.querySelector('.ask-ai-note-title').textContent.toLowerCase();
      if (title.includes(searchTerm)) {
        item.style.display = 'flex';
      } else {
        item.style.display = 'none';
      }
    });
  });

  // Helper functions for chat messages
  function addUserMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'ask-ai-chat-message ask-ai-chat-message-user';
    messageDiv.innerHTML = `
      <div class="ask-ai-chat-bubble ask-ai-chat-bubble-user">
        <p>${escapeHtml(text)}</p>
      </div>
    `;
    chatMessages.appendChild(messageDiv);
    scrollChatToBottom();
  }

  function addAIMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'ask-ai-chat-message ask-ai-chat-message-ai';
    messageDiv.innerHTML = `
      <div class="ask-ai-chat-bubble ask-ai-chat-bubble-ai">
        <p>${escapeHtml(text)}</p>
      </div>
    `;
    chatMessages.appendChild(messageDiv);
    scrollChatToBottom();
  }

  function addLoadingMessage() {
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'ask-ai-chat-message ask-ai-chat-message-ai ask-ai-chat-loading';
    loadingDiv.id = 'ask-ai-loading-message';
    loadingDiv.innerHTML = `
      <div class="ask-ai-chat-bubble ask-ai-chat-bubble-ai">
        <div class="ask-ai-chat-loading-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    `;
    chatMessages.appendChild(loadingDiv);
    scrollChatToBottom();
  }

  function removeLoadingMessage() {
    const loadingEl = document.getElementById('ask-ai-loading-message');
    if (loadingEl) loadingEl.remove();
  }

  function scrollChatToBottom() {
    setTimeout(() => {
      chatMessages.scrollTop = chatMessages.scrollHeight;
      console.log('Scrolling chat - scrollTop:', chatMessages.scrollTop, 'scrollHeight:', chatMessages.scrollHeight);
    }, 100);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.replace(/\n/g, '<br>');
  }

  // Function to show active titles with close buttons
  function showActiveTitles(selectedRecIds) {
    activeTitlesContainer.innerHTML = '';
    activeTitlesContainer.style.display = 'flex';

    selectedRecIds.forEach(recId => {
      const recording = recordings.find(r => r.id === recId);
      if (!recording) return;

      const titleChip = document.createElement('div');
      titleChip.className = 'ask-ai-active-title-chip';
      titleChip.dataset.recId = recId;

      const titleText = document.createElement('span');
      titleText.className = 'ask-ai-active-title-text';
      titleText.textContent = recording.title || 'Untitled Recording';

      const closeBtn = document.createElement('button');
      closeBtn.className = 'ask-ai-active-title-close';
      closeBtn.type = 'button';
      closeBtn.innerHTML = '&times;';

      closeBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await closeTitleChat(recId);
      });

      titleChip.appendChild(titleText);
      titleChip.appendChild(closeBtn);
      activeTitlesContainer.appendChild(titleChip);
    });

    // Hide dropdown button, show active titles
    dropdownContainer.style.display = 'none';
  }

  // Function to generate appropriate title based on selected recordings
  function generateChatTitle() {
    if (activeChatRecIds.length === 0) {
      return 'Untitled Chat';
    } else if (activeChatRecIds.length === 1) {
      // Single note - use its title
      const recording = recordings.find(r => r.id === activeChatRecIds[0]);
      return recording ? (recording.title || 'Untitled Recording') : 'Untitled Chat';
    } else if (activeChatRecIds.length === recordings.length) {
      // All notes selected
      return 'All Notes';
    } else {
      // Multiple notes selected
      return `${activeChatRecIds.length} Notes`;
    }
  }

  // Function to close a title chat and save to history
  async function closeTitleChat(recId) {
    const recording = recordings.find(r => r.id === recId);
    if (!recording) return;

    // Save current chat to history
    if (chatHistory.length > 0) {
      const userId = getUserId();
      const chatData = {
        id: currentHistoryId || null,  // Let backend generate UUID if no existing ID
        user_id: userId,
        recId: recId,
        title: generateChatTitle(),  // Use dynamic title based on selection
        messages: [...chatHistory],
        timestamp: new Date().toISOString()
      };

      // Save to database
      await saveChatToHistory(chatData);
    }

    // Remove from active chats
    activeChatRecIds = activeChatRecIds.filter(id => id !== recId);

    if (activeChatRecIds.length === 0) {
      // No more active chats, reset UI
      activeTitlesContainer.style.display = 'none';
      activeTitlesContainer.innerHTML = '';
      dropdownContainer.style.display = 'flex';
      chatSection.style.display = 'none';
      chatMessages.innerHTML = '';
      chatHistory = [];
      currentHistoryId = null; // Reset history ID

      // Uncheck all checkboxes
      const allCheckboxes = notesList.querySelectorAll('.ask-ai-note-checkbox');
      allCheckboxes.forEach(cb => {
        cb.checked = false;
        cb.disabled = false;
      });
      allNotesCheckbox.checked = false;
      updateRecentNotesButtonText();
    } else {
      // Remove the title chip
      const titleChip = activeTitlesContainer.querySelector(`[data-rec-id="${recId}"]`);
      if (titleChip) titleChip.remove();
    }
  }

  // Function to save chat to server history
  async function saveChatToHistory(chatData) {
    try {
      console.log('[Ask AI] Saving chat history:', chatData);
      const response = await fetch('/header_ask_ai_history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(chatData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[Ask AI] Failed to save chat history to server:', response.status, errorData);
        return null;
      } else {
        const result = await response.json();
        console.log('[Ask AI] Chat history saved successfully:', result);
        return result.result;  // Return the saved chat object from the backend
      }
    } catch (e) {
      console.error('[Ask AI] Error saving chat history:', e);
      return null;
    }
  }

  // Function to save all active chats before closing
  async function saveAllActiveChats() {
    if (activeChatRecIds.length === 0 || chatHistory.length === 0) {
      return;
    }

    // Get the first recording (we're currently chatting with it)
    const firstRecId = activeChatRecIds[0];
    const recording = recordings.find(r => r.id === firstRecId);

    if (!recording) return;

    const userId = getUserId();
    const chatData = {
      id: currentHistoryId || null,  // Let backend generate UUID if no existing ID
      user_id: userId,
      recId: firstRecId,
      title: generateChatTitle(),  // Use dynamic title based on selection
      messages: [...chatHistory],
      timestamp: new Date().toISOString()
    };

    // Save and update currentHistoryId if it was newly created
    const savedChat = await saveChatToHistory(chatData);
    if (savedChat && savedChat.id && !currentHistoryId) {
      currentHistoryId = savedChat.id;
    }
  }

  // Handle note selection - just keep checkboxes selectable
  const checkboxes = notesList.querySelectorAll('.ask-ai-note-checkbox');

  // Handle question submission
  async function submitQuestion() {
    const question = questionInput.value.trim();

    if (!question) {
      alert('Please enter a question.');
      return;
    }

    // If this is the first question, lock selected titles
    if (activeChatRecIds.length === 0) {
      // Check if this is a legacy chat being viewed
      if (currentHistoryId) {
        alert('This is a legacy chat without an associated note. Please start a new chat by selecting a note from the dropdown.');
        return;
      }

      // Get selected notes
      const selectedCheckboxes = Array.from(checkboxes).filter(cb => cb.checked);

      if (selectedCheckboxes.length === 0) {
        alert('Please select at least one note to ask a question about.');
        return;
      }

      // Lock these titles and show with close buttons
      activeChatRecIds = selectedCheckboxes.map(cb => cb.dataset.recId);
      showActiveTitles(activeChatRecIds);

      // Disable all checkboxes
      const allCheckboxes = notesList.querySelectorAll('.ask-ai-note-checkbox');
      allCheckboxes.forEach(cb => {
        cb.disabled = true;
      });
      allNotesCheckbox.disabled = true;
    }

    // Use all selected notes (fixed to include all selected transcripts)
    const firstRecId = activeChatRecIds[0];
    const recording = recordings.find(r => r.id === firstRecId);

    if (!recording) {
      alert('Recording not found.');
      return;
    }

    // Show chat section and close dropdown
    chatSection.style.display = 'block';
    dropdownContainer.style.display = 'none';
    closeDropdown();

    console.log('Chat section display:', chatSection.style.display);
    console.log('Chat messages container:', chatMessages);
    console.log('Selected recording IDs:', activeChatRecIds);

    // Add user message
    addUserMessage(question);

    // Add to chat history
    chatHistory.push({
      type: 'user',
      text: question,
      timestamp: new Date().toISOString()
    });

    // Clear the question input
    questionInput.value = '';

    // Show loading message
    addLoadingMessage();

    try {
      // Send question to API with ALL selected recording IDs
      // The backend will combine all transcripts before answering
      const response = await fetch(`/ask_ai/${encodeURIComponent(firstRecId)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          question,
          save_to_server: false,  // Header Ask AI uses localStorage, not server history
          rec_ids: activeChatRecIds  // Send ALL selected recording IDs
        })
      });

      removeLoadingMessage();

      if (!response.ok) {
        throw new Error('Failed to get answer');
      }

      const data = await response.json();
      const answer = data.answer || 'No answer received.';

      // Display the answer
      addAIMessage(answer);

      // Add to chat history
      chatHistory.push({
        type: 'ai',
        text: answer,
        timestamp: new Date().toISOString()
      });

      // Auto-save chat history after each response
      await saveAllActiveChats();

    } catch (error) {
      console.error('Error asking question:', error);
      removeLoadingMessage();
      const errorMsg = 'Failed to get answer. Please try again.';
      addAIMessage(errorMsg);

      // Add error to chat history
      chatHistory.push({
        type: 'ai',
        text: errorMsg,
        timestamp: new Date().toISOString()
      });

      // Auto-save chat history even on error
      await saveAllActiveChats();
    }
  }

  // Handle Enter key on question input
  questionInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitQuestion();
    }
  });

  // History button click handler
  historyBtn.addEventListener('click', () => {
    openHistoryModal();
  });

  // Function to group history by date
  function groupHistoryByDate(history) {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const groups = {
      today: [],
      yesterday: [],
      older: []
    };

    history.forEach(item => {
      const itemDate = new Date(item.updated_at || item.created_at || item.timestamp);
      const itemDateStr = itemDate.toDateString();

      if (itemDateStr === today.toDateString()) {
        groups.today.push(item);
      } else if (itemDateStr === yesterday.toDateString()) {
        groups.yesterday.push(item);
      } else {
        groups.older.push(item);
      }
    });

    return groups;
  }

  // Function to open history sidebar
  async function openHistoryModal() {
    let history = [];
    try {
      const userId = getUserId();
      const url = userId
        ? `/header_ask_ai_history?user_id=${encodeURIComponent(userId)}`
        : '/header_ask_ai_history';

      console.log('[Ask AI] Loading chat history for user:', userId);
      console.log('[Ask AI] Fetching from URL:', url);

      const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store'
      });

      console.log('[Ask AI] Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('[Ask AI] Received history data:', data);
        history = data.history || [];
        console.log('[Ask AI] History array length:', history.length);
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('[Ask AI] Failed to load history:', response.status, errorData);
      }
    } catch (e) {
      console.error('[Ask AI] Error loading chat history:', e);
    }

    if (history.length === 0) {
      alert('No chat history available.');
      return;
    }

    // Create sidebar overlay
    const sidebarOverlay = document.createElement('div');
    sidebarOverlay.className = 'ask-ai-sidebar-overlay';

    // Create sidebar
    const sidebar = document.createElement('div');
    sidebar.className = 'ask-ai-sidebar';

    // Header
    const sidebarHeader = document.createElement('div');
    sidebarHeader.className = 'ask-ai-sidebar-header';

    const sidebarTitle = document.createElement('h3');
    sidebarTitle.textContent = 'History';
    sidebarTitle.style.margin = '0';
    sidebarTitle.style.fontSize = '18px';
    sidebarTitle.style.fontWeight = '600';

    sidebarHeader.appendChild(sidebarTitle);

    // Content area
    const sidebarContent = document.createElement('div');
    sidebarContent.className = 'ask-ai-sidebar-content';

    // Group history by date
    const groupedHistory = groupHistoryByDate(history);

    // Render groups
    if (groupedHistory.today.length > 0) {
      const todaySection = createHistorySection('Today', groupedHistory.today, history);
      sidebarContent.appendChild(todaySection);
    }

    if (groupedHistory.yesterday.length > 0) {
      const yesterdaySection = createHistorySection('Yesterday', groupedHistory.yesterday, history);
      sidebarContent.appendChild(yesterdaySection);
    }

    if (groupedHistory.older.length > 0) {
      const olderSection = createHistorySection('Older', groupedHistory.older, history);
      sidebarContent.appendChild(olderSection);
    }

    sidebar.appendChild(sidebarHeader);
    sidebar.appendChild(sidebarContent);
    sidebarOverlay.appendChild(sidebar);

    // Close handler - click outside overlay to close
    sidebarOverlay.addEventListener('click', (e) => {
      if (e.target === sidebarOverlay) {
        sidebar.classList.add('ask-ai-sidebar-closing');
        setTimeout(() => {
          modal.removeChild(sidebarOverlay);
        }, 300);
      }
    });

    modal.appendChild(sidebarOverlay);

    // Trigger animation
    setTimeout(() => {
      sidebar.classList.add('ask-ai-sidebar-open');
    }, 10);
  }

  // Function to create a history section
  function createHistorySection(title, items, allHistory) {
    const section = document.createElement('div');
    section.className = 'ask-ai-history-section';

    const sectionTitle = document.createElement('div');
    sectionTitle.className = 'ask-ai-history-section-title';
    sectionTitle.textContent = title;

    section.appendChild(sectionTitle);

    items.forEach(chatData => {
      const historyItem = document.createElement('div');
      historyItem.className = 'ask-ai-sidebar-history-item';

      const itemContent = document.createElement('div');
      itemContent.className = 'ask-ai-sidebar-item-content';

      const itemTitle = document.createElement('div');
      itemTitle.className = 'ask-ai-sidebar-item-title';
      itemTitle.textContent = chatData.title;

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'ask-ai-sidebar-delete-btn';
      deleteBtn.type = 'button';
      deleteBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          <line x1="10" y1="11" x2="10" y2="17"></line>
          <line x1="14" y1="11" x2="14" y2="17"></line>
        </svg>
      `;

      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm('Delete this chat history?')) {
          try {
            // Delete from server
            const response = await fetch(`/header_ask_ai_history/${encodeURIComponent(chatData.id)}`, {
              method: 'DELETE'
            });

            if (!response.ok) {
              throw new Error('Failed to delete from server');
            }

            // Remove from UI
            historyItem.remove();

            // Remove section if empty
            const remainingItems = section.querySelectorAll('.ask-ai-sidebar-history-item');
            if (remainingItems.length === 0) {
              section.remove();
            }

            // Update allHistory array
            const updatedHistory = allHistory.filter(h => h.id !== chatData.id);
            allHistory.length = 0;
            allHistory.push(...updatedHistory);

            // Close sidebar if no history left
            if (updatedHistory.length === 0) {
              const sidebar = modal.querySelector('.ask-ai-sidebar');
              const overlay = modal.querySelector('.ask-ai-sidebar-overlay');
              if (sidebar && overlay) {
                sidebar.classList.add('ask-ai-sidebar-closing');
                setTimeout(() => {
                  modal.removeChild(overlay);
                  alert('No more chat history.');
                }, 300);
              }
            }
          } catch (e) {
            console.error('Error deleting chat:', e);
            alert('Failed to delete chat history.');
          }
        }
      });

      itemContent.appendChild(itemTitle);
      itemContent.appendChild(deleteBtn);
      historyItem.appendChild(itemContent);

      historyItem.addEventListener('click', () => {
        restoreChatFromHistory(chatData);
      });

      section.appendChild(historyItem);
    });

    return section;
  }

  // Function to restore chat from history
  async function restoreChatFromHistory(chatData) {
    // Save current active chat before switching to a new one
    if (activeChatRecIds.length > 0 && chatHistory.length > 0) {
      await saveAllActiveChats();
    }

    // Close the history sidebar
    const sidebar = modal.querySelector('.ask-ai-sidebar');
    const sidebarOverlay = modal.querySelector('.ask-ai-sidebar-overlay');
    if (sidebar && sidebarOverlay) {
      sidebar.classList.add('ask-ai-sidebar-closing');
      setTimeout(() => {
        modal.removeChild(sidebarOverlay);
      }, 300);
    }

    // Switch to Ask tab if on Create tab
    if (createTab.classList.contains('active')) {
      askTab.classList.add('active');
      createTab.classList.remove('active');
      createPageSection.style.display = 'none';
      footer.style.display = 'block';
      historyBtn.style.display = 'flex';
    }

    // Find the recording by ID (if recId exists)
    let recording = null;
    if (chatData.recId) {
      recording = recordings.find(r => r.id === chatData.recId);
      if (!recording) {
        alert('Recording not found. The note may have been deleted.');
        return;
      }
      // Set active chat with this recording
      activeChatRecIds = [chatData.recId];
    } else {
      // Legacy chat without recId - still allow viewing but can't continue
      console.warn('[Ask AI] Chat has no recId, this is a legacy chat');
      activeChatRecIds = [];
    }

    // Restore chat history and set the history ID for updates
    chatHistory = [...chatData.messages];
    currentHistoryId = chatData.id; // Track this chat for future updates

    // Show active titles only if we have a recording
    if (activeChatRecIds.length > 0) {
      showActiveTitles(activeChatRecIds);

      // Disable all checkboxes
      const allCheckboxes = notesList.querySelectorAll('.ask-ai-note-checkbox');
      allCheckboxes.forEach(cb => {
        cb.disabled = true;
        cb.checked = false;
      });

      // Check the current recording
      const currentCheckbox = notesList.querySelector(`[data-rec-id="${chatData.recId}"]`);
      if (currentCheckbox) {
        currentCheckbox.checked = true;
      }
      allNotesCheckbox.disabled = true;
      allNotesCheckbox.checked = false;
    } else {
      // For legacy chats without recId, hide the dropdown and show a title
      dropdownContainer.style.display = 'none';
      activeTitlesContainer.style.display = 'flex';
      activeTitlesContainer.innerHTML = `
        <div class="ask-ai-active-title-chip" style="cursor: default;">
          <span class="ask-ai-active-title-text">${chatData.title || 'Legacy Chat'}</span>
        </div>
      `;
    }

    // Clear and restore chat messages
    chatMessages.innerHTML = '';
    chatData.messages.forEach(msg => {
      if (msg.type === 'user') {
        addUserMessage(msg.text);
      } else {
        addAIMessage(msg.text);
      }
    });

    // Show chat section and hide dropdown
    chatSection.style.display = 'block';
    dropdownContainer.style.display = 'none';
    dropdownContent.style.display = 'none';

    // Make sure input section is visible for continuing the chat (only if not a legacy chat)
    if (activeChatRecIds.length > 0) {
      inputSection.style.display = 'block';
      questionInput.value = '';
      questionInput.focus();
    } else {
      // For legacy chats without recId, show a message instead of input
      inputSection.style.display = 'none';

      // Add a message to the chat explaining this is a legacy chat
      const legacyMessage = document.createElement('div');
      legacyMessage.className = 'ask-ai-legacy-message';
      legacyMessage.style.cssText = 'padding: 12px; margin: 12px; background: #f0f0f0; border-radius: 8px; text-align: center; color: #666;';
      legacyMessage.textContent = 'This is a legacy chat. You can view the conversation but cannot continue it. Please start a new chat.';
      chatSection.appendChild(legacyMessage);
    }

    // Scroll to bottom of chat
    scrollChatToBottom();

    console.log('[Ask AI] Restored chat from history:', chatData.id);
  }

  // Escape key to close
  const escHandler = async (e) => {
    if (e.key === 'Escape') {
      await closeModal();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);

  // Add page unload/refresh handler to save chat before leaving
  handleBeforeUnload = () => {
    if (activeChatRecIds.length > 0 && chatHistory.length > 0) {
      // Save the chat synchronously using sendBeacon for better reliability
      const firstRecId = activeChatRecIds[0];
      const recording = recordings.find(r => r.id === firstRecId);

      if (recording) {
        const userId = getUserId();
        const chatData = {
          id: currentHistoryId || null,  // Let backend generate UUID if no existing ID
          user_id: userId,
          recId: firstRecId,
          title: generateChatTitle(),  // Use dynamic title based on selection
          messages: [...chatHistory],
          timestamp: new Date().toISOString()
        };

        // Use sendBeacon for reliable async request during page unload
        const blob = new Blob([JSON.stringify(chatData)], { type: 'application/json' });
        navigator.sendBeacon('/header_ask_ai_history', blob);
      }
    }
  };

  window.addEventListener('beforeunload', handleBeforeUnload);

  // Attach close event handlers
  closeBtn.addEventListener('click', closeModal);

  overlay.addEventListener('click', async (e) => {
    if (e.target === overlay) {
      await closeModal();
    }
  });

  document.body.appendChild(overlay);

  // Prevent body scrolling when modal is open
  document.body.style.overflow = 'hidden';
}
