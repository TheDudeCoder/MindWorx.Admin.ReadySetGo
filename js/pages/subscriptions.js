/* ============================================================
   MindWorx Admin — Subscriptions Page
   Service cards with plan info, costs, quick links, burn rate
   ============================================================ */

Router.register('subscriptions', async (container) => {
    container.innerHTML = `
        <div class="page-header flex justify-between items-center">
            <div>
                <h1 class="page-title">Subscriptions</h1>
                <p class="page-subtitle">Services, plans, and monthly burn rate</p>
            </div>
            <button class="btn btn-primary btn-sm" id="btn-refresh-subs">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                </svg>
                Refresh
            </button>
        </div>

        <div id="subs-kpi"></div>

        <div id="subs-grid" style="display:grid;grid-template-columns:repeat(auto-fill, minmax(320px, 1fr));gap:1rem;margin-bottom:1.5rem;">
            <div class="flex justify-center items-center" style="padding:3rem;grid-column:1/-1;">
                <div class="spinner"></div>
            </div>
        </div>

        <div class="card" style="margin-bottom:1.5rem;">
            <div class="card-header"><h3>Monthly Burn Rate Breakdown</h3></div>
            <div class="card-body">
                <div class="chart-container" style="height:300px;">
                    <canvas id="subs-burn-chart"></canvas>
                </div>
            </div>
        </div>
    `;

    document.getElementById('btn-refresh-subs').addEventListener('click', loadData);

    async function loadData() {
        try {
            const result = await API.Expenses.lookup({});
            const data = result.data || result.results || [];

            renderKPIs(data);
            renderCards(data);
            renderBurnChart(data);
        } catch (err) {
            console.error('Subscriptions load error:', err);
            document.getElementById('subs-grid').innerHTML = `
                <div class="card" style="padding:2rem;text-align:center;grid-column:1/-1;">
                    <p class="text-destructive">${err.message}</p>
                    <p class="text-muted text-sm" style="margin-top:0.5rem;">
                        Expenses CRUD workflows may not be set up yet. 
                        Add expenses data to your Google Sheet and create the CRUD workflows.
                    </p>
                </div>
            `;
        }
    }

    function renderKPIs(data) {
        const kpiEl = document.getElementById('subs-kpi');
        kpiEl.innerHTML = '';

        let monthlyTotal = 0;
        let annualTotal = 0;

        data.forEach(e => {
            const cost = parseFloat(e.cost) || 0;
            const unit = (e.unit || '').toLowerCase();
            if (unit === 'monthly') { monthlyTotal += cost; annualTotal += cost * 12; }
            else if (unit === 'annual') { monthlyTotal += cost / 12; annualTotal += cost; }
            else if (unit === 'one-time') { /* skip for recurring */ }
            else { monthlyTotal += cost; annualTotal += cost * 12; } // default to monthly
        });

        // Count by expiration proximity
        const now = new Date();
        const soon = data.filter(e => {
            if (!e.expiration_date) return false;
            const exp = new Date(e.expiration_date);
            const daysLeft = (exp - now) / (1000 * 60 * 60 * 24);
            return daysLeft > 0 && daysLeft <= 30;
        });

        KPI.render(kpiEl, [
            { label: 'Total Services', value: Utils.formatNumber(data.length), trend: 0, trendLabel: 'active' },
            { label: 'Monthly Burn', value: Utils.formatCurrency(monthlyTotal), trend: 0, trendLabel: 'per month' },
            { label: 'Annual Cost', value: Utils.formatCurrency(annualTotal), trend: 0, trendLabel: 'projected' },
            { label: 'Expiring Soon', value: Utils.formatNumber(soon.length), trend: soon.length > 0 ? -1 : 0, trendLabel: 'next 30 days' }
        ]);
    }

    function renderCards(data) {
        const grid = document.getElementById('subs-grid');
        grid.innerHTML = '';

        if (data.length === 0) {
            grid.innerHTML = `
                <div class="card" style="padding:2rem;text-align:center;grid-column:1/-1;">
                    <p class="text-muted">No subscriptions found. Add services in your Expenses Google Sheet.</p>
                </div>
            `;
            return;
        }

        data.forEach(service => {
            const cost = parseFloat(service.cost) || 0;
            const unit = service.unit || 'monthly';
            const now = new Date();
            const exp = service.expiration_date ? new Date(service.expiration_date) : null;
            const daysLeft = exp ? Math.ceil((exp - now) / (1000 * 60 * 60 * 24)) : null;

            let expiryBadge = '';
            if (daysLeft !== null) {
                if (daysLeft <= 0) expiryBadge = '<span class="badge badge-destructive">Expired</span>';
                else if (daysLeft <= 7) expiryBadge = `<span class="badge badge-destructive">${daysLeft}d left</span>`;
                else if (daysLeft <= 30) expiryBadge = `<span class="badge badge-warning">${daysLeft}d left</span>`;
                else expiryBadge = `<span class="badge badge-success">${daysLeft}d left</span>`;
            }

            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <div class="card-header flex justify-between items-center">
                    <h3 style="font-size:1rem;">${service.name || 'Unknown Service'}</h3>
                    ${expiryBadge}
                </div>
                <div class="card-body">
                    <div class="flex justify-between items-center" style="margin-bottom:0.75rem;">
                        <span class="text-sm text-muted">Plan</span>
                        <span class="text-sm font-medium">${service.value || '—'}</span>
                    </div>
                    <div class="flex justify-between items-center" style="margin-bottom:0.75rem;">
                        <span class="text-sm text-muted">Cost</span>
                        <span class="text-sm font-semibold text-primary">${Utils.formatCurrency(cost)} / ${unit}</span>
                    </div>
                    ${service.description ? `
                    <div style="margin-bottom:0.75rem;">
                        <span class="text-xs text-muted">${service.description}</span>
                    </div>
                    ` : ''}
                    <div class="flex justify-between items-center text-xs text-muted">
                        <span>Start: ${Utils.formatDate(service.start_date)}</span>
                        <span>Exp: ${Utils.formatDate(service.expiration_date)}</span>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
    }

    function renderBurnChart(data) {
        Charts.destroy('subs-burn-chart');
        const colors = Charts.getThemeColors();

        const burnByService = {};
        data.forEach(e => {
            const name = e.name || 'Other';
            let monthlyCost = parseFloat(e.cost) || 0;
            const unit = (e.unit || '').toLowerCase();
            if (unit === 'annual') monthlyCost = monthlyCost / 12;
            else if (unit === 'one-time') return;
            burnByService[name] = (burnByService[name] || 0) + monthlyCost;
        });

        const sorted = Object.entries(burnByService).sort((a, b) => b[1] - a[1]);

        Charts.create('subs-burn-chart', 'bar', {
            labels: sorted.map(([name]) => name),
            datasets: [{
                label: 'Monthly Cost',
                data: sorted.map(([, cost]) => cost),
                backgroundColor: colors.bgColors[0],
                borderRadius: 6,
                borderSkipped: false
            }]
        }, {
            indexAxis: 'y',
            plugins: { legend: { display: false } },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: { callback: (v) => '$' + v.toFixed(0) }
                }
            }
        });
    }

    loadData();
});
