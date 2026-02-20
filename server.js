/**
 * CODA Backend Server
 * Call Observer & Defense Agent - Scam Detection API
 * 
 * Endpoints:
 * - POST /analyze - Analyze call transcript for scam intent
 * - GET /health - Health check endpoint
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const analyzeRoute = require('./routes/analyze');
const analyzeAudioRoute = require('./routes/analyze-audio');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));  // Increased for base64 audio chunks

// Request logging
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.path}`);
    next();
});

// Routes
app.use('/analyze', analyzeRoute);
app.use('/analyze-audio', analyzeAudioRoute);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'CODA Backend',
        version: '1.0.0',
        mode: process.env.MODE || 'mock',
        timestamp: new Date().toISOString()
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        name: 'CODA - Call Observer & Defense Agent',
        description: 'Real-time voice phishing detection API',
        endpoints: {
            'POST /analyze': 'Analyze call transcript for scam intent',
            'POST /analyze-audio': 'Analyze raw audio (STT + scam detection)',
            'GET /health': 'Health check'
        },
        usage: {
            method: 'POST',
            url: '/analyze',
            body: {
                text: 'transcribed call text chunk'
            },
            response: {
                intent: 'SAFE | SUSPICIOUS | SCAM',
                confidence: '0.0 - 1.0',
                reason: 'explanation'
            }
        }
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Endpoint ${req.method} ${req.path} not found`
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('[ERROR]', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: err.message
    });
});

// Start server
app.listen(PORT, () => {
    console.log('═'.repeat(50));
    console.log('  CODA Backend Server');
    console.log('  Call Observer & Defense Agent');
    console.log('═'.repeat(50));
    console.log(`  Mode: ${process.env.MODE || 'mock'}`);
    console.log(`  Port: ${PORT}`);
    console.log(`  URL:  http://localhost:${PORT}`);
    console.log('═'.repeat(50));
    console.log('  Endpoints:');
    console.log('  POST /analyze        - Analyze text transcript');
    console.log('  POST /analyze-audio  - Analyze audio (STT + scam)');
    console.log('  GET  /health         - Health check');
    console.log('═'.repeat(50));
});

module.exports = app;
