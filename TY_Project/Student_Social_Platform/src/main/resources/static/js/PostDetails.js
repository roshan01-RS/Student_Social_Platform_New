// PostDetails.js - Robust Threaded Comments (No Polling)
(function(App) {

    const API_BASE = '';
    let currentUserProfile = null;
    
    // Global state to track expanded threads
    const expandedThreads = new Set();

    // --- Template Helper ---
    async function getDetailsTemplate() {
        try {
            const response = await fetch('post_details.html?v=' + Date.now());
            if (!response.ok) throw new Error('post_details.html not found');
            const html = await response.text();
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;
            return tempDiv.firstElementChild; 
        } catch (err) {
            console.error(err);
            return null;
        }
    }

    // --- Helper: Fetch Current User Profile ---
    async function fetchCurrentUserProfile() {
        if (currentUserProfile) return currentUserProfile;
        try {
            const profile = await App.fetchData('/api/my-profile');
            if (profile) {
                currentUserProfile = profile;
                return profile;
            }
        } catch (e) { console.error("Failed to fetch profile", e); }
        return null;
    }

    // --- Time Formatter ---
    function formatTime(isoString) {
        if(!isoString) return 'Just now';
        const date = new Date(isoString);
        const now = new Date();
        const diff = (now - date) / 1000;
        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff/60)}m`;
        if (diff < 86400) return `${Math.floor(diff/3600)}h`;
        return date.toLocaleDateString();
    }

    // --- HTML Generators ---
    function buildCommentHTML(comment, isReply = false) {
        const authorName = comment.author ? comment.author.username : 'Unknown';
        const authorAvatar = comment.author ? comment.author.avatarUrl : 'https://api.dicebear.com/7.x/avataaars/svg?seed=Unknown';
        
        // Check if this thread was previously expanded
        const repliesContainerId = `replies-${comment.id}`;
        const isExpanded = expandedThreads.has(repliesContainerId);
        
        const displayStyle = isExpanded ? 'block' : 'none';
        const iconTransform = isExpanded ? 'rotate(180deg)' : 'rotate(0deg)';
        const btnText = isExpanded ? 'Hide replies' : 'View replies';

        return `
        <div class="comment-wrapper" data-id="${comment.id}">
            <div class="comment-item ${isReply ? 'is-reply' : ''}">
                <img src="${authorAvatar}" alt="${authorName}" class="comment-avatar">
                <div class="comment-body">
                    <div class="comment-header-row">
                        <span class="comment-author">${authorName}</span>
                        <span class="comment-time">${formatTime(comment.timestamp)}</span>
                    </div>
                    <p class="comment-text">${comment.content}</p>
                    <div class="comment-actions">
                        <button class="c-action-btn reply-btn" data-id="${comment.id}" data-author="${authorName}">Reply</button>
                    </div>
                </div>
            </div>
            
            <!-- Threaded Replies Section -->
            <div class="thread-section">
                <!-- Drop Down Button -->
                <button class="view-replies-btn js-toggle-replies" id="btn-${repliesContainerId}" data-target="${repliesContainerId}" style="display: none;">
                    <span class="btn-text">${btnText}</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="transition: transform 0.2s; transform: ${iconTransform};"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </button>
                
                <!-- Container for threaded replies (FIX: class name must match CSS) -->
                <div class="replies-list" id="${repliesContainerId}" style="display: ${displayStyle};">
                    <!-- Replies injected here -->
                </div>
            </div>
        </div>
        `;
    }

    // --- Main Logic ---
    App.openPostDetails = async (panel, postData) => {
        const template = await getDetailsTemplate();
        if (!template) {
            panel.innerHTML = '<div style="padding:20px; color:red;">Failed to load template.</div>';
            return;
        }

        panel.innerHTML = '';
        panel.appendChild(template);

        const backBtn = panel.querySelector('#pd-back-btn');
        backBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (window.handleNavigation) window.handleNavigation('home');
        });

        // Render Original Post
        const originalPostContainer = panel.querySelector('#pd-original-post');
        originalPostContainer.innerHTML = `
            <div class="pd-original-header">
                <img src="${postData.author.avatar}" class="pd-original-avatar">
                <div>
                    <h3 class="pd-original-name">${postData.author.name}</h3>
                    <p class="pd-original-major">${postData.author.major} · ${postData.timestamp}</p>
                </div>
            </div>
            <p class="pd-original-text">${postData.content}</p>
            ${postData.image ? `<div style="margin-top:10px; border-radius:8px; overflow:hidden;"><img src="${postData.image}" class="pd-original-image" style="width:100%; display:block;"></div>` : ''}
            <div class="pd-original-stats">
                <span>${postData.likes} Likes</span>
                <span>${postData.comments} Comments</span>
            </div>
        `;

        // Update Sender Avatar in Footer
        const footerAvatar = panel.querySelector('.pd-input-wrapper .user-avatar-xs');
        const userProfile = await fetchCurrentUserProfile();
        if (userProfile && footerAvatar) {
            footerAvatar.src = userProfile.avatarUrl || 'https://api.dicebear.com/7.x/avataaars/svg?seed=User';
        }

        // Recursive Reply Loader
        const loadRepliesRecursive = async (commentId) => {
            try {
                const replies = await App.fetchData(`/api/comments/${commentId}/replies`);
                if (replies && replies.length > 0) {
                    const containerId = `replies-${commentId}`;
                    const container = document.getElementById(containerId);
                    const toggleBtn = document.getElementById(`btn-${containerId}`);
                    
                    if (container && toggleBtn) {
                        const newHtml = replies.map(r => buildCommentHTML(r, true)).join('');
                        if (container.innerHTML !== newHtml) {
                            container.innerHTML = newHtml;
                            toggleBtn.style.display = 'flex';
                            
                            const isExpanded = expandedThreads.has(containerId);
                            toggleBtn.querySelector('.btn-text').textContent = isExpanded 
                                ? 'Hide replies' 
                                : `View ${replies.length} replies`;
                            
                            replies.forEach(r => loadRepliesRecursive(r.id));
                        }
                    }
                }
            } catch (e) { }
        };

        const commentsList = panel.querySelector('#pd-comments-list');
        
        const loadComments = async () => {
            try {
                const comments = await App.fetchData(`/api/comments/post/${postData.id}`);
                
                if (!comments || comments.length === 0) {
                    if (commentsList.innerHTML.includes('Loading')) {
                        commentsList.innerHTML = '<p style="text-align:center; color:#9ca3af; padding:2rem;">No comments yet.</p>';
                    }
                    return;
                }

                commentsList.innerHTML = comments.map(c => buildCommentHTML(c)).join('');
                comments.forEach(c => loadRepliesRecursive(c.id));

            } catch (err) { console.error("Poll failed", err); }
        };
        
        commentsList.innerHTML = '<div style="padding:20px; text-align:center; color:#888;">Loading comments...</div>';
        await loadComments();

        // Input Logic
        const input = panel.querySelector('#pd-reply-input');
        const replyBtn = panel.querySelector('#pd-reply-btn');
        let replyToId = null; 

        commentsList.addEventListener('click', (e) => {
            const btnReply = e.target.closest('.reply-btn');
            if (btnReply) {
                const author = btnReply.dataset.author;
                replyToId = btnReply.dataset.id;
                // Update placeholder, not value
                input.placeholder = `Replying to ${author}...`;
                input.focus(); 
                return;
            }

            const btnToggle = e.target.closest('.js-toggle-replies');
            if (btnToggle) {
                const targetId = btnToggle.dataset.target;
                const container = document.getElementById(targetId);
                const icon = btnToggle.querySelector('svg');
                const textSpan = btnToggle.querySelector('.btn-text');
                
                if (container) {
                    const isHidden = container.style.display === 'none';
                    if (isHidden) {
                        container.style.display = 'block';
                        expandedThreads.add(targetId);
                        icon.style.transform = 'rotate(180deg)';
                        textSpan.textContent = 'Hide replies';
                    } else {
                        container.style.display = 'none';
                        expandedThreads.delete(targetId);
                        icon.style.transform = 'rotate(0deg)';
                        textSpan.textContent = 'View replies';
                    }
                }
            }
        });

        input.addEventListener('input', () => {
            if(input.value.trim().length > 0) replyBtn.removeAttribute('disabled');
            else replyBtn.setAttribute('disabled', 'true');
        });

        replyBtn.addEventListener('click', async () => {
            const text = input.value;
            if(!text.trim()) return;

            replyBtn.textContent = '...';
            replyBtn.disabled = true;

            try {
                const payload = {
                    postId: postData.id,
                    content: text,
                    parentCommentId: replyToId
                };

                const res = await fetch(`${API_BASE}/api/comments/add`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'credentials': 'include' },
                    body: JSON.stringify(payload)
                });

                if (res.ok) {
                    input.value = '';
                    input.placeholder = "Post your reply..."; 
                    replyToId = null;
                    replyBtn.textContent = 'Reply';
                    await loadComments();
                } else {
                    alert("Failed to post comment");
                    replyBtn.textContent = 'Reply';
                    replyBtn.disabled = false;
                }
            } catch (e) {
                console.error(e);
                replyBtn.textContent = 'Reply';
                replyBtn.disabled = false;
            }
        });
    };

})(window.App = window.App || {});