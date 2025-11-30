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
        console.warn(`View not found: ${viewName}`);
        document.getElementById('view-home').style.display = 'flex';
        document.getElementById('view-home').classList.add('active-view');
    }

    // 3. Update Sidebar Highlights
    allNavItems.forEach(item => {
        let activeView = viewName;
        if (viewName === 'edit-profile') {
            activeView = 'profile'; 
        } else if (viewName === 'post-details') {
            activeView = 'home'; 
        }

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
}

allNavItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault(); 
        if (item.classList.contains('theme-switch-wrapper')) {
            return;
        }
        const viewName = item.dataset.view;
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

    if (viewSection.classList.contains('data-loaded')) {
         return;
    }
    
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

// --- Initial Setup ---
setTimeout(() => {
    handleNavigation('home');
}, 2000); 
});
