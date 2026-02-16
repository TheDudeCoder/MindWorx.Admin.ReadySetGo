/* ============================================================
   MindWorx Admin — Configuration
   ============================================================
   
   For production, these values should come from Vercel 
   environment variables via the /api/config endpoint.
   For local development, set them here directly.
   ============================================================ */

window.MINDWORX_CONFIG = {
    // Google OAuth Client ID (from Google Cloud Console)
    // Replace with your actual Client ID
    GOOGLE_CLIENT_ID: '',

    // Authorized email — only this Google account can log in
    AUTHORIZED_EMAIL: '',

    // API base URL — points to the Vercel serverless proxy
    // In production: '' (same origin, relative path to /api/crud)
    // For local dev: you can point directly to n8n (not recommended for prod)
    API_BASE_URL: '',

    // n8n webhook base URL (used by Vercel proxy, NOT exposed to browser)
    // This is set as a Vercel environment variable: N8N_WEBHOOK_BASE_URL
    // N8N_WEBHOOK_BASE_URL: 'https://n8n.srv1303475.hstgr.cloud/webhook'
};
