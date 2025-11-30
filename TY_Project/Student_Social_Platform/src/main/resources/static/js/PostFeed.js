// Add to the global window.App object
(function(App) {
    
    // --- 1. Hardcoded Create Post Modal HTML ---
    const CREATE_POST_MODAL_HTML = `
        <div class="create-post-backdrop js-close-create-post"></div>
        <div class="create-post-modal">
            <div class="cp-header">
                <h3>Create Post</h3>
                <button class="btn-icon js-close-create-post">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>
            <div class="cp-body">
                <div class="cp-user">
                    <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=You" alt="User" />
                    <div class="cp-user-info">
                        <p class="name">You</p>
                        <p class="privacy">Public</p>
                    </div>
                </div>
                <textarea id="post-textarea" placeholder="What's on your mind?" class="cp-textarea" autofocus></textarea>
                <div id="post-image-preview-container" style="display: none;">
                     <img id="post-image-preview" src="" alt="Preview">
                     <button id="remove-image-btn" title="Remove Image">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                     </button>
                </div>
            </div>
            <div class="cp-footer">
                <div class="cp-tools">
                    <button class="btn-tool" id="add-photo-btn">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                        <span>Photo</span>
                    </button>
                    <button class="btn-tool" id="add-emoji-btn">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
                        <span>Emoji</span>
                    </button>
                    <input type="file" id="post-file-input" accept="image/*" style="display: none;">
                </div>
                <button id="submit-post-btn" class="btn-post" disabled>Post</button>
            </div>
        </div>
    `;

    // --- 2. Hardcoded Post Card Template ---
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
                        <a href="#" class="dropdown-item">Save Post</a>
                        <a href="#" class="dropdown-item">Report Post</a>
                    </div>
                </div>
            </div>

            <p class="post-content"></p>
            <img src="" alt="Post content" class="post-image" style="display: none;"/>
            
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

    // --- Mock Data ---
    const mockPostData = [
        { id: '1', author: { name: 'Sarah Johnson', major: 'Computer Science', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah' }, timestamp: '2 hours ago', content: 'Just finished my final project for CS101! Anyone else excited for winter break? 🥳', image: null, likes: 24, comments: 8, isLiked: false },
        { id: '2', author: { name: 'Mike Chen', major: 'Business', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Mike' }, timestamp: '4 hours ago', content: 'Study group meeting tomorrow at 3 PM!', image: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=800', likes: 15, comments: 5, isLiked: true }
    ];

    function getPostCardTemplate() {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = POST_CARD_HTML.trim();
        return tempDiv.firstElementChild;
    }

    // --- Open Modal Logic ---
    function openCreatePostModal() {
        const container = document.getElementById('create-post-modal-container');
        if (!container) return;
        container.innerHTML = CREATE_POST_MODAL_HTML;

        const closeBtns = container.querySelectorAll('.js-close-create-post');
        const textarea = container.querySelector('#post-textarea');
        const submitBtn = container.querySelector('#submit-post-btn');
        const photoBtn = container.querySelector('#add-photo-btn');
        const emojiBtn = container.querySelector('#add-emoji-btn');
        const fileInput = container.querySelector('#post-file-input');
        const previewContainer = container.querySelector('#post-image-preview-container');
        const previewImage = container.querySelector('#post-image-preview');
        const removeImageBtn = container.querySelector('#remove-image-btn');

        const closeModal = () => { container.innerHTML = ''; };
        closeBtns.forEach(btn => btn.addEventListener('click', closeModal));

        const validate = () => {
            const hasText = textarea.value.trim().length > 0;
            const hasImage = previewContainer.style.display !== 'none';
            if (hasText || hasImage) {
                submitBtn.removeAttribute('disabled');
            } else {
                submitBtn.setAttribute('disabled', 'true');
            }
        };

        textarea.addEventListener('input', validate);
        photoBtn.addEventListener('click', () => fileInput.click());
        
        emojiBtn.addEventListener('click', () => {
             if (App.openEmojiPanel) {
                App.openEmojiPanel((emoji) => {
                    textarea.value += emoji;
                    validate();
                    textarea.focus();
                });
            } else {
                textarea.value += " 😊"; 
                validate(); 
                textarea.focus();
            }
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    previewImage.src = e.target.result;
                    previewContainer.style.display = 'block';
                    validate();
                }
                reader.readAsDataURL(e.target.files[0]);
            }
        });

        removeImageBtn.addEventListener('click', () => {
            fileInput.value = ''; 
            previewImage.src = '';
            previewContainer.style.display = 'none';
            validate();
        });

        submitBtn.addEventListener('click', async () => {
            const content = textarea.value;
            const imageSrc = previewContainer.style.display !== 'none' ? previewImage.src : null;
            
            const newPost = {
                id: Date.now().toString(),
                author: { name: 'You', major: 'Student', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=You' },
                timestamp: 'Just now',
                content: content,
                image: imageSrc,
                likes: 0,
                comments: 0,
                isLiked: false
            };
            mockPostData.unshift(newPost);
            closeModal();
            const contentPanel = document.querySelector('#view-home .content-panel');
            if(contentPanel) await App.renderHome(contentPanel);
        });
    }

    // --- Main Render Function ---
    App.renderHome = async (panel) => {
        panel.innerHTML = ''; 
        
        const data = mockPostData; 
        const feedWrapper = document.createElement('div');
        feedWrapper.className = 'post-feed-wrapper';

        if (data.length === 0) {
            panel.innerHTML = '<p class="text-secondary" style="text-align:center; padding: 2rem;">No posts yet.</p>';
            return;
        }

        data.forEach(post => {
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
            
            const postImage = postCard.querySelector('.post-image');
            if (postImage) {
                if (post.image) {
                    postImage.src = post.image;
                    postImage.style.display = 'block';
                } else {
                    postImage.style.display = 'none';
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
                likeBtn.addEventListener('click', () => {
                    post.isLiked = !post.isLiked;
                    if (post.isLiked) {
                        likeBtn.classList.add('liked');
                        post.likes++;
                    } else {
                        likeBtn.classList.remove('liked');
                        post.likes--;
                    }
                    if(likesCount) likesCount.textContent = post.likes;
                });
            }
            
            // Comment/Reply Logic
            const commentBtn = postCard.querySelector('.comment-btn');
            if(commentBtn) {
                commentBtn.addEventListener('click', () => {
                    document.getElementById('view-home').style.display = 'none';
                    const detailsView = document.getElementById('view-post-details');
                    detailsView.style.display = 'flex'; 
                    const detailsPanel = detailsView.querySelector('.content-panel');
                    
                    if(window.handleNavigation) {
                        window.handleNavigation('post-details');
                    }
                    if(window.App.openPostDetails) {
                         window.App.openPostDetails(detailsPanel, post);
                    } else {
                        console.error("PostDetails.js is not loaded or App.openPostDetails is not defined.");
                    }
                });
            }
            
            const bookmarkBtn = postCard.querySelector('.bookmark-btn');
            if(bookmarkBtn) {
                bookmarkBtn.addEventListener('click', () => {
                     bookmarkBtn.classList.toggle('bookmarked');
                });
            }

            const menuBtn = postCard.querySelector('.post-menu-btn');
            const dropdown = postCard.querySelector('.dropdown-menu');
            if(menuBtn && dropdown) {
                menuBtn.addEventListener('click', (e) => {
                    e.stopPropagation(); 
                    document.querySelectorAll('.dropdown-menu.show').forEach(d => {
                        if (d !== dropdown) d.classList.remove('show');
                    });
                    dropdown.classList.toggle('show');
                });
            }

            feedWrapper.appendChild(postCard);
        });

        panel.appendChild(feedWrapper);

        // --- THIS IS THE FIX ---
        // FAB Listener
        const fab = document.getElementById('create-post-fab');
        if (fab) {
            // We clone it to remove any old listeners that might cause bugs
            const newFab = fab.cloneNode(true);
            fab.parentNode.replaceChild(newFab, fab);
            
            newFab.addEventListener('click', (e) => {
                e.preventDefault();
                openCreatePostModal(); // This function is defined above
            });
        }
        // --- END OF FIX ---
    };

    window.addEventListener('click', () => {
        document.querySelectorAll('.dropdown-menu.show').forEach(d => {
            d.classList.remove('show');
        });
    });

})(window.App = window.App || {});