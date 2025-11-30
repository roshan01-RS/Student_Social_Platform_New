// Add to window.App
(function(App) {

    // --- Helper: Fetch HTML & Clean it ---
    async function loadHtml(url) {
        try {
            const response = await fetch(url + '?v=' + new Date().getTime());
            if (!response.ok) throw new Error(`Failed to load ${url}`);
            let text = await response.text();
            // Clean Live Server injections if present
            text = text.replace(/<!-- Code injected by live-server -->[\s\S]*?<\/script>/gi, "");
            return text;
        } catch (err) {
            console.error("HTML Load Error:", err);
            return null;
        }
    }

    // --- 1. Hardcoded HTML Template ---
    const CHAT_PANEL_HTML = `
    <div class="chat-layout">
        <!-- 1. Chat List Sidebar -->
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
                <!-- User list will be injected here -->
            </div>
        </div>

        <!-- 2. Chat Window -->
        <div class="chat-window" id="chat-window-container">
            <div class="chat-placeholder">
                <div style="text-align:center">
                    <div class="logo-icon-placeholder" style="width:6rem;height:6rem;background:#e5e7eb;border-radius:1.5rem;display:flex;align-items:center;justify-content:center;margin:0 auto 1rem;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:3rem;height:3rem"><path d="M18.37 8.18c-1.32-2.3-3.6-3.88-6.37-3.88-4.42 0-8 3.58-8 8s3.58 8 8 8c2.77 0 5.05-1.58 6.37-3.88"/></svg>
                    </div>
                    <p>Select a conversation</p>
                </div>
            </div>
        </div>
    </div>
    `;

    // --- Mock Data ---
    const chatUsers = [
        { id: '1', name: 'Sarah Johnson', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah', lastMessage: 'Thanks for the notes!', timestamp: '10m', unread: 2, online: true },
        { id: '2', name: 'Mike Chen', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Mike', lastMessage: 'See you at the study group', timestamp: '1h', unread: 0, online: true },
    ];
    
    const messageHistory = {
        '1': [
            { id: '1', sender: 'other', content: 'Hey! Do you have the notes from today\'s lecture?', timestamp: '10:30 AM' },
            { id: '2', sender: 'me', content: 'Yes! Let me send them to you', timestamp: '10:32 AM' },
            { id: '3', sender: 'other', content: 'Thanks for the notes!', timestamp: '10:35 AM' },
        ],
        '2': [{ id: '1', sender: 'other', content: 'See you at the study group', timestamp: '1h' }],
    };

    let selectedUser = null;
    let currentMessages = [];
    let fileInput = null; 

    // --- Helper: Get Template ---
    function getTemplate() {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = CHAT_PANEL_HTML;
        return tempDiv.firstElementChild;
    }

    // -----------------------------
    // Side-nav badge helpers
    // -----------------------------
    let _navFindAttempts = 0;
    const _navFindMaxAttempts = 12;
    const _navFindDelay = 200; // ms

    function findMessagesNavElement() {
        // try common selectors safely
        const selectors = [
            'a[href="#messages"]',
            'a[data-view="messages"]',
            'a[data-nav="messages"]',
            '#nav-messages',
            '.nav-messages',
            '.side-nav-messages',
            '.sidebar .nav-messages',
            '.side-panel a[title="Messages"]',
            '.side-panel .messages'
        ];
        for (const s of selectors) {
            try {
                const el = document.querySelector(s);
                if (el) return el;
            } catch (e) {
                // ignore invalid selector errors
            }
        }

        // fallback: scan anchors / buttons and match visible text "messages"
        const candidates = Array.from(document.querySelectorAll('a, button, div, span'));
        for (const el of candidates) {
            try {
                const txt = (el.textContent || '').trim().toLowerCase();
                if (!txt) continue;
                if (txt === 'messages' || txt === 'message' || txt.includes('messages') || txt.includes('message')) {
                    return el;
                }
            } catch (e) {
                // ignore
            }
        }
        return null;
    }

    function updateSideMessagesBadge() {
        const navEl = findMessagesNavElement();
        if (!navEl) {
            if (_navFindAttempts < _navFindMaxAttempts) {
                _navFindAttempts++;
                setTimeout(updateSideMessagesBadge, _navFindDelay);
            }
            return;
        }

        // compute total unread
        const totalUnread = chatUsers.reduce((sum, u) => sum + (u.unread || 0), 0);

        // try to find existing badge as a child of navEl
        let badge = navEl.querySelector('.side-nav-badge');

        if (totalUnread > 0) {
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'side-nav-badge';
                // append badge; prefer appending inside navEl, but if navEl is an inline element or cannot accept children, try its parent
                try {
                    navEl.appendChild(badge);
                } catch (e) {
                    if (navEl.parentElement) navEl.parentElement.appendChild(badge);
                    else document.body.appendChild(badge);
                }
            }
            badge.textContent = totalUnread > 99 ? '99+' : String(totalUnread);
            badge.style.display = ''; // ensure visible if previously hidden
        } else {
            if (badge) badge.remove();
        }
    }

    function clearUnreadForUser(userId) {
        const idx = chatUsers.findIndex(u => u.id === userId);
        if (idx === -1) return;
        chatUsers[idx].unread = 0;
        updateSideMessagesBadge();
    }

    // Expose small API to increment unread from other modules
    App.incrementUnread = function(userId, by = 1, lastMessageText = '', name, avatar, timestamp) {
        const idx = chatUsers.findIndex(u => u.id === userId);
        if (idx === -1) {
            const newUser = {
                id: userId,
                name: name || ('User ' + userId),
                avatar: avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name || userId)}`,
                lastMessage: lastMessageText || '',
                timestamp: timestamp || '',
                unread: by,
                online: false
            };
            chatUsers.unshift(newUser);
            messageHistory[userId] = messageHistory[userId] || [];
        } else {
            chatUsers[idx].unread = (chatUsers[idx].unread || 0) + by;
            if (lastMessageText) chatUsers[idx].lastMessage = lastMessageText.slice(0,40);
            if (timestamp) chatUsers[idx].timestamp = timestamp;
        }
        renderUserList();
    };

    // Generic incoming-message event listener
    document.addEventListener('incoming-message', (ev) => {
        if (!ev || !ev.detail) return;
        const { userId, content, timestamp, name, avatar } = ev.detail;
        const idx = chatUsers.findIndex(u => u.id === userId);
        if (idx === -1) {
            const newUser = {
                id: userId,
                name: name || ('User ' + userId),
                avatar: avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name || userId)}`,
                lastMessage: content || '',
                timestamp: timestamp || '',
                unread: 1,
                online: false
            };
            chatUsers.unshift(newUser);
            messageHistory[userId] = messageHistory[userId] || [];
        } else {
            if (selectedUser && selectedUser.id === userId) {
                currentMessages.push({ id: Date.now().toString(), sender: 'other', content: content, timestamp: timestamp || 'Now' });
                messageHistory[userId] = currentMessages;
                renderChatWindow(selectedUser);
                chatUsers[idx].unread = 0;
            } else {
                chatUsers[idx].unread = (chatUsers[idx].unread || 0) + 1;
                if (content) chatUsers[idx].lastMessage = content.slice(0,40);
                if (timestamp) chatUsers[idx].timestamp = timestamp;
            }
        }
        renderUserList();
    });

    // ------------------------------------------------------------
    // EXPOSED: Start chat with a user object (adds to list if needed)
    // ------------------------------------------------------------
    App.startChatWithUser = function(userObj) {
        if (!userObj || !userObj.name) return;
        let user = null;
        if (userObj.id) {
            user = chatUsers.find(u => u.id === userObj.id);
        }
        if (!user) {
            user = chatUsers.find(u => u.name === userObj.name);
        }

        if (!user) {
            const newId = userObj.id || Date.now().toString();
            user = {
                id: newId,
                name: userObj.name,
                avatar: userObj.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(userObj.name)}`,
                lastMessage: '',
                timestamp: '',
                unread: 0,
                online: true
            };
            chatUsers.unshift(user);
            messageHistory[newId] = messageHistory[newId] || [];
        }

        selectedUser = user;
        currentMessages = messageHistory[user.id] || [];

        // clear unread for this user
        const idx = chatUsers.findIndex(u => u.id === user.id);
        if (idx !== -1) chatUsers[idx].unread = 0;
        updateSideMessagesBadge();

        renderChatWindow(selectedUser);
        renderUserList();
    };

    // Listen for external dispatches (from friend modal, profile, etc.)
    document.addEventListener('chat-start-new', (ev) => {
        const detail = ev && ev.detail ? ev.detail : null;
        if (!detail) return;
        if (window.handleNavigation) {
            window.handleNavigation('messages');
            setTimeout(() => App.startChatWithUser(detail), 150);
        } else {
            App.startChatWithUser(detail);
        }
    });

    // --- Friends Modal Logic (uses existing modal shell) ---
    App.openFriendsModal = async () => {
        console.log("[ChatPanel] Opening Friends Modal...");
        const friendsModal = document.getElementById('reusable-modal');
        const friendsModalContent = document.getElementById('reusable-modal-content');
        const closeFriendsBtn = friendsModal ? friendsModal.querySelector('.js-close-modal') : null;

        if (!friendsModal || !friendsModalContent) {
            console.error("CRITICAL: #reusable-modal not found in DOM.");
            return;
        }

        try {
            friendsModalContent.innerHTML = '<div style="padding:5rem;text-align:center;color:#666;">Loading...</div>';
            friendsModal.style.display = 'flex';
            const modalHtml = await loadHtml('friend_list.html');
            if (!modalHtml) {
                friendsModalContent.innerHTML = '<p style="color:red;padding:20px;">Error loading friend_list.html</p>';
                return;
            }
            friendsModalContent.innerHTML = modalHtml;
            setTimeout(() => friendsModal.classList.add('show'), 10);
            friendsModal.classList.add('modal-large');

            const close = () => {
                friendsModal.classList.remove('show');
                friendsModal.classList.remove('modal-large');
                setTimeout(() => {
                    friendsModal.style.display = 'none';
                    friendsModalContent.innerHTML = '';
                }, 300);
            };

            if (closeFriendsBtn) {
                const newCloseBtn = closeFriendsBtn.cloneNode(true);
                closeFriendsBtn.parentNode.replaceChild(newCloseBtn, closeFriendsBtn);
                newCloseBtn.addEventListener('click', close);
            }
            
            const innerCloseBtns = friendsModalContent.querySelectorAll('.js-close-modal');
            innerCloseBtns.forEach(btn => btn.addEventListener('click', close));

            friendsModal.onclick = (e) => {
                if (e.target === friendsModal) close();
            };

            const listItems = friendsModalContent.querySelectorAll('.friend-list-item');
            listItems.forEach(item => {
                 const messageBtn = item.querySelector('.btn-primary');
                 const unfriendBtn = item.querySelector('.btn-unfriend');
                 const friendNameEl = item.querySelector('.friend-name');
                 const avatarEl = item.querySelector('.friend-avatar');
                 const friendName = friendNameEl ? friendNameEl.textContent.trim() : null;
                 const friendAvatar = avatarEl ? avatarEl.src : null;

                 if (messageBtn) {
                     messageBtn.addEventListener('click', () => {
                         close();
                         const payload = {
                             id: 'friend-' + Date.now().toString(),
                             name: friendName,
                             avatar: friendAvatar
                         };
                         if (window.handleNavigation) {
                             window.handleNavigation('messages');
                             setTimeout(() => {
                                 document.dispatchEvent(new CustomEvent('chat-start-new', { detail: payload }));
                                 if (App.startChatWithUser) App.startChatWithUser(payload);
                             }, 150);
                         } else {
                             document.dispatchEvent(new CustomEvent('chat-start-new', { detail: payload }));
                             if (App.startChatWithUser) App.startChatWithUser(payload);
                         }
                     });
                 }
                 
                 if (unfriendBtn) {
                     unfriendBtn.addEventListener('click', () => {
                         if (unfriendBtn.textContent.trim() === 'Unfriend') {
                             unfriendBtn.textContent = 'Add Friend';
                             unfriendBtn.classList.remove('btn-unfriend');
                             unfriendBtn.classList.add('btn-primary');
                             unfriendBtn.style.backgroundColor = '#4f46e5';
                             unfriendBtn.style.color = 'white';
                             unfriendBtn.style.border = 'none';
                         } else {
                             unfriendBtn.textContent = 'Unfriend';
                             unfriendBtn.classList.remove('btn-primary');
                             unfriendBtn.classList.add('btn-unfriend');
                             unfriendBtn.style.backgroundColor = 'transparent';
                             unfriendBtn.style.border = '1px solid #d1d5db';
                             unfriendBtn.style.color = '#374151';
                         }
                     });
                 }
            });

        } catch (e) {
            console.error("Error opening modal:", e);
        }
    };

    // --- Main Render ---
    App.renderMessages = async (panel) => {
        console.log("[ChatPanel] Rendering Main View...");
        const template = getTemplate();
        panel.innerHTML = ''; 
        panel.appendChild(template); 

        renderUserList();
        renderChatWindow(selectedUser);

        const searchInput = panel.querySelector('#chat-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                renderUserList(e.target.value);
            });
        }
        
        const addFriendBtn = panel.querySelector('#add-friend-btn');
        if (addFriendBtn) {
            addFriendBtn.addEventListener('click', () => {
                App.openFriendsModal();
            });
        }

        // ensure badge is placed as soon as the view mounts
        updateSideMessagesBadge();
    };

    function renderUserList(filter = '') {
        const container = document.getElementById('chat-list-container');
        if (!container) return;

        const filteredUsers = chatUsers.filter(user => 
            user.name.toLowerCase().includes(filter.toLowerCase())
        );

        container.innerHTML = filteredUsers.map(user => `
            <button class="chat-user-button ${selectedUser?.id === user.id ? 'active' : ''}" data-user-id="${user.id}">
                <div class="chat-user-inner">
                    <div class="chat-user-avatar-wrapper">
                        <img src="${user.avatar}" alt="${user.name}" class="chat-user-avatar">
                        ${user.online ? '<div class="chat-user-online-badge"></div>' : ''}
                    </div>
                    <div class="chat-user-details">
                        <div class="chat-user-row1">
                            <h4 class="chat-user-name">${user.name}</h4>
                            <span class="chat-user-timestamp">${user.timestamp}</span>
                        </div>
                        <div class="chat-user-row2">
                            <p class="chat-user-message">${user.lastMessage}</p>
                            ${user.unread ? `<span class="chat-user-unread">${user.unread}</span>` : ''}
                        </div>
                    </div>
                </div>
            </button>
        `).join('');

        // Update the side-nav badge after rendering
        updateSideMessagesBadge();

        container.querySelectorAll('.chat-user-button').forEach(btn => {
            btn.addEventListener('click', () => {
                const userId = btn.dataset.userId;
                selectedUser = chatUsers.find(u => u.id === userId) || null;
                if (selectedUser) {
                    currentMessages = messageHistory[selectedUser.id] || [];
                    // clear unread for the clicked user
                    clearUnreadForUser(selectedUser.id);
                    renderChatWindow(selectedUser);
                    renderUserList(filter); 
                }
            });
        });
    }

    function renderChatWindow(user) {
        const container = document.getElementById('chat-window-container');
        if (!container) return;

        if (!user) {
            container.innerHTML = `
            <div class="chat-placeholder">
                <div class="logo-icon-placeholder" style="width:6rem;height:6rem;background:#e5e7eb;border-radius:1.5rem;display:flex;align-items:center;justify-content:center;margin:0 auto 1rem;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:3rem;height:3rem"><path d="M18.37 8.18c-1.32-2.3-3.6-3.88-6.37-3.88-4.42 0-8 3.58-8 8s3.58 8 8 8c2.77 0 5.05-1.58 6.37-3.88"/></svg>
                </div>
                
                <p>Enjoy chatting</p>
            </div>`;
            return;
        }

        container.innerHTML = `
            <div class="chat-window-header">
                <div class="chat-window-userinfo">
                    <div class="chat-user-avatar-wrapper">
                        <img src="${user.avatar}" alt="${user.name}" class="chat-user-avatar" style="width:4rem;height:4rem;border-radius:50%;">
                        ${user.online ? '<div class="chat-user-online-badge"></div>' : ''}
                    </div>
                    <div>
                        <h3>${user.name}</h3>
                        <p>${user.online ? 'Active now' : 'Offline'}</p>
                    </div>
                </div>
            </div>
            <div class="chat-messages-area" id="chat-messages-area">
                <div class="profile-content-wrapper">
                    ${renderMessages()}
                </div>
            </div>
            
            <!-- Emoji Panel Container -->
            <div id="chat-emoji-picker-container"></div>

            <div class="chat-input-area">
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

        const messageArea = document.getElementById('chat-messages-area');
        if(messageArea) messageArea.scrollTop = messageArea.scrollHeight;
        attachChatListeners();
    }

    function renderMessages() {
        return currentMessages.map(msg => `
            <div class="message-bubble-wrapper ${msg.sender}">
                <div class="message-bubble ${msg.sender}">
                    ${msg.image ? `<img src="${msg.image}" alt="Shared">` : ''}
                    <div class="message-bubble-content">
                        <p>${msg.content}</p>
                        <span class="message-time">${msg.timestamp || 'Now'}</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    function attachChatListeners() {
        const sendBtn = document.getElementById('chat-send-btn');
        const input = document.getElementById('private-chat-input');
        const imageBtn = document.getElementById('chat-photo-btn');
        const emojiBtn = document.getElementById('chat-emoji-btn');
        fileInput = document.getElementById('chat-file-input'); 

        const handleSend = () => {
            if (!input.value.trim() || !selectedUser) return;
            const now = new Date();
            const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const message = {
                id: Date.now().toString(),
                sender: 'me',
                content: input.value,
                timestamp: timeString,
            };
            currentMessages.push(message);
            // persist
            messageHistory[selectedUser.id] = currentMessages;
            input.value = '';
            const messageContainer = document.querySelector('#chat-messages-area .profile-content-wrapper');
            if (messageContainer) {
                messageContainer.innerHTML = renderMessages();
                messageContainer.parentElement.scrollTop = messageContainer.parentElement.scrollHeight;
            }
            // update user list last message
            const userIndex = chatUsers.findIndex(u => u.id === selectedUser.id);
            if (userIndex !== -1) {
                chatUsers[userIndex].lastMessage = message.content.slice(0, 40);
            }
            renderUserList();
        };

        const handleImageSelect = (e) => {
            const file = e.target.files?.[0];
            if (!file || !selectedUser) return;
            const now = new Date();
            const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const reader = new FileReader();
            reader.onload = function(evt) {
                const message = {
                    id: Date.now().toString(),
                    sender: 'me',
                    content: '',
                    timestamp: timeString,
                    image: evt.target.result,
                };
                currentMessages.push(message);
                messageHistory[selectedUser.id] = currentMessages;
                const messageContainer = document.querySelector('#chat-messages-area .profile-content-wrapper');
                if (messageContainer) {
                    messageContainer.innerHTML = renderMessages();
                    messageContainer.parentElement.scrollTop = messageContainer.parentElement.scrollHeight;
                }
            };
            reader.readAsDataURL(file);
            fileInput.value = '';
        };

        sendBtn.addEventListener('click', handleSend);
        input.addEventListener('keypress', (e) => {
            if(e.key === 'Enter') handleSend();
        });
        imageBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', handleImageSelect);
        
        if(emojiBtn) {
            emojiBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (window.App && typeof window.App.openEmojiPanel === 'function') {
                    window.App.openEmojiPanel((emoji) => {
                        input.value += emoji;
                        input.focus();
                    }, emojiBtn);
                } else {
                    console.warn('EmojiPanel module not loaded.');
                    input.value += "😊";
                    input.focus();
                }
            });
        }
    }

    // Kick off initial attempt to add the side-nav badge right after script load.
    // updateSideMessagesBadge will retry a few times if nav isn't present yet.
    setTimeout(updateSideMessagesBadge, 60);

})(window.App = window.App || {});
