/**
 * master-v2.js - FFmpeg auto-mastering: ballad / pop / vinahouse
 *
 * Usage:  node master-v2.js input.wav output.wav vinahouse
 * Needs:  ffmpeg in PATH (build có ebur128, alimiter, acompressor, stereotools, crystalizer)
 *
 * Luồng: chain (EQ + comp + stereo) -> đo LUFS -> tính gain -> limiter
 *        -> đo lại LUFS + True Peak -> chỉnh gain/limit -> lặp tối đa 5 lần -> render 24-bit WAV / 320k MP3
 */
const { spawn } = require('child_process');

const dbToLin = (db) => Math.pow(10, db / 20);

// ---------------------------------------------------------------------------
// PRESETS (điểm khởi đầu, hãy nghe và chỉnh theo từng bài)
// eq: [freqHz, widthQ, gainDb]
// ---------------------------------------------------------------------------
const PRESETS = {
  ballad: {
    targetLUFS: -12.5,
    tp: -1.0, // True Peak ceiling (dBTP)
    hpf: 30,
    corrective: [[300, 1.2, -1.0]],
    tonal: [[90, 1.3, 0.5], [1800, 1.2, 0.3], [3500, 1.4, 0.6], [8000, 1.4, 0.5]],
    air: 0.8,
    crystalizer: 0,
    comp: { thresholdDb: -20, ratio: 1.25, attack: 35, release: 150 },
    stereo: { slev: 1.08, base: 0.1 },
    limiter: { attack: 8, release: 120 },
  },
  pop: {
    targetLUFS: -10,
    tp: -1.0,
    hpf: 28,
    corrective: [[300, 1.2, -1.2]],
    tonal: [[90, 1.3, 0.8], [1800, 1.2, 0.5], [3500, 1.4, 1.0], [8000, 1.4, 0.8]],
    air: 1.2,
    crystalizer: 0.3,
    comp: { thresholdDb: -18, ratio: 1.35, attack: 30, release: 120 },
    stereo: { slev: 1.15, base: 0.15 },
    limiter: { attack: 5, release: 80 },
  },
  vinahouse: {
    targetLUFS: -8,
    tp: -1.5, // master to -> chừa thêm headroom cho AAC/Opus
    hpf: 28,
    corrective: [[300, 1.2, -1.5]],
    tonal: [[85, 1.3, 1.0], [1800, 1.2, 0.4], [3500, 1.4, 0.8], [8000, 1.4, 0.6]],
    air: 1.0,
    crystalizer: 0.3,
    comp: { thresholdDb: -16, ratio: 1.5, attack: 25, release: 100 },
    stereo: { slev: 1.2, base: 0.15 },
    limiter: { attack: 3, release: 60 },
  },
};

// ---------------------------------------------------------------------------
// Filter chain
// ---------------------------------------------------------------------------
const eqBand = ([f, w, g]) => `equalizer=f=${f}:t=q:w=${w}:g=${g}`;

function preChain(p) {
  return [
    `highpass=f=${p.hpf}`,
    ...p.corrective.map(eqBand),
    `acompressor=threshold=${dbToLin(p.comp.thresholdDb).toFixed(4)}:ratio=${p.comp.ratio}` +
      `:attack=${p.comp.attack}:release=${p.comp.release}:makeup=1`,
    ...p.tonal.map(eqBand),
    `treble=g=${p.air}:f=12000`,
    p.crystalizer > 0 ? `crystalizer=i=${p.crystalizer}` : null,
    `stereotools=mlev=1.0:slev=${p.stereo.slev}:base=${p.stereo.base}`,
  ]
    .filter(Boolean)
    .join(',');
}

function limiterFilter(p, limitDb) {
  // alimiter nhận giá trị tuyến tính, tối thiểu 0.0625 (-24 dB).
  // level=disabled: tắt auto-level, nếu không alimiter sẽ chuẩn hoá ngược lên 0 dB.
  const lin = Math.max(0.0625, dbToLin(limitDb)).toFixed(5);
  return `alimiter=limit=${lin}:attack=${p.limiter.attack}:release=${p.limiter.release}:asc=1:level=disabled`;
}

// ---------------------------------------------------------------------------
// FFmpeg helpers
// ---------------------------------------------------------------------------
function ffmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args);
    let err = '';
    proc.stderr.on('data', (d) => (err += d));
    proc.on('error', reject);
    proc.on('close', (code) =>
      code === 0 ? resolve(err) : reject(new Error(err.slice(-2000)))
    );
  });
}

async function measure(input, chain) {
  const err = await ffmpeg([
    '-hide_banner', '-nostats', '-i', input,
    '-af', `${chain},ebur128=peak=true`,
    '-f', 'null', '-',
  ]);
  const s = err.slice(err.lastIndexOf('Summary:'));
  const grab = (re) => {
    const m = re.exec(s);
    if (!m) throw new Error('Không đọc được kết quả ebur128 (file im lặng?)');
    return parseFloat(m[1]);
  };
  return {
    I: grab(/I:\s+(-?[\d.]+)\s+LUFS/),
    LRA: grab(/LRA:\s+(-?[\d.]+)\s+LU/),
    TP: grab(/Peak:\s+(-?[\d.]+)\s+dBFS/),
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function master(input, output, mode = 'pop', format = 'wav') {
  const p = PRESETS[mode] || PRESETS.pop;

  const pre = preChain(p);
  const m0 = await measure(input, pre);
  let gain = p.targetLUFS - m0.I;
  let limit = p.tp - 0.3;

  if (gain > 6) {
    console.warn(`Cảnh báo: cần +${gain.toFixed(1)} dB gain -> limiter sẽ làm việc rất nhiều. ` +
      'Nên giảm target hoặc kiểm tra lại mix.');
  }

  let chain, m;
  for (let i = 0; i < 5; i++) {
    chain = `${pre},volume=${gain.toFixed(2)}dB,${limiterFilter(p, limit)}`;
    m = await measure(input, chain);

    const dI = p.targetLUFS - m.I;
    const overTP = m.TP - p.tp;
    console.log(`[AutoMaster] Lần ${i + 1} (${mode}): ${m.I.toFixed(1)} LUFS | TP ${m.TP.toFixed(2)} dBTP | LRA ${m.LRA.toFixed(1)} LU`);

    if (Math.abs(dI) <= 0.3 && overTP <= 0.05) break;
    if (overTP > 0.05) limit -= overTP;   // hạ ceiling limiter
    if (Math.abs(dI) > 0.3) gain += dI;   // bù lại loudness
  }

  if (m.TP > p.tp + 0.05) {
    console.warn(`Cảnh báo: True Peak ${m.TP.toFixed(2)} dBTP vẫn vượt ${p.tp}. Hãy giảm targetLUFS.`);
  }

  const isMp3 = format === 'mp3' || output.endsWith('.mp3');
  const encodeArgs = isMp3
    ? [
        '-y', '-hide_banner', '-i', input,
        '-af', chain,
        '-ar', '48000',
        '-c:a', 'libmp3lame',
        '-b:a', '320k',
        '-map_metadata', '-1',
        '-write_id3v1', '0',
        '-write_id3v2', '0',
        '-id3v2_version', '0',
        '-fflags', '+bitexact',
        '-flags:a', '+bitexact',
        '-f', 'mp3',
        output
      ]
    : [
        '-y', '-hide_banner', '-i', input,
        '-af', chain,
        '-ar', '48000',
        '-c:a', 'pcm_s24le',
        '-map_metadata', '-1',
        '-fflags', '+bitexact',
        '-flags:a', '+bitexact',
        '-bitexact',
        '-f', 'wav',
        output
      ];

  await ffmpeg(encodeArgs);

  return { mode, ...m, target: p.targetLUFS, tpCeiling: p.tp, output };
}

// Bản nén để kiểm tra codec (nghe lại xem có méo không)
function encodeCheck(wav, out) {
  return ffmpeg(['-y', '-hide_banner', '-i', wav, '-c:a', 'aac', '-b:a', '256k', out]);
}

module.exports = { master, encodeCheck, PRESETS };

if (require.main === module) {
  const [, , inp, out, mode, format] = process.argv;
  if (!inp || !out) {
    console.log('Usage: node master-v2.js input.wav output.wav [ballad|pop|vinahouse] [wav|mp3]');
    process.exit(1);
  }
  master(inp, out, mode || 'pop', format || (out.endsWith('.mp3') ? 'mp3' : 'wav'))
    .then((r) => console.log('Xong:', r))
    .catch((e) => { console.error(e.message); process.exit(1); });
}
