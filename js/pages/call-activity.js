/* ============================================================
   MindWorx Admin — Call Activity Page
   Call logs, volume charts, AI agent performance stats
   ============================================================ */

Router.register('call-activity', async (container) => {
    container.innerHTML = `
        <div class="page-header flex justify-between items-center">
            <div>
                <h1 class="page-title">Call Activity</h1>
                <p class="page-subtitle">AI agent calls &amp; performance</p>
            </div>
            <div id="calls-date-range"></div>
        </div>

        <div id="calls-kpi"></div>

        <div class="analytics-grid" style="margin-bottom:1.5rem;">
            <div class="card span-2">
                <div class="card-header"><h3>Call Volume Over Time</h3></div>
                <div class="card-body">
                    <div class="chart-container" style="height:250px;">
                        <canvas id="calls-volume-chart"></canvas>
                    </div>
                </div>
            </div>
            <div class="card">
                <div class="card-header"><h3>Sentiment Breakdown</h3></div>
                <div class="card-body">
                    <div class="chart-container" style="height:250px;">
                        <canvas id="calls-sentiment-chart"></canvas>
                    </div>
                </div>
            </div>
        </div>

        <div id="calls-table"></div>
    `;

    let dateRange = DateRange.render('calls-date-range', (range) => loadData(range), '30d');

    async function loadData(range) {
        try {
            const result = await API.CallLog.lookup({ start_date: range.start, end_date: range.end });
            const data = result.data || result.results || [];

            renderKPIs(data);
            renderVolumeChart(data);
            renderSentimentChart(data);
            renderTable(data);
        } catch (err) {
            console.error('Call Activity load error:', err);
        }
    }

    function renderKPIs(data) {
        const kpiEl = document.getElementById('calls-kpi');
        kpiEl.innerHTML = '';

        const successful = data.filter(c => c.call_successful === 'true' || c.call_successful === true).length;
        const totalDuration = data.reduce((sum, c) => sum + (parseInt(c.call_duration_ms || c.duration_ms) || 0), 0);
        const avgDuration = data.length > 0 ? totalDuration / data.length : 0;
        const totalCost = data.reduce((sum, c) => sum + (parseFloat(c.call_cost || c.combined_cost) || 0), 0);

        KPI.render(kpiEl, [
            { label: 'Total Calls', value: Utils.formatNumber(data.length), trend: 0, trendLabel: 'in period' },
            { label: 'Success Rate', value: data.length > 0 ? `${((successful / data.length) * 100).toFixed(0)}%` : '—', trend: 0, trendLabel: `${successful} successful` },
            { label: 'Avg Duration', value: Utils.formatDuration(avgDuration), trend: 0, trendLabel: `${Utils.formatDuration(totalDuration)} total` },
            { label: 'Call Cost', value: Utils.formatCurrency(totalCost), trend: 0, trendLabel: data.length > 0 ? `${Utils.formatCurrency(totalCost / data.length)} avg` : '—' }
        ]);
    }

    function renderVolumeChart(data) {
        Charts.destroy('calls-volume-chart');
        const dateCounts = {};
        data.forEach(c => {
            const date = (c.call_started_at || c.created_on || '').split('T')[0];
            if (date) dateCounts[date] = (dateCounts[date] || 0) + 1;
        });
        const sorted = Object.entries(dateCounts).sort((a, b) => a[0].localeCompare(b[0]));
        const colors = Charts.getThemeColors();

        Charts.create('calls-volume-chart', 'bar', {
            labels: sorted.map(([d]) => Utils.formatDate(d)),
            datasets: [{
                label: 'Calls',
                data: sorted.map(([, c]) => c),
                backgroundColor: colors.primaryAlpha,
                borderColor: colors.primary,
                borderWidth: 1,
                borderRadius: 4,
                borderSkipped: false
            }]
        }, {
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
        });
    }

    function renderSentimentChart(data) {
        Charts.destroy('calls-sentiment-chart');
        const sentiments = {};
        data.forEach(c => {
            const s = c.user_sentiment || 'Unknown';
            sentiments[s] = (sentiments[s] || 0) + 1;
        });

        const labels = Object.keys(sentiments);
        const values = Object.values(sentiments);
        const colors = Charts.getThemeColors();

        Charts.create('calls-sentiment-chart', 'doughnut', {
            labels,
            datasets: [{
                data: values,
                backgroundColor: colors.bgColors.slice(0, labels.length),
                borderWidth: 0
            }]
        }, {
            plugins: { legend: { position: 'bottom' } }
        });
    }

    function renderTable(data) {
        const tableEl = document.getElementById('calls-table');
        tableEl.innerHTML = '';

        DataTable.render(tableEl, {
            columns: [
                { key: 'full_name', label: 'Contact' },
                { key: 'call_direction', label: 'Direction', render: (v) => v === 'inbound' ? '📞 In' : '📱 Out' },
                { key: 'call_started_at', label: 'Date', render: (v) => Utils.formatDateTime(v) },
                { key: 'call_duration_ms', label: 'Duration', render: (v, row) => Utils.formatDuration(v || row.duration_ms) },
                { key: 'final_status', label: 'Status', render: (v, row) => Utils.statusBadge(v || row.finalStatus) },
                { key: 'user_sentiment', label: 'Sentiment' },
                { key: 'call_cost', label: 'Cost', render: (v, row) => Utils.formatCurrency(v || row.combined_cost) },
                { key: 'call_summary', label: 'Summary', render: (v) => Utils.truncate(v, 40) }
            ],
            data,
            searchable: true,
            pageSize: 15,
            emptyMessage: 'No call logs found for this period'
        });
    }

    loadData(dateRange);
});
