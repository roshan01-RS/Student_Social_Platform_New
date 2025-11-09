document.addEventListener('DOMContentLoaded', () => {
  const modalBackdrop = document.getElementById('auth-modal-backdrop');
  const authIframe = document.getElementById('auth-iframe');
  const closeBtn = document.getElementById('auth-modal-close-btn');

  const navigateIframe = (pageUrl) => {
    // Log the actual navigation for debugging
    console.log("🚀 Navigating iframe to:", pageUrl);
    authIframe.src = pageUrl;

    if (pageUrl.includes('login')) {
      authIframe.style.height = '500px';
    } else if (pageUrl.includes('otp')) {
      authIframe.style.height = '600px';
    } else if (pageUrl.includes('forgot')) {
      authIframe.style.height = '450px';
    } else if (pageUrl.includes('reset')) {
      authIframe.style.height = '500px';
    } else {
      authIframe.style.height = '650px';
    }
  };

  const openModal = (pageUrl) => {
    modalBackdrop.style.display = 'flex';
    navigateIframe(pageUrl);
  };

  const closeModal = () => {
    modalBackdrop.style.display = 'none';
    authIframe.src = 'about:blank';
  };

  document.querySelectorAll('.btn-signin, .btn-signup').forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      openModal(button.classList.contains('btn-signin') ? 'login.html' : 'signup.html');
    });
  });

  closeBtn.addEventListener('click', closeModal);

  window.addEventListener('message', (event) => {
    if (typeof event.data !== 'string') return;
    const message = event.data;
    console.log('📩 Parent received:', message);

    if (message === 'navigateTo:login') {
        navigateIframe('login.html');

    } else if (message === 'navigateTo:signup') {
        navigateIframe('signup.html');

    } else if (message === 'navigateTo:forgot-password') {
        navigateIframe('forgot-password.html');

    } else if (message.startsWith('navigateTo:reset-password:')) {
        const parts = message.split(':');
        navigateIframe(`reset-password.html?email=${encodeURIComponent(parts[2])}&otp=${encodeURIComponent(parts[3])}`);

    // --- CRITICAL FIX: More flexible OTP listener ---
    } else if (message.startsWith('navigateTo:otp')) {
        // This handles both "navigateTo:otp" AND "navigateTo:otp?email=..."
        // We just replace the prefix with the actual filename.
        const newUrl = message.replace('navigateTo:otp', 'otp.html');
        navigateIframe(newUrl);

    } else if (message === 'action:closeModal') {
        closeModal();
    }
  });
});