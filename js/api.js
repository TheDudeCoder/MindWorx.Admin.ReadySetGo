/* ============================================================
   MindWorx Admin — API Layer
   Handles all communication with n8n CRUD webhooks
   via the Vercel serverless proxy
   ============================================================ */

const API = (() => {
    function getBaseUrl() {
        return window.MINDWORX_CONFIG?.API_BASE_URL || '';
    }

    /**
     * Call an n8n CRUD endpoint via the Vercel proxy
     * @param {string} endpoint - e.g. 'contacts-lookup', 'sales-create'
     * @param {object} data - request body
     * @param {string} method - HTTP method (default: POST)
     * @returns {Promise<object>}
     */
    async function crud(endpoint, payload = {}, method = 'POST') {
        const url = `${getBaseUrl()}/api/crud`;
        const body = { endpoint, ...payload };

        try {
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new APIError(
                    errorData.message || `HTTP ${response.status}`,
                    response.status,
                    errorData
                );
            }

            return await response.json();
        } catch (err) {
            if (err instanceof APIError) throw err;
            throw new APIError(
                err.message || 'Network error',
                0,
                { originalError: err.toString() }
            );
        }
    }

    // --- Convenience Methods ---
    // Wraps payloads in the format expected by n8n workflows:
    //   lookup: { operation: 'get', filters: {...} }
    //   create: { operation: 'create', data: {...} }
    //   update: { operation: 'update', data: {...} }
    //   delete: { operation: 'delete', data: {...} }

    async function lookup(entity, filters = {}) {
        // Strip out empty/falsy filter values so "All" date ranges don't break validation
        const cleanFilters = {};
        for (const [key, value] of Object.entries(filters)) {
            if (value !== '' && value !== null && value !== undefined) {
                cleanFilters[key] = value;
            }
        }
        return crud(`${entity}-lookup`, { operation: 'get', filters: cleanFilters });
    }

    async function create(entity, data) {
        return crud(`${entity}-create`, { operation: 'create', data });
    }

    async function update(entity, data) {
        return crud(`${entity}-update`, { operation: 'update', data });
    }

    async function remove(entity, data) {
        return crud(`${entity}-delete`, { operation: 'delete', data });
    }

    // --- Entity-Specific Helpers ---

    const Contacts = {
        lookup: (filters) => lookup('contacts', filters),
        create: (data) => create('contacts', data),
        update: (data) => update('contacts', data),
        delete: (data) => remove('contacts', data)
    };

    const CallLog = {
        lookup: (filters) => lookup('calllog', filters),
        create: (data) => create('calllog', data),
        update: (data) => update('calllog', data),
        delete: (data) => remove('calllog', data)
    };

    const Logs = {
        lookup: (filters) => lookup('logs', filters),
        create: (data) => create('logs', data),
        update: (data) => update('logs', data),
        delete: (data) => remove('logs', data)
    };

    const Leads = {
        lookup: (filters) => lookup('leads', filters),
        create: (data) => create('leads', data),
        update: (data) => update('leads', data),
        delete: (data) => remove('leads', data)
    };

    const Sales = {
        lookup: (filters) => lookup('sales', filters),
        create: (data) => create('sales', data),
        update: (data) => update('sales', data),
        delete: (data) => remove('sales', data)
    };

    const Expenses = {
        lookup: (filters) => lookup('expenses', filters),
        create: (data) => create('expenses', data),
        update: (data) => update('expenses', data),
        delete: (data) => remove('expenses', data)
    };

    // Configuration (Name/Value pairs — lookup all + update by Name)
    const Configuration = {
        lookup: () => crud('configuration-lookup', { operation: 'get', filters: {} }),
        update: (data) => crud('configuration-update', { operation: 'update', data })
    };

    // Read-only status lookups (small config tabs — always fetch all rows)
    const ContactStatus = {
        lookup: () => crud('contactstatus-lookup', { operation: 'get' })
    };

    const LeadStatus = {
        lookup: () => crud('leadstatus-lookup', { operation: 'get' })
    };

    // Execution monitoring (n8n API)
    const Executions = {
        lookup: (filters) => lookup('executions', filters)
    };

    return { crud, lookup, create, update, remove, Contacts, CallLog, Logs, Leads, Sales, Expenses, Configuration, ContactStatus, LeadStatus, Executions };
})();

// --- Custom Error Class ---

class APIError extends Error {
    constructor(message, status, data) {
        super(message);
        this.name = 'APIError';
        this.status = status;
        this.data = data;
    }
}
