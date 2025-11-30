// Add to window.App
window.App = window.App || {};

(function(App) {

    // --- Helper: Fetch HTML ---
    async function loadHtml(url) {
        try {
            console.log(`[SettingsPanel] Fetching ${url}...`);
            const response = await fetch(url + '?v=' + new Date().getTime());
            if (!response.ok) throw new Error(`Failed to load ${url}`);
            return await response.text();
        } catch (err) {
            console.error("[SettingsPanel] HTML Load Error:", err);
            return null;
        }
    }

    // --- Main Render Function ---
    App.renderSettings = async (panel) => {
        console.log("Rendering Settings Panel (v3)...");
        
        // 1. Load Layout
        const html = await loadHtml('settings_panel.html');
        if (!html) {
            panel.innerHTML = '<p class="error-msg">Error loading settings layout.</p>';
            return;
        }
        panel.innerHTML = html;

        // 2. Attach Listeners
        const btns = panel.querySelectorAll('button');
        btns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.target.textContent.trim();
                console.log(`[SettingsPanel] Clicked: ${action}`);

                // --- Handle Email Support ---
                if (action === "Email Support") {
                    window.location.href = "mailto:support@example.com?subject=Support%20Request";
                    return;
                }

                // Default (for other buttons you may add later)
                alert(`Action: ${action} (Coming Soon)`);
            });
        });
    };

})(window.App);
