// FriendList.js
window.App = window.App || {};

(function (App) {

    const API_BASE = '';

    // 🔹 CACHE TO REMOVE LAG
    let cachedFriendsHtml = null;
    let searchListenerAttached = false;
   
    // NEW: Polling for auto-update
    let pollInterval = null;

    /* ---------------- UTIL ---------------- */

    const notify = (msg, type = 'success') => {
        if (window.showGlobalNotification) {
            window.showGlobalNotification(msg, type);
        } else {
            console.log(type.toUpperCase(), msg);
        }
    };

    async function fetchHtml(url) {
        if (cachedFriendsHtml) return cachedFriendsHtml;
        const r = await fetch(url + '?v=' + Date.now());
        if (!r.ok) throw new Error('HTML load failed');
        cachedFriendsHtml = await r.text();
        return cachedFriendsHtml;
    }

    /* ---------------- RENDER ---------------- */

    function renderButtons(u) {
        if (u.status === 'ACCEPTED') {
            return `
              <button class="btn btn-primary js-message" data-id="${u.userId}">Message</button>
              <button class="btn btn-unfriend js-remove" data-id="${u.userId}">Unfriend</button>`;
        }

        if (u.status === 'PENDING' && u.direction === 'OUTGOING') {
            return `<button class="btn btn-unfriend js-remove" data-id="${u.userId}">Cancel</button>`;
        }

        if (u.status === 'PENDING' && u.direction === 'INCOMING') {
            return `
              <button class="btn btn-primary js-accept" data-id="${u.userId}">Accept</button>
              <button class="btn btn-unfriend js-reject" data-id="${u.userId}">Reject</button>`;
        }

        return `<button class="btn btn-primary js-add" data-id="${u.userId}">Add Friend</button>`;
    }

    function renderItem(u) {
        const avatar = u.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.username}`;
        return `
        <div class="friend-list-item">
            <img class="friend-avatar" src="${avatar}">
            <div class="friend-info">
                <div class="friend-name">${u.username}</div>
                <div class="friend-major">${u.major || u.schoolName || ''}</div>
            </div>
            ${renderButtons(u)}
        </div>`;
    }

    /* ---------------- DATA ---------------- */

    async function loadFriends(container) {
        // Only show loading on initial load or if empty
        if (!container.children.length) {
             container.innerHTML = `<div style="padding:20px;text-align:center;color:#888">Loading...</div>`;
        }
       
        try {
            const r = await fetch(`${API_BASE}/api/friendship/list-friends`, {
                credentials: 'include'
            });
            const data = await r.json();

            if (!data || data.length === 0) {
                container.innerHTML =
                    `<div style="padding:20px;text-align:center;color:#888">
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
        try {
            const r = await fetch(
                `${API_BASE}/api/friendship/search?query=${encodeURIComponent(query)}`,
                { credentials: 'include' }
            );
            const data = await r.json();

            if (!data || data.length === 0) {
                container.innerHTML =
                    `<div style="padding:20px;text-align:center;color:#888">No users found.</div>`;
                return;
            }

            container.innerHTML = data.map(renderItem).join('');
            bindActions(container);
        } catch {
            container.innerHTML =
                `<div style="padding:20px;text-align:center;color:red">Search failed</div>`;
        }
    }

    /* ---------------- ACTIONS ---------------- */

    function bindActions(container) {

        container.querySelectorAll('.js-add').forEach(b => {
            b.onclick = async () => {
                await fetch(`${API_BASE}/api/friendship/request`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ recipientId: Number(b.dataset.id) })
                });
                notify('Request sent');
                loadFriends(container);
            };
        });

        container.querySelectorAll('.js-remove').forEach(b => {
            b.onclick = async () => {
                await fetch(`${API_BASE}/api/friendship/remove`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ targetUserId: Number(b.dataset.id) })
                });
                notify('Updated');
                loadFriends(container);
                if (App.refreshChatList) App.refreshChatList(); // Sync Chat Sidebar
               
                // Immediately check if open chat is affected and disable input
                if (App.refreshCurrentChatState) App.refreshCurrentChatState();
            };
        });

        container.querySelectorAll('.js-accept').forEach(b => {
            b.onclick = async () => {
                await fetch(`${API_BASE}/api/friendship/respond`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ requesterId: Number(b.dataset.id), action: 'accept' })
                });
                notify('Friend added');
                loadFriends(container);
                if (App.refreshChatList) App.refreshChatList(); // Sync Chat
            };
        });

        container.querySelectorAll('.js-reject').forEach(b => {
            b.onclick = async () => {
                await fetch(`${API_BASE}/api/friendship/respond`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ requesterId: Number(b.dataset.id), action: 'reject' })
                });
                notify('Request rejected');
                loadFriends(container);
            };
        });
       
        container.querySelectorAll('.js-message').forEach(b => {
             b.onclick = () => {
                 // Close modal
                 const modal = document.getElementById('reusable-modal');
                 if(modal) {
                     // Stop polling
                     if (pollInterval) clearInterval(pollInterval);
                     
                     modal.classList.remove('show', 'modal-large');
                     setTimeout(() => modal.style.display = 'none', 300);
                 }
                 // Start chat
                 const userId = b.dataset.id;
                 const name = b.parentElement.querySelector('.friend-name')?.textContent;
                 if (userId && window.App.startChatWithUser) {
                     window.App.startChatWithUser({ id: userId, name: name });
                 }
             };
        });
    }

    /* ---------------- MODAL ---------------- */

    App.openFriendsModal = async () => {

        const modal = document.getElementById('reusable-modal');
        const content = document.getElementById('reusable-modal-content');

        modal.style.display = 'flex';
        modal.classList.add('modal-large');

        content.innerHTML = await fetchHtml('friend_list.html');
        requestAnimationFrame(() => modal.classList.add('show'));
       
        const list = content.querySelector('.friend-list');
        const search = content.querySelector('.friend-search-bar');
       
        loadFriends(list);

        // --- AUTO UPDATE LOGIC ---
        // Clear previous interval if any
        if (pollInterval) clearInterval(pollInterval);
       
        // Poll every 5 seconds to auto-update list
        pollInterval = setInterval(() => {
            const searchVal = search ? search.value.trim() : '';
            // Only auto-refresh if user is NOT searching (to avoid overwriting results)
            if (!searchVal && modal.classList.contains('show')) {
                loadFriends(list);
            }
        }, 5000);

        // CLOSE HANDLER
        const closeModal = (e) => {
            if (e) e.preventDefault();
            if (pollInterval) clearInterval(pollInterval);
            modal.classList.remove('show', 'modal-large');
            setTimeout(() => modal.style.display = 'none', 300);
           
            // Sync chat state on close just in case
            if (App.refreshCurrentChatState) App.refreshCurrentChatState();
        };

        const closeSelectors = '.js-close-modal, .modal-close, .close, .btn-close, [data-dismiss="modal"]';
        // Updated: Search entire modal for close buttons, not just inner content
        modal.querySelectorAll(closeSelectors).forEach(btn => {
            btn.onclick = closeModal;
        });

        modal.onclick = e => {
            if (e.target === modal) closeModal();
        };

        if (!searchListenerAttached && search) {
            let debounce;
            search.addEventListener('input', e => {
                clearTimeout(debounce);
                const q = e.target.value.trim();

                debounce = setTimeout(() => {
                    if (!q) loadFriends(list);
                    else if (q.length >= 3) searchUsers(q, list);
                }, 300);
            });
            searchListenerAttached = true;
        }
    };

})(window.App);