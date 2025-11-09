document.addEventListener('DOMContentLoaded', () => {
    // --- API Endpoints ---
    // Smart port detection for local dev vs production
    const API_BASE = window.location.port === '5500' || window.location.port === '5501' 
                     ? 'http://localhost:8000' : ''; 
    const VERIFY_API_URL = `${API_BASE}/api/verify`;
    const RESEND_API_URL = `${API_BASE}/api/resend-otp`;

    const otpForm = document.getElementById('otpForm');
    const otpInputs = document.querySelectorAll('.otp-input');
    const emailDisplay = document.querySelector('.email-display');
    const resendBtn = document.getElementById('resendBtn');
    const backBtn = document.getElementById('backBtn');
    const messageDiv = document.querySelector('.otp-message'); // Assumes you added this div to HTML

    let userEmail = null;

    // --- ✅ 1. READ EMAIL FROM URL (Reliable Fix) ---
    // We use a small delay to ensure the browser has fully updated the URL 
    // in the iframe before we try to read it.
    setTimeout(() => {
        const params = new URLSearchParams(window.location.search);
        userEmail = params.get('email');

        if (userEmail) {
            if (emailDisplay) {
                 // Simple obscuring of email for privacy
                 const parts = userEmail.split('@');
                 emailDisplay.textContent = `A code was sent to ${parts[0].substring(0, 3)}...@${parts[1]}`;
            }
            // Auto-focus first input
            if (otpInputs.length > 0) otpInputs[0].focus();
        } else {
            console.warn("No email in URL, redirecting to signup");
            // Safe redirect if email is missing
            window.parent.postMessage('navigateTo:signup', '*');
        }
    }, 200);

    // --- 2. OTP Input Logic (Typing, Pasting, Backspace) ---
    if (otpInputs.length > 0) {
        otpInputs.forEach((input, index) => {
            input.addEventListener('input', (e) => {
                // Allow only numbers
                if (!/^\d*$/.test(input.value)) input.value = '';
                // Auto-advance to next input
                else if (input.value && index < otpInputs.length - 1) otpInputs[index + 1].focus();
            });
            input.addEventListener('keydown', (e) => {
                // Backspace moves focus back
                if (e.key === 'Backspace' && !input.value && index > 0) otpInputs[index - 1].focus();
            });
            input.addEventListener('paste', (e) => {
                e.preventDefault();
                const data = e.clipboardData.getData('text').trim().slice(0, 4);
                if (/^\d+$/.test(data)) {
                    otpInputs.forEach((inp, i) => inp.value = data[i] || '');
                    // Focus the next empty input or the last one
                    otpInputs[Math.min(data.length, 3)].focus();
                }
            });
        });
    }

    // --- Helper: Inline Messages ---
    const showMessage = (text, type = 'error') => {
        if (!messageDiv) {
            alert(text); // Fallback if messageDiv isn't in HTML
            return;
        }
        messageDiv.textContent = text;
        // Assumes you have CSS classes for .otp-message.error and .otp-message.success
        messageDiv.className = `otp-message ${type}`; 
    };

    const clearMessage = () => {
        if (messageDiv) {
            messageDiv.textContent = '';
            messageDiv.className = 'otp-message';
        }
    };

    // --- 3. Verify Submission ---
    if (otpForm) {
        otpForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearMessage();

            const otp = Array.from(otpInputs).map(i => i.value).join('');
            if (otp.length !== 4) { 
                showMessage("Please enter the 4-digit OTP", "error"); 
                return; 
            }

            try {
                const res = await fetch(VERIFY_API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: userEmail, otp })
                });
                const data = await res.json();

                if (res.ok && data.status === 'success') {
                    showMessage("Verified! Logging in...", "success");
                    // Wait 1s for user to see success message, then navigate
                    setTimeout(() => {
                        window.parent.postMessage('navigateTo:login', '*');
                    }, 1000);
                } else {
                    showMessage(data.message || "Verification failed", "error");
                }
            } catch (err) {
                console.error(err);
                showMessage("Network error during verification", "error");
            }
        });
    }

    // --- 4. Resend & Back Buttons ---
    if (resendBtn) {
        // Timer to prevent spamming resend
        const startResendTimer = () => {
            resendBtn.disabled = true;
            let countdown = 60;
            resendBtn.textContent = `Resend in ${countdown}s`;

            const timer = setInterval(() => {
                countdown--;
                resendBtn.textContent = `Resend in ${countdown}s`;
                if (countdown <= 0) {
                    clearInterval(timer);
                    resendBtn.disabled = false;
                    resendBtn.textContent = "Resend OTP";
                    // Removed the /invalidate call here - let the server handle expiry naturally
                }
            }, 1000);
        };

        resendBtn.addEventListener('click', async () => {
            clearMessage();
            try {
                // Disable immediately to prevent double-clicks
                resendBtn.disabled = true;
                resendBtn.textContent = "Sending...";
                
                const res = await fetch(RESEND_API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: userEmail })
                });

                if (res.ok) {
                    showMessage("OTP resent! Check your email.", "success");
                    startResendTimer();
                } else {
                    const data = await res.json();
                    showMessage(data.message || "Failed to resend OTP", "error");
                    resendBtn.disabled = false;
                    resendBtn.textContent = "Resend OTP";
                }
            } catch (err) { 
                console.error(err);
                showMessage("Network error on resend", "error");
                resendBtn.disabled = false;
                resendBtn.textContent = "Resend OTP";
            }
        });
    }

    if (backBtn) {
        backBtn.addEventListener('click', (e) => {
            e.preventDefault();
            // Correctly uses parent navigation instead of window.location
            window.parent.postMessage('navigateTo:signup', '*');
        });
    }
});