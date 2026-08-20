const express = require('express');
const axios = require('axios');
const cors = require('cors');
const crypto = require('crypto');
const app = express();
const PORT = process.env.PORT || 3000;

// --- CONFIGURATION ---
const SOURCE_FILE_URL = 'https://voidlureds.vercel.app/Radio-Telescope.obj';
const SELLAUTH_SECRET = process.env.SELLAUTH_SECRET || 'your-sellauth-secret-key';

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Verify Sell Auth Signature ---
function verifySignature(req) {
    const signature = req.headers['x-signature'];
    const timestamp = req.headers['x-timestamp'];
    
    if (!signature) {
        console.log('[Sell Auth] ⚠️ No signature header found');
        return false;
    }

    // Create HMAC-SHA256 signature
    const payload = JSON.stringify(req.body);
    const hmac = crypto.createHmac('sha256', SELLAUTH_SECRET);
    hmac.update(payload);
    const expectedSignature = hmac.digest('hex');

    // Compare signatures (constant time comparison for security)
    return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
    );
}

// --- Sell Auth Dynamic Delivery Webhook ---
app.post('/api/file', async (req, res) => {
    console.log('\n========================================');
    console.log('[Sell Auth] 📨 Webhook received at:', new Date().toISOString());
    console.log('[Sell Auth] Event:', req.body.event);
    console.log('[Sell Auth] Status:', req.body.status);
    console.log('[Sell Auth] Email:', req.body.email);
    console.log('[Sell Auth] Transaction ID:', req.body.unique_id);

    // Verify signature (optional but recommended)
    const isValid = verifySignature(req);
    if (!isValid) {
        console.log('[Sell Auth] ❌ Invalid signature!');
        // Still respond with 200 for testing, but log the error
        // In production, you should return 401
    }

    try {
        // Check if the purchase is completed
        if (req.body.event !== 'INVOICE.ITEM.DELIVER-DYNAMIC') {
            console.log('[Sell Auth] ⚠️ Unknown event type:', req.body.event);
            return res.status(200).send('Event not handled');
        }

        if (req.body.status !== 'completed') {
            console.log('[Sell Auth] ⚠️ Purchase not completed. Status:', req.body.status);
            return res.status(200).send('Purchase not completed');
        }

        // Log the sale details
        const productName = req.body.item?.product?.name || 'Unknown Product';
        const customerEmail = req.body.email || 'Unknown Email';
        const price = req.body.price || '0.00';
        
        console.log('[Sell Auth] ✅ Valid purchase detected!');
        console.log(`[Sell Auth] 📦 Product: ${productName}`);
        console.log(`[Sell Auth] 👤 Customer: ${customerEmail}`);
        console.log(`[Sell Auth] 💰 Price: $${price}`);

        // --- RESPOND WITH PLAIN TEXT DELIVERABLES ---
        // Sell Auth expects plain text with deliverables separated by new lines
        
        // Option 1: Direct download URL (file hosted elsewhere)
        const downloadUrl = 'https://voidlureds.vercel.app/Radio-Telescope.obj';
        
        // Option 2: You can also provide multiple deliverables
        const deliverables = [
            downloadUrl,
            // Add more deliverables if needed, one per line
            // 'https://example.com/readme.txt',
            // 'https://example.com/instructions.pdf'
        ];

        // Send plain text response with deliverables
        console.log('[Sell Auth] 📤 Sending deliverables:', deliverables);
        res.status(200)
           .set('Content-Type', 'text/plain')
           .send(deliverables.join('\n'));

    } catch (error) {
        console.error('[Sell Auth] ❌ Error:', error.message);
        // Even on error, Sell Auth expects a 200 response
        // You can send an error message as the deliverable
        res.status(200)
           .set('Content-Type', 'text/plain')
           .send('Error processing your purchase. Please contact support.');
    }
});

// --- GET endpoint for testing (browser) ---
app.get('/api/file', async (req, res) => {
    console.log('[GET] File request from:', req.ip);
    
    try {
        const response = await axios({
            method: 'get',
            url: SOURCE_FILE_URL,
            responseType: 'stream',
            timeout: 60000,
        });

        res.setHeader('Content-Disposition', 'attachment; filename="Radio-Telescope.obj"');
        res.setHeader('Content-Type', 'model/obj');
        
        if (response.headers['content-length']) {
            res.setHeader('Content-Length', response.headers['content-length']);
        }

        response.data.pipe(res);
        
        response.data.on('error', (err) => {
            console.error('Stream error:', err.message);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Failed to stream file' });
            }
        });

    } catch (error) {
        console.error('Error fetching file:', error.message);
        res.status(500).json({ error: 'Failed to fetch file' });
    }
});

// --- Health check for Sell Auth ---
app.get('/health', (req, res) => {
    res.json({
        status: 'online',
        service: 'Sell Auth Dynamic Delivery API',
        version: '1.0.0',
        endpoints: {
            webhook: 'POST /api/file',
            download: 'GET /api/file'
        }
    });
});

// --- Root endpoint ---
app.get('/', (req, res) => {
    res.json({
        service: 'Sell Auth Dynamic Delivery API',
        version: '1.0.0',
        status: 'online',
        instructions: {
            webhook_url: 'https://your-render-url.onrender.com/api/file',
            response_format: 'Plain text with deliverables separated by new lines',
            example_response: 'https://voidlureds.vercel.app/Radio-Telescope.obj'
        }
    });
});

// --- Start server ---
app.listen(PORT, () => {
    console.log('\n========================================');
    console.log('🚀 Server running on port', PORT);
    console.log('========================================');
    console.log('📡 Sell Auth Webhook URL:');
    console.log(`   POST https://your-render-url.onrender.com/api/file`);
    console.log('\n📁 Direct Download URL:');
    console.log(`   GET https://your-render-url.onrender.com/api/file`);
    console.log('\n📋 Response Format:');
    console.log('   Plain text with deliverables (one per line)');
    console.log('   Example: https://voidlureds.vercel.app/Radio-Telescope.obj');
    console.log('========================================\n');
});
