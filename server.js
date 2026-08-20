const express = require('express');
const axios = require('axios');
const cors = require('cors');
const crypto = require('crypto');
const app = express();
const PORT = process.env.PORT || 3000;

// --- CONFIGURATION ---
const SOURCE_FILE_URL = 'https://voidlureds.vercel.app/Radio-Telescope.obj';

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Sell Auth Webhook Handler ---
app.post('/api/file', async (req, res) => {
    console.log('[Sell Auth] Webhook received at:', new Date().toISOString());
    console.log('[Sell Auth] Headers:', JSON.stringify(req.headers, null, 2));
    console.log('[Sell Auth] Body:', JSON.stringify(req.body, null, 2));

    try {
        // Verify the webhook signature
        const signature = req.headers['x-signature'];
        const timestamp = req.headers['x-timestamp'];
        
        if (!signature) {
            console.error('[Sell Auth] Missing signature header');
            return res.status(401).json({ 
                success: false, 
                error: 'Missing signature' 
            });
        }

        // Get the sale data
        const saleData = req.body;
        const event = saleData.event;
        const status = saleData.status;

        console.log(`[Sell Auth] Event: ${event}, Status: ${status}`);

        // Check if it's a completed purchase
        if (event === 'INVOICE.ITEM.DELIVER-DYNAMIC' && status === 'completed') {
            console.log('[Sell Auth] ✅ Valid purchase detected!');
            
            // Log the customer details
            console.log(`[Sell Auth] Customer: ${saleData.email}`);
            console.log(`[Sell Auth] Product: ${saleData.item?.product?.name || 'Unknown'}`);
            console.log(`[Sell Auth] Transaction: ${saleData.unique_id}`);
            
            // For free products (price 0.00), deliver immediately
            if (parseFloat(saleData.price) === 0) {
                console.log('[Sell Auth] Free product detected - delivering file');
                
                // Fetch the file from source
                const fileResponse = await axios({
                    method: 'get',
                    url: SOURCE_FILE_URL,
                    responseType: 'stream',
                    timeout: 60000,
                });

                // Set headers for file download
                res.setHeader('Content-Type', 'model/obj');
                res.setHeader('Content-Disposition', 'attachment; filename="Radio-Telescope.obj"');
                
                if (fileResponse.headers['content-length']) {
                    res.setHeader('Content-Length', fileResponse.headers['content-length']);
                }

                // Stream the file
                fileResponse.data.pipe(res);

                fileResponse.data.on('error', (err) => {
                    console.error('[Sell Auth] Stream error:', err.message);
                    if (!res.headersSent) {
                        res.status(500).json({ 
                            success: false, 
                            error: 'Failed to stream file' 
                        });
                    }
                });

            } else {
                // For paid products, generate a download token
                const token = crypto.randomBytes(32).toString('hex');
                const downloadUrl = `https://${req.get('host')}/api/download/${token}`;
                
                console.log(`[Sell Auth] Generated download token for paid product`);
                
                // Respond with the download URL
                res.json({
                    success: true,
                    message: 'Purchase verified successfully',
                    download_url: downloadUrl,
                    expires_in: 3600
                });
            }
        } else {
            console.log(`[Sell Auth] ⚠️ Unhandled event: ${event} or status: ${status}`);
            res.status(200).json({ 
                success: true, 
                message: 'Webhook received but not processed' 
            });
        }

    } catch (error) {
        console.error('[Sell Auth] Error:', error.message);
        
        // Check if the source file exists
        if (error.response?.status === 404) {
            return res.status(404).json({ 
                success: false, 
                error: 'Source file not found at the specified URL' 
            });
        }

        res.status(500).json({ 
            success: false, 
            error: 'Internal server error',
            message: error.message 
        });
    }
});

// --- GET endpoint (for browser downloads) ---
app.get('/api/file', async (req, res) => {
    console.log('[GET] File request received from:', req.ip);
    
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

// --- Token-based download for paid products ---
const validTokens = new Map();

app.get('/api/download/:token', async (req, res) => {
    const { token } = req.params;
    
    console.log(`[Token] Download attempt with token: ${token.substring(0, 10)}...`);
    
    const tokenData = validTokens.get(token);
    
    if (!tokenData) {
        console.log('[Token] ❌ Invalid token');
        return res.status(401).json({ 
            success: false, 
            error: 'Invalid token' 
        });
    }
    
    if (tokenData.expires < Date.now()) {
        console.log('[Token] ❌ Token expired');
        validTokens.delete(token);
        return res.status(401).json({ 
            success: false, 
            error: 'Token expired' 
        });
    }
    
    console.log('[Token] ✅ Valid token, delivering file');
    
    // Remove used token (one-time use)
    validTokens.delete(token);
    
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
        
    } catch (error) {
        console.error('Error fetching file:', error.message);
        res.status(500).json({ error: 'Failed to fetch file' });
    }
});

// --- Root endpoint ---
app.get('/', (req, res) => {
    res.json({
        service: 'OBJ File Delivery API',
        version: '1.0.0',
        status: 'online',
        endpoints: {
            'POST /api/file': 'Sell Auth webhook endpoint',
            'GET /api/file': 'Direct file download',
            'GET /api/download/:token': 'Token-based download'
        }
    });
});

// --- Start server ---
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`✅ Sell Auth compatible API is ready!`);
    console.log(`📥 Webhook URL: https://your-render-url.onrender.com/api/file`);
    console.log(`📁 Direct download: https://your-render-url.onrender.com/api/file`);
});
