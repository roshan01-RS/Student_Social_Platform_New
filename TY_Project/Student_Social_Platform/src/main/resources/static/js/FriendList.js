// friend_list.js
window.App = window.App || {};

(function(App) {

    const API_BASE = 'http://localhost:8000';

    // --- Helper: Robust Notification (FIXED SCOPE) ---
    const showNotification = (message, type = 'success') => {
        if (typeof window.showGlobalNotification === 'function') {
            window.showGlobalNotification(message, type);
        } else if (App.showGlobalNotification) {
             App.showGlobalNotification(message, type);
        } else {
             console.log(`[${type.toUpperCase()}] ${message}`);
        }
    };

    async function loadHtml(url) {
        try {
            const response = await fetch(url + '?v=' + new Date().getTime());
            if (!response.ok) throw new Error(`Failed to load ${url}`);
            return await response.text();
        } catch (err) {
            return null;
        }
    }

    function renderStatusButtons(user) {
        const status = user.status || 'NONE'; 
        const userId = user.userId;
        const buttonClasses = "style='font-size: 1.2rem; padding: 0.5rem 1rem;'";
        
        let buttonsHtml = '';

        switch (status) {
            case 'ACCEPTED':
                buttonsHtml = `
                    <button class="btn btn-primary js-message-friend" data-id="${userId}" ${buttonClasses}>Message</button>
                    <button class="btn btn-unfriend js-unfriend" data-id="${userId}" data-action="unfriend" ${buttonClasses}>Unfriend</button>`;
                break;
            case 'PENDING':
                // Use data-action="cancel" for the unfriend endpoint handler
                buttonsHtml = `<button class="btn btn-unfriend js-unfriend" data-id="${userId}" data-action="cancel" ${buttonClasses}>Cancel Request</button>`;
                break;
            case 'NONE':
            case 'REJECTED':
            default:
                buttonsHtml = `<button class="btn btn-primary js-add-friend" data-id="${userId}" ${buttonClasses}>Add Friend</button>`;
                break;
        }
        return `<div style="display:flex; gap: 0.5rem;">${buttonsHtml}</div>`;
    }
    
    function renderFriendListItem(user) {
        const nameDisplay = user.username ? user.username.replace('@', '') : 'Unknown';
        const majorDisplay = user.major || user.schoolName || 'Student';
        const avatarUrl = user.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${nameDisplay}`;
        
        return `
        <div class="friend-list-item">
            <img src="${avatarUrl}" alt="${nameDisplay}" class="friend-avatar"/>
            <div class="friend-info">
                <span class="friend-name">${nameDisplay}</span>
                <span class="friend-major">${majorDisplay}</span>
            </div>
            ${renderStatusButtons(user)}
        </div>`;
    }

    App.openFriendsModal = async () => {
        const modalContainer = document.getElementById('reusable-modal');
        const modalContent = document.getElementById('reusable-modal-content');

        if (!modalContainer || !modalContent) return;

        try {
            modalContent.innerHTML = '<div style="padding:5rem;text-align:center;color:#666;">Loading...</div>';
            modalContainer.style.display = 'flex';
            const modalHtml = await loadHtml('friend_list.html');
            if (!modalHtml) return;
            modalContent.innerHTML = modalHtml;
            setTimeout(() => modalContainer.classList.add('show'), 10);
            modalContainer.classList.add('modal-large');

            const closeModal = () => {
                modalContainer.classList.remove('show', 'modal-large');
                setTimeout(() => modalContainer.style.display = 'none', 300);
            };

            modalContent.querySelectorAll('.js-close-modal').forEach(btn => btn.addEventListener('click', closeModal));
            modalContainer.onclick = (e) => { if (e.target === modalContainer) closeModal(); };

            const searchInput = modalContent.querySelector('.friend-search-bar');
            const listContainer = modalContent.querySelector('.friend-list');
            
            // Initial load of accepted friends + pending requests
            loadFriendsAndRequests(listContainer);

            let debounceTimer;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(debounceTimer);
                const query = e.target.value.trim();
                
                if (query.length === 0) {
                     loadFriendsAndRequests(listContainer);
                     return;
                }
                if (query.length < 3) return;

                debounceTimer = setTimeout(() => {
                    performSearch(query, listContainer);
                }, 300);
            });
            
            async function loadFriendsAndRequests(container) {
                container.innerHTML = '<div style="padding:20px; text-align:center; color:#888;">Loading friends...</div>';
                try {
                    // FIX: This returns ACCEPTED and PENDING sent requests
                    const results = await App.fetchData(`/api/friendship/list-friends`);
                    
                    if (!results || results.length === 0) {
                        container.innerHTML = '<div style="padding:20px; text-align:center; color:#888;">You have no friends or pending requests.</div>';
                        return;
                    }
                    container.innerHTML = results.map(renderFriendListItem).join('');
                    attachListeners(container, ''); // Pass empty query for full list refresh
                } catch (err) {
                    container.innerHTML = '<div style="padding:20px; text-align:center; color:red;">Failed to load list.</div>';
                }
            }

            async function performSearch(query, container) {
                container.innerHTML = '<div style="padding:20px; text-align:center; color:#888;">Searching...</div>';
                try {
                    const results = await App.fetchData(`/api/friendship/search?query=${encodeURIComponent(query)}`);
                    if (!results || results.length === 0) {
                        container.innerHTML = '<div style="padding:20px; text-align:center; color:#888;">No users found.</div>';
                        return;
                    }
                    container.innerHTML = results.map(renderFriendListItem).join('');
                    attachListeners(container, query);
                } catch (err) {
                    container.innerHTML = '<div style="padding:20px; text-align:center; color:red;">Search failed.</div>';
                }
            }
            
            function attachListeners(container, currentQuery) {
                // 1. Send Request
                container.querySelectorAll('.js-add-friend').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const recipientId = btn.dataset.id;
                        const oldText = btn.textContent;
                        btn.disabled = true;
                        btn.textContent = 'Sending...';
                        try {
                            const res = await fetch(`${API_BASE}/api/friendship/request`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', 'credentials': 'include' },
                                body: JSON.stringify({ recipientId: parseInt(recipientId) })
                            });
                            if (res.ok) {
                                showNotification('Friend request sent!', 'success');
                                if(currentQuery) performSearch(currentQuery, container);
                                else loadFriendsAndRequests(container);
                            } else {
                                const err = await res.json();
                                const msg = err.error || 'Request failed';
                                showNotification(msg.replace('IllegalStateException:', ''), 'error');
                                btn.disabled = false;
                                btn.textContent = oldText;
                            }
                        } catch (err) { btn.disabled = false; btn.textContent = 'Add Friend'; }
                    });
                });

                // 2. Unfriend / Cancel Request (FIXED FUNCTIONALITY)
                container.querySelectorAll('.js-unfriend').forEach(btn => {
                     btn.addEventListener('click', async () => {
                        const targetId = btn.dataset.id;
                        const action = btn.dataset.action; // 'unfriend' or 'cancel'
                        const isCancel = action === 'cancel';
                        if(!confirm(isCancel ? "Cancel request?" : "Remove friend?")) return;

                        try {
                            const res = await fetch(`${API_BASE}/api/friendship/remove`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', 'credentials': 'include' },
                                body: JSON.stringify({ targetUserId: parseInt(targetId) })
                            });
                            if (res.ok) {
                                showNotification(isCancel ? 'Request cancelled' : 'Friend removed', 'success');
                                
                                // After successful removal, refresh the list based on context
                                if(currentQuery) performSearch(currentQuery, container);
                                else loadFriendsAndRequests(container);

                            } else {
                                showNotification('Failed to process removal.', 'error');
                            }
                        } catch(err) { console.error(err); }
                     });
                });

                // 3. Message Friend
                container.querySelectorAll('.js-message-friend').forEach(btn => {
                    btn.addEventListener('click', () => {
                        closeModal();
                        const item = btn.closest('.friend-list-item');
                        const payload = {
                            id: btn.dataset.id,
                            name: item.querySelector('.friend-name').textContent,
                            avatar: item.querySelector('.friend-avatar').src
                        };
                        if (window.handleNavigation) {
                            window.handleNavigation('messages');
                            setTimeout(() => {
                                if (App.startChatWithUser) App.startChatWithUser(payload);
                            }, 150);
                        }
                    });
                });
            }

        } catch (e) { console.error("Error opening modal:", e); }
    };
})(window.App);