// This file is 'auth_check.js' and should be in your home.html
const token = localStorage.getItem('authToken');

if (!token) {
    // 1. NO TOKEN = NOT LOGGED IN
    // They are immediately kicked back to the login page.
    window.location.href = 'index.html'; 
} else {
    // 2. A TOKEN EXISTS!
    // The user is authenticated. We can now use this token to
    // securely ask the server for *this specific user's* data.
    
    // Example: Function to get the user's own profile
    function getMyProfile() {
        fetch('http://localhost:8000/api/my-profile', {
            method: 'GET',
            headers: {
                // This header is the "ID card" we show the bouncer
                'Authorization': 'Bearer ' + token
            }
        })
        .then(response => {
            if (!response.ok) {
                // If the token is fake or expired, the server will send a 401/403
                throw new Error('Invalid token');
            }
            return response.json();
        })
        .then(userData => {
            // The server found the user based on the token and sent back their info
            console.log("Welcome,", userData.username);
            // Example: document.getElementById('welcome-message').textContent = `Welcome, ${userData.username}`;
        })
        .catch(error => {
            // Token was bad, kick them out
            console.error('Auth check failed:', error);
            localStorage.removeItem('authToken'); // Remove the bad token
            window.location.href = 'index.html';
        });
    }

    // Run the function when the page loads
    getMyProfile();
}