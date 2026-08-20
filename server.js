const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

// --- CONFIGURATION ---
const SOURCE_FILE_URL = 'https://voidlureds.vercel.app/Radio-Telescope.obj';

// --- Helper function to handle file delivery ---
const deliverFile = async (req, res) => {
    console.log(`[${new Date().toISOString()}] File request received.`);

    try {
        const response = await axios({
            method: 'get',
            url: SOURCE_FILE_URL,
            responseType: 'stream',
            timeout: 30000,
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
                res.status(500).json({ error: 'Failed to stream the file from source.' });
            }
        });

    } catch (error) {
        console.error('Error fetching source file:', error.message);
        if (error.response) {
            res.status(error.response.status).json({ 
                error: `Source file server error: ${error.response.status}` 
            });
        } else if (error.request) {
            res.status(503).json({ error: 'Source file server is unreachable.' });
        } else {
            res.status(500).json({ error: 'An internal server error occurred.' });
        }
    }
};

// --- Route handlers for both GET and POST ---
app.get('/api/file', deliverFile);
app.post('/api/file', deliverFile); // <-- Added POST support

// --- Root endpoint ---
app.get('/', (req, res) => {
    res.send('API is running. Use GET or POST to /api/file to download the OBJ file.');
});

// --- START THE SERVER ---
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`File endpoint: https://your-render-url.onrender.com/api/file`);
});
