// EditProfile.js
// This file contains the logic for the full-page profile editing interface.

window.App = window.App || {};

(function (App) {

    // Helper: Fetch HTML (used to load edit_profile.html content)
    async function loadHtml(url) {
        try {
            const response = await fetch(url + '?v=' + new Date().getTime());
            if (!response.ok) throw new Error(`Failed to load ${url}`);
            let text = await response.text();
            return text;
        } catch (err) {
            console.error("[EditProfile] HTML Load Error:", err);
            return null;
        }
    }

    // --- MAIN RENDER FUNCTION ---
    App.renderEditProfile = async (panel, currentData) => {
        if (!panel) return;
        
        // 1. Update Header
        App.setPageHeader('Edit Profile', 'Update your account details');

        // 2. Fetch and Inject HTML Layout
        const html = await loadHtml('edit_profile.html');
        if (!html) return;

        // Apply dark mode root class and inject layout
        panel.classList.add('profile-edit-root');
        panel.innerHTML = html;

        // 3. Elements and Data Mapping
        const data = currentData || {};

        const majorInput = panel.querySelector('#edit-major-input');
        const bioTextarea = panel.querySelector('#edit-bio-textarea');
        const avatarImg = panel.querySelector('#edit-avatar-img');
        const fileInput = panel.querySelector('#edit-avatar-file-input');

        // Populate Read-Only Fields (Data from SQLite Sync)
        const setText = (id, val) => {
            const el = panel.querySelector(`#${id}`);
            if (el) el.textContent = val || 'N/A';
        };

        // FIX: Ensure correct data fields are displayed, defaulting to "Not Provided" or "N/A"
        setText('edit-display-username', data.username ? '@' + data.username : '@user');
        setText('edit-display-email', data.email || 'N/A');
        setText('edit-display-institute', data.institute || 'N/A');
        setText('edit-display-dob', data.dob || 'Not Provided');
        
        // Populate Editable Fields (Data from Mongo)
        if (majorInput) majorInput.value = data.major || '';
        if (bioTextarea) bioTextarea.value = data.bio || '';
        if (avatarImg) avatarImg.src = data.avatarUrl;

        // 4. Listener Callbacks
        const goBackToProfile = (e) => {
            if (e) e.preventDefault();
            // Go back to the main profile view
            App.renderProfile(panel);
        };
        
        // 5. Attach Listeners (Cancel/Close)
        panel.querySelector('#edit-close-btn')?.addEventListener('click', goBackToProfile);
        panel.querySelector('#edit-cancel-btn')?.addEventListener('click', goBackToProfile);

        // 6. Avatar Upload/Delete Logic
        if (fileInput && avatarImg) {
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files && e.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onloadend = () => {
                    const src = reader.result;
                    avatarImg.src = src;
                    // Store the new source, but don't send to API yet
                    avatarImg.dataset.newSrc = src; 
                };
                reader.readAsDataURL(file);
            });
        }

        panel.querySelector('#edit-delete-photo-btn')?.addEventListener('click', () => {
            const defaultAvatar = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400';
            avatarImg.src = defaultAvatar;
            avatarImg.dataset.newSrc = defaultAvatar;
        });

        // 7. Save Handler (Saves Editable Fields + Image Uploads)
        panel.querySelector('#edit-profile-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = panel.querySelector('#edit-save-btn');
            const originalText = btn.textContent;
            btn.disabled = true;
            btn.textContent = 'Saving...';

            const majorUpdate = majorInput ? majorInput.value.trim() : currentData.major;
            const bioUpdate = bioTextarea ? bioTextarea.value.trim() : currentData.bio;
            const updates = { major: majorUpdate, bio: bioUpdate };
            let avatarUrlUpdate = currentData.avatarUrl; // Start with current URL

            try {
                // A) Handle Image Upload if a new file was selected
                if (fileInput.files[0]) {
                    const formData = new FormData();
                    formData.append('file', fileInput.files[0]);
                    
                    const imgRes = await App.fetchData('/api/my-profile/upload-photo', { 
                        method: 'POST', 
                        body: formData
                        // NOTE: Do NOT set Content-Type for FormData uploads
                    });
                    
                    avatarUrlUpdate = imgRes.url; // Use the path returned by the server
                    
                } else if (avatarImg.dataset.newSrc === 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400') {
                    // B) Handle Delete/Default Avatar
                    avatarUrlUpdate = avatarImg.dataset.newSrc;
                }
                
                // C) Send Text Updates (Bio/Major) and potentially the avatar URL if it changed but wasn't a multipart upload
                const textUpdates = { 
                    major: majorUpdate, 
                    bio: bioUpdate,
                    // Only send avatarUrl if it was changed (either uploaded or reset to default)
                    avatarUrl: avatarImg.dataset.newSrc ? avatarUrlUpdate : undefined
                };

                // Filter out undefined fields
                const filteredUpdates = Object.keys(textUpdates).reduce((acc, key) => {
                    if (textUpdates[key] !== undefined) {
                        acc[key] = textUpdates[key];
                    }
                    return acc;
                }, {});

                await App.fetchData('/api/my-profile/update', {
                   method: 'POST',
                   headers: {'Content-Type': 'application/json'},
                   body: JSON.stringify(filteredUpdates)
                });

                btn.textContent = 'Saved!';
                setTimeout(() => goBackToProfile(), 500);

            } catch (err) {
                console.error("Save failed:", err);
                btn.textContent = originalText;
                btn.disabled = false;
                alert("Save Failed. Check console for details.");
            }
        });
    };

})(window.App = window.App || {});