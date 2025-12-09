// AdminAuthCheck.js — robust, secure auth check that DOES NOT read HttpOnly cookie
// It uses the server-side /api/admin/verify-token endpoint and sends cookies along.

(function() {
    // Only run on the admin panel page
    if (!window.location.pathname.endsWith('admin_panel.html')) {
        return;
    }

    // If we're already on login page, don't redirect (avoid loops)
    const loginPath = '/admin_login.html';

    // Use server verification (cookie is HttpOnly — can't be read from JS).
    // This relies on the server returning 200 for a valid cookie and 401 otherwise.
    fetch('/api/admin/verify-token', {
        method: 'POST',
        credentials: 'include' // IMPORTANT: send cookies (HttpOnly) with the request
    })
    .then(res => {
        if (!res.ok) {
            console.warn("Admin token invalid or missing. Redirecting to login...");
            // Clear any client-side remnants (best effort) and redirect
            try { document.cookie = 'adminAuthToken=; Max-Age=0; path=/;'; } catch(e) {}
            // Use absolute redirect to avoid relative path issues
            window.location.href = loginPath;
        } else {
            // token valid — allow user to remain on page
            // optionally you can parse server response for roles/expiry if returned.
        }
    })
    .catch(err => {
        // Network error: we can't verify. Safer UX options:
        // - Allow page to load but disable API-dependent features, or
        // - Redirect to login (stricter).
        console.error("Network error while verifying admin token. Letting user stay on page; APIs may fail.", err);
        // If you prefer stricter behavior uncomment next line:
        // window.location.href = loginPath;
    });
})();
