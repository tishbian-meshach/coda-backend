/**
 * CODA Backend - Speech-to-Text Service
 * Uses Bytez.js SDK with OpenAI Whisper Large V3 for transcription.
 * Falls back to mock transcription if Bytez is unavailable.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

const BYTEZ_API_KEY =
  process.env.BYTEZ_API_KEY || "dae6880c65e2bd73747333f4be9d5583";

/**
 * Bytez SDK singleton (lazy loaded because it uses ESM)
 */
let bytezSdk = null;
let bytezModel = null;

async function getWhisperModel() {
  if (bytezModel) return bytezModel;

  // Dynamic import for ESM module
  const { default: Bytez } = await import("bytez.js");
  bytezSdk = new Bytez(BYTEZ_API_KEY);
  bytezModel = bytezSdk.model("openai/whisper-large-v3");

  console.log("[STT] Bytez Whisper Large V3 model initialized");
  return bytezModel;
}

/**
 * Transcribe audio using Bytez Whisper Large V3.
 * Saves WAV buffer to a temp file and passes it to the model.
 *
 * @param {Buffer} wavBuffer - WAV audio data
 * @returns {Promise<string>} - Transcribed text
 */
async function whisperSTT(wavBuffer) {
  const tmpFile = path.join(os.tmpdir(), `coda_audio_${Date.now()}.wav`);
  fs.writeFileSync(tmpFile, wavBuffer);

  try {
    const model = await getWhisperModel();
    console.log(
      `[STT] Sending ${(wavBuffer.length / 1024).toFixed(1)}KB to Whisper...`
    );

    const { error, output } = await model.run(tmpFile);

    if (error) {
      console.error("[STT] Bytez error:", error);
      throw new Error(`Whisper error: ${JSON.stringify(error)}`);
    }

    // Extract transcript from Whisper output
    let transcript = "";

    if (typeof output === "string") {
      transcript = output;
    } else if (output?.text) {
      transcript = output.text;
    } else if (Array.isArray(output)) {
      // Whisper can return array of chunks
      transcript = output
        .map((chunk) => chunk.text || chunk)
        .join(" ")
        .trim();
    } else if (output) {
      transcript = JSON.stringify(output);
    }

    console.log(`[STT] Transcript: "${transcript}"`);
    return transcript;
  } finally {
    // Cleanup temp file
    try {
      fs.unlinkSync(tmpFile);
    } catch (e) {
      // ignore
    }
  }
}

/**
 * Mock STT - returns dummy transcript for testing without API.
 * Uses audio data hash to pick a deterministic mock transcript.
 */
function mockSTT(wavBuffer) {
  const audioSizeKB = wavBuffer.length / 1024;
  const estimatedSeconds = audioSizeKB / 32;

  console.log(
    `[MOCK STT] Audio: ${audioSizeKB.toFixed(1)}KB (~${estimatedSeconds.toFixed(1)}s)`
  );

  if (estimatedSeconds < 0.5) {
    return "";
  }

  const mockTranscripts = [
    "hello this is the bank calling about your account",
    "your account has been compromised please share your OTP immediately",
    "this is police department your bank account has an issue share OTP immediately",
    "hi how are you doing today I wanted to talk about the project",
    "congratulations you have won a prize please send your bank details",
    "this is customer service your card has been blocked please verify your identity",
    "hey are you coming to the meeting tomorrow morning",
    "urgent your account will be suspended unless you verify now",
    "we detected suspicious activity on your account please transfer funds to safe account",
    "hello I am calling from the tax department you owe money pay immediately or face arrest",
  ];

  // Deterministic pick based on audio data hash
  let hash = 0;
  for (let i = 0; i < Math.min(wavBuffer.length, 1000); i++) {
    hash = (hash * 31 + wavBuffer[i]) & 0x7fffffff;
  }

  return mockTranscripts[hash % mockTranscripts.length];
}

/**
 * Transcribe audio buffer to text.
 * Uses Bytez Whisper in production mode, mock in mock mode.
 *
 * @param {Buffer} wavBuffer - WAV audio data
 * @returns {Promise<string>} - Transcribed text
 */
async function transcribeAudio(wavBuffer) {
  const mode = process.env.MODE || "mock";

  if (mode === "mock") {
    console.log("[STT] Using mock transcription (MODE=mock)");
    return mockSTT(wavBuffer);
  }

  // Production mode — use Bytez Whisper
  try {
    console.log("[STT] Using Bytez Whisper Large V3");
    return await whisperSTT(wavBuffer);
  } catch (error) {
    console.error("[STT ERROR]", error.message);
    console.log("[STT FALLBACK] Using mock transcription");
    return mockSTT(wavBuffer);
  }
}

module.exports = {
  transcribeAudio,
  mockSTT,
  whisperSTT,
};
