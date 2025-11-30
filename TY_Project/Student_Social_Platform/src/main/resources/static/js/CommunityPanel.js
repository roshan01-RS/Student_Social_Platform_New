// Add to window.App
(function(App) {

    // --- Helper: Fetch HTML & Clean it ---
    async function loadHtml(url) {
        try {
            console.log(`[CommunityPanel] Fetching ${url}...`);
            const response = await fetch(url + '?v=' + new Date().getTime());
            if (!response.ok) throw new Error(`Failed to load ${url}`);
            let text = await response.text();
            // Clean Live Server injections if present
            text = text.replace(/<!-- Code injected by live-server -->[\s\S]*?<\/script>/gi, "");
            return text;
        } catch (err) {
            console.error("[CommunityPanel] HTML Load Error:", err);
            return null;
        }
    }

    // --- 1. Hardcoded Layout (Main Shell) ---
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

    // --- Mock Data ---
    const communities = [
        { id: '1', name: 'Tech Enthusiasts', icon: '💻', members: 1250, description: 'All things tech, code, and gadgets.', joined: true, posts: [
            { author: 'Admin', time: '2h ago', content: 'Welcome to the Tech Innovators community! Share your ideas here.' }
        ]},
        { id: '2', name: 'Campus Arts', icon: '🎨', members: 850, description: 'Painting, music, and digital art share.', joined: true, posts: [] }
    ];

    const allCommunities = [
        { id: '1', name: 'Tech Enthusiasts', icon: '💻', members: 1250, description: 'All things tech.' },
        { id: '2', name: 'Campus Arts', icon: '🎨', members: 850, description: 'Art share.' },
        { id: '3', name: 'Student Startups', icon: '🚀', members: 430, description: 'Founders network.' },
        { id: '4', name: 'Gaming Lounge', icon: '🎮', members: 2100, description: 'Gaming.' },
        { id: '5', name: 'Photography Club', icon: '📸', members: 300, description: 'Photo walks.' },
        { id: '6', name: 'Debate Society', icon: '🎤', members: 150, description: 'Public speaking.' }
    ];

    let selectedCommunity = null;
    let mainPanelRef = null;

    // --- Main Render Function ---
    App.renderCommunity = async (panel) => {
        mainPanelRef = panel;
        console.log("Rendering Community Panel (Interactive v7)...");

        // 1. Inject Layout
        panel.innerHTML = COMMUNITY_LAYOUT_HTML;
        
        // 2. Render List
        renderCommunityList(panel);
        
        // 3. Bind Listeners
        const searchInput = panel.querySelector('#community-search-input');
        if(searchInput) {
            searchInput.addEventListener('input', (e) => {
                renderCommunityList(panel, e.target.value);
            });
        }
        
        const createBtn = panel.querySelector('#create-community-btn');
        if(createBtn) {
            createBtn.addEventListener('click', openCreateCommunityModal);
        }

        const searchBtn = panel.querySelector('#search-community-btn');
        if(searchBtn) {
            console.log("Search button found, attaching listener.");
            searchBtn.addEventListener('click', openSearchCommunityModal);
        } else {
            console.error("Search button #search-community-btn not found in layout.");
        }
    };
    
    function renderCommunityList(panel, filter = '') {
        const listContainer = panel.querySelector('#community-list-container');
        if (!listContainer) return;

        const filtered = communities.filter(c => c.name.toLowerCase().includes(filter.toLowerCase()));

        if (filtered.length === 0) {
            listContainer.innerHTML = '<div style="padding:20px; text-align:center; color:#888;">No communities found</div>';
            return;
        }

        listContainer.innerHTML = filtered.map(comm => {
             const iconHtml = comm.icon.includes('<div') ? comm.icon : `<div style="font-size:2rem;">${comm.icon}</div>`;
             
             return `
            <button class="community-item-button ${selectedCommunity?.id === comm.id ? 'active' : ''}" data-comm-id="${comm.id}">
                <div class="community-item-inner">
                    <div class="community-icon-wrapper">${iconHtml}</div>
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
                selectedCommunity = communities.find(c => c.id === commId);
                renderCommunityList(panel, filter); 
                renderCommunityFeed(panel);
            });
        });
    }

    function renderCommunityFeed(panel) {
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

        const joinText = selectedCommunity.joined ? 'Joined' : 'Join';
        const btnClass = selectedCommunity.joined ? 'btn-join joined' : 'btn-join';
        const iconHtml = selectedCommunity.icon.includes('<div') ? selectedCommunity.icon : `<div style="font-size:2.5rem;">${selectedCommunity.icon}</div>`;

        feedContainer.innerHTML = `
            <div class="community-header">
                <div class="community-header-info">
                    <div class="community-header-icon">${iconHtml}</div>
                    <div class="community-header-text">
                        <h2>${selectedCommunity.name}</h2>
                        <p>${selectedCommunity.description}</p>
                    </div>
                </div>
                <div class="community-header-actions">
                    <button id="join-community-btn" class="${btnClass}">${joinText}</button>
                </div>
            </div>
            
            <div class="community-feed" id="community-feed-area"></div>

            <div class="community-chat-box" style="${selectedCommunity.joined ? '' : 'display:none;'}">
                <div class="chat-input-wrapper">
                     <button class="btn-icon" id="comm-image-btn" title="Upload Image">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                     </button>

                     <button class="btn-icon" id="comm-emoji-btn" title="Emoji">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
                     </button>
                     
                     <input type="file" id="comm-file-input" style="display: none;" accept="image/*">

                     <div class="chat-input-field-wrapper">
                        <input type="text" id="comm-message-input" placeholder="Post to community..." class="chat-input-field">
                     </div>
                     <button class="chat-send-btn" id="comm-send-btn">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                     </button>
                </div>
            </div>
        `;

        renderPosts(feedContainer);

        const joinBtn = feedContainer.querySelector('#join-community-btn');
        if(joinBtn) {
            joinBtn.addEventListener('click', () => {
                selectedCommunity.joined = !selectedCommunity.joined;
                const globalComm = communities.find(c => c.id === selectedCommunity.id);
                if(globalComm) globalComm.joined = selectedCommunity.joined;
                renderCommunityList(mainPanelRef);
                renderCommunityFeed(mainPanelRef);
            });
        }

        const sendBtn = feedContainer.querySelector('#comm-send-btn');
        const input = feedContainer.querySelector('#comm-message-input');
        const emojiBtn = feedContainer.querySelector('#comm-emoji-btn');
        const imageBtn = feedContainer.querySelector('#comm-image-btn');
        const fileInput = feedContainer.querySelector('#comm-file-input');

        if(sendBtn && input) {
            sendBtn.addEventListener('click', () => {
                const text = input.value.trim();
                if(!text) return;
                selectedCommunity.posts.unshift({ author: 'You', time: 'Just now', content: text });
                input.value = '';
                renderPosts(feedContainer);
            });
            
            input.addEventListener('keypress', (e) => { if(e.key === 'Enter') sendBtn.click(); });
            
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
                        const reader = new FileReader();
                        reader.onload = (evt) => {
                            const imgHtml = `<img src="${evt.target.result}" style="max-width:100%; border-radius:8px; margin-top:10px;">`;
                            selectedCommunity.posts.unshift({ author: 'You', time: 'Just now', content: imgHtml });
                            renderPosts(feedContainer);
                        };
                        reader.readAsDataURL(e.target.files[0]);
                    }
                    fileInput.value = '';
                });
            }
        }
    }

    function renderPosts(container) {
        const feed = container.querySelector('#community-feed-area');
        if(!feed) return;
        if (selectedCommunity.posts.length === 0) {
            feed.innerHTML = '<p style="text-align:center; padding:2rem; color:#9ca3af">No posts yet.</p>';
            return;
        }
        feed.innerHTML = selectedCommunity.posts.map(p => `
            <div class="post-card">
                <div class="post-header">
                    <div class="post-author-info">
                        <h3 class="post-author-name" style="font-size:1.4rem; font-weight:600; color:var(--dark-color);">${p.author}</h3>
                        <p class="post-author-meta" style="font-size:1.1rem; color:var(--text-secondary);">${p.time}</p>
                    </div>
                </div>
                <div class="post-content" style="font-size:1.4rem; line-height:1.5; color:var(--dark-color);">${p.content}</div>
            </div>
        `).join('');
    }

    // --- Create Community Modal ---
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

            createBtn.addEventListener('click', () => {
                const name = nameInput.value.trim();
                const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                const avatarHtml = `<div style="width:100%; height:100%; background-color:#8b5cf6; color:white; display:flex; align-items:center; justify-content:center; font-size:1.4rem; font-weight:bold; border-radius:inherit;">${initials}</div>`;
                const newComm = { id: Date.now().toString(), name: name, icon: avatarHtml, members: 1, description: descInput ? descInput.value.trim() : 'New community', joined: true, posts: [] };
                communities.unshift(newComm);
                if(mainPanelRef) renderCommunityList(mainPanelRef);
                closeModal();
            });
        }
    }

    // --- Search/Join Community Modal (Robust Fix) ---
    async function openSearchCommunityModal() {
        console.log("[CommunityPanel] Opening Search Modal...");
        
        // 1. Use global reusable modal container
        const modalContainer = document.getElementById('reusable-modal');
        const modalContent = document.getElementById('reusable-modal-content');
        const globalCloseBtn = modalContainer.querySelector('.js-close-modal');

        if (!modalContainer || !modalContent) {
            console.error("CRITICAL: #reusable-modal not found");
            return;
        }

        // 2. Fetch HTML
        const modalHtml = await loadHtml('search_community.html');
        if (!modalHtml) {
            console.error("CRITICAL: search_community.html failed to load");
            return;
        }

        // 3. Inject Content
        modalContent.innerHTML = modalHtml;
        
        // 4. Show Modal (Flex first to allow rendering)
        modalContainer.style.display = 'flex';
        
        // 5. Delay Logic to ensure DOM is ready before querying
        setTimeout(() => {
            modalContainer.classList.add('show');
            modalContainer.classList.add('modal-large');

            // 6. Re-query elements now that they are definitely in the DOM
            const resultsContainer = modalContent.querySelector('#community-search-results');
            const searchInput = modalContent.querySelector('#search-community-input');
            
            if (!resultsContainer || !searchInput) {
                console.error("CRITICAL: Search modal elements not found. Check IDs in search_community.html");
                return;
            }

            // 7. Close Logic
            const closeModal = () => {
                modalContainer.classList.remove('show');
                modalContainer.classList.remove('modal-large');
                setTimeout(() => {
                    modalContainer.style.display = 'none';
                    modalContent.innerHTML = '';
                }, 300);
            };

            // Re-bind close buttons
            const newCloseBtn = globalCloseBtn.cloneNode(true);
            globalCloseBtn.parentNode.replaceChild(newCloseBtn, globalCloseBtn);
            newCloseBtn.addEventListener('click', closeModal);
            
            modalContent.querySelectorAll('.js-close-search-community').forEach(btn => btn.addEventListener('click', closeModal));
            modalContainer.onclick = (e) => { if (e.target === modalContainer) closeModal(); };

            // 8. Render Logic
            const renderResults = (filter = '') => {
                let results = [];
                let titleText = "Your Communities";
                
                if (filter.trim() === '') {
                    results = communities.filter(c => c.joined);
                } else {
                    titleText = "Search Results";
                    results = allCommunities.filter(c => c.name.toLowerCase().includes(filter.toLowerCase()));
                }

                const titleEl = modalContent.querySelector('h4');
                if(titleEl) titleEl.textContent = titleText;

                if (results.length === 0) {
                    resultsContainer.innerHTML = '<div style="padding:20px; text-align:center; color:#888;">No communities found</div>';
                    return;
                }

                resultsContainer.innerHTML = results.map(comm => {
                    const existing = communities.find(c => c.id === comm.id);
                    const isJoined = existing ? existing.joined : false;
                    const btnText = isJoined ? 'Joined' : 'Join';
                    const btnClass = isJoined ? 'btn-secondary' : 'btn-primary';
                    const iconContent = comm.icon.includes('<div') ? comm.icon : comm.icon;

                    return `
                    <div class="community-result-item">
                         <div class="result-icon">${iconContent}</div>
                         <div class="result-info">
                             <span class="result-name">${comm.name}</span>
                             <span class="result-meta">${comm.members} members</span>
                         </div>
                         <button class="${btnClass} js-join-btn" data-id="${comm.id}" style="padding:0.6rem 1.2rem; border-radius:8px; font-size:1.2rem; cursor:pointer;">${btnText}</button>
                    </div>`;
                }).join('');

                resultsContainer.querySelectorAll('.js-join-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const id = btn.dataset.id;
                        const targetComm = allCommunities.find(c => c.id === id);
                        let existing = communities.find(c => c.id === id);
                        
                        if (existing) {
                            existing.joined = !existing.joined;
                        } else if (targetComm) {
                            const newEntry = { ...targetComm, joined: true, posts: [] };
                            communities.push(newEntry);
                        }
                        renderResults(searchInput.value);
                        if(mainPanelRef) renderCommunityList(mainPanelRef);
                    });
                });
            };

            renderResults();
            searchInput.addEventListener('input', (e) => renderResults(e.target.value));

        }, 50); // Small delay to ensure HTML injection is complete
    }

})(window.App = window.App || {});