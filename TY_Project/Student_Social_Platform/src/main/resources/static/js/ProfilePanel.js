// ProfilePanel.js  
// Global namespace
window.App = window.App || {};

(function (App) {
    // Resolve API base dynamically:
    // - Prefer window.AppConfig.API_BASE if present
    // - Otherwise use <meta name="api-base" content="..."> if present
    // - Otherwise default to empty string (relative fetches)
    const resolveApiBase = () => {
        try {
            if (window.AppConfig && typeof window.AppConfig.API_BASE === 'string' && window.AppConfig.API_BASE.trim()) {
                return window.AppConfig.API_BASE.trim().replace(/\/$/, '');
            }
            const meta = document.querySelector('meta[name="api-base"]');
            if (meta && meta.content && meta.content.trim()) {
                return meta.content.trim().replace(/\/$/, '');
            }
        } catch (e) {
            console.warn('resolveApiBase error', e);
        }
        return ''; // allow relative paths
    };

    const API_BASE = resolveApiBase();

    // ------------------------------
    // SHARED HELPERS
    // ------------------------------
    App.fetchData = async (endpoint, opts = {}) => {
        const isAbsolute = typeof endpoint === 'string' && /^(https?:)?\/\//i.test(endpoint);
        const url = isAbsolute ? endpoint : `${API_BASE}${endpoint}`;

        const fetchOptions = Object.assign({
            method: 'GET',
            credentials: 'include',
            headers: {
                'Accept': 'application/json'
            }
        }, opts);

        const response = await fetch(url, fetchOptions);
        if (!response.ok) {
            let bodyText = '';
            try {
                const ct = response.headers.get('content-type') || '';
                if (ct.includes('application/json')) {
                    const json = await response.json();
                    bodyText = json.message || JSON.stringify(json);
                } else {
                    bodyText = await response.text();
                }
            } catch (e) {
                bodyText = '';
            }
            const err = new Error(`Failed to fetch ${url} (${response.status})${bodyText ? `: ${bodyText}` : ''}`);
            err.status = response.status;
            err.response = response;
            throw err;
        }
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            return response.json();
        }
        return response.text();
    };

    App.renderSpinner = (panel) => {
        if (!panel) return;
        panel.innerHTML = `
            <div class="profile-spinner-wrapper">
                <div class="profile-spinner"></div>
            </div>
        `;
    };

    App.renderHome = (panel) => {
        if (!panel) return;
        panel.innerHTML = `<div class="empty-feed-placeholder"></div>`;
    };

    // ------------------------------
    // Modal helper (reusable-modal exists in home_dash.html)
    // ------------------------------
    App.openModalFromUrl = async (url, options = {}) => {
        // #reusable-modal and #reusable-modal-content are expected to exist in DOM.
        const modal = document.getElementById('reusable-modal');
        const modalContent = document.getElementById('reusable-modal-content');
        if (!modal || !modalContent) {
            console.warn('Modal container not found (#reusable-modal / #reusable-modal-content).');
            return;
        }

        try {
            const resp = await fetch(url + '?v=' + new Date().getTime());
            if (!resp.ok) throw new Error('Failed to load: ' + url);
            const html = await resp.text();
            modalContent.innerHTML = html;

            // show modal
            modal.style.display = 'flex';
            // small timeout to allow CSS transitions (if any)
            setTimeout(() => modal.classList.add('show'), 10);
            if (options.large) modal.classList.add('modal-large');

            // Attach close handler(s) (ensure no duplicated listeners)
            const closeBtns = modal.querySelectorAll('.js-close-modal, .auth-modal-close-btn, [data-modal-close], #edit-close-btn, #edit-cancel-btn');
            closeBtns.forEach(btn => {
                // replace to avoid stacking listeners if previously attached
                const replacement = btn.cloneNode(true);
                btn.parentNode.replaceChild(replacement, btn);
                replacement.addEventListener('click', () => {
                    modal.classList.remove('show');
                    setTimeout(() => {
                        modal.style.display = 'none';
                        modal.classList.remove('modal-large');
                        modalContent.innerHTML = '';
                    }, 250);
                });
            });

            // Close when clicking backdrop (but avoid closing when clicking modal inner content)
            const onBackdropClick = (ev) => {
                if (ev.target === modal) {
                    modal.classList.remove('show');
                    setTimeout(() => {
                        modal.style.display = 'none';
                        modal.classList.remove('modal-large');
                        modalContent.innerHTML = '';
                    }, 250);
                    modal.removeEventListener('click', onBackdropClick);
                }
            };
            modal.addEventListener('click', onBackdropClick);

            // Return modalContent for further wiring if caller needs it
            return modalContent;
        } catch (err) {
            console.error('openModalFromUrl error:', err);
            // small visual fallback
            modalContent.innerHTML = `<div style="padding:1.2rem;color:#f9fafb">Failed to open content.</div>`;
            modal.style.display = 'flex';
            setTimeout(() => modal.classList.add('show'), 10);
            return modalContent;
        }
    };

    // ------------------------------
    // NEW: Friends Modal Logic (uses external friend_list.html)
    // ------------------------------
    App.openFriendsModal = async () => {
        console.log("[ChatPanel] Opening Friends Modal...");
        
        // 1. Find the GLOBAL modal shell (defined in home_dash.html)
        const friendsModal = document.getElementById('reusable-modal');
        const friendsModalContent = document.getElementById('reusable-modal-content');
        const closeFriendsBtn = friendsModal ? friendsModal.querySelector('.js-close-modal') : null;

        if (!friendsModal || !friendsModalContent) {
            console.error("CRITICAL: #reusable-modal not found in DOM.");
            return;
        }

        try {
            // 2. Show loading state
            friendsModalContent.innerHTML = '<div style="padding:5rem;text-align:center;color:#666;">Loading...</div>';
            friendsModal.style.display = 'flex';
            
            // 3. Fetch content
            const modalHtml = await App.fetchData ? await (async () => {
                // use App.fetchData (which returns parsed json/text depending), but we need raw html
                // fall back to fetch directly to preserve previous behavior
                try {
                    const r = await fetch('friend_list.html' + '?v=' + new Date().getTime());
                    if (!r.ok) throw new Error('Failed to load: friend_list.html');
                    return await r.text();
                } catch (e) {
                    console.warn('fetch friend_list.html via fetch fallback', e);
                    return null;
                }
            })() : null;
            
            if (!modalHtml) {
                friendsModalContent.innerHTML = '<p style="color:red;padding:20px;">Error loading friend_list.html</p>';
                return;
            }

            // 4. Inject Content
            friendsModalContent.innerHTML = modalHtml;

            // 5. Animation
            setTimeout(() => friendsModal.classList.add('show'), 10);
            friendsModal.classList.add('modal-large');

            // 6. Close Logic
            const close = () => {
                friendsModal.classList.remove('show');
                friendsModal.classList.remove('modal-large');
                setTimeout(() => {
                    friendsModal.style.display = 'none';
                    friendsModalContent.innerHTML = '';
                }, 300);
            };

            // Remove old listeners to prevent stacking
            if (closeFriendsBtn) {
                const newCloseBtn = closeFriendsBtn.cloneNode(true);
                closeFriendsBtn.parentNode.replaceChild(newCloseBtn, closeFriendsBtn);
                newCloseBtn.addEventListener('click', close);
            }
            
            // Also bind any close buttons INSIDE the loaded HTML
            const innerCloseBtns = friendsModalContent.querySelectorAll('.js-close-modal');
            innerCloseBtns.forEach(btn => btn.addEventListener('click', close));

            friendsModal.onclick = (e) => {
                if (e.target === friendsModal) close();
            };

            // 7. Button Logic (Message / Unfriend)
            const listItems = friendsModalContent.querySelectorAll('.friend-list-item');
            listItems.forEach(item => {
                 const messageBtn = item.querySelector('.btn-primary'); // Adjusted selector
                 const unfriendBtn = item.querySelector('.btn-unfriend'); // Adjusted selector
                 const friendNameEl = item.querySelector('.friend-name');
                 const avatarEl = item.querySelector('.friend-avatar');
                 const friendName = friendNameEl ? friendNameEl.textContent.trim() : null;
                 const friendAvatar = avatarEl ? avatarEl.src : null;

                 if (messageBtn) {
                     messageBtn.addEventListener('click', () => {
                         // Close modal
                         close();

                         // Prepare payload for chat-start
                         const payload = {
                             id: 'friend-' + Date.now().toString(),
                             name: friendName,
                             avatar: friendAvatar
                         };

                         // 1) Switch to messages view (if global nav exists)
                         if (window.handleNavigation) {
                             window.handleNavigation('messages');
                             // Start chat slightly after navigation to allow renderer to mount
                             setTimeout(() => {
                                 // Dispatch an event for any listeners
                                 document.dispatchEvent(new CustomEvent('chat-start-new', { detail: payload }));
                                 // Also try direct call
                                 if (App.startChatWithUser) App.startChatWithUser(payload);
                             }, 150);
                         } else {
                             // No navigation handler — just start chat
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

    // ------------------------------
    // HEADER HELPER FOR FLOATING BOX
    // ------------------------------
    function setPageHeader(title, subtitle) {
        const titleEl = document.getElementById('content-title') || document.getElementById('main-view-title');
        const subtitleEl = document.getElementById('content-subtitle') || document.getElementById('main-view-subtitle');

        if (titleEl) titleEl.textContent = title;
        if (subtitleEl && typeof subtitle === 'string') {
            subtitleEl.textContent = subtitle;
        }
    }

    App.setPageHeader = setPageHeader;

    // ------------------------------
    // FAKE PROFILE STATE (IN-MEMORY)
    // ------------------------------
    const profileState = {
        username: 'roshansingh',
        major: 'Computer Science Major',
        email: 'roshansingh5773@gmail.com',
        joinedDate: 'September 2021',
        institute: 'My University',
        dob: 'January 15, 2000',
        bio: 'Passionate about technology and innovation. Love coding and exploring new frameworks.',
        avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400',
        isVerified: true
    };

    // ------------------------------
    // PROFILE VIEW
    // ------------------------------
    App.renderProfile = async (panel) => {
        if (!panel) return;

        // Restore header for normal profile view
        setPageHeader('Profile', 'Manage your account and profile');

        // make sure outer panel can scroll normally again
        panel.classList.remove('profile-edit-root');

        // Simulated async load
        App.renderSpinner(panel);
        await new Promise((res) => setTimeout(res, 250));

        const data = profileState;

        panel.innerHTML = `
            <div class="profile-page-wrapper">
                <div class="profile-card-main">
                    <div class="profile-main-layout">
                        <!-- AVATAR -->
                        <div class="profile-avatar-col">
                            <div class="profile-avatar-wrapper">
                                <img id="profile-avatar-img"
                                     src="${data.avatarUrl}"
                                     alt="Profile photo"
                                     class="profile-avatar-img" />
                                ${data.isVerified ?`
                                <div class="profile-avatar-status-badge">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                         stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                                        <polyline points="20 6 9 17 4 12"></polyline>
                                    </svg>
                                </div>` : ''}
                            </div>
                        </div>

                        <!-- INFO -->
                        <div class="profile-main-info">
                            <div class="profile-main-header-row">
                                <div class="profile-main-title">
                                    <h2 class="profile-username-display">@${data.username}</h2>
                                    ${data.isVerified ? `
                                    <span class="profile-pill profile-pill-verified">Verified</span>` : ''}
                                </div>

                                <button id="profile-edit-btn" class="profile-edit-btn">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
                                         viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                         stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                    </svg>
                                    Edit Profile
                                </button>
                            </div>

                            <p id="profile-major-text" class="profile-major-display">${data.major}</p>

                            <div class="profile-bio-box">
                                <p id="profile-bio-text" class="profile-bio-text">${data.bio}</p>
                            </div>

                            <!-- CONTACT GRID -->
                            <div class="profile-contact-grid">
                                <div class="profile-contact-item">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
                                         viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                         stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                        <polyline points="22,6 12,13 2,6"></polyline>
                                    </svg>
                                    <span id="profile-email-text">${data.email}</span>
                                </div>
                                <div class="profile-contact-item">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
                                         viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                         stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                                        <circle cx="12" cy="10" r="3"></circle>
                                    </svg>
                                    <span id="profile-institute-text">${data.institute}</span>
                                </div>
                                <div class="profile-contact-item">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
                                         viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                         stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                        <line x1="16" y1="2" x2="16" y2="6"></line>
                                        <line x1="8" y1="2" x2="8" y2="6"></line>
                                        <line x1="3" y1="10" x2="21" y2="10"></line>
                                    </svg>
                                    <span id="profile-joined-text">Joined ${data.joinedDate}</span>
                                </div>
                                <div class="profile-contact-item">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
                                         viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                         stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                        <line x1="16" y1="2" x2="16" y2="6"></line>
                                        <line x1="8" y1="2" x2="8" y2="6"></line>
                                        <line x1="3" y1="10" x2="21" y2="10"></line>
                                    </svg>
                                    <span id="profile-dob-text">DOB: ${data.dob}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- TABS -->
                <div class="profile-tabs-row">
                    <button id="profile-tab-overview"
                            class="profile-tab-button profile-tab-active"
                            data-tab="overview">
                        Overview
                        <span class="profile-tab-underline"></span>
                    </button>
                    <button id="profile-tab-friends"
                            class="profile-tab-button"
                            data-tab="friends">
                        Friends (3)
                        <span class="profile-tab-underline"></span>
                    </button>
                </div>

                <!-- TAB CONTENT -->
                <div id="profile-tab-overview-content" class="profile-tab-section">
                    <div class="profile-overview-grid">
                        <!-- Verification Card -->
                        <div class="profile-status-card verification-card">
                            <div class="profile-status-header">
                                <div class="profile-status-icon-wrapper verification-icon">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28"
                                         viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                         stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                        <circle cx="12" cy="12" r="10"></circle>
                                        <path d="M9 12l2 2 4-4"></path>
                                    </svg>
                                </div>
                                <div>
                                    <h3 class="profile-status-title">Verification Status</h3>
                                    <span class="profile-pill profile-pill-verified-soft">Verified Student</span>
                                </div>
                            </div>
                            <p class="profile-status-text">Your student status has been verified.</p>
                            <p class="profile-status-highlight">✓ Verified till September 15, 2021</p>
                        </div>

                        <!-- Logout Card -->
                        <div class="profile-status-card logout-card">
                            <div class="profile-status-header">
                                <div class="profile-status-icon-wrapper logout-icon">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28"
                                         viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                         stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                                        <polyline points="16 17 21 12 16 7"></polyline>
                                        <line x1="21" y1="12" x2="9" y2="12"></line>
                                    </svg>
                                </div>
                                <div>
                                    <h3 class="profile-status-title">Account Access</h3>
                                    <p class="profile-status-text">Sign out of your account</p>
                                </div>
                            </div>
                            <button id="profile-logout-btn" class="profile-logout-btn">Log Out</button>
                        </div>
                    </div>
                </div>

                <div id="profile-tab-friends-content" class="profile-tab-section profile-tab-section-hidden">
                    <div class="profile-friends-placeholder-card">
                        <p>Friends list coming soon...</p>
                    </div>
                </div>
            </div>
        `;

        // --- LISTENERS ---

        // Edit Profile -> full page edit view
        const editBtn = panel.querySelector('#profile-edit-btn');
        if (editBtn) {
            editBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (App.renderEditProfile) {
                    App.renderEditProfile(panel, profileState);
                }
            });
        }

        // Tabs
        const overviewTabBtn = panel.querySelector('#profile-tab-overview');
        const friendsTabBtn = panel.querySelector('#profile-tab-friends');
        const overviewSection = panel.querySelector('#profile-tab-overview-content');
        const friendsSection = panel.querySelector('#profile-tab-friends-content');

        // original tab toggling (overview <-> friends placeholder)
        function setActiveTab(tab) {
            if (!overviewTabBtn || !friendsTabBtn || !overviewSection || !friendsSection) return;

            if (tab === 'overview') {
                overviewTabBtn.classList.add('profile-tab-active');
                friendsTabBtn.classList.remove('profile-tab-active');
                overviewSection.classList.remove('profile-tab-section-hidden');
                friendsSection.classList.add('profile-tab-section-hidden');
            } else {
                friendsTabBtn.classList.add('profile-tab-active');
                overviewTabBtn.classList.remove('profile-tab-active');
                friendsSection.classList.remove('profile-tab-section-hidden');
                overviewSection.classList.add('profile-tab-section-hidden');
            }
        }

        if (overviewTabBtn) {
            overviewTabBtn.addEventListener('click', () => setActiveTab('overview'));
        }

        // NEW: When friends tab clicked -> open friend_list.html in modal
        if (friendsTabBtn) {
            friendsTabBtn.addEventListener('click', async (e) => {
                e.preventDefault();

                // Use the new App.openFriendsModal so the friend_list.html file (separate) is used.
                await App.openFriendsModal();

                // keep the visual active tab state but do not switch main content area
                // mark it active briefly for UX feedback
                friendsTabBtn.classList.add('profile-tab-active');
                overviewTabBtn && overviewTabBtn.classList.remove('profile-tab-active');

                // Optionally remove active state after modal closes (keep it simple)
                const modal = document.getElementById('reusable-modal');
                if (modal) {
                    const observer = new MutationObserver(() => {
                        if (!modal.classList.contains('show')) {
                            friendsTabBtn.classList.remove('profile-tab-active');
                            overviewTabBtn && overviewTabBtn.classList.add('profile-tab-active');
                            observer.disconnect();
                        }
                    });
                    observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
                }
            });
        }

        // Logout
        const logoutBtn = panel.querySelector('#profile-logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                try {
                    if (typeof window.logout === 'function') {
                        // If logout returns a promise, wait for it to finish
                        const res = window.logout();
                        if (res && typeof res.then === 'function') {
                            await res;
                        }
                    }
                } catch (err) {
                    console.warn('Logout function threw an error:', err);
                } finally {
                    // Redirect to index.html (force navigation)
                    try {
                        window.location.href = 'index.html';
                    } catch (err) {
                        // as a fallback
                        window.location.assign('index.html');
                    }
                }
            });
        }
    };

    // ------------------------------
    // EDIT PROFILE VIEW (FULL PAGE, INNER SCROLL ONLY)
    // ------------------------------
    App.renderEditProfile = async (panel, currentData) => {
        if (!panel) return;
        const data = currentData || profileState;

        // Update header for edit mode
        setPageHeader('Edit Profile', 'Update your account details');

        try {
            const response = await fetch('edit_profile.html?v=' + new Date().getTime());
            if (!response.ok) throw new Error('edit_profile.html not found');
            const html = await response.text();

            // lock outer panel (no scroll); only inner edit-body will scroll
            panel.classList.add('profile-edit-root');

            panel.innerHTML = html;

            // Populate non-editable fields
            const usernameEl = panel.querySelector('#edit-display-username');
            const emailEl = panel.querySelector('#edit-display-email');
            const instituteEl = panel.querySelector('#edit-display-institute');
            const dobEl = panel.querySelector('#edit-display-dob');

            if (usernameEl) usernameEl.textContent = '@' + data.username;
            if (emailEl) emailEl.textContent = data.email;
            if (instituteEl) instituteEl.textContent = data.institute;
            if (dobEl) dobEl.textContent = data.dob;

            // Editable fields
            const majorInput = panel.querySelector('#edit-major-input');
            const bioTextarea = panel.querySelector('#edit-bio-textarea');
            const avatarImg = panel.querySelector('#edit-avatar-img');
            const fileInput = panel.querySelector('#edit-avatar-file-input');

            if (majorInput) majorInput.value = data.major || '';
            if (bioTextarea) bioTextarea.value = data.bio || '';
            if (avatarImg) avatarImg.src = data.avatarUrl;

            // Image upload
            if (fileInput && avatarImg) {
                fileInput.addEventListener('change', (e) => {
                    const file = e.target.files && e.target.files[0];
                    if (!file) return;

                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const src = reader.result;
                        avatarImg.src = src;
                        avatarImg.dataset.newSrc = src;
                    };
                    reader.readAsDataURL(file);
                });
            }

            // Delete photo -> reset to default avatar
            const deleteBtn = panel.querySelector('#edit-delete-photo-btn');
            if (deleteBtn && avatarImg) {
                deleteBtn.addEventListener('click', () => {
                    const def = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400';
                    avatarImg.src = def;
                    avatarImg.dataset.newSrc = def;
                });
            }

            // Cancel / Close -> back to profile view (no changes)
            const goBackToProfile = (e) => {
                if (e) e.preventDefault();
                App.renderProfile(panel);
            };

            const cancelBtn = panel.querySelector('#edit-cancel-btn');
            if (cancelBtn) cancelBtn.addEventListener('click', goBackToProfile);

            const closeBtn = panel.querySelector('#edit-close-btn');
            if (closeBtn) closeBtn.addEventListener('click', goBackToProfile);

            // Save -> update profileState and re-render profile
            const saveBtn = panel.querySelector('#edit-save-btn');
            if (saveBtn) {
                saveBtn.addEventListener('click', (e) => {
                    e.preventDefault();

                    const newMajor = majorInput ? majorInput.value.trim() : data.major;
                    const newBio = bioTextarea ? bioTextarea.value.trim() : data.bio;
                    const newAvatar =
                        avatarImg && avatarImg.dataset.newSrc ? avatarImg.dataset.newSrc : data.avatarUrl;

                    profileState.major = newMajor || profileState.major;
                    profileState.bio = newBio || profileState.bio;
                    profileState.avatarUrl = newAvatar || profileState.avatarUrl;

                    App.renderProfile(panel);
                });
            }
        } catch (err) {
            console.error('Failed to load edit profile view:', err);
            panel.innerHTML = "<p class='text-secondary' style='text-align:center;'>Error loading edit profile page.</p>";
        }
    };

    // Simple placeholders for other views
    App.renderNotifications = (panel) => {
        if (!panel) return;
        panel.innerHTML = '<div class="empty-feed-placeholder"><h3 class="section-title">Notifications</h3></div>';
    };

    App.renderSettings = (panel) => {
        if (!panel) return;
        panel.innerHTML = '<div class="empty-feed-placeholder"><h3 class="section-title">Settings</h3></div>';
    };
})(window.App);
