// FriendList.js
window.App = window.App || {};

(function (App) {

    const API_BASE = '';

    // 🔹 CACHE TO REMOVE LAG
    let cachedFriendsHtml = null;
    let searchListenerAttached = false;
    let pollInterval = null;

    // 🔥 WebSocket
    let stompClient = null;

    /* ---------------- UTIL ---------------- */

    const notify = (message, type = 'success') => {
        if (window.showGlobalNotification) {
            window.showGlobalNotification(message, type);
        } else {
            console.log(type.toUpperCase(), message);
        }
    };

    async function fetchHtml(url) {
        if (cachedFriendsHtml) return cachedFriendsHtml;
        const response = await fetch(url + '?v=' + Date.now());
        if (!response.ok) throw new Error('HTML load failed');
        cachedFriendsHtml = await response.text();
        return cachedFriendsHtml;
    }

    /* ---------------- RENDER ---------------- */

    function renderButtons(user) {
        // Fallback for avatar if missing in top-level object
        const safeAvatar = user.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`;
        
        if (user.status === 'ACCEPTED') {
            // 🔥 Added data-username and data-avatar for the message handler
            return `
              <button class="btn btn-primary js-message" 
                      data-id="${user.userId}" 
                      data-username="${user.username}" 
                      data-avatar="${safeAvatar}">Message</button>
              <button class="btn btn-unfriend js-remove" data-id="${user.userId}">Unfriend</button>`;
        }

        if (user.status === 'PENDING' && user.direction === 'OUTGOING') {
            return `<button class="btn btn-unfriend js-remove" data-id="${user.userId}">Cancel</button>`;
        }

        if (user.status === 'PENDING' && user.direction === 'INCOMING') {
            return `
              <button class="btn btn-primary js-accept" data-id="${user.userId}">Accept</button>
              <button class="btn btn-unfriend js-reject" data-id="${user.userId}">Reject</button>`;
        }

        return `<button class="btn btn-primary js-add" data-id="${user.userId}">Add Friend</button>`;
    }

    function renderItem(user) {
        // 🚫 HARD GUARD — PREVENT DUMMY USER
        if (!user || !user.username) return '';

        const avatar = user.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`;
        
        return `
        <div class="friend-list-item" data-user-id="${user.userId}">
            <img class="friend-avatar" src="${avatar}">
            <div class="friend-info">
                <div class="friend-name">${user.username}</div>
                <div class="friend-major">${user.major || user.schoolName || ''}</div>
            </div>
            ${renderButtons(user)}
        </div>`;
    }

    /* ---------------- DATA ---------------- */

    async function loadFriends(container) {
        if (!container) return;

        if (!container.children.length) {
            container.innerHTML = `<div style="padding:20px;text-align:center;color:#888">Loading...</div>`;
        }

        try {
            const response = await fetch(`${API_BASE}/api/friendship/list-friends`, {
                credentials: 'include'
            });
            const data = await response.json();

            if (!data || data.length === 0) {
                container.innerHTML = `
                    <div style="padding:20px;text-align:center;color:#888">
                        You have no friends or pending requests.
                    </div>`;
                return;
            }

            container.innerHTML = data.map(renderItem).join('');
            bindActions(container);

        } catch {
            container.innerHTML =
                `<div style="padding:20px;text-align:center;color:red">Failed to load</div>`;
        }
    }

    async function searchUsers(query, container) {
        if (!query || query.trim().length === 0) {
            loadFriends(container);
            return;
        }

        try {
            const response = await fetch(
                `${API_BASE}/api/friendship/search?query=${encodeURIComponent(query)}`,
                { credentials: 'include' }
            );
            
            if (!response.ok) throw new Error('Search failed');
            
            const data = await response.json();

            if (Array.isArray(data) && data.length > 0) {
                container.innerHTML = data.map(renderItem).join('');
            } else {
                container.innerHTML = `<div style="padding:20px;text-align:center;color:#888">No users found.</div>`;
            }

            bindActions(container);
        } catch (error) {
            console.error("Search error:", error);
            container.innerHTML =
                `<div style="padding:20px;text-align:center;color:red">Search failed. Please try again.</div>`;
        }
    }

    /* ---------------- REALTIME (ROBUST) ---------------- */

    function connectFriendshipSocket() {
        if (stompClient || !window.Stomp || !window.SockJS) return;

        const socket = new SockJS('/ws');
        stompClient = Stomp.over(socket);
        stompClient.debug = () => {};

        stompClient.connect({}, () => {
            stompClient.subscribe('/user/queue/friendship', () => {
                // 🔥 SOCKET NEVER RENDERS UI — ONLY REFRESH
                const list = document.querySelector('.friend-list');
                const searchBar = document.querySelector('.friend-search-bar');
                
                // If searching, don't auto-refresh to full list, refresh search
                if (searchBar && searchBar.value.trim().length >= 3) {
                    searchUsers(searchBar.value.trim(), list);
                } else if (list) {
                    loadFriends(list);
                }
            });
        });
    }

    /* ---------------- ACTIONS ---------------- */

    function lock(button) {
        button.disabled = true;
        button.style.pointerEvents = 'none';
    }

    function bindActions(container) {

        container.querySelectorAll('button').forEach(button => {
            button.onclick = async (e) => {
                // Prevent default just in case
                e.preventDefault();

                // 🔥 HANDLE MESSAGE CLICK SEPARATELY (NO ASYNC FETCH NEEDED)
                if (button.classList.contains('js-message')) {
                    const targetId = button.dataset.id;
                    const targetName = button.dataset.username;
                    const targetAvatar = button.dataset.avatar;

                    // Close the modal
                    const modal = document.getElementById('reusable-modal');
                    if (modal) {
                        modal.classList.remove('show');
                        setTimeout(() => modal.style.display = 'none', 300);
                    }

                    // Start chat if App has the function
                    if (App.startChatWithUser) {
                        App.startChatWithUser({
                            id: targetId,
                            name: targetName,
                            avatar: targetAvatar
                        });
                    } else {
                        console.error("ChatPanel not loaded or App.startChatWithUser missing");
                    }
                    return;
                }

                if (button.disabled) return;
                lock(button);

                try {
                    if (button.classList.contains('js-add')) {
                        await fetch(`${API_BASE}/api/friendship/request`, {
                            method: 'POST',
                            credentials: 'include',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ recipientId: Number(button.dataset.id) })
                        });
                        notify('Request sent');
                    }

                    if (button.classList.contains('js-remove')) {
                        await fetch(`${API_BASE}/api/friendship/remove`, {
                            method: 'POST',
                            credentials: 'include',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ targetUserId: Number(button.dataset.id) })
                        });
                        notify('Updated');
                        if (App.refreshChatList) App.refreshChatList();
                        if (App.refreshCurrentChatState) App.refreshCurrentChatState();
                    }

                    if (button.classList.contains('js-accept')) {
                        await fetch(`${API_BASE}/api/friendship/respond`, {
                            method: 'POST',
                            credentials: 'include',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ requesterId: Number(button.dataset.id), action: 'accept' })
                        });
                        notify('Friend added');
                    }

                    if (button.classList.contains('js-reject')) {
                        await fetch(`${API_BASE}/api/friendship/respond`, {
                            method: 'POST',
                            credentials: 'include',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ requesterId: Number(button.dataset.id), action: 'reject' })
                        });
                        notify('Request rejected');
                    }

                } finally {
                    // 🔥 ROBUST REFRESH: Check search state before reloading
                    const searchBar = document.querySelector('.friend-search-bar');
                    const isSearching = searchBar && searchBar.value.trim().length >= 3;
                    
                    if (isSearching) {
                        searchUsers(searchBar.value.trim(), container);
                    } else {
                        loadFriends(container);
                    }
                }
            };
        });
    }

    /* ---------------- MODAL ---------------- */

    App.openFriendsModal = async () => {

        connectFriendshipSocket(); // 🔥 realtime enable

        const modal = document.getElementById('reusable-modal');
        const content = document.getElementById('reusable-modal-content');

        modal.style.display = 'flex';
        modal.classList.add('modal-large');

        content.innerHTML = await fetchHtml('friend_list.html');
        requestAnimationFrame(() => modal.classList.add('show'));

        // 🔥 FIX: Bind Close Button Logic Here
        const closeBtn = content.querySelector('.js-close-modal') || modal.querySelector('.js-close-modal');
        if (closeBtn) {
            closeBtn.onclick = () => {
                modal.classList.remove('show');
                setTimeout(() => {
                    modal.style.display = 'none';
                    modal.classList.remove('modal-large');
                }, 300);
            };
        }

        const list = content.querySelector('.friend-list');
        const search = content.querySelector('.friend-search-bar');

        loadFriends(list);

        if (pollInterval) clearInterval(pollInterval);
        pollInterval = setInterval(() => {
            // Only auto-refresh if NOT searching
            if (!search?.value && modal.classList.contains('show')) {
                loadFriends(list);
            }
        }, 5000);

        if (!searchListenerAttached && search) {
            let debounceTimer;
            search.addEventListener('input', e => {
                clearTimeout(debounceTimer);
                const query = e.target.value.trim();
                
                // Immediate clear if empty
                if (query.length === 0) {
                    loadFriends(list);
                    return;
                }

                debounceTimer = setTimeout(() => {
                    if (query.length >= 3) {
                        searchUsers(query, list);
                    } else {
                        // Optional: show "Type more..." or just load friends
                        loadFriends(list); 
                    }
                }, 250);
            });
            searchListenerAttached = true;
        }
    };

})(window.App);