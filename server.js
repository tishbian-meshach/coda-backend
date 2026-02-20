/**
 * CODA Backend Server
 * Call Observer & Defense Agent - Scam Detection API
 *
 * Architecture:
 *   Android (VOICE_DOWNLINK → whisper.cpp on-device → text)
 *     → POST /analyze (text only)
 *     → Groq API (scam detection)
 *     → Response
 *
 * Endpoints:
 *   POST /analyze - Analyze call transcript for scam intent
 *   GET /health   - Health check
 */

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const analyzeRoute = require("./routes/analyze");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Request logging
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// Routes
app.use("/analyze", analyzeRoute);

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "CODA Backend",
    version: "2.0.0",
    stt: "on-device (whisper.cpp)",
    scamDetection: "Groq API",
    timestamp: new Date().toISOString(),
  });
});

// Root
app.get("/", (req, res) => {
  res.json({
    name: "CODA - Call Observer & Defense Agent",
    description: "Real-time voice phishing detection API",
    version: "2.0.0",
    architecture: {
      stt: "On-device whisper.cpp (ggml-tiny.en)",
      analysis: "Groq API (llama-3.3-70b-versatile)",
    },
    endpoints: {
      "POST /analyze": "Analyze call transcript text for scam intent",
      "GET /health": "Health check",
    },
    usage: {
      method: "POST",
      url: "/analyze",
      body: { text: "transcribed call text chunk" },
      response: {
        intent: "SAFE | SUSPICIOUS | SCAM",
        confidence: "0.0 - 1.0",
        reason: "explanation",
      },
    },
  });
});

// 404
app.use((req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: `Endpoint ${req.method} ${req.path} not found`,
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("[ERROR]", err);
  res.status(500).json({
    error: "Internal Server Error",
    message: err.message,
  });
});

// Start
app.listen(PORT, () => {
  console.log("═".repeat(50));
  console.log("  CODA Backend Server v2.0.0");
  console.log("  Call Observer & Defense Agent");
  console.log("═".repeat(50));
  console.log(`  Port: ${PORT}`);
  console.log(`  URL:  http://localhost:${PORT}`);
  console.log("─".repeat(50));
  console.log("  STT:      On-device (whisper.cpp)");
  console.log("  Analysis: Groq API");
  console.log("─".repeat(50));
  console.log("  POST /analyze  — Analyze text transcript");
  console.log("  GET  /health   — Health check");
  console.log("═".repeat(50));
});

module.exports = app;
