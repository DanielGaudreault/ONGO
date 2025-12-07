// public/app.js
const socket = io();
let isConnected = false;
let chatCount = 0;

// DOM Elements
const connectBtn = document.getElementById('connectBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const nextBtn = document.getElementById('nextBtn');
const sendBtn = document.getElementById('sendBtn');
const messageInput = document.getElementById('messageInput');
const chatMessages = document.getElementById('chatMessages');
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const partnerInfo = document.getElementById('partnerInfo');
const typingIndicator = document.getElementById('typingIndicator');
const onlineCount = document.getElementById('onlineCount');
const chatsCount = document.getElementById('chatsCount');
const interestsInput = document.getElementById('interests');
const languageSelect = document.getElementById('language');

// Initialize
chatsCount.textContent = localStorage.getItem('chatCount') || '0';

// Event Listeners
connectBtn.addEventListener('click', connectToChat);
disconnectBtn.addEventListener('click', disconnect);
nextBtn.addEventListener('click', skipPartner);
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

messageInput.addEventListener('input', () => {
    socket.emit('typing', messageInput.value.length > 0);
});

// Socket Events
socket.on('connect', () => {
    updateStatus('connected', 'Connected to server');
});

socket.on('disconnect', () => {
    updateStatus('disconnected', 'Disconnected from server');
});

socket.on('searching', (data) => {
    updateStatus('searching', `Searching for partner... (${data.count} users online)`);
    onlineCount.textContent = data.count;
});

socket.on('partner-found', () => {
    updateStatus('connected', 'Connected to a stranger!');
    enableChat(true);
    chatCount++;
    chatsCount.textContent = chatCount;
    localStorage.setItem('chatCount', chatCount);
    
    // Add welcome message
    addMessage('system', 'You are now connected with a random stranger. Say hello!', 'center');
});

socket.on('receive-message', (data) => {
    addMessage('received', data.text, 'left', data.timestamp);
    hideTypingIndicator();
});

socket.on('partner-typing', (isTyping) => {
    if (isTyping) {
        showTypingIndicator();
    } else {
        hideTypingIndicator();
    }
});

socket.on('partner-disconnected', () => {
    addMessage('system', 'Stranger has disconnected. Click "Next Stranger" to find someone new.', 'center');
    enableChat(false);
    updateStatus('disconnected', 'Partner disconnected');
});

socket.on('partner-skipped', () => {
    addMessage('system', 'Stranger skipped. Finding new partner...', 'center');
    enableChat(false);
    findNewPartner();
});

// Functions
function connectToChat() {
    if (isConnected) return;
    
    const interests = interestsInput.value
        .split(',')
        .map(i => i.trim())
        .filter(i => i.length > 0);
    
    const language = languageSelect.value;
    
    socket.emit('find-partner', {
        interests,
        language
    });
    
    connectBtn.disabled = true;
    disconnectBtn.disabled = false;
    nextBtn.disabled = true;
    
    // Clear chat
    chatMessages.innerHTML = '';
    addMessage('system', 'Looking for someone to chat with...', 'center');
}

function disconnect() {
    socket.disconnect();
    isConnected = false;
    connectBtn.disabled = false;
    disconnectBtn.disabled = true;
    nextBtn.disabled = true;
    enableChat(false);
    updateStatus('disconnected', 'Disconnected');
    
    // Add disconnect message
    addMessage('system', 'You have disconnected from the chat.', 'center');
}

function skipPartner() {
    socket.emit('skip-partner');
    nextBtn.disabled = true;
}

function sendMessage() {
    const message = messageInput.value.trim();
    if (!message || !isConnected) return;
    
    // Send to server
    socket.emit('send-message', {
        text: message
    });
    
    // Add to chat
    addMessage('sent', message, 'right', new Date().toISOString());
    
    // Clear input
    messageInput.value = '';
    socket.emit('typing', false);
}

function findNewPartner() {
    socket.emit('find-partner', {
        interests: interestsInput.value.split(',').map(i => i.trim()),
        language: languageSelect.value
    });
}

function addMessage(type, text, align, timestamp = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    
    const messageText = document.createElement('div');
    messageText.className = 'message-text';
    messageText.textContent = text;
    
    messageDiv.appendChild(messageText);
    
    if (timestamp) {
        const timeDiv = document.createElement('div');
        timeDiv.className = 'message-time';
        const time = new Date(timestamp);
        timeDiv.textContent = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        messageDiv.appendChild(timeDiv);
    }
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function updateStatus(status, text) {
    statusIndicator.className = 'status-indicator';
    statusIndicator.classList.add(status);
    statusText.textContent = text;
    
    if (status === 'connected') {
        isConnected = true;
        nextBtn.disabled = false;
    } else if (status === 'searching') {
        isConnected = false;
        nextBtn.disabled = true;
    } else {
        isConnected = false;
        nextBtn.disabled = true;
    }
}

function enableChat(enabled) {
    messageInput.disabled = !enabled;
    sendBtn.disabled = !enabled;
    if (enabled) {
        messageInput.focus();
    }
}

function showTypingIndicator() {
    typingIndicator.classList.add('active');
}

function hideTypingIndicator() {
    typingIndicator.classList.remove('active');
}

// Auto-reconnect
setInterval(() => {
    if (!socket.connected && isConnected) {
        socket.connect();
    }
}, 5000);
