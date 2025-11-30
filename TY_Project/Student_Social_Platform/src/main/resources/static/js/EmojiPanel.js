// Add to window.App
(function (App) {

    const EMOJI_API_URL = "https://unpkg.com/emojibase-data/en/data.json";

    let emojiData = [];
    let categories = [];
    let emojiModalContainer = null;

    // --- Fetch Emojis + Parse Categories ---
    async function loadEmojis() {
        if (emojiData.length > 0) return;

        console.log("Fetching emojis...");
        const res = await fetch(EMOJI_API_URL);
        emojiData = await res.json();

        console.log("Emoji Loaded:", emojiData.length);

        // Build unique category list
        const categoryMap = new Map();

        emojiData.forEach(emoji => {
            if (!categoryMap.has(emoji.group)) {
                categoryMap.set(emoji.group, {
                    name: emoji.group,
                    icon: emoji.emoji, // first emoji becomes icon
                    group: emoji.group
                });
            }
        });

        categories = [...categoryMap.values()];

        console.log("Categories detected:", categories.length);
    }

    // --- Open Emoji Modal ---
    App.openEmojiPanel = async (onSelectCallback) => {
        emojiModalContainer = document.getElementById("emoji-modal-container");
        if (!emojiModalContainer) return;

        // Load template
        const html = await (await fetch("emoji_panel.html")).text();
        emojiModalContainer.innerHTML = html;

        // Load data if needed
        await loadEmojis();

        const backdrop = emojiModalContainer.querySelector(".emoji-backdrop");
        const categoryList = emojiModalContainer.querySelector("#emoji-categories-list");
        const gridList = emojiModalContainer.querySelector("#emoji-grid-list");
        const gridTitle = emojiModalContainer.querySelector("#emoji-grid-title");

        const closeModal = () => emojiModalContainer.innerHTML = "";
        backdrop.addEventListener("click", closeModal);

        // --- Build Category Tabs Dynamically ---
        categoryList.innerHTML = "";
        categories.forEach((cat, index) => {
            const tab = document.createElement("button");
            tab.className = "emoji-tab";
            tab.innerHTML = cat.icon;
            tab.title = cat.name;

            if (index === 0) tab.classList.add("active-tab");

            tab.addEventListener("click", () => {
                categoryList.querySelector(".active-tab")?.classList.remove("active-tab");
                tab.classList.add("active-tab");
                renderCategory(cat, gridList, gridTitle, onSelectCallback, closeModal);
            });

            categoryList.appendChild(tab);
        });

        // Load first category
        renderCategory(categories[0], gridList, gridTitle, onSelectCallback, closeModal);
    };

    // --- Render Emoji Grid ---
    function renderCategory(category, gridList, gridTitle, onSelectCallback, closeModal) {
        gridList.innerHTML = "";
        gridTitle.textContent = category.name;

        const filtered = emojiData.filter(e => e.group === category.group);

        filtered.forEach(emoji => {
            const btn = document.createElement("button");
            btn.className = "emoji-btn";
            btn.innerHTML = emoji.emoji;
            btn.title = emoji.annotation;

            btn.addEventListener("click", () => {
                onSelectCallback(emoji.emoji);
                closeModal();
            });

            gridList.appendChild(btn);
        });
    }

})(window.App = window.App || {});
