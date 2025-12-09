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
        if (App.setPageHeader) {
            App.setPageHeader('Edit Profile', 'Update your account details');
        }

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

        setText('edit-display-username', data.username ? '@' + data.username : '@user');
        setText('edit-display-email', data.email || 'N/A');
        setText('edit-display-institute', data.institute || data.schoolName || 'N/A');
        setText('edit-display-dob', data.dob || 'Not Provided');
        
        // Populate Editable Fields (Data from Mongo)
        if (majorInput) majorInput.value = data.major || '';
        if (bioTextarea) bioTextarea.value = data.bio || '';
        
        // --- DYNAMIC DEFAULT AVATAR LOGIC (REINFORCED) ---
        // Ensure we always have a valid name-based avatar URL available
        const userNameForAvatar = data.username ? data.username.replace('@', '').trim() : 'User';
        const DEFAULT_AVATAR = `https://ui-avatars.com/api/?name=${encodeURIComponent(userNameForAvatar)}&background=random&size=200&bold=true`;
        
        // The generic man image we want to avoid when deleting
        const GENERIC_PLACEHOLDER = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400';

        if (avatarImg) {
            // If current data has a specific avatar (and it's not null), use it.
            // Otherwise, or if it matches the generic placeholder we want to replace, use the dynamic one.
            if (data.avatarUrl && data.avatarUrl !== GENERIC_PLACEHOLDER && data.avatarUrl !== "null") {
                avatarImg.src = data.avatarUrl;
                console.log("[EditProfile] Initial Avatar Loaded from DB:", data.avatarUrl);
            } else {
                avatarImg.src = DEFAULT_AVATAR;
                console.log("[EditProfile] Initial Avatar defaulted to Name Pix:", DEFAULT_AVATAR);
            }
        }
        
        // Store this specifically for the delete button to use
        avatarImg.dataset.defaultUrl = DEFAULT_AVATAR;

        // 4. Listener Callbacks
        const goBackToProfile = (e) => {
            if (e) e.preventDefault();
            // Go back to the main profile view
            if (App.renderProfile) {
                App.renderProfile(panel);
            }
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
                    avatarImg.dataset.newSrc = src; 
                    console.log("[EditProfile] New file selected. Preview updated.");
                };
                reader.readAsDataURL(file);
            });
        }

        // --- FIX: Handle Delete Photo Button Logic Correctly ---
        panel.querySelector('#edit-delete-photo-btn')?.addEventListener('click', (e) => {
            e.preventDefault(); 
            
            console.log("[EditProfile] Delete Photo Clicked.");
            
            // 1. Force the image source to the dynamic initials (name pix)
            // Use the variable calculated above to be 100% sure
            const namePixUrl = DEFAULT_AVATAR;
            
            console.log("[EditProfile] Setting image source to Name Pix:", namePixUrl);
            
            avatarImg.src = namePixUrl;
            
            // 2. Mark this as the "new" source for the save handler
            avatarImg.dataset.newSrc = namePixUrl;
            
            // 3. Clear file input
            if(fileInput) fileInput.value = '';
            
            console.log("[EditProfile] UI updated successfully. Ready to save.");
        });

        // 7. Save Handler
        const form = panel.querySelector('#edit-profile-form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = panel.querySelector('#edit-save-btn');
                const originalText = btn.textContent;
                btn.disabled = true;
                btn.textContent = 'Saving...';

                const majorUpdate = majorInput ? majorInput.value.trim() : (data.major || '');
                const bioUpdate = bioTextarea ? bioTextarea.value.trim() : (data.bio || '');
                
                const updates = { 
                    major: majorUpdate, 
                    bio: bioUpdate 
                };

                try {
                    // A) Handle Image Upload if a new FILE was selected
                    if (fileInput.files && fileInput.files[0]) {
                        console.log("[EditProfile] Saving: File upload detected.");
                        const formData = new FormData();
                        formData.append('file', fileInput.files[0]);
                        
                        await App.fetchData('/api/my-profile/upload-photo', { 
                            method: 'POST', 
                            body: formData
                        });

                    } 
                    // B) Handle "Delete" scenario (Reset to dynamic default URL)
                    // We check if the newSrc matches the default URL we set in the delete handler
                    else if (avatarImg.dataset.newSrc === DEFAULT_AVATAR) {
                        console.log("[EditProfile] Saving: Avatar reset to Name Pix.");
                        updates.avatarUrl = DEFAULT_AVATAR;
                    }
                    
                    // C) Send Text Updates
                    console.log("[EditProfile] Sending text/reset updates:", updates);
                    await App.fetchData('/api/my-profile/update', {
                       method: 'POST',
                       headers: {'Content-Type': 'application/json'},
                       body: JSON.stringify(updates)
                    });

                    btn.textContent = 'Saved!';
                    setTimeout(() => goBackToProfile(), 500);

                } catch (err) {
                    console.error("[EditProfile] Save failed:", err);
                    btn.textContent = originalText;
                    btn.disabled = false;
                    alert("Save Failed: " + err.message); 
                }
            });
        }
    };

})(window.App = window.App || {});