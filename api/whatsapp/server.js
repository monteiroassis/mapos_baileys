const {
    default: makeWASocket,
    DisconnectReason,
    useMultiFileAuthState
} = require('@whiskeysockets/baileys');
const express = require('express');
const bodyParser = require('body-parser');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

let sock;
let qrCodeData = null; // Store QR Code data

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    sock = makeWASocket({
        printQRInTerminal: true,
        auth: state,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('QR Code received');
            // qrcode.generate(qr, { small: true }); 
            qrCodeData = qr; // Save QR to variable
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('connection closed due to ', lastDisconnect.error, ', reconnecting ', shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('opened connection');
            qrCodeData = null; // Clear QR on successful connection
        }
    });
}

// Ensure the auth directory exists
if (!fs.existsSync('auth_info_baileys')) {
    fs.mkdirSync('auth_info_baileys');
}

connectToWhatsApp();

// API Endpoints
app.post('/send', async (req, res) => {
    const { number, message, originalBase64, fileName } = req.body;

    if (!number || (!message && !originalBase64)) {
        return res.status(400).json({ error: 'Number and message/media are required' });
    }

    try {
        // Format number: ensure it mentions the country code. Assuming BR +55 if not present might be risky, 
        // but Baileys expects JID format: 5511999999999@s.whatsapp.net
        let formattedNumber = number.replace(/\D/g, ''); // Remove non-digits

        if (!formattedNumber.startsWith('55') && (formattedNumber.length === 10 || formattedNumber.length === 11)) {
            formattedNumber = '55' + formattedNumber;
        }

        if (!formattedNumber.endsWith('@s.whatsapp.net')) {
            formattedNumber = formattedNumber + '@s.whatsapp.net';
        }

        const id = formattedNumber;

        let sentMsg;
        if (originalBase64) {
            const buffer = Buffer.from(originalBase64, 'base64');
            sentMsg = await sock.sendMessage(id, {
                document: buffer,
                mimetype: 'application/pdf',
                fileName: fileName || 'document.pdf',
                caption: message || ''
            });
        } else {
            sentMsg = await sock.sendMessage(id, { text: message });
        }

        res.json({ success: true, data: sentMsg });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: 'Failed to send message', details: error.message });
    }
});

app.get('/status', (req, res) => {
    res.json({
        status: sock?.user ? 'connected' : 'disconnected',
        user: sock?.user,
        qr: qrCodeData
    });
});

app.get('/qr', (req, res) => {
    res.json({ qr: qrCodeData });
});

app.post('/stop', (req, res) => {
    res.json({ success: true, message: 'Stopping server...' });
    // Allow response to be sent before exiting
    setTimeout(() => {
        // Close socket if open
        if (sock) sock.end(undefined);
        console.log('Server stopping via API request');
        process.exit(0);
    }, 100);
});

app.post('/logout', async (req, res) => {
    try {
        if (sock) {
            await sock.logout();
            sock.end(undefined);
            sock = null;
        }
    } catch (err) {
        console.log('Logout error (handled):', err.message);
    }

    try {
        // Delete auth folder to force fresh session
        fs.rmSync('auth_info_baileys', { recursive: true, force: true });
        console.log('Auth folder deleted');
    } catch (err) {
        console.error('Error deleting auth folder:', err);
    }

    // Restart connection to generate new QR
    connectToWhatsApp();

    res.json({ success: true, message: 'Logged out and session cleared.' });
});

app.listen(PORT, () => {
    console.log(`WhatsApp API Server running on port ${PORT}`);
});
