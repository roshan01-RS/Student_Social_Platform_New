// AdminLogin.js
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('admin-login-form');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const submitBtn = document.getElementById('submit-btn');
    const errorMsg = document.getElementById('error-message');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Reset UI
        errorMsg.style.display = 'none';
        submitBtn.disabled = true;
        submitBtn.textContent = 'Verifying...';
        
        const credentials = {
            identifier: usernameInput.value.trim(),
            password: passwordInput.value
        };

        try {
            const response = await fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(credentials)
            });

            const data = await response.json();

            if (response.ok && data.status === 'success') {
                // Success - Redirect
                window.location.href = 'admin_panel.html';
            } else {
                // Error
                errorMsg.textContent = data.message || 'Access Denied';
                errorMsg.style.display = 'block';
                submitBtn.disabled = false;
                submitBtn.textContent = 'Secure Login';
            }

        } catch (err) {
            console.error(err);
            errorMsg.textContent = 'Connection failed. Check server.';
            errorMsg.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.textContent = 'Secure Login';
        }
    });
});