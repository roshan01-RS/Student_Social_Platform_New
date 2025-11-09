document.addEventListener('DOMContentLoaded', () => {

    // --- DOM Elements ---
    const loginForm = document.getElementById('loginForm');
    const switchToSignupBtn = document.getElementById('switchToSignup');
    const forgotPasswordLink = document.getElementById('forgotPasswordLink'); // <-- ADDED
    const emailInput = document.getElementById('username'); // Matches your HTML ID
    const passwordInput = document.getElementById('password');
    const messageDiv = document.querySelector('.login-message'); 

    // --- API Endpoint ---
    // Matches your Spring Boot application.properties port (8000)
    const LOGIN_API_URL = 'http://localhost:8000/api/login';

    // --- Helper: Show Inline Messages ---
    const showMessage = (text, type = 'error') => {
        if (!messageDiv) {
            console.warn("Message div not found, falling back to alert");
            alert(text);
            return;
        }
        messageDiv.textContent = text;
        messageDiv.className = `login-message ${type}`;
    };

    const clearMessage = () => {
        if (messageDiv) {
            messageDiv.textContent = '';
            messageDiv.className = 'login-message';
        }
    };

    // --- NAVIGATION LISTENERS ---

    // 1. Switch to Signup
    if (switchToSignupBtn) {
        switchToSignupBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.parent.postMessage('navigateTo:signup', '*');
        });
    }

    // 2. Forgot Password (NEW)
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            window.parent.postMessage('navigateTo:forgot-password', '*');
        });
    }

    // --- Login Form Submission ---
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearMessage();

            // Basic validation
            if (!emailInput || !passwordInput) {
                console.error('Login inputs not found in the DOM.');
                return;
            }

            const email = emailInput.value.trim();
            const password = passwordInput.value;

            if (!email || !password) {
                showMessage('Please enter both email and password.', 'error');
                return;
            }

            const loginData = { email, password };

            // Disable button while processing
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.disabled = true;

            try {
                const response = await fetch(LOGIN_API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(loginData)
                });

                const data = await response.json();

                if (response.ok && data.status === 'success') {
                    showMessage('Login successful! Redirecting...', 'success');

                    // Store token if your backend sends one (optional for now)
                    if (data.token) localStorage.setItem('authToken', data.token);

                    // Wait a moment so the user sees the success message
                    setTimeout(() => {
                        // CRITICAL: Use window.top to break out of the iframe and load the actual app
                        window.top.location.href = 'home.html';
                    }, 1000);

                } else if (data.status === 'unverified') {
                    showMessage('Account not verified. Please check your email for OTP.', 'info');
                    // Optional: You could auto-redirect them to OTP page here if you wanted
                    // window.parent.postMessage(`MapsTo:otp:${email}`, '*');

                } else {
                    showMessage(data.message || 'Login failed. Invalid credentials.', 'error');
                }

            } catch (error) {
                console.error('Login error:', error);
                showMessage('Network error. Check if backend (8000) is running.', 'error');
            } finally {
                if (submitBtn) submitBtn.disabled = false;
            }
        });
    }
});