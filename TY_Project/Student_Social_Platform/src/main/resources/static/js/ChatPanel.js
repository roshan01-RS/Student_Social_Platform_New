// ChatPanel.js - DEBUG VERSION (FULL updated file)
// Logic updated: 
// 1. Removed Unread Badge Logic (Sidebar).
// 2. Removed Unread Divider Line (Chat Area).
// 3. Increased Chat Input Font Size.
// 4. Preserved multi-line textarea and other fixes.

(function(App) {

    const API_BASE = '';
    let stompClient = null;
    let selectedUser = null;
    let currentMessages = [];
    let fileInput = null; 
    let userId = null; 
    let imageFileToUpload = null; 
    
    // NEW: State for typing and auto-refresh
    let typingTimeout = null;
    // let firstUnreadId = null; // Removed
    let refreshInterval = null; 
    let activeFriendshipPoll = null; 

    // presence map: userId (string) -> boolean
    const presence = {};

    // --- GLOBAL TIME FORMATTER (12-Hour Format) ---
    App.formatTime = (dateInput) => {
        if (!dateInput) return '';
        const date = new Date(dateInput);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    };
    const formatTime = App.formatTime;

    // --- Logger Helper ---
    function log(msg, data = '') {
        console.log(`%c[ChatPanel-DEBUG] ${msg}`, 'background: #222; color: #bada55', data);
    }

    // --- Helper: Robust Notification ---
    const showNotification = (message, type = 'success') => {
        if (window.showGlobalNotification) {
            window.showGlobalNotification(message, type);
        } else if (App && App.showGlobalNotification) {
            App.showGlobalNotification(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] Notification: ${message}`);
        }
    };
    
    // --- Helper: Fetch HTML ---
    async function loadHtml(url) {
        try {
            const response = await fetch(url + '?v=' + new Date().getTime());
            if (!response.ok) throw new Error(`Failed to load ${url}`);
            let text = await response.text();
            text = text.replace(/<!-- Code injected by live-server -->[\s\S]*?<\/script>/gi, "");
            return text;
        } catch (err) {
            console.error("HTML Load Error:", err);
            return null;
        }
    }

    // --- Helper: Get Current User ID ---
    async function getCurrentUserId() {
        if (userId) return userId;
        try {
            const res = await App.fetchData('/api/my-profile');
            if (res.userId) { 
                userId = String(res.userId);
                return userId;
            }
        } catch (e) { console.error("Failed to fetch current user ID", e); }
        return null;
    }

    // --- WebSocket Connection ---
    function connectWebSocket() {
        if (stompClient && stompClient.connected) return;
        if (!userId) return;

        if (!window.SockJS || !window.Stomp) {
            console.error("SockJS or Stomp libraries missing.");
            return;
        }

        const socket = new SockJS(`/ws?userId=${encodeURIComponent(userId)}`);
        stompClient = Stomp.over(socket);
        stompClient.debug = () => {}; 

        stompClient.connect({}, function(frame) {
            log('STOMP Connected!');
            
            const topic1 = `/user/queue/messages`;
            const topic2 = `/user/${userId}/queue/messages`;
            try { stompClient.subscribe(topic1, (m) => onStompMessage(m)); } catch(e){}
            try { stompClient.subscribe(topic2, (m) => onStompMessage(m)); } catch(e){}

            try { stompClient.subscribe(`/user/queue/typing`, (m) => onStompTyping(m)); } catch(e){}
            try { stompClient.subscribe(`/user/${userId}/queue/typing`, (m) => onStompTyping(m)); } catch(e){}

            try { stompClient.subscribe(`/user/queue/read-receipts`, (m) => onStompRead(m)); } catch(e){}
            try { stompClient.subscribe(`/user/${userId}/queue/read-receipts`, (m) => onStompRead(m)); } catch(e){}

            try { stompClient.subscribe(`/topic/presence`, (m) => onStompPresence(m)); } catch(e){}
            try { stompClient.subscribe(`/user/queue/presence`, (m) => onStompPresence(m)); } catch(e){}
            try { stompClient.subscribe(`/user/${userId}/queue/presence`, (m) => onStompPresence(m)); } catch(e){}

            renderUserList(); 
        }, function(error) {
            console.error('WebSocket Connection Error:', error);
            showNotification("Real-time connection lost. Retrying...", "error");
        });
    }

    function onStompMessage(messageOutput) {
        if (!messageOutput || !messageOutput.body) return;
        try { handleIncomingMessage(JSON.parse(messageOutput.body)); } catch (e) {}
    }

    function onStompTyping(output) {
        if (!output || !output.body) return;
        try { handleTypingEvent(JSON.parse(output.body)); } catch(e) {}
    }

    function onStompRead(output) {
        if (!output || !output.body) return;
        try { handleReadReceipt(JSON.parse(output.body)); } catch(e) {}
    }

    function onStompPresence(output) {
        if (!output || !output.body) return;
        try { handlePresenceEvent(JSON.parse(output.body)); } catch(e) {}
    }

    // --- HANDLERS ---
    
    function handleTypingEvent(payload) {
        if (!selectedUser || String(payload.senderId) !== String(selectedUser.id)) return;
        
        const typingEl = document.getElementById('chat-typing-indicator');
        const statusEl = document.getElementById('chat-header-status');
        
        if (!typingEl || !statusEl) return;
        
        if (payload.isTyping) {
            typingEl.style.display = 'flex';
            statusEl.textContent = 'typing...';
            const scrollArea = document.getElementById('chat-messages-area');
            if(scrollArea) scrollArea.scrollTop = scrollArea.scrollHeight;
        } else {
            typingEl.style.display = 'none';
            statusEl.textContent = selectedUser && selectedUser.online ? 'Active now' : 'Offline';
        }
    }
    
    function handleReadReceipt(receipt) {
        if (!receipt) return;
        const lastReadId = receipt.id || receipt.messageId || receipt.messageID || null;
        let updated = false;

        if (lastReadId) {
            for (let m of currentMessages) {
                if (m.sender === 'me') {
                    m.status = 'READ';
                    updated = true;
                }
            }
        } else {
            currentMessages.forEach(m => {
                if (m.sender === 'me' && m.status !== 'READ') {
                    m.status = 'READ';
                    updated = true;
                }
            });
        }

        if (updated) {
            const container = document.querySelector('#chat-messages-area .profile-content-wrapper');
            if (container) container.innerHTML = renderMessagesHTML();
        }
    }
    
    function handlePresenceEvent(payload) {
        if (!payload) return;
        const id = String(payload.userId ?? payload.id ?? payload.user);
        const online = !!payload.online;

        if (!id) return;
        
        presence[id] = online;
        log(`Presence Update: User ${id} is now ${online ? 'Online' : 'Offline'}`);

        updateSidebarPresence(id, online);

        if (selectedUser && String(selectedUser.id) === id) {
            selectedUser.online = online;
            const statusEl = document.getElementById('chat-header-status');
            const avatarDot = document.querySelector('.chat-window-userinfo .chat-user-online-badge');
            
            if (statusEl) statusEl.textContent = online ? 'Active now' : 'Offline';
            
            if (online) {
                if(!avatarDot) {
                    const wrapper = document.querySelector('.chat-window-userinfo .chat-user-avatar-wrapper');
                    if(wrapper) wrapper.insertAdjacentHTML('beforeend', '<div class="chat-user-online-badge"></div>');
                }
            } else {
                if(avatarDot) avatarDot.remove();
            }

            if (online) {
                let changed = false;
                currentMessages.forEach(m => {
                    if (m.sender === 'me' && m.status !== 'READ' && m.status !== 'DELIVERED') {
                        m.status = 'DELIVERED';
                        changed = true;
                    }
                });
                if (changed) {
                    const container = document.querySelector('#chat-messages-area .profile-content-wrapper');
                    if (container) container.innerHTML = renderMessagesHTML();
                }
            }
        }
    }

    function updateSidebarPresence(userIdToUpdate, online) {
        try {
            const buttons = document.querySelectorAll(`.chat-user-button[data-user-id="${userIdToUpdate}"]`);
            buttons.forEach(btn => {
                btn.dataset.online = online ? 'true' : 'false';
                const avatarWrapper = btn.querySelector('.chat-user-avatar-wrapper');
                if (avatarWrapper) {
                    let badge = avatarWrapper.querySelector('.chat-user-online-badge');
                    if (online) {
                        if (!badge) avatarWrapper.insertAdjacentHTML('beforeend', '<div class="chat-user-online-badge"></div>');
                    } else {
                        if (badge) badge.remove();
                    }
                }
            });
        } catch (e) { }
    }

    function sendTyping(isTyping) {
        if (stompClient && stompClient.connected && selectedUser) {
             stompClient.send("/app/chat.typing", {}, JSON.stringify({
                 senderId: userId,
                 recipientId: selectedUser.id,
                 isTyping: isTyping
             }));
        }
    }
    
    async function sendReadReceipt(otherUserId, conversationId) {
        try {
             if (!conversationId) conversationId = getConversationId(userId, otherUserId);
            if (stompClient && stompClient.connected) {
                const lastFromOther = [...currentMessages].reverse().find(m => m.sender === 'other');
                if (!lastFromOther) return;
                const ack = {
                    messageId: String(lastFromOther.id),
                    readerId: userId,
                    originalSenderId: otherUserId
                };
                stompClient.send("/app/chat.read-ack", {}, JSON.stringify(ack));
                return;
            }
            await fetch(`${API_BASE}/api/chat/read`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ userId: userId, conversationId: conversationId })
            });
        } catch(e) { }
    }
    
    function getConversationId(u1, u2) {
        return Math.min(u1, u2) + "_" + Math.max(u1, u2);
    }

    async function handleIncomingMessage(msg) {
        log("Processing Incoming Message:", msg);
        
        const msgSenderId = msg.senderId != null ? String(msg.senderId) : null;
        const msgRecipientId = msg.recipientId != null ? String(msg.recipientId) : null;
        const currentUserIdStr = String(userId);
        const type = (msgSenderId === currentUserIdStr) ? 'me' : 'other';
        
        let mediaSrc = null;
        if (msg.mediaUrl) {
             mediaSrc = msg.mediaUrl.startsWith('http') ? msg.mediaUrl : `${API_BASE}/${msg.mediaUrl}`;
        }

        const displayMsg = {
            id: msg.id || Date.now(),
            sender: type,
            content: msg.content,
            image: mediaSrc,
            timestamp: formatTime(msg.timestamp), 
            rawTimestamp: msg.timestamp,
            status: msg.status || 'SENT'
        };

        // --- BACKGROUND MESSAGE ---
        if (!selectedUser) {
            const targetId = (type === 'me') ? msgRecipientId : msgSenderId;
            updateSidebarPreview(targetId, displayMsg.content, displayMsg.timestamp);
            if(type === 'other') showNotification("New message received");
            return;
        }

        const selectedIdStr = String(selectedUser.id);
        const isCurrentConversation = 
            (msgSenderId === currentUserIdStr && msgRecipientId === selectedIdStr) || 
            (msgSenderId === selectedIdStr && msgRecipientId === currentUserIdStr);

        if (isCurrentConversation) {
            // STRICT CHECK: Ensure friendship validity (handled by poll mostly, but good for race conditions)
            if (type === 'other') {
                handleTypingEvent({ senderId: msgSenderId, isTyping: false });
                sendReadReceipt(selectedUser.id, getConversationId(userId, selectedUser.id));
            }

            if (type === 'me') {
                const optIndex = currentMessages.findIndex(m =>
                    m.sender === 'me' &&
                    (m.status === 'SENT' || String(m.id).startsWith('temp-')) &&
                    m.content === displayMsg.content
                );
                if (optIndex !== -1) {
                    const was = currentMessages[optIndex];
                    const newStatus = (presence[String(selectedUser.id)] ? 'DELIVERED' : 'SENT');
                    const serverMsg = { ...displayMsg, status: msg.status || newStatus };
                    currentMessages.splice(optIndex, 1, serverMsg);

                    const oldEl = document.getElementById(`msg-${was.id}`);
                    if (oldEl) oldEl.outerHTML = renderMessageBubble(serverMsg);
                    else appendMessageToDOM(serverMsg);
                    
                    updateSidebarPreview(selectedUser.id, displayMsg.content, displayMsg.timestamp);
                    return;
                }
            }

            if (!currentMessages.some(m => String(m.id) === String(displayMsg.id))) {
                 currentMessages.push(displayMsg);
                 appendMessageToDOM(displayMsg);
            }
            
            updateSidebarPreview(selectedUser.id, displayMsg.content, displayMsg.timestamp);
        } else {
            // OTHER CONVERSATION
            const targetId = (type === 'me') ? msgRecipientId : msgSenderId;
            updateSidebarPreview(targetId, displayMsg.content, displayMsg.timestamp);
            if(type === 'other') showNotification(`Message from ${displayMsg.sender}`);
        }
    }
    
    function updateSidebarPreview(userIdToUpdate, messageText, timeString) {
        if (!userIdToUpdate) return;
        const btn = document.querySelector(`.chat-user-button[data-user-id="${userIdToUpdate}"]`);
        
        if (!btn) {
            // If user isn't in the list yet, we need to refresh to pull them in
            renderUserList(); 
            return;
        }

        const msgEl = btn.querySelector('.chat-user-message');
        if (msgEl) msgEl.textContent = messageText;

        const timeEl = btn.querySelector('.chat-user-timestamp');
        if (timeEl) timeEl.textContent = timeString;

        // REMOVED: Badge increment logic
        
        const container = document.getElementById('chat-list-container');
        if (container && btn !== container.firstElementChild) {
            container.prepend(btn);
        }
    }

    // --- Friend Check Logic ---
    async function checkIsFriend(otherUserId) {
        if (!otherUserId) return false;
        try {
            const res = await App.fetchData('/api/friendship/list-friends', {credentials: 'include'});
            if (Array.isArray(res)) {
                return res.some(f => String(f.userId) === String(otherUserId) && f.status === 'ACCEPTED');
            }
        } catch (e) { console.error("Friend Check Failed", e); }
        return false;
    }

    // Update Input Area based on friendship status
    function updateChatInputState(isFriend) {
        const inputArea = document.querySelector('.chat-input-area');
        if (!inputArea) return;

        const currentState = inputArea.getAttribute('data-state');
        const newState = isFriend ? 'FRIEND' : 'NOT_FRIEND';

        if (currentState === newState) return;
        
        inputArea.setAttribute('data-state', newState);

        if (isFriend) {
            inputArea.innerHTML = `
                <div id="chat-preview-container" class="image-preview-container" style="display:none; padding: 0.8rem 1.5rem 0 1.5rem; margin-bottom: 0.5rem; background: transparent;">
                   <div style="display:flex; align-items:center;">
                       <img id="chat-preview-img" src="" class="preview-img" style="height: 40px; width: auto; margin-right: 10px;">
                       <span id="chat-preview-text" style="color:#9ca3af; font-size:1.2rem;">Image ready.</span>
                       <button id="chat-remove-preview-btn" class="btn-remove-preview" title="Remove" style="margin-left: auto;">✕</button>
                   </div>
                </div>
                <div class="chat-input-wrapper" style="align-items: flex-end;"> 
                      <button class="btn-icon" id="chat-photo-btn" title="Add Photo" style="margin-bottom: 5px;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                      </button>
                      <button class="btn-icon" id="chat-emoji-btn" title="Add Emoji" style="margin-bottom: 5px;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
                      </button>
                      <input type="file" id="chat-file-input" style="display: none;" accept="image/*">
                      <div class="chat-input-field-wrapper" style="flex: 1; display: flex;">
                        <textarea placeholder="Type a message..." class="chat-input-field" id="private-chat-input" rows="1" style="resize: none; overflow-y: hidden; min-height: 40px; max-height: 120px; line-height: 1.4; padding: 10px 12px; border-radius: 20px; width: 100%; box-sizing: border-box; font-family: inherit; font-size: 1.15rem; border: 1px solid #e5e7eb;"></textarea>
                      </div>
                      <button class="chat-send-btn" id="chat-send-btn" style="margin-bottom: 2px;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button>
                </div>`;
            attachChatListeners();
        } else {
            inputArea.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 10px; color: #666;">
                    <div style="font-weight: 500;">No longer friends.</div>
                    <button id="chat-send-friend-req-btn" class="btn btn-primary" style="background-color: #4169E1; color: white; border: none; padding: 8px 16px; border-radius: 20px; cursor: pointer;">
                        Send Friend Request
                    </button>
                </div>
            `;
            const reqBtn = document.getElementById('chat-send-friend-req-btn');
            if (reqBtn) {
                reqBtn.addEventListener('click', async () => {
                    reqBtn.disabled = true;
                    reqBtn.textContent = "Sending...";
                    try {
                        await fetch(`${API_BASE}/api/friendship/request`, {
                            method: 'POST',
                            credentials: 'include',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ recipientId: Number(selectedUser.id) })
                        });
                        reqBtn.textContent = "Request Sent";
                        showNotification("Friend request sent!");
                    } catch (e) {
                        reqBtn.textContent = "Error";
                        reqBtn.disabled = false;
                        console.error(e);
                    }
                });
            }
        }
    }

    function renderStatusIcon(status, isMe) {
        if (!isMe) return '';
        if (!status) return '<span class="msg-status sent">✓</span>';
        if (status === 'READ') return '<span class="msg-status read">✓✓</span>';
        if (status === 'DELIVERED') return '<span class="msg-status delivered">✓✓</span>';
        return '<span class="msg-status sent">✓</span>';
    }
    
    function renderDateSeparator(date) {
        const d = new Date(date);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        let label = d.toLocaleDateString();
        if (d.toDateString() === today.toDateString()) label = "Today";
        if (d.toDateString() === yesterday.toDateString()) label = "Yesterday";
        return `<div class="date-separator"><span>${label}</span></div>`;
    }
    
    function renderMessageBubble(msg) {
        const isMe = msg.sender === 'me';
        const statusHtml = renderStatusIcon(msg.status, isMe);

        return `
            <div class="message-bubble-wrapper ${msg.sender}" id="msg-${msg.id}">
                <div class="message-bubble ${msg.sender}">
                    ${msg.image ? `
                        <img src="${msg.image}" alt="Shared Image" style="max-width:300px; border-radius:4px; margin-bottom:5px; cursor:pointer;" onclick="window.open(this.src, '_blank')">
                        <div style="margin-top:4px;"><a href="${msg.image}" download target="_blank" style="color:inherit; font-size:0.9em; opacity:0.7; text-decoration:underline;">Download</a></div>
                    ` : ''}
                    <div class="message-bubble-content">
                        <p style="margin:0; word-wrap:break-word; word-break:break-word; white-space:pre-wrap;">${escapeHtml(msg.content || '')}</p>
                        <div class="msg-meta">
                            <span class="message-time">${msg.timestamp || 'Now'}</span>
                            ${statusHtml}
                        </div>
                    </div>
                </div>
            </div>`;
    }

    function escapeHtml(unsafe) {
        return String(unsafe).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    function appendMessageToDOM(displayMsg) {
        const messageContainer = document.querySelector('#chat-messages-area .profile-content-wrapper');
        if (messageContainer) {
            const lastMsg = currentMessages[currentMessages.length - 2]; 
            if (lastMsg) {
                const d1 = new Date(lastMsg.rawTimestamp).toDateString();
                const d2 = new Date(displayMsg.rawTimestamp).toDateString();
                if (d1 !== d2) {
                     messageContainer.insertAdjacentHTML('beforeend', renderDateSeparator(displayMsg.rawTimestamp));
                }
            }
            const newBubbleHtml = renderMessageBubble(displayMsg);
            messageContainer.insertAdjacentHTML('beforeend', newBubbleHtml);
            const scrollArea = document.getElementById('chat-messages-area');
            if(scrollArea) scrollArea.scrollTop = scrollArea.scrollHeight;
        }
    }

    const CHAT_PANEL_HTML = `
    <div class="chat-layout">
        <div class="chat-list-sidebar">
            <div class="chat-list-header">
                <div class="chat-search-wrapper">
                    <svg class="chat-search-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clip-rule="evenodd" /></svg>
                    <input type="text" id="chat-search-input" placeholder="Search conversations..." class="chat-search-input">
                </div>
                <button class="btn-icon" id="add-friend-btn" title="Add Friend">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="17" y1="11" x2="23" y2="11"/></svg>
                </button>
            </div>
            <div class="chat-list-scroll-area" id="chat-list-container">
                <div style="padding: 20px; text-align: center; color: #888;">Loading chats...</div>
            </div>
        </div>
        <div class="chat-window" id="chat-window-container">
            <div class="chat-placeholder"><p>Select a conversation</p></div>
        </div>
    </div>
    `;

    function getTemplate() {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = CHAT_PANEL_HTML;
        return tempDiv.firstElementChild;
    }

    function renderMessagesHTML() {
        if (currentMessages.length === 0) {
            return `<div style="text-align:center; padding: 20px; color: #888;">No messages yet. Say hello!</div>`;
        }
        let html = '';
        let lastDateString = null;
        
        currentMessages.forEach(msg => {
            const d = new Date(msg.rawTimestamp || msg.timestamp);
            const dStr = d.toDateString();
            
            if (dStr !== lastDateString) {
                html += renderDateSeparator(d);
                lastDateString = dStr;
            }
            // REMOVED: Unread Line Logic
            html += renderMessageBubble(msg);
        });
        return html;
    }

    function renderChatWindow(user) {
        log("Rendering chat window for user:", user?.id);
        const container = document.getElementById('chat-window-container');
        if (!container) return;
        if (!user) {
            container.innerHTML = `<div class="chat-placeholder"><p>Select a conversation</p></div>`;
            return;
        }
        const initialStatus = user.online ? 'Online' : 'Offline';
        container.innerHTML = `
            <div class="chat-window-header">
                <div class="chat-window-userinfo">
                    <div class="chat-user-avatar-wrapper">
                        <img src="${user.avatar}" alt="${user.name}" class="chat-user-avatar" style="width:4rem;height:4rem;border-radius:50%;">
                        ${user.online ? '<div class="chat-user-online-badge"></div>' : ''}
                    </div>
                    <div>
                        <h3>${escapeHtml(user.name)}</h3>
                        <p id="chat-header-status">${initialStatus}</p>
                    </div>
                </div>
            </div>
            <div class="chat-messages-area" id="chat-messages-area">
                <div class="profile-content-wrapper">
                    <div style="text-align:center; padding: 20px; color: #888;">Loading history...</div>
                </div>
                <div id="chat-typing-indicator" class="typing-indicator" style="display:none;">
                    <span>${escapeHtml(user.name)} is typing</span>
                    <div class="typing-dots"><span>.</span><span>.</span><span>.</span></div>
                </div>
            </div>
            <div id="chat-emoji-picker-container"></div>
            
            <!-- CHAT INPUT AREA (Will be updated based on friend status) -->
            <div class="chat-input-area" data-state="LOADING">
                <!-- Content injected by updateChatInputState -->
            </div>
        `;
    }
    
    async function loadChatHistory(recipientId) {
        if (!userId) return;
        
        // Stop any previous polling
        if (activeFriendshipPoll) clearInterval(activeFriendshipPoll);

        currentMessages = [];
        // Removed firstUnreadId logic

        renderChatWindow(selectedUser); 
        
        // Initial Friend Check
        const isFriend = await checkIsFriend(recipientId);
        updateChatInputState(isFriend);

        // START POLLING for real-time unfriend detection (Receiver Side)
        activeFriendshipPoll = setInterval(async () => {
             if (!selectedUser || String(selectedUser.id) !== String(recipientId)) return;
             const stillFriend = await checkIsFriend(recipientId);
             updateChatInputState(stillFriend);
        }, 3000);

        try {
            log(`Fetching history for ${recipientId}...`);
            const res = await App.fetchData(`/api/messages/${recipientId}?senderId=${userId}`, {credentials: 'include'});
            
            let messages = [];
            if (Array.isArray(res)) {
                messages = res;
            } else {
                messages = res.messages || [];
            }

            currentMessages = messages.map(msg => ({
                id: msg.id,
                sender: (String(msg.senderId) === String(userId)) ? 'me' : 'other',
                content: msg.content,
                image: msg.mediaUrl ? `${API_BASE}/${msg.mediaUrl}` : null, 
                timestamp: formatTime(msg.timestamp), 
                rawTimestamp: msg.timestamp, 
                status: determineInitialStatus(msg, selectedUser)
            }));

            const container = document.querySelector('#chat-messages-area .profile-content-wrapper');
            if (container) {
                container.innerHTML = renderMessagesHTML();
                const scrollArea = document.getElementById('chat-messages-area');
                if(scrollArea) scrollArea.scrollTop = scrollArea.scrollHeight;
                
                sendReadReceipt(recipientId, getConversationId(userId, recipientId));
            }
        } catch (e) {
            console.error('Failed to load history:', e);
            const container = document.querySelector('#chat-messages-area .profile-content-wrapper');
            if(container) container.innerHTML = `<div style="color:red;padding:20px;text-align:center;">Failed to load history.</div>`;
        }
    }

    function determineInitialStatus(msg, recipient) {
        if (msg.status) return msg.status;
        if (String(msg.senderId) === String(userId)) {
            const isOnline = presence[String(recipient?.id)] === true;
            return isOnline ? 'DELIVERED' : 'SENT';
        }
        return msg.status || 'SENT';
    }

    function attachChatListeners() {
        const sendBtn = document.getElementById('chat-send-btn');
        const input = document.getElementById('private-chat-input');
        const imageBtn = document.getElementById('chat-photo-btn');
        const emojiBtn = document.getElementById('chat-emoji-btn');
        fileInput = document.getElementById('chat-file-input'); 
        const previewContainer = document.getElementById('chat-preview-container');
        const removePreviewBtn = document.getElementById('chat-remove-preview-btn');

        if (!input) return; 

        const clearPreview = () => {
            imageFileToUpload = null;
            if(previewContainer) previewContainer.style.display = 'none';
            if(fileInput) fileInput.value = '';
            // Reset height
            input.style.height = 'auto';
            input.style.height = '40px'; 
        };

        const handleSend = async () => {
            const text = input.value.trim();
            const fileToSend = imageFileToUpload;

            if ((!text && !fileToSend) || !selectedUser || !stompClient || !userId) return;
            
            // FINAL STRICT CHECK
            const strictFriendCheck = await checkIsFriend(selectedUser.id);
            if (!strictFriendCheck) {
                updateChatInputState(false);
                showNotification("Cannot send message: You are no longer friends.", "error");
                return;
            }

            const optimisticMsg = {
                id: 'temp-' + Date.now(),
                sender: 'me',
                content: text,
                image: fileToSend ? URL.createObjectURL(fileToSend) : null, 
                timestamp: formatTime(new Date()), 
                rawTimestamp: new Date().toISOString(),
                status: presence[String(selectedUser.id)] ? 'DELIVERED' : 'SENT'
            };
            
            currentMessages.push(optimisticMsg);
            appendMessageToDOM(optimisticMsg); 
            updateSidebarPreview(selectedUser.id, text, optimisticMsg.timestamp, false);

            input.value = '';
            clearPreview();
            input.focus();
            sendTyping(false);

            let mediaUrl = null;
            if (fileToSend) {
                const formData = new FormData();
                formData.append('file', fileToSend);
                try {
                    const res = await fetch(`${API_BASE}/api/posts/create-media`, {
                        method: 'POST',
                        credentials: 'include',
                        body: formData
                    });
                    if(res.ok) {
                        const data = await res.json();
                        mediaUrl = data.url; 
                    } else {
                        showNotification('Image upload failed.', 'error');
                        return;
                    }
                } catch(err) {
                    showNotification('Network error uploading image.', 'error');
                    return;
                }
            }

            const chatMessage = {
                senderId: userId,
                recipientId: selectedUser.id,
                content: text,
                mediaUrl: mediaUrl,
                type: mediaUrl ? 'IMAGE' : 'TEXT'
            };
            stompClient.send("/app/chat", {}, JSON.stringify(chatMessage));
        };

        if(sendBtn) sendBtn.addEventListener('click', handleSend);
        
        // Updated Input Listener for Textarea
        input.addEventListener('keydown', (e) => { 
            if(e.key === 'Enter' && !e.shiftKey) { 
                e.preventDefault(); 
                handleSend(); 
            }
            // Auto-resize
            setTimeout(() => {
                input.style.height = 'auto';
                input.style.height = Math.min(input.scrollHeight, 120) + 'px';
            }, 0);
        });

        // Also trigger on input event
        input.addEventListener('input', () => {
            input.style.height = 'auto';
            input.style.height = Math.min(input.scrollHeight, 120) + 'px';
            
            // Typing logic
            if (input.value.length > 0) {
                sendTyping(true);
                clearTimeout(typingTimeout);
                typingTimeout = setTimeout(() => sendTyping(false), 2000);
            } else {
                 sendTyping(false);
            }
        });
        
        if(imageBtn) imageBtn.addEventListener('click', () => fileInput.click());
        if(fileInput) fileInput.addEventListener('change', (e) => {
             const file = e.target.files?.[0];
             if (file) {
                 const previewImage = document.getElementById('chat-preview-img');
                 const previewText = document.getElementById('chat-preview-text');
                 const reader = new FileReader();
                 reader.onload = function(evt) {
                     if(previewImage) previewImage.src = evt.target.result;
                     if(previewText) previewText.textContent = `Image: ${file.name}`;
                     if(previewContainer) previewContainer.style.display = 'block';
                     imageFileToUpload = file;
                 };
                 reader.readAsDataURL(file);
             }
        });
        if (removePreviewBtn) removePreviewBtn.addEventListener('click', (e) => { e.preventDefault(); clearPreview(); });
        if(emojiBtn) emojiBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (window.App && typeof window.App.openEmojiPanel === 'function') {
                window.App.openEmojiPanel((emoji) => {
                    input.value += emoji;
                    input.focus();
                    // Trigger resize
                    const event = new Event('input', { bubbles: true });
                    input.dispatchEvent(event);
                }, emojiBtn);
            }
        });
    }

    App.renderMessages = async (panel) => {
        log("Initializing Chat Panel...");
        const currentId = await getCurrentUserId();
        if (!currentId) {
            panel.innerHTML = '<div style="color:red;padding:20px;">Cannot load chat: Authentication error.</div>';
            return;
        }
        connectWebSocket();

        const template = getTemplate();
        panel.innerHTML = ''; 
        panel.appendChild(template); 

        // Initial Render
        renderUserList();
        
        // AUTO-UPDATE: Set Interval to refresh sidebar every 30s
        if (refreshInterval) clearInterval(refreshInterval);
        refreshInterval = setInterval(() => {
            renderUserList(panel.querySelector('#chat-search-input')?.value || '');
        }, 30000); 

        // Expose refresh function so FriendList can trigger it
        App.refreshChatList = () => renderUserList(panel.querySelector('#chat-search-input')?.value || '');
        
        // --- EXPOSED REFRESH FOR FRIEND LIST (Chat Input State) ---
        // Called immediately after Unfriend Action in Friend List
        App.refreshCurrentChatState = async () => {
            if (!selectedUser) return;
            // Check status immediately
            const isFriend = await checkIsFriend(selectedUser.id);
            updateChatInputState(isFriend);
        };

        const searchInput = panel.querySelector('#chat-search-input');
        if (searchInput) searchInput.addEventListener('input', (e) => renderUserList(e.target.value));
        const addFriendBtn = panel.querySelector('#add-friend-btn');
        if (addFriendBtn) addFriendBtn.addEventListener('click', () => { if(App.openFriendsModal) App.openFriendsModal(); });
    };

    async function renderUserList(filter = '') {
        const container = document.getElementById('chat-list-container');
        if (!container || !userId) return;

        // PRESERVE SCROLL
        const scrollTop = container.scrollTop;

        try {
            const conversations = await App.fetchData(`/api/conversations?userId=${userId}`, {credentials: 'include'});
            const filtered = (conversations || []).filter(c => (c.name || '').toLowerCase().includes(String(filter || '').toLowerCase()));

            if (filtered.length === 0) {
                container.innerHTML = '<div style="padding: 20px; text-align: center; color: #888;">No conversations. Add friends to chat!</div>';
                return;
            }

            container.innerHTML = filtered.map(conv => {
                const otherIdStr = String(conv.otherUserId);
                const isSelected = selectedUser?.id == otherIdStr;
                const nameDisplay = (conv.name || '').replace(/^@/, '');
                const avatarSrc = conv.avatar ? (conv.avatar.startsWith('http') ? conv.avatar : `${API_BASE}/${conv.avatar}`) : `https://api.dicebear.com/7.x/avataaars/svg?seed=default`;
                
                // IMPORTANT: SYNC PRESENCE MAP
                // If local map has data, use it. If not, seed it from server response.
                if (presence[otherIdStr] === undefined) {
                    presence[otherIdStr] = !!conv.online;
                }
                const onlineState = presence[otherIdStr];
                
                const onlineBadge = onlineState ? '<div class="chat-user-online-badge"></div>' : '';

                return `
                <button class="chat-user-button ${isSelected ? 'active' : ''}" 
                        data-user-id="${otherIdStr}" 
                        data-name="${nameDisplay}" 
                        data-avatar="${avatarSrc}"
                        data-online="${onlineState}">
                    <div class="chat-user-inner">
                        <div class="chat-user-avatar-wrapper">
                            <img src="${avatarSrc}" alt="${nameDisplay}" class="chat-user-avatar">
                            ${onlineBadge}
                        </div>
                        <div class="chat-user-details">
                            <div class="chat-user-row1">
                                <h4 class="chat-user-name">${nameDisplay}</h4>
                                <span class="chat-user-timestamp">${conv.timestamp ? formatTime(conv.timestamp) : ''}</span>
                            </div>
                            <div class="chat-user-row2">
                                <p class="chat-user-message">${conv.lastMessage || ''}</p>
                            </div>
                        </div>
                    </div>
                </button>
            `}).join('');

            // Restore Scroll
            container.scrollTop = scrollTop;

            container.querySelectorAll('.chat-user-button').forEach(btn => {
                btn.addEventListener('click', () => {
                    const otherUserId = btn.dataset.userId;
                    const name = btn.dataset.name;
                    const avatar = btn.dataset.avatar;
                    const online = btn.dataset.online === 'true'; 
                    selectedUser = { id: otherUserId, name, avatar, online };
                    container.querySelectorAll('.chat-user-button').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    
                    loadChatHistory(otherUserId);
                });
            });
        } catch (e) { console.error("renderUserList failed", e); }
    }

    App.startChatWithUser = async function(userObj) {
        if (!userObj || !userObj.id) return;
        if (!userId) await getCurrentUserId();
        selectedUser = { id: userObj.id, name: userObj.name, avatar: userObj.avatar };
        renderUserList(); 
        loadChatHistory(selectedUser.id);
    };

    App._presence = presence;

})(window.App = window.App || {});