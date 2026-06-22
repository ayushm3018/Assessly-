import { rateLimit, ipKeyGenerator } from "express-rate-limit";

// Rate limiting. Several API endpoints call PAID third-party services on every
// request (OpenRouter LLM, Deepgram, TTS) with no credit cost to the caller, so
// without a cap a script could loop them and run up the bill. These limiters add
// a global per-IP cap plus tighter per-user caps on the expensive endpoints.
//
// The limits are deliberately generous enough that 1–2 full interviews never trip
// them (a single interview fires tts / submit-answer / deepgram-token many times).

// Load-testing / debugging escape hatch: set RATE_LIMIT_DISABLED=true to bypass.
const disabled = () => process.env.RATE_LIMIT_DISABLED === "true";

// Shared 429 body, matching the app's { message } JSON convention.
const tooMany = (req, res) =>
  res.status(429).json({
    message: "Too many requests. Please slow down and try again in a few minutes.",
  });

// Factory: 15-minute window, standard RateLimit-* headers, the app's JSON error
// shape, and the env kill-switch. Pass a keyGenerator to key by something other
// than IP (the default key generator is already IPv6-safe).
const makeLimiter = ({ limit, windowMs = 15 * 60 * 1000, keyGenerator }) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    handler: tooMany,
    skip: disabled,
    ...(keyGenerator ? { keyGenerator } : {}),
  });

// Per-user key for the authed limiters (they run AFTER isAuth, so req.userId is
// set). Keying by user — not IP — is fairer under shared NAT and ties the cost
// cap to the account. Falls back to the IPv6-safe IP key if userId is ever absent.
const byUser = (req) => req.userId || ipKeyGenerator(req.ip);

// --- Pre-auth, IP-keyed (default generator handles IPv4/IPv6) ---
export const globalLimiter = makeLimiter({ limit: 300 }); // broad backstop on all /api
export const authLimiter = makeLimiter({ limit: 20 });    // login brute-force surface
export const paymentLimiter = makeLimiter({ limit: 20 });

// --- Authed, per-user-keyed (paid / un-credited endpoints get tighter caps) ---
export const resumeLimiter = makeLimiter({ limit: 15, keyGenerator: byUser });
export const generateLimiter = makeLimiter({ limit: 15, keyGenerator: byUser });
export const answerLimiter = makeLimiter({ limit: 80, keyGenerator: byUser });
export const ttsLimiter = makeLimiter({ limit: 150, keyGenerator: byUser });
export const deepgramLimiter = makeLimiter({ limit: 100, keyGenerator: byUser });
