const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

// --- CONFIGURATION ---
const SOURCE_FILE_URL = 'https://voidlureds.vercel.app/Radio-Telescope.obj';

// --- Middleware ---
app.use(cors());
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse form data

// --- Main function to deliver the file ---
const deliverFile = async (req, res) => {
    console.log(`[${new Date().toISOString()}] File request received from:`, req.ip);
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);

    try {
        const response = await axios({
            method: 'get',
            url: SOURCE_FILE_URL,
            responseType: 'stream',
            timeout: 60000,
        });

        // Check if the request is from Sell Auth (they expect specific headers)
        const isSellAuth = req.headers['user-agent']?.includes('SellAuth') || 
                          req.headers['x-sellauth'] === 'true';

        if (isSellAuth) {
            // Sell Auth specific response format
            res.setHeader('Content-Type', 'model/obj');
            res.setHeader('Content-Disposition', 'attachment; filename="Radio-Telescope.obj"');
            // Sell Auth expects a 200 status with the file
            res.status(200);
        } else {
            // Regular browser/download response
            res.setHeader('Content-Disposition', 'attachment; filename="Radio-Telescope.obj"');
            res.setHeader('Content-Type', 'model/obj');
        }

        // Forward content length if available
        if (response.headers['content-length']) {
            res.setHeader('Content-Length', response.headers['content-length']);
        }

        // Pipe the file
        response.data.pipe(res);

        response.data.on('error', (err) => {
            console.error('Stream error:', err.message);
            if (!res.headersSent) {
                res.status(500).json({ 
                    success: false, 
                    error: 'Failed to stream the file' 
                });
            }
        });

    } catch (error) {
        console.error('Error fetching source file:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch file from source',
            details: error.message 
        });
    }
};

// --- Sell Auth Compatible Endpoints ---

// 1. Standard file delivery (GET/POST)
app.get('/api/file', deliverFile);
app.post('/api/file', deliverFile);

// 2. Sell Auth specific endpoint (they often use /download)
app.get('/download', deliverFile);
app.post('/download', deliverFile);

// 3. Sell Auth webhook for successful purchase
app.post('/api/sellauth/webhook', async (req, res) => {
    console.log('Sell Auth Webhook received:', req.body);
    
    // Verify the webhook signature (if Sell Auth provides one)
    // Check for required fields
    const { 
        transaction_id, 
        product_id, 
        customer_email, 
        status,
        // Add other fields Sell Auth sends
    } = req.body;

    if (status === 'completed' || status === 'success') {
        // Payment was successful, generate a download token or URL
        const downloadUrl = `https://${req.get('host')}/api/file?token=${generateToken(transaction_id)}`;
        
        // Log the sale
        console.log(`Sale completed! Transaction: ${transaction_id}, Email: ${customer_email}`);
        
        // Respond to Sell Auth
        res.json({
            success: true,
            message: 'Purchase verified',
            download_url: downloadUrl,
            expires_in: 3600 // 1 hour
        });
    } else {
        res.status(400).json({
            success: false,
            error: 'Invalid transaction status'
        });
    }
});

// 4. Token-based download (if you want temporary access)
const validTokens = new Map();

function generateToken(transactionId) {
    const token = require('crypto').randomBytes(32).toString('hex');
    validTokens.set(token, {
        transactionId,
        expires: Date.now() + 3600000 // 1 hour
    });
    return token;
}

app.get('/api/download/:token', async (req, res) => {
    const { token } = req.params;
    
    // Check if token is valid
    const tokenData = validTokens.get(token);
    if (!tokenData || tokenData.expires < Date.now()) {
        return res.status(401).json({ 
            success: false, 
            error: 'Invalid or expired token' 
        });
    }
    
    // Remove used token (one-time use)
    validTokens.delete(token);
    
    // Deliver the file
    await deliverFile(req, res);
});

// 5. Sell Auth IPN (Instant Payment Notification) endpoint
app.post('/api/sellauth/ipn', async (req, res) => {
    console.log('Sell Auth IPN received:', req.body);
    
    // Verify the IPN signature
    const secret = process.env.SELLAUTH_SECRET || 'your-secret-key';
    // Add your verification logic here
    
    // Process the payment notification
    res.json({ success: true });
});

// --- Health Check (Sell Auth often checks this) ---
app.get('/health', (req, res) => {
    res.json({
        status: 'online',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        endpoints: {
            download: '/api/file',
            webhook: '/api/sellauth/webhook',
            ipn: '/api/sellauth/ipn'
        }
    });
});

// --- Root endpoint ---
app.get('/', (req, res) => {
    res.json({
        service: 'OBJ File Delivery API',
        version: '1.0.0',
        status: 'online',
        endpoints: {
            'GET /api/file': 'Download the OBJ file',
            'POST /api/file': 'Download the OBJ file (POST)',
            'GET /download': 'Alternative download endpoint',
            'POST /api/sellauth/webhook': 'Sell Auth webhook for purchases',
            'POST /api/sellauth/ipn': 'Sell Auth IPN endpoint',
            'GET /health': 'Health check endpoint'
        },
        sell_auth_compatible: true
    });
});

// --- Start server ---
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Sell Auth compatible API is ready!`);
    console.log(`Download endpoint: https://your-render-url.onrender.com/api/file`);
    console.log(`Webhook endpoint: https://your-render-url.onrender.com/api/sellauth/webhook`);
});
