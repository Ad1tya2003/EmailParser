// emailService.js
const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const axios = require('axios');
const qs = require('querystring');
const dotenv = require('dotenv');
dotenv.config();

// Load Outlook credentials from environment variables
const OUTLOOK_CLIENT_ID = process.env.OUTLOOK_CLIENT_ID;
const OUTLOOK_CLIENT_SECRET = process.env.OUTLOOK_CLIENT_SECRET;
const OUTLOOK_TENANT_ID = process.env.OUTLOOK_TENANT_ID || 'common';

async function sendGoogleEmail(account, recipient) {
    try {
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback'
        );

        oauth2Client.setCredentials({
            access_token: account.accessToken,
            refresh_token: account.refreshToken,
            // expiry_date: account.expiryDate,
        });

        // Check if access token is expired and refresh if necessary
        if (account.expiryDate && Date.now() >= account.expiryDate) {
            const newTokens = await oauth2Client.refreshAccessToken();
            oauth2Client.setCredentials(newTokens.credentials);
            account.accessToken = newTokens.credentials.access_token;
            account.expiryDate = newTokens.credentials.expiry_date;
            // Save updated tokens to storage if necessary
        }

        const accessToken = account.accessToken;

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                type: 'OAuth2',
                user: account.email,
                clientId: process.env.GOOGLE_CLIENT_ID,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                refreshToken: account.refreshToken,
                accessToken: accessToken,
            },
        });

        const mailOptions = {
            from: account.email,
            to: recipient,
            subject: 'Test Email from Google Account',
            text: 'This is a test email sent using your connected Google account.',
        };

        await transporter.sendMail(mailOptions);
        console.log(`Email sent from Google account: ${account.email}`);
    } catch (error) {
        console.error(`Failed to send email from Google account ${account.email}:`, error);
    }
}

// emailService.js (modified sendOutlookEmail)

async function sendOutlookEmail(account, recipient) {
    try {
        let accessToken = account.accessToken;

        // Check if access token is expired (if expiryDate is available)
        if (account.expiryDate && Date.now() >= account.expiryDate * 1000) {
            // Refresh the access token
            const tokenResponse = await axios.post(`https://login.microsoftonline.com/${OUTLOOK_TENANT_ID}/oauth2/v2.0/token`, qs.stringify({
                client_id: OUTLOOK_CLIENT_ID,
                scope: 'Mail.Read Mail.Send offline_access',
                refresh_token: account.refreshToken,
                client_secret: OUTLOOK_CLIENT_SECRET,
                grant_type: 'refresh_token',
            }), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            });

            accessToken = tokenResponse.data.access_token;
            account.accessToken = accessToken;
            account.expiryDate = tokenResponse.data.expires_on;
            account.refreshToken = tokenResponse.data.refresh_token || account.refreshToken; // Sometimes new refresh tokens are issued

            // Save updated tokens to storage if necessary
        }

        const message = {
            message: {
                subject: 'Test Email from Outlook Account',
                body: {
                    contentType: 'Text',
                    content: 'This is a test email sent using your connected Outlook account.',
                },
                toRecipients: [
                    {
                        emailAddress: {
                            address: recipient,
                        },
                    },
                ],
            },
            saveToSentItems: 'true',
        };

        const graphClient = require('@microsoft/microsoft-graph-client').Client.init({
            authProvider: (done) => {
                done(null, accessToken);
            },
        });

        await graphClient.api('/me/sendMail').post(message);
        console.log(`Email sent from Outlook account: ${account.email}`);
    } catch (error) {
        console.error(`Failed to send email from Outlook account ${account.email}:`, error);
    }
}

module.exports = {
    sendGoogleEmail,
    sendOutlookEmail,
};
