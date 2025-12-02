// --- NEW PRELOADER LOGIC ---
document.addEventListener('DOMContentLoaded', () => {
    const preloader = document.getElementById('preloader');
    if (preloader) {
        preloader.classList.add('fade-out');
    }
    document.body.classList.add('loaded');
});

// This event waits for ALL assets (images, colleges.js) to be loaded.
window.addEventListener('load', () => {
    initializeLandingPage(); 
});

function initializeLandingPage() {
    console.log("✅ landing_page.js initialized");

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service_work.js') 
        .then(registration => {
          console.log('ServiceWorker registration successful with scope: ', registration.scope);
        })
        .catch(error => {
          console.log('ServiceWorker registration failed: ', error);
        });
    }

    // =========================================
    // 1. GLOBAL CONFIG & STATE
    // =========================================
    const API_BASE = 'http://localhost:8000';
    const SCHOOL_API_URL = 'http://universities.hipolabs.com/search?'; 
    
    const ENDPOINTS = {
        LOGIN: `${API_BASE}/api/login`,
        LOGOUT: `${API_BASE}/api/logout`,
        REGISTER: `${API_BASE}/api/register`,
        VERIFY: `${API_BASE}/api/verify`,
        RESEND_OTP: `${API_BASE}/api/resend-otp`,
        FORGOT_PASSWORD: `${API_BASE}/api/forgot-password/initiate`,
        VERIFY_RESET_OTP: `${API_BASE}/api/forgot-password/verify`,
        RESET_PASSWORD: `${API_BASE}/api/forgot-password/reset`,
        CHECK_USER: `${API_BASE}/api/check-user` 
    };

    let pendingEmail = localStorage.getItem('pendingEmail') || '';
    let otpContext = 'signup';
    
    let selectedSchoolDomain = null;
    let isSchoolSelected = false; 

    // =========================================
    // 2. CENTRAL MODAL MANAGEMENT
    // =========================================
    const modals = {
        login: document.getElementById("loginModal"),
        signup: document.getElementById("signupModal"),
        otp: document.getElementById("otpModal"),
        forgot: document.getElementById("forgotPasswordModal"),
        reset: document.getElementById("resetPasswordModal")
    };

    const body = document.body;

    function closeAllModals() {
        Object.values(modals).forEach(modal => {
            if (modal && modal.style.display !== 'none') {
                modal.classList.remove('show');
                setTimeout(() => {
                    if (!modal.classList.contains('show')) {
                        modal.style.display = 'none';
                    }
                }, 300);
            }
        });
        body.classList.remove("no-scroll");
    }

    function openModal(modalName) {
        const targetModal = modals[modalName];
        if (!targetModal) return;

        if (modalName === 'signup') {
            document.getElementById('signupStep1').style.display = 'block';
            document.getElementById('signupStep2').style.display = 'none';
        }

        Object.values(modals).forEach(m => {
            if (m && m !== targetModal) {
                m.classList.remove('show');
                m.style.display = 'none';
            }
        });

        targetModal.style.display = 'flex';
        void targetModal.offsetWidth;
        targetModal.classList.add('show');
        body.classList.add("no-scroll");

        if (modalName === 'otp') initializeOtpModal();
    }

    // =========================================
    // 3. UNIFIED EVENT LISTENER
    // =========================================
    document.addEventListener('click', (e) => {
        const target = e.target;

        if (target.closest('.js-open-login')) { e.preventDefault(); openModal('login'); }
        else if (target.closest('.js-open-signup')) { e.preventDefault(); otpContext = 'signup'; openModal('signup'); }
        else if (target.closest('.js-open-forgot')) { e.preventDefault(); otpContext = 'reset'; openModal('forgot'); }
        else if (target.closest('.js-close-modal') || target.classList.contains('auth-modal-backdrop')) {
            e.preventDefault();
            closeAllModals();
        }
        else if (target.closest('.js-toggle-password')) {
            e.preventDefault();
            const icon = target.closest('.js-toggle-password');
            const input = icon.closest('.input-wrapper')?.querySelector('input');
            
            if (input) {
                if (input.type === "password") {
                    input.type = "text";
                    icon.classList.add('is-visible'); 
                    icon.alt = "Hide password";
                } else {
                    input.type = "password";
                    icon.classList.remove('is-visible'); 
                    icon.alt = "Show password";
                }
            }
        }
        else if (target.closest('.js-clear-school')) {
            e.preventDefault();
            clearSchoolSelection();
        }
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeAllModals();
    });

    // =========================================
    // 4. NOTIFICATION SYSTEM
    // =========================================
    const notificationContainer = document.getElementById('notification-container');

    function showGlobalNotification(message, type = 'success') {
        if (!notificationContainer) return;
        const note = document.createElement('div');
        note.className = `notification-box ${type}`;
        note.textContent = message;
        notificationContainer.appendChild(note);
        
        setTimeout(() => {
            note.classList.add('show');
        }, 10);
        
        setTimeout(() => {
            note.classList.remove('show');
            setTimeout(() => note.remove(), 3000);
        }, 3000);
    }

    // =========================================
    // 5. FORM HELPERS
    // =========================================
    const setInputError = (input, msg) => {
        if (!input) return;
        const group = input.closest('.form-group');
        const errorDisplay = group?.querySelector('.error-message');
        if (errorDisplay) {
            errorDisplay.textContent = msg;
            errorDisplay.classList.add('show');
        }
        input.classList.add('error');
    };
    const clearInputError = (input) => {
        if (!input) return;
        const group = input.closest('.form-group');
        const errorDisplay = group?.querySelector('.error-message');
        if (errorDisplay) errorDisplay.classList.remove('show');
        input.classList.remove('error');
    };

    const updatePasswordStrength = (password) => {
        const container = document.querySelector('#signupModal .password-strength');
        const bar = container?.querySelector('.strength-bar');
        const val = container?.querySelector('.strength-value');
        if (!container || !bar || !val) return;

        if (!password) { container.style.display = 'none'; return; }
        container.style.display = 'block';

        let strength = 0;
        if (password.length >= 8) strength++;
        if (password.length >= 12) strength++;
        if (/[A-Z]/.test(password)) strength++;
        if (/[0-9]/.test(password)) strength++;
        if (/[^a-zA-Z0-9]/.test(password)) strength++;

        const levels = ['Weak', 'Fair', 'Good', 'Strong', 'Strong'];
        const classes = ['weak', 'fair', 'good', 'strong', 'strong'];
        const index = Math.min(strength, 4);

        val.textContent = levels[index];
        val.className = 'strength-value ' + classes[index];
        bar.className = 'strength-bar ' + classes[index];
        bar.style.width = `${(index + 1) * 20}%`;
    };

    const validateUsername = (username) => {
        if (!username) return 'Username is required';
        if (!/^[a-zA-Z0-9_-]{3,20}$/.test(username))
            return 'Must be 3-20 chars (letters, numbers, _, -)';
        return null;
    };

    const validateEmail = (email) => {
        if (!email) return 'Email is required';
        
        if (email.endsWith('@gmail.com')) {
            const emailRegex = /^[a-zA-Z0-9._-]+@gmail\.com$/;
            if (emailRegex.test(email)) {
                 return null;
            }
        }
        
        if (selectedSchoolDomain) {
            const domainRegex = new RegExp(`^[a-zA-Z0-9._-]+@${selectedSchoolDomain.replace(/\./g, '\\.')}$`);
            if (domainRegex.test(email)) {
                return null;
            }
            return `Must be @gmail.com or @${selectedSchoolDomain}`;
        }
        
        return 'Must be a valid @gmail.com address';
    };
    
    const validateAnyEmail = (email) => {
        if (!email) return 'Email is required';
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email))
            return 'Please enter a valid email address';
        return null;
    }

    const validatePassword = (password) => {
        if (!password) return 'Password is required';
        if (password.length < 8)
            return 'Password must be at least 8 characters';
        if (!/(?=.*[a-zA-Z])(?=.*[0-9])/.test(password))
            return 'Password must contain letters and numbers';
        return null;
    };

    // =========================================
    // 6. SIGNUP LOGIC
    // =========================================
    const signupForm = document.getElementById('signupForm');
    const usernameInput = document.getElementById('username_signup');
    const emailInputSignup = document.getElementById('email');
    const passwordInputSignup = document.getElementById('password_signup');
    
    const schoolInput = document.getElementById('school_search');
    const schoolSuggestions = document.getElementById('school_results');
    const clearSchoolBtn = document.querySelector('.js-clear-school');

    function debounce(func, delay) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }

    const searchSchools = debounce(async (query) => {
        if (query.length < 3) {
            schoolSuggestions.style.display = 'none';
            return;
        }

        const lowerQuery = query.toLowerCase();
        
        const localMatches = [];
        const localColleges = (typeof ALL_LOCAL_COLLEGES !== 'undefined' ? ALL_LOCAL_COLLEGES : []);
        const seenNames = new Set();
        
        for (const school of localColleges) {
            if (school.name.toLowerCase().includes(lowerQuery)) {
                localMatches.push(school);
                seenNames.add(school.name);
            }
        }
        
        renderSchoolSuggestions(localMatches);

        try {
            const params = new URLSearchParams({ name: query, country: 'India' });
            const response = await fetch(`${SCHOOL_API_URL}${params.toString()}`); 
            if (!response.ok) throw new Error('API failed');
            const data = await response.json();
            
            const apiMatches = data.map(school => ({
                name: school.name,
                domain: school.domains[0]
            })).filter(school => school.domain);

            const combined = [...localMatches];
            
            apiMatches.forEach(apiSchool => {
                if (!seenNames.has(apiSchool.name)) {
                    combined.push(apiSchool);
                    seenNames.add(apiSchool.name);
                }
            });
            
            if (combined.length > localMatches.length) {
                renderSchoolSuggestions(combined);
            }

        } catch (err) {
            console.error("School API fetch error (Likely CORS):", err);
        }
    }, 150);
    
    function renderSchoolSuggestions(schools) {
        if (schools.length === 0) {
            schoolSuggestions.style.display = 'none';
            return;
        }
        schoolSuggestions.innerHTML = '';
        schools.slice(0, 10).forEach(school => {
            const div = document.createElement('div');
            div.className = 'autocomplete-item';
            div.textContent = school.name;
            div.dataset.domain = school.domain;
            div.dataset.name = school.name;
            schoolSuggestions.appendChild(div);
        });
        schoolSuggestions.style.display = 'block';
    }
    
    function updateEmailValidation(domain) {
        selectedSchoolDomain = domain;
        clearInputError(emailInputSignup);
        if (domain) {
            emailInputSignup.placeholder = `yourname@${domain}`;
        } else {
            emailInputSignup.placeholder = 'yourname@gmail.com';
        }
    }
    
    function clearSchoolSelection() {
        schoolInput.value = '';
        isSchoolSelected = false;
        selectedSchoolDomain = null;
        schoolSuggestions.style.display = 'none';
        clearSchoolBtn.style.display = 'none';
        updateEmailValidation(null);
        clearInputError(schoolInput);
    }

    if (schoolInput) {
        schoolInput.addEventListener('input', (e) => {
            const value = e.target.value.trim();
            isSchoolSelected = false; 
            clearInputError(schoolInput);
            selectedSchoolDomain = null; 

            if(value === '') {
                clearSchoolSelection();
            } else {
                searchSchools(value);
                clearSchoolBtn.style.display = 'block';
            }
        });
        
        schoolInput.addEventListener('blur', () => {
            setTimeout(() => { 
                schoolSuggestions.style.display = 'none';
                
                if (schoolInput.value.trim() && !isSchoolSelected) {
                    showGlobalNotification("Please select your school from the list. Custom names are not allowed.", "error");
                    setInputError(schoolInput, "Select school from list");
                } else if (schoolInput.value.trim() === '') {
                    clearSchoolSelection();
                }

            }, 200);
        });
        schoolInput.addEventListener('focus', (e) => {
            const value = e.target.value.trim();
            clearInputError(schoolInput);
            if(value.length > 2) searchSchools(value);
        });
    }
    
    if (schoolSuggestions) {
        schoolSuggestions.addEventListener('mousedown', (e) => { 
            const item = e.target.closest('.autocomplete-item');
            if (item) {
                const schoolName = item.dataset.name;
                const schoolDomain = item.dataset.domain;
                schoolInput.value = schoolName;
                updateEmailValidation(schoolDomain);
                isSchoolSelected = true;
                schoolSuggestions.style.display = 'none';
                clearInputError(schoolInput);
                clearSchoolBtn.style.display = 'block';
            }
        });
    }

    if (usernameInput) {
        usernameInput.addEventListener('blur', () => {
            const error = validateUsername(usernameInput.value.trim());
            if (error) setInputError(usernameInput, error);
        });
        usernameInput.addEventListener('input', () => clearInputError(usernameInput));
    }
    if (emailInputSignup) {
        emailInputSignup.addEventListener('blur', () => {
            const error = validateEmail(emailInputSignup.value.trim());
            if (error) setInputError(emailInputSignup, error);
        });
        emailInputSignup.addEventListener('input', () => clearInputError(emailInputSignup));
    }
    if (passwordInputSignup) {
        passwordInputSignup.addEventListener('blur', () => {
            const error = validatePassword(passwordInputSignup.value);
            if (error) setInputError(passwordInputSignup, error);
        });
        passwordInputSignup.addEventListener('input', (e) => {
            clearInputError(passwordInputSignup);
            updatePasswordStrength(e.target.value);
        });
    }
    
    // --- Birthday Step Logic ---
    const continueToBirthdayBtn = document.getElementById('continueToBirthdayBtn');
    const backToStep1Btn = document.getElementById('backToStep1Btn');
    const signupStep1 = document.getElementById('signupStep1');
    const signupStep2 = document.getElementById('signupStep2');

    if (continueToBirthdayBtn) {
        continueToBirthdayBtn.addEventListener('click', async () => {
            const userError = validateUsername(usernameInput.value.trim());
            const emailError = validateEmail(emailInputSignup.value.trim());
            const passError = validatePassword(passwordInputSignup.value);
             
            let schoolError = null;
            if (schoolInput.value.trim() === '') {
                schoolError = "School name is required.";
            } else if (!isSchoolSelected) {
                 schoolError = "Please select a school/college/institute from the suggested list.";
                 showGlobalNotification("Please select your school/college/institute from the list. Custom names are not allowed.", "error");
            }

            if (userError) setInputError(usernameInput, userError);
            if (emailError) setInputError(emailInputSignup, emailError);
            if (passError) setInputError(passwordInputSignup, passError);
            if (schoolError) setInputError(schoolInput, schoolError);

            if (userError || emailError || passError || schoolError) {
                return; 
            }

            const btn = continueToBirthdayBtn;
            const originalText = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = 'Checking...';
            
            try {
                const response = await fetch(ENDPOINTS.CHECK_USER, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: usernameInput.value.trim().toLowerCase(),
                        email: emailInputSignup.value.trim().toLowerCase()
                    })
                });

                if (response.ok) {
                    signupStep1.style.display = 'none';
                    signupStep2.style.display = 'block';
                } else {
                    const data = await response.json();
                    if (data.message && data.message.toLowerCase().includes("username")) {
                        setInputError(usernameInput, data.message);
                    } else if (data.message && data.message.toLowerCase().includes("email")) {
                        setInputError(emailInputSignup, data.message);
                    } else {
                        showGlobalNotification(data.message || 'An error occurred', 'error');
                    }
                }
            } catch (err) {
                showGlobalNotification('Server check failed. Please try again.', 'error');
            } finally {
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        });
    }

    if (backToStep1Btn) {
        backToStep1Btn.addEventListener('click', (e) => {
            e.preventDefault();
            signupStep2.style.display = 'none';
            signupStep1.style.display = 'block';
        });
    }

    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const { age, birthdayString, error } = validateBirthday();
            if (error) {
                const bdayErrorSpan = document.getElementById('birthday-error');
                if(bdayErrorSpan) {
                    bdayErrorSpan.textContent = error;
                    bdayErrorSpan.classList.add('show');
                }
                return;
            }

            const btn = signupForm.querySelector('#signupSubmitBtn');
            const originalText = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = 'Creating...';

            try {
                const response = await fetch(ENDPOINTS.REGISTER, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: usernameInput.value.trim().toLowerCase(),
                        email: emailInputSignup.value.trim().toLowerCase(),
                        password: passwordInputSignup.value,
                        school: schoolInput.value.trim(),
                        birthday: birthdayString
                    })
                });
                const data = await response.json();

                if (response.ok && (data.status === 'success' || data.success)) {
                    pendingEmail = emailInputSignup.value.trim().toLowerCase();
                    localStorage.setItem('pendingEmail', pendingEmail);
                    otpContext = 'signup';
                    openModal('otp');
                    showGlobalNotification('Account created! Verify email.', 'success');
                } else {
                    if (data.message && data.message.toLowerCase().includes("username")) {
                        setInputError(usernameInput, data.message);
                        signupStep2.style.display = 'none';
                        signupStep1.style.display = 'block';
                    } else if (data.message && data.message.toLowerCase().includes("email")) {
                        setInputError(emailInputSignup, data.message);
                        signupStep2.style.display = 'none';
                        signupStep1.style.display = 'block';
                    } else {
                        showGlobalNotification(data.message || 'Signup failed', 'error');
                    }
                }
            } catch (err) {
                showGlobalNotification('Server error', 'error');
            } finally {
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        });
    }
    
    
    // =========================================
    // 6.5. BIRTHDAY LOGIC
    // =========================================
    const monthSelect = document.getElementById('month-select');
    const daySelect = document.getElementById('day-select');
    const yearSelect = document.getElementById('year-select');
    const ageDisplay = document.getElementById('age-display');
    const birthdayError = document.getElementById('birthday-error');

    const months = [
        "January", "February", "March", "April", "May", "June", 
        "July", "August", "September", "October", "November", "December"
    ];

    if (monthSelect) {
        months.forEach((month, index) => {
            monthSelect.options[monthSelect.options.length] = new Option(month, index + 1);
        });
    }
    if (daySelect) {
        for (let i = 1; i <= 31; i++) {
            daySelect.options[daySelect.options.length] = new Option(i, i);
        }
    }
    if (yearSelect) {
        const currentYear = new Date().getFullYear();
        for (let i = currentYear; i >= 1950; i--) {
            yearSelect.options[yearSelect.options.length] = new Option(i, i);
        }
    }

    function calculateAge() {
        const month = monthSelect.value;
        const day = daySelect.value;
        const year = yearSelect.value;

        if (birthdayError) birthdayError.classList.remove('show');

        if (month && day && year) {
            const birthDate = new Date(year, month - 1, day);
            if (birthDate.getMonth() !== (month - 1)) {
                ageDisplay.textContent = '--';
                if(birthdayError) {
                    birthdayError.textContent = 'Please enter a valid date.';
                    birthdayError.classList.add('show');
                }
                return null;
            }

            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }
            
            ageDisplay.textContent = age;
            
            if (age < 11) {
                 if(birthdayError) {
                    birthdayError.textContent = 'You must be at least 11 years old.';
                    birthdayError.classList.add('show');
                }
            }
            
            return age;
        }
        ageDisplay.textContent = '--';
        return null;
    }
    
    function validateBirthday() {
        if(birthdayError) {
            birthdayError.classList.remove('show');
            birthdayError.textContent = '';
        }

        const month = monthSelect.value;
        const day = daySelect.value;
        const year = yearSelect.value;

        if (!month || !day || !year) {
            return { error: "Please enter your full date of birth." };
        }

        const age = calculateAge();
        
        if (age === null) {
             return { error: "Please enter a valid date." };
        }
        
        if (age < 11) {
             return { error: "You must be at least 11 years old to register." };
        }
        
        const birthdayString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        return { age, birthdayString, error: null };
    }

    if(monthSelect) monthSelect.addEventListener('change', calculateAge);
    if(daySelect) daySelect.addEventListener('change', calculateAge);
    if(yearSelect) yearSelect.addEventListener('change', calculateAge);


    // =========================================
    // 7. LOGIN LOGIC 
    // =========================================
    const loginForm = document.getElementById('loginForm');
    const loginUsernameInput = document.getElementById('username');
    const loginPasswordInput = document.getElementById('password');
    const loginMessageDiv = document.querySelector('#loginModal .login-message');

    if (loginUsernameInput) {
        loginUsernameInput.addEventListener('blur', () => {
             if (!loginUsernameInput.value.trim()) { setInputError(loginUsernameInput, 'Username or Email required'); }
        });
        loginUsernameInput.addEventListener('input', () => clearInputError(loginUsernameInput));
    }
    if (loginPasswordInput) {
        loginPasswordInput.addEventListener('blur', () => {
             if (!loginPasswordInput.value) { setInputError(loginPasswordInput, 'Password required'); }
        });
        loginPasswordInput.addEventListener('input', () => clearInputError(loginPasswordInput));
    }


    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (loginMessageDiv) {
                loginMessageDiv.textContent = ''; // Clear inline error
            }
            clearInputError(loginUsernameInput);
            clearInputError(loginPasswordInput);

            let isValid = true;
            const identifier = loginUsernameInput.value.trim();
            const password = loginPasswordInput.value;

            if (!identifier) { 
                setInputError(loginUsernameInput, 'Username or Email required'); 
                isValid = false; 
            }
            if (!password) { 
                setInputError(loginPasswordInput, 'Password required'); 
                isValid = false; 
            }
            if (!isValid) return;

            const btn = loginForm.querySelector('button[type="submit"]');
            const originalText = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = 'Signing in...';

            let loginPayload = { 
                identifier: identifier, 
                password: password 
            };

            try {
                const response = await fetch(ENDPOINTS.LOGIN, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(loginPayload)
                });
                
                // We check the response status first.
                if (response.ok) {
                    const data = await response.json(); // Get JSON only if response is OK
                    
                    // ** FIXED: Check for data.status, not data.token **
                    if (data.status === 'success') {
                         // The token is in the HTTP cookie, so we don't save it.
                         
                         // FIXED: This is the green notification you wanted
                         showGlobalNotification(data.message || 'Login successful! Redirecting...', 'success');
                         
                         setTimeout(() => {
                            window.location.href = 'home_dash.html'; 
                         }, 1000); // Wait 1 second for user to see message
                    
                    } else if (data.status === 'unverified') {
                         pendingEmail = identifier.includes('@') ? identifier : '';
                         if(pendingEmail) localStorage.setItem('pendingEmail', pendingEmail);
                         otpContext = 'signup';
                         openModal('otp');
                    }
                } else {
                    // This handles 401 Unauthorized (Invalid Credentials)
                    const data = await response.json();
                    // FIXED: Use notification instead of inline message
                    showGlobalNotification(data.message || 'Invalid email or password.', 'error');
                }
            } catch (err) {
                 // This handles 500 Internal Server Error or network failure
                 // FIXED: Use notification instead of inline message
                 showGlobalNotification('Server connection failed. Please try again.', 'error');
            } finally {
                 btn.disabled = false;
                 btn.innerHTML = originalText;
            }
        });
    }

    // =========================================
    // 8. OTP LOGIC
    // =========================================
    const otpForm = document.getElementById('otpForm');
    const otpInputs = document.querySelectorAll('.otp-input');
    const otpEmailDisplay = document.querySelector('#otpModal .email-display');
    const otpError = document.querySelector('#otpForm .error-message');
    const resendBtn = document.getElementById('resendBtn');
    const resendIcon = resendBtn ? resendBtn.innerHTML : '';

    function initializeOtpModal() {
        pendingEmail = localStorage.getItem('pendingEmail') || '';
        if (!pendingEmail) {
            openModal('signup');
            return;
        }
        if (otpEmailDisplay) otpEmailDisplay.textContent = pendingEmail;
        otpInputs.forEach(i => {
            i.value = '';
            i.classList.remove('error'); 
        });
        if (otpError) otpError.classList.remove('show');
        otpInputs[0]?.focus();
    }

    otpInputs.forEach((input, index) => {
        input.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, '');
            if (otpError) otpError.classList.remove('show');
            input.classList.remove('error');
            if (e.target.value && index < otpInputs.length - 1) {
                otpInputs[index + 1].focus();
            }
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                otpInputs[index - 1].focus();
            }
        });
    });

    if (otpForm) {
        otpForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (otpError) otpError.classList.remove('show');
            const otp = Array.from(otpInputs).map(i => i.value).join('');
            
            if (otp.length < 4) {
                if (otpError) {
                    otpError.textContent = 'Enter full 4-digit code';
                    otpError.classList.add('show');
                }
                otpInputs.forEach(i => i.classList.add('error'));
                return;
            }

            const btn = otpForm.querySelector('button[type="submit"]');
            const originalBtnHTML = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = 'Verifying...';
            
            let verifyUrl = (otpContext === 'signup') ? ENDPOINTS.VERIFY : ENDPOINTS.VERIFY_RESET_OTP;

            try {
                const res = await fetch(verifyUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: pendingEmail, otp })
                });
                const data = await res.json();

                if (res.ok && data.status === 'success') {
                    if (otpContext === 'signup') {
                        showGlobalNotification('Verified! Please login.', 'success');
                        openModal('login');
                    } else {
                        // FIXED: No longer save token to variable. The cookie is set by the server.
                        showGlobalNotification('OTP Verified. Set new password.', 'success');
                        openModal('reset');
                    }
                } else {
                    if (otpError) {
                        otpError.textContent = data.message || 'Invalid OTP';
                        otpError.classList.add('show');
                    }
                    otpInputs.forEach(i => i.classList.add('error'));
                }
            } catch (err) {
                if (otpError) {
                    otpError.textContent = 'Verification failed';
                    otpError.classList.add('show');
                }
                otpInputs.forEach(i => i.classList.add('error'));
            } finally {
                btn.disabled = false;
                btn.innerHTML = originalBtnHTML;
            }
        });
    }
    
    if (resendBtn) {
        resendBtn.addEventListener('click', async () => {
            if (!pendingEmail) {
                showGlobalNotification('No email found to resend to.', 'error');
                return;
            }
            
            resendBtn.disabled = true;
            resendBtn.innerHTML = 'Sending...';
            if(otpError) otpError.classList.remove('show');
            otpInputs.forEach(i => i.classList.remove('error'));

            let resendUrl = (otpContext === 'signup') ? ENDPOINTS.RESEND_OTP : ENDPOINTS.FORGOT_PASSWORD;

            try {
                const res = await fetch(resendUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: pendingEmail }),
                });
                const data = await res.json();
                
                if (res.ok && data.status === 'success') {
                    showGlobalNotification('New code sent!', 'success');
                    let countdown = 30;
                    resendBtn.textContent = `Resend in ${countdown}s`;
                    const timer = setInterval(() => {
                        countdown--;
                        if (countdown > 0) {
                            resendBtn.textContent = `Resend in ${countdown}s`;
                        } else {
                            clearInterval(timer);
                            resendBtn.disabled = false;
                            resendBtn.innerHTML = resendIcon;
                        }
                    }, 1000);
                } else {
                    showGlobalNotification(data.message || 'Failed to resend', 'error');
                    resendBtn.disabled = false;
                    resendBtn.innerHTML = resendIcon;
                }
            } catch (err) {
                showGlobalNotification('Network error', 'error');
                resendBtn.disabled = false;
                resendBtn.innerHTML = resendIcon;
            }
        });
    }

    // =========================================
    // 9. FORGOT/RESET PASSWORD LOGIC
    // =========================================
    const forgotForm = document.getElementById('forgotForm');
    const forgotEmailInput = document.getElementById('forgotEmail');

    if (forgotEmailInput) {
        forgotEmailInput.addEventListener('blur', () => {
            const error = validateAnyEmail(forgotEmailInput.value.trim());
            if(error) setInputError(forgotEmailInput, error);
        });
        forgotEmailInput.addEventListener('input', () => clearInputError(forgotEmailInput));
    }

    if (forgotForm) {
        forgotForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearInputError(forgotEmailInput);
            
            const email = forgotEmailInput.value.trim();
            const emailError = validateAnyEmail(email);

            if (emailError) {
                setInputError(forgotEmailInput, emailError);
                return;
            }
            
            const btn = forgotForm.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.innerHTML = 'Sending...';

            try {
                const res = await fetch(ENDPOINTS.FORGOT_PASSWORD, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: email })
                });
                const data = await res.json();

                if (res.ok && data.status === 'success') {
                    pendingEmail = email;
                    localStorage.setItem('pendingEmail', pendingEmail);
                    otpContext = 'reset';
                    openModal('otp');
                    showGlobalNotification('Reset code sent!', 'success');
                } else {
                    setInputError(forgotEmailInput, data.message || 'Email not found');
                }
            } catch (err) {
                showGlobalNotification('Server error', 'error');
            } finally {
                btn.disabled = false;
                btn.innerHTML = 'Send Code';
            }
        });
    }

    const resetForm = document.getElementById('resetForm');
    const newPasswordInput = document.getElementById('newPassword');
    const resetMessageDiv = document.querySelector('#resetPasswordModal .login-message');
    
    if (newPasswordInput) {
         newPasswordInput.addEventListener('blur', () => {
            const error = validatePassword(newPasswordInput.value);
            if(error) setInputError(newPasswordInput, error);
        });
        newPasswordInput.addEventListener('input', () => clearInputError(newPasswordInput));
    }

    if (resetForm) {
        resetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearInputError(newPasswordInput);
            
            const newPassword = newPasswordInput.value;
            const passError = validatePassword(newPassword);

            if (passError) {
                setInputError(newPasswordInput, passError);
                return;
            }
            
            const btn = resetForm.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.innerHTML = 'Resetting...';

            try {
                // FIXED: We only send the newPassword. The token is in the cookie.
                const res = await fetch(ENDPOINTS.RESET_PASSWORD, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        newPassword: newPassword 
                    })
                });
                const data = await res.json();
                
                if (res.ok && data.status === 'success') {
                    showGlobalNotification('Password reset! Please login.', 'success');
                    openModal('login');
                    pendingEmail = '';
                    localStorage.removeItem('pendingEmail');
                } else {
                    if (resetMessageDiv) {
                        resetMessageDiv.textContent = data.message || 'Reset failed. Invalid code or email.';
                        resetMessageDiv.className = 'login-message error';
                    }
                }
            } catch(err) {
                showGlobalNotification('Server error', 'error');
            } finally {
                btn.disabled = false;
                btn.innerHTML = 'Reset Password';
            }
        });
    }


    // =========================================
    // 10. FINAL INIT
    // =========================================
    Object.values(modals).forEach(m => {
        if (m) {
             m.classList.remove('show');
             m.style.display = 'none';
        }
    });
}