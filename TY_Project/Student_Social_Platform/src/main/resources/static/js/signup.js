document.addEventListener('DOMContentLoaded', () => {

    // Form elements
    const signupForm = document.getElementById('signupForm');
    const switchToLogin = document.getElementById('switchToLogin'); 

    // Input fields
    const usernameInput = document.getElementById('username');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');

    // --- API Endpoint ---
    const REGISTER_API_URL = 'http://localhost:8000/api/register';

    // --- Validation functions ---
    function validateUsername(username) {
        if (!username) return 'Username is required';
        if (!/^[a-zA-Z0-9_-]+$/.test(username))
            return 'Username can only contain letters, numbers, _ and -';
        return null;
    }

    function validateEmail(email) {
        if (!email) return 'Email is required';
        if (!email.endsWith('@gmail.com'))
            return 'Only @gmail.com addresses are allowed';
        const emailRegex = /^[a-zA-Z0-9._-]+@gmail\.com$/;
        if (!emailRegex.test(email))
            return 'Please enter a valid Gmail address';
        return null;
    }

    function validatePassword(password) {
        if (!password) return 'Password is required';
        if (password.length < 8)
            return 'Password must be at least 8 characters';
        if (!/(?=.*[a-zA-Z])(?=.*[0-9])/.test(password))
            return 'Password must contain both letters and numbers';
        return null;
    }

    // --- Password strength calculation ---
    function calculatePasswordStrength(password) {
        if (!password) return { strength: 0, label: '', className: '' };

        let strength = 0;
        if (password.length >= 8) strength += 25;
        if (password.length >= 12) strength += 15;
        if (/[a-z]/.test(password)) strength += 15;
        if (/[A-Z]/.test(password)) strength += 15;
        if (/[0-9]/.test(password)) strength += 15;
        if (/[^a-zA-Z0-9]/.test(password)) strength += 15;

        let label = '', className = '';
        if (strength < 40) { label = 'Weak'; className = 'weak'; }
        else if (strength < 60) { label = 'Fair'; className = 'fair'; }
        else if (strength < 80) { label = 'Good'; className = 'good'; }
        else { label = 'Strong'; className = 'strong'; }

        return { strength, label, className };
    }

    // --- UI Helpers ---
    function showError(input, message) {
        const formGroup = input.closest('.form-group');
        const errorMessage = formGroup.querySelector('.error-message');
        const helpText = formGroup.querySelector('.help-text');
        const successIcon = formGroup.querySelector('.success-icon');

        input.classList.add('error');
        errorMessage.textContent = message;
        errorMessage.classList.add('show');

        if (helpText) helpText.classList.remove('show');
        if (successIcon) successIcon.style.display = 'none';
    }

    function clearError(input) {
        const formGroup = input.closest('.form-group');
        const errorMessage = formGroup.querySelector('.error-message');
        input.classList.remove('error');
        if (errorMessage) errorMessage.classList.remove('show');
    }

    function showSuccess(input) {
        const formGroup = input.closest('.form-group');
        const successIcon = formGroup.querySelector('.success-icon');
        const helpText = formGroup.querySelector('.help-text');

        if (successIcon) successIcon.style.display = 'block';
        if (helpText && input.value) helpText.classList.add('show');
    }

    // --- Password Strength Meter ---
    function updatePasswordStrength(password) {
        const strengthContainer = document.querySelector('.password-strength');
        const strengthValue = document.querySelector('.strength-value');
        const strengthBar = document.querySelector('.strength-bar');

        if (!strengthContainer || !strengthValue || !strengthBar) {
            console.warn('Password strength elements are missing from the DOM.');
            return;
        }

        if (!password) {
            strengthContainer.style.display = 'none';
            return;
        }

        strengthContainer.style.display = 'block';
        const { strength, label, className } = calculatePasswordStrength(password);

        strengthValue.textContent = label;
        strengthValue.className = 'strength-value ' + className;
        strengthBar.style.width = strength + '%';
        strengthBar.className = 'strength-bar ' + className;
    }

    // --- NEW FUNCTION ADDED HERE ---
    // This function finds the hidden 'custom-notification' div in your HTML,
    // puts the message inside it, and adds the 'show' class to make it slide up.
    function showNotification(message, isError = true) {
        const notification = document.getElementById('custom-notification');
        if (notification) {
            notification.textContent = message;
            notification.className = 'notification show ' + (isError ? 'error' : 'success');
            
            // Automatically hide it after 3 seconds
            setTimeout(() => {
                notification.className = 'notification';
            }, 3000);
        } else {
            // Backup in case the HTML element is missing
            alert(message);
        }
    }

    // --- Event Listeners for Form Validation ---
    if (usernameInput) {
        usernameInput.addEventListener('blur', function() {
            const error = validateUsername(this.value);
            if (error) showError(this, error);
            else { clearError(this); showSuccess(this); }
        });

        usernameInput.addEventListener('input', function() {
            if (this.classList.contains('error')) {
                const error = validateUsername(this.value);
                if (!error) { clearError(this); showSuccess(this); }
            }
        });
    }

    if (emailInput) {
        emailInput.addEventListener('blur', function() {
            const error = validateEmail(this.value);
            if (error) showError(this, error);
            else { clearError(this); showSuccess(this); }
        });

        emailInput.addEventListener('input', function() {
            if (this.classList.contains('error')) {
                const error = validateEmail(this.value);
                if (!error) { clearError(this); showSuccess(this); }
            }
        });
    }

    if (passwordInput) {
        passwordInput.addEventListener('input', function() {
            updatePasswordStrength(this.value);
            if (this.classList.contains('error')) {
                const error = validatePassword(this.value);
                if (!error) clearError(this);
            }
        });

        passwordInput.addEventListener('blur', function() {
            const error = validatePassword(this.value);
            if (error) showError(this, error);
            else clearError(this);
        });
    }

    // --- Signup Form Submission ---
    if (signupForm) {
        signupForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const usernameError = validateUsername(usernameInput.value);
            const emailError = validateEmail(emailInput.value);
            const passwordError = validatePassword(passwordInput.value);

            let hasError = false;
            if (usernameError) { showError(usernameInput, usernameError); hasError = true; }
            if (emailError) { showError(emailInput, emailError); hasError = true; }
            if (passwordError) { showError(passwordInput, passwordError); hasError = true; }

            if (hasError) return;

            const userData = {
                username: usernameInput.value,
                email: emailInput.value,
                password: passwordInput.value
            };

            try {
                const response = await fetch(REGISTER_API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(userData)
                });

                const data = await response.json();
                console.log('✅ Response from server:', data);

                // ✅ Navigate to OTP Page on Success
                if (response.ok && (data.status === 'success' || data.success === true)) {
                    sessionStorage.setItem('signupData', JSON.stringify(userData));
                    console.log('🔹 Navigating to OTP page...');

                    // If you use iframe navigation (index.html manages page switches)
                   window.parent.postMessage(`navigateTo:otp?email=${encodeURIComponent(userData.email)}`, '*');


                    // If you are testing standalone signup.html (no iframe)
                    // window.location.href = 'otp.html';
                } else {
                    showNotification('Registration failed: ' + (data.message || JSON.stringify(data)));

                }
            } catch (error) {
                console.error('Network error:', error);
                showNotification('Network error. Check your server connection (8000).');

            }
        });

        // Switch to Login Page
        if (switchToLogin) {
            switchToLogin.addEventListener('click', (e) => {
                e.preventDefault();
                window.parent.postMessage('navigateTo:login', '*');
            });
        }
    }
});
