/* ============================================================
   MindWorx Admin — System Health Page
   Workflow execution stats, logs viewer, AI cost tracker
   Two tabs: Logs | Executions
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

        <!-- Tab Switcher -->
        <div class="flex gap-2 items-center" style="margin-bottom:1rem;">
            <button class="btn btn-primary btn-sm" id="tab-logs" data-tab="logs">Logs</button>
            <button class="btn btn-outline btn-sm" id="tab-executions" data-tab="executions">Executions</button>
            <button class="btn btn-outline btn-sm" id="btn-refresh-health" style="margin-left:auto;">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                </svg>
                Refresh
            </button>
        </div>

        <!-- Logs Filters -->
        <div id="logs-filters" class="flex gap-2 flex-wrap" style="margin-bottom:1rem;">
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

        <!-- Executions Filters -->
        <div id="exec-filters" class="flex gap-2 flex-wrap" style="margin-bottom:1rem;display:none;">
            <select class="select input-sm" id="exec-filter-workflow" style="width:auto;">
                <option value="">All Workflows</option>
            </select>
            <select class="select input-sm" id="exec-filter-status" style="width:auto;">
                <option value="">All Status</option>
                <option value="success">Success</option>
                <option value="error">Error</option>
                <option value="waiting">Waiting</option>
            </select>
        </div>

        <div id="health-table"></div>
    `;

    let currentTab = 'logs';
    let allLogs = [];
    let allExecutions = [];
    let workflowNameMap = {};
    let dateRange = DateRange.render('health-date-range', (range) => loadData(range), '7d');

    // Tab switching
    document.getElementById('tab-logs').addEventListener('click', () => switchTab('logs'));
    document.getElementById('tab-executions').addEventListener('click', () => switchTab('executions'));
    document.getElementById('btn-refresh-health').addEventListener('click', () => loadData(dateRange));

    // Filter change handlers
    ['health-filter-entity', 'health-filter-status', 'health-filter-category'].forEach(id => {
        document.getElementById(id).addEventListener('change', () => renderTable());
    });
    ['exec-filter-workflow', 'exec-filter-status'].forEach(id => {
        document.getElementById(id).addEventListener('change', () => renderTable());
    });

    function switchTab(tab) {
        currentTab = tab;
        document.getElementById('tab-logs').className = tab === 'logs' ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm';
        document.getElementById('tab-executions').className = tab === 'executions' ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm';
        document.getElementById('logs-filters').style.display = tab === 'logs' ? 'flex' : 'none';
        document.getElementById('exec-filters').style.display = tab === 'executions' ? 'flex' : 'none';
        renderTable();
    }

    // ---- Load Data ----

    async function loadData(range) {
        try {
            const [logsResult, execResult] = await Promise.all([
                API.Logs.lookup({ start_date: range.start, end_date: range.end }).catch(() => ({ data: [] })),
                API.Executions.lookup({}).catch(() => ({ data: [] }))
            ]);

            allLogs = logsResult.data || logsResult.results || [];
            allExecutions = execResult.data || execResult.results || [];

            // Normalize executions — ensure they're an array
            if (!Array.isArray(allExecutions)) allExecutions = [];

            // Build workflow name map from execution data
            workflowNameMap = {};
            allExecutions.forEach(exec => {
                const id = exec.workflow_id;
                const name = exec.workflow_name;
                if (id && name && name !== id) {
                    workflowNameMap[id] = name;
                }
            });

            // Enrich executions with display name: "Name (ID)"
            allExecutions.forEach(exec => {
                const id = exec.workflow_id;
                const name = workflowNameMap[id];
                exec._display_name = name
                    ? `${name} (${id})`
                    : id || '—';
            });

            populateLogsFilters();
            populateExecFilters();
            renderKPIs();
            renderOpsChart();
            renderStatusChart();
            renderTable();
        } catch (err) {
            console.error('System Health load error:', err);
        }
    }

    // ---- Logs Filters ----

    function populateLogsFilters() {
        const entities = [...new Set(allLogs.map(l => l.entity).filter(Boolean))].sort();
        const entitySelect = document.getElementById('health-filter-entity');
        entitySelect.innerHTML = '<option value="">All Entities</option>' +
            entities.map(e => `<option value="${e}">${e}</option>`).join('');

        const categories = [...new Set(allLogs.map(l => l.category).filter(Boolean))].sort();
        const catSelect = document.getElementById('health-filter-category');
        catSelect.innerHTML = '<option value="">All Categories</option>' +
            categories.map(c => `<option value="${c}">${c}</option>`).join('');
    }

    // ---- Executions Filters ----

    function populateExecFilters() {
        // Build unique workflow entries with display names
        const wfEntries = new Map();
        allExecutions.forEach(e => {
            const id = e.workflow_id;
            if (id && !wfEntries.has(id)) {
                const name = workflowNameMap[id];
                wfEntries.set(id, name ? `${name} (${id})` : id);
            }
        });
        const sorted = [...wfEntries.entries()].sort((a, b) => a[1].localeCompare(b[1]));
        const wfSelect = document.getElementById('exec-filter-workflow');
        wfSelect.innerHTML = '<option value="">All Workflows</option>' +
            sorted.map(([id, display]) => `<option value="${id}">${Utils.truncate(display, 55)}</option>`).join('');
    }

    // ---- KPIs (based on Logs) ----

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

    // ---- Charts ----

    function renderOpsChart() {
        Charts.destroy('health-ops-chart');

        const dateGroups = {};
        allLogs.forEach(l => {
            const dt = l.created_on || '';
            const date = dt.includes('T') ? dt.split('T')[0] : dt.split(' ')[0];
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

    // ---- Render Table ----

    function renderTable() {
        const tableEl = document.getElementById('health-table');
        tableEl.innerHTML = '';

        if (currentTab === 'logs') {
            renderLogsTable(tableEl);
        } else {
            renderExecutionsTable(tableEl);
        }
    }

    function renderLogsTable(tableEl) {
        const entityFilter = document.getElementById('health-filter-entity').value;
        const statusFilter = document.getElementById('health-filter-status').value;
        const categoryFilter = document.getElementById('health-filter-category').value;

        let filtered = [...allLogs];
        if (entityFilter) filtered = filtered.filter(l => l.entity === entityFilter);
        if (statusFilter) filtered = filtered.filter(l => l.status === statusFilter);
        if (categoryFilter) filtered = filtered.filter(l => l.category === categoryFilter);

        // Sort by date descending
        filtered.sort((a, b) => (b.created_on || '').localeCompare(a.created_on || ''));

        DataTable.render(tableEl, {
            columns: [
                { key: 'created_on', label: 'Timestamp', render: (v) => Utils.formatDateTime(v) },
                { key: 'entity', label: 'Entity' },
                { key: 'action', label: 'Action' },
                { key: 'status', label: 'Status', render: (v) => Utils.statusBadge(v) },
                { key: 'workflow', label: 'Workflow', render: (v) => Utils.truncate(v, 30) },
                { key: 'category', label: 'Category' },
                { key: 'notes', label: 'Notes', render: (v) => Utils.truncate(v, 40) },
                {
                    key: '_actions', label: '', width: '70px', sortable: false,
                    render: (_, row) => `<button class="btn btn-ghost btn-sm detail-btn" data-id="${row.log_id}" data-type="log" style="padding:0.2rem 0.5rem;font-size:0.75rem;">View</button>`
                }
            ],
            data: filtered,
            searchable: true,
            pageSize: 20,
            emptyMessage: 'No logs found for this period'
        });

        // Attach click handlers for View buttons
        tableEl.querySelectorAll('.detail-btn[data-type="log"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const logId = btn.getAttribute('data-id');
                const log = allLogs.find(l => l.log_id === logId);
                if (log) showDetailModal('log', log);
            });
        });
    }

    function renderExecutionsTable(tableEl) {
        const wfFilter = document.getElementById('exec-filter-workflow').value;
        const statusFilter = document.getElementById('exec-filter-status').value;

        let filtered = [...allExecutions];
        if (wfFilter) filtered = filtered.filter(e => e.workflow_id === wfFilter);
        if (statusFilter) filtered = filtered.filter(e => (e.status || '').toLowerCase() === statusFilter);

        // Sort by started_at descending
        filtered.sort((a, b) => (b.started_at || '').localeCompare(a.started_at || ''));

        DataTable.render(tableEl, {
            columns: [
                {
                    key: 'started_at', label: 'Started',
                    render: (v) => Utils.formatDateTime(v)
                },
                {
                    key: '_display_name', label: 'Workflow',
                    render: (v) => Utils.truncate(v || '—', 55)
                },
                {
                    key: 'status', label: 'Status',
                    render: (v) => Utils.statusBadge((v || '').toLowerCase())
                },
                {
                    key: 'duration_ms', label: 'Duration',
                    render: (v) => {
                        if (v == null) return '—';
                        if (v < 1000) return `${v}ms`;
                        if (v < 60000) return `${(v / 1000).toFixed(1)}s`;
                        return `${(v / 60000).toFixed(1)}m`;
                    }
                },
                {
                    key: 'mode', label: 'Mode',
                    render: (v) => v || '—'
                },
                {
                    key: '_actions', label: '', width: '70px', sortable: false,
                    render: (_, row) => `<button class="btn btn-ghost btn-sm detail-btn" data-id="${row.execution_id || row.id}" data-type="exec" style="padding:0.2rem 0.5rem;font-size:0.75rem;">View</button>`
                }
            ],
            data: filtered,
            searchable: true,
            pageSize: 20,
            emptyMessage: 'No executions found'
        });

        // Attach click handlers for View buttons
        tableEl.querySelectorAll('.detail-btn[data-type="exec"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const execId = btn.getAttribute('data-id');
                const exec = allExecutions.find(e => (e.execution_id || e.id) === execId);
                if (exec) showDetailModal('exec', exec);
            });
        });
    }

    // ---- Detail Modal ----

    function showDetailModal(type, item) {
        // Remove any existing detail modal
        document.querySelectorAll('.detail-overlay').forEach(el => el.remove());

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay detail-overlay';

        let title, bodyHTML;

        if (type === 'log') {
            title = 'Log Details';
            // Extract n8n URL from notes if present
            const notesText = item.notes || '';
            const n8nUrlMatch = notesText.match(/(https?:\/\/[^\s]*n8n[^\s]*)/i);
            const logN8nUrl = n8nUrlMatch ? n8nUrlMatch[1] : null;

            bodyHTML = `
                <div class="detail-grid">
                    <div class="detail-row">
                        <span class="detail-label">Log ID</span>
                        <span class="detail-value text-sm text-muted">${item.log_id || '—'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Timestamp</span>
                        <span class="detail-value">${Utils.formatDateTime(item.created_on)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Entity</span>
                        <span class="detail-value">${item.entity || '—'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Entity ID</span>
                        <span class="detail-value">${item.entity_id || '—'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Action</span>
                        <span class="detail-value">${item.action || '—'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Status</span>
                        <span class="detail-value">${Utils.statusBadge(item.status)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Workflow</span>
                        <span class="detail-value">${item.workflow || '—'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Category</span>
                        <span class="detail-value">${item.category || '—'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Tokens</span>
                        <span class="detail-value">${Utils.formatNumber(item.tokens)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Cost</span>
                        <span class="detail-value">${Utils.formatCurrency(item.cost)}</span>
                    </div>
                    <div class="detail-row full-width">
                        <span class="detail-label">Notes</span>
                        <div class="detail-notes">${notesText || '—'}</div>
                    </div>
                    ${logN8nUrl ? `
                    <div class="detail-row full-width" style="margin-top:0.5rem;">
                        <a href="${logN8nUrl}" target="_blank" rel="noopener" class="btn btn-outline btn-sm" style="width:100%;text-align:center;">
                            Open in n8n ↗
                        </a>
                    </div>` : ''}
                </div>
            `;
        } else {
            title = 'Execution Details';
            const n8nUrl = item.execution_url || (item.workflow_id
                ? `https://n8n.srv1303475.hstgr.cloud/workflow/${item.workflow_id}/executions/${item.execution_id || item.id}`
                : null);

            bodyHTML = `
                <div class="detail-grid">
                    <div class="detail-row">
                        <span class="detail-label">Execution ID</span>
                        <span class="detail-value text-sm text-muted">${item.execution_id || item.id || '—'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Workflow</span>
                        <span class="detail-value">${workflowNameMap[item.workflow_id] || item.workflow_name || '—'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Workflow ID</span>
                        <span class="detail-value text-sm text-muted">${item.workflow_id || '—'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Status</span>
                        <span class="detail-value">${Utils.statusBadge((item.status || '').toLowerCase())}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Started</span>
                        <span class="detail-value">${Utils.formatDateTime(item.started_at)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Finished</span>
                        <span class="detail-value">${Utils.formatDateTime(item.finished_at)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Duration</span>
                        <span class="detail-value">${item.duration_ms != null ? (item.duration_ms < 1000 ? item.duration_ms + 'ms' : (item.duration_ms / 1000).toFixed(1) + 's') : '—'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Mode</span>
                        <span class="detail-value">${item.mode || '—'}</span>
                    </div>
                    ${item.error ? `
                    <div class="detail-row full-width">
                        <span class="detail-label">Error</span>
                        <div class="detail-notes" style="color:var(--destructive);">${item.error}</div>
                    </div>` : ''}
                    ${n8nUrl ? `
                    <div class="detail-row full-width" style="margin-top:0.5rem;">
                        <a href="${n8nUrl}" target="_blank" rel="noopener" class="btn btn-outline btn-sm" style="width:100%;text-align:center;">
                            Open in n8n ↗
                        </a>
                    </div>` : ''}
                </div>
            `;
        }

        overlay.innerHTML = `
            <div class="modal" style="max-width:540px;">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button class="btn btn-ghost btn-sm modal-close" aria-label="Close">&times;</button>
                </div>
                <div class="modal-body" style="padding:1.25rem;">
                    ${bodyHTML}
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline btn-sm" id="detail-close">Close</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Close handlers
        overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
        overlay.querySelector('#detail-close').addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    }

    loadData(dateRange);
});
