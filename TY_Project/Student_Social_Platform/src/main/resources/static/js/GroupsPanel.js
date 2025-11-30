// GroupsPanel.js
// Add to window.App
(function(App) {
  // --- Helper: Fetch HTML & Clean it ---
  async function loadHtml(url) {
    try {
      const response = await fetch(url + '?v=' + new Date().getTime());
      if (!response.ok) throw new Error(`Failed to load ${url}`);
      let text = await response.text();
      text = text.replace(/<!-- Code injected by live-server -->[\s\S]*?<\/script>/gi, "");
      return text;
    } catch (err) {
      console.error("[GroupsPanel] HTML Load Error:", err);
      return null;
    }
  }

  // --- Layout HTML (main) ---
  const GROUPS_LAYOUT_HTML = `<div class="groups-layout">
    <div class="groups-list-sidebar">
      <div class="groups-list-header">
        <div class="groups-header-top">
          <button class="btn-create-group" id="create-group-btn" style="width: 100%; justify-content: center;">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Create New Group
          </button>
        </div>
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

  // ============================================================
  // DATA & STATE
  // ============================================================
  const groups = [
    { id: '1', name: 'CS101 Study Group', icon: '📚', memberCount: 16, lastMessage: 'When is the next assignment due?', timestamp: '5m', unreadCount: 3, memberIds: ['f2','f7'], messages: [] },
    { id: '2', name: 'Campus Events', icon: '🎉', memberCount: 45, lastMessage: "Don't forget the welcome party!", timestamp: '20m', unreadCount: 1, memberIds: ['f3','f5'], messages: [] },
    { id: '3', name: 'Robotics Club', icon: '🤖', memberCount: 28, lastMessage: 'Meeting at 4 PM in lab 3', timestamp: '2h', unreadCount: 0, memberIds: ['f1'], messages: [] },
    { id: '4', name: 'Biology 201', icon: '🧬', memberCount: 35, lastMessage: 'Chapter 5 quiz next week', timestamp: '1d', unreadCount: 0, memberIds: [], messages: [] }
  ];

  const friends = [
    { id: 'f1', name: 'Michael Brown', isOnline: true, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Michael' },
    { id: 'f2', name: 'Jennifer Wilson', isOnline: true, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jennifer' },
    { id: 'f3', name: 'Robert Taylor', isOnline: false, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Robert' },
    { id: 'f4', name: 'Amanda Martinez', isOnline: true, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Amanda' },
    { id: 'f5', name: 'Christopher Lee', isOnline: false, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Chris' },
    { id: 'f6', name: 'Laura Green', isOnline: true, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Laura' },
    { id: 'f7', name: 'Tina Zhao', isOnline: false, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Tina' }
  ];

  let selectedGroup = null;
  let selectedFriendsToAdd = new Set();
  let mainPanelRef = null;

  // ============================================================
  // MAIN RENDER
  // ============================================================
  App.renderGroups = (panel) => {
    mainPanelRef = panel;
    panel.innerHTML = GROUPS_LAYOUT_HTML;
    renderGroupList(panel);
    const searchInput = panel.querySelector('#groups-search-input');
    if (searchInput) searchInput.addEventListener('input', (e) => renderGroupList(panel, e.target.value));
    const createGroupBtn = panel.querySelector('#create-group-btn');
    if (createGroupBtn) createGroupBtn.addEventListener('click', openCreateGroupModal);

    // initial badge update (run twice to be robust if DOM not fully ready)
    updateSideBadge();
    setTimeout(updateSideBadge, 80);
  };

  function renderGroupList(panel, filter = '') {
    const listContainer = panel.querySelector('#groups-list-container');
    if (!listContainer) return;
    const filtered = groups.filter(g => g.name.toLowerCase().includes(filter.toLowerCase()));
    if (filtered.length === 0) {
      listContainer.innerHTML = '<div style="padding:20px; text-align:center; color:#888;">No groups found</div>';
      updateSideBadge();
      return;
    }

    listContainer.innerHTML = filtered.map(group => {
      return `<button class="group-item-button ${selectedGroup?.id === group.id ? 'active' : ''}" data-group-id="${group.id}">
        <div class="group-item-inner">
          <div class="group-icon-wrapper">${group.icon}</div>
          <div class="group-item-details">
            <div class="group-row1">
              <span class="group-name">${group.name}</span>
              <span class="group-time">${group.timestamp || ''}</span>
            </div>
            <div class="group-last-message">${group.lastMessage || ''}</div>
            <div class="group-meta-row">
              <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20" style="width:1.2rem;height:1.2rem"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" /></svg>
              <span>${group.memberCount} members</span>
              ${group.unreadCount > 0 ? `<span class="group-unread-badge">${group.unreadCount}</span>` : ''}
            </div>
          </div>
        </div>
      </button>`;
    }).join('');

    updateSideBadge();

    listContainer.querySelectorAll('.group-item-button').forEach(btn => {
      btn.addEventListener('click', () => {
        const groupId = btn.dataset.groupId;
        selectedGroup = groups.find(g => g.id === groupId);
        if (selectedGroup && selectedGroup.unreadCount > 0) selectedGroup.unreadCount = 0;
        renderGroupList(panel, filter);
        renderGroupChat(panel);
        updateSideBadge();
      });
    });
  }

  // ============================================================
  // CHAT LOGIC
  // ============================================================
  function renderGroupChat(panel) {
    const chatContainer = panel.querySelector('#group-chat-window');
    if (!selectedGroup) {
      chatContainer.innerHTML = `<div class="chat-placeholder"><p>Select a group to start chatting</p></div>`;
      return;
    }

    chatContainer.innerHTML = `<div class="group-chat-header">
      <div class="group-header-info">
        <div class="group-header-icon">${selectedGroup.icon}</div>
        <div class="group-header-text">
          <h2>${selectedGroup.name}</h2>
          <p id="group-header-count">${selectedGroup.memberCount} members</p>
        </div>
      </div>
      <div class="group-header-actions">
        <button class="btn-icon" id="add-member-to-group-btn" title="Add Member">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
        </button>
      </div>
    </div>
    <div class="chat-messages-area" id="group-messages-area"></div>
    <div class="chat-input-area">
      <div class="chat-input-wrapper">
        <button class="btn-icon" title="Add Photo" id="chat-photo-btn">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        </button>
        <button class="btn-icon" id="chat-emoji-btn" title="Add Emoji">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
        </button>
        <input type="file" id="chat-file-input" style="display: none;" accept="image/*">
        <div class="chat-input-field-wrapper">
          <input type="text" placeholder="Type a message..." class="chat-input-field" id="group-chat-input">
        </div>
        <button class="chat-send-btn" id="chat-send-btn"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button>
      </div>
    </div>`;
    
    const addMemberBtn = chatContainer.querySelector('#add-member-to-group-btn');
    if (addMemberBtn) addMemberBtn.addEventListener('click', openAddMembersModal);

    const inputField = chatContainer.querySelector('#group-chat-input');
    const sendBtn = chatContainer.querySelector('#chat-send-btn');
    const photoBtn = chatContainer.querySelector('#chat-photo-btn');
    const emojiBtn = chatContainer.querySelector('#chat-emoji-btn');
    const fileInput = chatContainer.querySelector('#chat-file-input');

    renderMessages(chatContainer);

    const handleSend = () => {
      const text = inputField.value.trim();
      if (text) {
        const now = new Date();
        const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        sendMessage({ type: 'me', text: text, time: timeString });
        inputField.value = '';
      }
    };

    sendBtn.addEventListener('click', handleSend);
    inputField.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSend(); });

    if (photoBtn && fileInput) {
      photoBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          const reader = new FileReader();
          reader.onload = function(evt) {
            const now = new Date();
            const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            sendMessage({ type: 'me', image: evt.target.result, time: timeString });
          };
          reader.readAsDataURL(file);
        }
        fileInput.value = '';
      });
    }

    if (emojiBtn) {
      emojiBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (window.App && typeof window.App.openEmojiPanel === 'function') {
          window.App.openEmojiPanel((emoji) => {
            inputField.value += emoji;
            inputField.focus();
          }, emojiBtn);
        } else {
          inputField.value += "😊";
          inputField.focus();
        }
      });
    }
  }

  function sendMessage(msgObj) {
    if (!selectedGroup) return;
    if (!selectedGroup.messages) selectedGroup.messages = [];
    selectedGroup.messages.push(msgObj);
    const textPreview = msgObj.image ? '📷 Photo' : (msgObj.text || '');
    selectedGroup.lastMessage = (msgObj.type === 'me' ? 'You: ' : '') + (textPreview || '');
    selectedGroup.timestamp = 'Just now';
    if (msgObj.type === 'other') {
      selectedGroup.unreadCount = (selectedGroup.unreadCount || 0) + 1;
    }
    if (mainPanelRef) {
      renderMessages(mainPanelRef.querySelector('#group-chat-window'));
      renderGroupList(mainPanelRef);
    }
    updateSideBadge();
  }

  function renderMessages(chatContainer) {
    const messageArea = chatContainer.querySelector('#group-messages-area');
    if (!selectedGroup.messages || selectedGroup.messages.length === 0) {
      messageArea.innerHTML = `<div class="profile-content-wrapper" style="padding: 20px; text-align: center; color: #9ca3af;">Start of conversation in ${selectedGroup.name}</div>`;
      return;
    }
    let html = '';
    selectedGroup.messages.forEach(msg => {
      if (msg.type === 'system') {
        html += `<div class="system-message-wrapper"><div class="system-message">${msg.text}</div></div>`;
      } else {
        const content = msg.image ? `<img src="${msg.image}" style="max-width: 250px; border-radius: 8px; display: block; margin-bottom: 4px;">` : `<p>${msg.text}</p>`;
        const avatarHtml = msg.type === 'other' && msg.avatar ? `<img src="${msg.avatar}" class="msg-avatar">` : '';
        const nameHtml = msg.type === 'other' && msg.senderName ? `<span class="msg-sender-name">${msg.senderName}</span>` : '';
        html += `<div class="message-bubble-wrapper ${msg.type}">
          ${msg.type === 'other' ? avatarHtml : ''}
          <div class="message-bubble ${msg.type}">
            <div class="message-bubble-content">
              ${nameHtml}
              ${content}
              <span class="message-time">${msg.time || 'Now'}</span>
            </div>
          </div>
        </div>`;
      }
    });
    messageArea.innerHTML = `<div class="profile-content-wrapper" style="padding: 12px;">${html}</div>`;
    messageArea.scrollTop = messageArea.scrollHeight;
  }

  // ============================================================
  // MODALS (create/add members)
  // ============================================================
  async function openCreateGroupModal() {
    const modalHtml = await loadHtml('create_group.html');
    if (!modalHtml) return;
    const container = document.getElementById('create-group-modal-container');
    if (!container) return;
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
      createBtn.addEventListener('click', () => {
        const newGroup = { id: Date.now().toString(), name: nameInput.value.trim(), icon: '🆕', memberCount: 1, lastMessage: 'Group created', timestamp: 'Just now', unreadCount: 0, memberIds: [], messages: [{ type: 'system', text: 'Group created' }] };
        groups.unshift(newGroup);
        closeModal();
        selectedGroup = newGroup;
        if (mainPanelRef) {
          renderGroupList(mainPanelRef);
          renderGroupChat(mainPanelRef);
        }
        updateSideBadge();
      });
    }
  }

  async function openAddMembersModal() {
    const modalHtml = await loadHtml('/TY_Project/Student_Social_Platform/src/main/resources/static/add_members.html');
    if (!modalHtml) return;
    const modalContainer = document.getElementById('reusable-modal');
    const modalContent = document.getElementById('reusable-modal-content');
    if (!modalContainer || !modalContent) return;
    modalContent.innerHTML = modalHtml;
    modalContainer.style.display = 'flex';
    setTimeout(() => modalContainer.classList.add('show'), 10);
    modalContainer.classList.add('modal-large');

    const globalCloseBtn = modalContainer.querySelector('.js-close-modal');
    const closeModal = () => {
      modalContainer.classList.remove('show');
      modalContainer.classList.remove('modal-large');
      setTimeout(() => {
        modalContainer.style.display = 'none';
        modalContent.innerHTML = '';
      }, 300);
    };
    if (globalCloseBtn) {
      const newCloseBtn = globalCloseBtn.cloneNode(true);
      globalCloseBtn.parentNode.replaceChild(newCloseBtn, globalCloseBtn);
      newCloseBtn.addEventListener('click', closeModal);
    }
    modalContainer.addEventListener('click', (e) => { if (e.target === modalContainer) closeModal(); });

    const listContainer = modalContent.querySelector('#friends-selection-list');
    const confirmBtn = modalContent.querySelector('#confirm-add-members');
    const memberSearchInput = modalContent.querySelector('#member-search-input');
    if (!listContainer || !confirmBtn) return;
    if (selectedGroup && !Array.isArray(selectedGroup.memberIds)) selectedGroup.memberIds = [];
    selectedFriendsToAdd.clear();

    function getAvailableFriends() {
      if (!selectedGroup) return friends.slice();
      const exclude = new Set(selectedGroup.memberIds || []);
      return friends.filter(f => !exclude.has(f.id));
    }
    function renderFriends(filteredFriends) {
      listContainer.innerHTML = filteredFriends.map(f => {
        const isSelected = selectedFriendsToAdd.has(f.id);
        return `<button class="friend-select-item ${isSelected ? 'selected' : ''}" data-fid="${f.id}">
          <div class="chat-user-avatar-wrapper">
            <img src="${f.avatar}" class="chat-user-avatar" style="width:3.6rem;height:3.6rem;">
            ${f.isOnline ? '<div class="chat-user-online-badge"></div>' : ''}
          </div>
          <div style="flex:1">
            <h4 style="font-size:1.4rem;font-weight:600;color:#1f2937">${f.name}</h4>
            <p style="font-size:1.2rem;color:#6b7280">${f.isOnline ? 'Online' : 'Offline'}</p>
          </div>
          <div class="check-circle">
            ${isSelected ? '✓' : ''}
          </div>
        </button>`;
      }).join('');
      listContainer.querySelectorAll('.friend-select-item').forEach(btn => {
        btn.addEventListener('click', () => {
          const fid = btn.dataset.fid;
          if (selectedFriendsToAdd.has(fid)) selectedFriendsToAdd.delete(fid);
          else selectedFriendsToAdd.add(fid);
          const currentList = getAvailableFriends();
          const q = (memberSearchInput && memberSearchInput.value) ? memberSearchInput.value.toLowerCase().trim() : '';
          const filtered = q ? currentList.filter(ff => (ff.name + ' ' + (ff.isOnline ? 'online' : 'offline')).toLowerCase().includes(q)) : currentList;
          renderFriends(filtered);
          confirmBtn.textContent = `Add (${selectedFriendsToAdd.size})`;
          if (selectedFriendsToAdd.size > 0) confirmBtn.removeAttribute('disabled'); else confirmBtn.setAttribute('disabled', 'true');
        });
      });
    }

    renderFriends(getAvailableFriends());

    if (memberSearchInput) {
      memberSearchInput.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase().trim();
        const current = getAvailableFriends();
        const filtered = q ? current.filter(ff => (ff.name + ' ' + (ff.isOnline ? 'online' : 'offline')).toLowerCase().includes(q)) : current;
        renderFriends(filtered);
      });
    }

    confirmBtn.addEventListener('click', () => {
      const addedCount = selectedFriendsToAdd.size;
      if (selectedGroup) {
        if (!Array.isArray(selectedGroup.memberIds)) selectedGroup.memberIds = [];
        selectedFriendsToAdd.forEach(fid => {
          if (!selectedGroup.memberIds.includes(fid)) selectedGroup.memberIds.push(fid);
        });
        selectedGroup.memberCount = (selectedGroup.memberIds ? selectedGroup.memberIds.length : selectedGroup.memberCount) || (selectedGroup.memberCount + addedCount);
        const names = [];
        selectedFriendsToAdd.forEach(fid => {
          const friend = friends.find(f => f.id === fid);
          if (friend) names.push(friend.name);
        });
        if (names.length > 0) {
          const msgText = `You added ${names.join(', ')}`;
          if (!selectedGroup.messages) selectedGroup.messages = [];
          selectedGroup.messages.push({ type: 'system', text: msgText });
        }
        renderFriends(getAvailableFriends());
        if (mainPanelRef) {
          renderGroupList(mainPanelRef);
          renderGroupChat(mainPanelRef);
        }
      }
      setTimeout(() => {
        selectedFriendsToAdd.clear();
        modalContainer.classList.remove('show', 'modal-large');
        setTimeout(() => {
          modalContainer.style.display = 'none';
          modalContent.innerHTML = '';
        }, 300);
      }, 120);
    });
  }

  // ============================================================
  // SIDE NAV BADGE (robust & minimal)
  // ============================================================
  function findGroupsNavElement() {
    const sidebarContainers = ['#desktop-sidebar', '.sidebar-box', '#sidebar-box-nav', '.sidebar', '.side-nav', '.left-nav', '.nav-sidebar'];
    for (const sel of sidebarContainers) {
      try {
        const container = document.querySelector(sel);
        if (!container) continue;
        const nodes = container.querySelectorAll('a, button, li, div, span');
        for (let el of nodes) {
          if (!el || !el.textContent) continue;
          const txt = el.textContent.trim().toLowerCase();
          if (txt === 'groups' || txt.startsWith('groups') || txt.includes('groups')) {
            const clickable = el.closest('a,button');
            if (clickable) return clickable;
            return el;
          }
        }
      } catch (e) { /* ignore invalid selectors */ }
    }

    const candidates = document.querySelectorAll('a, button, li, div, span');
    for (let el of candidates) {
      if (!el || !el.textContent) continue;
      const txt = el.textContent.trim().toLowerCase();
      if (txt === 'groups' || txt.startsWith('groups') || txt.includes('groups')) {
        const clickable = el.closest('a,button');
        if (clickable) return clickable;
        const sidebarAncestor = el.closest('[class*="side"], [class*="nav"], [class*="sidebar"], li') || el;
        return sidebarAncestor;
      }
    }
    return null;
  }

  function updateSideBadge() {
    try {
      const totalUnread = groups.reduce((sum, g) => sum + (Number(g.unreadCount) || 0), 0);
      const navEl = findGroupsNavElement();

      // Create or reuse badge
      let badge = document.getElementById('nav-groups-badge');
      if (!badge) {
        badge = document.createElement('span');
        badge.id = 'nav-groups-badge';
        badge.className = 'side-nav-badge';
        // make it positioned and visible by default
        badge.style.position = 'absolute';
        badge.style.top = '50%';
        badge.style.transform = 'translateY(-50%)';
        badge.style.right = '50px';
        badge.style.zIndex = '9999';
        badge.style.display = 'inline-flex';
        badge.style.pointerEvents = 'none';
      }

      if (!navEl) {
        // fallback attach to sidebar so it doesn't float in corner of body
        const fallback = document.querySelector('#sidebar-box-nav') || document.querySelector('#desktop-sidebar') || document.querySelector('nav');
        if (fallback && totalUnread > 0) {
          const st = window.getComputedStyle(fallback);
          if (st.position === 'static' || !st.position) fallback.style.position = 'relative';
          if (!fallback.contains(badge)) fallback.appendChild(badge);
          badge.textContent = totalUnread > 99 ? '99+' : String(totalUnread);
          badge.style.display = 'inline-flex';
        } else {
          if (totalUnread === 0 && badge.parentElement) badge.parentElement.removeChild(badge);
        }
        document.dispatchEvent(new CustomEvent('side-badge-updated', { detail: { count: totalUnread } }));
        return;
      }

      const navStyle = window.getComputedStyle(navEl);
      if (navStyle.position === 'static' || !navStyle.position) {
        navEl.style.position = 'relative';
      }

      if (totalUnread > 0) {
        badge.textContent = totalUnread > 99 ? '99+' : String(totalUnread);
        badge.style.display = 'inline-flex';
        if (!navEl.contains(badge)) navEl.appendChild(badge);
      } else {
        if (badge && badge.parentElement) badge.parentElement.removeChild(badge);
      }

      document.dispatchEvent(new CustomEvent('side-badge-updated', { detail: { count: totalUnread } }));
    } catch (e) {
      console.warn('updateSideBadge error:', e);
    }
  }

  // Public helpers
  App.incrementGroupUnread = function(groupId, amount = 1) {
    const g = groups.find(x => x.id === groupId);
    if (!g) return;
    g.unreadCount = (Number(g.unreadCount) || 0) + Number(amount);
    if (mainPanelRef) renderGroupList(mainPanelRef);
    updateSideBadge();
  };
  App.setGroupUnread = function(groupId, value = 0) {
    const g = groups.find(x => x.id === groupId);
    if (!g) return;
    g.unreadCount = Number(value) || 0;
    if (mainPanelRef) renderGroupList(mainPanelRef);
    updateSideBadge();
  };
  App.updateSideBadge = updateSideBadge;

  // Run badge update on script load (extra safeguard)
  setTimeout(updateSideBadge, 60);
  setTimeout(updateSideBadge, 300);

})(window.App = window.App || {});
