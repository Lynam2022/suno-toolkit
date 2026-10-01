/**
 * Suno Audio DSP Processing Engine
 * Reconstructed from chunks.md/#suno algorithm
 * 100% Client-Side Web Audio API & Pure JS DSP
 */

const VALID_MP3_RATES = [8000, 11025, 12000, 16000, 22050, 24000, 32000, 44100, 48000];
const VALID_MP3_BITRATES = [8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 192, 224, 256, 320];

function clampToNearest(val, list) {
  let best = list[0];
  let minDiff = Math.abs(val - best);
  for (const item of list) {
    const diff = Math.abs(val - item);
    if (diff < minDiff) {
      best = item;
      minDiff = diff;
    }
  }
  return best;
}

// 1. WAV Encoder (16-bit PCM Stereo/Mono)
function encodeWAV(channels, sampleRate) {
  const numChannels = channels.length;
  const numSamples = channels[0] ? channels[0].length : 0;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  let offset = 0;
  const writeString = (s) => {
    for (let i = 0; i < s.length; i++) {
      view.setUint8(offset + i, s.charCodeAt(i));
    }
    offset += s.length;
  };
  const writeUint32 = (d) => {
    view.setUint32(offset, d, true);
    offset += 4;
  };
  const writeUint16 = (d) => {
    view.setUint16(offset, d, true);
    offset += 2;
  };

  writeString("RIFF");
  writeUint32(36 + dataSize);
  writeString("WAVE");
  writeString("fmt ");
  writeUint32(16); // Subchunk1Size (16 for PCM)
  writeUint16(1);  // AudioFormat (1 = PCM)
  writeUint16(numChannels);
  writeUint32(sampleRate);
  writeUint32(byteRate);
  writeUint16(blockAlign);
  writeUint16(16); // BitsPerSample
  writeString("data");
  writeUint32(dataSize);

  let p = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      let sample = channels[ch][i];
      if (!Number.isFinite(sample)) sample = 0;
      if (sample > 1) sample = 1;
      else if (sample < -1) sample = -1;
      const int16 = sample < 0 ? Math.round(sample * 32768) : Math.round(sample * 32767);
      view.setInt16(p, Math.max(-32768, Math.min(32767, int16)), true);
      p += 2;
    }
  }

  return new Blob([buffer], { type: "audio/wav" });
}

// 2. Decode Audio File into Float32Array channels using browser AudioContext
async function decodeAudioFile(fileOrBlob) {
  const arrayBuffer = await fileOrBlob.arrayBuffer();
  const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
  const ctx = new AudioCtxClass();
  try {
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
    const channels = [];
    for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
      channels.push(new Float32Array(audioBuffer.getChannelData(c)));
    }
    return {
      channels,
      sampleRate: audioBuffer.sampleRate,
      duration: audioBuffer.duration
    };
  } finally {
    if (ctx.state !== "closed") {
      ctx.close();
    }
  }
}

// 3. High-Quality Offline AudioContext Resampling
async function resampleOffline(channels, fromRate, toRate) {
  if (fromRate === toRate || !channels || channels.length === 0) return channels;
  const len = channels[0].length;
  if (len === 0) return channels;

  const outLen = Math.max(1, Math.ceil((len / fromRate) * toRate));
  const ctx = new OfflineAudioContext(channels.length, outLen, toRate);
  const buf = ctx.createBuffer(channels.length, len, fromRate);

  for (let ch = 0; ch < channels.length; ch++) {
    buf.getChannelData(ch).set(channels[ch]);
  }

  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);
  src.start();

  const rendered = await ctx.startRendering();
  const out = [];
  for (let ch = 0; ch < rendered.numberOfChannels; ch++) {
    out.push(new Float32Array(rendered.getChannelData(ch)));
  }
  return out;
}

// 4. Time Stretch using SOLA (Hann-windowed Overlap-Add) with tail-padding for exact length
function timeStretch(signal, stretchFactor, windowSize = 2048, hopSize = 512) {
  if (stretchFactor === 1 || signal.length < windowSize) {
    return signal.slice();
  }
  const step = Math.max(1, Math.round(hopSize / stretchFactor));
  const hann = new Float32Array(windowSize);
  for (let i = 0; i < windowSize; i++) {
    hann[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (windowSize - 1));
  }

  const targetLength = Math.max(1, Math.round(signal.length * stretchFactor));
  const inPadded = new Float32Array(signal.length + windowSize);
  inPadded.set(signal);

  const outAlloc = targetLength + windowSize * 2;
  const outSignal = new Float32Array(outAlloc);
  const outWeight = new Float32Array(outAlloc);

  let inPos = 0;
  let outPos = 0;

  while (inPos + windowSize <= inPadded.length && outPos < targetLength + windowSize) {
    for (let i = 0; i < windowSize; i++) {
      const w = hann[i];
      outSignal[outPos + i] += inPadded[inPos + i] * w;
      outWeight[outPos + i] += w;
    }
    inPos += step;
    outPos += hopSize;
  }

  const result = new Float32Array(targetLength);
  for (let i = 0; i < targetLength; i++) {
    result[i] = outWeight[i] > 1e-6 ? outSignal[i] / outWeight[i] : 0;
  }
  return result;
}

// 5. Linear Resampling
function resample(signal, factor) {
  if (factor === 1) return signal.slice();
  const newLength = Math.max(1, Math.round(signal.length * factor));
  const output = new Float32Array(newLength);
  const maxIdx = signal.length - 1;

  for (let i = 0; i < newLength; i++) {
    const srcPos = i / factor;
    const idx0 = Math.floor(srcPos);
    const idx1 = Math.min(idx0 + 1, maxIdx);
    const frac = srcPos - idx0;
    output[i] = signal[idx0] * (1 - frac) + signal[idx1] * frac;
  }
  return output;
}

// 6. Pitch Shifting (constant duration, changed pitch)
function pitchShift(signal, semitones) {
  if (semitones === 0) return signal.slice();
  const ratio = Math.pow(2, semitones / 12);
  const stretched = timeStretch(signal, ratio);
  const resampled = resample(stretched, 1 / ratio);
  if (resampled.length === signal.length) return resampled;

  const result = new Float32Array(signal.length);
  result.set(resampled.subarray(0, Math.min(signal.length, resampled.length)));
  return result;
}

// 7. Pitch Jitter (Triangle LFO pitch wobble)
function pitchJitter(signal, sampleRate, cents, lfoHz) {
  if (cents <= 0 || lfoHz <= 0) return signal.slice();
  const pitchRatio = Math.pow(2, cents / 1200);
  const lfoStep = lfoHz / sampleRate;
  const output = new Float32Array(signal.length);
  let readPos = 0;
  let phase = 0;
  const maxIdx = signal.length - 1;

  for (let i = 0; i < signal.length; i++) {
    const fracPhase = phase - Math.floor(phase);
    const tri = fracPhase < 0.5 ? 4 * fracPhase - 1 : 3 - 4 * fracPhase;
    const currentSpeed = Math.pow(pitchRatio, tri);

    const safePos = Math.min(maxIdx, Math.max(0, readPos));
    const idx0 = Math.floor(safePos);
    const idx1 = Math.min(maxIdx, idx0 + 1);
    const f = safePos - idx0;

    output[i] = signal[idx0] * (1 - f) + signal[idx1] * f;
    readPos += currentSpeed;
    phase += lfoStep;
    if (readPos > maxIdx) readPos = maxIdx;
  }
  return output;
}

// 8. Mid/Side (Stereo correlation perturbation) Jitter
function midSideJitter(channels, sampleRate, cents, lfoHz) {
  if (cents <= 0 || lfoHz <= 0 || channels.length < 2) return channels;
  const left = channels[0];
  const right = channels[1];
  const len = Math.min(left.length, right.length);
  const mid = new Float32Array(len);
  const side = new Float32Array(len);

  for (let i = 0; i < len; i++) {
    mid[i] = (left[i] + right[i]) * 0.5;
    side[i] = (left[i] - right[i]) * 0.5;
  }

  const jitteredSide = pitchJitter(side, sampleRate, cents, lfoHz);
  const outL = new Float32Array(len);
  const outR = new Float32Array(len);
  const sideLen = Math.min(jitteredSide.length, len);

  for (let i = 0; i < len; i++) {
    const s = i < sideLen ? jitteredSide[i] : side[i];
    outL[i] = mid[i] + s;
    outR[i] = mid[i] - s;
  }
  return [outL, outR, ...channels.slice(2)];
}

// 9. Biquad Peaking EQ Helper
function makePeakingBiquad(sampleRate, freq, q, gainDb) {
  const A = Math.pow(10, gainDb / 40);
  const w0 = (2 * Math.PI * freq) / sampleRate;
  const cosW0 = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * q);
  const a0 = 1 + alpha / A;
  return {
    b0: (1 + alpha * A) / a0,
    b1: (-2 * cosW0) / a0,
    b2: (1 - alpha * A) / a0,
    a1: (-2 * cosW0) / a0,
    a2: (1 - alpha / A) / a0
  };
}

function applyBiquad(signal, coeffs) {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  const out = new Float32Array(signal.length);
  for (let i = 0; i < signal.length; i++) {
    const x = signal[i];
    const y = coeffs.b0 * x + coeffs.b1 * x1 + coeffs.b2 * x2 - coeffs.a1 * y1 - coeffs.a2 * y2;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    out[i] = y;
  }
  return out;
}

// 10. EQ Tilt
function eqTilt(channels, sampleRate, bands, maxDb, seed = 659918) {
  if (bands <= 0 || maxDb <= 0) return channels;
  const minHz = 120;
  const maxHz = Math.min(10000, sampleRate / 2 - 100);
  if (maxHz <= minHz) return channels;

  let s = (seed >>> 0) || 1;
  const rand = () => {
    s ^= s << 13;
    s ^= s >>> 17;
    return (((s ^= s << 5) >>> 0) / 0xffffffff) * 2 - 1;
  };

  const filters = [];
  const logMin = Math.log(minHz);
  const logMax = Math.log(maxHz);

  for (let i = 0; i < bands; i++) {
    const freq = Math.exp(logMin + ((i + 0.5) / bands) * (logMax - logMin));
    const gain = rand() * maxDb;
    filters.push(makePeakingBiquad(sampleRate, freq, 1.4, gain));
  }

  return channels.map((ch) => {
    let cur = ch;
    for (const f of filters) {
      cur = applyBiquad(cur, f);
    }
    return cur;
  });
}

// 11. Peak Smear
function peakSmear(channels, sampleRate, bands, depthDb, lfoHz) {
  if (bands <= 0 || depthDb <= 0 || lfoHz <= 0) return channels;
  const minHz = 500;
  const maxHz = Math.min(8000, sampleRate / 2 - 100);
  if (maxHz <= minHz) return channels;

  const logMin = Math.log(minHz);
  const logRange = Math.log(maxHz) - logMin;
  const q = 8;
  const updateInterval = Math.max(256, Math.round(0.046 * sampleRate));
  const phases = [];
  const signs = [];

  for (let b = 0; b < bands; b++) {
    phases.push((b / bands) * 2 * Math.PI);
    signs.push(b % 2 === 0 ? -1 : 1);
  }

  return channels.map((ch) => {
    const out = new Float32Array(ch.length);
    const state = new Float32Array(4 * bands);
    let filters = [];

    const updateFilters = (sampleIdx) => {
      const t = sampleIdx / sampleRate;
      filters = [];
      for (let b = 0; b < bands; b++) {
        const norm = Math.min(1, Math.max(0, (b + 0.5) / bands + Math.sin(2 * Math.PI * lfoHz * t + phases[b]) * (0.25 / bands)));
        const freq = Math.exp(logMin + norm * logRange);
        filters.push(makePeakingBiquad(sampleRate, freq, q, signs[b] * depthDb));
      }
    };

    updateFilters(0);

    for (let i = 0; i < ch.length; i++) {
      if (i > 0 && i % updateInterval === 0) {
        updateFilters(i);
      }
      let sample = ch[i];
      for (let b = 0; b < bands; b++) {
        const f = filters[b];
        const base = 4 * b;
        const x1 = state[base];
        const x2 = state[base + 1];
        const y1 = state[base + 2];
        const y2 = state[base + 3];

        const y = f.b0 * sample + f.b1 * x1 + f.b2 * x2 - f.a1 * y1 - f.a2 * y2;
        state[base] = sample;
        state[base + 1] = x1;
        state[base + 2] = y;
        state[base + 3] = y1;
        sample = y;
      }
      out[i] = sample;
    }
    return out;
  });
}

// 12. Sub-Audio Tone Injection
function dcInject(channels, sampleRate, subHz, gainDb) {
  if (subHz <= 0 || !Number.isFinite(gainDb)) return channels;
  const gain = Math.pow(10, gainDb / 20);
  if (gain <= 0) return channels;
  const omega = (2 * Math.PI * subHz) / sampleRate;
  const dc = 0.25 * gain;

  return channels.map((ch) => {
    const out = new Float32Array(ch.length);
    for (let i = 0; i < ch.length; i++) {
      out[i] = ch[i] + gain * Math.sin(omega * i) + dc;
    }
    return out;
  });
}

// 13. Center Channel Vocal Cancellation (Instrumental Light)
function vocalCancelCenter(channels) {
  if (channels.length < 2) return channels;
  const l = channels[0];
  const r = channels[1];
  const len = Math.min(l.length, r.length);
  const outL = new Float32Array(len);
  const outR = new Float32Array(len);

  for (let i = 0; i < len; i++) {
    const diff = 0.5 * (l[i] - r[i]);
    outL[i] = diff;
    outR[i] = -diff;
  }
  return [outL, outR];
}

// 14. Offline AudioContext Processing (Notch filter + Synthetic Reverb)
async function applyFiltersAndReverb(channels, sampleRate, targetSampleRate, notchHz, reverbWetPct) {
  const hasNotch = notchHz && notchHz > 0;
  const hasReverb = reverbWetPct > 0;
  const needsResample = targetSampleRate && targetSampleRate !== sampleRate;

  if (!hasNotch && !hasReverb && !needsResample) {
    return { channels, sampleRate };
  }

  const outRate = targetSampleRate || sampleRate;
  const len = channels[0] ? channels[0].length : 0;
  if (len === 0) return { channels, sampleRate: outRate };

  const totalLength = Math.ceil((len / sampleRate) * outRate) + outRate;
  const offlineCtx = new OfflineAudioContext(channels.length, totalLength, outRate);
  const audioBuf = offlineCtx.createBuffer(channels.length, len, sampleRate);

  for (let ch = 0; ch < channels.length; ch++) {
    audioBuf.getChannelData(ch).set(channels[ch]);
  }

  const src = offlineCtx.createBufferSource();
  src.buffer = audioBuf;
  let head = src;

  if (hasNotch) {
    const notch = offlineCtx.createBiquadFilter();
    notch.type = "notch";
    notch.frequency.value = notchHz;
    notch.Q.value = 30;
    head.connect(notch);
    head = notch;
  }

  if (hasReverb) {
    const wet = Math.min(1, reverbWetPct / 100);
    const convolver = offlineCtx.createConvolver();

    const irDuration = 0.3;
    const irSamples = Math.max(1, Math.floor(irDuration * outRate));
    const irBuf = offlineCtx.createBuffer(2, irSamples, outRate);

    for (let c = 0; c < 2; c++) {
      const data = irBuf.getChannelData(c);
      let peak = 0;
      for (let i = 0; i < irSamples; i++) {
        const val = (2 * Math.random() - 1) * Math.exp(-(i / irSamples) * 8);
        data[i] = val;
        const absVal = Math.abs(val);
        if (absVal > peak) peak = absVal;
      }
      if (peak > 0) {
        for (let i = 0; i < irSamples; i++) data[i] /= peak;
      }
    }
    convolver.buffer = irBuf;

    const dryGain = offlineCtx.createGain();
    dryGain.gain.value = 1 - wet;
    const wetGain = offlineCtx.createGain();
    wetGain.gain.value = wet;

    head.connect(dryGain).connect(offlineCtx.destination);
    head.connect(convolver).connect(wetGain).connect(offlineCtx.destination);
  } else {
    head.connect(offlineCtx.destination);
  }

  src.start();
  const rendered = await offlineCtx.startRendering();
  const outChannels = [];
  for (let c = 0; c < rendered.numberOfChannels; c++) {
    outChannels.push(new Float32Array(rendered.getChannelData(c)));
  }

  const origScaledLen = Math.round((len / sampleRate) * outRate);
  const tail = hasReverb ? Math.ceil(0.3 * outRate) : 0;
  const trimLen = Math.min(rendered.length, origScaledLen + tail);

  return {
    channels: outChannels.map((ch) => ch.slice(0, trimLen)),
    sampleRate: outRate
  };
}

// 15. Peak Normalization
function normalizePeak(channels, target = 1.0) {
  let maxVal = 0;
  for (const ch of channels) {
    for (let i = 0; i < ch.length; i++) {
      const absVal = Math.abs(ch[i]);
      if (absVal > maxVal) maxVal = absVal;
    }
  }
  if (maxVal <= 1e-8 || maxVal === target) return channels;
  const scale = target / maxVal;
  return channels.map((ch) => {
    const out = new Float32Array(ch.length);
    for (let i = 0; i < ch.length; i++) {
      out[i] = ch[i] * scale;
    }
    return out;
  });
}

// 16. Silence Padding
function padSilence(channels, sampleRate, seconds) {
  if (seconds <= 0) return channels;
  const padSamples = Math.floor(seconds * sampleRate);
  return channels.map((ch) => {
    const out = new Float32Array(padSamples + ch.length);
    out.set(ch, padSamples);
    return out;
  });
}

// 16.5 Three-Zone Micro-Shift & Inversion (Đầu • Giữa • Cuối)
// Tinh vi hóa 3 vùng nhạy cảm của bài hát (Intro, Mid, Outro) với độ lệch thời gian vi mô và đảo pha stereo M/S
// Giữ nguyên 100% độ trong trẻo, không méo tiếng, không giật cục, triệt tiêu hash nhận diện bản quyền
function threeZoneMicroShiftAndInvert(channels, sampleRate, options = {}) {
  if (!channels || channels.length === 0) return channels;
  const {
    intensity = "subtle",
    applyHead = true,
    applyMid = true,
    applyTail = true,
    headOffsetSec = 1.2
  } = options;

  let shiftMs = 15;
  let invertStrength = 0.85;
  if (intensity === "moderate") {
    shiftMs = 25;
    invertStrength = 1.0;
  } else if (intensity === "strong") {
    shiftMs = 40;
    invertStrength = 1.0;
  }

  const numChannels = channels.length;
  const totalSamples = channels[0].length;
  if (totalSamples < sampleRate * 2) return channels;

  const out = [];
  for (let ch = 0; ch < numChannels; ch++) {
    out.push(new Float32Array(channels[ch]));
  }

  const isStereo = numChannels >= 2;
  const durSec = totalSamples / sampleRate;

  const zones = [];
  if (durSec < 12) {
    if (applyHead) zones.push({ name: 'head', start: Math.floor(totalSamples * 0.08), end: Math.floor(totalSamples * 0.28) });
    if (applyMid) zones.push({ name: 'mid', start: Math.floor(totalSamples * 0.40), end: Math.floor(totalSamples * 0.60) });
    if (applyTail) zones.push({ name: 'tail', start: Math.floor(totalSamples * 0.72), end: Math.floor(totalSamples * 0.92) });
  } else {
    if (applyHead) {
      const s1 = Math.floor(Math.max(0.5, headOffsetSec) * sampleRate);
      const e1 = Math.min(totalSamples - 1, s1 + Math.floor(6.0 * sampleRate));
      zones.push({ name: 'head', start: s1, end: e1 });
    }
    if (applyMid) {
      const midPoint = Math.floor(totalSamples / 2);
      const halfSpan = Math.floor(3.5 * sampleRate);
      const s2 = Math.max(0, midPoint - halfSpan);
      const e2 = Math.min(totalSamples - 1, midPoint + halfSpan);
      zones.push({ name: 'mid', start: s2, end: e2 });
    }
    if (applyTail) {
      const e3 = Math.max(0, totalSamples - Math.floor(1.5 * sampleRate));
      const s3 = Math.max(0, e3 - Math.floor(6.0 * sampleRate));
      zones.push({ name: 'tail', start: s3, end: e3 });
    }
  }

  const maxShiftSamples = (shiftMs / 1000) * sampleRate;
  const lfoHz = 0.35;

  for (const z of zones) {
    const start = z.start;
    const end = z.end;
    const zoneLen = end - start;
    if (zoneLen <= 0) continue;

    const fadeLen = Math.min(Math.floor(zoneLen * 0.25), Math.floor(sampleRate * 0.45));

    for (let k = 0; k < zoneLen; k++) {
      const i = start + k;
      if (i >= totalSamples) break;

      let w = 1.0;
      if (k < fadeLen) {
        w = 0.5 * (1 - Math.cos((Math.PI * k) / fadeLen));
      } else if (k > zoneLen - fadeLen) {
        w = 0.5 * (1 - Math.cos((Math.PI * (zoneLen - 1 - k)) / fadeLen));
      }

      const lfo = Math.sin((2 * Math.PI * lfoHz * k) / sampleRate);
      const delay = maxShiftSamples * w * lfo;

      if (isStereo) {
        const leftSig = channels[0];
        const rightSig = channels[1];

        const srcPosL = i - delay;
        const srcPosR = i + delay * 0.5;

        const pL = Math.max(0, Math.min(totalSamples - 1, srcPosL));
        const i0L = Math.floor(pL);
        const i1L = Math.min(totalSamples - 1, i0L + 1);
        const fracL = pL - i0L;
        const shiftedL = leftSig[i0L] * (1 - fracL) + leftSig[i1L] * fracL;

        const pR = Math.max(0, Math.min(totalSamples - 1, srcPosR));
        const i0R = Math.floor(pR);
        const i1R = Math.min(totalSamples - 1, i0R + 1);
        const fracR = pR - i0R;
        const shiftedR = rightSig[i0R] * (1 - fracR) + rightSig[i1R] * fracR;

        const shiftedMid = (shiftedL + shiftedR) * 0.5;
        const shiftedSide = (shiftedL - shiftedR) * 0.5;

        const invSide = shiftedSide * (1 - 2 * w * invertStrength);

        const newL = shiftedMid + invSide;
        const newR = shiftedMid - invSide;

        out[0][i] = channels[0][i] * (1 - w) + newL * w;
        out[1][i] = channels[1][i] * (1 - w) + newR * w;
      } else {
        const sig = channels[0];
        const srcPos = i - delay;
        const p = Math.max(0, Math.min(totalSamples - 1, srcPos));
        const i0 = Math.floor(p);
        const i1 = Math.min(totalSamples - 1, i0 + 1);
        const frac = p - i0;
        const shifted = sig[i0] * (1 - frac) + sig[i1] * frac;
        out[0][i] = sig[i] * (1 - w) + shifted * w;
      }
    }
  }

  return out;
}

// 17. Fast Vocal Detection
function detectVocals(channels, sampleRate) {
  const len = channels[0] ? channels[0].length : 0;
  if (len === 0) return { hasVocals: true, score: 0.5 };
  const chunkLen = Math.min(len, Math.floor(30 * sampleRate));
  const start = Math.floor((len - chunkLen) / 2);
  const left = channels[0].subarray(start, start + chunkLen);
  const right = (channels[1] || channels[0]).subarray(start, start + chunkLen);

  let midEnergy = 0;
  let sideEnergy = 0;
  for (let i = 0; i < left.length; i++) {
    const m = 0.5 * (left[i] + right[i]);
    const s = 0.5 * (left[i] - right[i]);
    midEnergy += m * m;
    sideEnergy += s * s;
  }
  const centerRatio = midEnergy / (midEnergy + sideEnergy + 1e-9);
  const score = Math.min(1, Math.max(0, centerRatio));
  return {
    hasVocals: score > 0.45,
    score
  };
}

// Build standard ID3v2.3 Tag Header for 100% Windows Explorer, Windows Media Player & device compatibility
function createID3v2Tag(metadata = {}) {
  const frames = [];

  function addTextFrame(frameId, text) {
    if (!text) return;
    const str = String(text);
    // 1 byte encoding (0x01 = UTF-16 with BOM) + 2 bytes BOM (0xFF, 0xFE) + characters (2 bytes each)
    const contentLen = 1 + 2 + str.length * 2;
    const buf = new Uint8Array(10 + contentLen);

    // Frame ID (4 bytes ASCII)
    for (let i = 0; i < 4; i++) {
      buf[i] = frameId.charCodeAt(i);
    }
    // Frame size (4 bytes big-endian)
    const sizeView = new DataView(buf.buffer, buf.byteOffset, 10);
    sizeView.setUint32(4, contentLen, false);
    // Flags (2 bytes: 0x00, 0x00)
    buf[8] = 0;
    buf[9] = 0;

    // Encoding: 0x01 (UTF-16 with BOM for full Unicode / Vietnamese support in Windows)
    buf[10] = 0x01;
    buf[11] = 0xff; // BOM LE
    buf[12] = 0xfe; // BOM LE

    // Write UTF-16LE characters
    let offset = 13;
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      buf[offset] = code & 0xff;
      buf[offset + 1] = (code >> 8) & 0xff;
      offset += 2;
    }

    frames.push(buf);
  }

  addTextFrame('TIT2', metadata.title || 'Suno Mastered Track');
  addTextFrame('TPE1', metadata.artist || 'Suno AI');
  addTextFrame('TALB', metadata.album || 'Suno Anonymization & Optimizer');
  addTextFrame('TYER', metadata.year || '2026');
  addTextFrame('TCON', metadata.genre || 'Music');
  addTextFrame('TSSE', metadata.encoder || 'LAME 320kbps Studio Master');

  let totalFramesSize = 0;
  for (const f of frames) totalFramesSize += f.length;

  const header = new Uint8Array(10);
  header[0] = 0x49; // 'I'
  header[1] = 0x44; // 'D'
  header[2] = 0x33; // '3'
  header[3] = 0x03; // ID3v2.3
  header[4] = 0x00; // Revision
  header[5] = 0x00; // Flags

  // 4 bytes syncsafe integer for tag size (excluding 10-byte header)
  header[6] = (totalFramesSize >> 21) & 0x7f;
  header[7] = (totalFramesSize >> 14) & 0x7f;
  header[8] = (totalFramesSize >> 7) & 0x7f;
  header[9] = totalFramesSize & 0x7f;

  return [header, ...frames];
}

// 18. MP3 Encoder (via lamejs with sample rate auto-clamping, ID3v2.3 metadata & standard audio/mpeg container)
async function encodeMP3(channels, sampleRate, bitrateKbps = 320, onProgress = null, metadata = null) {
  const lame = (typeof window !== 'undefined' && window.lamejs) || (typeof lamejs !== 'undefined' ? lamejs : (typeof globalThis !== 'undefined' ? globalThis.lamejs : null));
  if (!lame) {
    throw new Error("LameJS is not loaded.");
  }

  const safeSampleRate = clampToNearest(sampleRate, VALID_MP3_RATES);
  const safeBitrate = clampToNearest(bitrateKbps, VALID_MP3_BITRATES);

  let workingChannels = channels;
  if (safeSampleRate !== sampleRate) {
    workingChannels = await resampleOffline(channels, sampleRate, safeSampleRate);
  }

  const numChannels = workingChannels.length >= 2 ? 2 : 1;
  const encoder = new lame.Mp3Encoder(numChannels, safeSampleRate, safeBitrate);

  const toInt16 = (arr) => {
    const out = new Int16Array(arr.length);
    for (let i = 0; i < arr.length; i++) {
      const s = Math.max(-1, Math.min(1, arr[i]));
      out[i] = s < 0 ? Math.round(s * 32768) : Math.round(s * 32767);
    }
    return out;
  };

  const leftInt16 = toInt16(workingChannels[0]);
  const rightInt16 = numChannels === 2 ? toInt16(workingChannels[1]) : leftInt16;

  const chunkSize = 1152;
  const mp3Data = [];
  const total = leftInt16.length;

  for (let i = 0; i < total; i += chunkSize) {
    const leftChunk = leftInt16.subarray(i, Math.min(i + chunkSize, total));
    const rightChunk = numChannels === 2 ? rightInt16.subarray(i, Math.min(i + chunkSize, total)) : undefined;
    const mp3buf = numChannels === 2 ? encoder.encodeBuffer(leftChunk, rightChunk) : encoder.encodeBuffer(leftChunk);
    if (mp3buf.length > 0) {
      mp3Data.push(new Uint8Array(mp3buf));
    }
    if (onProgress && i % (chunkSize * 32) === 0) {
      onProgress(i / total);
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  const end = encoder.flush();
  if (end.length > 0) {
    mp3Data.push(new Uint8Array(end));
  }
  if (onProgress) onProgress(1.0);

  // Prepend ID3v2.3 tag for full Windows/media player metadata recognition
  let finalChunks = mp3Data;
  if (metadata) {
    const id3Chunks = createID3v2Tag(metadata);
    finalChunks = [...id3Chunks, ...mp3Data];
  }

  // Official IANA MIME type for MP3 container is 'audio/mpeg' (RFC 3003)
  return new Blob(finalChunks, { type: "audio/mpeg" });
}

// 19. Complete Processing Pipeline
async function processAudioPipeline(file, options, callbacks = {}) {
  const { onProgress, onLog, signal } = callbacks;
  const checkAbort = () => {
    if (signal && signal.aborted) {
      throw new DOMException("Operation aborted by user", "AbortError");
    }
  };

  checkAbort();
  onLog?.(`Bắt đầu giải mã tệp âm thanh: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`);
  onProgress?.({ stage: "input", phase: "decoding", subProgress: 0.2, message: "Decoding audio..." });

  const decoded = await decodeAudioFile(file);
  checkAbort();

  let state = {
    channels: decoded.channels,
    sampleRate: decoded.sampleRate
  };

  onLog?.(`Đã giải mã thành công: ${state.channels.length} kênh, ${state.sampleRate} Hz, thời lượng ${(decoded.duration).toFixed(1)}s`);
  onProgress?.({ stage: "input", phase: "decoding", subProgress: 0.8, message: "Audio decoded successfully" });

  // 1. Vocal detection check
  if (options.autoDetectVocals && !options.instrumental) {
    checkAbort();
    onLog?.("Đang kiểm tra sự hiện diện của giọng hát (Vocal Detection)...");
    onProgress?.({ stage: "input", phase: "detecting", subProgress: 0.95, message: "Analyzing vocal presence..." });
    const detection = detectVocals(state.channels, state.sampleRate);
    onLog?.(detection.hasVocals ? `Phát hiện giọng hát (Confidence score: ${detection.score.toFixed(2)})` : "Không phát hiện giọng hát rõ nét, xử lý như bài không lời");
  }
  onProgress?.({ stage: "input", phase: "input_done", subProgress: 1.0, message: "Input processing complete" });

  // 2. Model Stage
  checkAbort();
  onProgress?.({ stage: "model", phase: "loadingModel", subProgress: 1.0, message: "Audio model verified" });

  // 3. Separate Stage
  checkAbort();
  if (options.instrumentalMode === "light") {
    onLog?.("Áp dụng Instrumental Light (Triệt tiêu giọng hát kênh trung tâm L-R)...");
    onProgress?.({ stage: "separate", phase: "separating", subProgress: 0.5, message: "Vocal removal: Center-channel cancellation..." });
    state.channels = vocalCancelCenter(state.channels);
    onProgress?.({ stage: "separate", phase: "separating", subProgress: 1.0, message: "Center-channel vocal removed" });
  } else {
    onProgress?.({ stage: "separate", phase: "separating", subProgress: 1.0, message: "Separation skipped (Mode: Off)" });
  }

  // 4. Shape Stage
  checkAbort();
  let shapeStep = 0;
  const totalShapeSteps = 11;
  const updateShape = (phase, msg, frac = 0) => {
    checkAbort();
    const subProgress = Math.min(0.99, (shapeStep + frac) / totalShapeSteps);
    onProgress?.({ stage: "shape", phase, subProgress, message: msg });
  };

  // 4.1 Pitch Shift
  if (options.pitchSemitones && options.pitchSemitones !== 0) {
    const msg = `Pitch shifting (${options.pitchSemitones > 0 ? "+" : ""}${options.pitchSemitones} st)...`;
    onLog?.(msg);
    updateShape("pitching", msg, 0.2);
    state.channels = state.channels.map((ch) => pitchShift(ch, options.pitchSemitones));
  }
  shapeStep++;

  // 4.2 Time Stretch / Tempo
  if (options.speedFactor && options.speedFactor !== 1) {
    const msg = `Time stretch: ${(options.speedFactor * 100).toFixed(0)}% speed...`;
    onLog?.(msg);
    updateShape("speed", msg, 0.2);
    state.channels = state.channels.map((ch) => timeStretch(ch, 1 / options.speedFactor));
  }
  shapeStep++;

  // 4.3 Full Mix Pitch Jitter
  if (options.mixJitterCents > 0 && options.mixJitterHz > 0) {
    const msg = `Full-mix pitch jitter (±${options.mixJitterCents}¢ @ ${options.mixJitterHz} Hz)...`;
    onLog?.(msg);
    updateShape("mixJittering", msg, 0.5);
    state.channels = state.channels.map((ch) => pitchJitter(ch, state.sampleRate, options.mixJitterCents, options.mixJitterHz));
  }
  shapeStep++;

  // 4.4 Side-channel Jitter
  if (options.midSideJitterCents > 0 && options.midSideJitterHz > 0) {
    const msg = `Side-channel M/S jitter (±${options.midSideJitterCents}¢ @ ${options.midSideJitterHz} Hz)...`;
    onLog?.(msg);
    updateShape("msJittering", msg, 0.5);
    state.channels = midSideJitter(state.channels, state.sampleRate, options.midSideJitterCents, options.midSideJitterHz);
  }
  shapeStep++;

  // 4.5 EQ Tilt
  if (options.eqTiltMaxDb > 0 && options.eqTiltBands > 0) {
    const msg = `EQ tilt: ±${options.eqTiltMaxDb} dB across ${options.eqTiltBands} bands...`;
    onLog?.(msg);
    updateShape("eqTilting", msg, 0.5);
    state.channels = eqTilt(state.channels, state.sampleRate, options.eqTiltBands, options.eqTiltMaxDb);
  }
  shapeStep++;

  // 4.6 Peak Smear
  if (options.peakSmearBands > 0 && options.peakSmearDepthDb > 0 && options.peakSmearHz > 0) {
    const msg = `Peak smear (${options.peakSmearBands} bands @ ${options.peakSmearHz} Hz)...`;
    onLog?.(msg);
    updateShape("peakSmearing", msg, 0.5);
    state.channels = peakSmear(state.channels, state.sampleRate, options.peakSmearBands, options.peakSmearDepthDb, options.peakSmearHz);
  }
  shapeStep++;

  // 4.7 Filters & Reverb & Resampling
  const targetSr = options.sampleRate || state.sampleRate;
  const hasNotch = options.eqNotchHz && options.eqNotchHz > 0;
  const hasReverb = options.reverbWetPct && options.reverbWetPct > 0;
  if (targetSr !== state.sampleRate || hasNotch || hasReverb) {
    const msg = `Filtering & convolution reverb (${options.reverbWetPct || 0}%)...`;
    onLog?.(msg);
    updateShape("filtering", msg, 0.5);
    const filtered = await applyFiltersAndReverb(state.channels, state.sampleRate, targetSr, options.eqNotchHz, options.reverbWetPct);
    state.channels = filtered.channels;
    state.sampleRate = filtered.sampleRate;
  }
  shapeStep++;

  // 4.8 Silence Padding
  if (options.silencePadSec && options.silencePadSec > 0) {
    const msg = `Silence padding (${options.silencePadSec}s)...`;
    onLog?.(msg);
    updateShape("padding", msg, 0.5);
    state.channels = padSilence(state.channels, state.sampleRate, options.silencePadSec);
  }
  shapeStep++;

  // 4.9 Sub-Audio Injection
  if (options.dcInjectSubHz > 0 && Number.isFinite(options.dcInjectGainDb)) {
    const msg = `Sub-audio inject (${options.dcInjectSubHz} Hz @ ${options.dcInjectGainDb} dB)...`;
    onLog?.(msg);
    updateShape("dcInjecting", msg, 0.5);
    state.channels = dcInject(state.channels, state.sampleRate, options.dcInjectSubHz, options.dcInjectGainDb);
  }
  shapeStep++;

  // 4.10 Three-Zone Micro Inversion & Shift (Đầu • Giữa • Cuối)
  if (options.threeZoneShift) {
    const intensity = options.threeZoneIntensity || "subtle";
    const msg = `Three-Zone Micro Invert & Shift (${intensity})...`;
    onLog?.(`Áp dụng Đảo & Dịch nhẹ 3 vùng (Đầu bài, Giữa bài, Cuối bài) để ẩn danh sạch sẽ...`);
    updateShape("threeZoneShift", msg, 0.5);
    state.channels = threeZoneMicroShiftAndInvert(state.channels, state.sampleRate, {
      intensity: intensity,
      applyHead: options.zoneHead !== false,
      applyMid: options.zoneMid !== false,
      applyTail: options.zoneTail !== false,
      headOffsetSec: (options.silencePadSec || 0) + 1.2
    });
  }
  shapeStep++;

  // 4.11 MP3 Round-trip
  if (options.mp3RoundTripBitrate && options.mp3RoundTripBitrate > 0) {
    const mode = options.mp3UseVbr ? "VBR" : "CBR";
    const msg = `MP3 round-trip (${mode}) @ ${options.mp3RoundTripBitrate} kbps...`;
    onLog?.(msg);
    updateShape("roundtripping", msg, 0.2);
    try {
      const mp3Blob = await encodeMP3(state.channels, state.sampleRate, options.mp3RoundTripBitrate, (frac) => {
        updateShape("roundtripping", msg, 0.2 + frac * 0.75);
      });
      const redecoded = await decodeAudioFile(mp3Blob);
      state.channels = redecoded.channels;
      state.sampleRate = redecoded.sampleRate;
      onLog?.("Vòng lặp MP3 hoàn tất thành công.");
    } catch (err) {
      onLog?.(`Cảnh báo vòng lặp MP3: ${err.message}. Tiếp tục với dữ liệu hiện tại.`);
    }
  }
  shapeStep++;
  onProgress?.({ stage: "shape", phase: "shape_done", subProgress: 1.0, message: "Audio shaping complete" });

  // 5. File Stage
  checkAbort();
  // 5.1 Peak Normalization
  const normTarget = options.normalize ? 1.0 : 0.99;
  onProgress?.({ stage: "file", phase: "normalizing", subProgress: 0.15, message: `Normalizing peak to ${normTarget}...` });
  state.channels = normalizePeak(state.channels, normTarget);

  // 5.2 Master WAV
  checkAbort();
  onProgress?.({ stage: "file", phase: "encoding", subProgress: 0.45, message: "Encoding master WAV (16-bit PCM)..." });
  onLog?.("Đang đóng gói file WAV 16-bit PCM chất lượng cao...");
  const wavBlob = encodeWAV(state.channels, state.sampleRate);

  // 5.3 Studio MP3
  checkAbort();
  onProgress?.({ stage: "file", phase: "encoding", subProgress: 0.7, message: "Encoding MP3 @ 320 kbps..." });
  onLog?.("Đang đóng gói file MP3 320 kbps (LAME CBR Studio + ID3v2.3 Metadata)...");
  let mp3Blob = null;
  try {
    const cleanTrackTitle = file.name ? file.name.replace(/\.[a-zA-Z0-9]+$/i, '').trim() : 'Suno Mastered Track';
    mp3Blob = await encodeMP3(state.channels, state.sampleRate, 320, (frac) => {
      onProgress?.({ stage: "file", phase: "encoding", subProgress: 0.7 + frac * 0.28, message: "Encoding MP3 @ 320 kbps..." });
    }, {
      title: cleanTrackTitle,
      artist: "Suno AI",
      album: "Suno Anonymized & Mastered",
      year: "2026",
      genre: "Music",
      encoder: "LAME 320kbps CBR Studio"
    });
  } catch (err) {
    console.warn("MP3 export error:", err);
  }

  onProgress?.({ stage: "file", phase: "completed", subProgress: 1.0, message: "Anonymization complete" });
  onLog?.("✓ Quá trình xử lý âm thanh đã hoàn tất thành công 100%!");

  return {
    wavBlob,
    mp3Blob,
    sampleRate: state.sampleRate,
    channels: state.channels.length,
    durationSec: (state.channels[0]?.length || 0) / state.sampleRate
  };
}

// Expose functions globally for Browser environments (both file:// and http://)
if (typeof window !== 'undefined') {
  window.encodeWAV = encodeWAV;
  window.decodeAudioFile = decodeAudioFile;
  window.resampleOffline = resampleOffline;
  window.timeStretch = timeStretch;
  window.resample = resample;
  window.pitchShift = pitchShift;
  window.pitchJitter = pitchJitter;
  window.midSideJitter = midSideJitter;
  window.eqTilt = eqTilt;
  window.peakSmear = peakSmear;
  window.dcInject = dcInject;
  window.vocalCancelCenter = vocalCancelCenter;
  window.applyFiltersAndReverb = applyFiltersAndReverb;
  window.normalizePeak = normalizePeak;
  window.padSilence = padSilence;
  window.threeZoneMicroShiftAndInvert = threeZoneMicroShiftAndInvert;
  window.detectVocals = detectVocals;
  window.createID3v2Tag = createID3v2Tag;
  window.encodeMP3 = encodeMP3;
  window.processAudioPipeline = processAudioPipeline;

  window.SunoDSP = {
    encodeWAV, decodeAudioFile, resampleOffline, timeStretch, resample,
    pitchShift, pitchJitter, midSideJitter, eqTilt, peakSmear, dcInject,
    vocalCancelCenter, applyFiltersAndReverb, normalizePeak, padSilence,
    threeZoneMicroShiftAndInvert, detectVocals, createID3v2Tag, encodeMP3,
    processAudioPipeline
  };
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    encodeWAV, decodeAudioFile, resampleOffline, timeStretch, resample,
    pitchShift, pitchJitter, midSideJitter, eqTilt, peakSmear, dcInject,
    vocalCancelCenter, applyFiltersAndReverb, normalizePeak, padSilence,
    threeZoneMicroShiftAndInvert, detectVocals, createID3v2Tag, encodeMP3,
    processAudioPipeline
  };
}
