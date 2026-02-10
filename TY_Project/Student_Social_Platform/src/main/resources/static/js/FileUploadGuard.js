/**
 * FileUploadGuard.js
 * ----------------------------------------------------
 * HARD GLOBAL IMAGE SIZE GUARD (MAX 5 MB)
 * - Blocks preview BEFORE it renders
 * - Shows global toast error
 * - Works across all modules
 * - Zero changes to existing code
 * ----------------------------------------------------
 */

(function () {
    if (window.__FILE_UPLOAD_GUARD_ACTIVE__) return;
    window.__FILE_UPLOAD_GUARD_ACTIVE__ = true;

    /* ===============================
       CONFIG
    =============================== */

    const MAX_IMAGE_SIZE_MB = 5;
    const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;
    const TOAST_DURATION = 5000;

    const ERROR_MESSAGE = `Image size should be maximum ${MAX_IMAGE_SIZE_MB} MB`;

    /* ===============================
       GLOBAL TOAST
    =============================== */

    let activeToast = null;

    function showErrorToast(message) {
        if (activeToast) activeToast.remove();

        const toast = document.createElement('div');
        activeToast = toast;

        toast.style.cssText = `
            position:fixed;
            right:20px;
            bottom:20px;
            width:320px;
            background:#111827;
            color:#f9fafb;
            border-radius:12px;
            box-shadow:0 10px 30px rgba(0,0,0,.25);
            z-index:99999;
            overflow:hidden;
            font-family:Inter,system-ui,sans-serif;
        `;

        toast.innerHTML = `
            <div style="padding:14px 16px;display:flex;gap:10px;">
                <div style="color:#ef4444;font-size:18px;">⚠️</div>
                <div style="flex:1;font-size:.95rem">
                    <strong>Upload failed</strong><br>
                    ${message}
                </div>
                <button style="background:none;border:none;color:#9ca3af;font-size:18px;cursor:pointer">&times;</button>
            </div>
            <div class="toast-bar" style="height:4px;background:#ef4444;width:100%"></div>
        `;

        document.body.appendChild(toast);

        toast.querySelector('button').onclick = () => removeToast(toast);

        toast.querySelector('.toast-bar').animate(
            [{ width: '100%' }, { width: '0%' }],
            { duration: TOAST_DURATION, easing: 'linear' }
        );

        setTimeout(() => removeToast(toast), TOAST_DURATION);
    }

    function removeToast(toast) {
        if (!toast) return;
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 200);
        activeToast = null;
    }

    /* ===============================
       CORE VALIDATION
    =============================== */

    function isInvalidImage(file) {
        return (
            file &&
            file.type &&
            file.type.startsWith('image/') &&
            file.size > MAX_IMAGE_SIZE_BYTES
        );
    }

    function hardResetInput(input) {
        input.value = '';
    }

    /* ===============================
       🔥 CRITICAL FIX
       CAPTURE PHASE + STOP PROPAGATION
    =============================== */

    document.addEventListener(
        'change',
        function (event) {
            const input = event.target;

            if (
                !input ||
                input.tagName !== 'INPUT' ||
                input.type !== 'file' ||
                !input.files ||
                !input.files[0]
            ) return;

            const file = input.files[0];

            if (isInvalidImage(file)) {
                // 🔥 STOP EVERYTHING
                event.preventDefault();
                event.stopImmediatePropagation();

                hardResetInput(input);
                showErrorToast(ERROR_MESSAGE);
            }
        },
        true // 👈 CAPTURE PHASE (THIS IS THE KEY)
    );

})();
