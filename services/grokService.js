/**
 * CODA Backend - Groq Scam Detection Service
 * Uses Groq API with multiple API keys and model fallback for scam detection.
 * NO mock mode — production only.
 */

const SCAM_DETECTION_PROMPT = `You are a phone scam detection expert specializing in Indian phone scams. You understand both English and Tamil (தமிழ்).

You will receive a phone conversation transcript that may contain:
- English text only
- Tamil text only
- Both English and Tamil transcripts of the SAME call (dual-language transcription)

When both [ENGLISH TRANSCRIPT] and [TAMIL TRANSCRIPT] are provided, they represent the same conversation transcribed in both languages simultaneously. Use BOTH to understand the full context — the Tamil transcript may capture words/phrases that the English one missed, and vice versa.

Common scam patterns include:
- Impersonation of authority (police, bank, government, RBI, SBI, BSNL)
- Urgent requests for personal information (OTP, passwords, bank details, Aadhaar, PAN)
- Threats or pressure tactics (arrest, account freeze, legal action)
- Too-good-to-be-true offers (lottery, prizes, cashback)
- Requests for immediate payment or money transfer (UPI, NEFT, Google Pay, PhonePe)
- Claims about account issues requiring immediate action
- Asking to install remote access apps (AnyDesk, TeamViewer)
- Fake KYC update requests

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

// ============================================================================
// GROQ API CONFIGURATION
// ============================================================================

const GROQ_API_KEYS = [
  process.env.GROQ_API_KEY || "",
  process.env.GROQ_API_KEY_2 || "",
  process.env.GROQ_API_KEY_3 || "",
].filter(Boolean);

const GROQ_BASE_URL =
  process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1";

const GROQ_MODELS = (
  process.env.GROQ_MODELS ||
  "llama-3.3-70b-versatile,llama-3.1-8b-instant"
)
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

const GROQ_CONFIG = {
  maxTokens: parseInt(process.env.GROQ_MAX_TOKENS || "300"),
  temperature: 0.1,
  maxRetries: 3,
  initialBackoff: 1000,
  maxBackoff: 30000,
  timeout: 30000,
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ============================================================================
// GROQ API CALLER WITH MULTI-KEY + MULTI-MODEL FALLBACK
// ============================================================================

async function callGroqAPI(messages) {
  let lastError = null;

  for (let keyIndex = 0; keyIndex < GROQ_API_KEYS.length; keyIndex++) {
    const apiKey = GROQ_API_KEYS[keyIndex];

    for (let modelIndex = 0; modelIndex < GROQ_MODELS.length; modelIndex++) {
      const model = GROQ_MODELS[modelIndex];

      for (let attempt = 0; attempt < GROQ_CONFIG.maxRetries; attempt++) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(
            () => controller.abort(),
            GROQ_CONFIG.timeout
          );

          console.log(
            `[GROQ] Key ${keyIndex + 1}/${GROQ_API_KEYS.length}, Model: ${model}, Attempt: ${attempt + 1}`
          );

          const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model,
              messages,
              temperature: GROQ_CONFIG.temperature,
              max_tokens: GROQ_CONFIG.maxTokens,
              response_format: { type: "json_object" },
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            const errText = await response.text().catch(() => "");
            throw new Error(`Groq API ${response.status}: ${errText}`);
          }

          const data = await response.json();
          const content = data.choices?.[0]?.message?.content;

          if (!content) throw new Error("No content in Groq response");

          console.log(
            `[GROQ] ✓ Success — Key ${keyIndex + 1}, Model: ${model}`
          );
          return content;
        } catch (error) {
          lastError = error;
          const isRetryable =
            error.message?.includes("429") ||
            error.message?.includes("503") ||
            error.message?.includes("rate_limit") ||
            error.name === "AbortError";

          if (attempt === GROQ_CONFIG.maxRetries - 1) {
            console.warn(
              `[GROQ] ✗ Failed — Key ${keyIndex + 1}, Model: ${model}: ${error.message}`
            );
            break;
          }

          if (isRetryable) {
            const backoff = Math.min(
              GROQ_CONFIG.initialBackoff * Math.pow(2, attempt),
              GROQ_CONFIG.maxBackoff
            );
            console.log(`[GROQ] Retrying in ${backoff}ms...`);
            await sleep(backoff);
          } else {
            break; // Non-retryable error, try next model
          }
        }
      }
    }
  }

  throw lastError || new Error("All Groq API keys and models exhausted");
}

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

/**
 * Analyze text using Groq API for scam detection.
 * @param {string} text - Transcribed call text
 * @returns {Promise<{intent: string, confidence: number, reason: string}>}
 */
async function analyzeWithGrok(text) {
  if (GROQ_API_KEYS.length === 0) {
    console.error("[GROQ] No API keys configured!");
    throw new Error(
      "GROQ_API_KEY not set. Add it to .env file."
    );
  }

  const prompt = SCAM_DETECTION_PROMPT.replace("{TEXT}", text);

  console.log(
    `[GROQ] Analyzing ${text.length} chars: "${text.substring(0, 80)}..."`
  );

  const content = await callGroqAPI([
    {
      role: "system",
      content:
        "You are a scam detection assistant. Always respond with valid JSON only.",
    },
    {
      role: "user",
      content: prompt,
    },
  ]);

  // Parse JSON response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error("[GROQ] Failed to parse JSON:", content);
    throw new Error("Invalid response format from Groq");
  }

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

  console.log(
    `[GROQ] Result: ${result.intent} (${result.confidence.toFixed(2)}) — ${result.reason}`
  );
  return result;
}

module.exports = {
  analyzeWithGrok,
};
