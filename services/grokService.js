/**
 * CODA Backend - Grok API Service
 * Handles communication with Grok API for scam intent detection
 */

const axios = require("axios");

// Scam detection prompt template
const SCAM_DETECTION_PROMPT = `You are a phone scam detection expert. Analyze the following phone conversation transcript and determine if it indicates scam intent.

Common scam patterns include:
- Impersonation of authority (police, bank, government)
- Urgent requests for personal information (OTP, passwords, bank details)
- Threats or pressure tactics
- Too-good-to-be-true offers
- Requests for immediate payment or money transfer
- Claims about account issues requiring immediate action

Respond ONLY with valid JSON in this exact format:
{
  "intent": "SAFE" | "SUSPICIOUS" | "SCAM",
  "confidence": <number between 0.0 and 1.0>,
  "reason": "<brief explanation in 1-2 sentences>"
}

Transcript to analyze:
"""
{TEXT}
"""`;

/**
 * Mock scam detection for testing without API
 * Uses keyword-based detection
 */
function mockScamDetection(text) {
  const lowerText = text.toLowerCase();

  // High-risk keywords
  const scamKeywords = [
    "otp",
    "password",
    "pin",
    "cvv",
    "police",
    "arrest",
    "warrant",
    "legal action",
    "bank account",
    "suspended",
    "blocked",
    "frozen",
    "immediate",
    "urgent",
    "right now",
    "immediately",
    "transfer money",
    "send money",
    "pay now",
    "lottery",
    "prize",
    "won",
    "winner",
    "verify your",
    "confirm your",
    "update your",
  ];

  // Suspicious keywords
  const suspiciousKeywords = [
    "account",
    "verify",
    "confirm",
    "update",
    "security",
    "problem",
    "issue",
    "help",
    "customer service",
    "support",
    "department",
  ];

  let scamScore = 0;
  let suspiciousScore = 0;
  const matchedKeywords = [];

  for (const keyword of scamKeywords) {
    if (lowerText.includes(keyword)) {
      scamScore += 2;
      if (!matchedKeywords.includes(keyword)) {
        matchedKeywords.push(keyword);
      }
    }
  }

  for (const keyword of suspiciousKeywords) {
    if (lowerText.includes(keyword)) {
      suspiciousScore += 1;
    }
  }

  // Calculate confidence based on:
  // - Number of unique scam keywords (variety)
  // - Total scam score (frequency)
  // - Text length (more context = higher confidence)
  const keywordVariety = matchedKeywords.length;
  const textLength = text.length;
  
  // Determine intent based on scores
  if (scamScore >= 4) {
    // Base confidence starts at 0.85, scales up with more evidence
    // Variety bonus: +0.02 per unique keyword (up to 5)
    // Score bonus: +0.01 per score point (up to 10)
    const varietyBonus = Math.min(keywordVariety * 0.02, 0.10);
    const scoreBonus = Math.min(scamScore * 0.005, 0.05);
    const lengthBonus = textLength > 50 ? 0.02 : 0;
    
    const confidence = Math.min(0.99, 0.85 + varietyBonus + scoreBonus + lengthBonus);
    
    return {
      intent: "SCAM",
      confidence: Math.round(confidence * 100) / 100, // Round to 2 decimals
      reason: `High-risk patterns detected: ${matchedKeywords.slice(0, 4).join(", ")}`,
    };
  } else if (scamScore >= 2 || suspiciousScore >= 3) {
    const confidence = Math.min(0.80, 0.50 + scamScore * 0.08 + suspiciousScore * 0.04);
    return {
      intent: "SUSPICIOUS",
      confidence: Math.round(confidence * 100) / 100,
      reason: `Potentially suspicious patterns detected. Monitor closely.`,
    };
  } else {
    return {
      intent: "SAFE",
      confidence: 0.90,
      reason: "No significant scam indicators detected.",
    };
  }
}

/**
 * Analyze text using Grok API
 * @param {string} text - Transcribed call text
 * @returns {Promise<{intent: string, confidence: number, reason: string}>}
 */
async function analyzeWithGrok(text) {
  const apiKey = process.env.GROK_API_KEY;
  const mode = process.env.MODE || "mock";

  // Use mock detection if in mock mode or no API key
  if (mode === "mock" || !apiKey || apiKey === "your_grok_api_key_here") {
    console.log("[MOCK MODE] Using keyword-based detection");
    return mockScamDetection(text);
  }

  try {
    const prompt = SCAM_DETECTION_PROMPT.replace("{TEXT}", text);

    const response = await axios.post(
      "https://api.x.ai/v1/chat/completions",
      {
        model: "grok-beta",
        messages: [
          {
            role: "system",
            content:
              "You are a scam detection assistant. Always respond with valid JSON only.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.1,
        max_tokens: 200,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      },
    );

    const content = response.data.choices[0].message.content;

    // Parse JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);

      // Validate response structure
      if (!["SAFE", "SUSPICIOUS", "SCAM"].includes(result.intent)) {
        result.intent = "SUSPICIOUS";
      }
      if (
        typeof result.confidence !== "number" ||
        result.confidence < 0 ||
        result.confidence > 1
      ) {
        result.confidence = 0.5;
      }
      if (typeof result.reason !== "string") {
        result.reason = "Analysis completed";
      }

      return result;
    } else {
      console.error("[GROK] Failed to parse response:", content);
      return mockScamDetection(text);
    }
  } catch (error) {
    console.error("[GROK API ERROR]", error.message);

    // Fallback to mock detection on API error
    console.log("[FALLBACK] Using mock detection due to API error");
    return mockScamDetection(text);
  }
}

module.exports = {
  analyzeWithGrok,
  mockScamDetection,
};
