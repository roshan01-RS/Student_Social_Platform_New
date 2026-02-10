// --- Global State Variable ---
// A flag to track if the feed socket has been started
let isFeedSocketReady = false;

// --- One-Time Initialization Function ---
// This function ensures sockets are only set up once
function setupFeedSocketOnce() {
    // If it is already ready, stop here
    if (isFeedSocketReady) return;
    
    // Mark it as ready now
    isFeedSocketReady = true;

    // Check if the global App object and renderHome exist
    if (window.App && App.renderHome) {
        // The socket logic is handled inside PostFeed.js
    }
}

// --- Main Program Start ---
// Wait for the HTML page to fully load before running code
document.addEventListener('DOMContentLoaded', () => {

    // --- 1. Loading Screen Logic ---
    // Get the loading overlay element
    const loadingScreen = document.getElementById('loader-overlay');
    // Get the main application container
    const mainAppContainer = document.getElementById('app-wrapper');

    // Wait for 2 seconds (2000ms) before showing the app
    setTimeout(() => {
        // Hide the loading screen
        if (loadingScreen) loadingScreen.style.display = 'none';
        // Add the 'loaded' class to fade in the app
        if (mainAppContainer) mainAppContainer.classList.add('loaded'); 
    }, 2000); 

    // --- 2. Sidebar Toggle Logic ---
    // Get the button that opens/closes the sidebar
    const sidebarToggleBtn = document.getElementById('sidebar-toggle-bar');

    // If the button exists in the HTML
    if (sidebarToggleBtn) {
        // Listen for a click event on the button
        sidebarToggleBtn.addEventListener('click', () => {
            // Toggle the 'sidebar-collapsed' class on the container
            // This CSS class handles the hiding/showing animation
            mainAppContainer.classList.toggle('sidebar-collapsed');
        });
    }

    // --- 3. Navigation Elements Setup ---
    // Select all navigation buttons (desktop and mobile)
    const navigationButtons = document.querySelectorAll('.nav-item, .mobile-nav-item');
    // Select all the different page sections (views)
    const contentPages = document.querySelectorAll('.view-section');
    // Get the main title element in the header
    const pageHeaderTitle = document.getElementById('main-view-title');
    // Get the subtitle element in the header
    const pageHeaderSubtitle = document.getElementById('main-view-subtitle');

    // --- 4. Access Control State Variables ---
    // Track if the user is restricted (locked out)
    let isUserRestricted = false; 
    // Store the current verification status (default is UNKNOWN)
    let verificationState = 'UNKNOWN'; 
    // Store a reference to the warning notification bar
    let warningBarElement = null;

    // --- 5. WebSocket (Realtime) State Variables ---
    // Store the WebSocket client object
    let socketClient = null;
    // Track if the socket is currently connected
    let isSocketConnected = false;
    // Store the timer for reconnecting if connection fails
    let socketReconnectTimer = null;

    // --- 6. Page Data Configuration ---
    // Define titles and subtitles for every page view
    const pageInfoMap = {
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

    // --- 7. Realtime Connection Function ---
    // connects to the server to listen for status updates
    function initializeRealtimeConnection() {
        // If already connected, do nothing
        if (isSocketConnected) return;
        // If necessary libraries are missing, stop
        if (!window.SockJS || !window.Stomp) return;

        // Clean up any existing connection first
        if (socketClient) {
            try { socketClient.disconnect(); } catch (e) {}
            socketClient = null;
        }

        // Create a new connection to the '/ws' endpoint
        const socket = new SockJS('/ws');
        // Wrap the socket with Stomp protocol
        socketClient = Stomp.over(socket);
        // Disable debug logs in the console
        socketClient.debug = () => {}; 

        // Attempt to connect to the server
        socketClient.connect({}, () => {
            // Mark as connected
            isSocketConnected = true;
            // Clear any pending reconnect timers
            if(socketReconnectTimer) clearTimeout(socketReconnectTimer);

            // Subscribe to the specific user's profile queue
            socketClient.subscribe('/user/queue/profile', message => {
                try {
                    // Parse the incoming JSON message
                    const eventData = JSON.parse(message.body);
                    // Get the actual data payload
                    const payload = eventData.payload || eventData;
                    
                    // If the payload has a verification status
                    if (payload && payload.verificationStatus) {
                        // Update the app state with the new status
                        updateVerificationState(payload.verificationStatus.toUpperCase());
                    }
                } catch (error) {
                    // Log a warning if the message is bad
                    console.warn('Invalid WS payload', error);
                }
            });
        }, (error) => {
            // If connection fails or drops
            console.log('WS Disconnected. Reconnecting...', error);
            // Mark as disconnected
            isSocketConnected = false;
            // Clear old timer
            if (socketReconnectTimer) clearTimeout(socketReconnectTimer);
            // Try to connect again in 5 seconds
            socketReconnectTimer = setTimeout(initializeRealtimeConnection, 5000);
        });
    }

    // --- 8. State Manager Function ---
    // This updates the status and triggers UI changes
    function updateVerificationState(newStatus) {
        // If the status hasn't changed, do nothing
        if (newStatus === verificationState) return;

        // Log the change for debugging
        console.log(`[State Update] Verification: ${verificationState} -> ${newStatus}`);
        // Update the global variable
        verificationState = newStatus;

        // Broadcast this event to other scripts (like DocumentVerification.js)
        document.dispatchEvent(new CustomEvent('verification-status-updated', {
            detail: { status: newStatus }
        }));

        // Check if we should lock or unlock the UI
        if (newStatus === 'VERIFIED') {
            unlockUserAccess();
        } else {
            lockUserAccess();
        }
    }

    // --- 9. Navigation Handler Function ---
    // This function switches between different pages
    window.handleNavigation = (targetViewName) => {
        // Security Check: If restricted, force them to profile or settings only
        if (isUserRestricted && targetViewName !== 'profile' && targetViewName !== 'settings') {
            console.warn("Access restricted. Redirecting to profile.");
            targetViewName = 'profile';
        }

        // Loop through all pages and hide them
        contentPages.forEach(page => {
            page.style.display = 'none';
            page.classList.remove('active-view'); 
        });

        // Find the specific page we want to show
        const activePage = document.getElementById(`view-${targetViewName}`);
        
        // If the page exists, show it
        if (activePage) {
            activePage.style.display = 'flex'; 
            activePage.classList.add('active-view'); 
        } else {
            // Fallback: If page doesn't exist, show profile or home
            const fallbackViewId = isUserRestricted ? 'view-profile' : 'view-home';
            const fallbackPage = document.getElementById(fallbackViewId);
            if (fallbackPage) {
                fallbackPage.style.display = 'flex';
                fallbackPage.classList.add('active-view');
            }
        }

        // Update the navigation buttons (highlight the active one)
        navigationButtons.forEach(button => {
            let viewToHighlight = targetViewName;
            
            // Map sub-pages to their main parent for highlighting
            if (targetViewName === 'edit-profile') viewToHighlight = 'profile'; 
            else if (targetViewName === 'post-details') viewToHighlight = 'home'; 

            // Add 'active-nav' class if it matches, ignore theme switch
            if (button.dataset.view === viewToHighlight && !button.classList.contains('theme-switch-wrapper')) {
                button.classList.add('active-nav');
            } else {
                button.classList.remove('active-nav');
            }
        });

        // Update Header Title and Subtitle based on the map
        const headerData = pageInfoMap[targetViewName] || { title: 'Dashboard', subtitle: 'Welcome' };
        if (pageHeaderTitle) pageHeaderTitle.textContent = headerData.title;
        if (pageHeaderSubtitle) pageHeaderSubtitle.textContent = headerData.subtitle;

        // Load the actual content (except for post details which loads differently)
        if (targetViewName !== 'post-details') {
            renderPageContent(targetViewName);
        }
    };

    // --- 10. Click Listeners for Navigation ---
    // Attach click events to all sidebar buttons
    navigationButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            event.preventDefault(); // Stop default link behavior
            
            // Ignore clicks on the theme toggle wrapper
            if (button.classList.contains('theme-switch-wrapper')) return;
            
            // Get the view name from the data-view attribute
            const viewName = button.dataset.view;
            
            // Re-check restriction before allowing navigation
            if (isUserRestricted && viewName !== 'profile' && viewName !== 'settings') {
                return;
            }
            
            // Go to the view if it exists
            if (viewName) {
                handleNavigation(viewName);
            }
        });
    });

    // --- 11. Page Content Renderer ---
    // Calls specific render functions based on the view name
    async function renderPageContent(viewName) {
        // Find the container for this view
        const viewContainer = document.getElementById(`view-${viewName}`);
        if (!viewContainer) return;

        // Find the specific panel inside where content goes
        const contentArea = viewContainer.querySelector('.content-panel');
        if (!contentArea) return;

        // Show a loading spinner initially
        window.App.renderSpinner(contentArea);
        
        try {
            // Switch statement to call the correct App function
            switch (viewName) {
                case 'home':
                    if(window.App.renderHome) await window.App.renderHome(contentArea);
                    break;
                case 'profile':
                    if(window.App.renderProfile) await window.App.renderProfile(contentArea);
                    break;
                case 'edit-profile': 
                    if(window.App.renderEditProfile) await window.App.renderEditProfile(contentArea);
                    break;
                case 'messages':
                    if(window.App.renderMessages) await window.App.renderMessages(contentArea);
                    break;
                case 'groups':
                    if(window.App.renderGroups) window.App.renderGroups(contentArea);
                    break;
                case 'community':
                    if(window.App.renderCommunity) window.App.renderCommunity(contentArea);
                    break;
                case 'notifications':
                    if(window.App.renderNotifications) window.App.renderNotifications(contentArea);
                    break;
                case 'settings':
                    if(window.App.renderSettings) window.App.renderSettings(contentArea);
                    break;
                default:
                    // If no function matches, log warning
                    console.warn("No renderer found for " + viewName);
                    contentArea.innerHTML = "<p>Page not found</p>";
            }
        } catch (error) {
            // Handle any crashes during rendering
            console.error(`Error loading ${viewName}:`, error);
            contentArea.innerHTML = `<p class="text-secondary" style="text-align: center;">Failed to load content.</p>`;
        }
    }

    // --- 12. Theme (Dark/Light Mode) Logic ---
    // Get all checkboxes that control the theme
    const darkModeToggles = document.querySelectorAll('.theme-toggle-checkbox');

    // Helper function to apply the theme to the body
    const applyTheme = (themeName) => {
        if (themeName === 'dark') {
            document.body.classList.add('dark-mode');
            // Ensure all checkboxes reflect the state
            darkModeToggles.forEach(cb => cb.checked = true);
        } else {
            document.body.classList.remove('dark-mode');
            darkModeToggles.forEach(cb => cb.checked = false);
        }
    };

    // Logic to switch between themes
    const toggleTheme = () => {
        // Check current state
        const currentTheme = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
        
        if (currentTheme === 'dark') {
            // Switch to light
            localStorage.setItem('theme', 'light');
            applyTheme('light');
        } else {
            // Switch to dark
            localStorage.setItem('theme', 'dark');
            applyTheme('dark');
        }
    };

    // Load saved theme from browser storage on startup
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        applyTheme(savedTheme);
    }

    // Add change listeners to the actual checkboxes
    darkModeToggles.forEach(cb => {
        cb.addEventListener('change', toggleTheme);
    });

    // Add click listeners to the wrapper divs for better UX
    document.querySelectorAll('.theme-switch-wrapper').forEach(wrapper => {
        wrapper.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            // Find the checkbox inside the wrapper
            const checkbox = wrapper.querySelector('input[type="checkbox"]');
            if (checkbox) {
                // Manually toggle check state
                checkbox.checked = !checkbox.checked;
                // Run theme logic
                toggleTheme();
            }
        });
    });

    // --- 13. Access Control UI Helpers ---
    
    // Shows a yellow warning bar at the top of the screen
    function showRestrictedAccessBar() {
        // If bar already exists, don't create another
        if (warningBarElement) return;

        // Create the div element
        warningBarElement = document.createElement('div');
        warningBarElement.id = 'verification-warning-bar';
        // Set the HTML content (icon + text)
        warningBarElement.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; gap: 1rem;">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span>Access Restricted: Please verify your documents to access full features.</span>
            </div>
        `;
        // Apply styling directly
        warningBarElement.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; 
            background-color: #eab308; color: #422006; 
            text-align: center; padding: 0.8rem; z-index: 100000; 
            font-weight: 600; font-size: 1.4rem; box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        `;

        // Add to the document body
        document.body.appendChild(warningBarElement);
        // Push body content down so it isn't hidden
        document.body.style.paddingTop = '3.5rem'; 
        // Push navbar down if it exists
        const navbar = document.querySelector('.navbar');
        if(navbar) navbar.style.top = '3.5rem';
    }

    // Removes the yellow warning bar
    function removeRestrictedAccessBar() {
        if (warningBarElement) {
            // Remove from DOM
            warningBarElement.remove();
            // Reset variable
            warningBarElement = null;
            // Reset body padding
            document.body.style.paddingTop = '';
            // Reset navbar position
            const navbar = document.querySelector('.navbar');
            if(navbar) navbar.style.top = '0';
        }
    }

    // --- 14. Access State Actions ---

    // Called when user is VERIFIED
    function unlockUserAccess() {
        // If not currently restricted, we don't need to do anything
        if (!isUserRestricted) return; 

        // Update state
        isUserRestricted = false;
        // Remove CSS class
        document.body.classList.remove('access-restricted');
        
        // Enable all navigation items
        navigationButtons.forEach(item => item.classList.remove('nav-disabled'));
        // Hide the warning bar
        removeRestrictedAccessBar();
        
        // Show a success message
        if(window.App.showGlobalNotification) {
            window.App.showGlobalNotification("Documents Verified! Full access granted.", "success");
        }
        
        // Refresh the profile panel to show new status
        const profilePanel = document.querySelector('#view-profile .content-panel');
        if(window.App.renderProfile && profilePanel && profilePanel.offsetParent) {
             window.App.renderProfile(profilePanel);
        }
        
        // Redirect to home page
        handleNavigation('home');
    }

    // Called when user is NOT verified
    function lockUserAccess() {
        // If already restricted, do nothing
        if (isUserRestricted) return; 

        // Update state
        isUserRestricted = true;
        // Add CSS class
        document.body.classList.add('access-restricted');
        // Show the warning bar
        showRestrictedAccessBar();

        // List of pages to block
        const restrictedViews = ['home', 'messages', 'groups', 'community', 'notifications'];
        
        // Visually disable navigation buttons
        navigationButtons.forEach(item => {
            if (restrictedViews.includes(item.dataset.view)) {
                item.classList.add('nav-disabled');
            }
        });
        
        // Check which view is currently open
        const currentView = document.querySelector('.view-section.active-view');
        if (currentView) {
            // Get view ID string
            const viewId = currentView.id.replace('view-', '');
            // If current view is restricted, boot user to profile
            if (restrictedViews.includes(viewId)) {
                handleNavigation('profile');
            }
        } else {
             // Default to profile if nothing open
             handleNavigation('profile');
        }
    }

    // --- 15. Initial Data Fetch ---
    // Checks backend for current verification status on load
    async function fetchInitialStatus() {
        try {
            // Call API endpoint
            const response = await fetch('/api/my-profile', { credentials: 'include' });
            if (response.ok) {
                // Parse JSON data
                const userData = await response.json();
                // Extract status safely
                const status = (userData.verificationStatus || 'NONE').toUpperCase();
                // Update the app state
                updateVerificationState(status);
                
                // Decide which page to show initially
                if (status === 'VERIFIED') {
                      if (!document.querySelector('.active-view')) handleNavigation('home');
                } else {
                      if (!document.querySelector('.active-view')) handleNavigation('profile');
                }
            }
        } catch (error) {
            // Log error if fetch fails
            console.error("Access check failed", error);
        }
    }

    // --- 16. Execution Start ---
    // Run socket setup logic
    setupFeedSocketOnce();
    // Small delay to ensure other scripts are ready
    setTimeout(() => {
        initializeRealtimeConnection();
        fetchInitialStatus();
    }, 500); 
});