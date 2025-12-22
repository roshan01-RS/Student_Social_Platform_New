// CommunityPanel.js - Integrated with Backend (Real Data)
(function(App) {

    const API_BASE = 'http://localhost:8000';
    let currentUser = null;
    let imageFileToUpload = null;

    // --- Helper: Fetch HTML & Clean it ---
    async function loadHtml(url) {
        try {
            const fetchUrl = url.startsWith('/') ? url : `/${url}`;
            const response = await fetch(fetchUrl + '?v=' + new Date().getTime());
            if (!response.ok) throw new Error(`Failed to load ${url}`);
            let text = await response.text();
            text = text.replace(/<!-- Code injected by live-server -->[\s\S]*?<\/script>/gi, "");
            return text;
        } catch (err) {
            console.error("[CommunityPanel] HTML Load Error:", err);
            return null;
        }
    }

    // --- Helper: Notification ---
    function showNotification(msg, type = 'success') {
        if (window.showGlobalNotification) window.showGlobalNotification(msg, type);
        else console.log(`[${type.toUpperCase()}] ${msg}`);
    }

    // --- Helper: Format Time ---
    function formatTime(isoString) {
        if (!isoString) return 'Just now';
        const date = new Date(isoString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // --- Helper: Generate Community Avatar (Initials) ---
    function getCommunityAvatar(comm) {
        if (comm.icon && comm.icon.includes('http')) return `<img src="${comm.icon}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
        
        // Fallback to initials
        const name = comm.name || 'Community';
        const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        // Generate a consistent color based on name length
        const colors = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];
        const color = colors[name.length % colors.length];
        
        // Ensure circular shape
        return `<div style="width:100%; height:100%; background-color:${color}; color:white; display:flex; align-items:center; justify-content:center; font-size:1.5rem; font-weight:bold; border-radius:50%; overflow:hidden;">${initials}</div>`;
    }

    // --- Layout HTML (main) ---
    const COMMUNITY_LAYOUT_HTML = `
    <div class="community-layout">
        <div class="community-list-sidebar">
            <div class="community-list-header">
                <div class="community-header-top">
                    <button class="btn-create-community" id="create-community-btn" style="flex: 1; justify-content: center;" title="Create New Community">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        Create
                    </button>
                      <button class="btn-create-community" id="search-community-btn" style="flex: 1; justify-content: center; background: linear-gradient(135deg, #3b82f6, #2563eb);" title="Search & Join Communities">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        Search
                    </button>
                </div>
                <div class="community-search-wrapper">
                    <svg class="community-search-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clip-rule="evenodd" /></svg>
                    <input type="text" id="community-search-input" placeholder="Filter your communities..." class="community-search-input">
                </div>
            </div>
            <div class="community-list-scroll-area" id="community-list-container">
                <div style="padding: 20px; text-align: center; color: #888;">Loading...</div>
            </div>
        </div>
        <div class="community-window" id="community-feed-window">
            <div class="chat-placeholder">
                <div class="logo-icon-placeholder" style="width:6rem;height:6rem;background:#e5e7eb;border-radius:1.5rem;display:flex;align-items:center;justify-content:center;margin:0 auto 1rem;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:3rem;height:3rem"><path d="M18.37 8.18c-1.32-2.3-3.6-3.88-6.37-3.88-4.42 0-8 3.58-8 8s3.58 8 8 8c2.77 0 5.05-1.58 6.37-3.88"/></svg>
                </div>
                <p>Select a community to view</p>
            </div>
        </div>
    </div>
    `;

    // State
    let myCommunities = [];
    let selectedCommunity = null;
    let mainPanelRef = null;

    async function fetchCurrentUser() {
        if(currentUser) return;
        try { currentUser = await App.fetchData('/api/my-profile'); } catch(e){}
    }

    // --- Main Render Function ---
    App.renderCommunity = async (panel) => {
        mainPanelRef = panel;
        await fetchCurrentUser();
        
        panel.innerHTML = COMMUNITY_LAYOUT_HTML;
        
        // Initial Fetch
        await fetchMyCommunities();
        renderCommunityList(panel);
        
        // Listeners
        const searchInput = panel.querySelector('#community-search-input');
        if(searchInput) {
            searchInput.addEventListener('input', (e) => renderCommunityList(panel, e.target.value));
        }
        
        const createBtn = panel.querySelector('#create-community-btn');
        if(createBtn) createBtn.addEventListener('click', openCreateCommunityModal);

        const searchBtn = panel.querySelector('#search-community-btn');
        if(searchBtn) searchBtn.addEventListener('click', openSearchCommunityModal);
    };

    async function fetchMyCommunities() {
        try {
            const res = await App.fetchData('/api/communities/my-communities');
            if (Array.isArray(res)) {
                // Map backend structure to frontend structure
                myCommunities = res.map(c => ({
                    id: c.id,
                    name: c.name,
                    icon: c.icon || '🌐',
                    description: c.description || '',
                    members: c.memberIds ? c.memberIds.length : 0,
                    ownerId: c.ownerId, 
                    joined: true,
                    posts: [] 
                }));
            }
        } catch(e) { console.error("Failed to fetch communities", e); }
    }
    
    function renderCommunityList(panel, filter = '') {
        const listContainer = panel.querySelector('#community-list-container');
        if (!listContainer) return;

        const filtered = myCommunities.filter(c => c.name.toLowerCase().includes(filter.toLowerCase()));

        if (filtered.length === 0) {
            listContainer.innerHTML = '<div style="padding:20px; text-align:center; color:#888;">No communities found</div>';
            return;
        }

        listContainer.innerHTML = filtered.map(comm => {
             const iconHtml = getCommunityAvatar(comm);
             
             return `
            <button class="community-item-button ${selectedCommunity?.id === comm.id ? 'active' : ''}" data-comm-id="${comm.id}">
                <div class="community-item-inner">
                    <div class="community-icon-wrapper" style="overflow:hidden; padding:0; border-radius: 50%;">${iconHtml}</div>
                    <div class="community-item-details">
                        <span class="community-name">${comm.name}</span>
                        <span class="community-meta">${comm.members} members</span>
                    </div>
                </div>
            </button>
        `}).join('');

        listContainer.querySelectorAll('.community-item-button').forEach(btn => {
            btn.addEventListener('click', () => {
                const commId = btn.dataset.commId;
                selectedCommunity = myCommunities.find(c => c.id === commId);
                renderCommunityList(panel, filter); 
                renderCommunityFeed(panel);
            });
        });
    }

    async function renderCommunityFeed(panel) {
        const feedContainer = panel.querySelector('#community-feed-window');
        if (!feedContainer) return;

        if (!selectedCommunity) {
            feedContainer.innerHTML = `
                <div class="chat-placeholder">
                    <div class="logo-icon-placeholder" style="width:6rem;height:6rem;background:#e5e7eb;border-radius:1.5rem;display:flex;align-items:center;justify-content:center;margin:0 auto 1rem;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:3rem;height:3rem"><path d="M18.37 8.18c-1.32-2.3-3.6-3.88-6.37-3.88-4.42 0-8 3.58-8 8s3.58 8 8 8c2.77 0 5.05-1.58 6.37-3.88"/></svg>
                    </div>
                    <p>Select a community to view</p>
                </div>`;
            return;
        }

        const iconHtml = getCommunityAvatar(selectedCommunity);

        // --- Logic: Only joined members see feed content ---
        if (!selectedCommunity.joined) {
             feedContainer.innerHTML = `
                <div class="community-header">
                    <div class="community-header-info">
                        <div class="community-header-icon" style="overflow:hidden; padding:0; width:5rem; height:5rem; border-radius:50%;">${iconHtml}</div>
                        <div class="community-header-text">
                            <h2>${selectedCommunity.name}</h2>
                            <p>${selectedCommunity.description}</p>
                        </div>
                    </div>
                    <div class="community-header-actions">
                        <button id="rejoin-community-btn" class="btn-primary">Join Community</button>
                    </div>
                </div>
                <div style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#6b7280; gap:10px;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    <p style="font-size:1.1rem;">You must join this community to view posts.</p>
                </div>
             `;
             
             const rejoinBtn = feedContainer.querySelector('#rejoin-community-btn');
             if(rejoinBtn) {
                 rejoinBtn.addEventListener('click', async () => {
                     // Re-join logic
                     try {
                        const res = await fetch(`${API_BASE}/api/communities/${selectedCommunity.id}/join`, { method: 'POST', credentials: 'include' });
                        if(res.ok) {
                            selectedCommunity.joined = true;
                            renderCommunityFeed(panel);
                        }
                     } catch(e) {}
                 });
             }
             return;
        }

        // --- Logic: Only Admin (Owner) can post ---
        const isAdmin = currentUser && String(currentUser.userId) === String(selectedCommunity.ownerId);
        // Define btnClass for "Joined" button
        const btnClass = 'btn-join joined';

        let inputHtml = '';
        if (isAdmin) {
             inputHtml = `
            <div class="community-chat-box">
                <div id="comm-preview-container" class="image-preview-container" style="display:none; padding: 0.8rem 1.5rem 0 1.5rem; margin-bottom: 0.5rem; background: transparent;">
                    <div style="display:flex; align-items:center;">
                        <img id="comm-preview-img" src="" class="preview-img" style="height: 40px; width: auto; margin-right: 10px;">
                        <span id="comm-preview-text" style="color:#9ca3af; font-size:1.2rem;">Image ready.</span>
                        <button id="comm-remove-preview-btn" class="btn-remove-preview" title="Remove" style="margin-left: auto;">✕</button>
                    </div>
                </div>
                <div class="chat-input-wrapper">
                     <button class="btn-icon" id="comm-image-btn" title="Upload Image">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                     </button>

                     <button class="btn-icon" id="comm-emoji-btn" title="Emoji">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
                     </button>
                     
                     <input type="file" id="comm-file-input" style="display: none;" accept="image/*">

                     <div class="chat-input-field-wrapper">
                        <input type="text" id="comm-message-input" placeholder="Post an update..." class="chat-input-field">
                     </div>
                     <button class="chat-send-btn" id="comm-send-btn">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                     </button>
                </div>
            </div>`;
        } else {
             // Non-admin view (no input)
             inputHtml = `<div style="padding:10px; text-align:center; color:#9ca3af; border-top:1px solid #e5e7eb; font-size:0.9rem;">Only admins can post in this community. You can reply to posts.</div>`;
        }

        feedContainer.innerHTML = `
            <div class="community-header">
                <div class="community-header-info">
                    <div class="community-header-icon" style="overflow:hidden; padding:0; width:5rem; height:5rem; border-radius:50%;">${iconHtml}</div>
                    <div class="community-header-text">
                        <h2>${selectedCommunity.name}</h2>
                        <p>${selectedCommunity.description}</p>
                    </div>
                </div>
                <div class="community-header-actions">
                    <button id="leave-community-btn" class="${btnClass}">Joined</button>
                </div>
            </div>
            
            <div class="community-feed" id="community-feed-area" style="padding-bottom: 20px;">
                 <!-- Posts injected here -->
            </div>
            ${inputHtml}
        `;

        await fetchCommunityMessages(feedContainer);
        
        if (isAdmin) attachCommunityListeners(feedContainer);

        const leaveBtn = feedContainer.querySelector('#leave-community-btn');
        if(leaveBtn) {
            leaveBtn.addEventListener('click', async () => {
                // FIXED: Use Modal instead of simple confirm
                openLeaveConfirmModal(async () => {
                    try {
                        const res = await fetch(`${API_BASE}/api/communities/${selectedCommunity.id}/join`, {
                            method: 'POST', credentials: 'include'
                        });
                        if (res.ok) {
                            showNotification("You have left the community.");
                            await fetchMyCommunities();
                            selectedCommunity = null; 
                            renderCommunityList(mainPanelRef);
                            
                            feedContainer.innerHTML = `
                            <div class="chat-placeholder">
                                <p>Select a community to view</p>
                            </div>`;
                        }
                    } catch(e) { console.error(e); }
                });
            });
        }
    }
    
    function openLeaveConfirmModal(onConfirm) {
        const modal = document.createElement('div');
        modal.className = 'leave-modal-overlay';
        modal.style.cssText = "position:fixed; inset:0; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:10000; backdrop-filter:blur(2px);";
        
        modal.innerHTML = `
            <div class="leave-modal-card" style="background:white; padding:25px; border-radius:12px; box-shadow:0 10px 25px rgba(0,0,0,0.2); max-width:350px; width:90%; text-align:center;">
                <h3 style="margin-top:0; color:#1f2937;">Leave Community?</h3>
                <p style="color:#6b7280; margin:15px 0;">You will no longer receive updates from this community.</p>
                <div class="leave-modal-actions" style="display:flex; justify-content:center; gap:15px; margin-top:20px;">
                    <button class="leave-btn-cancel" style="padding:8px 16px; border:1px solid #d1d5db; background:white; border-radius:6px; cursor:pointer;">Cancel</button>
                    <button class="leave-btn-confirm" style="padding:8px 16px; border:none; background:#ef4444; color:white; border-radius:6px; cursor:pointer;">Leave</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        modal.querySelector('.leave-btn-cancel').addEventListener('click', () => modal.remove());
        modal.querySelector('.leave-btn-confirm').addEventListener('click', () => {
            modal.remove();
            onConfirm();
        });
    }

    async function fetchCommunityMessages(container) {
        if (!selectedCommunity) return;
        try {
            const res = await App.fetchData(`/api/communities/${selectedCommunity.id}/messages`);
            if (Array.isArray(res)) {
                // Transform messages to post format
                selectedCommunity.posts = res.map(m => {
                    // FIXED: Correctly construct full image URL with API_BASE
                    const rawUrl = m.mediaUrl;
                    let fullUrl = null;
                    if (rawUrl && rawUrl !== 'null' && rawUrl !== '') {
                        fullUrl = rawUrl.startsWith('http') ? rawUrl : `${API_BASE}/${rawUrl}`;
                    }

                    return {
                        id: m.id, 
                        author: m.senderName,
                        isAdmin: String(m.senderId) === String(selectedCommunity.ownerId),
                        authorAvatar: m.senderAvatar,
                        time: formatTime(m.timestamp),
                        content: m.content,
                        mediaUrl: fullUrl,
                        comments: m.commentCount || 0,
                        likes: m.likes ? m.likes.length : 0, 
                        isLiked: m.likes && m.likes.includes(Number(currentUser.userId)) 
                    };
                });
                renderPosts(container);
            }
        } catch(e) { console.error("Failed to fetch community messages", e); }
    }

    function renderPosts(container) {
        const feed = container.querySelector('#community-feed-area');
        if(!feed) return;
        
        const postsToRender = selectedCommunity.posts || [];

        if (postsToRender.length === 0) {
            feed.innerHTML = '<p style="text-align:center; padding:2rem; color:#9ca3af">No updates yet.</p>';
            return;
        }
        
        feed.innerHTML = postsToRender.map(p => {
             // FIXED: Ensure image URL is valid before rendering
             const imgHtml = p.mediaUrl ? `
                <div class="post-image-container" style="width: 100%; max-height: 300px; overflow: hidden; border-radius: 8px; margin-top: 10px; background: #000;">
                    <img src="${p.mediaUrl}" style="width: 100%; height: 100%; object-fit: contain; display: block; cursor: pointer;" onclick="window.open(this.src, '_blank')">
                </div>
                <a href="${p.mediaUrl}" download target="_blank" style="font-size:0.85rem; color:var(--text-secondary); margin-top:4px; display:inline-block; text-decoration:underline;">Download</a>` : '';

             return `
            <div class="post-card" style="margin-bottom:1.5rem;">
                <div class="post-header">
                    <div class="post-author-info">
                        <div style="display:flex; align-items:center; gap:8px;">
                            <h3 class="post-author-name" style="font-size:1.4rem; font-weight:600; color:var(--dark-color); margin:0;">${p.author}</h3>
                            ${p.isAdmin ? `<span style="font-size:0.8rem; background:#dbeafe; color:#1e40af; padding:2px 6px; border-radius:4px; font-weight:600;">Admin</span>` : ''}
                            <span class="post-author-meta" style="font-size:1.1rem; color:var(--text-secondary); margin-left:4px;">• ${p.time}</span>
                        </div>
                    </div>
                </div>
                <div class="post-content" style="font-size:1.4rem; line-height:1.5; color:var(--dark-color); margin-top:0.5rem;">${p.content}</div>
                ${imgHtml}
                
                <div style="margin-top:10px; padding-top:10px; border-top:1px solid #f3f4f6; display: flex; gap: 20px; align-items: center;">
                     <button class="btn-ghost js-like-btn" data-post-id="${p.id}" style="color:${p.isLiked ? '#ef4444' : '#6b7280'}; font-size:1rem; cursor:pointer; background:none; border:none; padding:0; display: flex; align-items: center; gap: 5px;">
                        <svg class="icon-heart" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="${p.isLiked ? '#ef4444' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                        <span class="like-count">${p.likes}</span> Like
                    </button>
                    <button class="btn-ghost js-reply-btn" data-post-id="${p.id}" style="color:#4f46e5; font-size:1rem; cursor:pointer; background:none; border:none; padding:0; display: flex; align-items: center; gap: 5px;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                        <span class="comment-count">${p.comments}</span> Reply
                    </button>
                </div>
            </div>
        `;
        }).join('');
        
        // Bind Like Button
        feed.querySelectorAll('.js-like-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const postId = btn.dataset.postId;
                const post = selectedCommunity.posts.find(p => p.id === postId);
                if (!post) return;

                post.isLiked = !post.isLiked;
                post.likes = post.isLiked ? post.likes + 1 : post.likes - 1;
                
                const icon = btn.querySelector('svg');
                const countSpan = btn.querySelector('.like-count');
                
                if (post.isLiked) {
                    btn.style.color = '#ef4444';
                    icon.setAttribute('fill', '#ef4444');
                } else {
                    btn.style.color = '#6b7280';
                    icon.setAttribute('fill', 'none');
                }
                countSpan.textContent = post.likes;

                try {
                    await fetch(`${API_BASE}/api/communities/messages/${postId}/like`, { method: 'POST', credentials: 'include' });
                } catch(err) { console.error("Like failed", err); }
            });
        });

        // Bind Reply Button
        feed.querySelectorAll('.js-reply-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const postId = btn.dataset.postId;
                const post = selectedCommunity.posts.find(p => p.id === postId);
                
                const postData = {
                    id: post.id,
                    author: {
                        name: post.author,
                        avatar: post.authorAvatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=User', 
                        major: 'Community Post' 
                    },
                    timestamp: post.time,
                    content: post.content,
                    image: post.mediaUrl,
                    likes: post.likes,
                    comments: post.comments
                };

                // Use PostDetails logic
                const communityView = document.getElementById('view-communities'); 
                const detailsView = document.getElementById('view-post-details');
                
                if (detailsView) {
                    if (communityView) communityView.style.display = 'none';
                    document.querySelectorAll('.view-section').forEach(el => el.style.display = 'none');
                    detailsView.style.display = 'flex';
                    
                    const detailsPanel = detailsView.querySelector('.content-panel');
                    if(window.App.openPostDetails && detailsPanel) {
                         window.App.openPostDetails(detailsPanel, postData);
                         
                         setTimeout(() => {
                             const backBtn = detailsView.querySelector('#pd-back-btn');
                             if(backBtn) {
                                 const newBack = backBtn.cloneNode(true);
                                 backBtn.parentNode.replaceChild(newBack, backBtn);
                                 newBack.addEventListener('click', (ev) => {
                                     ev.preventDefault();
                                     detailsView.style.display = 'none'; 
                                     if (mainPanelRef && mainPanelRef.parentElement) {
                                         mainPanelRef.parentElement.style.display = 'flex';
                                     } else {
                                         if (communityView) communityView.style.display = 'flex';
                                     }
                                     renderCommunityFeed(mainPanelRef); 
                                 });
                             }
                         }, 100);
                    }
                } else {
                    console.error("Post details view container not found in DOM.");
                    showNotification("Could not open post details.", "error");
                }
            });
        });
    }

    function attachCommunityListeners(container) {
        const sendBtn = container.querySelector('#comm-send-btn');
        const input = container.querySelector('#comm-message-input');
        const emojiBtn = container.querySelector('#comm-emoji-btn');
        const imageBtn = container.querySelector('#comm-image-btn');
        const fileInput = container.querySelector('#comm-file-input');
        const previewContainer = container.querySelector('#comm-preview-container');
        const previewImg = container.querySelector('#comm-preview-img');
        const removePreviewBtn = container.querySelector('#comm-remove-preview-btn');

        const clearPreview = () => {
            imageFileToUpload = null;
            previewContainer.style.display = 'none';
            fileInput.value = '';
        };

        if(removePreviewBtn) removePreviewBtn.addEventListener('click', (e) => { e.preventDefault(); clearPreview(); });

        if(sendBtn && input) {
            const handleSend = async () => {
                const text = input.value.trim();
                if(!text && !imageFileToUpload) return;
                
                let mediaUrl = null;
                if (imageFileToUpload) {
                    const formData = new FormData();
                    formData.append('file', imageFileToUpload);
                    try {
                        const upRes = await fetch(`${API_BASE}/api/posts/create-media`, { method: 'POST', credentials: 'include', body: formData });
                        if(upRes.ok) {
                            const data = await upRes.json();
                            mediaUrl = data.url; // Relative Path
                        }
                    } catch(e) { showNotification("Image upload failed", "error"); return; }
                }
                
                try {
                    const res = await fetch(`${API_BASE}/api/communities/${selectedCommunity.id}/messages`, {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json', 'credentials': 'include'},
                        body: JSON.stringify({ content: text, mediaUrl: mediaUrl })
                    });
                    
                    if (res.ok) {
                        input.value = '';
                        clearPreview();
                        fetchCommunityMessages(container);
                    } else {
                        showNotification("Failed to post message", "error");
                    }
                } catch(e) { console.error("Post failed", e); }
            };

            sendBtn.addEventListener('click', handleSend);
            input.addEventListener('keypress', (e) => { if(e.key === 'Enter') handleSend(); });
            
            if(emojiBtn && App.openEmojiPanel) {
                emojiBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    App.openEmojiPanel((emoji) => { input.value += emoji; input.focus(); }, emojiBtn);
                });
            }

            if(imageBtn && fileInput) {
                imageBtn.addEventListener('click', () => fileInput.click());
                fileInput.addEventListener('change', (e) => {
                    if(e.target.files && e.target.files[0]) {
                        imageFileToUpload = e.target.files[0];
                        const reader = new FileReader();
                        reader.onload = (evt) => {
                            previewImg.src = evt.target.result;
                            previewContainer.style.display = 'flex';
                        };
                        reader.readAsDataURL(imageFileToUpload);
                    }
                });
            }
        }
    }

    async function openCreateCommunityModal() {
        const container = document.getElementById('create-group-modal-container'); 
        if (!container) return;

        const modalHtml = await loadHtml('create_community.html'); 
        if (!modalHtml) { alert("Error: create_community.html not found"); return; }

        container.innerHTML = modalHtml;
        const closeBtns = container.querySelectorAll('.js-close-create-community');
        const createBtn = container.querySelector('#submit-community-btn');
        const nameInput = container.querySelector('#community-name');
        const descInput = container.querySelector('#community-desc');
        
        const closeModal = () => { container.innerHTML = ''; };
        closeBtns.forEach(btn => btn.addEventListener('click', closeModal));

        if(nameInput && createBtn) {
            nameInput.addEventListener('input', () => {
                if(nameInput.value.trim()) createBtn.removeAttribute('disabled');
                else createBtn.setAttribute('disabled', 'true');
            });

            createBtn.addEventListener('click', async () => {
                const name = nameInput.value.trim();
                const desc = descInput ? descInput.value.trim() : '';
                const avatarIcon = `🌐`; 

                try {
                    const res = await fetch(`${API_BASE}/api/communities/create`, {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json', 'credentials': 'include'},
                        body: JSON.stringify({ name: name, description: desc, icon: avatarIcon })
                    });
                    if (res.ok) {
                        closeModal();
                        await fetchMyCommunities();
                        if(mainPanelRef) renderCommunityList(mainPanelRef);
                    } else {
                        alert("Failed to create community.");
                    }
                } catch(e) { console.error(e); }
            });
        }
    }

    async function openSearchCommunityModal() {
        const modalContainer = document.getElementById('reusable-modal');
        const modalContent = document.getElementById('reusable-modal-content');
        const globalCloseBtn = modalContainer.querySelector('.js-close-modal');

        if (!modalContainer || !modalContent) return;

        const modalHtml = await loadHtml('search_community.html');
        if (!modalHtml) return;

        modalContent.innerHTML = modalHtml;
        modalContainer.style.display = 'flex';
        
        setTimeout(() => {
            modalContainer.classList.add('show');
            modalContainer.classList.add('modal-large');

            const resultsContainer = modalContent.querySelector('#community-search-results');
            const searchInput = modalContent.querySelector('#search-community-input');
            
            const closeModal = () => {
                modalContainer.classList.remove('show');
                modalContainer.classList.remove('modal-large');
                setTimeout(() => {
                    modalContainer.style.display = 'none';
                    modalContent.innerHTML = '';
                }, 300);
            };

            const newCloseBtn = globalCloseBtn.cloneNode(true);
            globalCloseBtn.parentNode.replaceChild(newCloseBtn, globalCloseBtn);
            newCloseBtn.addEventListener('click', closeModal);
            modalContent.querySelectorAll('.js-close-search-community').forEach(btn => btn.addEventListener('click', closeModal));
            modalContainer.onclick = (e) => { if (e.target === modalContainer) closeModal(); };

            const performSearch = async (query = '') => {
                resultsContainer.innerHTML = '<div style="padding:20px;text-align:center;">Searching...</div>';
                try {
                    const url = query ? `/api/communities/list?query=${encodeURIComponent(query)}` : `/api/communities/list`;
                    const res = await App.fetchData(url);
                    
                    if (!res || res.length === 0) {
                        resultsContainer.innerHTML = '<div style="padding:20px;text-align:center;">No communities found</div>';
                        return;
                    }

                    resultsContainer.innerHTML = res.map(comm => {
                        const isJoined = myCommunities.some(c => c.id === comm.id);
                        const btnText = isJoined ? 'Joined' : 'Join';
                        const btnClass = isJoined ? 'btn-secondary' : 'btn-primary';
                        const iconHtml = getCommunityAvatar(comm);

                        return `
                        <div class="community-result-item">
                             <div class="result-icon" style="width:3rem; height:3rem; border-radius:50%; overflow:hidden; padding:0;">${iconHtml}</div>
                             <div class="result-info">
                                 <span class="result-name">${comm.name}</span>
                                 <span class="result-meta">${comm.memberIds ? comm.memberIds.length : 0} members</span>
                             </div>
                             <button class="${btnClass} js-join-btn" data-id="${comm.id}" style="padding:0.6rem 1.2rem; border-radius:8px; font-size:1rem; cursor:pointer;">${btnText}</button>
                        </div>`;
                    }).join('');

                    resultsContainer.querySelectorAll('.js-join-btn').forEach(btn => {
                        btn.addEventListener('click', async (e) => {
                            e.stopPropagation();
                            const id = btn.dataset.id;
                            try {
                                const joinRes = await fetch(`${API_BASE}/api/communities/${id}/join`, {
                                    method: 'POST', credentials: 'include'
                                });
                                if (joinRes.ok) {
                                    const data = await joinRes.json();
                                    if(data.joined) {
                                        btn.textContent = 'Joined';
                                        btn.className = 'btn-secondary js-join-btn';
                                    } else {
                                        btn.textContent = 'Join';
                                        btn.className = 'btn-primary js-join-btn';
                                    }
                                    await fetchMyCommunities();
                                    if(mainPanelRef) renderCommunityList(mainPanelRef);
                                }
                            } catch(err) { console.error(err); }
                        });
                    });

                } catch(e) {
                     resultsContainer.innerHTML = '<div style="padding:20px;text-align:center;color:red;">Error loading data</div>';
                }
            };

            performSearch();
            searchInput.addEventListener('input', (e) => performSearch(e.target.value));

        }, 50);
    }

})(window.App = window.App || {});