// This is the entire file: auth_check.js

// 1. Get the "ID Card" (token) from browser storage
const token = localStorage.getItem('authToken');

if (!token) {
    // 2. IF NO TOKEN:
    // The user is not logged in. Kick them out immediately
    // before the page even tries to load.
    console.log("No token found. Redirecting to login.");
    window.location.href = 'index.html'; 
} else {
    // 3. IF A TOKEN EXISTS:
    // The user *might* be logged in. We must verify the token
    // with the server to get *this user's* specific data.
    
    // We send a request to the backend, *with the token*.
    // (You will need to create this "/api/my-profile" endpoint in Java)
    fetch('http://localhost:8000/api/my-profile', {
        method: 'GET',
        headers: {
            // This header is the "ID Card" we show the server
            'Authorization': 'Bearer ' + token
        }
    })
    .then(response => {
        if (!response.ok) {
            // If the token is fake, expired, or invalid, the server will
            // send a 401 or 403. We kick the user out.
            console.error('Invalid token. Redirecting to login.');
            localStorage.removeItem('authToken'); // Remove the bad token
            window.location.href = 'index.html';
            throw new Error('Invalid token');
        }
        return response.json();
    })
    .then(userData => {
        // 4. SUCCESS!
        // The server verified the token and sent back *only* this user's data.
        // The user is now securely on their own page.
        console.log(`Welcome, ${userData.username}!`);
        
        // Now you can use the data. (This part can be in home.js)
        // For example:
        // const welcomeMsg = document.getElementById('welcome-message');
        // if (welcomeMsg) {
        //     welcomeMsg.textContent = `Welcome, ${userData.username}`;
        // }
    })
    .catch(error => {
        // This catches network errors or the "Invalid token" error
        console.error('Authentication check failed:', error);
        localStorage.removeItem('authToken');
        window.location.href = 'index.html';
    });
}