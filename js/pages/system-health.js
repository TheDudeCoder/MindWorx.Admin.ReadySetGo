/* ============================================================
   MindWorx Admin — System Health Page
   Workflow execution stats, logs viewer, AI cost tracker
   ============================================================ */

Router.register('system-health', async (container) => {
    container.innerHTML = `
        <div class="page-header flex justify-between items-center">
            <div>
                <h1 class="page-title">System Health</h1>
                <p class="page-subtitle">Workflow executions, logs, and AI cost tracking</p>
            </div>
            <div id="health-date-range"></div>
        </div>

        <div id="health-kpi"></div>

        <div class="analytics-grid" style="margin-bottom:1.5rem;">
            <div class="card span-2">
                <div class="card-header"><h3>Operations Over Time</h3></div>
                <div class="card-body">
                    <div class="chart-container" style="height:250px;">
                        <canvas id="health-ops-chart"></canvas>
                    </div>
                </div>
            </div>
            <div class="card">
                <div class="card-header"><h3>Status Breakdown</h3></div>
                <div class="card-body">
                    <div class="chart-container" style="height:250px;">
                        <canvas id="health-status-chart"></canvas>
                    </div>
                </div>
            </div>
        </div>

        <!-- Filters -->
        <div class="flex gap-2 flex-wrap" style="margin-bottom:1rem;">
            <select class="select input-sm" id="health-filter-entity" style="width:auto;">
                <option value="">All Entities</option>
            </select>
            <select class="select input-sm" id="health-filter-status" style="width:auto;">
                <option value="">All Status</option>
                <option value="success">Success</option>
                <option value="error">Error</option>
                <option value="warning">Warning</option>
            </select>
            <select class="select input-sm" id="health-filter-category" style="width:auto;">
                <option value="">All Categories</option>
            </select>
        </div>

        <div id="health-table"></div>
    `;

    let allLogs = [];
    let dateRange = DateRange.render('health-date-range', (range) => loadData(range), '7d');

    // Filter change handlers
    ['health-filter-entity', 'health-filter-status', 'health-filter-category'].forEach(id => {
        document.getElementById(id).addEventListener('change', () => renderTable());
    });

    async function loadData(range) {
        try {
            const result = await API.Logs.lookup({ start_date: range.start, end_date: range.end });
            allLogs = result.data || result.results || [];

            populateFilters();
            renderKPIs();
            renderOpsChart();
            renderStatusChart();
            renderTable();
        } catch (err) {
            console.error('System Health load error:', err);
        }
    }

    function populateFilters() {
        // Entities
        const entities = [...new Set(allLogs.map(l => l.entity).filter(Boolean))];
        const entitySelect = document.getElementById('health-filter-entity');
        entitySelect.innerHTML = '<option value="">All Entities</option>' +
            entities.map(e => `<option value="${e}">${e}</option>`).join('');

        // Categories
        const categories = [...new Set(allLogs.map(l => l.category).filter(Boolean))];
        const catSelect = document.getElementById('health-filter-category');
        catSelect.innerHTML = '<option value="">All Categories</option>' +
            categories.map(c => `<option value="${c}">${c}</option>`).join('');
    }

    function renderKPIs() {
        const kpiEl = document.getElementById('health-kpi');
        kpiEl.innerHTML = '';

        const total = allLogs.length;
        const errors = allLogs.filter(l => l.status === 'error').length;
        const totalTokens = allLogs.reduce((sum, l) => sum + (parseInt(l.tokens) || 0), 0);
        const totalCost = allLogs.reduce((sum, l) => sum + (parseFloat(l.cost) || 0), 0);

        KPI.render(kpiEl, [
            { label: 'Operations', value: Utils.formatNumber(total), trend: 0, trendLabel: 'in period' },
            { label: 'Errors', value: Utils.formatNumber(errors), trend: errors > 0 ? -1 : 0, trendLabel: total > 0 ? `${((errors / total) * 100).toFixed(1)}% error rate` : '—' },
            { label: 'Total Tokens', value: Utils.formatNumber(totalTokens), trend: 0, trendLabel: 'AI usage' },
            { label: 'AI Cost', value: Utils.formatCurrency(totalCost), trend: 0, trendLabel: total > 0 ? `${Utils.formatCurrency(totalCost / total)} avg` : '—' }
        ]);
    }

    function renderOpsChart() {
        Charts.destroy('health-ops-chart');
        const colors = Charts.getThemeColors();

        // Group by date with success/error split
        const dateGroups = {};
        allLogs.forEach(l => {
            const date = (l.date_time || '').split('T')[0];
            if (!date) return;
            if (!dateGroups[date]) dateGroups[date] = { success: 0, error: 0 };
            if (l.status === 'error') dateGroups[date].error++;
            else dateGroups[date].success++;
        });

        const dates = Object.keys(dateGroups).sort();

        Charts.create('health-ops-chart', 'bar', {
            labels: dates.map(d => Utils.formatDate(d)),
            datasets: [
                {
                    label: 'Success',
                    data: dates.map(d => dateGroups[d].success),
                    backgroundColor: 'hsla(142, 76%, 36%, 0.7)',
                    borderRadius: 4,
                    borderSkipped: false
                },
                {
                    label: 'Errors',
                    data: dates.map(d => dateGroups[d].error),
                    backgroundColor: 'hsla(0, 84%, 60%, 0.7)',
                    borderRadius: 4,
                    borderSkipped: false
                }
            ]
        }, {
            plugins: { legend: { position: 'top' } },
            scales: {
                x: { stacked: true },
                y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1 } }
            }
        });
    }

    function renderStatusChart() {
        Charts.destroy('health-status-chart');
        const colors = Charts.getThemeColors();

        const statusCounts = {};
        allLogs.forEach(l => {
            const s = l.status || 'unknown';
            statusCounts[s] = (statusCounts[s] || 0) + 1;
        });

        Charts.create('health-status-chart', 'doughnut', {
            labels: Object.keys(statusCounts),
            datasets: [{
                data: Object.values(statusCounts),
                backgroundColor: Object.keys(statusCounts).map(s => {
                    if (s === 'success') return 'hsla(142, 76%, 36%, 0.8)';
                    if (s === 'error') return 'hsla(0, 84%, 60%, 0.8)';
                    if (s === 'warning') return 'hsla(38, 92%, 50%, 0.8)';
                    return 'hsla(160, 20%, 40%, 0.6)';
                }),
                borderWidth: 0
            }]
        }, {
            plugins: { legend: { position: 'bottom' } }
        });
    }

    function renderTable() {
        const entityFilter = document.getElementById('health-filter-entity').value;
        const statusFilter = document.getElementById('health-filter-status').value;
        const categoryFilter = document.getElementById('health-filter-category').value;

        let filtered = [...allLogs];
        if (entityFilter) filtered = filtered.filter(l => l.entity === entityFilter);
        if (statusFilter) filtered = filtered.filter(l => l.status === statusFilter);
        if (categoryFilter) filtered = filtered.filter(l => l.category === categoryFilter);

        const tableEl = document.getElementById('health-table');
        tableEl.innerHTML = '';

        DataTable.render(tableEl, {
            columns: [
                { key: 'date_time', label: 'Timestamp', render: (v) => Utils.formatDateTime(v) },
                { key: 'entity', label: 'Entity' },
                { key: 'action', label: 'Action' },
                { key: 'status', label: 'Status', render: (v) => Utils.statusBadge(v) },
                { key: 'workflow', label: 'Workflow', render: (v) => Utils.truncate(v, 30) },
                { key: 'category', label: 'Category' },
                { key: 'tokens', label: 'Tokens', render: (v) => Utils.formatNumber(v) },
                { key: 'cost', label: 'Cost', render: (v) => Utils.formatCurrency(v) },
                { key: 'notes', label: 'Notes', render: (v) => Utils.truncate(v, 40) }
            ],
            data: filtered,
            searchable: true,
            pageSize: 20,
            emptyMessage: 'No logs found for this period'
        });
    }

    loadData(dateRange);
});
