/* ============================================================
   MindWorx Admin — Settings Page
   Editable Settings (Name/Value pairs)
   ============================================================ */

Router.register('settings', async (container) => {
    container.innerHTML = `
        <div class="page-header flex justify-between items-center">
            <div>
                <h1 class="page-title">Settings</h1>
                <p class="page-subtitle">Manage system settings</p>
            </div>
            <button class="btn btn-primary btn-sm" id="btn-refresh-settings">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                </svg>
                Refresh
            </button>
        </div>

        <div id="settings-table"></div>
    `;

    let configData = [];

    document.getElementById('btn-refresh-settings').addEventListener('click', loadData);

    // ---- Load Data ----

    async function loadData() {
        try {
            const result = await API.Settings.lookup().catch(() => ({ data: [] }));
            configData = result.data || result.results || [];
            renderTable();
        } catch (err) {
            console.error('Settings load error:', err);
        }
    }

    // ---- Render Table ----

    function renderTable() {
        const tableEl = document.getElementById('settings-table');
        tableEl.innerHTML = '';

        DataTable.render(tableEl, {
            columns: [
                { key: 'Name', label: 'Setting', width: '35%' },
                { key: 'Value', label: 'Value', render: (v) => Utils.truncate(v, 80) },
                {
                    key: '_actions', label: '', width: '80px', sortable: false,
                    render: (_, row) => `<button class="btn btn-outline btn-sm" data-action="edit-config" data-name="${row.Name}">Edit</button>`
                }
            ],
            data: configData,
            searchable: true,
            pageSize: 25,
            emptyMessage: 'No settings found'
        });

        // Attach edit handlers
        tableEl.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action="edit-config"]');
            if (btn) {
                const name = btn.getAttribute('data-name');
                const row = configData.find(r => r.Name === name);
                if (row) openEditConfigModal(row);
            }
        });
    }

    // ---- Edit Modal ----

    function openEditConfigModal(row) {
        Modal.open({
            title: `Edit: ${row.Name}`,
            fields: [
                { key: 'Name', label: 'Setting Name', type: 'text', readonly: true },
                { key: 'Value', label: 'Value', type: row.Value && row.Value.length > 100 ? 'textarea' : 'text' }
            ],
            data: row,
            onSave: async (result) => {
                await API.Settings.update({ Name: row.Name, Value: result.Value });
                await loadData();
            }
        });
    }

    // Initial load
    loadData();
});
