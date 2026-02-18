/* ============================================================
   MindWorx Admin — Command Center Page
   Executive dashboard: KPIs, charts, upcoming appointments,
   activity feed, alerts, and action items
   ============================================================ */

Router.register('command-center', async (container) => {
    container.innerHTML = `
        <div class="page-header flex justify-between items-center">
            <div>
                <h1 class="page-title">Command Center</h1>
                <p class="page-subtitle">Your business at a glance</p>
            </div>
            <div id="cc-date-range"></div>
        </div>

        <div id="cc-kpi"></div>

        <!-- Row 1: Charts + Action Items -->
        <div class="analytics-grid">
            <div class="card span-2">
                <div class="card-header flex justify-between items-center">
                    <h3>Pipeline Funnel</h3>
                </div>
                <div class="card-body">
                    <div class="chart-container" style="height:280px;">
                        <canvas id="cc-funnel-chart"></canvas>
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-header">
                    <h3>⚡ Action Items</h3>
                </div>
                <div class="card-body" id="cc-actions" style="max-height:280px;overflow-y:auto;">
                    <div class="flex justify-center items-center" style="padding:2rem;">
                        <div class="spinner"></div>
                    </div>
                </div>
            </div>

            <div class="card span-2">
                <div class="card-header flex justify-between items-center">
                    <h3>Call Volume</h3>
                    <span class="text-sm text-muted">Trend over period</span>
                </div>
                <div class="card-body">
                    <div class="chart-container" style="height:250px;">
                        <canvas id="cc-calls-chart"></canvas>
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-header">
                    <h3>System Status</h3>
                </div>
                <div class="card-body" id="cc-system-status">
                    <div class="flex justify-center items-center" style="padding:2rem;">
                        <div class="spinner"></div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Row 2: Appointments + Activity Feed + Alerts -->
        <div class="analytics-grid" style="margin-top:1.5rem;">
            <div class="card">
                <div class="card-header flex justify-between items-center">
                    <h3>📅 Upcoming Appointments</h3>
                    <span class="badge badge-info" id="cc-appt-count">0</span>
                </div>
                <div class="card-body" id="cc-appointments" style="max-height:360px;overflow-y:auto;">
                    <div class="flex justify-center items-center" style="padding:2rem;">
                        <div class="spinner"></div>
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-header flex justify-between items-center">
                    <h3>📋 Activity Feed</h3>
                    <span class="text-xs text-muted">Most recent</span>
                </div>
                <div class="card-body" id="cc-activity-feed" style="max-height:360px;overflow-y:auto;">
                    <div class="flex justify-center items-center" style="padding:2rem;">
                        <div class="spinner"></div>
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-header flex justify-between items-center">
                    <h3>🔔 Alerts</h3>
                    <span class="badge badge-warning" id="cc-alert-count" style="display:none;">0</span>
                </div>
                <div class="card-body" id="cc-alerts" style="max-height:360px;overflow-y:auto;">
                    <div class="flex justify-center items-center" style="padding:2rem;">
                        <div class="spinner"></div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Initialize date range
    let dateRange = DateRange.render('cc-date-range', (range) => loadData(range), '30d');

    async function loadData(range) {
        try {
            // Load data from all CRUD endpoints in parallel — server-side date filtering
            const [contacts, callLogs, logs, expenses] = await Promise.all([
                API.Contacts.lookup({ start_date: range.start, end_date: range.end }).catch(() => ({ data: [] })),
                API.CallLog.lookup({ start_date: range.start, end_date: range.end }).catch(() => ({ data: [] })),
                API.Logs.lookup({ start_date: range.start, end_date: range.end }).catch(() => ({ data: [] })),
                API.Expenses.lookup({}).catch(() => ({ data: [] }))
            ]);

            const contactList = contacts.data || contacts.results || [];
            const callList = callLogs.data || callLogs.results || [];
            const logList = logs.data || logs.results || [];
            const expenseList = expenses.data || expenses.results || [];

            renderKPIs(contactList, callList, logList);
            renderFunnelChart(contactList);
            renderCallsChart(callList);
            renderActionItems(contactList, callList, logList);
            renderSystemStatus(logList);
            renderAppointments(contactList, callList);
            renderActivityFeed(logList);
            renderAlerts(logList, expenseList, callList);
        } catch (err) {
            console.error('Command Center load error:', err);
        }
    }

    // ─── KPI Cards ───────────────────────────────────────────

    function renderKPIs(contacts, calls, logs) {
        const kpiContainer = document.getElementById('cc-kpi');
        kpiContainer.innerHTML = '';

        const totalCost = logs.reduce((sum, l) => sum + (parseFloat(l.cost) || 0), 0);
        const successCalls = calls.filter(c => c.call_successful === 'true' || c.call_successful === true).length;
        const scheduled = contacts.filter(c =>
            c.status === 'Scheduled Meeting' || c.status === 'Appointment Scheduled'
        ).length;

        KPI.render(kpiContainer, [
            {
                label: 'Total Contacts',
                value: Utils.formatNumber(contacts.length),
                trend: 0,
                trendLabel: 'in period'
            },
            {
                label: 'Calls Made',
                value: Utils.formatNumber(calls.length),
                trend: 0,
                trendLabel: `${successCalls} successful`
            },
            {
                label: 'Appointments',
                value: Utils.formatNumber(scheduled),
                trend: 0,
                trendLabel: 'scheduled'
            },
            {
                label: 'AI Spend',
                value: Utils.formatCurrency(totalCost),
                trend: 0,
                trendLabel: `${logs.length} operations`
            }
        ]);
    }

    // ─── Pipeline Funnel Chart ───────────────────────────────

    function renderFunnelChart(contacts) {
        Charts.destroy('cc-funnel-chart');
        const statusCounts = {};
        contacts.forEach(c => {
            const s = c.status || 'Unknown';
            statusCounts[s] = (statusCounts[s] || 0) + 1;
        });

        const labels = Object.keys(statusCounts);
        const data = Object.values(statusCounts);
        const colors = Charts.getThemeColors();

        Charts.create('cc-funnel-chart', 'bar', {
            labels,
            datasets: [{
                label: 'Contacts by Status',
                data,
                backgroundColor: colors.bgColors.slice(0, labels.length),
                borderRadius: 6,
                borderSkipped: false
            }]
        }, {
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1 } }
            }
        });
    }

    // ─── Call Volume Chart ────────────────────────────────────

    function renderCallsChart(calls) {
        Charts.destroy('cc-calls-chart');
        const dateCounts = {};
        calls.forEach(c => {
            const date = (c.call_started_at || c.created_on || '').split('T')[0];
            if (date) dateCounts[date] = (dateCounts[date] || 0) + 1;
        });

        const sorted = Object.entries(dateCounts).sort((a, b) => a[0].localeCompare(b[0]));
        const colors = Charts.getThemeColors();

        Charts.create('cc-calls-chart', 'line', {
            labels: sorted.map(([d]) => Utils.formatDate(d)),
            datasets: [{
                label: 'Calls',
                data: sorted.map(([, c]) => c),
                borderColor: colors.primary,
                backgroundColor: colors.primaryAlpha,
                fill: true,
                tension: 0.4,
                pointRadius: 3,
                pointHoverRadius: 6
            }]
        }, {
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1 } }
            }
        });
    }

    // ─── Action Items ────────────────────────────────────────

    function renderActionItems(contacts, calls, logs) {
        const actionsEl = document.getElementById('cc-actions');
        const items = [];

        // Errors in period
        const recentErrors = logs.filter(l => l.status === 'error');
        if (recentErrors.length > 0) {
            items.push({ color: 'red', icon: '🚨', text: `${recentErrors.length} workflow error(s)`, sub: 'Check System Health' });
        }

        // New contacts pending follow-up
        const newContacts = contacts.filter(c => c.status === 'New');
        if (newContacts.length > 0) {
            items.push({ color: 'yellow', icon: '👤', text: `${newContacts.length} new contact(s) awaiting follow-up`, sub: 'View in Pipeline' });
        }

        // Contacts that were contacted but haven't scheduled
        const contacted = contacts.filter(c => c.status === 'Contacted');
        if (contacted.length > 0) {
            items.push({ color: 'blue', icon: '📞', text: `${contacted.length} contacted — awaiting response`, sub: 'Follow up on leads' });
        }

        // Upcoming appointments
        const scheduled = contacts.filter(c =>
            c.status === 'Scheduled Meeting' || c.status === 'Appointment Scheduled'
        );
        if (scheduled.length > 0) {
            items.push({ color: 'blue', icon: '📅', text: `${scheduled.length} scheduled meeting(s)`, sub: 'Review appointments below' });
        }

        if (items.length === 0) {
            items.push({ color: 'green', icon: '✅', text: 'All systems operational', sub: 'No action required' });
        }

        actionsEl.innerHTML = items.map(item => `
            <div class="action-item">
                <span class="action-dot ${item.color}">${item.icon}</span>
                <div>
                    <div class="text-sm font-medium">${item.text}</div>
                    <div class="text-xs text-muted">${item.sub}</div>
                </div>
            </div>
        `).join('');
    }

    // ─── System Status ───────────────────────────────────────

    function renderSystemStatus(logs) {
        const statusEl = document.getElementById('cc-system-status');
        const total = logs.length;
        const errors = logs.filter(l => l.status === 'error').length;
        const rate = total > 0 ? ((total - errors) / total * 100).toFixed(1) : 100;

        const statusClass = errors === 0 ? 'text-success' : (errors / total > 0.1 ? 'text-destructive' : 'text-warning');
        const statusLabel = errors === 0 ? 'All Clear' : (errors / total > 0.1 ? 'Needs Attention' : 'Minor Issues');

        statusEl.innerHTML = `
            <div style="text-align:center;padding:1rem 0;">
                <div style="font-size:2.5rem;font-weight:800;margin-bottom:0.25rem;" class="${statusClass}">${rate}%</div>
                <div class="text-sm font-medium ${statusClass}">${statusLabel}</div>
                <div class="text-xs text-muted" style="margin-top:0.5rem;">${total} ops · ${errors} error${errors !== 1 ? 's' : ''}</div>
            </div>
        `;
    }

    // ─── Upcoming Appointments ───────────────────────────────
    // Cross-references Contacts (status = Appointment Scheduled / Scheduled Meeting)
    // with Call Log entries that have appointment details (calendar_appointment_date_time)

    function renderAppointments(contacts, calls) {
        const apptEl = document.getElementById('cc-appointments');
        const countBadge = document.getElementById('cc-appt-count');

        // Get contacts with appointment status
        const scheduledContacts = contacts.filter(c =>
            c.status === 'Scheduled Meeting' || c.status === 'Appointment Scheduled'
        );

        // Build a lookup map: contact_id → most recent call with appointment info
        const callsByContact = {};
        calls.forEach(call => {
            if (!call.contact_id) return;
            if (call.calendar_appointment_date_time || call.calendar_appointment_url) {
                const existing = callsByContact[call.contact_id];
                if (!existing || (call.call_started_at || '') > (existing.call_started_at || '')) {
                    callsByContact[call.contact_id] = call;
                }
            }
        });

        // Merge contacts with their appointment details from call log
        const appointments = scheduledContacts.map(contact => {
            const callData = callsByContact[contact.contact_id] || {};
            return {
                name: contact.full_name || contact.company_name || 'Unknown',
                company: contact.company_name || '',
                phone: contact.phone || '',
                email: contact.email || '',
                appointmentDate: callData.calendar_appointment_date_time || '',
                appointmentType: callData.calendar_appointment_type || 'Meeting',
                calendarUrl: callData.calendar_appointment_url || '',
                contactId: contact.contact_id
            };
        });

        // Sort by appointment date (soonest first), undated at the end
        appointments.sort((a, b) => {
            if (!a.appointmentDate && !b.appointmentDate) return 0;
            if (!a.appointmentDate) return 1;
            if (!b.appointmentDate) return -1;
            return a.appointmentDate.localeCompare(b.appointmentDate);
        });

        countBadge.textContent = appointments.length;

        if (appointments.length === 0) {
            apptEl.innerHTML = `
                <div style="text-align:center;padding:1.5rem 0;">
                    <div class="text-muted" style="font-size:2rem;margin-bottom:0.5rem;">📅</div>
                    <div class="text-sm text-muted">No upcoming appointments</div>
                </div>
            `;
            return;
        }

        apptEl.innerHTML = appointments.map(appt => {
            const now = new Date();
            const apptDate = appt.appointmentDate ? new Date(appt.appointmentDate) : null;
            const isToday = apptDate && apptDate.toDateString() === now.toDateString();
            const isPast = apptDate && apptDate < now;

            let timeBadge = '';
            if (isToday) timeBadge = '<span class="badge badge-primary">Today</span>';
            else if (isPast) timeBadge = '<span class="badge badge-muted">Past</span>';
            else if (apptDate) {
                const daysOut = Math.ceil((apptDate - now) / (1000 * 60 * 60 * 24));
                if (daysOut <= 7) timeBadge = `<span class="badge badge-warning">${daysOut}d</span>`;
                else timeBadge = `<span class="badge badge-info">${daysOut}d</span>`;
            }

            return `
                <div class="appointment-item" style="padding:0.75rem 0;border-bottom:1px solid hsl(var(--border) / 0.5);">
                    <div class="flex justify-between items-center" style="margin-bottom:0.25rem;">
                        <span class="text-sm font-semibold">${appt.name}</span>
                        ${timeBadge}
                    </div>
                    ${appt.company ? `<div class="text-xs text-muted">${appt.company}</div>` : ''}
                    <div class="flex justify-between items-center" style="margin-top:0.35rem;">
                        <span class="text-xs text-muted">
                            ${appt.appointmentDate ? Utils.formatDateTime(appt.appointmentDate) : 'Time TBD'}
                            ${appt.appointmentType !== 'Meeting' ? ` · ${appt.appointmentType}` : ''}
                        </span>
                        ${appt.calendarUrl ? `<a href="${appt.calendarUrl}" target="_blank" class="text-xs text-primary" style="text-decoration:none;">View ↗</a>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    // ─── Activity Feed ───────────────────────────────────────
    // Latest log entries as a timeline

    function renderActivityFeed(logs) {
        const feedEl = document.getElementById('cc-activity-feed');

        // Sort by date descending, take latest 20
        const sorted = [...logs]
            .sort((a, b) => (b.date_time || '').localeCompare(a.date_time || ''))
            .slice(0, 20);

        if (sorted.length === 0) {
            feedEl.innerHTML = `
                <div style="text-align:center;padding:1.5rem 0;">
                    <div class="text-muted" style="font-size:2rem;margin-bottom:0.5rem;">📋</div>
                    <div class="text-sm text-muted">No recent activity</div>
                </div>
            `;
            return;
        }

        feedEl.innerHTML = sorted.map(log => {
            const icon = getActivityIcon(log.action, log.status);
            const timeAgo = getRelativeTime(log.date_time);

            return `
                <div class="feed-item" style="display:flex;gap:0.6rem;padding:0.5rem 0;border-bottom:1px solid hsl(var(--border) / 0.3);">
                    <span style="font-size:0.9rem;flex-shrink:0;margin-top:2px;">${icon}</span>
                    <div style="flex:1;min-width:0;">
                        <div class="text-xs">
                            <span class="font-medium">${log.entity || 'System'}</span>
                            <span class="text-muted"> · ${log.action || 'activity'}</span>
                        </div>
                        ${log.notes ? `<div class="text-xs text-muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${Utils.truncate(log.notes, 50)}</div>` : ''}
                        <div class="text-xs text-muted">${timeAgo}${log.cost ? ` · ${Utils.formatCurrency(log.cost)}` : ''}</div>
                    </div>
                    ${Utils.statusBadge(log.status)}
                </div>
            `;
        }).join('');
    }

    function getActivityIcon(action, status) {
        if (status === 'error') return '🔴';
        if (!action) return '📝';
        const a = action.toLowerCase();
        if (a.includes('create') || a.includes('add')) return '➕';
        if (a.includes('update') || a.includes('edit')) return '✏️';
        if (a.includes('delete') || a.includes('remove')) return '🗑️';
        if (a.includes('call') || a.includes('phone')) return '📞';
        if (a.includes('email') || a.includes('send')) return '📧';
        if (a.includes('search') || a.includes('lookup')) return '🔍';
        if (a.includes('schedule') || a.includes('appointment')) return '📅';
        return '📝';
    }

    function getRelativeTime(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        if (isNaN(date)) return dateStr;
        const now = new Date();
        const diffMs = now - date;
        const diffMin = Math.floor(diffMs / 60000);
        const diffHrs = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMin < 1) return 'just now';
        if (diffMin < 60) return `${diffMin}m ago`;
        if (diffHrs < 24) return `${diffHrs}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return Utils.formatDate(dateStr);
    }

    // ─── Alerts ──────────────────────────────────────────────
    // Proactive warnings: expiring subs, error spikes, cost anomalies

    function renderAlerts(logs, expenses, calls) {
        const alertsEl = document.getElementById('cc-alerts');
        const countBadge = document.getElementById('cc-alert-count');
        const alerts = [];

        // 1. Subscription renewals within 14 days
        const now = new Date();
        expenses.forEach(e => {
            if (!e.expiration_date) return;
            const exp = new Date(e.expiration_date);
            const daysLeft = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
            if (daysLeft <= 0) {
                alerts.push({
                    severity: 'critical',
                    icon: '🔴',
                    title: `${e.name} expired`,
                    detail: `Expired ${Math.abs(daysLeft)} day(s) ago`,
                    link: '#subscriptions'
                });
            } else if (daysLeft <= 7) {
                alerts.push({
                    severity: 'warning',
                    icon: '🟡',
                    title: `${e.name} expires in ${daysLeft}d`,
                    detail: `Renews ${Utils.formatDate(e.expiration_date)}`,
                    link: '#subscriptions'
                });
            } else if (daysLeft <= 14) {
                alerts.push({
                    severity: 'info',
                    icon: '🔵',
                    title: `${e.name} renewal coming`,
                    detail: `${daysLeft} days · ${Utils.formatDate(e.expiration_date)}`,
                    link: '#subscriptions'
                });
            }
        });

        // 2. Workflow error spike (>10% error rate)
        const errors = logs.filter(l => l.status === 'error');
        if (logs.length > 5 && (errors.length / logs.length) > 0.1) {
            alerts.push({
                severity: 'warning',
                icon: '⚠️',
                title: `High error rate: ${((errors.length / logs.length) * 100).toFixed(0)}%`,
                detail: `${errors.length} of ${logs.length} operations failed`,
                link: '#system-health'
            });
        }

        // 3. AI cost spike (check if any single day exceeds 2x average)
        const costByDay = {};
        logs.forEach(l => {
            const date = (l.date_time || '').split('T')[0];
            if (date && l.cost) costByDay[date] = (costByDay[date] || 0) + parseFloat(l.cost);
        });
        const dailyCosts = Object.values(costByDay);
        if (dailyCosts.length > 3) {
            const avgCost = dailyCosts.reduce((s, c) => s + c, 0) / dailyCosts.length;
            const maxDay = Object.entries(costByDay).sort((a, b) => b[1] - a[1])[0];
            if (maxDay && maxDay[1] > avgCost * 2 && avgCost > 0.01) {
                alerts.push({
                    severity: 'info',
                    icon: '💰',
                    title: 'AI cost spike detected',
                    detail: `${Utils.formatDate(maxDay[0])}: ${Utils.formatCurrency(maxDay[1])} (${(maxDay[1] / avgCost).toFixed(1)}x avg)`,
                    link: '#system-health'
                });
            }
        }

        // 4. Calls with errors/failures
        const failedCalls = calls.filter(c =>
            c.call_successful === 'false' || c.call_successful === false ||
            c.final_status === 'error' || c.finalStatus === 'error'
        );
        if (failedCalls.length > 0) {
            alerts.push({
                severity: 'warning',
                icon: '📞',
                title: `${failedCalls.length} failed call(s)`,
                detail: 'Check Call Activity for details',
                link: '#call-activity'
            });
        }

        // Update badge
        if (alerts.length > 0) {
            countBadge.style.display = '';
            countBadge.textContent = alerts.length;
            countBadge.className = alerts.some(a => a.severity === 'critical')
                ? 'badge badge-destructive'
                : 'badge badge-warning';
        } else {
            countBadge.style.display = 'none';
        }

        // Sort: critical first, then warning, then info
        const severityOrder = { critical: 0, warning: 1, info: 2 };
        alerts.sort((a, b) => (severityOrder[a.severity] || 3) - (severityOrder[b.severity] || 3));

        if (alerts.length === 0) {
            alertsEl.innerHTML = `
                <div style="text-align:center;padding:1.5rem 0;">
                    <div class="text-success" style="font-size:2rem;margin-bottom:0.5rem;">✅</div>
                    <div class="text-sm text-muted">No alerts — all clear!</div>
                </div>
            `;
            return;
        }

        alertsEl.innerHTML = alerts.map(alert => `
            <a href="${alert.link}" class="alert-item" style="display:flex;gap:0.6rem;padding:0.6rem 0;border-bottom:1px solid hsl(var(--border) / 0.3);text-decoration:none;color:inherit;">
                <span style="font-size:1rem;flex-shrink:0;">${alert.icon}</span>
                <div style="flex:1;">
                    <div class="text-sm font-medium">${alert.title}</div>
                    <div class="text-xs text-muted">${alert.detail}</div>
                </div>
                <span class="text-xs text-muted" style="flex-shrink:0;">→</span>
            </a>
        `).join('');
    }

    // Initial load
    loadData(dateRange);
});
