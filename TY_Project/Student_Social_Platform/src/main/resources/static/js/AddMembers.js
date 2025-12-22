// AddMembers.js - Modal Logic
(function(App) {
    
    // Fetch HTML Helper
    async function loadHtml(url) {
        try {
            const response = await fetch(url + '?v=' + new Date().getTime());
            if (!response.ok) throw new Error(`Failed to load ${url}`);
            return await response.text();
        } catch (err) {
            console.error("HTML Load Error:", err);
            return null;
        }
    }

    App.openAddMembersModal = async (group, onMembersAdded) => {
        const modalHtml = await loadHtml('add_members.html');
        if (!modalHtml) return;

        const modalContainer = document.getElementById('reusable-modal');
        const modalContent = document.getElementById('reusable-modal-content');
        if (!modalContainer || !modalContent) return;

        modalContent.innerHTML = modalHtml;
        modalContainer.style.display = 'flex';
        setTimeout(() => modalContainer.classList.add('show'), 10);
        modalContainer.classList.add('modal-large');

        const closeModal = () => {
            modalContainer.classList.remove('show', 'modal-large');
            setTimeout(() => {
                modalContainer.style.display = 'none';
                modalContent.innerHTML = '';
            }, 300);
        };

        const closeBtn = modalContainer.querySelector('.js-close-modal');
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        modalContainer.addEventListener('click', (e) => {
            if (e.target === modalContainer) closeModal();
        });

        const listContainer = modalContent.querySelector('#friends-selection-list');
        const confirmBtn = modalContent.querySelector('#confirm-add-members');
        const selectedFriends = new Set();

        // Fetch Friends
        try {
            listContainer.innerHTML = '<div style="padding:20px;text-align:center;">Loading friends...</div>';
            const friends = await App.fetchData('/api/friendship/list-friends');
            
            // Filter: Must be ACCEPTED and NOT already in the group
            const currentMemberIds = new Set((group.memberIds || []).map(String));
            const availableFriends = friends.filter(f => 
                f.status === 'ACCEPTED' && !currentMemberIds.has(String(f.userId))
            );

            if (availableFriends.length === 0) {
                listContainer.innerHTML = '<div style="padding:20px;text-align:center;color:#888;">No new friends to add.</div>';
                return;
            }

            listContainer.innerHTML = availableFriends.map(f => {
                return `
                <button class="friend-select-item" data-fid="${f.userId}">
                    <div class="chat-user-avatar-wrapper">
                        <img src="${f.avatarUrl || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + f.username}" class="chat-user-avatar" style="width:3.6rem;height:3.6rem;border-radius:50%;">
                    </div>
                    <div style="flex:1;text-align:left;">
                        <h4 style="font-size:1.2rem;font-weight:600;color:#1f2937;margin:0;">${f.username}</h4>
                        <p style="font-size:1rem;color:#6b7280;margin:0;">${f.major || 'Student'}</p>
                    </div>
                    <div class="check-circle"></div>
                </button>`;
            }).join('');

            // Click Handlers
            listContainer.querySelectorAll('.friend-select-item').forEach(btn => {
                btn.addEventListener('click', () => {
                    const fid = btn.dataset.fid;
                    if (selectedFriends.has(fid)) {
                        selectedFriends.delete(fid);
                        btn.classList.remove('selected');
                        btn.querySelector('.check-circle').textContent = '';
                    } else {
                        selectedFriends.add(fid);
                        btn.classList.add('selected');
                        btn.querySelector('.check-circle').textContent = '✓';
                    }
                    
                    const count = selectedFriends.size;
                    confirmBtn.textContent = count > 0 ? `Add (${count})` : 'Add Members';
                    if (count > 0) confirmBtn.removeAttribute('disabled');
                    else confirmBtn.setAttribute('disabled', 'true');
                });
            });

        } catch (e) {
            console.error(e);
            listContainer.innerHTML = '<div style="color:red;padding:20px;">Failed to load friends.</div>';
        }

        // Confirm Action
        confirmBtn.addEventListener('click', async () => {
            if (selectedFriends.size === 0) return;
            
            confirmBtn.disabled = true;
            confirmBtn.textContent = 'Adding...';

            const memberIds = Array.from(selectedFriends).map(Number);
            try {
                const res = await fetch(`http://localhost:8000/api/groups/${group.id}/members`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'credentials': 'include' },
                    body: JSON.stringify({ memberIds })
                });

                if (res.ok) {
                    if (onMembersAdded) onMembersAdded(memberIds.length);
                    closeModal();
                } else {
                    alert('Failed to add members');
                    confirmBtn.disabled = false;
                }
            } catch (e) {
                console.error(e);
                confirmBtn.disabled = false;
            }
        });
    };

})(window.App = window.App || {});