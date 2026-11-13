// g711 ships CJS only — named ESM imports fail at runtime under Node ESM
import g711 from "g711";
const { ulawFromPCM, ulawToPCM } = g711;

/** Linear resample for mono 16-bit PCM (telephony-quality). */
export function resamplePcm16Mono(
  samples: Int16Array,
  fromRate: number,
  toRate: number
): Int16Array {
  if (fromRate === toRate) return samples;
  const ratio = toRate / fromRate;
  const outLen = Math.max(1, Math.floor(samples.length * ratio));
  const out = new Int16Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const srcPos = i / ratio;
    const i0 = Math.floor(srcPos);
    const i1 = Math.min(i0 + 1, samples.length - 1);
    const t = srcPos - i0;
    out[i] = Math.round(samples[i0]! * (1 - t) + samples[i1]! * t);
  }
  return out;
}

export function parsePcmSampleRateFromMime(mime: string | undefined): number {
  if (!mime) return 24000;
  const m = /rate=(\d+)/i.exec(mime);
  return m ? Number(m[1]) : 24000;
}

function int16ToPcmBase64(samples: Int16Array): string {
  const buf = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    buf.writeInt16LE(samples[i]!, i * 2);
  }
  return buf.toString("base64");
}

function pcmBase64ToInt16LE(b64: string): Int16Array {
  const buf = Buffer.from(b64, "base64");
  const n = Math.floor(buf.length / 2);
  const out = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = buf.readInt16LE(i * 2);
  }
  return out;
}

/** Twilio Media Streams: base64 μ-law @ 8 kHz → base64 little-endian PCM @ 16 kHz for Gemini Live. */
export function twilioUlawToGeminiPcm16kBase64(twilioMediaPayload: string): string {
  const ulaw = Buffer.from(twilioMediaPayload, "base64");
  // g711 typings omit the Int16Array branch used when bit === 16.
  const pcm8 = ulawToPCM(ulaw, 16) as unknown as Int16Array;
  const pcm16 = resamplePcm16Mono(pcm8, 8000, 16000);
  return int16ToPcmBase64(pcm16);
}

/** Gemini Live model audio (PCM LE) → Twilio `media.payload` (base64 μ-law @ 8 kHz). */
export function geminiPcmToTwilioUlawPayload(
  pcmBase64: string,
  mimeType: string | undefined
): string {
  const rate = parsePcmSampleRateFromMime(mimeType);
  const pcmIn = pcmBase64ToInt16LE(pcmBase64);
  const pcm8 = resamplePcm16Mono(pcmIn, rate, 8000);
  const ulaw = ulawFromPCM(pcm8);
  return Buffer.from(ulaw).toString("base64");
}
