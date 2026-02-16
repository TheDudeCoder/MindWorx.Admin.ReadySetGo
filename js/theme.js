/* ============================================================
   MindWorx Admin — Theme Manager
   Handles dark/light theme toggle with localStorage persistence
   ============================================================ */

const Theme = (() => {
    const STORAGE_KEY = 'mindworx-admin-theme';

    function get() {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) return saved;
        // Respect OS preference on first visit
        return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }

    function set(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem(STORAGE_KEY, theme);
        updateToggleIcons();
    }

    function toggle() {
        const current = document.documentElement.getAttribute('data-theme');
        set(current === 'dark' ? 'light' : 'dark');
    }

    function updateToggleIcons() {
        // Toggle buttons update via CSS — no JS needed for icon visibility
        // But we emit a custom event for Chart.js and other components
        window.dispatchEvent(new CustomEvent('themechange', {
            detail: { theme: document.documentElement.getAttribute('data-theme') }
        }));
    }

    function init() {
        set(get());

        // Bind all toggle buttons
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.theme-toggle');
            if (btn) toggle();
        });

        // Listen for OS theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!localStorage.getItem(STORAGE_KEY)) {
                set(e.matches ? 'dark' : 'light');
            }
        });
    }

    return { init, get, set, toggle };
})();

// Initialize theme immediately to prevent flash
Theme.init();
