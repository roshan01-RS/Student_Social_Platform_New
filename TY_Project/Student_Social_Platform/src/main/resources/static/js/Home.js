document.addEventListener('DOMContentLoaded', () => {
    // --- Loader Logic ---
    const loader = document.getElementById('loader-overlay');
    const app = document.getElementById('app-wrapper');

    setTimeout(() => {
        if(loader) loader.style.display = 'none';
        if(app) app.classList.add('loaded'); 
    }, 2000); 

    // --- Sidebar Collapse Logic ---
    const appWrapper = document.getElementById('app-wrapper');
    const toggleButton = document.getElementById('sidebar-toggle-bar');

    if (toggleButton) {
        toggleButton.addEventListener('click', () => {
            appWrapper.classList.toggle('sidebar-collapsed');
        });
    }

    // --- Navigation Logic ---
    const allNavItems = document.querySelectorAll('.nav-item, .mobile-nav-item');
    const allViewSections = document.querySelectorAll('.view-section');
    const mainViewTitle = document.getElementById('main-view-title');
    const mainViewSubtitle = document.getElementById('main-view-subtitle');

    // Access Control State
    let isAccessRestricted = false;
    let verificationNotificationBar = null;

    const viewHeaders = {
        'home': { title: 'Home Feed', subtitle: "What's happening today" },
        'messages': { title: 'Messages', subtitle: 'Your recent conversations' },
        'groups': { title: 'Groups', subtitle: 'Your student groups' },
        'community': { title: 'Community', subtitle: 'Explore communities' },
        'profile': { title: 'Profile', subtitle: 'Manage your account and profile' },
        'edit-profile': { title: 'Edit Profile', subtitle: 'Update your details' },
        'post-details': { title: 'Post', subtitle: 'Viewing thread' }, 
        'notifications': { title: 'Notifications', subtitle: 'Your recent alerts' },
        'settings': { title: 'Settings', subtitle: 'Manage your account' }
    };

    window.handleNavigation = (viewName) => {
        // Enforce Restriction
        // Only allow 'profile' and 'settings' if restricted
        if (isAccessRestricted && viewName !== 'profile' && viewName !== 'settings') {
            console.warn("Access restricted. Redirecting to profile.");
            viewName = 'profile';
        }

        // 1. Hide all sections and remove active class
        allViewSections.forEach(section => {
            section.style.display = 'none';
            section.classList.remove('active-view'); 
        });

        // 2. Show active section
        const activeSection = document.getElementById(`view-${viewName}`);
        if (activeSection) {
            activeSection.style.display = 'flex'; 
            activeSection.classList.add('active-view'); 
        } else {
            // Fallback if view not found
            // If restricted, fallback to profile, else home
            const fallback = isAccessRestricted ? 'view-profile' : 'view-home';
            const fallbackSection = document.getElementById(fallback);
            if (fallbackSection) {
                fallbackSection.style.display = 'flex';
                fallbackSection.classList.add('active-view');
            }
        }

        // 3. Update Sidebar Highlights
        allNavItems.forEach(item => {
            let activeView = viewName;
            if (viewName === 'edit-profile') activeView = 'profile'; 
            else if (viewName === 'post-details') activeView = 'home'; 

            if (item.dataset.view === activeView && !item.classList.contains('theme-switch-wrapper')) {
                item.classList.add('active-nav');
            } else {
                item.classList.remove('active-nav');
            }
        });

        // 4. Update Header Text
        const headerInfo = viewHeaders[viewName] || { title: 'Dashboard', subtitle: 'Welcome' };
        if (mainViewTitle) mainViewTitle.textContent = headerInfo.title;
        if (mainViewSubtitle) mainViewSubtitle.textContent = headerInfo.subtitle;

        // 5. Load Content
        if (viewName !== 'post-details') {
            loadViewContent(viewName);
        }
    };

    allNavItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault(); 
            if (item.classList.contains('theme-switch-wrapper')) return;
            
            const viewName = item.dataset.view;
            
            // Prevent click if restricted (extra safety layer)
            if (isAccessRestricted && viewName !== 'profile' && viewName !== 'settings') {
                return;
            }
            
            if (viewName) {
                handleNavigation(viewName);
            }
        });
    });

    // --- AJAX Content Loading ---
    async function loadViewContent(viewName) {
        const viewSection = document.getElementById(`view-${viewName}`);
        if (!viewSection) return;

        const contentPanel = viewSection.querySelector('.content-panel');
        if (!contentPanel) return;

        // NOTE: We remove this line so modules like ProfilePanel are always reloaded
        // if they rely on fresh data or state checks.
        // if (viewSection.classList.contains('data-loaded')) return;
        
        window.App.renderSpinner(contentPanel);
        
        try {
            switch (viewName) {
                case 'home':
                    if(window.App.renderHome) await window.App.renderHome(contentPanel);
                    break;
                case 'profile':
                    if(window.App.renderProfile) await window.App.renderProfile(contentPanel);
                    break;
                case 'edit-profile': 
                    if(window.App.renderEditProfile) await window.App.renderEditProfile(contentPanel);
                    break;
                case 'messages':
                    if(window.App.renderMessages) await window.App.renderMessages(contentPanel);
                    break;
                case 'groups':
                    if(window.App.renderGroups) window.App.renderGroups(contentPanel);
                    break;
                case 'community':
                    if(window.App.renderCommunity) window.App.renderCommunity(contentPanel);
                    break;
                case 'notifications':
                    if(window.App.renderNotifications) window.App.renderNotifications(contentPanel);
                    break;
                case 'settings':
                    if(window.App.renderSettings) window.App.renderSettings(contentPanel);
                    break;
                default:
                    console.warn("No renderer found for " + viewName);
                    contentPanel.innerHTML = "<p>Page not found</p>";
            }
            viewSection.classList.add('data-loaded');
        } catch (error) {
            console.error(`Error loading ${viewName}:`, error);
            contentPanel.innerHTML = `<p class="text-secondary" style="text-align: center;">Failed to load content.</p>`;
        }
    }

    // --- Dark Mode Logic ---
    const themeCheckboxes = document.querySelectorAll('.theme-toggle-checkbox');
    const applyTheme = (theme) => {
        if (theme === 'dark') {
            document.body.classList.add('dark-mode');
            themeCheckboxes.forEach(cb => cb.checked = true);
        } else {
            document.body.classList.remove('dark-mode');
            themeCheckboxes.forEach(cb => cb.checked = false);
        }
    };

    const toggleTheme = () => {
        const currentTheme = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
        if (currentTheme === 'dark') {
            localStorage.setItem('theme', 'light');
            applyTheme('light');
        } else {
            localStorage.setItem('theme', 'dark');
            applyTheme('dark');
        }
    };

    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        applyTheme(savedTheme);
    }

    themeCheckboxes.forEach(cb => {
        cb.addEventListener('change', toggleTheme);
    });

    document.querySelectorAll('.theme-switch-wrapper').forEach(wrapper => {
        wrapper.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const checkbox = wrapper.querySelector('input[type="checkbox"]');
            if (checkbox) {
                checkbox.checked = !checkbox.checked;
                toggleTheme();
            }
        });
    });

    // --- Verification & Access Control ---

    function showRestrictedAccessBar() {
        if (verificationNotificationBar) return;

        verificationNotificationBar = document.createElement('div');
        verificationNotificationBar.id = 'verification-warning-bar';
        verificationNotificationBar.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; gap: 1rem;">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span>Access Restricted: Please verify your documents to access full features.</span>
            </div>
        `;
        // Styling for fixed header bar (inlined for reliability)
        verificationNotificationBar.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; 
            background-color: #eab308; color: #422006; 
            text-align: center; padding: 0.8rem; z-index: 100000; 
            font-weight: 600; font-size: 1.4rem; box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        `;

        document.body.appendChild(verificationNotificationBar);
        
        // Push body down slightly if needed
        document.body.style.paddingTop = '3.5rem'; 
        const navbar = document.querySelector('.navbar');
        if(navbar) navbar.style.top = '3.5rem';
    }

    function removeRestrictedAccessBar() {
        if (verificationNotificationBar) {
            verificationNotificationBar.remove();
            verificationNotificationBar = null;
            document.body.style.paddingTop = '';
            const navbar = document.querySelector('.navbar');
            if(navbar) navbar.style.top = '0';
        }
    }

    // Listen for real-time verification event (dispatched from DocumentVerification.js)
    document.addEventListener('profile-verified', () => {
        console.log("Profile Verified Event Received! Unlocking access...");
        isAccessRestricted = false;
        document.body.classList.remove('access-restricted');
        
        // Unlock all nav items
        allNavItems.forEach(item => item.classList.remove('nav-disabled'));
        
        removeRestrictedAccessBar();
        
        if(window.App.showGlobalNotification) {
            window.App.showGlobalNotification("Documents Verified! Full access granted.", "success");
        }
        
        // Force re-render of profile to update card, then user can navigate freely
        const panel = document.querySelector('#view-profile .content-panel');
        if(window.App.renderProfile && panel) {
             window.App.renderProfile(panel);
        }
    });

    async function checkAccessAndInit() {
        try {
            const res = await fetch('/api/my-profile', { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                const status = data.verificationStatus ? data.verificationStatus.toUpperCase() : 'NONE';
                
                if (status !== 'VERIFIED') {
                    isAccessRestricted = true;
                    document.body.classList.add('access-restricted');
                    
                    const restrictedViews = ['home', 'messages', 'groups', 'community', 'notifications'];
                    allNavItems.forEach(item => {
                        if (restrictedViews.includes(item.dataset.view)) {
                            item.classList.add('nav-disabled');
                        }
                    });

                    showRestrictedAccessBar();
                    handleNavigation('profile');
                } else {
                    isAccessRestricted = false;
                    document.body.classList.remove('access-restricted');
                    handleNavigation('home');
                }
            }
        } catch (e) {
            console.error("Access check failed", e);
        }
    }

    // Run check after a short delay
    setTimeout(() => {
        checkAccessAndInit();
    }, 500); 
});