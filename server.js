// server.js
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const { sendGoogleEmail, sendOutlookEmail } = require('./emailService');
const { googleOAuth2Client, getGoogleAuthURL, handleGoogleCallback } = require('./googleAuth');
const { outlookOAuth2Client, getOutlookAuthURL, handleOutlookCallback } = require('./outlookAuth');
const fs = require('fs');

const app = express();

const path = require('path');
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true,
}));



// Load accounts from JSON file
const accountsFilePath = path.join(__dirname, 'accounts.json');
let accounts = [];

if (fs.existsSync(accountsFilePath)) {
    const data = fs.readFileSync(accountsFilePath);
    accounts = JSON.parse(data);
}

// Function to save accounts to JSON file
function saveAccounts() {
    fs.writeFileSync(accountsFilePath, JSON.stringify(accounts, null, 2));
}

// Home Route
app.get('/', (req, res) => {
    res.send(`
        <h1>Email Automation Tool</h1>
        <a href="/auth/google">Connect Google Account</a><br/>
        <a href="/auth/outlook">Connect Outlook Account</a><br/>
        <h2>Send Test Emails</h2>
        <form action="/send-email" method="post">
            <label for="recipient">Recipient Email:</label><br/>
            <input type="email" id="recipient" name="recipient" required><br/><br/>
            <button type="submit">Send Test Emails</button>
        </form>
    `);
});

// Google OAuth Routes
app.get('/auth/google', (req, res) => {
    const url = getGoogleAuthURL();
    res.redirect(url);
});

app.get('/auth/google/callback', async (req, res) => {
    try {
        const tokens = await handleGoogleCallback(req.query.code);
        const oauth2Client = require('./googleAuth').googleOAuth2Client;
        const oauth2 = google.oauth2({
            auth: oauth2Client,
            version: 'v2',
        });
        const userInfo = await oauth2.userinfo.get();
        const account = {
            provider: 'google',
            email: userInfo.data.email,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            expiryDate: tokens.expiry_date || null,
        };
        accounts.push(account);
        saveAccounts();
        res.send('Google account connected successfully!');
    } catch (error) {
        console.error(error);
        res.status(500).send('Authentication failed');
    }
});

// Outlook OAuth Routes
app.get('/auth/outlook', (req, res) => {
    const url = getOutlookAuthURL();
    res.redirect(url);
});

app.get('/auth/outlook/callback', async (req, res) => {
    try {
        const tokens = await handleOutlookCallback(req.query.code);
        // Get user email using Microsoft Graph API
        const axios = require('axios');
        const userResponse = await axios.get('https://graph.microsoft.com/v1.0/me', {
            headers: {
                Authorization: `Bearer ${tokens.access_token}`,
            },
        });
        const account = {
            provider: 'outlook',
            email: userResponse.data.mail || userResponse.data.userPrincipalName || 'unknown',
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            expiryDate: tokens.expires_on || null,
        };
        accounts.push(account);
        saveAccounts();
        res.send('Outlook account connected successfully!');
    } catch (error) {
        console.error(error.response ? error.response.data : error.message);
        res.status(500).send('Authentication failed');
    }
});

// Send Email Route
app.post('/send-email', async (req, res) => {
    const recipient = req.body.recipient;
    if (!recipient) {
        return res.status(400).send('Recipient email is required');
    }

    try {
        for (const account of accounts) {
            if (account.provider === 'google') {
                await sendGoogleEmail(account, recipient);
            } else if (account.provider === 'outlook') {
                await sendOutlookEmail(account, recipient);
            }
        }
        res.send('Test emails sent successfully!');
    } catch (error) {
        console.error(error);
        res.status(500).send('Failed to send emails');
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
