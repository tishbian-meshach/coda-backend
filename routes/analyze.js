/**
 * CODA Backend - Analyze Route
 * POST /analyze - Analyzes call transcript for scam intent
 * Supports dual-language (English + secondary) analysis.
 * Supports responseLanguage for translated overlay descriptions.
 */

const express = require('express');
const router = express.Router();
const { analyzeWithGrok } = require('../services/grokService');

/**
 * POST /analyze
 * Analyzes transcribed call text for scam intent.
 * Accepts both single-language and dual-language requests.
 *
 * Request body:
 * {
 *   "text": "legacy single-language field",
 *   "englishText": "English transcript",
 *   "tamilText": "Tamil transcript (backward compat)",
 *   "secondaryText": "Secondary language transcript",
 *   "secondaryLanguage": "Language code (e.g. hi, te, kn)",
 *   "responseLanguage": "Language code for translated response reason"
 * }
 */
router.post('/', async (req, res) => {
    const startTime = Date.now();

    try {
        const { text, englishText, tamilText, secondaryText, secondaryLanguage, responseLanguage } = req.body;

        // Build combined context
        const en = (englishText || text || '').trim();
        const secondary = (secondaryText || tamilText || '').trim();
        const secLang = secondaryLanguage || (tamilText ? 'Tamil' : '');

        if (en.length < 5 && secondary.length < 5) {
            return res.json({
                intent: 'SAFE',
                confidence: 1.0,
                reason: 'Text too short to analyze'
            });
        }

        // Build the text to send to Grok
        let combinedText;
        if (secondary.length > 0 && en.length > 0) {
            const langLabel = secLang.toUpperCase() || 'SECONDARY';
            combinedText = `[ENGLISH TRANSCRIPT]:\n${en}\n\n[${langLabel} TRANSCRIPT]:\n${secondary}`;
            console.log(`[ANALYZE] Dual-language: EN(${en.length}) + ${langLabel}(${secondary.length}) chars`);
        } else if (secondary.length > 0) {
            const langLabel = secLang.toUpperCase() || 'SECONDARY';
            combinedText = `[${langLabel} TRANSCRIPT]:\n${secondary}`;
            console.log(`[ANALYZE] ${langLabel} only: ${secondary.length} chars`);
        } else {
            combinedText = en;
            console.log(`[ANALYZE] English only: ${en.length} chars`);
        }

        const result = await analyzeWithGrok(combinedText, responseLanguage);

        const processingTime = Date.now() - startTime;
        console.log(`[ANALYZE] Result: ${result.intent} (${result.confidence.toFixed(2)}) - ${processingTime}ms`);

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
