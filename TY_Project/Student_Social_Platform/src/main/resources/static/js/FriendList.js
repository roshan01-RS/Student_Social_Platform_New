// friend_list.js
// Create a global object to hold our view renderers
window.App = window.App || {};

(function(App) {

    // Helper: Fetch HTML
    async function loadHtml(url) {
        try {
            console.log(`[FriendList] Fetching ${url}...`);
            const response = await fetch(url + '?v=' + new Date().getTime());
            if (!response.ok) throw new Error(`Failed to load ${url}`);
            return await response.text();
        } catch (err) {
            console.error("[FriendList] HTML Load Error:", err);
            return null;
        }
    }

    // small helper to persist friend state in localStorage
    function storageKeyFor(name) {
        return 'friend_state_' + encodeURIComponent(name.trim().toLowerCase());
    }

    function saveFriendState(name, isFriend) {
        try {
            localStorage.setItem(storageKeyFor(name), JSON.stringify({ isFriend: !!isFriend }));
        } catch (e) {
            console.warn('Failed to save friend state', e);
        }
    }

    function loadFriendState(name) {
        try {
            const raw = localStorage.getItem(storageKeyFor(name));
            if (!raw) return { isFriend: true }; // default: friend (Unfriend shown)
            const parsed = JSON.parse(raw);
            return { isFriend: parsed && parsed.isFriend !== undefined ? !!parsed.isFriend : true };
        } catch (e) {
            console.warn('Failed to load friend state', e);
            return { isFriend: true };
        }
    }

    // --- OPEN FRIENDS LIST MODAL ---
    App.openFriendsModal = async () => {
        console.log("Opening Friends List Modal...");

        const modalContainer = document.getElementById('reusable-modal');
        const modalContent = document.getElementById('reusable-modal-content');
        const closeBtn = modalContainer ? modalContainer.querySelector('.js-close-modal') : null;

        if (!modalContainer) {
            console.error("Reusable modal container not found.");
            return;
        }

        const html = await loadHtml('friend_list.html');
        if (!html) {
            alert("Error loading friends list.");
            return;
        }

        modalContent.innerHTML = html;

        // Show Modal
        modalContainer.style.display = 'flex';
        setTimeout(() => modalContainer.classList.add('show'), 10);
        modalContainer.classList.add('modal-large');

        // --- Modal Logic ---
        const closeModal = () => {
            modalContainer.classList.remove('show');
            setTimeout(() => {
                modalContainer.style.display = 'none';
                modalContent.innerHTML = '';
            }, 300);
        };

        // Close Handlers
        if (closeBtn) {
            const newCloseBtn = closeBtn.cloneNode(true);
            closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
            newCloseBtn.addEventListener('click', closeModal);
        }

        // Close buttons inside the modal content
        modalContent.querySelectorAll('.js-close-modal').forEach(btn => {
            btn.addEventListener('click', closeModal);
        });

        // --- Button Logic inside the list ---
        const listItems = modalContent.querySelectorAll('.friend-list-item');

        listItems.forEach(item => {
            const messageBtn = item.querySelector('.btn-primary');
            // tolerant selector - prefer explicit classes in HTML
            const unfriendBtn = item.querySelector('.btn-unfriend') || item.querySelector('.btn-add-friend') || item.querySelector('button[type="button"].btn');
            const friendNameEl = item.querySelector('.friend-name');
            const avatarImg = item.querySelector('img');

            const friendName = friendNameEl ? friendNameEl.textContent.trim() : null;
            const friendAvatar = avatarImg ? avatarImg.src : null;

            if (!friendName) return; // skip malformed item

            // Load persisted state (default: isFriend = true => show "Unfriend")
            const persisted = loadFriendState(friendName);
            let isFriend = !!persisted.isFriend;

            // Initialize unfriend/add button text & classes based on persisted state
            if (unfriendBtn) {
                if (isFriend) {
                    unfriendBtn.textContent = 'Unfriend';
                    unfriendBtn.classList.remove('btn-add-friend');
                    unfriendBtn.classList.add('btn-unfriend');
                    unfriendBtn.setAttribute('aria-pressed', 'true');
                } else {
                    unfriendBtn.textContent = 'Add Friend';
                    unfriendBtn.classList.remove('btn-unfriend');
                    unfriendBtn.classList.add('btn-add-friend');
                    unfriendBtn.setAttribute('aria-pressed', 'false');
                }
            }

            // Initialize Message Button State (use class toggles for transitions)
            if (messageBtn) {
                if (!isFriend) {
                    messageBtn.classList.add('btn-disabled');
                    messageBtn.disabled = true;
                } else {
                    messageBtn.classList.remove('btn-disabled');
                    messageBtn.disabled = false;
                }
            }

            // MESSAGE button click -> navigate to chat panel and dispatch event
            if (messageBtn) {
                messageBtn.addEventListener('click', () => {
                    if (!isFriend) return; // should not be clickable when not friend
                    console.log(`Navigating to chat with ${friendName}`);
                    closeModal();

                    // Switch to messages view (global handler if available)
                    if (window.handleNavigation) {
                        window.handleNavigation('messages');
                    } else {
                        const msgLink = document.querySelector('a[href="#messages"]') || document.querySelector('a[data-view="messages"]') || document.querySelector('a[data-nav="messages"]');
                        if (msgLink) msgLink.click();
                    }

                    const event = new CustomEvent('chat-start-new', {
                        detail: {
                            name: friendName,
                            id: 'friend-' + Date.now().toString(),
                            avatar: friendAvatar
                        }
                    });
                    document.dispatchEvent(event);

                    // also try direct call if available
                    if (App.startChatWithUser) {
                        App.startChatWithUser({ name: friendName, id: 'friend-' + Date.now().toString(), avatar: friendAvatar });
                    }
                });
            }

            // TOGGLE Add/Unfriend - persist state to localStorage; use classes for transitions
            if (unfriendBtn) {
                unfriendBtn.addEventListener('click', (ev) => {
                    ev.stopPropagation();

                    // Toggle
                    isFriend = !isFriend;
                    saveFriendState(friendName, isFriend);

                    if (!isFriend) {
                        // Now removed friend -> show Add Friend styling/text
                        unfriendBtn.textContent = 'Add Friend';
                        unfriendBtn.classList.remove('btn-unfriend');
                        unfriendBtn.classList.add('btn-add-friend');
                        unfriendBtn.setAttribute('aria-pressed', 'false');

                        // Update Message Button (disable) - use class transition
                        if (messageBtn) {
                            messageBtn.classList.add('btn-disabled');
                            messageBtn.disabled = true;
                        }
                    } else {
                        // Now added friend -> show Unfriend styling/text
                        unfriendBtn.textContent = 'Unfriend';
                        unfriendBtn.classList.remove('btn-add-friend');
                        unfriendBtn.classList.add('btn-unfriend');
                        unfriendBtn.setAttribute('aria-pressed', 'true');

                        // Update Message Button (enable) - use class transition
                        if (messageBtn) {
                            // small timeout to allow CSS transition feel (optional)
                            setTimeout(() => {
                                messageBtn.classList.remove('btn-disabled');
                                messageBtn.disabled = false;
                            }, 10);
                        }
                    }
                });
            }
        });
    };

})(window.App);
