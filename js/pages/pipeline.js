/* ============================================================
   MindWorx Admin — Pipeline Page
   Leads and Contacts tables with status funnel
   ============================================================ */

Router.register('pipeline', async (container) => {
    container.innerHTML = `
        <div class="page-header flex justify-between items-center">
            <div>
                <h1 class="page-title">Pipeline</h1>
                <p class="page-subtitle">Leads &amp; Contacts funnel</p>
            </div>
            <div id="pipeline-date-range"></div>
        </div>

        <div id="pipeline-kpi"></div>

        <!-- Tab Switcher + Status Filter -->
        <div class="flex gap-2 items-center" style="margin-bottom:1rem;">
            <button class="btn btn-primary btn-sm" id="tab-contacts" data-tab="contacts">Contacts</button>
            <button class="btn btn-outline btn-sm" id="tab-leads" data-tab="leads">Leads</button>
            <div style="margin-left:auto;">
                <select class="input" id="pipeline-status-filter" style="font-size:0.85rem;padding:0.3rem 0.75rem;min-width:160px;">
                    <option value="">All Statuses</option>
                </select>
            </div>
        </div>

        <div id="pipeline-table"></div>
    `;

    let currentTab = 'contacts';
    let currentStatusFilter = '';
    let contactStatuses = [];
    let leadStatuses = [];
    let contactsData = [];
    let leadsData = [];
    let dateRange = DateRange.render('pipeline-date-range', (range) => { dateRange = range; loadData(range); }, '30d');

    // Tab switching
    document.getElementById('tab-contacts').addEventListener('click', () => switchTab('contacts'));
    document.getElementById('tab-leads').addEventListener('click', () => switchTab('leads'));

    // Status filter
    const statusFilterEl = document.getElementById('pipeline-status-filter');
    statusFilterEl.addEventListener('change', () => {
        currentStatusFilter = statusFilterEl.value;
        loadData(dateRange);
    });

    function switchTab(tab) {
        currentTab = tab;
        document.getElementById('tab-contacts').className = tab === 'contacts' ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm';
        document.getElementById('tab-leads').className = tab === 'leads' ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm';
        currentStatusFilter = '';
        rebuildStatusFilterOptions();
        loadData(dateRange);
    }

    function rebuildStatusFilterOptions() {
        const statuses = currentTab === 'contacts' ? contactStatuses : leadStatuses;
        statusFilterEl.innerHTML = '<option value="">All Statuses</option>' +
            statuses.map(s => `<option value="${s}">${s}</option>`).join('');
        statusFilterEl.value = currentStatusFilter;
    }

    async function loadData(range) {
        try {
            const tableEl = document.getElementById('pipeline-table');
            tableEl.innerHTML = '<div class="flex justify-center" style="padding:2rem;"><div class="spinner"></div></div>';

            if (currentTab === 'contacts') {
                const filters = { start_date: range.start, end_date: range.end };
                if (currentStatusFilter) filters.status = currentStatusFilter;
                const result = await API.Contacts.lookup(filters);
                contactsData = result.data || result.results || [];
                renderKPIs(contactsData, 'contacts');
                renderContactsTable(contactsData, tableEl);
            } else {
                const filters = { start_date: range.start, end_date: range.end };
                if (currentStatusFilter) filters.status = currentStatusFilter;
                const result = await API.Leads.lookup(filters);
                leadsData = result.data || result.results || [];
                renderKPIs(leadsData, 'leads');
                renderLeadsTable(leadsData, tableEl);
            }
        } catch (err) {
            console.error('Pipeline load error:', err);
            document.getElementById('pipeline-table').innerHTML = `
                <div class="card" style="padding:2rem;text-align:center;">
                    <p class="text-destructive">${err.message}</p>
                </div>
            `;
        }
    }

    function renderKPIs(data, type) {
        const kpiEl = document.getElementById('pipeline-kpi');
        kpiEl.innerHTML = '';

        const statusCounts = {};
        data.forEach(d => {
            const s = d.status || 'Unknown';
            statusCounts[s] = (statusCounts[s] || 0) + 1;
        });

        const cards = [{ label: `Total ${type === 'contacts' ? 'Contacts' : 'Leads'}`, value: Utils.formatNumber(data.length), trend: 0, trendLabel: 'in period' }];

        Object.entries(statusCounts).slice(0, 3).forEach(([status, count]) => {
            cards.push({ label: status, value: Utils.formatNumber(count), trend: 0, trendLabel: `${((count / data.length) * 100).toFixed(0)}%` });
        });

        KPI.render(kpiEl, cards);
    }

    // ---- Status Select Builder ----

    function buildStatusSelect(currentStatus, statuses, idField, idValue) {
        const opts = statuses.map(s =>
            `<option value="${s}" ${s === currentStatus ? 'selected' : ''}>${s}</option>`
        ).join('');
        return `<select class="input status-select" data-type="${currentTab}" data-id-field="${idField}" data-id="${idValue}" style="font-size:0.8rem;padding:0.25rem 0.5rem;min-width:130px;">${opts}</select>`;
    }

    // ---- Handle inline status change ----

    function attachStatusChangeHandlers(tableEl) {
        tableEl.addEventListener('change', async (e) => {
            const sel = e.target.closest('.status-select');
            if (!sel) return;

            const newStatus = sel.value;
            const type = sel.dataset.type;
            const idField = sel.dataset.idField;
            const id = sel.dataset.id;

            sel.disabled = true;
            sel.style.opacity = '0.5';

            try {
                if (type === 'contacts') {
                    await API.Contacts.update({ [idField]: id, status: newStatus });
                } else {
                    await API.Leads.update({ [idField]: id, status: newStatus });
                }
                // Update local data
                const dataset = type === 'contacts' ? contactsData : leadsData;
                const row = dataset.find(r => String(r[idField]) === String(id));
                if (row) row.status = newStatus;
                renderKPIs(dataset, type);
            } catch (err) {
                console.error('Status update error:', err);
                sel.value = sel.dataset.previousValue || '';
            } finally {
                sel.disabled = false;
                sel.style.opacity = '1';
            }
        });

        // Store previous value on focus for rollback
        tableEl.addEventListener('focus', (e) => {
            if (e.target.classList.contains('status-select')) {
                e.target.dataset.previousValue = e.target.value;
            }
        }, true);
    }

    // ---- Contacts Table ----

    function renderContactsTable(data, tableEl) {
        tableEl.innerHTML = '';
        DataTable.render(tableEl, {
            columns: [
                { key: 'full_name', label: 'Name' },
                { key: 'company_name', label: 'Company', render: (v) => Utils.truncate(v, 30) },
                { key: 'phone', label: 'Phone' },
                { key: 'status', label: 'Status', render: (v, row) => buildStatusSelect(v, contactStatuses, 'contact_id', row.contact_id) },
                { key: 'source', label: 'Source' },
                { key: 'created_on', label: 'Created', render: (v) => Utils.formatDate(v) },
                {
                    key: '_actions', label: '', width: '80px', sortable: false,
                    render: (_, row) => `<button class="btn btn-outline btn-sm" data-action="edit-contact" data-id="${row.contact_id}">Edit</button>`
                }
            ],
            data,
            searchable: true,
            pageSize: 15,
            emptyMessage: 'No contacts found for this period'
        });

        attachStatusChangeHandlers(tableEl);

        // Edit button handler
        tableEl.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action="edit-contact"]');
            if (!btn) return;
            const id = btn.dataset.id;
            const row = contactsData.find(r => String(r.contact_id) === String(id));
            if (row) openContactModal(row);
        });
    }

    // ---- Leads Table ----

    function renderLeadsTable(data, tableEl) {
        tableEl.innerHTML = '';
        DataTable.render(tableEl, {
            columns: [
                { key: 'business_name', label: 'Business' },
                { key: 'category', label: 'Category' },
                { key: 'phone', label: 'Phone' },
                { key: 'status', label: 'Status', render: (v, row) => buildStatusSelect(v, leadStatuses, 'lead_id', row.lead_id) },
                { key: 'source', label: 'Source' },
                { key: 'rating', label: 'Rating', render: (v) => v ? `⭐ ${v}` : '—' },
                { key: 'discovered_at', label: 'Found', render: (v) => Utils.formatDate(v) },
                {
                    key: '_actions', label: '', width: '80px', sortable: false,
                    render: (_, row) => `<button class="btn btn-outline btn-sm" data-action="edit-lead" data-id="${row.lead_id}">Edit</button>`
                }
            ],
            data,
            searchable: true,
            pageSize: 15,
            emptyMessage: 'No leads found for this period'
        });

        attachStatusChangeHandlers(tableEl);

        // Edit button handler
        tableEl.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action="edit-lead"]');
            if (!btn) return;
            const id = btn.dataset.id;
            const row = leadsData.find(r => String(r.lead_id) === String(id));
            if (row) openLeadModal(row);
        });
    }

    // ---- Contact Edit Modal ----

    function openContactModal(row) {
        Modal.open({
            title: `Edit: ${row.full_name || 'Contact'}`,
            fields: [
                { key: 'contact_id', label: 'Contact ID', type: 'text', readonly: true },
                { key: 'full_name', label: 'Full Name', type: 'text' },
                { key: 'email', label: 'Email', type: 'text' },
                { key: 'phone', label: 'Phone', type: 'text' },
                { key: 'company_name', label: 'Company', type: 'text' },
                { key: 'title', label: 'Title', type: 'text' },
                { key: 'status', label: 'Status', type: 'select', options: contactStatuses },
                { key: 'source', label: 'Source', type: 'text' },
                { key: 'zip', label: 'ZIP', type: 'text' },
                { key: 'subject', label: 'Subject', type: 'text' },
                { key: 'urgency_level', label: 'Urgency', type: 'text' },
                { key: 'call_summary', label: 'Last Call Summary', type: 'textarea', readonly: true }
            ],
            data: row,
            onSave: async (result) => {
                await API.Contacts.update({ contact_id: row.contact_id, ...result });
                await loadData(dateRange);
            }
        });
    }

    // ---- Lead Edit Modal ----

    function openLeadModal(row) {
        Modal.open({
            title: `Edit: ${row.business_name || 'Lead'}`,
            fields: [
                { key: 'lead_id', label: 'Lead ID', type: 'text', readonly: true },
                { key: 'business_name', label: 'Business Name', type: 'text' },
                { key: 'category', label: 'Category', type: 'text' },
                { key: 'email', label: 'Email', type: 'text' },
                { key: 'phone', label: 'Phone', type: 'text' },
                { key: 'website', label: 'Website', type: 'text' },
                { key: 'address', label: 'Address', type: 'text' },
                { key: 'status', label: 'Status', type: 'select', options: leadStatuses },
                { key: 'source', label: 'Source', type: 'text' },
                { key: 'rating', label: 'Rating', type: 'text', readonly: true },
                { key: 'review_count', label: 'Reviews', type: 'text', readonly: true },
                { key: 'notes', label: 'Notes', type: 'textarea' }
            ],
            data: row,
            onSave: async (result) => {
                await API.Leads.update({ lead_id: row.lead_id, ...result });
                await loadData(dateRange);
            }
        });
    }

    // ---- Init: load status options, then data ----

    async function init() {
        try {
            const [csResult, lsResult] = await Promise.all([
                API.ContactStatus.lookup().catch(() => ({ data: [] })),
                API.LeadStatus.lookup().catch(() => ({ data: [] }))
            ]);

            const cs = (csResult.data || []).map(r => r.Name).filter(Boolean);
            const ls = (lsResult.data || []).map(r => r.Name).filter(Boolean);

            if (cs.length > 0) contactStatuses = cs;
            if (ls.length > 0) leadStatuses = ls;
        } catch (err) {
            console.error('Failed to load status options:', err);
        }

        rebuildStatusFilterOptions();
        loadData(dateRange);
    }

    init();
});
