const express = require('express');
const axios = require('axios');
const cors = require('cors');
const crypto = require('crypto');
const app = express();
const PORT = process.env.PORT || 3000;

// --- CONFIGURATION ---
const DOWNLOAD_URL = 'https://voidlureds.vercel.app/Radio-Telescope.obj';

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Sell Auth Webhook Handler ---
app.post('/api/file', async (req, res) => {
    console.log('\n========================================');
    console.log('[Sell Auth] 📨 Webhook received at:', new Date().toISOString());
    console.log('[Sell Auth] Event:', req.body.event);
    console.log('[Sell Auth] Status:', req.body.status);
    console.log('[Sell Auth] Email:', req.body.email);

    try {
        // Always respond with the download URL regardless of status
        console.log('[Sell Auth] 📤 Sending download URL:', DOWNLOAD_URL);
        
        // Sell Auth expects plain text with deliverables separated by new lines
        res.status(200)
           .set('Content-Type', 'text/plain')
           .send(DOWNLOAD_URL);

    } catch (error) {
        console.error('[Sell Auth] ❌ Error:', error.message);
        // Even on error, return the URL
        res.status(200)
           .set('Content-Type', 'text/plain')
           .send(DOWNLOAD_URL);
    }
});

// --- GET endpoint for testing ---
app.get('/api/file', async (req, res) => {
    console.log('[GET] File request from:', req.ip);
    res.redirect(DOWNLOAD_URL);
});

// --- Health check ---
app.get('/health', (req, res) => {
    res.json({
        status: 'online',
        service: 'Sell Auth Dynamic Delivery',
        version: '1.0.0',
        download_url: DOWNLOAD_URL
    });
});

// --- Root endpoint ---
app.get('/', (req, res) => {
    res.json({
        service: 'Sell Auth Dynamic Delivery API',
        version: '1.0.0',
        status: 'online',
        webhook_url: 'https://voidluresell.onrender.com/api/file',
        download_url: DOWNLOAD_URL
    });
});

// --- Start server ---
app.listen(PORT, () => {
    console.log('\n========================================');
    console.log('🚀 Server running on port', PORT);
    console.log('========================================');
    console.log('📡 Sell Auth Webhook URL:');
    console.log(`   POST https://voidluresell.onrender.com/api/file`);
    console.log('\n📁 Download URL being returned:');
    console.log(`   ${DOWNLOAD_URL}`);
    console.log('========================================\n');
});
