// GroupsPanel.js - Fully Integrated (Groups + Add Members + Previews + Robust Input + Group Typing + Reply)
(function(App) {

  const API_BASE = 'http://localhost:8000';
  let currentUser = null;
  let imageFileToUpload = null;
  let chatPollInterval = null;

  // 🔥 GROUP TYPING STATE
  const groupTypingState = new Map(); // userId -> { avatar, name, lastAt }
  let typingCleanupInterval = null;
  let typingSendTimeout = null;
  let stompClient = null;
  let lastTypingSentAt = 0;

  // 🔥 REPLY STATE
  let replyContext = null; 

  // --- Helper: Notification ---
  function showNotification(msg, type = 'success') {
      if (window.showGlobalNotification) window.showGlobalNotification(msg, type);
      else console.log(`[${type.toUpperCase()}] ${msg}`);
  }

  // --- Helper: Fetch HTML & Clean it ---
  async function loadHtml(url) {
    try {
      const fetchUrl = url.startsWith('/') ? url : `/${url}`;
      const response = await fetch(fetchUrl + '?v=' + new Date().getTime());
      if (!response.ok) throw new Error(`Failed to load ${url}`);
      let text = await response.text();
      text = text.replace(/<!-- Code injected by live-server -->[\s\S]*?<\/script>/gi, "");
      return text;
    } catch (err) { 
        console.error("HTML Load Error:", err);
        return null; 
    }
  }

  // --- Helper: Generate Group Avatar ---
  function getGroupAvatar(group) {
      if (group.icon && group.icon.length > 2) return group.icon; 
      const seed = group.name ? group.name.replace(/ /g, '') : 'Group';
      return `https://api.dicebear.com/7.x/initials/svg?seed=${seed}&backgroundColor=ffffff&textColor=4169E1`;
  }

  // --- Helper: Format Time ---
  function formatTime(isoString) {
      if (!isoString) return 'Just now';
      const date = new Date(isoString);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // --- Helper: Resolve Media URL (Fix for double HTTP prefix) ---
  function resolveMediaUrl(url) {
      if (!url) return '';
      if (url.startsWith('http://') || url.startsWith('https://')) {
          return url;
      }
      return `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
  }

  // ===========================
  // 🔥 WEBSOCKET (GROUP TYPING)
  // ===========================
  function connectGroupSocket() {
      if (stompClient && stompClient.connected) return;

      if (!window.SockJS || !window.Stomp) {
          console.warn("SockJS or Stomp missing. Group typing disabled.");
          return;
      }

      const socket = new SockJS('/ws');
      stompClient = Stomp.over(socket);
      stompClient.debug = () => {};

      stompClient.connect({}, () => {
          console.log('[GroupTyping] WS connected');
      });
  }

  function subscribeGroupTyping(groupId) {
      if (!stompClient || !stompClient.connected) return;

      // Subscribe to typing topic for this specific group
      stompClient.subscribe(`/topic/group/${groupId}/typing`, msg => {
          const data = JSON.parse(msg.body || '{}');
          handleGroupTypingEvent(data);
      });
  }

  function sendGroupTyping(isTyping) {
      if (!stompClient || !stompClient.connected || !selectedGroup) return;

      const now = Date.now();
      // Rate limit to prevent flooding
      if (isTyping && now - lastTypingSentAt < 700) return;
      if (isTyping) lastTypingSentAt = now;

      // Prepare Real Avatar URL
      let avatarUrl = null;
      if (currentUser) {
          if (currentUser.avatarUrl) {
              avatarUrl = currentUser.avatarUrl.startsWith('http') 
                  ? currentUser.avatarUrl 
                  : `${API_BASE}/${currentUser.avatarUrl}`;
          } else {
              avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.username}`;
          }
      }

      // Ensure backend handles this destination
      stompClient.send('/app/group.typing', {}, JSON.stringify({
          groupId: selectedGroup.id,
          senderId: currentUser.userId,
          name: currentUser.username, // Send Real Name
          avatar: avatarUrl,          // Send Real Avatar
          isTyping: isTyping
      }));
  }

  // ===========================
  // 🔥 HANDLE TYPING EVENTS
  // ===========================
  function handleGroupTypingEvent(payload) {
      if (!selectedGroup || payload.groupId !== selectedGroup.id) return;
      // Ignore own typing events
      if (!payload.senderId || String(payload.senderId) === String(currentUser.userId)) return;

      const now = Date.now();

      if (payload.isTyping) {
          groupTypingState.set(payload.senderId, {
              avatar: payload.avatar || null,
              name: payload.name || 'User',
              lastAt: now
          });
      } else {
          groupTypingState.delete(payload.senderId);
      }

      renderGroupTypingIndicator();
  }

  function cleanupTypingState() {
      const now = Date.now();
      let changed = false;

      groupTypingState.forEach((v, k) => {
          // Auto-remove if no update for 3 seconds
          if (now - v.lastAt > 3000) {
              groupTypingState.delete(k);
              changed = true;
          }
      });

      if (changed) renderGroupTypingIndicator();
  }

  // ===========================
  // 🔥 TYPING INDICATOR UI (UPDATED - REAL AVATAR QUEUE)
  // ===========================
  function renderGroupTypingIndicator() {
      const container = document.getElementById('group-typing-indicator');
      if (!container) return;

      const entries = Array.from(groupTypingState.values());
      if (entries.length === 0) {
          container.style.display = 'none';
          container.innerHTML = '';
          return;
      }

      // Take up to 3 users for the queue display
      const visibleTypers = entries.slice(0, 3);
      
      // Generate the avatar queue HTML with overlap
      const avatarQueueHtml = visibleTypers.map((u, index) => {
          const avatarUrl = u.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.name}`;
          // Apply negative margin for overlap on subsequent items
          const overlapStyle = index > 0 ? 'margin-left: -10px;' : '';
          // Z-index ensures correct stacking order
          return `<img src="${avatarUrl}" class="msg-avatar typing-avatar" 
                       style="width: 28px; height: 28px; border-radius: 50%; object-fit: cover; 
                              flex-shrink: 0; border: 2px solid white; position: relative; z-index: ${index}; ${overlapStyle}">`;
      }).join('');

      container.innerHTML = `
        <div class="message-wrapper-outer">
            <!-- Name Label Removed -->
            <div class="message-bubble-wrapper other">
                <div class="typing-avatar-queue" style="display: flex; align-items: flex-end; margin-right: 6px;">
                    ${avatarQueueHtml}
                </div>
                <div class="message-bubble other">
                    <div class="message-bubble-content">
                         <!-- Standard Animated Dots -->
                         <div class="typing-dots-container" style="display: flex; align-items: center; gap: 4px; padding: 4px 0; min-width: 40px; justify-content: center;">
                            <span class="typing-dot" style="width: 6px; height: 6px; background-color: #90949c; border-radius: 50%; animation: typingBounce 1.4s infinite ease-in-out both; animation-delay: 0s;"></span>
                            <span class="typing-dot" style="width: 6px; height: 6px; background-color: #90949c; border-radius: 50%; animation: typingBounce 1.4s infinite ease-in-out both; animation-delay: 0.2s;"></span>
                            <span class="typing-dot" style="width: 6px; height: 6px; background-color: #90949c; border-radius: 50%; animation: typingBounce 1.4s infinite ease-in-out both; animation-delay: 0.4s;"></span>
                        </div>
                        <style>
                            @keyframes typingBounce {
                                0%, 60%, 100% { transform: translateY(0); }
                                30% { transform: translateY(-4px); }
                            }
                        </style>
                    </div>
                </div>
            </div>
        </div>
      `;
      container.style.display = 'block';
  }
  
  // 🔥 RENDER REPLY PREVIEW (NEW)
  function renderReplyPreview(container) {
    let area = container.querySelector('#group-reply-preview');
    if (!area) {
        // Create if missing inside chat input wrapper (prepended)
        const wrapper = container.querySelector('.chat-input-wrapper');
        if (wrapper) {
            area = document.createElement('div');
            area.id = 'group-reply-preview';
            area.style.cssText = 'display:none; padding:8px 12px; background:#f0f9ff; border-left:4px solid #4169E1; margin-bottom:5px; border-radius:4px; justify-content:space-between; align-items:center; width:100%; box-sizing:border-box;';
            wrapper.parentElement.insertBefore(area, wrapper); // Insert BEFORE input wrapper
        } else {
             return;
        }
    }

    if (!replyContext) {
      area.style.display = 'none';
      return;
    }

    area.innerHTML = `
      <div style="flex:1; overflow:hidden;">
        <strong style="color:#4169E1; font-size:0.9rem;">Replying to ${replyContext.senderName}</strong>
        <div style="font-size:0.9rem; opacity:0.8; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${replyContext.content}</div>
      </div>
      <button id="clear-reply-btn" style="background:none; border:none; cursor:pointer; color:#666; font-size:1.2rem; padding:0 5px;">✕</button>
    `;
    area.style.display = 'flex';

    area.querySelector('#clear-reply-btn').onclick = () => {
      replyContext = null;
      renderReplyPreview(container);
    };
  }


  // --- Layout HTML (main) ---
  // 🔥 Fixed: Included <style> and correct structure
  const GROUPS_LAYOUT_HTML = `
    <style>
      .reply-msg-btn { opacity: 0; transition: opacity 0.2s; }
      .message-bubble:hover .reply-msg-btn { opacity: 1; }
    </style>
    <div class="groups-layout">
        <div class="groups-list-sidebar">
            <div class="groups-list-header">
                <!-- Header Top: Just the Create Button -->
                <div class="groups-header-top">
                    <button class="btn-create-group" id="create-group-btn" style="width: 100%; justify-content: center;" title="Create New Group">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        Create New Group
                    </button>
                </div>
                <!-- Search Bar -->
                <div class="chat-search-wrapper">
                    <svg class="chat-search-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clip-rule="evenodd" /></svg>
                    <input type="text" id="groups-search-input" placeholder="Search groups..." class="chat-search-input">
                </div>
            </div>
            <div class="groups-list-scroll-area" id="groups-list-container">
                <div style="padding: 20px; text-align: center; color: #888;">Loading groups...</div>
            </div>
        </div>

        <div class="chat-window" id="group-chat-window">
            <div class="chat-placeholder">
                <div class="logo-icon-placeholder" style="width:6rem;height:6rem;background:#e5e7eb;border-radius:1.5rem;display:flex;align-items:center;justify-content:center;margin:0 auto 1rem;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:3rem;height:3rem"><path d="M18.37 8.18c-1.32-2.3-3.6-3.88-6.37-3.88-4.42 0-8 3.58-8 8s3.58 8 8 8c2.77 0 5.05-1.58 6.37-3.88"/></svg>
                </div>
                <p>Select a group to start chatting</p>
            </div>
        </div>
    </div>`;

  let groups = [];
  let selectedGroup = null;
  let mainPanelRef = null;

  async function fetchCurrentUser() {
      if(currentUser) return;
      try { currentUser = await App.fetchData('/api/my-profile'); } catch(e){}
  }

  App.renderGroups = async (panel) => {
    mainPanelRef = panel;
    await fetchCurrentUser();
    
    // 🔥 Connect WS on load
    connectGroupSocket();

    // 🔥 FIXED: Used correct variable name 'GROUPS_LAYOUT_HTML'
    panel.innerHTML = GROUPS_LAYOUT_HTML;
    await fetchGroups();
    renderGroupList(panel);
    
    const searchInput = panel.querySelector('#groups-search-input');
    if (searchInput) searchInput.addEventListener('input', (e) => renderGroupList(panel, e.target.value));
    
    const createGroupBtn = panel.querySelector('#create-group-btn');
    if (createGroupBtn) createGroupBtn.addEventListener('click', openCreateGroupModal);
  };

  async function fetchGroups() {
      try {
          const res = await App.fetchData('/api/groups');
          if (Array.isArray(res)) {
              groups = res.map(g => ({
                  id: g.id,
                  name: g.name,
                  icon: getGroupAvatar(g),
                  memberCount: g.memberIds ? g.memberIds.length : 0,
                  ownerId: g.ownerId,
                  memberIds: g.memberIds || [],
                  joinRequests: g.joinRequests || [],
                  lastMessage: g.lastMessage || 'No messages yet',
                  timestamp: App.formatTime ? App.formatTime(g.lastUpdated) : '',
                  unreadCount: 0
              }));
          }
      } catch(e) { console.error("Failed to fetch groups", e); }
  }

  function renderGroupList(panel, filter = '') {
    const listContainer = panel.querySelector('#groups-list-container');
    if (!listContainer) return;
    const filtered = groups.filter(g => g.name.toLowerCase().includes(filter.toLowerCase()));
    
    if (filtered.length === 0) {
      listContainer.innerHTML = '<div style="padding:20px; text-align:center; color:#888;">No groups found</div>';
      return;
    }

    listContainer.innerHTML = filtered.map(group => {
      const isMember = currentUser && group.memberIds.includes(Number(currentUser.userId));
      const statusLabel = !isMember ? '<span style="font-size:0.7rem; background:#fee2e2; color:#ef4444; padding:2px 6px; border-radius:4px; margin-left:5px;">Left</span>' : '';
      
      const avatarHtml = group.icon.includes('http') 
        ? `<img src="${group.icon}" class="group-icon-img" style="width:3.5rem;height:3.5rem;border-radius:50%;object-fit:cover;">`
        : `<div class="group-icon-wrapper" style="width:3.5rem;height:3.5rem;border-radius:50%;background:#ffffff;border:1px solid #e5e7eb;display:flex;align-items:center;justify-content:center;font-size:1.5rem;color:#4169E1;">${group.icon}</div>`;

      return `<button class="group-item-button ${selectedGroup?.id === group.id ? 'active' : ''}" data-group-id="${group.id}">
        <div class="group-item-inner">
          ${avatarHtml}
          <div class="group-item-details">
            <div class="group-row1">
              <span class="group-name">${group.name} ${statusLabel}</span>
              <span class="group-time">${group.timestamp || ''}</span>
            </div>
            <div class="group-last-message">${group.lastMessage || ''}</div>
            <div class="group-meta-row">
              <span>${group.memberCount} members</span>
            </div>
          </div>
        </div>
      </button>`;
    }).join('');

    listContainer.querySelectorAll('.group-item-button').forEach(btn => {
      btn.addEventListener('click', () => {
        const groupId = btn.dataset.groupId;
        selectedGroup = groups.find(g => g.id === groupId);
        replyContext = null; // Reset reply on switch
        renderGroupList(panel, filter);
        renderGroupChat(panel);
      });
    });
  }

  // --- Real-time Sidebar Update ---
  function updateGroupSidebar(groupId, lastMessage, timestamp) {
      const g = groups.find(x => x.id === groupId);
      if (g) {
          g.lastMessage = lastMessage;
          g.timestamp = timestamp;
      }
      const btn = document.querySelector(`.group-item-button[data-group-id="${groupId}"]`);
      if (btn) {
          const msgEl = btn.querySelector('.group-last-message');
          const timeEl = btn.querySelector('.group-time');
          if (msgEl) msgEl.textContent = lastMessage;
          if (timeEl) timeEl.textContent = timestamp;
          const container = document.getElementById('groups-list-container');
          if (container && btn !== container.firstElementChild) {
              container.prepend(btn);
          }
      } else {
          if (mainPanelRef) renderGroupList(mainPanelRef);
      }
  }

  async function renderGroupChat(panel) {
    if (chatPollInterval) clearInterval(chatPollInterval);
    
    const chatContainer = panel.querySelector('#group-chat-window');
    if (!selectedGroup) {
      chatContainer.innerHTML = `<div class="chat-placeholder"><p>Select a group to start chatting</p></div>`;
      return;
    }

    const isOwner = currentUser && String(currentUser.userId) === String(selectedGroup.ownerId);
    const isMember = currentUser && selectedGroup.memberIds.includes(Number(currentUser.userId));
    
    const headerAvatar = selectedGroup.icon.includes('http') 
        ? `<img src="${selectedGroup.icon}" style="width:4rem;height:4rem;border-radius:50%;object-fit:cover;">`
        : `<div style="width:4rem;height:4rem;border-radius:50%;background:#ffffff;border:1px solid #e5e7eb;display:flex;align-items:center;justify-content:center;font-size:2rem;color:#4169E1;">${selectedGroup.icon}</div>`;

    chatContainer.innerHTML = `
    <div class="group-chat-header">
      <div class="group-header-info">
        ${headerAvatar}
        <div class="group-header-text">
          <h2>${selectedGroup.name}</h2>
          <p id="group-header-count">${selectedGroup.memberCount} members</p>
        </div>
      </div>
      <div class="group-header-actions" style="display:flex;gap:10px;">
        <button class="btn-icon" id="add-member-to-group-btn" title="Add Member">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
        </button>
        <button class="btn-icon" id="leave-group-btn" title="Leave Group" style="color:red;">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        </button>
      </div>
    </div>
    <div class="chat-messages-area" id="group-messages-area">
        <div style="text-align:center; padding:20px; color:#888;">Loading messages...</div>
    </div>
    
    <!-- 🔥 TYPING INDICATOR (Added here) -->
    <div id="group-typing-indicator" style="display:none; padding: 0 12px 6px 12px;"></div>

    <div class="chat-input-area" id="chat-input-area-container"></div>`;
    
    // Add Member
    const addMemberBtn = chatContainer.querySelector('#add-member-to-group-btn');
    addMemberBtn.addEventListener('click', () => {
        openAddMembersModal(selectedGroup, async (addedCount) => {
            selectedGroup.memberCount += addedCount;
            document.getElementById('group-header-count').textContent = `${selectedGroup.memberCount} members`;
            await loadAndRenderMessages(selectedGroup.id, chatContainer);
        });
    });

    // Leave Group
    const leaveBtn = chatContainer.querySelector('#leave-group-btn');
    if (leaveBtn) {
        if (!isMember) leaveBtn.style.display = 'none'; 
        leaveBtn.addEventListener('click', () => {
            openLeaveConfirmModal(async () => {
                try {
                    const res = await fetch(`${API_BASE}/api/groups/${selectedGroup.id}/leave`, {
                        method: 'POST', credentials: 'include'
                    });
                    if(res.ok) {
                        showNotification("You have left the group.");
                        await fetchGroups();
                        const updatedGroup = groups.find(g => g.id === selectedGroup.id);
                        if (updatedGroup) selectedGroup = updatedGroup;

                        renderGroupList(mainPanelRef);
                        renderGroupChat(mainPanelRef);
                    }
                } catch(e) { console.error(e); }
            });
        });
    }

    // 🔥 SUBSCRIBE TO TYPING
    subscribeGroupTyping(selectedGroup.id);
    if (!typingCleanupInterval) {
        typingCleanupInterval = setInterval(cleanupTypingState, 1000);
    }

    renderInputOrJoinButton(chatContainer, isMember);
    await loadAndRenderMessages(selectedGroup.id, chatContainer);
    
    if (isMember) {
        chatPollInterval = setInterval(() => {
            if(!document.contains(chatContainer)) { clearInterval(chatPollInterval); return; }
            loadAndRenderMessages(selectedGroup.id, chatContainer, true);
        }, 3000);
    }
  }

  function openLeaveConfirmModal(onConfirm) {
      const modal = document.createElement('div');
      modal.className = 'leave-modal-overlay';
      modal.style.cssText = "position:fixed; inset:0; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:10000; backdrop-filter:blur(2px);";
      
      modal.innerHTML = `
        <div class="leave-modal-card" style="background:white; padding:25px; border-radius:12px; box-shadow:0 10px 25px rgba(0,0,0,0.2); max-width:350px; width:90%; text-align:center;">
            <h3 style="margin-top:0; color:#1f2937;">Leave Group?</h3>
            <p style="color:#6b7280; margin:15px 0;">You will no longer receive messages from this group.</p>
            <div class="leave-modal-actions" style="display:flex; justify-content:center; gap:15px; margin-top:20px;">
                <button class="leave-btn-cancel" style="padding:8px 16px; border:1px solid #d1d5db; background:white; border-radius:6px; cursor:pointer;">Cancel</button>
                <button class="leave-btn-confirm" style="padding:8px 16px; border:none; background:#ef4444; color:white; border-radius:6px; cursor:pointer;">Leave</button>
            </div>
        </div>
      `;
      document.body.appendChild(modal);
      modal.querySelector('.leave-btn-cancel').addEventListener('click', () => modal.remove());
      modal.querySelector('.leave-btn-confirm').addEventListener('click', () => { modal.remove(); onConfirm(); });
  }

  function renderInputOrJoinButton(container, isMember) {
      const area = container.querySelector('#chat-input-area-container');
      area.innerHTML = '';

      if (isMember) {
          // --- ROBUST INPUT: TEXTAREA for wrapping + auto-expand ---
          area.innerHTML = `
          <div id="group-preview-container" class="image-preview-container" style="display:none; padding: 0.8rem 1.5rem 0 1.5rem; margin-bottom: 0.5rem; background: transparent;">
             <div style="display:flex; align-items:center;">
                 <img id="group-preview-img" src="" class="preview-img" style="height: 40px; width: auto; margin-right: 10px;">
                 <span id="group-preview-text" style="color:#9ca3af; font-size:1.2rem;">Image ready.</span>
                 <button id="group-remove-preview-btn" class="btn-remove-preview" title="Remove" style="margin-left: auto;">✕</button>
             </div>
          </div>
          <!-- 🔥 NEW: Reply Preview Container -->
          <div id="group-reply-preview" style="display:none; padding:8px 12px; background:#f0f9ff; border-left:4px solid #4169E1; margin-bottom:5px; border-radius:4px; justify-content:space-between; align-items:center; width:100%; box-sizing:border-box;"></div>

          <div class="chat-input-wrapper" style="align-items: flex-end; height: 70px;"> 
                <button class="btn-icon" id="chat-photo-btn" title="Add Photo" style="margin-bottom: 12px;">
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                </button>
                <button class="btn-icon" id="chat-emoji-btn" title="Add Emoji" style="margin-bottom: 12px;">
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
                </button>
                <input type="file" id="chat-file-input" style="display: none;" accept="image/*">
                <div class="chat-input-field-wrapper" style="flex: 1; display: flex; height: 100%; padding: 5px 0;">
                  <textarea placeholder="Type a message..." class="chat-input-field" id="group-chat-input" 
                      style="resize: none; overflow-y: auto; height: 100%; max-height: 100%; line-height: 1.4; padding: 12px 15px; border-radius: 20px; width: 100%; box-sizing: border-box; font-family: inherit; font-size: 1.25rem; border: 1px solid #e5e7eb; scrollbar-width: thin; scrollbar-color: #d1d5db transparent;"></textarea>
                </div>
                <button class="chat-send-btn" id="chat-send-btn" style="margin-bottom: 8px; width: 42px; height: 42px;"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button>
          </div>`;
          attachChatListeners(container);
          
          // Re-render preview if context persists (optional, usually cleared on switch)
          if(replyContext) renderReplyPreview(container);
      } else {
          // --- JOIN BUTTON (REPLACES INPUT) ---
          const isPending = selectedGroup.joinRequests && selectedGroup.joinRequests.includes(Number(currentUser.userId));
          
          area.innerHTML = `
          <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; padding:20px; gap:10px; background:#f9fafb; border-top:1px solid #e5e7eb;">
             <p style="color:#6b7280; font-weight:500;">To chat in this group, click on <strong>Join Group</strong>.</p>
             <button id="join-group-btn" style="background:#4169E1; color:white; border:none; padding:10px 20px; border-radius:8px; cursor:pointer; opacity: ${isPending ? 0.6 : 1};" ${isPending ? 'disabled' : ''}>
                ${isPending ? 'Request Sent' : 'Join Group'}
             </button>
          </div>`;
          
          const joinBtn = area.querySelector('#join-group-btn');
          if (!isPending) {
              joinBtn.addEventListener('click', async () => {
                  joinBtn.disabled = true;
                  joinBtn.textContent = 'Sending...';
                  try {
                      const res = await fetch(`${API_BASE}/api/groups/${selectedGroup.id}/join`, {
                          method: 'POST', credentials: 'include'
                      });
                      if (res.ok) {
                          const txt = await res.text();
                          showNotification(txt.includes("Already") ? "You are already a member." : "Request sent to group.");
                          // Update local state to reflect pending status
                          if(!selectedGroup.joinRequests) selectedGroup.joinRequests = [];
                          selectedGroup.joinRequests.push(Number(currentUser.userId));
                          renderInputOrJoinButton(container, false); 
                      } else {
                          showNotification("Failed to send request.", "error");
                          joinBtn.disabled = false;
                          joinBtn.textContent = 'Join Group';
                      }
                  } catch(e) { console.error(e); joinBtn.disabled = false; }
              });
          }
      }
  }

  function attachChatListeners(container) {
      const inputField = container.querySelector('#group-chat-input');
      const sendBtn = container.querySelector('#chat-send-btn');
      const photoBtn = container.querySelector('#chat-photo-btn');
      const emojiBtn = container.querySelector('#chat-emoji-btn');
      const fileInput = container.querySelector('#chat-file-input');
      const previewContainer = container.querySelector('#group-preview-container');
      const previewImg = container.querySelector('#group-preview-img');
      const removePreviewBtn = container.querySelector('#group-remove-preview-btn');

      const clearPreview = () => {
          imageFileToUpload = null;
          previewContainer.style.display = 'none';
          fileInput.value = '';
      };

      if(removePreviewBtn) removePreviewBtn.addEventListener('click', (e) => { e.preventDefault(); clearPreview(); });

      // 🔥 INPUT LISTENER FOR TYPING (Merged Logic)
      if (inputField) {
           inputField.addEventListener('input', () => {
               sendGroupTyping(true);
               clearTimeout(typingSendTimeout);
               typingSendTimeout = setTimeout(() => sendGroupTyping(false), 2000);
           });
           inputField.addEventListener('blur', () => sendGroupTyping(false));
           document.addEventListener('visibilitychange', () => { if (document.hidden) sendGroupTyping(false); });
      }

      if(sendBtn && inputField) {
          const handleSend = async () => {
              const text = inputField.value.trim();
              if(!text && !imageFileToUpload) return;
              
              let mediaUrl = null;
              if (imageFileToUpload) {
                  const formData = new FormData();
                  formData.append('file', imageFileToUpload);
                  try {
                      const upRes = await fetch(`${API_BASE}/api/posts/create-media`, { method: 'POST', credentials: 'include', body: formData });
                      if(upRes.ok) {
                          const data = await upRes.json();
                          mediaUrl = data.url ? `${API_BASE}/${data.url}` : null;
                      }
                  } catch(e) { showNotification("Image upload failed", "error"); return; }
              }
              
              try {
                  const payload = { 
                      content: text, 
                      mediaUrl: mediaUrl,
                      // 🔥 INCLUDE REPLY CONTEXT
                      replyToMessageId: replyContext?.messageId,
                      replyToSenderName: replyContext?.senderName,
                      replyToContent: replyContext?.content
                  };

                  const res = await fetch(`${API_BASE}/api/groups/${selectedGroup.id}/messages`, {
                      method: 'POST',
                      headers: {'Content-Type': 'application/json', 'credentials': 'include'},
                      body: JSON.stringify(payload)
                  });
                  
                  if (res.ok) {
                      inputField.value = '';
                      clearPreview();
                      // Clear reply context
                      replyContext = null;
                      renderReplyPreview(container);

                      // Immediate Stop Typing
                      sendGroupTyping(false);
                      const now = new Date();
                      const timeString = App.formatTime(now);
                      updateGroupSidebar(selectedGroup.id, mediaUrl ? '📷 Photo' : text, timeString);
                      loadAndRenderMessages(selectedGroup.id, container);
                  }
              } catch(e) { console.error("Send failed", e); }
          };

          sendBtn.addEventListener('click', handleSend);
          inputField.addEventListener('keypress', (e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } });
          
          if(photoBtn) {
               photoBtn.addEventListener('click', () => fileInput.click());
               fileInput.addEventListener('change', (e) => {
                   if(e.target.files && e.target.files[0]) {
                       imageFileToUpload = e.target.files[0];
                       const reader = new FileReader();
                       reader.onload = (evt) => {
                           previewImg.src = evt.target.result;
                           previewContainer.style.display = 'flex';
                           document.querySelector('#group-preview-text').textContent = `Image: ${imageFileToUpload.name}`;
                       };
                       reader.readAsDataURL(imageFileToUpload);
                   }
               });
          }
          if(emojiBtn) {
               emojiBtn.addEventListener('click', (e) => {
                   e.stopPropagation();
                   App.openEmojiPanel((emoji) => { inputField.value += emoji; inputField.focus(); }, emojiBtn);
               });
          }
      }
  }

  // --- HELPER: Render Message Bubble with optional image and text ---
  function renderMessageContent(msg) {
      let html = '';
      
      // 🔥 REPLY QUOTE
      if (msg.replyToContent) {
           html += `
             <div class="reply-quote" style="border-left: 3px solid #4169E1; padding-left: 8px; margin-bottom: 6px; opacity: 0.85; font-size: 0.9em; background: rgba(0,0,0,0.03); border-radius: 0 4px 4px 0;">
                <strong style="color: #4169E1; font-size: 0.85em;">${msg.replyToSenderName || 'User'}</strong>
                <div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${msg.replyToContent}</div>
             </div>`;
      }

      if (msg.type === 'IMAGE' && msg.mediaUrl) {
          const fullUrl = resolveMediaUrl(msg.mediaUrl);
          html += `
          <div class="msg-image-container" style="margin-bottom:5px;">
             <img src="${fullUrl}" style="max-width: 250px; border-radius: 8px; display: block; cursor: pointer;" onclick="window.open(this.src, '_blank')">
             <a href="${fullUrl}" download target="_blank" style="font-size:0.85rem; color:inherit; opacity:0.7; text-decoration:underline; display:block; margin-top:2px;">Download</a>
          </div>`;
      }
      if (msg.content) {
          html += `<p style="margin:0; word-wrap:break-word; word-break:break-word; white-space:pre-wrap;">${msg.content}</p>`;
      }
      return html;
  }

  async function loadAndRenderMessages(groupId, container, silent = false) {
      const messageArea = container.querySelector('#group-messages-area');
      try {
          const msgs = await App.fetchData(`/api/groups/${groupId}/messages`);
          if (!msgs || msgs.length === 0) {
              if(!silent) messageArea.innerHTML = `<div style="padding: 20px; text-align: center; color: #9ca3af;">Start of conversation</div>`;
              return;
          }
          
          let html = '';
          const latestMsg = msgs[msgs.length - 1];
          if (latestMsg && silent) {
              const prevLastMsg = selectedGroup.lastMessage;
              const newContent = latestMsg.type === 'IMAGE' ? '📷 Photo' : latestMsg.content;
              if (prevLastMsg !== newContent) {
                   const time = App.formatTime ? App.formatTime(latestMsg.timestamp) : '';
                   updateGroupSidebar(groupId, newContent, time);
              }
          }

          msgs.forEach(msg => {
              if (msg.type === 'SYSTEM') {
                  if (msg.content.startsWith('JOIN_REQ|')) {
                      const parts = msg.content.split('|');
                      const reqUserId = parts[1];
                      const reqName = parts[2];
                      html += `
                      <div class="system-message-wrapper" style="margin: 10px 0;">
                          <div class="system-message" style="background:#fff; border:1px solid #e5e7eb; padding:10px; border-radius:8px;">
                              <strong>${reqName}</strong> wants to join the group.
                              <div style="margin-top:8px; display:flex; gap:10px; justify-content:center;">
                                  <button class="join-action-btn" data-uid="${reqUserId}" data-accept="true" style="background:#10b981; color:white; border:none; padding:4px 12px; border-radius:4px; cursor:pointer;">Accept</button>
                                  <button class="join-action-btn" data-uid="${reqUserId}" data-accept="false" style="background:#ef4444; color:white; border:none; padding:4px 12px; border-radius:4px; cursor:pointer;">Reject</button>
                              </div>
                          </div>
                      </div>`;
                  } else {
                      html += `<div class="system-message-wrapper"><div class="system-message">${msg.content}</div></div>`;
                  }
              } else {
                  const isMe = currentUser && String(msg.senderId) === String(currentUser.userId);
                  const type = isMe ? 'me' : 'other';
                  const time = App.formatTime ? App.formatTime(msg.timestamp) : '';
                  const contentHtml = renderMessageContent(msg);
                  const avatarHtml = (type === 'other') ? `<img src="${msg.senderAvatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=User'}" class="msg-avatar">` : '';
                  const nameHtml = (type === 'other') 
                      ? `<div class="msg-sender-label" style="font-size:0.8rem; color:#6b7280; margin-left:50px; margin-bottom:2px;">${msg.senderName || 'User'}</div>` 
                      : '';
                  
                  // 🔥 ADDED REPLY BUTTON TO BUBBLE
                  // REMOVED inline opacity:0.6 and transition to allow CSS hover effect to work
                  const replyBtnHtml = `
                    <span class="reply-msg-btn" data-id="${msg.id}" data-sender="${msg.senderName || 'User'}" data-content="${msg.content || 'Photo'}" 
                          style="position:absolute; top:4px; right:${isMe ? 'auto' : '-24px'}; left:${isMe ? '-24px' : 'auto'}; cursor:pointer; font-size:1.2rem;" title="Reply">
                       ↩
                    </span>`;
                  
                  html += `
                  <div class="message-wrapper-outer" style="position:relative;">
                      ${nameHtml} 
                      <div class="message-bubble-wrapper ${type}">
                          ${type === 'other' ? avatarHtml : ''}
                          <div class="message-bubble ${type}">
                              <div class="message-bubble-content">
                                  ${contentHtml}
                                  <span class="message-time">${time}</span>
                              </div>
                              ${replyBtnHtml}
                          </div>
                      </div>
                  </div>`;
              }
          });
          
          if (messageArea.innerHTML !== `<div class="profile-content-wrapper" style="padding: 12px;">${html}</div>`) {
               messageArea.innerHTML = `<div class="profile-content-wrapper" style="padding: 12px;">${html}</div>`;
               if(!silent) messageArea.scrollTop = messageArea.scrollHeight;
               
               // Attach join actions
               messageArea.querySelectorAll('.join-action-btn').forEach(btn => {
                   btn.addEventListener('click', async () => {
                       const targetId = btn.dataset.uid;
                       const accept = btn.dataset.accept === 'true';
                       try {
                           await fetch(`${API_BASE}/api/groups/${selectedGroup.id}/approve`, {
                               method: 'POST',
                               headers: {'Content-Type': 'application/json', 'credentials': 'include'},
                               body: JSON.stringify({ targetUserId: parseInt(targetId), accept: accept })
                           });
                           loadAndRenderMessages(selectedGroup.id, container);
                       } catch(e) { console.error(e); }
                   });
               });
               
               // 🔥 ATTACH REPLY HANDLERS
               attachReplyHandlers(container);
          }

      } catch(e) { console.error("Msg load error", e); }
  }

  // 🔥 ATTACH REPLY HANDLERS FUNCTION
  function attachReplyHandlers(container) {
    container.querySelectorAll('.reply-msg-btn').forEach(btn => {
      btn.onclick = () => {
        replyContext = {
          messageId: btn.dataset.id,
          senderName: btn.dataset.sender,
          content: btn.dataset.content
        };
        renderReplyPreview(container);
        // Focus input
        const input = container.querySelector('#group-chat-input');
        if(input) input.focus();
      };
    });
  }

  // --- ADD MEMBERS MODAL ---
  async function openAddMembersModal(group, onMembersAdded) {
      const modalHtml = await loadHtml('add_members.html');
      if (!modalHtml) return;
      const modalContainer = document.getElementById('reusable-modal');
      const modalContent = document.getElementById('reusable-modal-content');
      modalContent.innerHTML = modalHtml;
      modalContainer.style.display = 'flex';
      setTimeout(() => modalContainer.classList.add('show'), 10);
      modalContainer.classList.add('modal-large');

      const closeModal = () => {
          modalContainer.classList.remove('show', 'modal-large');
          setTimeout(() => { modalContainer.style.display = 'none'; modalContent.innerHTML = ''; }, 300);
      };
      const closeBtn = modalContainer.querySelector('.js-close-modal');
      if (closeBtn) closeBtn.addEventListener('click', closeModal);

      const listContainer = modalContent.querySelector('#friends-selection-list');
      const confirmBtn = modalContent.querySelector('#confirm-add-members');
      const searchInput = modalContent.querySelector('#member-search-input');
      const searchBtn = modalContent.querySelector('#search-global-btn');
      const tabs = modalContent.querySelector('.am-tabs'); // To disable tabs

      // Determine ownership
      const isOwner = currentUser && String(currentUser.userId) === String(group.ownerId);

      // Handle Non-Admin State inside the modal logic
      if (!isOwner) {
          const amContainer = modalContent.querySelector('.am-container');
          if (amContainer) {
              amContainer.style.position = 'relative'; 

              const overlay = document.createElement('div');
              overlay.className = 'am-restriction-overlay';
              // Check dark mode for styling
              const isDark = document.body.classList.contains('dark-mode');
              const bg = isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.7)';
              const bannerBg = isDark ? '#374151' : '#fee2e2';
              const bannerColor = isDark ? '#f87171' : '#b91c1c';
              const bannerBorder = isDark ? '#4b5563' : '#fca5a5';

              overlay.style.cssText = `
                  position: absolute;
                  top: 0;
                  left: 0;
                  width: 100%;
                  height: 100%;
                  background-color: ${bg};
                  backdrop-filter: blur(3px);
                  z-index: 100;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  margin-top: 60px; /* Header height offset */
                  height: calc(100% - 60px);
              `;
              
              const banner = document.createElement('div');
              banner.style.cssText = `
                  background-color: ${bannerBg};
                  color: ${bannerColor};
                  padding: 1rem 2rem;
                  border-radius: 8px;
                  font-weight: 600;
                  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                  border: 1px solid ${bannerBorder};
                  text-align: center;
                  font-size: 1.1rem;
              `;
              banner.textContent = "Only admin can add new members";
              
              overlay.appendChild(banner);
              amContainer.appendChild(overlay);
              
              if(confirmBtn) confirmBtn.disabled = true;
          }
      }

      const selectedFriends = new Set();
      const tabFriends = modalContent.querySelector('[data-tab="friends"]');
      const tabGlobal = modalContent.querySelector('[data-tab="global"]');
      
      const switchTab = (mode) => {
          listContainer.innerHTML = '<div style="padding:20px;text-align:center;">Loading...</div>';
          searchInput.value = '';
          selectedFriends.clear();
          // Reset confirm button text only if owner (otherwise stays disabled/hidden)
          if(isOwner) {
              confirmBtn.setAttribute('disabled', 'true');
              confirmBtn.textContent = 'Add Members';
          }
          
          if(mode === 'friends') {
              tabFriends.classList.add('active');
              tabGlobal.classList.remove('active');
              searchBtn.style.display = 'none';
              loadFriends();
          } else {
              tabGlobal.classList.add('active');
              tabFriends.classList.remove('active');
              searchBtn.style.display = 'block';
              listContainer.innerHTML = '<div style="padding:20px;text-align:center;color:#888;">Type a username to search.</div>';
          }
      };

      if (tabFriends && tabGlobal) {
          tabFriends.addEventListener('click', () => switchTab('friends'));
          tabGlobal.addEventListener('click', () => switchTab('global'));
      }

      const renderList = (users) => {
          const currentMemberIds = new Set((group.memberIds || []).map(String));
          const available = users.filter(u => !currentMemberIds.has(String(u.userId)));

          if (available.length === 0) {
              listContainer.innerHTML = '<div style="padding:20px;text-align:center;color:#888;">No new users found.</div>';
              return;
          }

          listContainer.innerHTML = available.map(f => {
              const isSel = selectedFriends.has(String(f.userId));
              // Disable button if not owner
              const disabledAttr = !isOwner ? 'disabled style="opacity:0.6; cursor:not-allowed;"' : '';
              return `
              <button class="friend-select-item ${isSel?'selected':''}" data-fid="${f.userId}" ${disabledAttr}>
                  <div class="chat-user-avatar-wrapper">
                      <img src="${f.avatarUrl || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + f.username}" class="chat-user-avatar" style="width:3.6rem;height:3.6rem;border-radius:50%;">
                  </div>
                  <div style="flex:1;text-align:left;">
                      <h4 style="font-size:1.2rem;font-weight:600;color:#1f2937;margin:0;">${f.username}</h4>
                      <p style="font-size:1rem;color:#6b7280;margin:0;">${f.major || 'User'}</p>
                  </div>
                  <div class="check-circle">${isSel?'✓':''}</div>
              </button>`;
          }).join('');

          if(isOwner) {
              listContainer.querySelectorAll('.friend-select-item').forEach(btn => {
                  btn.addEventListener('click', () => {
                      const fid = btn.dataset.fid;
                      if (selectedFriends.has(fid)) {
                          selectedFriends.delete(fid);
                          btn.classList.remove('selected');
                          btn.querySelector('.check-circle').textContent = '';
                      } else {
                          selectedFriends.add(fid);
                          btn.classList.add('selected');
                          btn.querySelector('.check-circle').textContent = '✓';
                      }
                      const count = selectedFriends.size;
                      confirmBtn.textContent = count > 0 ? `Add (${count})` : 'Add Members';
                      if (count > 0) confirmBtn.removeAttribute('disabled'); else confirmBtn.setAttribute('disabled', 'true');
                  });
              });
          }
      };

      async function loadFriends() {
          try {
              const friends = await App.fetchData('/api/friendship/list-friends');
              const accepted = friends.filter(f => f.status === 'ACCEPTED');
              renderList(accepted);
          } catch (e) { listContainer.innerHTML = '<div style="color:red;">Error loading friends.</div>'; }
      }
      
      // Initial Load
      loadFriends();

      if (searchBtn) {
          searchBtn.addEventListener('click', async () => {
              const query = searchInput.value.trim();
              if (query.length < 3) return showNotification("Type at least 3 characters", "error");
              try {
                  listContainer.innerHTML = '<div style="padding:20px;">Searching...</div>';
                  const results = await App.fetchData(`/api/friendship/search?query=${encodeURIComponent(query)}`);
                  renderList(results);
              } catch(e) {
                  listContainer.innerHTML = '<div style="color:red;">Search failed.</div>';
              }
          });
      }

      if(isOwner) {
          confirmBtn.addEventListener('click', async () => {
              if (selectedFriends.size === 0) return;
              confirmBtn.disabled = true;
              confirmBtn.textContent = 'Adding...';
              const memberIds = Array.from(selectedFriends).map(Number);
              try {
                  const res = await fetch(`${API_BASE}/api/groups/${group.id}/members`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'credentials': 'include' },
                      body: JSON.stringify({ memberIds })
                  });
                  if (res.ok) {
                      if (onMembersAdded) onMembersAdded(memberIds.length);
                      closeModal();
                      showNotification("Members added successfully.");
                  } else { showNotification('Failed to add members', 'error'); confirmBtn.disabled = false; }
              } catch (e) { confirmBtn.disabled = false; }
          });
      }
  }

  // --- CREATE GROUP ---
  async function openCreateGroupModal() {
    const modalHtml = await loadHtml('create_group.html');
    if (!modalHtml) return;
    const container = document.getElementById('create-group-modal-container');
    container.innerHTML = modalHtml;
    
    const closeBtns = container.querySelectorAll('.js-close-create-group');
    const createBtn = container.querySelector('#submit-group-btn');
    const nameInput = container.querySelector('#group-name');
    
    const closeModal = () => { container.innerHTML = ''; };
    closeBtns.forEach(btn => btn.addEventListener('click', closeModal));
    
    if (nameInput && createBtn) {
      nameInput.addEventListener('input', () => {
        if (nameInput.value.trim()) createBtn.removeAttribute('disabled');
        else createBtn.setAttribute('disabled', 'true');
      });
      createBtn.addEventListener('click', async () => {
        const name = nameInput.value.trim();
        try {
            const res = await fetch(`${API_BASE}/api/groups/create`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json', 'credentials': 'include'},
                body: JSON.stringify({ name: name, icon: '👥' }) 
            });
            if (res.ok) {
                closeModal();
                showNotification("Group created!");
                await fetchGroups();
                if (mainPanelRef) renderGroupList(mainPanelRef);
            }
        } catch(e) { console.error("Create group failed", e); }
      });
    }
  }

})(window.App = window.App || {});