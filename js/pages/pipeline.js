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

        <!-- Tab Switcher -->
        <div class="flex gap-2" style="margin-bottom:1rem;">
            <button class="btn btn-primary btn-sm" id="tab-contacts" data-tab="contacts">Contacts</button>
            <button class="btn btn-outline btn-sm" id="tab-leads" data-tab="leads">Leads</button>
        </div>

        <div id="pipeline-table"></div>
    `;

    let currentTab = 'contacts';
    let dateRange = DateRange.render('pipeline-date-range', (range) => loadData(range), 'All');

    // Tab switching
    document.getElementById('tab-contacts').addEventListener('click', () => switchTab('contacts'));
    document.getElementById('tab-leads').addEventListener('click', () => switchTab('leads'));

    function switchTab(tab) {
        currentTab = tab;
        document.getElementById('tab-contacts').className = tab === 'contacts' ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm';
        document.getElementById('tab-leads').className = tab === 'leads' ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm';
        loadData(dateRange);
    }

    async function loadData(range) {
        try {
            const tableEl = document.getElementById('pipeline-table');
            tableEl.innerHTML = '<div class="flex justify-center" style="padding:2rem;"><div class="spinner"></div></div>';

            if (currentTab === 'contacts') {
                const result = await API.Contacts.lookup({});
                const allData = result.data || result.results || [];
                const data = filterByDate(allData, 'created_on', range);
                renderKPIs(data, 'contacts');
                renderContactsTable(data, tableEl);
            } else {
                const result = await API.Leads.lookup({});
                const allData = result.data || result.results || [];
                const data = filterByDate(allData, 'discovered_at', range);
                renderKPIs(data, 'leads');
                renderLeadsTable(data, tableEl);
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

    function filterByDate(records, dateField, range) {
        if (!range.start && !range.end) return records;
        return records.filter(r => {
            const val = r[dateField];
            if (!val) return false;
            const d = val.split('T')[0];
            if (range.start && d < range.start) return false;
            if (range.end && d > range.end) return false;
            return true;
        });
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

    function renderContactsTable(data, tableEl) {
        tableEl.innerHTML = '';
        DataTable.render(tableEl, {
            columns: [
                { key: 'full_name', label: 'Name' },
                { key: 'company_name', label: 'Company', render: (v) => Utils.truncate(v, 30) },
                { key: 'email', label: 'Email', render: (v) => v ? `<a href="mailto:${v}">${v}</a>` : '—' },
                { key: 'phone', label: 'Phone' },
                { key: 'status', label: 'Status', render: (v) => Utils.statusBadge(v) },
                { key: 'source', label: 'Source' },
                { key: 'created_on', label: 'Created', render: (v) => Utils.formatDate(v) }
            ],
            data,
            searchable: true,
            pageSize: 15,
            emptyMessage: 'No contacts found for this period'
        });
    }

    function renderLeadsTable(data, tableEl) {
        tableEl.innerHTML = '';
        DataTable.render(tableEl, {
            columns: [
                { key: 'business_name', label: 'Business' },
                { key: 'category', label: 'Category' },
                { key: 'email', label: 'Email', render: (v) => v ? `<a href="mailto:${v}">${v}</a>` : '—' },
                { key: 'phone', label: 'Phone' },
                { key: 'status', label: 'Status', render: (v) => Utils.statusBadge(v) },
                { key: 'source', label: 'Source' },
                { key: 'rating', label: 'Rating', render: (v) => v ? `⭐ ${v}` : '—' },
                { key: 'review_count', label: 'Reviews' },
                { key: 'discovered_at', label: 'Found', render: (v) => Utils.formatDate(v) }
            ],
            data,
            searchable: true,
            pageSize: 15,
            emptyMessage: 'No leads found for this period'
        });
    }

    loadData(dateRange);
});
