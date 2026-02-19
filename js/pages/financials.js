/* ============================================================
   MindWorx Admin — Financials Page
   P&L, Sales table, cost breakdown, revenue charts
   ============================================================ */

Router.register('financials', async (container) => {
    container.innerHTML = `
        <div class="page-header flex justify-between items-center">
            <div>
                <h1 class="page-title">Financials</h1>
                <p class="page-subtitle">Revenue, costs, and profit/loss</p>
            </div>
            <div id="fin-date-range"></div>
        </div>

        <div id="fin-kpi"></div>

        <div class="analytics-grid" style="margin-bottom:1.5rem;">
            <div class="card span-2">
                <div class="card-header"><h3>Monthly Run Rate Trends</h3></div>
                <div class="card-body">
                    <div class="chart-container" style="height:280px;">
                        <canvas id="fin-revenue-chart"></canvas>
                    </div>
                </div>
            </div>
            <div class="card">
                <div class="card-header"><h3>Cost Breakdown</h3></div>
                <div class="card-body">
                    <div class="chart-container" style="height:280px;">
                        <canvas id="fin-cost-chart"></canvas>
                    </div>
                </div>
            </div>
        </div>

        <!-- Tab Switcher -->
        <div class="flex gap-2 items-center" style="margin-bottom:1rem;">
            <button class="btn btn-primary btn-sm" id="tab-sales" data-tab="sales">Sales</button>
            <button class="btn btn-outline btn-sm" id="tab-expenses" data-tab="expenses">Expenses</button>
            <button class="btn btn-primary btn-sm" id="btn-add-sale" style="margin-left:auto;">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Add Sale
            </button>
            <button class="btn btn-primary btn-sm" id="btn-add-expense" style="display:none;">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Add Expense
            </button>
        </div>

        <div id="fin-table"></div>
    `;

    let currentTab = 'sales';
    let dateRange = DateRange.render('fin-date-range', (range) => loadData(range), '90d');
    let salesData = [];
    let expensesData = [];
    let aiCosts = 0;
    let salesLoaded = false;
    let expensesLoaded = false;
    let currentRange = null;

    document.getElementById('tab-sales').addEventListener('click', () => switchTab('sales'));
    document.getElementById('tab-expenses').addEventListener('click', () => switchTab('expenses'));
    document.getElementById('btn-add-sale').addEventListener('click', openAddSaleModal);
    document.getElementById('btn-add-expense').addEventListener('click', openAddExpenseModal);

    async function switchTab(tab) {
        currentTab = tab;
        document.getElementById('tab-sales').className = tab === 'sales' ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm';
        document.getElementById('tab-expenses').className = tab === 'expenses' ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm';
        document.getElementById('btn-add-sale').style.display = tab === 'sales' ? 'inline-flex' : 'none';
        document.getElementById('btn-add-expense').style.display = tab === 'expenses' ? 'inline-flex' : 'none';

        // Lazy-load if tab data not yet fetched
        if (tab === 'sales' && !salesLoaded && currentRange) {
            const salesResult = await API.Sales.lookup({ start_date: currentRange.start, end_date: currentRange.end }).catch(() => ({ data: [] }));
            salesData = salesResult.data || salesResult.results || [];
            salesLoaded = true;
            renderKPIs();
            renderRevenueChart();
        } else if (tab === 'expenses' && !expensesLoaded && currentRange) {
            const expensesResult = await API.Expenses.lookup({}).catch(() => ({ data: [] }));
            expensesData = expensesResult.data || expensesResult.results || [];
            expensesLoaded = true;
            renderKPIs();
            renderCostChart();
        }

        renderTable();
    }

    async function loadData(range) {
        currentRange = range;
        salesLoaded = false;
        expensesLoaded = false;

        try {
            // 1. Load active tab first for immediate table render
            if (currentTab === 'sales') {
                const salesResult = await API.Sales.lookup({ start_date: range.start, end_date: range.end }).catch(() => ({ data: [] }));
                salesData = salesResult.data || salesResult.results || [];
                salesLoaded = true;
            } else {
                const expensesResult = await API.Expenses.lookup({}).catch(() => ({ data: [] }));
                expensesData = expensesResult.data || expensesResult.results || [];
                expensesLoaded = true;
            }
            renderTable();

            // 2. Load logs for AI cost KPIs
            const logsResult = await API.Logs.lookup({ start_date: range.start, end_date: range.end }).catch(() => ({ data: [] }));
            const logs = logsResult.data || logsResult.results || [];
            aiCosts = logs.reduce((sum, l) => sum + (parseFloat(l.cost) || 0), 0);

            // 3. Load inactive tab data for complete KPIs/charts
            if (!salesLoaded) {
                const salesResult = await API.Sales.lookup({ start_date: range.start, end_date: range.end }).catch(() => ({ data: [] }));
                salesData = salesResult.data || salesResult.results || [];
                salesLoaded = true;
            }
            if (!expensesLoaded) {
                const expensesResult = await API.Expenses.lookup({}).catch(() => ({ data: [] }));
                expensesData = expensesResult.data || expensesResult.results || [];
                expensesLoaded = true;
            }

            // 4. Render everything with complete data
            renderKPIs();
            renderRevenueChart();
            renderCostChart();
        } catch (err) {
            console.error('Financials load error:', err);
        }
    }

    function renderKPIs() {
        const kpiEl = document.getElementById('fin-kpi');
        kpiEl.innerHTML = '';

        // Only Won sales generate revenue
        const wonSales = salesData.filter(s => (s.status || '').toLowerCase() === 'won');
        const wonRecurring = wonSales.filter(s => (s.contract_type || '').toLowerCase() !== 'one-time');

        const wonRevenue = wonSales.reduce((sum, s) => sum + (parseFloat(s.monthly_recurring_revenue) || 0) + (parseFloat(s.setup_fee) || 0), 0);
        const activeMRR = wonRecurring.reduce((sum, s) => sum + (parseFloat(s.monthly_recurring_revenue) || 0), 0);

        // Calculate monthly expenses
        const monthlyExpenses = expensesData.reduce((sum, e) => {
            const cost = parseFloat(e.cost) || 0;
            const unit = (e.unit || '').toLowerCase();
            if (unit === 'annual') return sum + (cost / 12);
            if (unit === 'monthly') return sum + cost;
            return sum;
        }, 0);

        const totalExpenses = monthlyExpenses + aiCosts;
        const profit = wonRevenue - totalExpenses;

        KPI.render(kpiEl, [
            { label: 'Won Revenue', value: Utils.formatCurrency(wonRevenue), trend: 0, trendLabel: `${wonSales.length} won sales` },
            { label: 'Active MRR', value: Utils.formatCurrency(activeMRR), trend: 0, trendLabel: `${wonRecurring.length} recurring` },
            { label: 'Total Costs', value: Utils.formatCurrency(totalExpenses), trend: 0, trendLabel: `incl. ${Utils.formatCurrency(aiCosts)} AI` },
            { label: 'Net Profit', value: Utils.formatCurrency(profit), trend: profit >= 0 ? 1 : -1, trendLabel: profit >= 0 ? 'Profitable' : 'Loss' }
        ]);
    }

    function renderRevenueChart() {
        Charts.destroy('fin-revenue-chart');
        const colors = Charts.getThemeColors();

        // Only Won + recurring sales count toward MRR trend
        const wonRecurring = salesData.filter(s =>
            (s.status || '').toLowerCase() === 'won' &&
            (s.contract_type || '').toLowerCase() !== 'one-time'
        );

        const revenueByMonth = {};
        wonRecurring.forEach(s => {
            const date = s.sale_date || s.contract_start_date || s.created_on || '';
            const month = date.substring(0, 7); // YYYY-MM
            if (month) revenueByMonth[month] = (revenueByMonth[month] || 0) + (parseFloat(s.monthly_recurring_revenue) || 0);
        });

        const months = Object.keys(revenueByMonth).sort();

        Charts.create('fin-revenue-chart', 'bar', {
            labels: months.map(m => {
                const [y, mo] = m.split('-');
                return new Date(y, parseInt(mo) - 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
            }),
            datasets: [{
                label: 'MRR',
                data: months.map(m => revenueByMonth[m]),
                backgroundColor: colors.bgColors[0],
                borderRadius: 6,
                borderSkipped: false
            }]
        }, {
            plugins: { legend: { display: false } },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { callback: (v) => '$' + v.toLocaleString() }
                }
            }
        });
    }

    function renderCostChart() {
        Charts.destroy('fin-cost-chart');
        const colors = Charts.getThemeColors();

        // Group expenses by name
        const costByService = {};
        expensesData.forEach(e => {
            const name = e.name || 'Other';
            costByService[name] = (costByService[name] || 0) + (parseFloat(e.cost) || 0);
        });
        if (aiCosts > 0) costByService['AI Usage'] = aiCosts;

        const labels = Object.keys(costByService);
        const values = Object.values(costByService);

        Charts.create('fin-cost-chart', 'doughnut', {
            labels,
            datasets: [{
                data: values,
                backgroundColor: colors.bgColors.slice(0, labels.length),
                borderWidth: 0
            }]
        }, {
            plugins: {
                legend: { position: 'bottom', labels: { font: { size: 10 } } },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `${ctx.label}: ${Utils.formatCurrency(ctx.parsed)}`
                    }
                }
            }
        });
    }

    function renderTable() {
        const tableEl = document.getElementById('fin-table');
        tableEl.innerHTML = '';

        if (currentTab === 'sales') {
            DataTable.render(tableEl, {
                columns: [
                    { key: 'sale_date', label: 'Date', render: (v) => Utils.formatDate(v) },
                    { key: 'service_name', label: 'Service' },
                    { key: 'package_type', label: 'Package' },
                    { key: 'contract_type', label: 'Contract' },
                    { key: 'monthly_recurring_revenue', label: 'MRR', render: (v) => Utils.formatCurrency(v) },
                    { key: 'setup_fee', label: 'Setup Fee', render: (v) => Utils.formatCurrency(v) },
                    { key: 'payment_status', label: 'Payment', render: (v) => Utils.statusBadge(v) },
                    { key: 'status', label: 'Status', render: (v) => Utils.statusBadge(v) },
                    {
                        key: '_actions', label: '', width: '80px', sortable: false,
                        render: (_, row) => `<button class="btn btn-outline btn-sm" data-action="edit-sale" data-id="${row.sale_id}">Edit</button>`
                    }
                ],
                data: salesData,
                searchable: true,
                pageSize: 15,
                emptyMessage: 'No sales records yet—add your first deal!'
            });

            // Attach edit handlers for sales
            tableEl.addEventListener('click', (e) => {
                const btn = e.target.closest('[data-action="edit-sale"]');
                if (btn) {
                    const saleId = btn.getAttribute('data-id');
                    const row = salesData.find(r => r.sale_id === saleId);
                    if (row) openEditSaleModal(row);
                }
            });
        } else {
            DataTable.render(tableEl, {
                columns: [
                    { key: 'name', label: 'Service' },
                    { key: 'type', label: 'Type' },
                    { key: 'url', label: 'URL', render: (v) => v ? `<a href="${v}" target="_blank" class="text-primary" style="text-decoration:underline;">${Utils.truncate(v, 30)}</a>` : '—' },
                    { key: 'description', label: 'Description', render: (v) => Utils.truncate(v, 40) },
                    { key: 'cost', label: 'Cost', render: (v) => Utils.formatCurrency(v) },
                    { key: 'unit', label: 'Billing' },
                    { key: 'start_date', label: 'Start', render: (v) => Utils.formatDate(v) },
                    { key: 'expiration_date', label: 'Expires', render: (v) => Utils.formatDate(v) },
                    {
                        key: '_actions', label: '', width: '80px', sortable: false,
                        render: (_, row) => `<button class="btn btn-outline btn-sm" data-action="edit-expense" data-name="${row.name}">Edit</button>`
                    }
                ],
                data: expensesData,
                searchable: true,
                pageSize: 15,
                emptyMessage: 'No expenses recorded yet'
            });

            // Attach edit handlers for expenses
            tableEl.addEventListener('click', (e) => {
                const btn = e.target.closest('[data-action="edit-expense"]');
                if (btn) {
                    const name = btn.getAttribute('data-name');
                    const row = expensesData.find(r => r.name === name);
                    if (row) openEditExpenseModal(row);
                }
            });
        }
    }

    // ---- Sale Modals ----

    let salesStatusOptions = ['New', 'Pending', 'Closed', 'Void'];
    let contractTypeOptions = ['Monthly', 'Annual', 'One-Time'];
    let packageTypeOptions = ['Basic', 'Standard', 'Premium'];

    function getSaleFields() {
        return [
            { key: 'sale_date', label: 'Sale Date', type: 'date' },
            { key: 'contact_id', label: 'Contact ID', type: 'text' },
            { key: 'service_name', label: 'Service Name', type: 'text' },
            { key: 'package_type', label: 'Package Type', type: 'select', options: packageTypeOptions },
            { key: 'lead_source', label: 'Lead Source', type: 'text' },
            { key: 'contract_type', label: 'Contract Type', type: 'select', options: contractTypeOptions },
            { key: 'monthly_recurring_revenue', label: 'MRR ($)', type: 'number' },
            { key: 'setup_fee', label: 'Setup Fee ($)', type: 'number' },
            { key: 'contract_start_date', label: 'Contract Start', type: 'date' },
            { key: 'contract_end_date', label: 'Contract End', type: 'date' },
            { key: 'payment_status', label: 'Payment Status', type: 'text' },
            { key: 'status', label: 'Status', type: 'select', options: salesStatusOptions }
        ];
    }

    function openEditSaleModal(row) {
        Modal.open({
            title: `Edit Sale: ${row.service_name || row.sale_id}`,
            fields: [
                { key: 'sale_id', label: 'Sale ID', type: 'text', readonly: true },
                ...getSaleFields()
            ],
            data: row,
            onSave: async (result) => {
                await API.Sales.update({ sale_id: row.sale_id, ...result });
                await loadData(dateRange);
            }
        });
    }

    function openAddSaleModal() {
        const today = new Date().toISOString().split('T')[0];
        Modal.open({
            title: 'Add New Sale',
            fields: getSaleFields(),
            data: {
                sale_date: today,
                contract_type: contractTypeOptions[0] || 'Monthly',
                package_type: packageTypeOptions[0] || 'Basic',
                status: salesStatusOptions[0] || 'New'
            },
            onSave: async (result) => {
                await API.Sales.create(result);
                await loadData(dateRange);
            }
        });
    }

    // ---- Expense Modals ----

    let expenseTypeOptions = ['Subscription', 'Purchase', 'Other'];
    let expenseUnitOptions = ['Monthly', 'Annual', 'One-Time'];

    function getExpenseFields() {
        return [
            { key: 'name', label: 'Service Name', type: 'text' },
            { key: 'type', label: 'Expense Type', type: 'select', options: expenseTypeOptions },
            { key: 'url', label: 'URL', type: 'text' },
            { key: 'description', label: 'Description', type: 'textarea' },
            { key: 'cost', label: 'Cost ($)', type: 'number' },
            { key: 'unit', label: 'Billing Cycle', type: 'select', options: expenseUnitOptions },
            { key: 'start_date', label: 'Start Date', type: 'date' },
            { key: 'expiration_date', label: 'Expiration Date', type: 'date' }
        ];
    }

    function openEditExpenseModal(row) {
        Modal.open({
            title: `Edit: ${row.name}`,
            fields: [
                { key: 'name', label: 'Service Name', type: 'text', readonly: true },
                ...getExpenseFields().slice(1)
            ],
            data: row,
            onSave: async (result) => {
                await API.Expenses.update({ name: row.name, ...result });
                await loadData(dateRange);
            },
            onDelete: async () => {
                await API.Expenses.delete({ name: row.name });
                await loadData(dateRange);
            }
        });
    }

    function openAddExpenseModal() {
        Modal.open({
            title: 'Add New Expense',
            fields: getExpenseFields(),
            data: { unit: expenseUnitOptions[0] || 'Monthly', type: expenseTypeOptions[0] || 'Subscription' },
            onSave: async (result) => {
                await API.Expenses.create(result);
                await loadData(dateRange);
            }
        });
    }

    // Load dynamic dropdown options, then initial data
    async function init() {
        try {
            const [typeResult, unitResult, salesStatusResult] = await Promise.all([
                API.ExpenseType.lookup().catch(() => ({ data: [] })),
                API.ExpenseUnit.lookup().catch(() => ({ data: [] })),
                API.SalesStatus.lookup().catch(() => ({ data: [] }))
            ]);

            const types = (typeResult.data || []).map(r => r.Name).filter(Boolean);
            const units = (unitResult.data || []).map(r => r.Name).filter(Boolean);
            const statuses = (salesStatusResult.data || []).map(r => r.Name).filter(Boolean);

            if (types.length > 0) expenseTypeOptions = types;
            if (units.length > 0) expenseUnitOptions = units;
            if (statuses.length > 0) salesStatusOptions = statuses;
        } catch (err) {
            console.warn('Could not load dropdown options, using defaults:', err);
        }

        loadData(dateRange);
    }

    init();
});
