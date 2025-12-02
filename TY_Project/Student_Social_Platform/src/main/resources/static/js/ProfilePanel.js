// ProfilePanel.js
// Global namespace
window.App = window.App || {};

(function (App) {
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
        return ''; 
    };

    const API_BASE = resolveApiBase();

    App.fetchData = async (endpoint, opts = {}) => {
        const isAbsolute = typeof endpoint === 'string' && /^(https?:)?\/\//i.test(endpoint);
        const url = isAbsolute ? endpoint : `${API_BASE}${endpoint}`;

        const fetchOptions = Object.assign({
            method: 'GET',
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
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
            } catch (e) { bodyText = ''; }
            const err = new Error(`Failed to fetch ${url} (${response.status})`);
            err.status = response.status;
            throw err;
        }
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) return response.json();
        return response.text();
    };

    App.renderSpinner = (panel) => {
        if (!panel) return;
        panel.innerHTML = `<div class="profile-spinner-wrapper"><div class="profile-spinner"></div></div>`;
    };

    App.renderHome = (panel) => {
        if (!panel) return;
        panel.innerHTML = `<div class="empty-feed-placeholder"></div>`;
    };

    App.openModalFromUrl = async (url, options = {}) => {
        const modal = document.getElementById('reusable-modal');
        const modalContent = document.getElementById('reusable-modal-content');
        if (!modal || !modalContent) return;

        try {
            const resp = await fetch(url + '?v=' + new Date().getTime());
            if (!resp.ok) throw new Error('Failed');
            modalContent.innerHTML = await resp.text();
            modal.style.display = 'flex';
            setTimeout(() => modal.classList.add('show'), 10);
            if (options.large) modal.classList.add('modal-large');

            const close = () => {
                modal.classList.remove('show');
                setTimeout(() => { modal.style.display = 'none'; modalContent.innerHTML = ''; }, 250);
            };
            
            modal.querySelectorAll('.js-close-modal, #edit-close-btn, #edit-cancel-btn').forEach(btn => 
                btn.addEventListener('click', close));
            
            modal.onclick = (e) => { if(e.target === modal) close(); };
            
            return modalContent;
        } catch (e) { console.error(e); }
    };

    // ... (Friends Modal Logic - kept as is) ...
    App.openFriendsModal = async () => {
        /* ... Existing Friends Modal Code ... */
    };

    App.setPageHeader = (title, subtitle) => {
        const t = document.getElementById('content-title') || document.getElementById('main-view-title');
        const s = document.getElementById('content-subtitle') || document.getElementById('main-view-subtitle');
        if (t) t.textContent = title;
        if (s) s.textContent = subtitle || '';
    };

    // ------------------------------
    // PROFILE VIEW
    // ------------------------------
    App.renderProfile = async (panel) => {
        if (!panel) return;

        App.setPageHeader('Profile', 'Manage your account and profile');
        panel.classList.remove('profile-edit-root');
        App.renderSpinner(panel);

        let data = null;
        try {
            data = await App.fetchData('/api/my-profile');
        } catch (e) {
            console.error("Fetch error:", e);
            panel.innerHTML = `<p class="text-secondary" style="text-align:center;">Failed to load profile.</p>`;
            return;
        }

        // --- UPDATED FORMATTERS ---
        const formatJoinedDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'N/A';
        
        const formatDob = (d) => {
            if (!d) return ''; 
            try { return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }); }
            catch (e) { return d; }
        };
        
        const formatExpireDate = (d) => {
            if (!d) return '';
            try { return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }); }
            catch (e) { return ''; }
        };

        // --- UPDATED DATA MAPPING (REMOVED HARDCODED DEFAULTS) ---
        const profileData = {
            username: data.username ? data.username.replace(/^@/, '') : 'user',
            major: data.major || '', // No longer defaults to "Computer Science Major"
            institute: data.schoolName || 'My University', 
            email: data.email || 'N/A',
            joinedDate: formatJoinedDate(data.joinedAt),
            dob: formatDob(data.birthday), 
            avatarUrl: data.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400',
            isVerified: data.isVerified === 1 || data.isVerified === true,
            accountExpireDate: formatExpireDate(data.accountExpireDate),
            bio: data.bio || '' // Defaults to empty string for editing
        };

        // For display in the profile card, we use a placeholder text if bio is empty
        const displayBio = profileData.bio || 'Tell us about yourself...';

        panel.innerHTML = `
            <div class="profile-page-wrapper">
                <div class="profile-card-main">
                    <div class="profile-main-layout">
                        <div class="profile-avatar-col">
                            <div class="profile-avatar-wrapper">
                                <img id="profile-avatar-img" src="${profileData.avatarUrl}" class="profile-avatar-img" />
                                ${profileData.isVerified ? `<div class="profile-avatar-status-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></div>` : ''}
                            </div>
                        </div>

                        <div class="profile-main-info">
                            <div class="profile-main-header-row">
                                <div class="profile-main-title">
                                    <h2 class="profile-username-display">@${profileData.username}</h2>
                                    ${profileData.isVerified ? `<span class="profile-pill profile-pill-verified">Verified</span>` : ''}
                                </div>
                                <button id="profile-edit-btn" class="profile-edit-btn">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                    Edit Profile
                                </button>
                            </div>

                            ${profileData.major ? `<p class="profile-major-display">${profileData.major}</p>` : ''}

                            <div class="profile-bio-box"><p class="profile-bio-text">${displayBio}</p></div>

                            <div class="profile-contact-grid">
                                <div class="profile-contact-item">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><polyline points="22,6 12,13 2,6"></polyline></svg>
                                    <span>${profileData.email}</span>
                                </div>
                                <div class="profile-contact-item">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                                    <span>${profileData.institute}</span>
                                </div>
                                <div class="profile-contact-item">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                    <span>Joined ${profileData.joinedDate}</span>
                                </div>
                                <div class="profile-contact-item">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                    <span>DOB: ${profileData.dob}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Tab Placeholders -->
                 <div class="profile-tabs-row">
                    <button id="profile-tab-overview" class="profile-tab-button profile-tab-active">Overview<span class="profile-tab-underline"></span></button>
                    <button id="profile-tab-friends" class="profile-tab-button">Friends (3)<span class="profile-tab-underline"></span></button>
                </div>
                
                <div id="profile-tab-overview-content" class="profile-tab-section">
                     <div class="profile-overview-grid">
                        <div class="profile-status-card verification-card">
                             <div class="profile-status-header">
                                <div class="profile-status-icon-wrapper verification-icon"><svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9 12l2 2 4-4"></path></svg></div>
                                <div><h3 class="profile-status-title">Verification Status</h3><span class="profile-pill profile-pill-verified-soft">Verified Student</span></div>
                             </div>
                             <p class="profile-status-text">Your student status has been verified.</p>
                             <p class="profile-status-highlight">✓ Valid till ${profileData.accountExpireDate}</p>
                        </div>
                        <div class="profile-status-card logout-card">
                             <div class="profile-status-header">
                                <div class="profile-status-icon-wrapper logout-icon"><svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg></div>
                                <div><h3 class="profile-status-title">Account Access</h3><p class="profile-status-text">Sign out of your account</p></div>
                             </div>
                             <button id="profile-logout-btn" class="profile-logout-btn">Log Out</button>
                        </div>
                     </div>
                </div>
                <div id="profile-tab-friends-content" class="profile-tab-section profile-tab-section-hidden"></div>
            </div>
        `;

        // --- LISTENERS ---
        const editBtn = panel.querySelector('#profile-edit-btn');
        if (editBtn) {
            editBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (App.renderEditProfile) {
                    App.renderEditProfile(panel, profileData); 
                } else {
                    console.error("App.renderEditProfile function not found.");
                }
            });
        }

        // ... (Tabs and Logout listeners same as before) ...
        const logoutBtn = panel.querySelector('#profile-logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                if (typeof window.logout === 'function') await window.logout();
                else window.location.href = 'index.html';
            });
        }
        
        const friendsTab = panel.querySelector('#profile-tab-friends');
        if(friendsTab) {
            friendsTab.addEventListener('click', (e) => {
                e.preventDefault();
                if(App.openFriendsModal) App.openFriendsModal();
            });
        }
    };
})(window.App);