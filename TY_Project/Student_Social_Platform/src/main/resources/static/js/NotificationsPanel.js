// Add to window.App
window.App = window.App || {};

(function(App) {

    // --- Helper: Fetch HTML ---
    async function loadHtml(url) {
        try {
            const response = await fetch(url + '?v=' + new Date().getTime());
            if (!response.ok) throw new Error(`Failed to load ${url}`);
            return await response.text();
        } catch (err) {
            console.error("[Notifications] HTML Load Error:", err);
            return null;
        }
    }

    // --- Mock Data (Added Friend Request) ---
    let notifications = [
        { id: 1, type: 'like', user: 'Sarah Johnson', text: 'liked your post "Final Project Ideas"', time: '2m ago', read: false },
        { id: 2, type: 'friend_request', user: 'James Smith', text: 'sent you a friend request', time: '15m ago', read: false },
        { id: 3, type: 'comment', user: 'Mike Chen', text: 'commented: "This looks amazing! Great work."', time: '1h ago', read: false },
        { id: 4, type: 'follow', user: 'Emily Davis', text: 'started following you', time: '3h ago', read: true },
        { id: 5, type: 'system', user: 'System', text: 'Your password was changed successfully.', time: '1d ago', read: true }
    ];

    let currentFilter = 'all';

    // --- Helper: Update Mobile/Desktop Nav Badge ---
    function updateMobileBadge() {
        const unreadCount = notifications.filter(n => !n.read).length;
        
        // Selector for the mobile navigation item (Notifications)
        // Assuming the link has href="#notifications"
        const navLinks = document.querySelectorAll('a[href="#notifications"]');
        
        navLinks.forEach(link => {
            // Check if badge already exists
            let badge = link.querySelector('.nav-notification-badge');
            
            if (unreadCount > 0) {
                if (!badge) {
                    badge = document.createElement('div');
                    badge.className = 'nav-notification-badge';
                    // Ensure relative positioning on parent for absolute badge
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
        console.log("Rendering Notifications Panel...");
        
        // 1. Load Layout
        const html = await loadHtml('notifications_panel.html');
        if (!html) {
            panel.innerHTML = '<p class="error-msg">Error loading notifications.</p>';
            return;
        }
        panel.innerHTML = html;

        // 2. Render List
        renderList(panel);
        updateMobileBadge(); // Update badge on load

        // 3. Event Listeners
        
        // Tabs
        const tabs = panel.querySelectorAll('.notif-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                currentFilter = tab.getAttribute('data-filter');
                renderList(panel);
            });
        });

        // Mark All Read
        const markAllBtn = panel.querySelector('#btn-mark-all-read');
        if(markAllBtn) {
            markAllBtn.addEventListener('click', () => {
                notifications.forEach(n => n.read = true);
                renderList(panel);
                updateMobileBadge();
            });
        }
    };

    // --- Render List Helper ---
    function renderList(panel) {
        const container = panel.querySelector('#notifications-list-container');
        if (!container) return;

        // Filter Logic
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
            // Icons map
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

            // Friend Request Buttons Logic
            let contentHtml = `<p class="notif-text"><strong>${n.user}</strong> ${n.text}</p>`;
            if (n.type === 'friend_request') {
                contentHtml += `
                <div class="friend-request-actions">
                    <button class="btn-confirm js-confirm-req" data-id="${n.id}">Accept</button>
                    <button class="btn-delete-req js-delete-req" data-id="${n.id}">Reject</button>
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
                    ${!n.read ? `
                    <button class="btn-icon-sm js-read-notif" data-id="${n.id}" title="Mark as read">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </button>` : ''}
                </div>
            </div>
            `;
        }).join('');

        // Attach Listeners
        
        // 1. Delete Notification
        container.querySelectorAll('.js-delete-notif').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id);
                notifications = notifications.filter(n => n.id !== id);
                renderList(panel);
                updateMobileBadge();
            });
        });

        // 2. Mark Read
        container.querySelectorAll('.js-read-notif').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id);
                const notif = notifications.find(n => n.id === id);
                if (notif) {
                    notif.read = true;
                    renderList(panel);
                    updateMobileBadge();
                }
            });
        });

        // 3. Friend Request: Confirm
        container.querySelectorAll('.js-confirm-req').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id);
                alert("Friend request accepted!");
                // In real app: api call
                notifications = notifications.filter(n => n.id !== id); // Remove notification after action
                renderList(panel);
                updateMobileBadge();
            });
        });

        // 4. Friend Request: Delete
        container.querySelectorAll('.js-delete-req').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id);
                notifications = notifications.filter(n => n.id !== id); // Just remove it
                renderList(panel);
                updateMobileBadge();
            });
        });
        
        // 5. Card Click (Mark read)
        container.querySelectorAll('.notification-item.unread').forEach(item => {
             item.addEventListener('click', () => {
                 const id = parseInt(item.id.replace('notif-', ''));
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
    // Wait a moment for DOM nav items to exist
    setTimeout(updateMobileBadge, 1000);

})(window.App);