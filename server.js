const express = require('express');
const axios = require('axios'); // To fetch the file from the source URL
const app = express();
const PORT = process.env.PORT || 3000;

// --- CONFIGURATION ---
// The source URL where your .obj file is hosted
const SOURCE_FILE_URL = 'https://voidlureds.vercel.app/Radio-Telescope.obj';

// --- ROUTE: Public File Delivery ---
// This endpoint will serve the file to any request
app.get('/api/file', async (req, res) => {
    console.log(`[${new Date().toISOString()}] File request received.`);

    try {
        // 1. Fetch the file from the source URL as a stream
        const response = await axios({
            method: 'get',
            url: SOURCE_FILE_URL,
            responseType: 'stream', // Important for handling large files efficiently
            timeout: 30000, // 30 second timeout
        });

        // 2. Set appropriate headers for the client
        //    This tells the browser to download the file with a specific name
        res.setHeader('Content-Disposition', 'attachment; filename="Radio-Telescope.obj"');
        //    Set the correct content type for .obj files
        res.setHeader('Content-Type', 'model/obj');
        //    Forward the content length if provided by the source server
        if (response.headers['content-length']) {
            res.setHeader('Content-Length', response.headers['content-length']);
        }

        // 3. Pipe the file stream directly to the response
        response.data.pipe(res);

        // 4. Handle any errors that occur during streaming
        response.data.on('error', (err) => {
            console.error('Stream error:', err.message);
            // If headers haven't been sent yet, send an error response
            if (!res.headersSent) {
                res.status(500).json({ error: 'Failed to stream the file from source.' });
            }
        });

    } catch (error) {
        console.error('Error fetching source file:', error.message);
        // Handle specific HTTP errors from the source
        if (error.response) {
            // The source server responded with an error (e.g., 404, 500)
            res.status(error.response.status).json({ 
                error: `Source file server error: ${error.response.status}` 
            });
        } else if (error.request) {
            // The request was made but no response was received (network error)
            res.status(503).json({ error: 'Source file server is unreachable.' });
        } else {
            // Something else went wrong
            res.status(500).json({ error: 'An internal server error occurred.' });
        }
    }
});

// --- BASIC ROOT ENDPOINT (Optional) ---
app.get('/', (req, res) => {
    res.send('API is running. Access /api/file to download the OBJ file.');
});

// --- START THE SERVER ---
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Public file endpoint: http://localhost:${PORT}/api/file`);
});
