// EditProfile.js // Create a global object to hold our view renderers window.App = window.App || {};
(function (App) {

// Helper: Fetch HTML (Shared logic could be moved to a utils file, but duplicating for safety here)
async function loadHtml(url) {
    try {
        console.log(`[EditProfile] Fetching ${url}...`);
        const response = await fetch(url + '?v=' + new Date().getTime());
        if (!response.ok) throw new Error(`Failed to load ${url}`);
        return await response.text();
    } catch (err) {
        console.error("[EditProfile] HTML Load Error:", err);
        return null;
    }
}

// --- OPEN EDIT PROFILE MODAL ---
App.openEditProfileModal = async (currentData, onSaveCallback) => {
    console.log("Opening Edit Profile Modal...");

    // Update the main header when modal opens (use App.setPageHeader if available)
    try {
        if (App.setPageHeader && typeof App.setPageHeader === 'function') {
            App.setPageHeader('Edit Profile', 'Update your account details');
        } else {
            // fallback - try direct DOM update if helper not available
            const t = document.getElementById('content-title');
            const s = document.getElementById('content-subtitle');
            if (t) t.textContent = 'Edit Profile';
            if (s) s.textContent = 'Update your account details';
        }
    } catch (e) {
        console.warn('Could not update header dynamically:', e);
    }

    const modalContainer = document.getElementById('reusable-modal');
    const modalContent = document.getElementById('reusable-modal-content');
    const closeBtn = modalContainer ? modalContainer.querySelector('.js-close-modal') : null;

    if (!modalContainer || !modalContent) return;

    const html = await loadHtml('edit_profile.html');
    if (!html) return;

    modalContent.innerHTML = html;

    // Show Modal
    modalContainer.style.display = 'flex';
    setTimeout(() => modalContainer.classList.add('show'), 10);
    modalContainer.classList.add('modal-large');

    // --- Populate Data ---
    const data = currentData || {};

    // Avatar
    const avatarPreview = modalContent.querySelector('#edit-avatar-preview') || modalContent.querySelector('#edit-avatar-img');
    if (avatarPreview) avatarPreview.src = data.avatarUrl || avatarPreview.src || '';

    // Read-Only Fields
    const setText = (id, val) => {
        const el = modalContent.querySelector(`#${id}`);
        if (el) el.textContent = val || '...';
    };

    setText('edit-username-display', `@${data.username || ''}`);
    setText('edit-email-display', data.email || '');
    setText('edit-institute-display', data.institute || data.schoolName || '');
    setText('edit-dob-display', data.dob || '');

    // Editable Fields
    const majorInput = modalContent.querySelector('#edit-major-input');
    const bioInput = modalContent.querySelector('#edit-bio-textarea');

    if (majorInput) majorInput.value = data.major || '';
    if (bioInput) {
        bioInput.value = data.bio || data.description || '';
        // Make bio scrollable (prevent resizing)
        bioInput.style.resize = 'none';
        bioInput.style.overflowY = 'auto';
    }

    // --- Modal Logic ---
    const closeModal = () => {
        // Restore original header before closing
        try {
            if (App.setPageHeader && typeof App.setPageHeader === 'function') {
                App.setPageHeader('Profile', 'Manage your account and profile');
            } else {
                const t = document.getElementById('content-title');
                const s = document.getElementById('content-subtitle');
                if (t) t.textContent = 'Profile';
                if (s) s.textContent = 'Manage your account and profile';
            }
        } catch (e) {
            console.warn('Could not restore header:', e);
        }

        modalContainer.classList.remove('show');
        setTimeout(() => {
            modalContainer.style.display = 'none';
            modalContent.innerHTML = '';
        }, 300);
    };

    // Close Handlers
    if (closeBtn) {
        // replace to avoid duplicate listeners
        const newCloseBtn = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
        newCloseBtn.addEventListener('click', closeModal);
    }

    modalContent.querySelector('#edit-close-btn')?.addEventListener('click', closeModal);
    modalContent.querySelector('#edit-cancel-btn')?.addEventListener('click', closeModal);

    // File Upload Handler
    const fileInput = modalContent.querySelector('#edit-avatar-file-input');
    if (fileInput && avatarPreview) {
        fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    avatarPreview.src = ev.target.result;
                };
                reader.readAsDataURL(e.target.files[0]);
            }
        });
    }

    // Delete Photo Handler
    const deleteBtn = modalContent.querySelector('#edit-delete-photo-btn');
    if (deleteBtn && avatarPreview) {
        deleteBtn.addEventListener('click', () => {
            const defaultAvatar = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400';
            avatarPreview.src = defaultAvatar;
        });
    }

    // Save Handler
    const form = modalContent.querySelector('#edit-profile-form');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();

            const updatedData = {
                major: majorInput ? majorInput.value : (data.major || ''),
                description: bioInput ? bioInput.value : (data.description || ''),
                avatarUrl: avatarPreview ? avatarPreview.src : (data.avatarUrl || '')
            };

            // call provided callback so parent view can update
            if (onSaveCallback && typeof onSaveCallback === 'function') {
                onSaveCallback(updatedData);
            } else {
                // fallback: simple UX feedback & close
                alert('Profile updated (demo)');
            }

            // restore header and close modal
            closeModal();
        });
    }
};
})(window.App);
