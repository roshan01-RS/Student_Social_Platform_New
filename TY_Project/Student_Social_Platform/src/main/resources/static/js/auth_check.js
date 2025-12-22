const API_BASE = ''; // Your backend

async function logout() {
    // *** FIX: Added credentials: 'include' to the logout fetch ***
    await fetch(`${API_BASE}/api/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include' // This tells fetch to send the cookie to be cleared
    });
    // Redirect to login page
    window.location.href = 'index.html';
}

// 1. We no longer check localStorage. We just try to fetch the profile.
// The browser will automatically send the 'authToken' cookie.
console.log("Verifying token with server...");

// *** THE MAIN FIX IS HERE ***
fetch(`${API_BASE}/api/my-profile`, {
    method: 'GET',
    credentials: 'include' // This tells fetch to send the HttpOnly cookie
})
.then(response => {
    if (!response.ok) {
        // If the cookie is missing, expired, or invalid, the server will
        // send a 401. We kick the user out.
        console.error('Authentication failed. Redirecting to login.');
        window.location.href = 'index.html';
        throw new Error('Invalid token');
    }
    return response.json();
})
.then(userData => {
    // 2. SUCCESS!
    // The server verified the token cookie and sent back this user's data.
    console.log(`Welcome, ${userData.username}!`);
    
    document.addEventListener('DOMContentLoaded', () => {
        const welcomeMsg = document.getElementById('welcome-message');
        const emailDisplay = document.getElementById('user-email-display');
        const schoolDisplay = document.getElementById('user-school-display');
        const logoutBtn = document.getElementById('logout-button');

        if (welcomeMsg) welcomeMsg.textContent = `Welcome, ${userData.username}!`;
        if (emailDisplay) emailDisplay.textContent = `Email: ${userData.email}`;
        if (schoolDisplay && userData.schoolName) {
            schoolDisplay.textContent = `School: ${userData.schoolName}`;
        }
        if (logoutBtn) logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    });
})
.catch(error => {
    // 3. FAILURE
    // This catches network errors or the "Invalid token" error
    console.error('Authentication check failed:', error.message);
    if (window.location.pathname !== '/index.html') {
        window.location.href = 'index.html';
    }
});
