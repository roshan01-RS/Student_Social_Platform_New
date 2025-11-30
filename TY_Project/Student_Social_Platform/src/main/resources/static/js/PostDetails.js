// Add to window.App
(function(App) {

    // --- Mock Database: Store comments by Post ID ---
    // Keys are post IDs ('1', '2'), values are arrays of comments
    const mockCommentsDB = {
        '1': [
            {
                id: 'c1',
                author: 'Mike Chen',
                avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Mike',
                text: 'Totally agree! This channel deserves more subscribers.',
                timestamp: '1 day ago',
                likes: 45,
                replies: []
            }
        ],
        '2': [
            {
                id: 'c2',
                author: 'Alex Turner',
                avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex',
                text: 'Great post! Very insightful.',
                timestamp: '3 days ago',
                likes: 12,
                replies: [
                     {
                        id: 'c2-1',
                        author: 'Sarah Johnson',
                        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',
                        text: 'Thanks Alex!',
                        timestamp: '2 days ago',
                        likes: 3,
                        replies: []
                     }
                ]
            }
        ]
    };

    async function getDetailsTemplate() {
        try {
            const response = await fetch('post_details.html');
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

    // --- Recursive HTML builder ---
    function buildCommentHTML(comment, isReply = false) {
        const repliesHtml = comment.replies.length > 0 
            ? `<div class="replies-list">${comment.replies.map(r => buildCommentHTML(r, true)).join('')}</div>`
            : '';

        return `
        <div class="comment-wrapper" data-id="${comment.id}">
            <div class="comment-item ${isReply ? 'is-reply' : ''}">
                <img src="${comment.avatar}" alt="${comment.author}" class="comment-avatar">
                <div class="comment-body">
                    <div class="comment-header-row">
                        <span class="comment-author">${comment.author}</span>
                        <span class="comment-time">${comment.timestamp}</span>
                    </div>
                    <p class="comment-text">${comment.text}</p>
                    <div class="comment-actions">
                        <button class="c-action-btn like-btn">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
                            <span class="like-count">${comment.likes}</span>
                        </button>
                        <button class="c-action-btn reply-btn" data-author="${comment.author}">Reply</button>
                    </div>
                </div>
            </div>
            ${repliesHtml}
        </div>
        `;
    }

    // --- Main Function to Render Post Details ---
    App.openPostDetails = async (panel, postData) => {
        const template = await getDetailsTemplate();
        if (!template) return;

        panel.innerHTML = '';
        panel.appendChild(template);

        // 1. Setup Back Button
        const backBtn = panel.querySelector('#pd-back-btn');
        backBtn.addEventListener('click', (e) => {
            e.preventDefault();
            // Navigate back to home
            if(window.handleNavigation) {
                window.handleNavigation('home');
            }
        });

        // 2. Render Original Post
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
            ${postData.image ? `<img src="${postData.image}" class="pd-original-image">` : ''}
            <div class="pd-original-stats">
                <span>${postData.likes} Likes</span>
                <span>${postData.comments} Comments</span>
            </div>
        `;

        // 3. Load Comments for THIS specific post
        // If no comments exist for this ID, initialize an empty array
        if (!mockCommentsDB[postData.id]) {
            mockCommentsDB[postData.id] = [];
        }
        
        // Reference to the specific array for this post
        // Note: We are referencing the array inside the object, so push updates persist
        const currentPostComments = mockCommentsDB[postData.id];

        const commentsList = panel.querySelector('#pd-comments-list');
        
        const renderList = () => {
            if (currentPostComments.length === 0) {
                commentsList.innerHTML = '<p style="text-align:center; color:#9ca3af; padding:2rem;">No comments yet. Be the first!</p>';
            } else {
                commentsList.innerHTML = currentPostComments.map(c => buildCommentHTML(c)).join('');
            }
        };
        renderList();

        // 4. Handle Input
        const input = panel.querySelector('#pd-reply-input');
        const replyBtn = panel.querySelector('#pd-reply-btn');

        input.addEventListener('input', () => {
            if(input.value.trim().length > 0) replyBtn.removeAttribute('disabled');
            else replyBtn.setAttribute('disabled', 'true');
        });

        // Event Delegation for Replies
        commentsList.addEventListener('click', (e) => {
            const replyButton = e.target.closest('.reply-btn');
            if (replyButton) {
                const author = replyButton.dataset.author;
                input.value = `@${author} `; 
                input.focus(); 
                replyBtn.removeAttribute('disabled');
            }
        });

        replyBtn.addEventListener('click', () => {
            const text = input.value;
            if(!text.trim()) return;

            const newComment = {
                id: Date.now().toString(),
                author: 'You',
                avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=You',
                text: text,
                timestamp: 'Just now',
                likes: 0,
                replies: []
            };
            
            // Add to THIS post's array
            currentPostComments.unshift(newComment);
            
            renderList(); 
            input.value = '';
            replyBtn.setAttribute('disabled', 'true');
            
            // Optional: Update comment count on the main feed object if needed
            // postData.comments++;
        });
    };

})(window.App = window.App || {});