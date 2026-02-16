/* ============================================================
   MindWorx Admin — SPA Router
   Simple hash-based router for dashboard pages
   ============================================================ */

const Router = (() => {
    const routes = {};
    let currentPage = null;
    let contentEl = null;

    function register(path, handler) {
        routes[path] = handler;
    }

    function navigate(path) {
        window.location.hash = path;
    }

    function getCurrentPath() {
        return window.location.hash.slice(1) || 'command-center';
    }

    async function handleRoute() {
        const path = getCurrentPath();
        if (path === currentPage) return;

        const handler = routes[path] || routes['404'];
        if (!handler) {
            console.error(`No handler for route: ${path}`);
            return;
        }

        if (!contentEl) {
            contentEl = document.getElementById('page-content');
        }

        // Update sidebar active state
        document.querySelectorAll('.sidebar-link').forEach(link => {
            const linkPath = link.getAttribute('data-page');
            link.classList.toggle('active', linkPath === path);
        });

        // Update page title
        const pageTitles = {
            'command-center': 'Command Center',
            'pipeline': 'Pipeline',
            'call-activity': 'Call Activity',
            'financials': 'Financials',
            'system-health': 'System Health',
            'subscriptions': 'Subscriptions'
        };
        const titleEl = document.getElementById('page-title');
        if (titleEl) titleEl.textContent = pageTitles[path] || path;

        // Show loading
        contentEl.innerHTML = '<div class="flex justify-center items-center" style="padding:4rem;"><div class="spinner"></div></div>';

        try {
            currentPage = path;
            await handler(contentEl);
        } catch (err) {
            console.error(`Error loading page "${path}":`, err);
            contentEl.innerHTML = `
                <div class="card" style="padding:2rem;text-align:center;">
                    <h3 class="text-destructive">Error Loading Page</h3>
                    <p class="text-muted" style="margin-top:0.5rem;">${err.message}</p>
                    <button class="btn btn-outline" style="margin-top:1rem;" onclick="Router.navigate('command-center')">
                        Go to Command Center
                    </button>
                </div>
            `;
        }
    }

    function init() {
        window.addEventListener('hashchange', handleRoute);

        // Handle sidebar link clicks
        document.addEventListener('click', (e) => {
            const link = e.target.closest('.sidebar-link[data-page]');
            if (link) {
                e.preventDefault();
                navigate(link.getAttribute('data-page'));
            }
        });

        // Initial route
        handleRoute();
    }

    return { register, navigate, getCurrentPath, init };
})();
