// Add to window.App
window.App = window.App || {};

(function(App) {

    const API_BASE = 'http://localhost:8000';
    let stompClient = null;
    let notifications = [];
    let currentFilter = 'all';
    let userId = null;

    // --- Helper: Fetch HTML ---
    async function loadHtml(url) {
        try {
            const response = await fetch(url + '?v=' + new Date().getTime());
            if (!response.ok) throw new Error(`Failed to load ${url}`);
            return await response.text();
        } catch (err) {
            return null;
        }
    }

    // --- Helper: Get Current User ID ---
    async function getCurrentUserId() {
        if (userId) return userId;
        try {
            const res = await App.fetchData('/api/my-profile');
            if (res.userId) { userId = res.userId; return userId; }
        } catch (e) { console.error(e); }
        return null;
    }

    // --- WebSocket Connection ---
    function connectWebSocket() {
        if (stompClient && stompClient.connected) return;
        if (!userId) return;

        if (!window.SockJS || !window.Stomp) return;

        const socket = new SockJS('/ws');
        stompClient = Stomp.over(socket);
        stompClient.debug = null; 

        stompClient.connect({}, function(frame) {
            console.log('[Notifications] Connected to WebSocket');
            
            // Subscribe to private notifications
            stompClient.subscribe(`/user/${userId}/queue/notifications`, function(messageOutput) {
                console.log("[Notifications] New Alert:", messageOutput.body);
                const newNotif = JSON.parse(messageOutput.body);
                handleIncomingNotification(newNotif);
            });

        }, function(error) {
            console.error('[Notifications] WebSocket Error:', error);
        });
    }

    function handleIncomingNotification(n) {
        // Map fields
        const mapped = {
            id: n.id,
            type: mapNotificationType(n.type),
            user: n.senderSnapshot ? n.senderSnapshot.username : 'System',
            avatar: n.senderSnapshot ? n.senderSnapshot.avatarUrl : null,
            text: n.message,
            time: 'Just now',
            read: false,
            senderId: n.senderId
        };

        // Add to list
        notifications.unshift(mapped);
        
        // Update UI if panel is open
        const container = document.getElementById('notifications-list-container');
        if (container) {
            renderList(document.querySelector('.notifications-layout'));
        }

        // Update Badge
        updateMobileBadge();
        
        // Show global toast
        if(App.showGlobalNotification) {
            App.showGlobalNotification(`New notification from ${mapped.user}`, 'success');
        }
    }

    function timeAgo(dateString) {
        if (!dateString) return 'Just now';
        const date = new Date(dateString);
        const now = new Date();
        const seconds = Math.floor((now - date) / 1000);
        if (seconds < 60) return 'Just now';
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + "y ago";
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + "mo ago";
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + "d ago";
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + "h ago";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + "m ago";
        return "Just now";
    }

    function mapNotificationType(backendType) {
        if (!backendType) return 'system';
        const type = backendType.toString().toUpperCase();
        if (type === 'FRIEND_REQ') return 'friend_request';
        if (type === 'FRIEND_ACCEPT') return 'system'; 
        return type.toLowerCase();
    }

    function updateMobileBadge() {
        const unreadCount = notifications.filter(n => !n.read).length;
        const navLinks = document.querySelectorAll('a[href="#notifications"]');
        
        navLinks.forEach(link => {
            let badge = link.querySelector('.nav-notification-badge');
            if (unreadCount > 0) {
                if (!badge) {
                    badge = document.createElement('div');
                    badge.className = 'nav-notification-badge';
                    link.style.position = 'relative'; 
                    link.appendChild(badge);
                }
                badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
                badge.style.display = 'flex';
            } else {
                if (badge) badge.style.display = 'none';
            }
        });
    }

    // --- Main Render Function ---
    App.renderNotifications = async (panel) => {
        // Ensure user ID is loaded for WS connection
        await getCurrentUserId();
        connectWebSocket();
        
        console.log("Rendering Notifications Panel...");
        const html = await loadHtml('notifications_panel.html');
        if (!html) {
            panel.innerHTML = '<p class="error-msg">Error loading notifications.</p>';
            return;
        }
        panel.innerHTML = html;

        const container = panel.querySelector('#notifications-list-container');
        container.innerHTML = '<div class="spinner-wrapper"><div class="spinner"></div></div>';

        try {
            const rawData = await App.fetchData('/api/notifications');
            notifications = rawData.map(n => ({
                id: n.id, 
                type: mapNotificationType(n.type),
                user: n.senderSnapshot ? n.senderSnapshot.username : 'System',
                avatar: n.senderSnapshot ? n.senderSnapshot.avatarUrl : null,
                text: n.message,
                time: timeAgo(n.createdAt),
                read: n.read,
                senderId: n.senderId 
            }));
        } catch (err) {
            console.error("Failed to fetch notifications", err);
        }

        renderList(panel);
        updateMobileBadge();

        const tabs = panel.querySelectorAll('.notif-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                currentFilter = tab.getAttribute('data-filter');
                renderList(panel);
            });
        });

        const markAllBtn = panel.querySelector('#btn-mark-all-read');
        if(markAllBtn) {
            markAllBtn.addEventListener('click', async () => {
                // Optimistic update
                notifications.forEach(n => n.read = true);
                renderList(panel);
                updateMobileBadge();
                
                // Call Backend
                try {
                    await fetch(`${API_BASE}/api/notifications/mark-all-read`, {
                        method: 'POST',
                        credentials: 'include'
                    });
                } catch(e) { console.error(e); }
            });
        }
    };

    function renderList(panel) {
        const container = panel.querySelector('#notifications-list-container');
        if (!container) return;

        let filtered = notifications;
        if (currentFilter === 'unread') {
            filtered = notifications.filter(n => !n.read);
        } else if (currentFilter === 'requests') {
            filtered = notifications.filter(n => n.type === 'friend_request');
        }

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <svg class="empty-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C20.633 14.573 20 13.5 20 11V8a8 8 0 0 0-16 0v3c0 2.5-.633 3.573-2.738 4.326z"/></svg>
                    <p>No notifications found</p>
                </div>`;
            return;
        }

        container.innerHTML = filtered.map(n => {
            let icon = '';
            let iconClass = '';
            switch(n.type) {
                case 'like': icon = '❤️'; iconClass = 'notif-type-like'; break;
                case 'comment': icon = '💬'; iconClass = 'notif-type-comment'; break;
                case 'follow': icon = '👤'; iconClass = 'notif-type-follow'; break;
                case 'friend_request': icon = '👋'; iconClass = 'notif-type-request'; break;
                case 'system': icon = '⚙️'; iconClass = 'notif-type-system'; break;
                default: icon = '🔔'; iconClass = 'notif-type-system';
            }

            let contentHtml = `<p class="notif-text"><strong>${n.user}</strong> ${n.text}</p>`;
            
            if (n.type === 'friend_request') {
                contentHtml += `
                <div class="friend-request-actions">
                    <button class="btn-confirm js-confirm-req" data-id="${n.id}" data-sender="${n.senderId}">Accept</button>
                    <button class="btn-delete-req js-delete-req" data-id="${n.id}" data-sender="${n.senderId}">Reject</button>
                </div>`;
            }

            return `
            <div class="notification-item ${n.read ? '' : 'unread'}" id="notif-${n.id}">
                <div class="notif-icon-box ${iconClass}">
                    ${icon}
                </div>
                <div class="notif-content">
                    ${contentHtml}
                    <span class="notif-time">${n.time}</span>
                </div>
                ${!n.read ? '<div class="unread-dot"></div>' : ''}
                <div class="notif-actions">
                    <button class="btn-icon-sm js-delete-notif" data-id="${n.id}" title="Delete">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                    </button>
                </div>
            </div>
            `;
        }).join('');

        // Attach Listeners
        container.querySelectorAll('.js-confirm-req').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const notifId = btn.dataset.id;
                const senderId = btn.dataset.sender;
                btn.textContent = '...';
                try {
                    const res = await fetch('/api/friendship/respond', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'credentials': 'include' },
                        body: JSON.stringify({ requesterId: parseInt(senderId), action: 'accept' })
                    });
                    if (res.ok) {
                        notifications = notifications.filter(n => n.id !== notifId);
                        renderList(panel);
                        updateMobileBadge();
                    }
                } catch(err) {}
            });
        });

        container.querySelectorAll('.js-delete-req').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const notifId = btn.dataset.id;
                const senderId = btn.dataset.sender;
                try {
                     const res = await fetch('/api/friendship/respond', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'credentials': 'include' },
                        body: JSON.stringify({ requesterId: parseInt(senderId), action: 'reject' })
                    });
                    if (res.ok) {
                        notifications = notifications.filter(n => n.id !== notifId);
                        renderList(panel);
                        updateMobileBadge();
                    }
                } catch(err) {}
            });
        });
        
        container.querySelectorAll('.js-delete-notif').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                notifications = notifications.filter(n => n.id !== id);
                renderList(panel);
                updateMobileBadge();
            });
        });
        
        container.querySelectorAll('.notification-item.unread').forEach(item => {
             item.addEventListener('click', () => {
                 const id = item.id.replace('notif-', '');
                 const notif = notifications.find(n => n.id === id);
                 if (notif) {
                    notif.read = true;
                    renderList(panel);
                    updateMobileBadge();
                 }
             });
        });
    }

    // Initialize badge on script load (in case notification panel isn't open yet)
    setTimeout(async () => {
        await getCurrentUserId();
        if(userId) {
             connectWebSocket();
             // Initial fetch for badge count
             try {
                const rawData = await App.fetchData('/api/notifications');
                notifications = rawData.map(n => ({ ...n, read: n.read }));
                updateMobileBadge();
             } catch(e){}
        }
    }, 1500);

})(window.App);