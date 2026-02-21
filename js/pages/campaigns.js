/* ============================================================
   MindWorx Admin — Campaigns Page
   Campaign results, LinkedIn settings, AI campaign builder
   ============================================================ */

Router.register('campaigns', async (container) => {
    container.innerHTML = `
        <div class="page-header flex justify-between items-center">
            <div>
                <h1 class="page-title">Campaigns</h1>
                <p class="page-subtitle">LinkedIn campaign management & AI builder</p>
            </div>
            <div style="display:flex; gap:0.75rem; align-items:center;">
                <div id="campaigns-date-range"></div>
                <select id="campaigns-platform-filter" class="input" style="width:auto; min-width:140px;">
                    <option value="">All Platforms</option>
                    <option value="linkedin" selected>LinkedIn</option>
                </select>
            </div>
        </div>

        <!-- Tab Navigation -->
        <div class="campaigns-tabs" style="display:flex; gap:0; margin-bottom:1.5rem; border-bottom:1px solid var(--border);">
            <button class="campaigns-tab active" data-tab="results" style="padding:0.75rem 1.25rem; background:none; border:none; border-bottom:2px solid var(--primary); color:var(--foreground); font-weight:600; cursor:pointer; font-size:0.9rem;">Campaign Results</button>
            <button class="campaigns-tab" data-tab="settings" style="padding:0.75rem 1.25rem; background:none; border:none; border-bottom:2px solid transparent; color:var(--muted-foreground); font-weight:500; cursor:pointer; font-size:0.9rem;">LinkedIn Settings</button>
            <button class="campaigns-tab" data-tab="builder" style="padding:0.75rem 1.25rem; background:none; border:none; border-bottom:2px solid transparent; color:var(--muted-foreground); font-weight:500; cursor:pointer; font-size:0.9rem;">Campaign Builder</button>
        </div>

        <!-- Tab Content -->
        <div id="tab-results"></div>
        <div id="tab-settings" style="display:none;"></div>
        <div id="tab-builder" style="display:none;"></div>
    `;

    // ---- Tab Switching ----
    container.querySelectorAll('.campaigns-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            container.querySelectorAll('.campaigns-tab').forEach(t => {
                t.classList.remove('active');
                t.style.borderBottomColor = 'transparent';
                t.style.color = 'var(--muted-foreground)';
                t.style.fontWeight = '500';
            });
            tab.classList.add('active');
            tab.style.borderBottomColor = 'var(--primary)';
            tab.style.color = 'var(--foreground)';
            tab.style.fontWeight = '600';

            const tabName = tab.getAttribute('data-tab');
            document.getElementById('tab-results').style.display = tabName === 'results' ? '' : 'none';
            document.getElementById('tab-settings').style.display = tabName === 'settings' ? '' : 'none';
            document.getElementById('tab-builder').style.display = tabName === 'builder' ? '' : 'none';
        });
    });

    // ---- State ----
    let campaignData = [];
    let settingsData = [];
    let currentDateRange = null;

    // ---- Date Range + Platform Filter (in header, shared across tabs) ----
    currentDateRange = DateRange.render('campaigns-date-range', (range) => {
        currentDateRange = range;
        loadCampaigns(range);
    }, '90d');

    document.getElementById('campaigns-platform-filter').addEventListener('change', () => {
        loadCampaigns(currentDateRange);
    });

    // ================================================================
    // TAB 1: Campaign Results
    // ================================================================

    function initResultsTab() {
        const tab = document.getElementById('tab-results');
        tab.innerHTML = `
            <div id="campaigns-kpi"></div>
            <div id="campaigns-table" style="margin-top:1rem;"></div>
        `;

        loadCampaigns(currentDateRange);
    }

    async function loadCampaigns(range) {
        try {
            const platform = document.getElementById('campaigns-platform-filter')?.value || '';
            const filters = {};
            if (range && range.start) filters.start_date = range.start;
            if (range && range.end) filters.end_date = range.end;
            if (platform) filters.platform = platform;

            const result = await API.Campaigns.lookup(filters).catch(() => ({ data: [] }));
            campaignData = result.data || result.results || [];
            renderCampaignKPIs();
            renderCampaignTable();
        } catch (err) {
            console.error('Campaign load error:', err);
        }
    }

    function renderCampaignKPIs() {
        const kpiEl = document.getElementById('campaigns-kpi');
        if (!kpiEl) return;
        kpiEl.innerHTML = '';

        const total = campaignData.length;
        const posted = campaignData.filter(c => (c.status || '').toLowerCase() === 'posted').length;
        const totalCost = campaignData.reduce((sum, c) => sum + (parseFloat(c.total_cost) || 0), 0);

        // Posts this month
        const now = new Date();
        const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        const thisMonth = campaignData.filter(c => (c.created_on || '') >= monthStart && (c.status || '').toLowerCase() === 'posted').length;

        KPI.render(kpiEl, [
            { label: 'Total Campaigns', value: Utils.formatNumber(total), trend: 0, trendLabel: `${posted} posted` },
            { label: 'Total Cost', value: Utils.formatCurrency(totalCost), trend: 0, trendLabel: total > 0 ? `${Utils.formatCurrency(totalCost / total)} avg` : '—' },
            { label: 'Posts This Month', value: Utils.formatNumber(thisMonth), trend: 0, trendLabel: new Date().toLocaleString('en-US', { month: 'long' }) },
            { label: 'Post Rate', value: total > 0 ? `${((posted / total) * 100).toFixed(0)}%` : '—', trend: 0, trendLabel: `${total - posted} drafts` }
        ]);
    }

    function renderCampaignTable() {
        const tableEl = document.getElementById('campaigns-table');
        if (!tableEl) return;
        tableEl.innerHTML = '';

        DataTable.render(tableEl, {
            columns: [
                { key: 'created_on', label: 'Date', render: (v) => Utils.formatDate(v) },
                { key: 'content_type', label: 'Type', render: (v) => Utils.statusBadge(v || '—') },
                { key: 'topic', label: 'Topic', render: (v) => Utils.truncate(v, 50) },
                { key: 'status', label: 'Status', render: (v) => Utils.statusBadge(v || 'Draft') },
                { key: 'total_cost', label: 'Cost', render: (v) => Utils.formatCurrency(v) },
                {
                    key: 'post_url', label: 'Link', width: '60px', sortable: false,
                    render: (v) => v ? `<a href="${v}" target="_blank" rel="noopener" style="color:var(--primary); text-decoration:none;" title="View post">🔗</a>` : '<span class="text-muted">—</span>'
                },
                {
                    key: '_actions', label: '', width: '70px', sortable: false,
                    render: (_, row) => `<button class="btn btn-outline btn-sm" data-action="view-campaign" data-id="${row.campaign_id}">View</button>`
                }
            ],
            data: campaignData,
            searchable: true,
            pageSize: 15,
            emptyMessage: 'No campaigns found'
        });

        // Click handler for view
        tableEl.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action="view-campaign"]');
            if (btn) {
                const id = btn.getAttribute('data-id');
                const row = campaignData.find(c => c.campaign_id === id);
                if (row) openCampaignDetailModal(row);
            }
        });
    }

    function openCampaignDetailModal(row) {
        Modal.open({
            title: `Campaign: ${Utils.truncate(row.topic, 40)}`,
            fields: [
                { key: 'campaign_id', label: 'Campaign ID', type: 'text', readonly: true },
                { key: 'platform', label: 'Platform', type: 'text', readonly: true },
                { key: 'content_type', label: 'Content Type', type: 'text', readonly: true },
                { key: 'cta_type', label: 'CTA Type', type: 'text', readonly: true },
                { key: 'status', label: 'Status', type: 'text', readonly: true },
                { key: 'topic', label: 'Topic', type: 'textarea', readonly: true },
                { key: 'content', label: 'Post Content', type: 'textarea', readonly: true },
                { key: 'image_prompt', label: 'Image Prompt', type: 'textarea', readonly: true },
                { key: 'total_cost', label: 'Cost', type: 'text', readonly: true },
                { key: 'post_url', label: 'Post URL', type: 'text', readonly: true },
                { key: 'created_on', label: 'Created', type: 'text', readonly: true }
            ],
            data: row,
            onSave: async () => { } // Read-only, just close
        });
    }

    // ================================================================
    // TAB 2: LinkedIn Settings
    // ================================================================

    function initSettingsTab() {
        const tab = document.getElementById('tab-settings');
        tab.innerHTML = `
            <div class="card" style="margin-bottom:1rem;">
                <div class="card-header"><h3>Campaign Settings</h3></div>
                <div class="card-body" id="settings-campaign" style="padding:0;"></div>
            </div>
            <div class="card" style="margin-bottom:1rem;">
                <div class="card-header"><h3>Brand Voice</h3></div>
                <div class="card-body" id="settings-voice" style="padding:0;"></div>
            </div>
            <div class="card">
                <div class="card-header"><h3>Behavior</h3></div>
                <div class="card-body" id="settings-behavior" style="padding:0;"></div>
            </div>
        `;
        loadSettings();
    }

    async function loadSettings() {
        try {
            const result = await API.Settings.lookup().catch(() => ({ data: [] }));
            const allSettings = result.data || result.results || [];
            settingsData = allSettings.filter(s => (s.Name || '').startsWith('LinkedIn_'));
            renderSettingsGroups();
        } catch (err) {
            console.error('Settings load error:', err);
        }
    }

    function renderSettingsGroups() {
        const campaignKeys = ['LinkedIn_Topic', 'LinkedIn_Target_Audience', 'LinkedIn_Visual_Theme', 'LinkedIn_Content_Type', 'LinkedIn_CTA_Type'];
        const voiceKeys = ['LinkedIn_Motto', 'LinkedIn_Selling_Points', 'LinkedIn_Avoid_Words'];
        const behaviorKeys = ['LinkedIn_Enabled', 'LinkedIn_Auto_Post', 'LinkedIn_Include_Image', 'LinkedIn_Review_Email', 'LinkedIn_Weekly_Mode', 'LinkedIn_Location'];

        renderSettingsTable('settings-campaign', settingsData.filter(s => campaignKeys.includes(s.Name)));
        renderSettingsTable('settings-voice', settingsData.filter(s => voiceKeys.includes(s.Name)));
        renderSettingsTable('settings-behavior', settingsData.filter(s => behaviorKeys.includes(s.Name)));
    }

    function renderSettingsTable(containerId, data) {
        const el = document.getElementById(containerId);
        if (!el) return;
        el.innerHTML = '';

        if (data.length === 0) {
            el.innerHTML = '<div style="padding:1rem; color:var(--muted-foreground); text-align:center;">No settings found</div>';
            return;
        }

        const table = document.createElement('table');
        table.className = 'data-table';
        table.style.margin = '0';

        data.forEach(row => {
            const tr = document.createElement('tr');
            const friendlyName = (row.Name || '').replace('LinkedIn_', '').replace(/_/g, ' ');
            tr.innerHTML = `
                <td style="width:200px; font-weight:600; white-space:nowrap;">${friendlyName}</td>
                <td>${Utils.truncate(row.Value || '', 80)}</td>
                <td style="width:70px; text-align:right;">
                    <button class="btn btn-outline btn-sm" data-action="edit-setting" data-name="${row.Name}">Edit</button>
                </td>
            `;
            table.appendChild(tr);
        });

        el.appendChild(table);

        el.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action="edit-setting"]');
            if (btn) {
                const name = btn.getAttribute('data-name');
                const setting = settingsData.find(s => s.Name === name);
                if (setting) openEditSettingModal(setting);
            }
        });
    }

    function openEditSettingModal(row) {
        const friendlyName = (row.Name || '').replace('LinkedIn_', '').replace(/_/g, ' ');
        Modal.open({
            title: `Edit: ${friendlyName}`,
            fields: [
                { key: 'Name', label: 'Setting', type: 'text', readonly: true },
                { key: 'Value', label: 'Value', type: row.Value && row.Value.length > 60 ? 'textarea' : 'text' }
            ],
            data: row,
            onSave: async (result) => {
                await API.Settings.update({ Name: row.Name, Value: result.Value });
                await loadSettings();
            }
        });
    }

    // ================================================================
    // TAB 3: Campaign Builder
    // ================================================================

    function initBuilderTab() {
        const tab = document.getElementById('tab-builder');
        tab.innerHTML = `
            <div class="card" style="margin-bottom:1.5rem;">
                <div class="card-header"><h3>Describe Your Campaign</h3></div>
                <div class="card-body">
                    <div class="form-group" style="margin-bottom:1rem;">
                        <label class="form-label">Campaign Idea</label>
                        <textarea id="builder-idea" class="input" rows="3" placeholder="e.g. Launch announcement for MindWorx. Genuine, grassroots, inspiring. Focus on how small businesses can compete with big companies using AI."
                            style="resize:vertical; font-size:0.95rem;"></textarea>
                    </div>
                    <div style="display:flex; gap:1rem; align-items:end;">
                        <div class="form-group" style="margin-bottom:0;">
                            <label class="form-label">Platform</label>
                            <select id="builder-platform" class="input" style="width:auto; min-width:140px;">
                                <option value="linkedin" selected>LinkedIn</option>
                            </select>
                        </div>
                        <button class="btn btn-primary" id="btn-generate" style="min-width:160px; height:42px;">
                            ✨ Generate Settings
                        </button>
                    </div>
                </div>
            </div>

            <div id="builder-loading" style="display:none; text-align:center; padding:2rem;">
                <div class="spinner"></div>
                <p class="text-muted" style="margin-top:1rem;">AI is generating campaign settings...</p>
            </div>

            <div id="builder-results" style="display:none;">
                <div class="card" style="margin-bottom:1rem;">
                    <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
                        <h3>Generated Settings</h3>
                        <span class="badge badge-info">AI Generated</span>
                    </div>
                    <div class="card-body" id="builder-generated" style="padding:0;"></div>
                </div>

                <div class="card" style="margin-bottom:1.5rem;">
                    <div class="card-header"><h3>Current Settings (for comparison)</h3></div>
                    <div class="card-body" id="builder-current" style="padding:0;"></div>
                </div>

                <div style="display:flex; gap:1rem; justify-content:flex-end;">
                    <button class="btn btn-outline" id="btn-discard">Discard</button>
                    <button class="btn btn-primary" id="btn-apply" style="min-width:200px;">
                        ✅ Apply to Settings
                    </button>
                </div>
            </div>
        `;

        document.getElementById('btn-generate').addEventListener('click', handleGenerate);
        document.getElementById('btn-discard').addEventListener('click', () => {
            document.getElementById('builder-results').style.display = 'none';
        });
        document.getElementById('btn-apply').addEventListener('click', handleApply);
    }

    let generatedSettings = null;

    async function handleGenerate() {
        const idea = document.getElementById('builder-idea').value.trim();
        if (!idea) {
            alert('Please describe your campaign idea.');
            return;
        }

        const platform = document.getElementById('builder-platform').value;
        const genBtn = document.getElementById('btn-generate');
        const loading = document.getElementById('builder-loading');
        const results = document.getElementById('builder-results');

        genBtn.disabled = true;
        genBtn.textContent = 'Generating...';
        loading.style.display = '';
        results.style.display = 'none';

        try {
            const response = await API.Campaigns.generate(idea, platform);

            // The response may be nested
            const data = response.generated || response.data?.generated || response;
            generatedSettings = data.generated || data;

            renderGeneratedSettings(generatedSettings);
            renderCurrentSettings(response.currentSettings || data.currentSettings || {});

            results.style.display = '';
        } catch (err) {
            console.error('Generate error:', err);
            alert('Error generating campaign settings: ' + (err.message || 'Unknown error'));
        } finally {
            genBtn.disabled = false;
            genBtn.textContent = '✨ Generate Settings';
            loading.style.display = 'none';
        }
    }

    function renderGeneratedSettings(settings) {
        const el = document.getElementById('builder-generated');
        if (!el) return;

        const fields = ['LinkedIn_Topic', 'LinkedIn_Target_Audience', 'LinkedIn_Visual_Theme', 'LinkedIn_Selling_Points', 'LinkedIn_Content_Type', 'LinkedIn_CTA_Type'];

        el.innerHTML = '';
        const table = document.createElement('table');
        table.className = 'data-table';
        table.style.margin = '0';

        fields.forEach(key => {
            const friendlyName = key.replace('LinkedIn_', '').replace(/_/g, ' ');
            const value = settings[key] || '';
            const isLong = value.length > 60;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="width:180px; font-weight:600; white-space:nowrap; vertical-align:top; padding-top:12px;">${friendlyName}</td>
                <td>
                    ${isLong
                    ? `<textarea class="input builder-field" data-key="${key}" rows="2" style="resize:vertical; width:100%;">${value}</textarea>`
                    : `<input class="input builder-field" data-key="${key}" value="${value.replace(/"/g, '&quot;')}" style="width:100%;" />`
                }
                </td>
            `;
            table.appendChild(tr);
        });

        el.appendChild(table);
    }

    function renderCurrentSettings(current) {
        const el = document.getElementById('builder-current');
        if (!el) return;

        const fields = ['LinkedIn_Topic', 'LinkedIn_Target_Audience', 'LinkedIn_Visual_Theme', 'LinkedIn_Selling_Points', 'LinkedIn_Content_Type', 'LinkedIn_CTA_Type'];

        el.innerHTML = '';
        const table = document.createElement('table');
        table.className = 'data-table';
        table.style.margin = '0';

        fields.forEach(key => {
            const friendlyName = key.replace('LinkedIn_', '').replace(/_/g, ' ');
            const value = current[key] || '(not set)';
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="width:180px; font-weight:600; white-space:nowrap;">${friendlyName}</td>
                <td class="text-muted">${Utils.truncate(value, 120)}</td>
            `;
            table.appendChild(tr);
        });

        el.appendChild(table);
    }

    async function handleApply() {
        const applyBtn = document.getElementById('btn-apply');
        applyBtn.disabled = true;
        applyBtn.textContent = 'Applying...';

        try {
            // Read editable values from the generated fields
            const fields = document.querySelectorAll('.builder-field');
            const updates = [];

            for (const field of fields) {
                const key = field.getAttribute('data-key');
                const value = field.value.trim();
                if (key && value) {
                    updates.push(API.Settings.update({ Name: key, Value: value }));
                }
            }

            await Promise.all(updates);

            // Refresh settings tab data
            await loadSettings();

            alert('All 6 settings have been applied! They will be used by the next LinkedIn Poster run.');
            document.getElementById('builder-results').style.display = 'none';
        } catch (err) {
            console.error('Apply error:', err);
            alert('Error applying settings: ' + (err.message || 'Unknown error'));
        } finally {
            applyBtn.disabled = false;
            applyBtn.textContent = '✅ Apply to Settings';
        }
    }

    // ================================================================
    // Initialize
    // ================================================================

    async function loadAll() {
        initResultsTab();
        initSettingsTab();
        initBuilderTab();
    }

    loadAll();
});
