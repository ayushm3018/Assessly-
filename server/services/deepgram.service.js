import { DeepgramClient } from "@deepgram/sdk";

// Real-time speech-to-text. The browser streams the candidate's mic audio straight
// to Deepgram over a WebSocket for sub-second, word-by-word transcription — but it
// must NEVER hold the long-lived API key. Instead the server mints a short-lived
// ephemeral token (JWT) with grantToken; the client connects with that and it
// expires in seconds.
//
// NOTE: the token grant requires a Deepgram key with at least the "Member" role
// (which grants "token-based authentication"). A plain "Default" key returns 403.

let client;
const getClient = () => {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPGRAM_API_KEY is not configured on the server.");
  }
  if (!client) client = new DeepgramClient({ apiKey });
  return client;
};

// Mints a short-lived access token the browser uses to open a live transcription
// socket. Default 30s TTL — long enough to establish the connection, short enough
// that a leaked token is near-worthless.
export const createDeepgramToken = async (ttlSeconds = 30) => {
  const res = await getClient().auth.v1.tokens.grant({ ttl_seconds: ttlSeconds });
  return {
    accessToken: res.access_token,
    expiresIn: res.expires_in ?? ttlSeconds,
  };
};
