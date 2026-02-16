// Vercel Serverless Function — Proxy for n8n CRUD Webhooks
// File: api/crud.js
// Keeps N8N_WEBHOOK_BASE_URL secret (Vercel env var)

const ALLOWED = [
    'contacts-lookup', 'contacts-create', 'contacts-update', 'contacts-delete',
    'calllog-lookup', 'calllog-create', 'calllog-update', 'calllog-delete',
    'logs-lookup', 'logs-create', 'logs-update', 'logs-delete',
    'leads-lookup', 'leads-create', 'leads-update', 'leads-delete',
    'sales-lookup', 'sales-create', 'sales-update', 'sales-delete',
    'expenses-lookup', 'expenses-create', 'expenses-update', 'expenses-delete',
    'configuration-lookup', 'configuration-update',
    'contactstatus-lookup', 'leadstatus-lookup',
    'expensetype-lookup', 'expenseunit-lookup',
    'executions-lookup'
];

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { endpoint, ...data } = req.body || {};

    if (!endpoint || !ALLOWED.includes(endpoint)) {
        return res.status(400).json({ error: `Invalid endpoint: ${endpoint}` });
    }

    const baseUrl = process.env.N8N_WEBHOOK_BASE_URL;
    if (!baseUrl) {
        return res.status(500).json({ error: 'N8N_WEBHOOK_BASE_URL not configured' });
    }

    try {
        const response = await fetch(`${baseUrl}/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const responseData = await response.json();
        return res.status(response.status).json(responseData);
    } catch (err) {
        console.error('Proxy error:', err);
        return res.status(502).json({ error: 'Failed to reach n8n', detail: err.message });
    }
}
