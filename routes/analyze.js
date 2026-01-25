/**
 * CODA Backend - Analyze Route
 * POST /analyze - Analyzes call transcript for scam intent
 */

const express = require('express');
const router = express.Router();
const { analyzeWithGrok } = require('../services/grokService');

/**
 * POST /analyze
 * Analyzes transcribed call text for scam intent
 * 
 * Request body:
 * {
 *   "text": "transcribed call text chunk"
 * }
 * 
 * Response:
 * {
 *   "intent": "SAFE" | "SUSPICIOUS" | "SCAM",
 *   "confidence": 0.0 - 1.0,
 *   "reason": "explanation"
 * }
 */
router.post('/', async (req, res) => {
    const startTime = Date.now();
    
    try {
        const { text } = req.body;
        
        // Validate request
        if (!text || typeof text !== 'string') {
            return res.status(400).json({
                error: 'Invalid request',
                message: 'Request body must contain "text" field as a string'
            });
        }
        
        // Skip empty or very short text
        if (text.trim().length < 5) {
            return res.json({
                intent: 'SAFE',
                confidence: 1.0,
                reason: 'Text too short to analyze'
            });
        }
        
        console.log(`[ANALYZE] Received text (${text.length} chars): "${text.substring(0, 100)}..."`);
        
        // Analyze with Grok API
        const result = await analyzeWithGrok(text);
        
        const processingTime = Date.now() - startTime;
        console.log(`[ANALYZE] Result: ${result.intent} (${result.confidence.toFixed(2)}) - ${processingTime}ms`);
        
        // Add processing metadata
        res.json({
            ...result,
            processingTimeMs: processingTime
        });
        
    } catch (error) {
        console.error('[ANALYZE ERROR]', error);
        
        res.status(500).json({
            error: 'Analysis failed',
            message: error.message,
            intent: 'SAFE',
            confidence: 0,
            reason: 'Error during analysis - defaulting to SAFE'
        });
    }
});

module.exports = router;
