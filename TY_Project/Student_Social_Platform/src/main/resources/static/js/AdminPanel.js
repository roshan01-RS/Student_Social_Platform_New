// AdminPanel.js
const API_BASE = '';
let stompClient = null;
let wsConnected = false;

// --- Helper: Robust Notification ---
const showNotification = (message, type = 'success') => {
    if (window.showGlobalNotification) {
        window.showGlobalNotification(message, type);
    } else {
        console.warn(`[${type.toUpperCase()}] ${message}`);
    }
};

// --- WebSocket Connection (Auto-Update Feature) ---
function connectWebSocket() {
    if (wsConnected) return;
    
    // Check if SockJS and Stomp are available
    if (typeof SockJS === 'undefined' || typeof Stomp === 'undefined') {
        console.error("[AdminPanel] SockJS/Stomp libraries missing. Cannot connect WebSocket.");
        return;
    }
    
    const socket = new SockJS('/ws');
    stompClient = Stomp.over(socket);
    stompClient.debug = () => {}; // Cleaner logs

    stompClient.connect({}, function(frame) {
        wsConnected = true;
        console.log('[AdminPanel] ✅ WebSocket Connected.');
        
        // Subscribe to public admin verification topic for auto-updates
        stompClient.subscribe(`/topic/admin/verifications/update`, function(messageOutput) {
            console.log("[AdminPanel] 🔁 Verification Status Update Received.");
            loadDashboard(); // Auto-refresh the list
            showNotification("Verification list updated", "info");
        });

    }, function(error) {
        console.error('[AdminPanel] ❌ WebSocket Connection Error:', error);
        wsConnected = false;
    });
}


document.addEventListener('DOMContentLoaded', () => {
    console.log("[AdminPanel] Initializing...");
    
    connectWebSocket(); 

    loadDashboard();
    setupTabs();
    setupLogout();
    if(window.lucide) window.lucide.createIcons();
});

function setupLogout() {
    document.getElementById('btn-admin-logout').addEventListener('click', async () => {
        try {
            await fetch(`${API_BASE}/api/admin/logout`, { method: 'POST' });
            window.location.href = 'admin_login.html';
        } catch (e) {
            window.location.href = 'admin_login.html';
        }
    });
}

function setupTabs() {
    const tabVerif = document.getElementById('tab-verifications');
    const tabUsers = document.getElementById('tab-users');
    const viewVerif = document.getElementById('view-verifications');
    const viewUsers = document.getElementById('view-users');

    tabVerif.addEventListener('click', () => {
        viewVerif.style.display = 'block';
        viewUsers.style.display = 'none';
        tabVerif.classList.add('active');
        tabUsers.classList.remove('active');
        loadDashboard(); 
    });

    tabUsers.addEventListener('click', () => {
        viewVerif.style.display = 'none';
        viewUsers.style.display = 'block';
        tabUsers.classList.add('active');
        tabVerif.classList.remove('active');
        loadAllUsers(); 
    });
}

// Global state for stats to allow local updates
let currentStats = {
    pending: 0,
    verified: 0,
    rejected: 0
};

// --- VERIFICATION DASHBOARD ---
async function loadDashboard() {
    // Only show loading if empty to prevent flickering on auto-update
    const container = document.getElementById('student-list-container');
    if(container && container.children.length === 0) {
         const statsContainer = document.getElementById('stats-container');
         if(statsContainer) statsContainer.innerHTML = `<div class="stat-card stat-pending" style="flex:1;"><div class="stat-icon"><div class="spinner"></div></div><div class="stat-body">Loading Stats...</div></div>`;
    }

    try {
        const pendingRes = await fetch(`${API_BASE}/api/admin/pending-verifications`);
        if (!pendingRes.ok) throw new Error('Failed to load pending list. API issue.');
        const students = await pendingRes.json();
        
        // Update stats based on real data
        currentStats.pending = students.length;
        // Note: Without an API for total verified/rejected, we keep these as accumulated values or 0
        // If your API supports it, fetch real totals here. For now, we initialize them.
        if (currentStats.verified === 0 && currentStats.rejected === 0) {
             // Optional: Fetch these from a stats endpoint if available
        }

        renderStats(currentStats);
        renderStudentList(students);
        if(window.lucide) window.lucide.createIcons();
    } catch (err) {
        console.error("[AdminPanel] ❌ Dashboard Load Error:", err);
        document.getElementById('student-list-container').innerHTML = 
            `<div class="p-6 text-center text-red-600 font-medium">Error loading dashboard data: ${err.message}</div>`;
    }
}

function renderStats(stats) {
    const statsContainer = document.getElementById('stats-container');
    if (!statsContainer) return;

    statsContainer.innerHTML = `
        <div class="stat-card stat-pending">
            <div class="stat-icon"><i data-lucide="clock"></i></div>
            <div class="stat-body">
                <div class="stat-title">Pending</div>
                <div class="stat-row">
                    <div class="stat-value">${stats.pending}</div>
                    <div class="stat-desc">Awaiting review</div>
                </div>
            </div>
        </div>

        <div class="stat-card stat-verified">
            <div class="stat-icon"><i data-lucide="check-circle"></i></div>
            <div class="stat-body">
                <div class="stat-title">Verified</div>
                <div class="stat-row">
                    <div class="stat-value">${stats.verified}</div>
                    <div class="stat-desc">Successfully verified</div>
                </div>
            </div>
        </div>

        <div class="stat-card stat-rejected">
            <div class="stat-icon"><i data-lucide="x-circle"></i></div>
            <div class="stat-body">
                <div class="stat-title">Rejected</div>
                <div class="stat-row">
                    <div class="stat-value">${stats.rejected}</div>
                    <div class="stat-desc">Failed verification</div>
                </div>
            </div>
        </div>
    `;
    if(window.lucide) window.lucide.createIcons();
}

function renderStudentList(students) {
    const container = document.getElementById('student-list-container');
    if (students.length === 0) {
        container.innerHTML = `<div style="padding: 3rem; text-align: center; color: var(--text-secondary);">No pending verifications found.</div>`;
        return;
    }
    
    window.currentPendingStudents = students;

    container.innerHTML = students.map(student => `
        <div class="verification-item" onclick="openVerificationModal('${student.id}')">
            <div class="user-info">
                <div class="user-avatar-placeholder">
                    ${student.name.charAt(0).toUpperCase()}
                </div>
                <div class="user-details">
                    <h4>${student.name}</h4>
                    <p>${student.course || 'N/A'} • ID: ${student.studentId || 'N/A'}</p>
                </div>
            </div>
            <div class="meta-info">
                <div class="status-badge pending">Pending</div>
                <div class="submitted-date">Submitted: ${new Date(student.submittedDate).toLocaleDateString()}</div>
            </div>
        </div>
    `).join('');
    
    if(window.lucide) window.lucide.createIcons();
}

// --- USER LIST LOGIC ---
async function loadAllUsers() {
    const container = document.getElementById('all-users-container');
    container.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-gray-500">Loading users...</td></tr>';

    try {
        const res = await fetch(`${API_BASE}/api/admin/users`);
        if (!res.ok) throw new Error('Failed to load users');
        const users = await res.json();
        window.allUsersData = users; 
        renderUsersTable(users);
        
        // Setup Search
        const searchInput = document.getElementById('user-search');
        // Ensure new listener on search input
        const newSearch = searchInput.cloneNode(true);
        searchInput.parentNode.replaceChild(newSearch, searchInput);
        
        newSearch.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = window.allUsersData.filter(u => 
                (u.username && u.username.toLowerCase().includes(term)) || 
                (u.email && u.email.toLowerCase().includes(term))
            );
            renderUsersTable(filtered);
        });
        
        if(window.lucide) window.lucide.createIcons();

    } catch (err) {
        console.error("[AdminPanel] ❌ Users Load Error:", err);
        container.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-red-500">Error loading users</td></tr>`;
    }
}

function renderUsersTable(users) {
    const container = document.getElementById('all-users-container');
    if (users.length === 0) {
        container.innerHTML = '<tr><td colspan="5" class="p-4 text-center">No users found.</td></tr>';
        return;
    }

    container.innerHTML = users.map(user => {
        let statusClass = 'status-badge'; 
        let statusText = user.verificationStatus || 'NONE';
        
        if (statusText === 'VERIFIED') statusClass += ' verified';
        else if (statusText === 'PENDING') statusClass += ' pending';
        else if (statusText === 'REJECTED') statusClass += ' rejected';
        else statusClass += ' status-none'; 
        
        const avatarUrl = user.avatarUrl && user.avatarUrl.startsWith('http') ? user.avatarUrl : (user.avatarUrl ? `${API_BASE}/${user.avatarUrl}` : `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`);
        
        return `
        <tr class="hover:bg-gray-50 border-b border-gray-100 transition-colors">
            <td class="p-4">
                <div class="user-info">
                    <img src="${avatarUrl}" class="user-avatar-img" onerror="this.src='https://via.placeholder.com/40'">
                    <div>
                        <div class="font-medium text-gray-900">${user.username ? user.username.replace('@','') : 'Unknown'}</div>
                        <div class="text-xs text-gray-500">ID: ${user.userId || '-'}</div>
                    </div>
                </div>
            </td>
            <td class="p-4" style="color:#6b7280; font-size: 0.9rem;">${user.email || '-'}</td>
            <td class="p-4">
                <span class="${statusClass}">${statusText}</span>
            </td>
            <td class="p-4" style="color:#6b7280; font-size: 0.9rem;">${user.joinedAt ? new Date(user.joinedAt).toLocaleDateString() : '-'}</td>
            <td class="p-4">
                <button onclick="openUserDetails('${user.id}')" class="view-details-btn">View</button>
            </td>
        </tr>`;
    }).join('');
    if(window.lucide) window.lucide.createIcons();
}

// --- MODALS ---

window.openVerificationModal = (studentId) => {
    const student = window.currentPendingStudents.find(s => s.id === studentId);
    if (!student) return;

    const modalBackdrop = document.getElementById('admin-modal-backdrop');
    const modalContent = document.getElementById('admin-modal-content');
    
    const resolveImg = (path) => {
        if (!path) return 'https://placehold.co/400x600?text=No+Image'; 
        if (path.startsWith('http')) return path;
        return `${API_BASE}/${path}`.replace(/([^:]\/)\/+/g, "$1");
    };

    const idCardSrc = resolveImg(student.documents.idCard);
    const receiptSrc = resolveImg(student.documents.feesReceipt);

    modalContent.innerHTML = `
        <div class="modal-header">
            <div class="modal-title"><h2>Review Documents</h2></div>
            <button class="modal-close" onclick="closeAdminModal('admin-modal-backdrop')"><i data-lucide="x"></i></button>
        </div>
        <div class="modal-body">
            <div style="background: #f5f3ff; border: 1px solid #ddd6fe; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; display: flex; gap: 0.75rem; align-items: start;">
                <i data-lucide="alert-circle" style="color: #7c3aed; flex-shrink: 0; margin-top:2px;"></i>
                <div>
                    <strong style="color: #5b21b6; font-size: 0.9rem;">Verification Guidelines</strong>
                    <p style="color: #6d28d9; font-size: 0.85rem; margin-top: 0.25rem;">Verify authenticity. Check names and dates.</p>
                </div>
            </div>

            <div class="info-grid">
                <div class="info-item"><label>Name</label><span>${student.name}</span></div>
                <div class="info-item"><label>Roll Number</label><span>${student.rollNumber || 'N/A'}</span></div>
                <div class="info-item"><label>Course</label><span>${student.course || 'N/A'}</span></div>
                <div class="info-item"><label>Student ID</label><span>${student.studentId}</span></div>
            </div>

            <div class="doc-grid">
                <!-- 🔥 FIXED IMAGE SIZING: Added object-fit:contain and fixed height -->
                <div class="doc-card">
                    <div class="doc-card-header">
                        <i data-lucide="credit-card" style="width:16px;"></i> Student ID Card
                    </div>
                    <div class="doc-image-wrapper" style="height: 250px; background: #f3f4f6; display: flex; align-items: center; justify-content: center; overflow: hidden; border-radius: 6px;">
                        <a href="${idCardSrc}" target="_blank" style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">
                            <img src="${idCardSrc}" class="doc-image" alt="ID Card" style="max-width: 100%; max-height: 100%; object-fit: contain;">
                        </a>
                    </div>
                </div>
                <div class="doc-card">
                    <div class="doc-card-header">
                        <i data-lucide="file-text" style="width:16px;"></i> Fees Receipt
                    </div>
                    <div class="doc-image-wrapper" style="height: 250px; background: #f3f4f6; display: flex; align-items: center; justify-content: center; overflow: hidden; border-radius: 6px;">
                        <a href="${receiptSrc}" target="_blank" style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">
                            <img src="${receiptSrc}" class="doc-image" alt="Fees Receipt" style="max-width: 100%; max-height: 100%; object-fit: contain;">
                        </a>
                    </div>
                </div>
            </div>
        </div>

        <div class="modal-footer">
            <button onclick="submitDecision('${student.id}', 'REJECTED')" class="btn-modal btn-reject">
                <i data-lucide="x-circle" style="width:18px;"></i> Reject Documents
            </button>
            <button onclick="submitDecision('${student.id}', 'VERIFIED')" class="btn-modal btn-verify">
                <i data-lucide="check-circle" style="width:18px;"></i> Verify Documents
            </button>
        </div>
    `;

    modalBackdrop.style.display = 'flex';
    if(window.lucide) window.lucide.createIcons();
};

window.openUserDetails = async (userId) => {
    const modalBackdrop = document.getElementById('user-details-modal');
    const modalContent = document.getElementById('user-details-content');
    
    try {
        console.log(`[AdminPanel] Fetching details for user ID: ${userId}`);
        const res = await fetch(`${API_BASE}/api/admin/users/${userId}`);
        if (!res.ok) throw new Error('User not found');
        const user = await res.json();
        
        const avatarUrl = user.avatarUrl && user.avatarUrl.startsWith('http') ? user.avatarUrl : (user.avatarUrl ? `${API_BASE}/${user.avatarUrl}` : 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + user.username);

        modalContent.innerHTML = `
            <div class="modal-header" style="background:white; border-bottom:1px solid #e5e7eb; color:#111827;">
                <h2 style="font-size:1.25rem; font-weight:700;">User Profile</h2>
                <button onclick="closeAdminModal('user-details-modal')" style="background:none; border:none; color:#6b7280; font-size:1.5rem; cursor:pointer;">&times;</button>
            </div>
            <div class="modal-body">
                <div style="text-align:center; margin-bottom:1.5rem;">
                    <img src="${avatarUrl}" style="width:6rem; height:6rem; border-radius:50%; object-fit:cover; border:3px solid #e5e7eb; margin-bottom:0.5rem;">
                    <h3 style="font-size:1.5rem; margin:0;">${user.username ? user.username.replace('@','') : 'Unknown'}</h3>
                    <p style="color:#6b7280; margin:0;">${user.email}</p>
                    <span class="status-badge ${user.verificationStatus === 'VERIFIED' ? 'verified' : (user.verificationStatus === 'PENDING' ? 'pending' : 'status-none')}" style="margin-top:0.5rem;">
                        ${user.verificationStatus || 'Unverified'}
                    </span>
                </div>

                <div class="info-grid">
                    <div class="info-item"><label>School</label><span>${user.schoolName || '-'}</span></div>
                    <div class="info-item"><label>Major</label><span>${user.major || '-'}</span></div>
                    <div class="info-item"><label>Joined</label><span>${user.joinedAt ? new Date(user.joinedAt).toLocaleDateString() : '-'}</span></div>
                    <div class="info-item"><label>Valid Till</label><span>${user.accountExpireDate ? new Date(user.accountExpireDate).toLocaleDateString() : '-'}</span></div>
                </div>

                <div style="margin-top:1.5rem;">
                    <label style="font-size:0.75rem; font-weight:700; color:#6b7280; display:block; margin-bottom:0.5rem; text-transform:uppercase;">Bio</label>
                    <p style="font-size:0.95rem; color:#374151; background:#f9fafb; padding:0.75rem; border-radius:8px; border:1px solid #e5e7eb; margin-top:0.25rem; line-height: 1.6;">
                        ${user.bio || 'No bio.'}</p>
                </div>
            </div>
            <div class="modal-footer" style="background:white; justify-content:space-between;">
                <button onclick="deleteUser('${user.id}')" class="btn-modal btn-delete">
                    <i data-lucide="trash-2" style="width:18px;"></i> Delete User
                </button>
                <button onclick="closeAdminModal('user-details-modal')" class="btn-modal" style="background:#f3f4f6; color:#374151;">Close</button>
            </div>
        `;
        modalBackdrop.style.display = 'flex';
        if(window.lucide) window.lucide.createIcons();

    } catch (e) {
        console.error("[AdminPanel] ❌ Fetch User Details Error:", e);
        showNotification("Failed to fetch user details. " + e.message, "error");
    }
};

window.closeAdminModal = (id = null) => {
    if (id) {
        document.getElementById(id).style.display = 'none';
    } else {
        document.querySelectorAll('.modal-backdrop').forEach(m => m.style.display = 'none');
    }
};

window.submitDecision = async (id, status) => {
    const btn = event.target.closest('button');
    const oldHtml = btn.innerHTML;
    btn.disabled = true;
    btn.textContent = 'Processing...';

    try {
        const res = await fetch(`${API_BASE}/api/admin/verify`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ userId: id, status: status })
        });
        
        if (res.ok) {
            closeAdminModal('admin-modal-backdrop');
            
            // 🔥 REAL-TIME LOCAL UPDATE: Remove student from list immediately
            if (window.currentPendingStudents) {
                // Remove the student
                window.currentPendingStudents = window.currentPendingStudents.filter(s => s.id !== id);
                
                // Update stats locally
                currentStats.pending = window.currentPendingStudents.length;
                if (status === 'VERIFIED') currentStats.verified++;
                if (status === 'REJECTED') currentStats.rejected++;

                // Re-render UI immediately
                renderStats(currentStats);
                renderStudentList(window.currentPendingStudents);
            } else {
                // Fallback if local state is missing
                loadDashboard(); 
            }
            
            showNotification(`Verification set to ${status}.`, 'success');
        } else {
            const err = await res.json();
            showNotification(`Error: ${err.message || "Failed to update status."}`, "error");
            btn.disabled = false;
            btn.innerHTML = oldHtml;
        }
    } catch (e) {
        showNotification("Network error. Could not connect to API.", "error");
        btn.disabled = false;
        btn.innerHTML = oldHtml;
    }
};

window.deleteUser = async (mongoId) => {
    if(!confirm("Are you sure you want to permanently delete this user? This cannot be undone.")) return;
    
    try {
        const res = await fetch(`${API_BASE}/api/admin/users/${mongoId}`, {
            method: 'DELETE'
        });
        
        if (res.ok) {
            showNotification("User deleted successfully.", "success");
            closeAdminModal('user-details-modal');
            loadAllUsers(); // Refresh list
        } else {
            const err = await res.json();
            showNotification(`Failed to delete user: ${err.message}`, "error");
        }
    } catch (e) {
        showNotification("Network error during deletion.", "error");
    }
};