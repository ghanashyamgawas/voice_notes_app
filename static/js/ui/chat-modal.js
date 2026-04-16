// ui/chat-modal.js
/*
  Ask AI Chat Modal - Q&A interface for specific transcriptions

  Exports:
    - openChatModal(recordingId, recordingTitle)

  Behaviour:
    - Opens a modal dialog with chat interface
    - Shows recording title in header
    - Users can ask questions about the transcription
    - POSTs questions to /ask_ai/:id endpoint
    - Displays conversation history in chat format
    - Can be closed via close button or clicking overlay
*/

export function openChatModal(recordingId, recordingTitle = 'Untitled Recording', initialQuestion = '') {
  // Prevent multiple modals
  if (document.querySelector('.chat-modal-overlay')) return;

  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'chat-modal-overlay';

  // Create modal container
  const modal = document.createElement('div');
  modal.className = 'chat-modal';

  // Create modal structure
  modal.innerHTML = `
    <div class="chat-modal-header">
      <h3 class="chat-modal-title">Ask</h3>
      <button class="chat-modal-close" type="button" title="Close">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
    <div class="chat-modal-messages" id="chat-messages">
    </div>
    <div class="chat-modal-input-container">
      <textarea
        class="chat-modal-input"
        id="chat-input"
        placeholder="Ask a question..."
        rows="1"
      ></textarea>
      <button class="chat-modal-send" id="chat-send" type="button" title="Send">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M22 2L11 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Get elements
  const closeBtn = modal.querySelector('.chat-modal-close');
  const messagesContainer = modal.querySelector('#chat-messages');
  const inputTextarea = modal.querySelector('#chat-input');
  const sendBtn = modal.querySelector('#chat-send');

  // Set initial question if provided
  if (initialQuestion) {
    inputTextarea.value = initialQuestion;
  }

  // Load chat history
  async function loadChatHistory() {
    try {
      const response = await fetch(`/chat_history/${encodeURIComponent(recordingId)}`, {
        method: 'GET',
        cache: 'no-store'
      });

      if (!response.ok) {
        console.error('Failed to load chat history');
        return;
      }

      const data = await response.json();
      const history = data.history || [];

      // Display history messages
      history.forEach(entry => {
        addUserMessage(entry.question);
        addAIMessage(entry.answer);
      });
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  }

  // Auto-resize textarea
  inputTextarea.addEventListener('input', () => {
    inputTextarea.style.height = 'auto';
    inputTextarea.style.height = Math.min(inputTextarea.scrollHeight, 120) + 'px';
  });

  // Close handlers
  const closeModal = () => {
    document.body.removeChild(overlay);
  };

  closeBtn.addEventListener('click', closeModal);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  // Escape key to close
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      closeModal();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);

  // Add user message to chat
  function addUserMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message chat-message-user';
    messageDiv.innerHTML = `
      <div class="chat-message-bubble">
        <p>${escapeHtml(text)}</p>
      </div>
    `;
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();
  }

  // Add AI message to chat
  function addAIMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message chat-message-ai';
    messageDiv.innerHTML = `
      <div class="chat-message-bubble">
        <p>${escapeHtml(text)}</p>
      </div>
    `;
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();
  }

  // Add loading indicator
  function addLoadingIndicator() {
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'chat-message chat-message-ai chat-message-loading';
    loadingDiv.id = 'chat-loading';
    loadingDiv.innerHTML = `
      <div class="chat-message-bubble">
        <div class="chat-loading-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    `;
    messagesContainer.appendChild(loadingDiv);
    scrollToBottom();
  }

  // Remove loading indicator
  function removeLoadingIndicator() {
    const loadingEl = document.getElementById('chat-loading');
    if (loadingEl) loadingEl.remove();
  }

  // Scroll to bottom of messages
  function scrollToBottom() {
    setTimeout(() => {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }, 50);
  }

  // Escape HTML to prevent XSS
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.replace(/\n/g, '<br>');
  }

  // Send message handler
  async function sendMessage() {
    const question = inputTextarea.value.trim();
    if (!question) return;

    // Disable input while processing
    inputTextarea.disabled = true;
    sendBtn.disabled = true;

    // Add user message
    addUserMessage(question);

    // Clear input
    inputTextarea.value = '';
    inputTextarea.style.height = 'auto';

    // Show loading
    addLoadingIndicator();

    try {
      const response = await fetch(`/ask_ai/${encodeURIComponent(recordingId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
        cache: 'no-store'
      });

      removeLoadingIndicator();

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to get response');
      }

      const data = await response.json();

      if (data.answer) {
        addAIMessage(data.answer);
      } else {
        throw new Error('No answer received');
      }
    } catch (error) {
      console.error('Ask AI error:', error);
      removeLoadingIndicator();
      addAIMessage('Sorry, I encountered an error. Please try again.');
    } finally {
      // Re-enable input
      inputTextarea.disabled = false;
      sendBtn.disabled = false;
      inputTextarea.focus();
    }
  }

  // Send button click
  sendBtn.addEventListener('click', sendMessage);

  // Enter key to send (Shift+Enter for new line)
  inputTextarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Load chat history on modal open
  loadChatHistory();

  // Focus input after history loads
  setTimeout(() => inputTextarea.focus(), 200);
}
