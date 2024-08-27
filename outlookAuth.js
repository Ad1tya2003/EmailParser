// outlookAuth.js
const axios = require('axios');
const qs = require('querystring');
const dotenv = require('dotenv');
dotenv.config();

const OUTLOOK_CLIENT_ID = process.env.OUTLOOK_CLIENT_ID;
const OUTLOOK_CLIENT_SECRET = process.env.OUTLOOK_CLIENT_SECRET;
const OUTLOOK_REDIRECT_URI = process.env.OUTLOOK_REDIRECT_URI || 'http://localhost:3000/auth/outlook/callback';
const OUTLOOK_TENANT_ID = process.env.OUTLOOK_TENANT_ID || 'common';

// Generate the Outlook OAuth URL
function getOutlookAuthURL() {
    const params = {
        client_id: OUTLOOK_CLIENT_ID,
        response_type: 'code',
        redirect_uri: OUTLOOK_REDIRECT_URI,
        response_mode: 'query',
        scope: 'Mail.Read Mail.Send offline_access',
        state: '12345', // Optional, for CSRF protection
    };
    return `https://login.microsoftonline.com/${OUTLOOK_TENANT_ID}/oauth2/v2.0/authorize?${qs.stringify(params)}`;
}

// Handle the Outlook OAuth callback and get tokens
async function handleOutlookCallback(code) {
    const tokenEndpoint = `https://login.microsoftonline.com/${OUTLOOK_TENANT_ID}/oauth2/v2.0/token`;

    const params = {
        client_id: OUTLOOK_CLIENT_ID,
        scope: 'Mail.Read Mail.Send offline_access',
        code: code,
        redirect_uri: OUTLOOK_REDIRECT_URI,
        grant_type: 'authorization_code',
        client_secret: OUTLOOK_CLIENT_SECRET,
    };

    const response = await axios.post(tokenEndpoint, qs.stringify(params), {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
    });

    return response.data;
}

module.exports = {
    getOutlookAuthURL,
    handleOutlookCallback,
};
