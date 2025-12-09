// ChatPanel.js - DEBUG VERSION
// Add to window.App
(function(App) {

    const API_BASE = 'http://localhost:8000';
    let stompClient = null;
    let selectedUser = null;
    let currentMessages = [];
    let fileInput = null; 
    let userId = null; 
    let imageFileToUpload = null; 
    
    // NEW: State for typing and unread
    let typingTimeout = null;
    let firstUnreadId = null;

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
            log("Fetching current user ID...");
            const res = await App.fetchData('/api/my-profile');
            if (res.userId) { 
                userId = res.userId;
                log("Current User ID resolved:", userId);
                return userId;
            }
        } catch (e) {
            console.error("Failed to fetch current user ID", e);
        }
        return null;
    }

    // --- WebSocket Connection ---
    function connectWebSocket() {
        if (stompClient && stompClient.connected) {
            log("WebSocket already connected.");
            return;
        }
        if (!userId) {
            log("Cannot connect WS: Missing UserId");
            return;
        }

        if (!window.SockJS || !window.Stomp) {
            console.error("SockJS or Stomp libraries missing.");
            return;
        }

        log("Initializing SockJS...");
        const socket = new SockJS('/ws');
        stompClient = Stomp.over(socket);
        stompClient.debug = (str) => { /* Silence internal STOMP logs */ }; 

        stompClient.connect({}, function(frame) {
            log('STOMP Connected!', frame);
            
            // 1. Messages Subscription
            const topic = `/user/${userId}/queue/messages`;
            log("Subscribing to topic:", topic);
            stompClient.subscribe(topic, function(messageOutput) {
                log("RAW WS MESSAGE RECEIVED:", messageOutput.body);
                try {
                    const msg = JSON.parse(messageOutput.body);
                    handleIncomingMessage(msg);
                } catch (e) {
                    console.error("JSON Parse Error on WS message:", e);
                }
            });
            
            // 2. Typing Indicators (NEW)
            stompClient.subscribe(`/user/${userId}/queue/typing`, function(output) {
                handleTypingEvent(JSON.parse(output.body));
            });
            
            // 3. Read Receipts (NEW)
            stompClient.subscribe(`/user/${userId}/queue/read-receipts`, function(output) {
                handleReadReceipt(JSON.parse(output.body));
            });

            // Also subscribe to public topic if needed, but for now just user queue
            renderUserList(); 

        }, function(error) {
            console.error('WebSocket Connection Error:', error);
            showNotification("Real-time connection lost. Refreshing...", "error");
        });
    }

    // --- NEW Handlers ---
    
    function handleTypingEvent(payload) {
        if (!selectedUser || String(payload.senderId) !== String(selectedUser.id)) return;
        
        const typingEl = document.getElementById('chat-typing-indicator');
        const statusEl = document.getElementById('chat-header-status');
        
        if (!typingEl || !statusEl) return;
        
        if (payload.isTyping) {
            typingEl.style.display = 'flex';
            statusEl.textContent = 'typing...';
            // Auto scroll to show typing bubble
            const scrollArea = document.getElementById('chat-messages-area');
            if(scrollArea) scrollArea.scrollTop = scrollArea.scrollHeight;
        } else {
            typingEl.style.display = 'none';
            statusEl.textContent = selectedUser.online ? 'Active now' : 'Offline'; // Reset status
        }
    }
    
    function handleReadReceipt(receipt) {
        console.log("Read receipt received:", receipt);
        // Update local messages status to READ
        let updated = false;
        currentMessages.forEach(m => {
            if (m.sender === 'me' && m.status !== 'READ') {
                m.status = 'READ';
                updated = true;
            }
        });
        if (updated) {
            const container = document.querySelector('#chat-messages-area .profile-content-wrapper');
            if (container) container.innerHTML = renderMessagesHTML();
        }
    }
    
    function sendTyping(isTyping) {
        if (stompClient && stompClient.connected && selectedUser) {
             stompClient.send("/app/typing", {}, JSON.stringify({
                 senderId: userId,
                 recipientId: selectedUser.id,
                 isTyping: isTyping
             }));
        }
    }
    
    async function sendReadReceipt(otherUserId, conversationId) {
        try {
             // If conversationId not provided, calculate it locally (must match backend logic)
             if (!conversationId) {
                 conversationId = Math.min(userId, otherUserId) + "_" + Math.max(userId, otherUserId);
             }
             
            await fetch(`${API_BASE}/api/chat/read`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ userId: userId, conversationId: conversationId })
            });
        } catch(e) { console.error("Failed to send read receipt", e); }
    }
    
    function getConversationId(u1, u2) {
        // Ensures conversation ID creation is consistent (smaller ID first)
        return Math.min(u1, u2) + "_" + Math.max(u1, u2);
    }


    function handleIncomingMessage(msg) {
        log("Processing Incoming Message Object:", msg);
        
        // Normalize IDs to strings for safe comparison
        const msgSenderId = String(msg.senderId);
        const msgRecipientId = String(msg.recipientId);
        const currentUserIdStr = String(userId);
        
        // Determine message type
        const type = (msgSenderId === currentUserIdStr) ? 'me' : 'other';
        
        // Resolve Media URL
        let mediaSrc = null;
        if (msg.mediaUrl) {
             mediaSrc = msg.mediaUrl.startsWith('http') ? msg.mediaUrl : `${API_BASE}/${msg.mediaUrl}`;
        }

        const displayMsg = {
            id: msg.id || Date.now(),
            sender: type,
            content: msg.content,
            image: mediaSrc,
            timestamp: new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            rawTimestamp: msg.timestamp, // Keep raw for date separators
            status: msg.status || 'SENT'
        };

        // --- CHECK CONVERSATION CONTEXT ---
        if (!selectedUser) {
            log("No conversation selected. Message stored in background.");
            renderUserList(); // Just update sidebar
            return;
        }

        const selectedIdStr = String(selectedUser.id);

        // Check if this message belongs to the OPEN conversation
        const isCurrentConversation = 
            (msgSenderId === currentUserIdStr && msgRecipientId === selectedIdStr) || 
            (msgSenderId === selectedIdStr && msgRecipientId === currentUserIdStr);

        log(`Is Current Conv? ${isCurrentConversation} | Sender: ${msgSenderId}, Selected: ${selectedIdStr}`);

        if (isCurrentConversation) {
            log("Appending message to active chat window...");
            
            // If message is from OTHER, stop typing animation and mark read
            if (type === 'other') {
                handleTypingEvent({ senderId: msgSenderId, isTyping: false });
                sendReadReceipt(selectedUser.id, getConversationId(userId, selectedUser.id));
            }

            // Check if we already optimistically added this message (deduplication)
            if (!currentMessages.some(m => m.id === displayMsg.id)) {
                 currentMessages.push(displayMsg);
                 
                 // Re-rendering or appending intelligently
                 const container = document.querySelector('#chat-messages-area .profile-content-wrapper');
                 if (container) {
                     // Check date separator need
                     const lastMsg = currentMessages[currentMessages.length - 2];
                     let htmlToAppend = '';
                     
                     if (lastMsg) {
                         const d1 = new Date(lastMsg.rawTimestamp).toDateString();
                         const d2 = new Date(displayMsg.rawTimestamp).toDateString();
                         if (d1 !== d2) htmlToAppend += renderDateSeparator(displayMsg.rawTimestamp);
                     }
                     
                     htmlToAppend += renderMessageBubble(displayMsg);
                     container.insertAdjacentHTML('beforeend', htmlToAppend);
                     
                     const scrollArea = document.getElementById('chat-messages-area');
                     if(scrollArea) scrollArea.scrollTop = scrollArea.scrollHeight;
                 }
            }
            log("DOM updated successfully.");
        } else {
            log("Message belongs to another conversation. Updating sidebar only.");
        }

        // Always refresh sidebar to update unread count/last message
        renderUserList(); 
    }
    
    // --- Render Helpers ---
    function renderStatusIcon(status, isMe) {
        if (!isMe) return '';
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
                        <p>${msg.content || ''}</p>
                        <div class="msg-meta">
                            <span class="message-time">${msg.timestamp || 'Now'}</span>
                            ${statusHtml}
                        </div>
                    </div>
                </div>
            </div>`;
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
        let unreadSeparatorPlaced = false;
        
        currentMessages.forEach(msg => {
            // 1. Date Separator
            const d = new Date(msg.rawTimestamp || msg.timestamp);
            const dStr = d.toDateString();
            
            if (dStr !== lastDateString) {
                html += renderDateSeparator(d);
                lastDateString = dStr;
            }
            
            // 2. Last Read Divider
            // Logic: If we have a lastReadId, and this message matches it, the NEXT one is new.
            // Simplified Logic: If backend provides `firstUnreadId`, place divider before it.
            if (firstUnreadId && String(msg.id) === String(firstUnreadId) && !unreadSeparatorPlaced) {
                 html += `<div class="last-read-divider"><span>Unread Messages</span></div>`;
                 unreadSeparatorPlaced = true;
            }

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
                        <h3>${user.name}</h3>
                        <p id="chat-header-status">${initialStatus}</p>
                    </div>
                </div>
            </div>
            <div class="chat-messages-area" id="chat-messages-area">
                <div class="profile-content-wrapper">
                    <div style="text-align:center; padding: 20px; color: #888;">Loading history...</div>
                </div>
                <!-- Typing Indicator (Hidden by default) -->
                <div id="chat-typing-indicator" class="typing-indicator" style="display:none;">
                    <span>${user.name} is typing</span>
                    <div class="typing-dots"><span>.</span><span>.</span><span>.</span></div>
                </div>
            </div>
            <div id="chat-emoji-picker-container"></div>
            
            <!-- INPUT AREA -->
            <div class="chat-input-area">
                <div id="chat-preview-container" class="image-preview-container" style="display:none; padding: 0.8rem 1.5rem 0 1.5rem; margin-bottom: 0.5rem; background: transparent;">
                    <div style="display:flex; align-items:center;">
                        <img id="chat-preview-img" src="" class="preview-img" style="height: 40px; width: auto; margin-right: 10px;">
                        <span id="chat-preview-text" style="color:#9ca3af; font-size:1.2rem;">Image ready to send.</span>
                        <button id="chat-remove-preview-btn" class="btn-remove-preview" title="Remove" style="margin-left: auto;">
                            ✕
                        </button>
                    </div>
                </div>

                <div class="chat-input-wrapper">
                     <button class="btn-icon" id="chat-photo-btn" title="Add Photo">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                     </button>
                     <button class="btn-icon" id="chat-emoji-btn" title="Add Emoji">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
                     </button>
                     <input type="file" id="chat-file-input" style="display: none;" accept="image/*">
                     <div class="chat-input-field-wrapper">
                        <input type="text" placeholder="Type a message..." class="chat-input-field" id="private-chat-input">
                     </div>
                     <button class="chat-send-btn" id="chat-send-btn"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button>
                </div>
            </div>
        `;
        attachChatListeners();
    }
    
    async function loadChatHistory(recipientId) {
        if (!userId) return;
        renderChatWindow(selectedUser); 
        
        try {
            log(`Fetching history for ${recipientId}...`);
            const res = await App.fetchData(`/api/messages/${recipientId}?senderId=${userId}`, {credentials: 'include'});
            
            let messages = [];
            if (Array.isArray(res)) {
                messages = res;
            } else {
                messages = res.messages || [];
                firstUnreadId = res.firstUnreadId; // Capture ID for separator
            }

            currentMessages = messages.map(msg => ({
                id: msg.id,
                sender: (String(msg.senderId) === String(userId)) ? 'me' : 'other',
                content: msg.content,
                image: msg.mediaUrl ? `${API_BASE}/${msg.mediaUrl}` : null, 
                timestamp: new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                rawTimestamp: msg.timestamp, // Needed for date logic
                status: msg.status
            }));

            const container = document.querySelector('#chat-messages-area .profile-content-wrapper');
            if (container) {
                container.innerHTML = renderMessagesHTML();
                
                const scrollArea = document.getElementById('chat-messages-area');
                
                // If unread divider exists, scroll to it; otherwise bottom
                const divider = document.querySelector('.last-read-divider');
                if (divider) {
                    divider.scrollIntoView({block: "center", behavior: "smooth"});
                } else {
                    if(scrollArea) scrollArea.scrollTop = scrollArea.scrollHeight;
                }
                
                // Trigger read receipt since we opened the chat
                sendReadReceipt(recipientId, getConversationId(userId, recipientId));
            }

        } catch (e) {
            console.error('Failed to load history:', e);
            const container = document.querySelector('#chat-messages-area .profile-content-wrapper');
            if(container) container.innerHTML = `<div style="color:red;padding:20px;text-align:center;">Failed to load history.</div>`;
        }
    }

    function attachChatListeners() {
        const sendBtn = document.getElementById('chat-send-btn');
        const input = document.getElementById('private-chat-input');
        const imageBtn = document.getElementById('chat-photo-btn');
        const emojiBtn = document.getElementById('chat-emoji-btn');
        fileInput = document.getElementById('chat-file-input'); 

        const previewContainer = document.getElementById('chat-preview-container');
        const removePreviewBtn = document.getElementById('chat-remove-preview-btn');

        const clearPreview = () => {
            imageFileToUpload = null;
            if(previewContainer) previewContainer.style.display = 'none';
            if(fileInput) fileInput.value = '';
        };

        const handleSend = async () => {
            const text = input.value.trim();
            const fileToSend = imageFileToUpload;

            if ((!text && !fileToSend) || !selectedUser || !stompClient || !userId) {
                log("Send aborted: Missing data or connection.");
                return;
            }
            
            // 1. OPTIMISTIC UI UPDATE
            const optimisticMsg = {
                id: 'temp-' + Date.now(),
                sender: 'me',
                content: text,
                image: fileToSend ? URL.createObjectURL(fileToSend) : null, 
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                rawTimestamp: new Date().toISOString(),
                status: 'SENT'
            };
            
            currentMessages.push(optimisticMsg);
            appendMessageToDOM(optimisticMsg); 
            
            input.value = '';
            clearPreview();
            input.focus();
            
            // Stop typing immediately
            sendTyping(false);

            let mediaUrl = null;

            if (fileToSend) {
                const formData = new FormData();
                formData.append('file', fileToSend);
                
                try {
                    log("Uploading image...");
                    const res = await fetch(`${API_BASE}/api/posts/create-media`, {
                        method: 'POST',
                        credentials: 'include',
                        body: formData
                    });
                    
                    if(res.ok) {
                        const data = await res.json();
                        mediaUrl = data.url; 
                        log("Image uploaded:", mediaUrl);
                    } else {
                        showNotification('Image upload failed.', 'error');
                        return;
                    }
                } catch(err) {
                    showNotification('Network error uploading image.', 'error');
                    return;
                }
            }

            // 2. Send STOMP Message
            const chatMessage = {
                senderId: userId,
                recipientId: selectedUser.id,
                content: text,
                mediaUrl: mediaUrl,
                type: mediaUrl ? 'IMAGE' : 'TEXT'
            };
            log("Sending STOMP:", chatMessage);
            stompClient.send("/app/chat", {}, JSON.stringify(chatMessage));
        };

        if(sendBtn) sendBtn.addEventListener('click', handleSend);
        if(input) {
            input.addEventListener('keypress', (e) => { 
                if(e.key === 'Enter') { e.preventDefault(); handleSend(); } 
            });
            
            // Typing Event Listener
            input.addEventListener('input', () => {
                if (input.value.length > 0) {
                    sendTyping(true);
                    clearTimeout(typingTimeout);
                    typingTimeout = setTimeout(() => sendTyping(false), 2000);
                } else {
                     sendTyping(false);
                }
            });
        }
        
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
        
        const closeBtn = document.getElementById('chat-remove-preview-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                clearPreview();
            });
        }
        
        if(emojiBtn) {
            emojiBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (window.App && typeof window.App.openEmojiPanel === 'function') {
                    window.App.openEmojiPanel((emoji) => {
                        input.value += emoji;
                        input.focus();
                    }, emojiBtn);
                }
            });
        }
    }
    
    // --- Helper: Reuse for optimistic and incoming ---
    function appendMessageToDOM(displayMsg) {
        const messageContainer = document.querySelector('#chat-messages-area .profile-content-wrapper');
        if (messageContainer) {
            const newBubbleHtml = renderMessageBubble(displayMsg);
            messageContainer.insertAdjacentHTML('beforeend', newBubbleHtml);
            
            const scrollArea = document.getElementById('chat-messages-area');
            if(scrollArea) scrollArea.scrollTop = scrollArea.scrollHeight;
        }
    }

    // --- Main Entry Point ---
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

        renderUserList();

        const searchInput = panel.querySelector('#chat-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                renderUserList(e.target.value);
            });
        }
        
        const addFriendBtn = panel.querySelector('#add-friend-btn');
        if (addFriendBtn) {
            addFriendBtn.addEventListener('click', () => {
                if(App.openFriendsModal) App.openFriendsModal();
            });
        }
    };

    async function renderUserList(filter = '') {
        const container = document.getElementById('chat-list-container');
        if (!container || !userId) return;

        try {
            const conversations = await App.fetchData(`/api/conversations?userId=${userId}`, {credentials: 'include'});
            const filtered = conversations.filter(c => c.name.toLowerCase().includes(filter.toLowerCase()));

            if (filtered.length === 0) {
                container.innerHTML = '<div style="padding: 20px; text-align: center; color: #888;">No conversations. Add friends to chat!</div>';
                return;
            }

            container.innerHTML = filtered.map(conv => {
                const isSelected = selectedUser?.id == conv.otherUserId;
                const nameDisplay = conv.name.replace(/^@/, '');
                const avatarSrc = conv.avatar ? (conv.avatar.startsWith('http') ? conv.avatar : `${API_BASE}/${conv.avatar}`) : `https://api.dicebear.com/7.x/avataaars/svg?seed=default`;
                const onlineBadge = conv.online ? '<div class="chat-user-online-badge"></div>' : '';

                return `
                <button class="chat-user-button ${isSelected ? 'active' : ''}" 
                        data-user-id="${conv.otherUserId}" 
                        data-name="${nameDisplay}" 
                        data-avatar="${avatarSrc}"
                        data-online="${conv.online || false}">
                    <div class="chat-user-inner">
                        <div class="chat-user-avatar-wrapper">
                            <img src="${avatarSrc}" alt="${nameDisplay}" class="chat-user-avatar">
                            ${onlineBadge}
                        </div>
                        <div class="chat-user-details">
                            <div class="chat-user-row1">
                                <h4 class="chat-user-name">${nameDisplay}</h4>
                                <span class="chat-user-timestamp">${conv.timestamp ? new Date(conv.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}</span>
                            </div>
                            <div class="chat-user-row2">
                                <p class="chat-user-message">${conv.lastMessage || ''}</p>
                                ${conv.unread > 0 ? `<span class="chat-user-unread">${conv.unread}</span>` : ''}
                            </div>
                        </div>
                    </div>
                </button>
            `}).join('');

            container.querySelectorAll('.chat-user-button').forEach(btn => {
                btn.addEventListener('click', () => {
                    const otherUserId = btn.dataset.userId;
                    const name = btn.dataset.name;
                    const avatar = btn.dataset.avatar;
                    const online = btn.dataset.online === 'true'; // get online status from data attr
                    selectedUser = { id: otherUserId, name, avatar, online };
                    container.querySelectorAll('.chat-user-button').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    loadChatHistory(otherUserId);
                });
            });
        } catch (e) { /* silent */ }
    }

    App.startChatWithUser = async function(userObj) {
        if (!userObj || !userObj.id) return;
        if (!userId) await getCurrentUserId();

        selectedUser = {
            id: userObj.id,
            name: userObj.name,
            avatar: userObj.avatar
        };
        
        renderUserList(); 
        loadChatHistory(selectedUser.id);
    };

})(window.App = window.App || {});