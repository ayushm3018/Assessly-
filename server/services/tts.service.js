import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

// Microsoft Edge neural voices (free). Far more human than the browser's
// built-in speechSynthesis. Swap the voice names here to change the avatar's voice.
const VOICES = {
  female: "en-US-AriaNeural",
  male: "en-US-GuyNeural",
};

export const synthesizeSpeech = async (text, gender = "female") => {
  if (!text || !text.trim()) {
    throw new Error("No text provided for speech synthesis.");
  }

  const voice = VOICES[gender] || VOICES.female;

  const tts = new MsEdgeTTS();
  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

  const { audioStream } = tts.toStream(text);

  const chunks = [];
  await new Promise((resolve, reject) => {
    audioStream.on("data", (chunk) => chunks.push(chunk));
    audioStream.on("end", resolve);
    audioStream.on("close", resolve);
    audioStream.on("error", reject);
  });

  return Buffer.concat(chunks);
};
