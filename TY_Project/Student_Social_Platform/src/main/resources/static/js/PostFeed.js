// postFeed.js - Fully Integrated with Backend & External Templates + Realtime Auto-Paste
// Handles Feed fetching, Post Creation (Text+Image), Liking, and Realtime Updates
(function(App) {
    
    const API_BASE = '';
    let currentUserId = null;

    // 🔥 WEBSOCKET & STATE (Synced)
    let feedMap = new Map();
    let stompClient = null;
    let wsConnected = false;

    // --- 1. Templates & Helpers ---
    
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

    async function getCurrentUserId() {
        if (currentUserId) return currentUserId;
        try {
            const res = await App.fetchData('/api/my-profile');
            if (res && res.userId) {
                currentUserId = res.userId;
                return currentUserId;
            }
        } catch (e) { console.error("Auth check failed", e); }
        return null;
    }

    function formatTime(isoString) {
        if (!isoString) return 'Just now';
        const date = new Date(isoString);
        const now = new Date();
        const diff = (now - date) / 1000; 

        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
        return date.toLocaleDateString();
    }

    // Updated Post Card HTML with FULL IMAGE VISIBILITY (Contain)
    const POST_CARD_HTML = `
        <div class="post-card">
            <div class="post-header">
                <img src="" alt="Author" class="post-author-avatar"/>
                <div class="post-author-info">
                    <h3 class="post-author-name"></h3>
                    <p class="post-author-meta"></p>
                </div>
                <div class="post-menu-wrapper">
                    <button class="post-menu-btn">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                    </button>
                    <div class="dropdown-menu">
                        <a href="#" class="dropdown-item delete-post-btn" style="color:red; display:none;">Delete Post</a>
                        <a href="#" class="dropdown-item">Report Post</a>
                    </div>
                </div>
            </div>

            <p class="post-content"></p>
            
            <div class="post-image-container" style="width: 100%; height: 400px; border-radius: 8px; margin-top: 10px; display: none; background: #000; overflow: hidden;">
                <img src="" alt="Post content" class="post-image" style="width: 100%; height: 100%; object-fit: contain; display: block; cursor: pointer;"/>
            </div>
            
            <div class="post-actions-wrapper">
                <div class="post-actions-left">
                    <button class="btn-ghost like-btn">
                        <svg class="icon-heart" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                        <span class="post-likes-count">0</span>
                    </button>
                    <button class="btn-ghost comment-btn">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                        <span class="post-comments-count">0</span>
                    </button>
                    <button class="btn-ghost share-btn">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                    </button>
                </div>
                <button class="btn-ghost bookmark-btn">
                    <svg class="icon-bookmark" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>
                </button>
            </div>
        </div>
    `;

    function getPostCardTemplate() {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = POST_CARD_HTML.trim();
        return tempDiv.firstElementChild;
    }

    function mapBackendPostToFrontend(post, myId) {
        const myIdNum = parseInt(myId);
        const isLiked = post.likes && post.likes.includes(myIdNum);
        
        let imageSrc = null;
        if (post.mediaUrl && post.mediaUrl !== 'null') {
            imageSrc = post.mediaUrl.startsWith('http') ? post.mediaUrl : `${API_BASE}/${post.mediaUrl}`;
        }

        return {
            id: post.id,
            author: {
                id: post.userId,
                name: post.authorSnapshot?.username || 'Unknown',
                major: post.authorSnapshot?.major || 'Student',
                avatar: post.authorSnapshot?.avatarUrl || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Unknown'
            },
            timestamp: formatTime(post.createdAt),
            content: post.content,
            image: imageSrc,
            likes: post.likeCount || 0,
            comments: post.commentCount || 0,
            isLiked: isLiked
        };
    }

    // 🔥 REALTIME FEED SOCKET (Synced)
    function connectFeedSocket() {
        if (wsConnected) return;

        if (!window.SockJS || !window.Stomp) {
            console.warn('SockJS/Stomp missing. Realtime feed disabled.');
            return;
        }

        const socket = new SockJS('/ws');
        stompClient = Stomp.over(socket);
        stompClient.debug = () => {};

        stompClient.connect({}, () => {
            wsConnected = true;
            stompClient.subscribe('/topic/feed', msg => {
                try {
                    const evt = JSON.parse(msg.body);
                    
                    // 🔥 Handle Comment Count Update (New Feature)
                    if (evt.type === 'COMMENT_ADDED') {
                        const postId = evt.postId || evt.post?.id;
                        const count = evt.commentCount ?? evt.post?.commentCount;
                        if (postId && count != null) {
                            updateCommentCount(postId, count);
                        }
                        return;
                    }

                    // Existing Post Events
                    if (!evt.post) return;
                    applyFeedEvent(evt);
                } catch (e) { console.error('WS Error', e); }
            });
        });
    }

    // 🔥 Helper to update comment count in DOM and State
    function updateCommentCount(postId, count) {
        if (feedMap.has(postId)) {
            const p = feedMap.get(postId);
            p.comments = count;
        }
        const el = document.querySelector(`.post-card[data-post-id="${postId}"] .post-comments-count`);
        if (el) el.textContent = count;
    }

    async function applyFeedEvent(evt) {
        // Map the raw event post to frontend structure
        const myId = currentUserId || await getCurrentUserId();
        const p = mapBackendPostToFrontend(evt.post, myId);

        if (evt.type === 'POST_CREATED') {
            // Avoid duplicate if already present
            if (feedMap.has(p.id)) return;
            feedMap.set(p.id, p);
            
            // Auto Paste: Render and Prepend to feed
            const wrapper = document.querySelector('.post-feed-wrapper');
            if (wrapper) {
                const card = createPostElement(p, myId);
                wrapper.prepend(card);
            }
        }

        if (evt.type === 'POST_LIKED') {
            // Update map
            if (feedMap.has(p.id)) {
                const existing = feedMap.get(p.id);
                existing.likes = p.likes; // Update count
            }
            // Update DOM directly
            const countEl = document.querySelector(`.post-card[data-post-id="${p.id}"] .post-likes-count`);
            if (countEl) countEl.textContent = p.likes;
        }
    }

    // --- 2. Create Post Modal Logic ---
    async function openCreatePostModal() {
        const container = document.getElementById('create-post-modal-container');
        if (!container) return;
        
        const modalHtml = await loadHtml('create_post.html');
        if (!modalHtml) {
            console.error("Failed to load create_post.html");
            return;
        }
        container.innerHTML = modalHtml;

        try {
            const profile = await App.fetchData('/api/my-profile');
            if (profile) {
                const nameEl = container.querySelector('.cp-user-info .name');
                const avatarEl = container.querySelector('.cp-user img');
                if (nameEl) nameEl.textContent = profile.username;
                if (avatarEl) avatarEl.src = profile.avatarUrl;
            }
        } catch(e) {}

        const closeBtns = container.querySelectorAll('.js-close-create-post');
        const textarea = container.querySelector('#post-textarea');
        const submitBtn = container.querySelector('#submit-post-btn');
        const photoBtn = container.querySelector('#add-photo-btn');
        const emojiBtn = container.querySelector('#add-emoji-btn');
        const fileInput = container.querySelector('#post-file-input');
        const previewContainer = container.querySelector('#post-image-preview-container');
        const previewImage = container.querySelector('#post-image-preview');
        const removeImageBtn = container.querySelector('#remove-image-btn');

        let selectedFile = null;

        const closeModal = () => { container.innerHTML = ''; };
        closeBtns.forEach(btn => btn.addEventListener('click', closeModal));

        const validate = () => {
            const hasText = textarea.value.trim().length > 0;
            const hasImage = selectedFile !== null;
            if (hasText || hasImage) submitBtn.removeAttribute('disabled');
            else submitBtn.setAttribute('disabled', 'true');
        };

        textarea.addEventListener('input', validate);
        
        if (photoBtn) photoBtn.addEventListener('click', () => fileInput.click());
        
        if (emojiBtn) emojiBtn.addEventListener('click', () => {
             if (App.openEmojiPanel) {
                App.openEmojiPanel((emoji) => {
                    textarea.value += emoji;
                    validate();
                    textarea.focus();
                });
            } else {
                textarea.value += " 😊"; 
                validate(); textarea.focus();
            }
        });

        if (fileInput) fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                selectedFile = e.target.files[0];
                const reader = new FileReader();
                reader.onload = function(evt) {
                    previewImage.src = evt.target.result;
                    previewContainer.style.display = 'flex'; 
                    validate();
                }
                reader.readAsDataURL(selectedFile);
            }
        });

        if (removeImageBtn) removeImageBtn.addEventListener('click', () => {
            fileInput.value = ''; 
            selectedFile = null;
            previewImage.src = '';
            previewContainer.style.display = 'none';
            validate();
        });

        if (submitBtn) submitBtn.addEventListener('click', async () => {
            const content = textarea.value;
            const formData = new FormData();
            formData.append('content', content);
            if (selectedFile) {
                formData.append('file', selectedFile);
            }

            submitBtn.textContent = 'Posting...';
            submitBtn.disabled = true;

            try {
                const res = await fetch(`${API_BASE}/api/posts/create`, {
                    method: 'POST',
                    credentials: 'include', 
                    body: formData
                });

                if (res.ok) {
                    closeModal();
                    // NOTE: WebSocket will handle the update via applyFeedEvent
                    // No manual refresh needed for the current user
                } else {
                    const err = await res.json();
                    alert("Error creating post: " + (err.error || 'Unknown error'));
                    submitBtn.textContent = 'Post';
                    submitBtn.disabled = false;
                }
            } catch (e) {
                console.error(e);
                alert("Network error.");
                submitBtn.textContent = 'Post';
                submitBtn.disabled = false;
            }
        });
    }

    // --- Helper to create Post Element (Extracted for re-use in WS) ---
    function createPostElement(post, myId) {
        const postCard = getPostCardTemplate();
        postCard.dataset.postId = post.id;

        const avatar = postCard.querySelector('.post-author-avatar');
        if(avatar) avatar.src = post.author.avatar;
        
        const name = postCard.querySelector('.post-author-name');
        if(name) name.textContent = post.author.name;
        
        const meta = postCard.querySelector('.post-author-meta');
        if(meta) meta.textContent = `${post.author.major} · ${post.timestamp}`;
        
        const content = postCard.querySelector('.post-content');
        if(content) content.textContent = post.content;
        
        const postImageContainer = postCard.querySelector('.post-image-container');
        const postImage = postCard.querySelector('.post-image');
        
        if (postImage) {
            if (post.image) {
                postImage.src = post.image;
                postImageContainer.style.display = 'block';
            } else {
                postImageContainer.style.display = 'none';
            }
        }
        
        const likesCount = postCard.querySelector('.post-likes-count');
        if(likesCount) likesCount.textContent = post.likes;
        
        const commentsCount = postCard.querySelector('.post-comments-count');
        if(commentsCount) commentsCount.textContent = post.comments;

        // Like Logic
        const likeBtn = postCard.querySelector('.like-btn');
        if(likeBtn) {
            if (post.isLiked) likeBtn.classList.add('liked');
            
            likeBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                post.isLiked = !post.isLiked;
                post.likes = post.isLiked ? post.likes + 1 : post.likes - 1;
                
                if (post.isLiked) likeBtn.classList.add('liked');
                else likeBtn.classList.remove('liked');
                likesCount.textContent = post.likes;

                try {
                    const likeRes = await fetch(`${API_BASE}/api/posts/${post.id}/like`, {
                        method: 'POST',
                        credentials: 'include'
                    });
                    if (!likeRes.ok) {
                        // Revert
                        post.isLiked = !post.isLiked;
                        post.likes = post.isLiked ? post.likes + 1 : post.likes - 1;
                        if (post.isLiked) likeBtn.classList.add('liked'); else likeBtn.classList.remove('liked');
                        likesCount.textContent = post.likes;
                    }
                } catch(err) { console.error("Like failed", err); }
            });
        }
        
        const commentBtn = postCard.querySelector('.comment-btn');
        const cardBody = postCard.querySelector('.post-content');
        
        const openDetails = () => {
            document.getElementById('view-home').style.display = 'none';
            const detailsView = document.getElementById('view-post-details');
            detailsView.style.display = 'flex'; 
            const detailsPanel = detailsView.querySelector('.content-panel');
            
            if(window.handleNavigation) window.handleNavigation('post-details');
            
            if(window.App.openPostDetails) {
                 window.App.openPostDetails(detailsPanel, post);
            }
        };

        if(commentBtn) commentBtn.addEventListener('click', (e) => { e.stopPropagation(); openDetails(); });
        if(cardBody) cardBody.addEventListener('click', openDetails);
        
        if(postImage) {
            postImage.addEventListener('click', (e) => {
                e.stopPropagation();
                if (post.image) {
                    window.open(post.image, '_blank');
                }
            });
        }

        const bookmarkBtn = postCard.querySelector('.bookmark-btn');
        if(bookmarkBtn) bookmarkBtn.addEventListener('click', (e) => { e.stopPropagation(); bookmarkBtn.classList.toggle('bookmarked'); });

        // Menu / Delete
        const menuBtn = postCard.querySelector('.post-menu-btn');
        const dropdown = postCard.querySelector('.dropdown-menu');
        const deleteBtn = postCard.querySelector('.delete-post-btn');

        if (String(post.author.id) === String(myId)) {
            if (deleteBtn) {
                deleteBtn.style.display = 'block';
                deleteBtn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    if(!confirm("Delete this post?")) return;
                    try {
                        const delRes = await fetch(`${API_BASE}/api/posts/${post.id}`, { method: 'DELETE', credentials:'include' });
                        if (delRes.ok) {
                            postCard.remove();
                            feedMap.delete(post.id);
                        }
                    } catch(err) { console.error(err); }
                });
            }
        }

        if(menuBtn && dropdown) {
            menuBtn.addEventListener('click', (e) => {
                e.stopPropagation(); 
                document.querySelectorAll('.dropdown-menu.show').forEach(d => { if (d !== dropdown) d.classList.remove('show'); });
                dropdown.classList.toggle('show');
            });
        }
        
        return postCard;
    }

    // --- 3. Main Render Function (Feed) ---
    App.renderHome = async (panel) => {
        panel.innerHTML = '<div style="text-align:center; padding:2rem; color:#888;">Loading feed...</div>';
        
        const myId = await getCurrentUserId();
        if (!myId) {
            panel.innerHTML = '<div style="text-align:center; padding:2rem; color:red;">Authentication failed.</div>';
            return;
        }

        // 🔥 Connect Socket for updates
        connectFeedSocket();

        try {
            const res = await App.fetchData('/api/posts/feed');
            panel.innerHTML = ''; 
            
            // Clear map on refresh
            feedMap.clear();

            if (!res || res.length === 0) {
                panel.innerHTML = '<p class="text-secondary" style="text-align:center; padding: 2rem;">No posts yet. Be the first to share something!</p>';
                setupFab();
                return;
            }

            const feedWrapper = document.createElement('div');
            feedWrapper.className = 'post-feed-wrapper';

            res.forEach(rawPost => {
                const post = mapBackendPostToFrontend(rawPost, myId);
                feedMap.set(post.id, post); // Track initial posts
                const card = createPostElement(post, myId);
                feedWrapper.appendChild(card);
            });

            panel.appendChild(feedWrapper);
            setupFab();

        } catch (e) {
            console.error("Feed load error:", e);
            panel.innerHTML = `<div style="text-align:center; padding:2rem; color:red;">Failed to load feed. ${e.message}</div>`;
        }
    };

    function setupFab() {
        const fab = document.getElementById('create-post-fab');
        if (fab) {
            const newFab = fab.cloneNode(true);
            fab.parentNode.replaceChild(newFab, fab);
            newFab.addEventListener('click', (e) => {
                e.preventDefault();
                openCreatePostModal();
            });
        }
    }

    window.addEventListener('click', () => {
        document.querySelectorAll('.dropdown-menu.show').forEach(d => d.classList.remove('show'));
    });

})(window.App = window.App || {});