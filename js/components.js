/* ============================================================
   MindWorx Admin — Reusable Components
   Data tables, date pickers, chart helpers, KPI cards
   ============================================================ */

// --- Date Range Helpers ---

const DateRange = (() => {
    function getPresets() {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        return {
            'Today': {
                start: today.toISOString().split('T')[0],
                end: today.toISOString().split('T')[0]
            },
            '7d': {
                start: new Date(today - 7 * 86400000).toISOString().split('T')[0],
                end: today.toISOString().split('T')[0]
            },
            '30d': {
                start: new Date(today - 30 * 86400000).toISOString().split('T')[0],
                end: today.toISOString().split('T')[0]
            },
            '90d': {
                start: new Date(today - 90 * 86400000).toISOString().split('T')[0],
                end: today.toISOString().split('T')[0]
            },
            'YTD': {
                start: `${now.getFullYear()}-01-01`,
                end: today.toISOString().split('T')[0]
            },
            'All': { start: '', end: '' }
        };
    }

    function render(containerId, onChange, defaultPreset = '30d') {
        const container = document.getElementById(containerId);
        if (!container) return;

        const presets = getPresets();
        container.className = 'date-range-picker';
        container.innerHTML = '';

        // Preset buttons
        Object.entries(presets).forEach(([label, range]) => {
            const btn = document.createElement('button');
            btn.className = `preset-btn${label === defaultPreset ? ' active' : ''}`;
            btn.textContent = label;
            btn.addEventListener('click', () => {
                container.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Update custom inputs
                const startInput = container.querySelector('.date-start');
                const endInput = container.querySelector('.date-end');
                if (startInput) startInput.value = range.start;
                if (endInput) endInput.value = range.end;

                if (onChange) onChange(range);
            });
            container.appendChild(btn);
        });

        // Custom date inputs
        const inputsDiv = document.createElement('div');
        inputsDiv.className = 'date-inputs';

        const startInput = document.createElement('input');
        startInput.type = 'date';
        startInput.className = 'date-start';
        startInput.value = presets[defaultPreset]?.start || '';

        const toLabel = document.createElement('span');
        toLabel.textContent = '→';
        toLabel.className = 'text-muted text-sm';

        const endInput = document.createElement('input');
        endInput.type = 'date';
        endInput.className = 'date-end';
        endInput.value = presets[defaultPreset]?.end || '';

        const applyCustom = () => {
            container.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
            if (onChange) onChange({ start: startInput.value, end: endInput.value });
        };
        startInput.addEventListener('change', applyCustom);
        endInput.addEventListener('change', applyCustom);

        inputsDiv.append(startInput, toLabel, endInput);
        container.appendChild(inputsDiv);

        // Return initial range
        return presets[defaultPreset] || { start: '', end: '' };
    }

    return { render, getPresets };
})();


// --- KPI Card Builder ---

const KPI = (() => {
    function render(container, cards) {
        const grid = document.createElement('div');
        grid.className = 'kpi-grid';

        cards.forEach((card, i) => {
            const el = document.createElement('div');
            el.className = `card kpi-card${i === 0 ? ' highlighted' : ''}`;

            const trendClass = card.trend > 0 ? 'up' : card.trend < 0 ? 'down' : 'neutral';
            const trendIcon = card.trend > 0 ? '▲' : card.trend < 0 ? '▼' : '—';
            const trendText = card.trendLabel || (card.trend !== 0 ? `${Math.abs(card.trend)}%` : 'No change');

            el.innerHTML = `
                <div class="kpi-header">
                    <span class="kpi-label">${card.label}</span>
                    ${card.icon || ''}
                </div>
                <div class="kpi-value">${card.value}</div>
                <div class="kpi-trend ${trendClass}">
                    <span>${trendIcon}</span>
                    <span>${trendText}</span>
                </div>
            `;
            grid.appendChild(el);
        });

        if (typeof container === 'string') {
            document.getElementById(container).appendChild(grid);
        } else {
            container.appendChild(grid);
        }

        return grid;
    }

    return { render };
})();


// --- Data Table Builder ---

const DataTable = (() => {
    function render(container, config) {
        const {
            columns = [],
            data = [],
            searchable = true,
            sortable = true,
            pageSize = 15,
            emptyMessage = 'No data found'
        } = config;

        let currentData = [...data];
        let sortCol = null;
        let sortDir = 'asc';
        let currentPage = 0;
        let searchTerm = '';

        const wrapper = document.createElement('div');
        wrapper.className = 'table-wrapper';

        // --- Toolbar ---
        if (searchable) {
            const toolbar = document.createElement('div');
            toolbar.className = 'table-toolbar';

            const searchDiv = document.createElement('div');
            searchDiv.className = 'table-search';
            searchDiv.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input type="text" class="input" placeholder="Search..." />
            `;
            searchDiv.querySelector('input').addEventListener('input', (e) => {
                searchTerm = e.target.value.toLowerCase();
                currentPage = 0;
                renderTable();
            });
            toolbar.appendChild(searchDiv);

            const count = document.createElement('span');
            count.className = 'table-count text-sm text-muted';
            toolbar.appendChild(count);

            wrapper.appendChild(toolbar);
        }

        // --- Table ---
        const table = document.createElement('table');
        table.className = 'data-table';

        // Header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');

        columns.forEach(col => {
            const th = document.createElement('th');
            th.textContent = col.label || col.key;
            if (col.width) th.style.width = col.width;
            if (sortable && col.sortable !== false) {
                th.innerHTML += ' <span class="sort-icon">↕</span>';
                th.addEventListener('click', () => {
                    if (sortCol === col.key) {
                        sortDir = sortDir === 'asc' ? 'desc' : 'asc';
                    } else {
                        sortCol = col.key;
                        sortDir = 'asc';
                    }
                    thead.querySelectorAll('th').forEach(t => t.classList.remove('sorted'));
                    th.classList.add('sorted');
                    th.querySelector('.sort-icon').textContent = sortDir === 'asc' ? '↑' : '↓';
                    currentPage = 0;
                    renderTable();
                });
            }
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Body
        const tbody = document.createElement('tbody');
        table.appendChild(tbody);
        wrapper.appendChild(table);

        // --- Pagination ---
        const pagination = document.createElement('div');
        pagination.className = 'table-pagination';
        wrapper.appendChild(pagination);

        // --- Render ---
        function getFilteredData() {
            let filtered = [...currentData];

            if (searchTerm) {
                filtered = filtered.filter(row =>
                    columns.some(col => {
                        const val = row[col.key];
                        return val && String(val).toLowerCase().includes(searchTerm);
                    })
                );
            }

            if (sortCol) {
                filtered.sort((a, b) => {
                    let valA = a[sortCol] ?? '';
                    let valB = b[sortCol] ?? '';

                    if (typeof valA === 'number' && typeof valB === 'number') {
                        return sortDir === 'asc' ? valA - valB : valB - valA;
                    }

                    valA = String(valA).toLowerCase();
                    valB = String(valB).toLowerCase();
                    return sortDir === 'asc'
                        ? valA.localeCompare(valB)
                        : valB.localeCompare(valA);
                });
            }

            return filtered;
        }

        function renderTable() {
            const filtered = getFilteredData();
            const totalPages = Math.ceil(filtered.length / pageSize);
            const start = currentPage * pageSize;
            const pageData = filtered.slice(start, start + pageSize);

            // Update count
            const countEl = wrapper.querySelector('.table-count');
            if (countEl) countEl.textContent = `${filtered.length} result${filtered.length !== 1 ? 's' : ''}`;

            // Body
            tbody.innerHTML = '';
            if (pageData.length === 0) {
                const row = document.createElement('tr');
                row.innerHTML = `<td colspan="${columns.length}" class="table-empty">${emptyMessage}</td>`;
                tbody.appendChild(row);
            } else {
                pageData.forEach(item => {
                    const row = document.createElement('tr');
                    columns.forEach(col => {
                        const td = document.createElement('td');
                        if (col.render) {
                            td.innerHTML = col.render(item[col.key], item);
                        } else {
                            td.textContent = item[col.key] ?? '';
                        }
                        if (col.className) td.className = col.className;
                        row.appendChild(td);
                    });
                    tbody.appendChild(row);
                });
            }

            // Pagination
            pagination.innerHTML = `
                <span>Page ${totalPages > 0 ? currentPage + 1 : 0} of ${totalPages}</span>
                <div class="page-btns">
                    <button class="btn btn-ghost btn-sm" ${currentPage === 0 ? 'disabled' : ''} data-action="prev">← Prev</button>
                    <button class="btn btn-ghost btn-sm" ${currentPage >= totalPages - 1 ? 'disabled' : ''} data-action="next">Next →</button>
                </div>
            `;
            pagination.querySelector('[data-action="prev"]')?.addEventListener('click', () => { currentPage--; renderTable(); });
            pagination.querySelector('[data-action="next"]')?.addEventListener('click', () => { currentPage++; renderTable(); });
        }

        renderTable();

        // Update method
        wrapper.updateData = (newData) => {
            currentData = [...newData];
            currentPage = 0;
            renderTable();
        };

        if (typeof container === 'string') {
            document.getElementById(container).appendChild(wrapper);
        } else {
            container.appendChild(wrapper);
        }

        return wrapper;
    }

    return { render };
})();


// --- Chart Helpers ---

const Charts = (() => {
    const instances = {};

    function getThemeColors() {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        return {
            primary: 'hsl(158, 64%, 52%)',
            primaryAlpha: 'hsla(158, 64%, 52%, 0.2)',
            success: 'hsl(142, 76%, 36%)',
            warning: 'hsl(38, 92%, 50%)',
            destructive: 'hsl(0, 84%, 60%)',
            info: 'hsl(217, 91%, 60%)',
            text: isDark ? 'hsl(150, 20%, 95%)' : 'hsl(160, 30%, 10%)',
            muted: isDark ? 'hsl(155, 15%, 55%)' : 'hsl(160, 10%, 40%)',
            gridColor: isDark ? 'hsla(160, 20%, 18%, 0.8)' : 'hsla(160, 10%, 87%, 0.8)',
            bgColors: [
                'hsla(158, 64%, 52%, 0.7)',
                'hsla(142, 76%, 36%, 0.7)',
                'hsla(217, 91%, 60%, 0.7)',
                'hsla(38, 92%, 50%, 0.7)',
                'hsla(0, 84%, 60%, 0.7)',
                'hsla(280, 67%, 60%, 0.7)',
            ]
        };
    }

    function getDefaultOptions(type) {
        const colors = getThemeColors();
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: colors.muted, font: { family: 'Inter', size: 12 } }
                },
                tooltip: {
                    backgroundColor: 'hsl(160, 25%, 8%)',
                    titleColor: '#fff',
                    bodyColor: '#ccc',
                    cornerRadius: 8,
                    padding: 10,
                    titleFont: { family: 'Inter' },
                    bodyFont: { family: 'Inter' }
                }
            },
            scales: (type === 'pie' || type === 'doughnut') ? {} : {
                x: {
                    ticks: { color: colors.muted, font: { family: 'Inter', size: 11 } },
                    grid: { color: colors.gridColor }
                },
                y: {
                    ticks: { color: colors.muted, font: { family: 'Inter', size: 11 } },
                    grid: { color: colors.gridColor }
                }
            }
        };
    }

    function create(canvasId, type, data, customOptions = {}) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return null;

        // Destroy existing instance
        if (instances[canvasId]) {
            instances[canvasId].destroy();
        }

        const defaultOpts = getDefaultOptions(type);
        const options = mergeDeep(defaultOpts, customOptions);

        const chart = new Chart(canvas, { type, data, options });
        instances[canvasId] = chart;
        return chart;
    }

    function destroy(canvasId) {
        if (instances[canvasId]) {
            instances[canvasId].destroy();
            delete instances[canvasId];
        }
    }

    function destroyAll() {
        Object.keys(instances).forEach(destroy);
    }

    // Listen for theme changes and update
    window.addEventListener('themechange', () => {
        Object.entries(instances).forEach(([id, chart]) => {
            const colors = getThemeColors();
            const type = chart.config.type;

            if (chart.options.plugins?.legend?.labels) {
                chart.options.plugins.legend.labels.color = colors.muted;
            }
            if (chart.options.scales?.x) {
                chart.options.scales.x.ticks.color = colors.muted;
                chart.options.scales.x.grid.color = colors.gridColor;
            }
            if (chart.options.scales?.y) {
                chart.options.scales.y.ticks.color = colors.muted;
                chart.options.scales.y.grid.color = colors.gridColor;
            }
            chart.update('none');
        });
    });

    // Deep merge util
    function mergeDeep(target, source) {
        const output = { ...target };
        for (const key of Object.keys(source)) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                output[key] = mergeDeep(target[key] || {}, source[key]);
            } else {
                output[key] = source[key];
            }
        }
        return output;
    }

    return { create, destroy, destroyAll, getThemeColors };
})();


// --- Utility Functions ---

const Utils = (() => {
    function formatNumber(num) {
        if (num == null) return '—';
        if (typeof num === 'string') num = parseFloat(num);
        if (isNaN(num)) return '—';
        return num.toLocaleString();
    }

    function formatCurrency(num) {
        if (num == null) return '—';
        if (typeof num === 'string') num = parseFloat(num);
        if (isNaN(num)) return '—';
        return '$' + num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function formatDuration(ms) {
        if (ms == null) return '—';
        ms = parseInt(ms);
        if (isNaN(ms)) return '—';
        const secs = Math.floor(ms / 1000);
        const mins = Math.floor(secs / 60);
        const remSecs = secs % 60;
        return mins > 0 ? `${mins}m ${remSecs}s` : `${secs}s`;
    }

    function formatDate(dateStr) {
        if (!dateStr) return '—';
        const d = new Date(dateStr);
        if (isNaN(d)) return dateStr;
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function formatDateTime(dateStr) {
        if (!dateStr) return '—';
        const d = new Date(dateStr);
        if (isNaN(d)) return dateStr;
        return d.toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
            hour: 'numeric', minute: '2-digit'
        });
    }

    function statusBadge(status) {
        if (!status) return '<span class="badge badge-muted">—</span>';
        const s = status.toLowerCase();
        let cls = 'badge-muted';
        if (['new', 'raw', 'pending', 'not_sent'].includes(s)) cls = 'badge-info';
        else if (['contacted', 'enriched', 'sent', 'in-progress', 'proposal'].includes(s)) cls = 'badge-warning';
        else if (['scheduled meeting', 'scheduled', 'qualified', 'responded', 'opened'].includes(s)) cls = 'badge-primary';
        else if (['closed-won', 'converted', 'paid', 'verified', 'replied', 'success'].includes(s)) cls = 'badge-success';
        else if (['closed-lost', 'dead', 'bounced', 'error', 'failed', 'cancelled', 'overdue'].includes(s)) cls = 'badge-destructive';
        return `<span class="badge ${cls}">${status}</span>`;
    }

    function truncate(str, len = 50) {
        if (!str) return '';
        return str.length > len ? str.substring(0, len) + '…' : str;
    }

    return { formatNumber, formatCurrency, formatDuration, formatDate, formatDateTime, statusBadge, truncate };
})();
