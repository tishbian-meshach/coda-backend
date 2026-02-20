/**
 * CODA Backend - Audio Analysis Route
 * POST /analyze-audio
 *
 * Receives base64-encoded WAV audio from Android,
 * transcribes to text using STT service,
 * then analyzes for scam intent using Grok.
 */

const express = require("express");
const router = express.Router();
const { transcribeAudio } = require("../services/sttService");
const { analyzeWithGrok } = require("../services/grokService");

/**
 * POST /analyze-audio
 *
 * Request body:
 * {
 *   "audio": "<base64 encoded WAV>",
 *   "sampleRate": 16000,
 *   "channels": 1,
 *   "encoding": "PCM_16BIT"
 * }
 *
 * Response:
 * {
 *   "intent": "SAFE" | "SUSPICIOUS" | "SCAM",
 *   "confidence": 0.0 - 1.0,
 *   "reason": "explanation",
 *   "transcript": "transcribed text"
 * }
 */
router.post("/", async (req, res) => {
  const startTime = Date.now();

  try {
    const { audio, sampleRate, channels, encoding } = req.body;

    // Validate request
    if (!audio) {
      return res.status(400).json({
        error: "Missing required field: audio",
        message: "Request must include base64-encoded audio data",
      });
    }

    // Decode base64 to buffer
    const wavBuffer = Buffer.from(audio, "base64");
    console.log(
      `[AUDIO] Received ${wavBuffer.length} bytes (${(wavBuffer.length / 1024).toFixed(1)}KB)`
    );
    console.log(
      `[AUDIO] Format: ${encoding || "unknown"}, ${sampleRate || "?"}Hz, ${channels || "?"} ch`
    );

    if (wavBuffer.length < 100) {
      return res.status(400).json({
        error: "Audio too short",
        message: "Audio data is too small to process",
      });
    }

    // Step 1: Transcribe audio to text
    console.log("[STEP 1] Transcribing audio...");
    const transcript = await transcribeAudio(wavBuffer);
    console.log(`[STEP 1] Transcript: "${transcript}"`);

    if (!transcript || transcript.trim().length === 0) {
      // No speech detected in audio
      return res.json({
        intent: "SAFE",
        confidence: 1.0,
        reason: "No speech detected in audio chunk",
        transcript: "",
        processingTimeMs: Date.now() - startTime,
      });
    }

    // Step 2: Analyze transcript for scam intent
    console.log("[STEP 2] Analyzing for scam intent...");
    const analysis = await analyzeWithGrok(transcript);
    console.log(
      `[STEP 2] Result: ${analysis.intent} (${analysis.confidence}) - ${analysis.reason}`
    );

    // Return combined result
    const result = {
      intent: analysis.intent,
      confidence: analysis.confidence,
      reason: analysis.reason,
      transcript: transcript,
      processingTimeMs: Date.now() - startTime,
    };

    console.log(`[DONE] Processed in ${result.processingTimeMs}ms`);
    res.json(result);
  } catch (error) {
    console.error("[AUDIO ANALYSIS ERROR]", error);
    res.status(500).json({
      error: "Audio analysis failed",
      message: error.message,
      processingTimeMs: Date.now() - startTime,
    });
  }
});

module.exports = router;
