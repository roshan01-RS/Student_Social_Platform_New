// DocumentVerification.js
window.App = window.App || {};

(function(App) {
    
    // Initial State
    let verificationState = {
        status: 'NONE', 
        idCardUrl: null,
        receiptUrl: null,
        accountExpireDate: null 
    };
    
    // --- Helper: Global Notification ---
    const showNotification = (message, type = 'success') => {
        if (window.showGlobalNotification) {
            window.showGlobalNotification(message, type);
        } else {
            console.warn(`[NOTIFICATION FALLBACK - ${type.toUpperCase()}] ${message}`);
        }
    };

    App.syncDocumentVerificationState = (profileData) => {
        if (profileData.verificationStatus) {
             verificationState.status = profileData.verificationStatus.toUpperCase();
        } else {
             verificationState.status = 'NONE';
        }
        verificationState.idCardUrl = profileData.idCardUrl;
        verificationState.receiptUrl = profileData.receiptUrl;
        verificationState.accountExpireDate = profileData.accountExpireDate;
    };
    
    // --- NEW: Real-time Update Method (for Admin pushes) ---
    App.updateVerificationStatusRealTime = (newStatus) => {
        console.log("Updating verification status in real-time:", newStatus);
        verificationState.status = newStatus.toUpperCase();
        
        const wrapper = document.querySelector('#doc-verification-wrapper');
        if (wrapper) {
            App.renderDocumentVerificationCard(wrapper);
        }
        
        if (newStatus === 'VERIFIED') {
            document.dispatchEvent(new Event('profile-verified'));
        }
    };
    
    const resolveImageUrl = (url) => {
        if (!url || url.includes('null')) return 'https://placehold.co/400x300/e2e8f0/94a3b8?text=No+Document';
        if (url.startsWith('http')) return url;
        return `${window.location.origin}/${url}`;
    };

    // --- Helper function to render a single document preview block ---
    function renderDocumentPreviewBlock(title, src, isVerified, isRejected = false) {
        const primaryColor = isVerified ? '#10b981' : (isRejected ? '#dc2626' : '#2563eb');
        const borderColor = isVerified ? '#86efac' : (isRejected ? '#f87171' : '#93c5fd');
        const successTextColor = isVerified ? '#15803d' : (isRejected ? '#9a3412' : '#4b5563');
        
        const verifiedBadge = isVerified ? `
             <div style="position: absolute; top: 10px; right: 10px; background: #22c55e; color: white; padding: 4px 12px; border-radius: 99px; font-size: 1.1rem; font-weight: 600; display: flex; align-items: center; gap: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                Verified
             </div>` : '';

        const statusText = isVerified ? 'Document has been verified successfully' : 
                           (isRejected ? 'Verification failed' : 'Awaiting review');
        const iconColor = isVerified ? '#22c55e' : (isRejected ? '#dc2626' : '#9ca3af');

        return `
        <div style="flex: 1;">
            <div style="display: flex; align-items: center; gap: 0.8rem; margin-bottom: 0.8rem; color: ${successTextColor}; font-weight: 600; font-size: 1.3rem;">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: ${primaryColor};">
                    <rect x="3" y="5" width="18" height="14" rx="2" ry="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="7" y1="15" x2="7.01" y2="15"/><line x1="11" y1="15" x2="13" y2="15"/>
                </svg>
                ${title}
            </div>
            <div style="position: relative; border: 1px solid ${borderColor}; border-radius: 10px; overflow: hidden; height: 180px; background: white; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                 <a href="${src}" target="_blank">
                    <img src="${src}" style="width: 100%; height: 100%; object-fit: contain; cursor: pointer;" alt="${title}" onerror="this.src='https://placehold.co/400x300/e2e8f0/94a3b8?text=File+Not+Found'">
                 </a>
                 ${verifiedBadge}
            </div>
            <div style="margin-top: 0.8rem; display: flex; align-items: center; gap: 0.5rem; color: ${successTextColor}; font-size: 1.1rem; font-weight: 500;">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: ${iconColor};">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                ${statusText}
            </div>
        </div>
        `;
    }

    // --- RENDER CARD IN PROFILE ---
    App.renderDocumentVerificationCard = (container) => {
        let html = '';
        const ID_CARD_SRC = resolveImageUrl(verificationState.idCardUrl);
        const RECEIPT_SRC = resolveImageUrl(verificationState.receiptUrl);
        const IS_VERIFIED = verificationState.status === 'VERIFIED';
        const IS_PENDING = verificationState.status === 'PENDING';
        const IS_REJECTED = verificationState.status === 'REJECTED'; 


        if (verificationState.status === 'NONE') {
            html = `
            <div class="doc-verification-card doc-card-initial">
                <h2 style="font-size:1.6rem;margin-bottom:1.5rem;text-align:left;color:inherit;color: #3b82f6;">Document Verification</h2>
                <div class="doc-icon-large">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                </div>
                <h3 class="doc-title">Upload Documents for Verification</h3>
                <p class="doc-desc">Upload your student ID card and fees receipt for verification. The admin will review your documents within 24 hours.</p>
                <button id="btn-open-upload-modal" class="btn btn-primary">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:0.5rem"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    Upload Documents
                </button>
            </div>`;
        } 
        else if (IS_PENDING) {
             html = `
            <div class="doc-verification-card doc-card-pending" style="background-color: #f0f9ff; border: 1px solid #93c5fd; border-radius: 16px; padding: 2rem;">
                 <h2 style="font-size:1.6rem;margin-bottom:1rem;text-align:left;color:inherit;">Document Verification</h2>
                <div style="display: flex; justify-content: center; margin-bottom: 1.5rem;">
                    <div style="width: 4.5rem; height: 4.5rem; background-color: #3b82f6; border-radius: 50%; display: flex; align-items: center; justify-content: center; animation: pulse 2s infinite;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    </div>
                </div>
                <h3 style="color: #1e3a8a; font-size: 1.6rem; font-weight: 700; margin-bottom: 0.5rem; text-align: center;">Documents Under Review</h3>
                <p style="color: #4b5563; font-size: 1.3rem; margin-bottom: 2rem; text-align: center;">Your documents have been submitted and are currently being reviewed.</p>
                <div style="margin-top: 1.5rem; color: #2563eb; font-size: 1.2rem; font-weight: 500; text-align: center;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; margin-right: 5px;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    Awaiting admin review (24 hours notice)
                </div>
            </div>`;
        }
        else if (IS_REJECTED) {
            html = `
            <div class="doc-verification-card doc-card-rejected" style="background-color: #fffbeb; border: 1px solid #f97316; border-radius: 16px; padding: 2rem;">
                 <h2 style="font-size:1.6rem;margin-bottom:1rem;text-align:left;color:inherit;">Document Verification</h2>
                
                <div style="display: flex; justify-content: center; margin-bottom: 1.5rem;">
                    <div style="width: 4.5rem; height: 4.5rem; background-color: #f97316; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </div>
                </div>

                <h3 style="color: #9a3412; font-size: 1.6rem; font-weight: 700; margin-bottom: 0.5rem; text-align: center;">Verification Rejected</h3>
                <p style="color: #7c2d12; font-size: 1.3rem; margin-bottom: 1.5rem; text-align: center;">Your documents were rejected. Please check for clarity and validity, then re-upload.</p>
                
                <button id="btn-open-upload-modal" class="btn btn-primary" style="background-color:#f97316; border:none;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:0.5rem"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    Re-upload Documents
                </button>
            </div>`;
        }
        else if (IS_VERIFIED) {
             html = `
            <div class="doc-verification-card doc-card-verified" style="background-color: #f0fdf4; border: 1px solid #86efac; border-radius: 16px; padding: 2.5rem; text-align: center;">
                <div style="display: flex; justify-content: center; margin-bottom: 1.5rem;">
                    <div style="width: 4.5rem; height: 4.5rem; background-color: #22c55e; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px rgba(34, 197, 94, 0.2);">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                </div>
                <h3 style="color: #15803d; font-size: 1.6rem; font-weight: 700; margin-bottom: 0.5rem;">Documents Verified Successfully</h3>
                <p style="color: #166534; font-size: 1.3rem; margin-bottom: 2.5rem;">Your ID card and fees receipt have been verified by the admin.</p>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    ${renderDocumentPreviewBlock('Student ID Card', ID_CARD_SRC, true)}
                    ${renderDocumentPreviewBlock('Fees Receipt', RECEIPT_SRC, true)}
                </div>
                <div style="margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid #e5e7eb; display: flex; align-items: center; gap: 0.5rem; color: #10b981; font-size: 1.3rem; font-weight: 600; justify-content: center;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    Valid till ${verificationState.accountExpireDate || 'N/A'}
                </div>
            </div>`;
        }

        const wrapper = document.createElement('div');
        wrapper.innerHTML = html;
        container.innerHTML = '';
        container.appendChild(wrapper.firstElementChild);

        const uploadBtn = container.querySelector('#btn-open-upload-modal');
        if (uploadBtn) {
            uploadBtn.addEventListener('click', App.openUploadDocumentsModal);
        }
    };

    // --- MODAL LOGIC ---
    App.openUploadDocumentsModal = async () => {
        const modal = document.getElementById('reusable-modal');
        const modalContent = document.getElementById('reusable-modal-content');
        if (!modal) return;

        try {
            const resp = await fetch('upload_documents_modal.html');
            if(resp.ok) modalContent.innerHTML = await resp.text();
            else throw new Error('Failed to load modal HTML');
        } catch(e) { return; }

        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('show'), 10);
        modal.classList.add('modal-large');

        setTimeout(() => {
            const close = () => {
                modal.classList.remove('show');
                setTimeout(() => { modal.style.display = 'none'; modalContent.innerHTML = ''; }, 300);
            };
            
            // Close bindings
            const closeBtn = modalContent.querySelector('.js-close-upload-docs');
            if(closeBtn) closeBtn.addEventListener('click', close);
            const cancelBtn = modalContent.querySelector('.btn-secondary');
            if(cancelBtn) cancelBtn.addEventListener('click', close);
            
            const globalCloseBtn = modal.querySelector('.js-close-modal');
            if (globalCloseBtn) {
                const newGlobalBtn = globalCloseBtn.cloneNode(true);
                globalCloseBtn.parentNode.replaceChild(newGlobalBtn, globalCloseBtn);
                newGlobalBtn.addEventListener('click', close);
            }

            modal.onclick = (e) => {
                if (e.target === modal) close();
            };

            let idFile = null;
            let receiptFile = null;
            const submitBtn = document.getElementById('btn-submit-docs');

            const handleFileSelect = (file, type) => {
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (e) => {
                    if (type === 'id') {
                        idFile = file;
                        document.getElementById('id-card-preview-container').style.display = 'block'; 
                        document.getElementById('id-card-placeholder').style.display = 'none';
                        document.getElementById('id-card-img').src = e.target.result;
                        document.getElementById('id-card-name').textContent = file.name;
                    } else {
                        receiptFile = file;
                        document.getElementById('fee-receipt-preview-container').style.display = 'block'; 
                        document.getElementById('fee-receipt-placeholder').style.display = 'none';
                        document.getElementById('fee-receipt-img').src = e.target.result;
                        document.getElementById('fee-receipt-name').textContent = file.name;
                    }
                    if (idFile && receiptFile && submitBtn) submitBtn.removeAttribute('disabled');
                };
                reader.readAsDataURL(file);
            };

            const idInput = document.getElementById('input-id-card');
            const receiptInput = document.getElementById('input-fee-receipt');
            const idDropzone = document.getElementById('id-card-dropzone');
            const receiptDropzone = document.getElementById('fee-receipt-dropzone');

            if (idDropzone && idInput) {
                idDropzone.addEventListener('click', (e) => {
                     if (!e.target.closest('.btn-remove-file') && !e.target.closest('.btn-remove-file-icon')) {
                         idInput.click();
                     }
                });
                idInput.addEventListener('change', (e) => {
                    if (e.target.files && e.target.files[0]) handleFileSelect(e.target.files[0], 'id');
                });
            }

            if (receiptDropzone && receiptInput) {
                receiptDropzone.addEventListener('click', (e) => {
                     if (!e.target.closest('.btn-remove-file') && !e.target.closest('.btn-remove-file-icon')) {
                         receiptInput.click();
                     }
                });
                receiptInput.addEventListener('change', (e) => {
                    if (e.target.files && e.target.files[0]) handleFileSelect(e.target.files[0], 'receipt');
                });
            }

            const removeIdCard = (e) => {
                if (e) e.stopPropagation();
                idFile = null;
                if (idInput) idInput.value = '';
                const preview = document.getElementById('id-card-preview-container');
                if (preview) preview.style.display = 'none';
                const placeholder = document.getElementById('id-card-placeholder');
                if (placeholder) placeholder.style.display = 'block';
                if (submitBtn) submitBtn.setAttribute('disabled', 'true');
            };

            const removeReceipt = (e) => {
                if (e) e.stopPropagation();
                receiptFile = null;
                if (receiptInput) receiptInput.value = '';
                const preview = document.getElementById('fee-receipt-preview-container');
                if (preview) preview.style.display = 'none';
                const placeholder = document.getElementById('fee-receipt-placeholder');
                if (placeholder) placeholder.style.display = 'block';
                if (submitBtn) submitBtn.setAttribute('disabled', 'true');
            };

            const btnRemoveId = document.getElementById('btn-remove-id-card');
            if (btnRemoveId) btnRemoveId.addEventListener('click', removeIdCard);
            const btnRemoveReceipt = document.getElementById('btn-remove-fee-receipt');
            if (btnRemoveReceipt) btnRemoveReceipt.addEventListener('click', removeReceipt);

            if (submitBtn) {
                submitBtn.addEventListener('click', async () => {
                    submitBtn.textContent = 'Uploading...';
                    submitBtn.disabled = true;

                    const formData = new FormData();
                    formData.append('idCard', idFile);
                    formData.append('receipt', receiptFile);

                    try {
                        const res = await fetch('/api/my-profile/upload-verification-docs', {
                            method: 'POST',
                            credentials: 'include',
                            body: formData
                        });

                        if (res.ok) {
                            verificationState.status = 'PENDING';
                            close();
                            if (window.App.renderProfile) {
                                const panel = document.querySelector('.content-panel');
                                window.App.renderProfile(panel); 
                            }
                            if (window.App.showGlobalNotification) {
                                window.App.showGlobalNotification("Documents submitted successfully!", "success");
                            }
                        } else {
                            const err = await res.json();
                            showNotification("Upload failed: " + (err.error || "Unknown error"), "error");
                            submitBtn.disabled = false;
                            submitBtn.textContent = 'Submit for Verification';
                        }
                    } catch (e) {
                        console.error(e);
                        showNotification("Network error during upload.", "error");
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Submit for Verification';
                    }
                });
            }
        }, 50); 
    };

})(window.App);