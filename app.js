// DSP engine functions loaded globally from dsp.js
const { processAudioPipeline, decodeAudioFile, encodeWAV, encodeMP3 } = (typeof window !== 'undefined' ? window : {});

// Automatic API Base URL (supports both http:// and direct file:/// opening)
const API_BASE = (typeof window !== 'undefined' && window.location.protocol === 'file:') ? 'http://127.0.0.1:3300' : '';

// Default presets matching chunks.md
const PRESETS = {
  subtle: {
    instrumentalMode: "light",
    pitchSemitones: 0,
    speedFactor: 1.0,
    sampleRate: 48000,
    eqNotchHz: 0,
    reverbWetPct: 0,
    silencePadSec: 0,
    normalize: true,
    mp3RoundTripBitrate: 320,
    mp3UseVbr: false,
    eqTiltMaxDb: 0,
    eqTiltBands: 0,
    mixJitterCents: 0,
    mixJitterHz: 0,
    midSideJitterCents: 0,
    midSideJitterHz: 0,
    dcInjectSubHz: 0,
    dcInjectGainDb: -60,
    peakSmearBands: 0,
    peakSmearDepthDb: 0,
    peakSmearHz: 0,
    instrumental: false,
    autoDetectVocals: false,
    lyricBypass: false,
    threeZoneShift: true,
    threeZoneIntensity: "subtle",
    zoneHead: true,
    zoneMid: true,
    zoneTail: true
  },
  moderate: {
    instrumentalMode: "off",
    pitchSemitones: -2,
    speedFactor: 0.95,
    sampleRate: 48000,
    eqNotchHz: 0,
    reverbWetPct: 15,
    silencePadSec: 0.5,
    normalize: true,
    mp3RoundTripBitrate: 128,
    mp3UseVbr: false,
    eqTiltMaxDb: 1.5,
    eqTiltBands: 6,
    mixJitterCents: 10,
    mixJitterHz: 0.3,
    midSideJitterCents: 8,
    midSideJitterHz: 0.25,
    dcInjectSubHz: 0,
    dcInjectGainDb: -60,
    peakSmearBands: 0,
    peakSmearDepthDb: 0,
    peakSmearHz: 0,
    instrumental: false,
    autoDetectVocals: true,
    threeZoneShift: true,
    threeZoneIntensity: "moderate",
    zoneHead: true,
    zoneMid: true,
    zoneTail: true
  },
  aggressive: {
    instrumentalMode: "off",
    pitchSemitones: -4,
    speedFactor: 0.93,
    sampleRate: 48000,
    eqNotchHz: 300,
    reverbWetPct: 25,
    silencePadSec: 0.5,
    normalize: true,
    mp3RoundTripBitrate: 96,
    mp3UseVbr: false,
    eqTiltMaxDb: 2.5,
    eqTiltBands: 7,
    mixJitterCents: 15,
    mixJitterHz: 0.4,
    midSideJitterCents: 12,
    midSideJitterHz: 0.35,
    dcInjectSubHz: 7,
    dcInjectGainDb: -55,
    peakSmearBands: 5,
    peakSmearDepthDb: 2.5,
    peakSmearHz: 0.15,
    instrumental: false,
    autoDetectVocals: true,
    threeZoneShift: true,
    threeZoneIntensity: "strong",
    zoneHead: true,
    zoneMid: true,
    zoneTail: true
  },
  instrumental: {
    instrumentalMode: "light",
    pitchSemitones: 2,
    speedFactor: 1.12,
    sampleRate: 44100,
    eqNotchHz: 0,
    reverbWetPct: 0,
    silencePadSec: 0,
    normalize: true,
    mp3RoundTripBitrate: 192,
    mp3UseVbr: false,
    eqTiltMaxDb: 0,
    eqTiltBands: 0,
    mixJitterCents: 0,
    mixJitterHz: 0,
    midSideJitterCents: 0,
    midSideJitterHz: 0,
    dcInjectSubHz: 0,
    dcInjectGainDb: -60,
    peakSmearBands: 0,
    peakSmearDepthDb: 0,
    peakSmearHz: 0,
    instrumental: true,
    autoDetectVocals: false,
    threeZoneShift: true,
    threeZoneIntensity: "subtle",
    zoneHead: true,
    zoneMid: true,
    zoneTail: true
  },
  clear: {
    instrumentalMode: "off",
    pitchSemitones: 0,
    speedFactor: 1.0,
    sampleRate: 48000,
    eqNotchHz: 0,
    reverbWetPct: 0,
    silencePadSec: 0,
    normalize: true,
    mp3RoundTripBitrate: 320,
    mp3UseVbr: false,
    eqTiltMaxDb: 0,
    eqTiltBands: 0,
    mixJitterCents: 0,
    mixJitterHz: 0,
    midSideJitterCents: 0,
    midSideJitterHz: 0,
    dcInjectSubHz: 0,
    dcInjectGainDb: -60,
    peakSmearBands: 0,
    peakSmearDepthDb: 0,
    peakSmearHz: 0,
    instrumental: false,
    autoDetectVocals: false,
    threeZoneShift: true,
    threeZoneIntensity: "subtle",
    zoneHead: true,
    zoneMid: true,
    zoneTail: true
  }
};

// Filename Sanitizer (Skill: media-download-uuid-fix) - Strictly <= 80 characters
function sanitizeMediaFilename(rawName, suffixTag = 'suno_fixed', extension = 'mp3') {
  let base = 'audio';
  if (rawName && typeof rawName === 'string') {
    // Strip existing extension
    base = rawName.replace(/\.[a-zA-Z0-9]+$/i, '').trim();
  }
  // Remove illegal characters on Windows / file system: / \ ? % * : | " < >
  base = base.replace(/[/\\?%*:|"<>]/g, '_');
  // Avoid consecutive dots or relative paths
  base = base.replace(/\.{2,}/g, '_');
  // Strip non-printable / control characters
  base = base.replace(/[\x00-\x1F\x7F]/g, '');
  // Normalize whitespace
  base = base.replace(/\s+/g, ' ').trim();

  const suffix = suffixTag ? `_${suffixTag}` : '';
  const ext = extension.startsWith('.') ? extension : `.${extension}`;

  // Maximum allowed total length is 80 characters
  // base.length + suffix.length + ext.length <= 80
  const maxBaseLen = Math.max(10, 80 - suffix.length - ext.length);
  if (base.length > maxBaseLen) {
    base = base.substring(0, maxBaseLen);
    // Break at word boundary if possible to prevent awkward cuts
    const lastSpace = base.lastIndexOf(' ');
    if (lastSpace > maxBaseLen * 0.6) {
      base = base.substring(0, lastSpace);
    }
    base = base.trim();
  }

  // Strip trailing periods, underscores, spaces, or hyphens from base
  base = base.replace(/[. _-]+$/, '');
  if (!base) base = 'audio';

  let finalName = `${base}${suffix}${ext}`;
  // Hard enforce <= 80 characters in all edge cases
  if (finalName.length > 80) {
    const overflow = finalName.length - 80;
    base = base.substring(0, Math.max(5, base.length - overflow)).replace(/[. _-]+$/, '');
    finalName = `${base}${suffix}${ext}`;
  }

  return finalName;
}

// Queue State Management
let fileQueue = []; // array of { id, file, status: 'pending'|'processing'|'done'|'error'|'aborted', wavBlob, mp3Blob, wavUrl, mp3Url, sanitizedMp3Name, sanitizedWavName, errorMsg }
let isBatchProcessing = false;
let currentProcessingIndex = -1;
let batchAbortRequested = false;
let activeAbortController = null;

// DOM Elements
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');

// Batch Queue Elements
const batchQueueSection = document.getElementById('batchQueueSection');
const queueCountBadge = document.getElementById('queueCountBadge');
const btnAddFiles = document.getElementById('btnAddFiles');
const btnClearQueue = document.getElementById('btnClearQueue');
const queueList = document.getElementById('queueList');
const chkAutoDownload = document.getElementById('chkAutoDownload');
const selAutoDownloadFormat = document.getElementById('selAutoDownloadFormat');

// Progress Card Elements
const progressCard = document.getElementById('progressCard');
const batchActiveBanner = document.getElementById('batchActiveBanner');
const batchStepPill = document.getElementById('batchStepPill');
const batchActiveName = document.getElementById('batchActiveName');
const batchTrackPct = document.getElementById('batchTrackPct');
const batchOverallPct = document.getElementById('batchOverallPct');
const stageTitle = document.getElementById('stageTitle');
const progressMessage = document.getElementById('progressMessage');
const etaText = document.getElementById('etaText');
const btnProcess = document.getElementById('btnProcess');
const btnProcessLabel = document.getElementById('btnProcessLabel');
const btnAbort = document.getElementById('btnAbort');
const logToggle = document.getElementById('logToggle');
const logBox = document.getElementById('logBox');

// Batch Results Section Elements
const batchResultsSection = document.getElementById('batchResultsSection');
const resultsCount = document.getElementById('resultsCount');
const resultsList = document.getElementById('resultsList');
const btnDownloadAllMp3 = document.getElementById('btnDownloadAllMp3');
const btnDownloadAllWav = document.getElementById('btnDownloadAllWav');

// Form Presets & Settings
const presetButtons = document.querySelectorAll('.preset-btn');
const btnClarityMode = document.getElementById('btnClarityMode');
const accordion = document.getElementById('accordion');
const accordionHeader = document.getElementById('accordionHeader');

const instrumentalModeBtns = document.querySelectorAll('.inst-mode-btn');
const chkIsInstrumental = document.getElementById('chkIsInstrumental');
const inputPitch = document.getElementById('inputPitch');
const valPitch = document.getElementById('valPitch');
const inputTempo = document.getElementById('inputTempo');
const valTempo = document.getElementById('valTempo');
const inputSampleRate = document.getElementById('inputSampleRate');
const inputEqNotch = document.getElementById('inputEqNotch');
const inputReverb = document.getElementById('inputReverb');
const valReverb = document.getElementById('valReverb');
const inputSilence = document.getElementById('inputSilence');
const valSilence = document.getElementById('valSilence');
const chkNormalize = document.getElementById('chkNormalize');
const chkAutoDetect = document.getElementById('chkAutoDetect');
const inputMp3Bitrate = document.getElementById('inputMp3Bitrate');
const valMp3Bitrate = document.getElementById('valMp3Bitrate');
const inputEqTiltMax = document.getElementById('inputEqTiltMax');
const valEqTiltMax = document.getElementById('valEqTiltMax');
const inputEqTiltBands = document.getElementById('inputEqTiltBands');
const valEqTiltBands = document.getElementById('valEqTiltBands');
const inputFullJitter = document.getElementById('inputFullJitter');
const valFullJitter = document.getElementById('valFullJitter');
const inputFullJitterHz = document.getElementById('inputFullJitterHz');
const inputSideJitter = document.getElementById('inputSideJitter');
const valSideJitter = document.getElementById('valSideJitter');
const inputSideJitterHz = document.getElementById('inputSideJitterHz');
const inputPeakSmearBands = document.getElementById('inputPeakSmearBands');
const inputPeakSmearDepth = document.getElementById('inputPeakSmearDepth');
const inputPeakSmearHz = document.getElementById('inputPeakSmearHz');
const inputDcSubHz = document.getElementById('inputDcSubHz');
const inputDcGain = document.getElementById('inputDcGain');
const chkMp3Vbr = document.getElementById('chkMp3Vbr');
const chkLyricBypass = document.getElementById('chkLyricBypass');

// Three-Zone Micro Inversion & Shift DOM Elements
const chkThreeZoneShift = document.getElementById('chkThreeZoneShift');
const badgeThreeZoneStatus = document.getElementById('badgeThreeZoneStatus');
const threeZoneControls = document.getElementById('threeZoneControls');
const selThreeZoneIntensity = document.getElementById('selThreeZoneIntensity');
const valThreeZoneIntensity = document.getElementById('valThreeZoneIntensity');
const chkZoneHead = document.getElementById('chkZoneHead');
const chkZoneMid = document.getElementById('chkZoneMid');
const chkZoneTail = document.getElementById('chkZoneTail');



const STAGES = ['input', 'model', 'separate', 'shape', 'file'];
const STAGE_LABELS = {
  input: 'INPUT',
  model: 'MODEL',
  separate: 'SEPARATE',
  shape: 'SHAPE',
  file: 'FILE'
};

const segFills = {
  input: document.getElementById('segFill-input'),
  model: document.getElementById('segFill-model'),
  separate: document.getElementById('segFill-separate'),
  shape: document.getElementById('segFill-shape'),
  file: document.getElementById('segFill-file')
};

const stageLabels = {
  input: document.getElementById('stageLbl-input'),
  model: document.getElementById('stageLbl-model'),
  separate: document.getElementById('stageLbl-separate'),
  shape: document.getElementById('stageLbl-shape'),
  file: document.getElementById('stageLbl-file')
};

let currentInstMode = "light";

// Three-Zone UI State Helpers
function updateThreeZoneUI() {
  const isEnabled = chkThreeZoneShift ? chkThreeZoneShift.checked : true;
  if (badgeThreeZoneStatus) {
    if (isEnabled) {
      badgeThreeZoneStatus.textContent = 'Đang bật (Sạch gốc)';
      badgeThreeZoneStatus.classList.remove('disabled');
    } else {
      badgeThreeZoneStatus.textContent = 'Đã tắt';
      badgeThreeZoneStatus.classList.add('disabled');
    }
  }
  if (threeZoneControls) {
    threeZoneControls.style.opacity = isEnabled ? '1' : '0.4';
    threeZoneControls.style.pointerEvents = isEnabled ? 'auto' : 'none';
  }
}

function updateThreeZoneIntensityLabel() {
  if (!selThreeZoneIntensity || !valThreeZoneIntensity) return;
  const v = selThreeZoneIntensity.value;
  if (v === 'subtle') valThreeZoneIntensity.textContent = 'Nhẹ (Khuyên dùng)';
  else if (v === 'moderate') valThreeZoneIntensity.textContent = 'Vừa phải';
  else if (v === 'strong') valThreeZoneIntensity.textContent = 'Mạnh';
}

// Apply preset values to UI controls
function applyPreset(presetKey) {
  const p = PRESETS[presetKey];
  if (!p) return;

  presetButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.preset === presetKey);
  });

  currentInstMode = p.instrumentalMode || "off";
  instrumentalModeBtns.forEach(b => {
    b.classList.toggle('active', b.dataset.mode === currentInstMode);
  });

  chkIsInstrumental.checked = !!p.instrumental;
  inputPitch.value = p.pitchSemitones;
  valPitch.textContent = `${p.pitchSemitones > 0 ? '+' : ''}${p.pitchSemitones} st`;

  inputTempo.value = Math.round(p.speedFactor * 100);
  valTempo.textContent = `${Math.round(p.speedFactor * 100)}%`;

  inputSampleRate.value = p.sampleRate || 0;
  inputEqNotch.value = p.eqNotchHz || '';

  inputReverb.value = p.reverbWetPct;
  valReverb.textContent = `${p.reverbWetPct}%`;

  inputSilence.value = p.silencePadSec;
  valSilence.textContent = `${p.silencePadSec}s`;

  chkNormalize.checked = !!p.normalize;
  chkAutoDetect.checked = !!p.autoDetectVocals;
  if (chkLyricBypass) chkLyricBypass.checked = !!p.lyricBypass;

  inputMp3Bitrate.value = p.mp3RoundTripBitrate || 128;
  valMp3Bitrate.textContent = `${p.mp3RoundTripBitrate || 128} kbps`;
  if (chkMp3Vbr) chkMp3Vbr.checked = !!p.mp3UseVbr;

  inputEqTiltMax.value = p.eqTiltMaxDb;
  valEqTiltMax.textContent = `±${p.eqTiltMaxDb} dB`;

  inputEqTiltBands.value = p.eqTiltBands;
  valEqTiltBands.textContent = `${p.eqTiltBands}`;

  inputFullJitter.value = p.mixJitterCents;
  valFullJitter.textContent = `±${p.mixJitterCents}¢`;
  inputFullJitterHz.value = p.mixJitterHz;

  inputSideJitter.value = p.midSideJitterCents;
  valSideJitter.textContent = `±${p.midSideJitterCents}¢`;
  inputSideJitterHz.value = p.midSideJitterHz;

  inputPeakSmearBands.value = p.peakSmearBands;
  inputPeakSmearDepth.value = p.peakSmearDepthDb;
  inputPeakSmearHz.value = p.peakSmearHz;

  inputDcSubHz.value = p.dcInjectSubHz;
  inputDcGain.value = p.dcInjectGainDb;

  if (chkThreeZoneShift) {
    chkThreeZoneShift.checked = p.threeZoneShift !== false;
    updateThreeZoneUI();
  }
  if (selThreeZoneIntensity) {
    selThreeZoneIntensity.value = p.threeZoneIntensity || 'subtle';
    updateThreeZoneIntensityLabel();
  }
  if (chkZoneHead) chkZoneHead.checked = p.zoneHead !== false;
  if (chkZoneMid) chkZoneMid.checked = p.zoneMid !== false;
  if (chkZoneTail) chkZoneTail.checked = p.zoneTail !== false;
}

// Read current form options
function getOptionsFromForm() {
  return {
    instrumentalMode: currentInstMode,
    instrumental: chkIsInstrumental.checked,
    pitchSemitones: parseFloat(inputPitch.value) || 0,
    speedFactor: (parseFloat(inputTempo.value) || 100) / 100,
    sampleRate: parseInt(inputSampleRate.value, 10) || null,
    eqNotchHz: parseFloat(inputEqNotch.value) || null,
    reverbWetPct: parseFloat(inputReverb.value) || 0,
    silencePadSec: parseFloat(inputSilence.value) || 0,
    normalize: chkNormalize.checked,
    autoDetectVocals: chkAutoDetect.checked,
    lyricBypass: chkLyricBypass ? chkLyricBypass.checked : false,
    mp3RoundTripBitrate: parseInt(inputMp3Bitrate.value, 10) || 0,
    mp3UseVbr: chkMp3Vbr ? chkMp3Vbr.checked : false,
    eqTiltMaxDb: parseFloat(inputEqTiltMax.value) || 0,
    eqTiltBands: parseInt(inputEqTiltBands.value, 10) || 0,
    mixJitterCents: parseFloat(inputFullJitter.value) || 0,
    mixJitterHz: parseFloat(inputFullJitterHz.value) || 0,
    midSideJitterCents: parseFloat(inputSideJitter.value) || 0,
    midSideJitterHz: parseFloat(inputSideJitterHz.value) || 0,
    peakSmearBands: parseInt(inputPeakSmearBands.value, 10) || 0,
    peakSmearDepthDb: parseFloat(inputPeakSmearDepth.value) || 0,
    peakSmearHz: parseFloat(inputPeakSmearHz.value) || 0,
    dcInjectSubHz: parseFloat(inputDcSubHz.value) || 0,
    dcInjectGainDb: parseFloat(inputDcGain.value) || -60,
    threeZoneShift: chkThreeZoneShift ? chkThreeZoneShift.checked : true,
    threeZoneIntensity: selThreeZoneIntensity ? selThreeZoneIntensity.value : 'subtle',
    zoneHead: chkZoneHead ? chkZoneHead.checked : true,
    zoneMid: chkZoneMid ? chkZoneMid.checked : true,
    zoneTail: chkZoneTail ? chkZoneTail.checked : true
  };
}

// Log message to UI
function addLog(msg) {
  const line = `[${new Date().toLocaleTimeString()}] ${msg}\n`;
  logBox.textContent += line;
  logBox.scrollTop = logBox.scrollHeight;
}

// Handle multi-file selection
function handleFilesSelected(files) {
  if (!files || files.length === 0) return;

  const validAudioExts = ['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac', '.webm'];
  let addedCount = 0;

  Array.from(files).forEach(file => {
    const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
    const isValid = file.type.startsWith('audio/') || validAudioExts.includes(ext);
    if (!isValid) return;

    // Deduplicate against existing queue items
    const isDuplicate = fileQueue.some(item => item.file.name === file.name && item.file.size === file.size);
    if (isDuplicate) return;

    fileQueue.push({
      id: 'file_' + Math.random().toString(36).substr(2, 9),
      file: file,
      status: 'pending',
      wavBlob: null,
      mp3Blob: null,
      wavUrl: null,
      mp3Url: null,
      sanitizedMp3Name: sanitizeMediaFilename(file.name, 'suno_fixed', 'mp3'),
      sanitizedWavName: sanitizeMediaFilename(file.name, 'suno_fixed', 'wav'),
      errorMsg: null
    });
    addedCount++;
  });

  if (addedCount > 0) {
    updateQueueUI();
    batchQueueSection.style.display = 'block';
    btnProcess.disabled = false;
    updateProcessButtonLabel();
    addLog(`Đã thêm ${addedCount} tệp vào hàng đợi.`);
  }

  // Reset input value so same files can be re-selected if removed
  fileInput.value = '';
}

// Update process button label based on queue count
function updateProcessButtonLabel() {
  if (fileQueue.length === 0) {
    btnProcessLabel.textContent = `Bắt đầu xử lý (Anonymize it!)`;
    return;
  }

  const pendingCount = fileQueue.filter(item => item.status !== 'done').length;
  const doneCount = fileQueue.filter(item => item.status === 'done').length;

  if (pendingCount > 1) {
    btnProcessLabel.textContent = `Bắt đầu xử lý (${pendingCount} tệp lần lượt)`;
  } else if (pendingCount === 1) {
    btnProcessLabel.textContent = `Bắt đầu xử lý (1 tệp)`;
  } else if (doneCount > 0 && pendingCount === 0) {
    btnProcessLabel.textContent = doneCount > 1
      ? `Render tiếp (${doneCount} tệp • Bắt đầu lại)`
      : `Render tiếp tệp này (Kết xuất lại)`;
  } else {
    btnProcessLabel.textContent = `Bắt đầu xử lý (Anonymize it!)`;
  }
}

// Update queue UI list
function updateQueueUI() {
  if (fileQueue.length === 0) {
    batchQueueSection.style.display = 'none';
    btnProcess.disabled = true;
    updateProcessButtonLabel();
    return;
  }

  const totalBytes = fileQueue.reduce((acc, item) => acc + item.file.size, 0);
  const totalMB = (totalBytes / (1024 * 1024)).toFixed(1);
  queueCountBadge.textContent = `${fileQueue.length} tệp • ${totalMB} MB`;

  queueList.innerHTML = '';
  fileQueue.forEach((item, idx) => {
    const itemEl = document.createElement('div');
    itemEl.className = `queue-item ${item.status === 'processing' ? 'active-item' : ''}`;
    itemEl.id = `queue-item-${item.id}`;

    let statusPillHtml = '';
    if (item.status === 'pending') {
      statusPillHtml = `
        <span class="status-pill pending">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          Chờ xử lý
        </span>
      `;
    } else if (item.status === 'processing') {
      statusPillHtml = `
        <span class="status-pill processing">
          <svg class="spin-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
          Đang xử lý
        </span>
      `;
    } else if (item.status === 'done') {
      statusPillHtml = `
        <span class="status-pill done">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Hoàn tất
        </span>
      `;
    } else if (item.status === 'error') {
      statusPillHtml = `
        <span class="status-pill error" title="${item.errorMsg || 'Lỗi'}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          Lỗi
        </span>
      `;
    } else if (item.status === 'aborted') {
      statusPillHtml = `
        <span class="status-pill aborted">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
          </svg>
          Đã hủy
        </span>
      `;
    }

    const removeBtnHtml = (!isBatchProcessing || item.status !== 'processing') ? `
      <button type="button" class="btn-remove-item" data-id="${item.id}" title="Gỡ file khỏi danh sách">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    ` : '';

    itemEl.innerHTML = `
      <div class="queue-item-info">
        <span class="queue-index">#${idx + 1}</span>
        <div class="queue-item-icon-box">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 10v4"/><path d="M7 6v12"/><path d="M11 3v18"/><path d="M15 8v8"/><path d="M19 11v2"/>
          </svg>
        </div>
        <div class="queue-item-details">
          <div class="queue-item-name" title="${item.file.name}">${item.file.name}</div>
          <div class="queue-meta-row">
            <span class="meta-tag size">${(item.file.size / (1024 * 1024)).toFixed(2)} MB</span>
            <span class="meta-tag name" title="Tên file xuất: ${item.sanitizedMp3Name}">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>
              ${item.sanitizedMp3Name}
            </span>
            <span class="meta-tag len">${item.sanitizedMp3Name.length}/80 kt</span>
          </div>
        </div>
      </div>
      <div class="queue-item-status-wrapper">
        ${statusPillHtml}
        ${removeBtnHtml}
      </div>
    `;

    queueList.appendChild(itemEl);
  });

  // Attach remove buttons listeners
  queueList.querySelectorAll('.btn-remove-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      fileQueue = fileQueue.filter(x => x.id !== id);
      updateQueueUI();
      updateProcessButtonLabel();
    });
  });
}

// Update 5-stage progress bar with accurate real-time percentage
function updateProgressUI({ stage, phase, subProgress = 0, message, startTime, currentFileIndex = currentProcessingIndex, totalFiles = fileQueue.length || 1 }) {
  const stageKey = (stage || 'shape').toLowerCase();
  const activeIdx = STAGES.indexOf(stageKey) !== -1 ? STAGES.indexOf(stageKey) : 0;
  const clampedSub = Math.max(0, Math.min(1, typeof subProgress === 'number' ? subProgress : 0));

  // Current file progression: each of the 5 stages is 20%
  const currentFileFraction = (activeIdx + clampedSub) / STAGES.length;
  const currentFilePct = Math.min(100, Math.max(0, Math.round(currentFileFraction * 100)));

  // Batch overall progression: completed items + fraction of current item
  const validTotal = Math.max(1, totalFiles);
  const validIndex = Math.max(0, currentFileIndex);
  const overallFraction = (validIndex + currentFileFraction) / validTotal;
  const overallPct = Math.min(100, Math.max(0, Math.round(overallFraction * 100)));

  // Real-time percentage badges update
  if (batchTrackPct) {
    batchTrackPct.textContent = `${currentFilePct}%`;
  }
  if (batchOverallPct) {
    if (validTotal > 1) {
      batchOverallPct.style.display = 'inline-block';
      batchOverallPct.textContent = `Tổng: ${overallPct}% (${validIndex + 1}/${validTotal})`;
    } else {
      batchOverallPct.style.display = 'none';
    }
  }

  if (stageTitle) stageTitle.textContent = STAGE_LABELS[stageKey] || stageKey.toUpperCase();
  if (progressMessage) progressMessage.textContent = message || 'Working...';

  STAGES.forEach((st, idx) => {
    const fillEl = segFills[st];
    const lblEl = stageLabels[st];
    if (!fillEl || !lblEl) return;

    if (idx < activeIdx) {
      fillEl.style.width = '100%';
      lblEl.className = 'stage-label completed';
    } else if (idx === activeIdx) {
      const pct = Math.min(100, Math.max(0, clampedSub * 100));
      fillEl.style.width = `${pct}%`;
      lblEl.className = 'stage-label active';
    } else {
      fillEl.style.width = '0%';
      lblEl.className = 'stage-label';
    }
  });

  if (startTime && etaText) {
    const elapsed = (Date.now() - startTime) / 1000;
    if (currentFileFraction > 0.04 && currentFileFraction < 1.0) {
      const totalSec = elapsed / currentFileFraction;
      const remSec = Math.max(1, Math.round(totalSec - elapsed));
      if (remSec < 60) {
        etaText.textContent = `còn lại ~${remSec}s`;
      } else {
        const m = Math.floor(remSec / 60);
        const s = remSec % 60;
        etaText.textContent = s > 0 ? `còn lại ~${m}p ${s}s` : `còn lại ~${m}p`;
      }
    } else if (currentFileFraction >= 1.0) {
      etaText.textContent = 'Hoàn tất';
    } else {
      etaText.textContent = 'Đang tính toán thời gian...';
    }
  }
}

// Append Result Card immediately upon file completion
function appendResultCard(item) {
  batchResultsSection.style.display = 'block';

  // Check if card already exists for this item
  let card = document.getElementById(`result-card-${item.id}`);
  if (!card) {
    card = document.createElement('div');
    card.className = 'result-card';
    card.id = `result-card-${item.id}`;
    resultsList.appendChild(card);
  }

  // Ensure original file object URL exists for listening to original version
  if (!item.originalUrl && item.file) {
    item.originalUrl = URL.createObjectURL(item.file);
  }

  const mp3SizeMb = item.mp3Blob ? (item.mp3Blob.size / (1024 * 1024)).toFixed(2) : '0';
  const wavSizeMb = item.wavBlob ? (item.wavBlob.size / (1024 * 1024)).toFixed(2) : '0';
  const isDownloaded = item.downloaded === true;

  const badgeHtml = isDownloaded ? `
    <span class="badge-downloaded" id="badge-dl-${item.id}">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
      Đã tải
    </span>
  ` : `
    <span class="badge-downloaded pending-dl" id="badge-dl-${item.id}">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
      Sẵn sàng
    </span>
  `;

  card.innerHTML = `
    <div class="result-card-header">
      <div class="result-card-info">
        <div class="result-card-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </div>
        <div style="min-width:0; flex:1;">
          <div class="result-card-filename" title="${item.sanitizedMp3Name}">${item.sanitizedMp3Name}</div>
          <div class="result-meta-row">
            <span class="meta-tag">Gốc: ${(item.file.size / (1024 * 1024)).toFixed(2)} MB</span>
            <span class="meta-tag accent">MP3: ${mp3SizeMb} MB (320k)</span>
            <span class="meta-tag">WAV: ${wavSizeMb} MB</span>
            <span class="meta-tag len">${item.sanitizedMp3Name.length}/80 kt</span>
          </div>
        </div>
      </div>
      <div class="result-badges">
        ${badgeHtml}
        <span class="output-badge"><span class="badge-pulse-dot"></span> Ready</span>
      </div>
    </div>

    <!-- Audio Player with Processed vs Original Audio Switcher -->
    <div class="result-player-container">
      <div class="audio-switch-bar">
        <div class="audio-switch-tabs">
          <button type="button" class="btn-audio-tab active" id="tab-proc-${item.id}" data-id="${item.id}" title="Nghe bản đã xử lý âm thanh">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>
            <span>Bản đã xử lý</span>
          </button>
          <button type="button" class="btn-audio-tab" id="tab-orig-${item.id}" data-id="${item.id}" title="Nghe lại bản gốc ban đầu">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <span>Nghe lại bản gốc</span>
          </button>
        </div>
        <div class="audio-switch-info" id="audio-info-${item.id}">
          <span class="info-pulse"></span>
          <span class="info-text">Đang phát: Bản đã xử lý (Master)</span>
        </div>
      </div>

      <div class="result-card-player">
        <audio id="audio-${item.id}" controls src="${item.mp3Url || item.wavUrl}"></audio>
      </div>
    </div>

    <div class="result-card-actions">
      <a class="btn-download btn-download-mp3 ${item.downloadedMp3 ? 'downloaded' : ''}" id="dl-mp3-${item.id}" href="${item.mp3Url || item.wavUrl}" download="${item.sanitizedMp3Name}">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="3" x2="12" y2="15"></line>
        </svg>
        <span>${item.downloadedMp3 ? '✓ Đã tải MP3 (320k)' : 'Tải MP3 (320 kbps Studio)'}</span>
      </a>

      <a class="btn-download btn-download-wav ${item.downloadedWav ? 'downloaded' : ''}" id="dl-wav-${item.id}" href="${item.wavUrl}" download="${item.sanitizedWavName}">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="3" x2="12" y2="15"></line>
        </svg>
        <span>${item.downloadedWav ? '✓ Đã tải WAV Master' : 'Tải WAV Master (Lossless)'}</span>
      </a>
    </div>
  `;

  // Attach Audio Switcher event listeners
  const tabProc = card.querySelector(`#tab-proc-${item.id}`);
  const tabOrig = card.querySelector(`#tab-orig-${item.id}`);
  const audioEl = card.querySelector(`#audio-${item.id}`);
  const infoEl = card.querySelector(`#audio-info-${item.id}`);

  if (tabProc && tabOrig && audioEl) {
    const handleSwitch = (mode) => {
      const wasPlaying = !audioEl.paused;
      const currentPos = audioEl.currentTime;

      if (mode === 'original') {
        if (!item.originalUrl && item.file) {
          item.originalUrl = URL.createObjectURL(item.file);
        }
        audioEl.src = item.originalUrl;
        tabProc.classList.remove('active');
        tabOrig.classList.add('active', 'original-mode');
        if (infoEl) {
          infoEl.className = 'audio-switch-info original-mode';
          infoEl.innerHTML = `<span class="info-pulse"></span><span class="info-text">Đang phát: Bản gốc (${(item.file.size / (1024 * 1024)).toFixed(2)} MB)</span>`;
        }
      } else {
        audioEl.src = item.mp3Url || item.wavUrl;
        tabOrig.classList.remove('active', 'original-mode');
        tabProc.classList.add('active');
        if (infoEl) {
          infoEl.className = 'audio-switch-info';
          infoEl.innerHTML = `<span class="info-pulse"></span><span class="info-text">Đang phát: Bản đã xử lý (Master)</span>`;
        }
      }

      audioEl.addEventListener('loadedmetadata', function onLoaded() {
        if (currentPos && currentPos < audioEl.duration) {
          audioEl.currentTime = currentPos;
        }
        if (wasPlaying) {
          audioEl.play().catch(() => {});
        }
        audioEl.removeEventListener('loadedmetadata', onLoaded);
      }, { once: true });
    };

    tabProc.addEventListener('click', () => handleSwitch('processed'));
    tabOrig.addEventListener('click', () => handleSwitch('original'));
  }

  // Attach Download buttons event listeners (mark as "Đã tải" immediately)
  const dlMp3 = card.querySelector(`#dl-mp3-${item.id}`);
  const dlWav = card.querySelector(`#dl-wav-${item.id}`);

  if (dlMp3) {
    dlMp3.addEventListener('click', () => {
      markItemAsDownloaded(item, 'mp3');
    });
  }

  if (dlWav) {
    dlWav.addEventListener('click', () => {
      markItemAsDownloaded(item, 'wav');
    });
  }

  // Update total completed count
  const completedCount = fileQueue.filter(x => x.status === 'done').length;
  resultsCount.textContent = completedCount;
}

// Helper to mark an item and its download buttons as "Đã tải"
function markItemAsDownloaded(item, type = 'any') {
  item.downloaded = true;
  if (type === 'mp3') item.downloadedMp3 = true;
  if (type === 'wav') item.downloadedWav = true;
  if (type === 'both') {
    item.downloadedMp3 = true;
    item.downloadedWav = true;
  }

  const badge = document.getElementById(`badge-dl-${item.id}`);
  if (badge) {
    badge.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
      Đã tải
    `;
    badge.className = 'badge-downloaded';
  }

  if (type === 'mp3' || type === 'both') {
    const btnMp3 = document.getElementById(`dl-mp3-${item.id}`);
    if (btnMp3) {
      btnMp3.classList.add('downloaded');
      const textSpan = btnMp3.querySelector('span');
      if (textSpan) textSpan.textContent = '✓ Đã tải MP3 (320k)';
    }
  }

  if (type === 'wav' || type === 'both') {
    const btnWav = document.getElementById(`dl-wav-${item.id}`);
    if (btnWav) {
      btnWav.classList.add('downloaded');
      const textSpan = btnWav.querySelector('span');
      if (textSpan) textSpan.textContent = '✓ Đã tải WAV Master';
    }
  }
}

// Sequential Auto-Download Handler (Chromium-safe delay)
async function triggerAutoDownload(item, format = 'mp3') {
  // Safe 600ms delay to prevent Chromium popup blocking and UUID download fallbacks
  await new Promise(r => setTimeout(r, 600));

  if (format === 'mp3' || format === 'both') {
    const dlMp3 = document.getElementById(`dl-mp3-${item.id}`);
    if (dlMp3 && item.mp3Url) {
      dlMp3.click();
      markItemAsDownloaded(item, 'mp3');
      addLog(`[✓ Tự động tải về MP3]: ${item.sanitizedMp3Name}`);
    }
  }

  if (format === 'wav' || format === 'both') {
    if (format === 'both') {
      await new Promise(r => setTimeout(r, 600));
    }
    const dlWav = document.getElementById(`dl-wav-${item.id}`);
    if (dlWav && item.wavUrl) {
      dlWav.click();
      markItemAsDownloaded(item, 'wav');
      addLog(`[✓ Tự động tải về WAV]: ${item.sanitizedWavName}`);
    }
  }

  markItemAsDownloaded(item, format);
}

// Main Batch Processing Sequential Loop
async function startBatchProcessing() {
  if (fileQueue.length === 0 || isBatchProcessing) return;

  // Tự động thu gọn phần "Thiết lập chuyên sâu (Advanced settings)" nếu đang mở
  if (accordion && accordion.classList.contains('open')) {
    accordion.classList.remove('open');
  }

  let pendingItems = fileQueue.filter(item => item.status !== 'done');
  if (pendingItems.length === 0 && fileQueue.length > 0) {
    // Tất cả tệp đã hoàn tất, người dùng bấm render tiếp:
    // Tự động đặt lại trạng thái các tệp về 'pending' để tiến hành render lại
    fileQueue.forEach(item => {
      item.status = 'pending';
      item.errorMsg = null;
    });
    updateQueueUI();
    addLog(`Bắt đầu kết xuất lại (re-render) ${fileQueue.length} tệp theo thiết lập hiện tại...`);
    pendingItems = fileQueue;
  }

  isBatchProcessing = true;
  batchAbortRequested = false;

  btnProcess.style.display = 'none';
  btnAbort.style.display = 'flex';
  progressCard.style.display = 'block';
  batchActiveBanner.style.display = 'flex';
  logBox.textContent = '';

  // Reset segmented progress bars for new run
  STAGES.forEach((st) => {
    if (segFills[st]) segFills[st].style.width = '0%';
    if (stageLabels[st]) stageLabels[st].className = 'stage-label';
  });
  if (batchTrackPct) batchTrackPct.textContent = '0%';

  const autoDownload = chkAutoDownload ? chkAutoDownload.checked : false;
  const downloadFormat = selAutoDownloadFormat ? selAutoDownloadFormat.value : 'wav';

  addLog(`Bắt đầu xử lý tuần tự ${pendingItems.length} tệp...`);

  for (let i = 0; i < fileQueue.length; i++) {
    if (batchAbortRequested) break;

    const item = fileQueue[i];
    if (item.status === 'done') continue;

    currentProcessingIndex = i;
    item.status = 'processing';
    updateQueueUI();

    // Active item scroll into view
    const itemEl = document.getElementById(`queue-item-${item.id}`);
    if (itemEl) itemEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // Update banner
    const currentStepNum = fileQueue.filter((x, idx) => idx <= i && x.status === 'done').length + 1;
    batchStepPill.textContent = `Tệp ${currentStepNum}/${fileQueue.length}`;
    batchActiveName.textContent = item.file.name;
    if (batchTrackPct) batchTrackPct.textContent = '0%';
    if (batchOverallPct) {
      if (fileQueue.length > 1) {
        const startOverall = Math.round((i / fileQueue.length) * 100);
        batchOverallPct.style.display = 'inline-block';
        batchOverallPct.textContent = `Tổng: ${startOverall}% (${currentStepNum}/${fileQueue.length})`;
      } else {
        batchOverallPct.style.display = 'none';
      }
    }

    const startTime = Date.now();
    activeAbortController = new AbortController();
    const options = getOptionsFromForm();

    updateProgressUI({
      stage: 'input',
      phase: 'decoding',
      subProgress: 0.1,
      message: 'Đang giải mã âm thanh (Decoding audio)...',
      startTime,
      currentFileIndex: i,
      totalFiles: fileQueue.length
    });

    try {
      const result = await processAudioPipeline(item.file, options, {
        signal: activeAbortController.signal,
        onProgress: ({ stage, phase, subProgress, message }) => {
          updateProgressUI({
            stage,
            phase,
            subProgress,
            message: message || 'Đang xử lý âm thanh...',
            startTime,
            currentFileIndex: i,
            totalFiles: fileQueue.length
          });
        },
        onLog: (msg) => addLog(`[${item.file.name}] ${msg}`)
      });

      item.status = 'done';
      if (item.file && item.file.name) {
        recordAudioProcessed(item.file.name);
      }
      item.wavBlob = result.wavBlob;
      item.mp3Blob = result.mp3Blob;
      item.wavUrl = URL.createObjectURL(result.wavBlob);
      item.mp3Url = result.mp3Blob ? URL.createObjectURL(result.mp3Blob) : null;
      item.sanitizedMp3Name = sanitizeMediaFilename(item.file.name, 'suno_fixed', 'mp3');
      item.sanitizedWavName = sanitizeMediaFilename(item.file.name, 'suno_fixed', 'wav');

      // Set to 100% for this file
      if (batchTrackPct) batchTrackPct.textContent = '100%';
      STAGES.forEach((st) => {
        if (segFills[st]) segFills[st].style.width = '100%';
        if (stageLabels[st]) stageLabels[st].className = 'stage-label completed';
      });

      updateQueueUI();

      // 1. Immediately render incremental result card
      appendResultCard(item);

      // 2. Trigger safe sequential auto-download if enabled
      if (autoDownload && !batchAbortRequested) {
        await triggerAutoDownload(item, downloadFormat);
      }

    } catch (err) {
      if (err.name === 'AbortError' || batchAbortRequested) {
        item.status = 'aborted';
        addLog(`[${item.file.name}] Đã hủy xử lý.`);
        updateQueueUI();
        if (progressMessage) progressMessage.textContent = 'Đã dừng xử lý theo yêu cầu.';
        if (etaText) etaText.textContent = 'Đã dừng';
        break;
      } else {
        console.error(err);
        item.status = 'error';
        item.errorMsg = err.message;
        addLog(`[${item.file.name}] LỖI: ${err.message}`);
        updateQueueUI();
      }
    }
  }

  // Finalize batch run
  isBatchProcessing = false;
  activeAbortController = null;
  btnAbort.style.display = 'none';
  btnProcess.style.display = 'flex';
  btnProcess.disabled = false;
  updateProcessButtonLabel();

  if (!batchAbortRequested) {
    STAGES.forEach((st) => {
      if (segFills[st]) segFills[st].style.width = '100%';
      if (stageLabels[st]) stageLabels[st].className = 'stage-label completed';
    });
    if (stageTitle) stageTitle.textContent = 'FILE';
    if (progressMessage) progressMessage.textContent = `✓ Đã hoàn tất xử lý tất cả các tệp!`;
    if (etaText) etaText.textContent = 'Hoàn tất';
    if (batchTrackPct) batchTrackPct.textContent = '100%';
    if (batchOverallPct) {
      if (fileQueue.length > 1) {
        batchOverallPct.style.display = 'inline-block';
        batchOverallPct.textContent = `Tổng: 100% (${fileQueue.length}/${fileQueue.length})`;
      } else {
        batchOverallPct.style.display = 'none';
      }
    }
    addLog(`✓ Đã hoàn tất xử lý toàn bộ danh sách tệp.`);
  }
}

// Download All MP3s helper
async function downloadAllMp3s() {
  const completed = fileQueue.filter(x => x.status === 'done' && x.mp3Url);
  if (completed.length === 0) {
    alert("Chưa có tệp nào xử lý xong để tải!");
    return;
  }
  for (let i = 0; i < completed.length; i++) {
    const item = completed[i];
    const dl = document.getElementById(`dl-mp3-${item.id}`);
    if (dl) {
      dl.click();
      addLog(`[Tải lại]: ${item.sanitizedMp3Name}`);
      await new Promise(r => setTimeout(r, 500));
    }
  }
}

// Download All WAVs helper
async function downloadAllWavs() {
  const completed = fileQueue.filter(x => x.status === 'done' && x.wavUrl);
  if (completed.length === 0) {
    alert("Chưa có tệp nào xử lý xong để tải!");
    return;
  }
  for (let i = 0; i < completed.length; i++) {
    const item = completed[i];
    const dl = document.getElementById(`dl-wav-${item.id}`);
    if (dl) {
      dl.click();
      addLog(`[Tải lại]: ${item.sanitizedWavName}`);
      await new Promise(r => setTimeout(r, 500));
    }
  }
}

// Setup Event Listeners
function setupEvents() {
  // Preset buttons click
  presetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      applyPreset(btn.dataset.preset);
    });
  });

  // Clarity mode button click
  btnClarityMode.addEventListener('click', () => {
    applyPreset('clear');
  });

  // Instrumental mode buttons
  instrumentalModeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      instrumentalModeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentInstMode = btn.dataset.mode;
    });
  });

  // Accordion toggle
  accordionHeader.addEventListener('click', () => {
    accordion.classList.toggle('open');
  });

  // Sliders dynamic updates
  inputPitch.addEventListener('input', () => {
    const val = parseFloat(inputPitch.value);
    valPitch.textContent = `${val > 0 ? '+' : ''}${val} st`;
  });
  inputTempo.addEventListener('input', () => {
    valTempo.textContent = `${inputTempo.value}%`;
  });
  inputReverb.addEventListener('input', () => {
    valReverb.textContent = `${inputReverb.value}%`;
  });
  inputSilence.addEventListener('input', () => {
    valSilence.textContent = `${inputSilence.value}s`;
  });
  inputMp3Bitrate.addEventListener('input', () => {
    valMp3Bitrate.textContent = `${inputMp3Bitrate.value} kbps`;
  });
  inputEqTiltMax.addEventListener('input', () => {
    valEqTiltMax.textContent = `±${inputEqTiltMax.value} dB`;
  });
  inputEqTiltBands.addEventListener('input', () => {
    valEqTiltBands.textContent = `${inputEqTiltBands.value}`;
  });
  inputFullJitter.addEventListener('input', () => {
    valFullJitter.textContent = `±${inputFullJitter.value}¢`;
  });
  inputSideJitter.addEventListener('input', () => {
    valSideJitter.textContent = `±${inputSideJitter.value}¢`;
  });

  // Three-Zone Inversion & Shift UI Listeners
  if (chkThreeZoneShift) {
    chkThreeZoneShift.addEventListener('change', updateThreeZoneUI);
  }
  if (selThreeZoneIntensity) {
    selThreeZoneIntensity.addEventListener('change', updateThreeZoneIntensityLabel);
  }



  // Drag & drop file handling (Supports multiple files simultaneously)
  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelected(e.dataTransfer.files);
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files.length > 0) {
      handleFilesSelected(fileInput.files);
    }
  });

  // Batch Queue buttons
  btnAddFiles.addEventListener('click', () => fileInput.click());

  btnClearQueue.addEventListener('click', () => {
    if (isBatchProcessing) {
      if (!confirm("Tiến trình đang chạy, bạn có chắc muốn dừng và xóa tất cả hàng đợi?")) return;
      batchAbortRequested = true;
      if (activeAbortController) activeAbortController.abort();
    }
    fileQueue = [];
    updateQueueUI();
    updateProcessButtonLabel();
    addLog("Đã xóa sạch hàng đợi tệp.");
  });

  // Process button click
  btnProcess.addEventListener('click', startBatchProcessing);

  // Abort processing button click
  btnAbort.addEventListener('click', () => {
    batchAbortRequested = true;
    if (activeAbortController) {
      activeAbortController.abort();
      activeAbortController = null;
    }
    addLog("Người dùng đã bấm Abort processing (Dừng xử lý).");
    if (progressMessage) progressMessage.textContent = "Đã dừng tiến trình xử lý.";
    if (etaText) etaText.textContent = "Đã dừng";
    btnAbort.style.display = 'none';
    btnProcess.style.display = 'flex';
    btnProcess.disabled = false;
    updateProcessButtonLabel();
  });

  // Log Drawer toggle
  if (logToggle) {
    logToggle.addEventListener('click', () => {
      const isHidden = logBox.style.display === 'none';
      logBox.style.display = isHidden ? 'block' : 'none';
      const label = document.getElementById('logToggleLabel');
      if (label) {
        label.textContent = `${isHidden ? '▼' : '▶'} Xem chi tiết nhật ký dòng lệnh (Logs)`;
      }
    });
  }

  // Batch download buttons
  btnDownloadAllMp3.addEventListener('click', downloadAllMp3s);
  btnDownloadAllWav.addEventListener('click', downloadAllWavs);

  // Setup Suno Downloader events
  setupSunoDownloaderEvents();
}

// ============================================================================
// Suno Music Downloader & Auto-Processor Module
// ============================================================================

let sunoResolvedTracks = [];
let sunoUnresolvedLinks = [];

function downloadBlobSafely(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1200);
}

function switchMainTab(targetTab) {
  const tabBtnAnonymize = document.getElementById('tabBtnAnonymize');
  const tabBtnDownloader = document.getElementById('tabBtnDownloader');
  const viewAnonymize = document.getElementById('viewAnonymize');
  const viewDownloader = document.getElementById('viewDownloader');
  const pageMainHeading = document.getElementById('pageMainHeading');
  const pageSubHeading = document.getElementById('pageSubHeading');

  if (targetTab === 'downloader') {
    if (tabBtnAnonymize) tabBtnAnonymize.classList.remove('active');
    if (tabBtnDownloader) tabBtnDownloader.classList.add('active');
    if (viewAnonymize) viewAnonymize.style.display = 'none';
    if (viewDownloader) viewDownloader.style.display = 'block';
    if (pageMainHeading) pageMainHeading.textContent = 'Suno Music Downloader & Auto-Processor';
    if (pageSubHeading) pageSubHeading.textContent = 'Tải nhạc trực tiếp từ Suno AI chất lượng cao (MP3 & WAV Master). Hỗ trợ dán 1 link hoặc dán hàng loạt link, tự động làm sạch và chuyển tiếp vào hệ thống xử lý.';
    try {
      localStorage.setItem('suno_active_main_tab', 'downloader');
    } catch (_) {}
  } else {
    if (tabBtnDownloader) tabBtnDownloader.classList.remove('active');
    if (tabBtnAnonymize) tabBtnAnonymize.classList.add('active');
    if (viewDownloader) viewDownloader.style.display = 'none';
    if (viewAnonymize) viewAnonymize.style.display = 'block';
    if (pageMainHeading) pageMainHeading.textContent = 'Suno Audio Anonymization';
    if (pageSubHeading) pageSubHeading.textContent = 'Điều chỉnh âm thanh trước khi nhập vào Suno AI. Tối ưu hóa để vượt qua bộ lọc nhận diện bản quyền và cải thiện độ nét của âm thanh.';
    try {
      localStorage.setItem('suno_active_main_tab', 'anonymize');
    } catch (_) {}
  }
}

function extractSunoUrlsOrUuids(text) {
  if (!text || typeof text !== 'string') return [];
  const lines = text.split(/[\r\n,;]+/).map(s => s.trim()).filter(Boolean);
  const results = [];
  const seenKeys = new Set();

  for (const line of lines) {
    // 1. Direct UUID match (e.g. suno.com/song/<uuid>, suno.com/create?song=<uuid>, cdn1.suno.ai/<uuid>.mp3, bare uuid)
    const uuidMatch = line.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    if (uuidMatch) {
      const key = uuidMatch[0].toLowerCase();
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        results.push(line);
      }
      continue;
    }

    // 2. Suno short links (e.g. suno.com/s/<sharecode> or /s/<sharecode>)
    const shortMatch = line.match(/(?:https?:\/\/)?(?:www\.)?suno\.com\/s\/([a-zA-Z0-9_-]+)/i) ||
                       line.match(/^\/?s\/([a-zA-Z0-9_-]+)/i);
    if (shortMatch) {
      const shareCode = shortMatch[1];
      const key = `short_${shareCode.toLowerCase()}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        results.push(line);
      }
      continue;
    }

    // 3. Generic Suno URLs (e.g. playlist, explore, user profile tracks)
    if (/suno\.com/i.test(line) && line.length > 10) {
      const key = line.toLowerCase();
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        results.push(line);
      }
      continue;
    }
  }
  return results;
}

function updateSunoLinkCount() {
  const txtSunoLinks = document.getElementById('txtSunoLinks');
  const sunoLinkCountBadge = document.getElementById('sunoLinkCountBadge');
  if (!txtSunoLinks || !sunoLinkCountBadge) return;
  const count = extractSunoUrlsOrUuids(txtSunoLinks.value).length;
  sunoLinkCountBadge.textContent = `${count} link đã nhận diện`;
}

async function fetchSunoAudioBlob(audioUrl, track = null) {
  // 1. If uuid is available, prioritize our server's stream or audio endpoint
  if (track && track.uuid) {
    try {
      const sRes = await fetch(`${API_BASE}/api/suno-stream?uuid=${track.uuid}`);
      if (sRes.ok) {
        const b = await sRes.blob();
        if (b.size > 1000) return b;
      }
    } catch (_) {}

    try {
      const aRes = await fetch(`${API_BASE}/api/suno-audio?uuid=${track.uuid}&format=mp3&preset=pop`);
      if (aRes.ok) {
        const b = await aRes.blob();
        if (b.size > 1000) return b;
      }
    } catch (_) {}
  }

  // 2. Direct or local fetch
  if (audioUrl) {
    try {
      const directRes = await fetch(audioUrl);
      if (directRes.ok) {
        const b = await directRes.blob();
        if (b.size > 1000) return b;
      }
    } catch (e) {
      console.warn('Direct fetch failed, falling back to proxy:', e);
    }

    if (!audioUrl.startsWith('/api/') && !audioUrl.startsWith(API_BASE + '/api/')) {
      try {
        const proxyUrl = `${API_BASE}/api/suno-proxy?url=${encodeURIComponent(audioUrl)}`;
        const proxyRes = await fetch(proxyUrl);
        if (proxyRes.ok) {
          const b = await proxyRes.blob();
          if (b.size > 1000) return b;
        }
      } catch (_) {}
    }
  }

  // 3. Fallback candidate URLs for Suno tracks
  if (track && track.uuid) {
    const candidateUrls = [
      `https://d2lwuy8qc234o3.cloudfront.net/1/clip/${track.uuid}.m4a`,
      `https://cdn1.suno.ai/${track.uuid}.mp4`,
      `https://cdn1.suno.ai/${track.uuid}.mp3`,
      `https://cdn2.suno.ai/${track.uuid}.mp3`
    ];
    for (const rawUrl of candidateUrls) {
      try {
        const pUrl = `${API_BASE}/api/suno-proxy?url=${encodeURIComponent(rawUrl)}`;
        const pRes = await fetch(pUrl);
        if (pRes.ok) {
          const b = await pRes.blob();
          if (b.size > 1000) return b;
        }
      } catch (e) {
        // continue to next fallback
      }
    }
  }

  throw new Error(`Không thể tải file âm thanh từ Suno`);
}

function renderCircularProgressHTML(percent, label, isSuccess = false, isError = false) {
  const p = Math.max(0, Math.min(100, Math.round(percent)));
  const circumference = 65.973; // 2 * Math.PI * 10.5
  const offset = (circumference * (1 - p / 100)).toFixed(2);
  const statusClass = isError ? 'error' : (isSuccess ? 'success' : '');
  const strokeColor = isError ? '#ef4444' : (isSuccess ? '#10b981' : '#10b981');
  const textColor = isError ? '#ef4444' : '#10b981';
  const displayText = isError ? '!' : (p === 100 ? '100%' : `${p}%`);

  return `
    <span class="suno-circle-progress ${statusClass}">
      <svg class="suno-circle-svg" width="26" height="26" viewBox="0 0 26 26">
        <circle class="suno-circle-bg" cx="13" cy="13" r="10.5" stroke-width="2.5" fill="none" />
        <circle class="suno-circle-bar" cx="13" cy="13" r="10.5" stroke="${strokeColor}" stroke-width="2.5" 
          stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" stroke-linecap="round" fill="none" 
          transform="rotate(-90 13 13)" />
        <text class="suno-circle-text" x="13" y="13" text-anchor="middle" dominant-baseline="central" 
          fill="${textColor}" font-size="${p === 100 ? '6.5px' : '7.5px'}">${displayText}</text>
      </svg>
      <span class="suno-circle-label">${label}</span>
    </span>
  `;
}

function setTrackProgress(uuid, percent, label, isSuccess = false, isError = false) {
  const statusEl = document.getElementById(`suno-status-${uuid}`);
  if (!statusEl) return;

  const p = Math.max(0, Math.min(100, Math.round(percent)));
  const circumference = 65.973;
  const offset = (circumference * (1 - p / 100)).toFixed(2);

  let bar = statusEl.querySelector('.suno-circle-bar');
  let txt = statusEl.querySelector('.suno-circle-text');
  let lbl = statusEl.querySelector('.suno-circle-label');
  let wrap = statusEl.querySelector('.suno-circle-progress');

  if (!wrap || !bar || !txt || !lbl) {
    statusEl.innerHTML = renderCircularProgressHTML(p, label, isSuccess, isError);
    return;
  }

  wrap.className = `suno-circle-progress ${isError ? 'error' : (isSuccess ? 'success' : '')}`;
  bar.style.strokeDashoffset = offset;
  if (isError) {
    bar.setAttribute('stroke', '#ef4444');
    txt.setAttribute('fill', '#ef4444');
    txt.textContent = '!';
    txt.setAttribute('font-size', '8px');
  } else if (isSuccess) {
    bar.setAttribute('stroke', '#10b981');
    txt.setAttribute('fill', '#10b981');
    txt.textContent = '100%';
    txt.setAttribute('font-size', '6.5px');
  } else {
    bar.setAttribute('stroke', '#10b981');
    txt.setAttribute('fill', '#10b981');
    txt.textContent = `${p}%`;
    txt.setAttribute('font-size', p === 100 ? '6.5px' : '7.5px');
  }
  lbl.textContent = label;
}

async function downloadTrackFormatWithProgress(track, format, preset, onProgress) {
  const url = `${API_BASE}/api/suno-audio?uuid=${track.uuid}&format=${format}&preset=${preset}`;
  const label = `Đang tải ${format.toUpperCase()} (${preset.toUpperCase()})...`;

  let currentPct = 6;
  onProgress(currentPct, label);

  const timer = setInterval(() => {
    if (currentPct < 40) {
      currentPct += 4;
    } else if (currentPct < 70) {
      currentPct += 2;
    } else if (currentPct < 88) {
      currentPct += 1;
    }
    onProgress(currentPct, label);
  }, 250);

  try {
    let res = await fetch(url);
    if (!res.ok) {
      res = await fetch(`${API_BASE}/api/suno-stream?uuid=${track.uuid}`);
    }
    if (!res.ok) throw new Error(`Lỗi tải ${format.toUpperCase()} (${res.status})`);

    const contentLengthHeader = res.headers.get('content-length');
    const totalBytes = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0;

    let blob;
    if (res.body && totalBytes > 0) {
      const reader = res.body.getReader();
      const chunks = [];
      let receivedBytes = 0;
      clearInterval(timer);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        receivedBytes += value.length;
        const streamPct = Math.min(99, 88 + Math.round((receivedBytes / totalBytes) * 11));
        onProgress(streamPct, `Đang tải ${format.toUpperCase()} (${preset.toUpperCase()})...`);
      }
      blob = new Blob(chunks, { type: res.headers.get('content-type') || (format === 'wav' ? 'audio/wav' : 'audio/mpeg') });
    } else {
      clearInterval(timer);
      onProgress(95, `Đang xử lý xuất file...`);
      blob = await res.blob();
    }

    clearInterval(timer);
    onProgress(100, `✓ Đã tải xong!`, true);
    return blob;
  } catch (e) {
    clearInterval(timer);
    throw e;
  }
}

async function handleSingleTrackDownload(track, format = 'mp3', autoProcess = false) {
  setTrackProgress(track.uuid, 5, 'Đang chuẩn bị...');

  try {
    if (autoProcess) {
      setTrackProgress(track.uuid, 10, 'Đang tải luồng âm thanh...');
      const rawBlob = await fetchSunoAudioBlob(track.audioUrl, track);
      setTrackProgress(track.uuid, 25, 'Đang giải mã Web Audio...');
      const cleanName = sanitizeMediaFilename(track.title, 'suno_opt', 'mp3');
      const file = new File([rawBlob], cleanName, { type: rawBlob.type || 'audio/mp4' });

      setTrackProgress(track.uuid, 35, 'Đang xử lý Anonymize (3 vùng)...');
      const pipelineOptions = getOptionsFromForm();
      const result = await processAudioPipeline(file, pipelineOptions, {
        onLog: msg => addLog(`[${track.title}] ${msg}`),
        onProgress: p => {
          const pct = Math.round(p.subProgress * 100);
          setTrackProgress(track.uuid, pct, p.message);
        }
      });

      const selSunoFormat = document.getElementById('selSunoFormat');
      const targetFormat = selSunoFormat ? selSunoFormat.value : 'mp3';

      if ((targetFormat === 'mp3' || targetFormat === 'both') && result.mp3Blob) {
        const fname = sanitizeMediaFilename(track.title, 'anonymized', 'mp3');
        downloadBlobSafely(result.mp3Blob, fname);
        addLog(`✓ Đã tải MP3 xử lý: ${fname}`);
      }
      if ((targetFormat === 'wav' || targetFormat === 'both') && result.wavBlob) {
        const fname = sanitizeMediaFilename(track.title, 'anonymized', 'wav');
        downloadBlobSafely(result.wavBlob, fname);
        addLog(`✓ Đã tải WAV xử lý: ${fname}`);
      }
      setTrackProgress(track.uuid, 100, '✓ Hoàn tất xử lý!', true);
      recordAudioProcessed(track.title);
      recordSunoDownload(1);
      return;
    }

    if (!autoProcess) {
      const selSunoPreset = document.getElementById('selSunoPreset');
      const preset = selSunoPreset ? selSunoPreset.value : 'pop';

      if (format === 'wav') {
        const wavBlob = await downloadTrackFormatWithProgress(track, 'wav', preset, (pct, msg, isSuccess) => {
          setTrackProgress(track.uuid, pct, msg, isSuccess);
        });
        const fname = sanitizeMediaFilename(track.title, `master_${preset}`, 'wav');
        downloadBlobSafely(wavBlob, fname);
        addLog(`✓ Đã tải WAV Master 24-bit (${preset.toUpperCase()} • Sạch Meta): ${fname}`);
        recordSunoDownload(1);
        setTrackProgress(track.uuid, 100, '✓ Đã tải xong!', true);
        return;
      }

      if (format === 'mp3') {
        const mp3Blob = await downloadTrackFormatWithProgress(track, 'mp3', preset, (pct, msg, isSuccess) => {
          setTrackProgress(track.uuid, pct, msg, isSuccess);
        });
        const fname = sanitizeMediaFilename(track.title, `master_${preset}`, 'mp3');
        downloadBlobSafely(mp3Blob, fname);
        addLog(`✓ Đã tải MP3 Master 320k (${preset.toUpperCase()} • Sạch Meta): ${fname}`);
        recordSunoDownload(1);
        setTrackProgress(track.uuid, 100, '✓ Đã tải xong!', true);
        return;
      }

      if (format === 'both') {
        setTrackProgress(track.uuid, 10, `Đang tải WAV (${preset.toUpperCase()})...`);
        const wavBlob = await downloadTrackFormatWithProgress(track, 'wav', preset, (pct, msg) => {
          setTrackProgress(track.uuid, Math.round(pct * 0.5), msg);
        });
        const fnameWav = sanitizeMediaFilename(track.title, `master_${preset}`, 'wav');
        downloadBlobSafely(wavBlob, fnameWav);
        addLog(`✓ Đã tải WAV Master: ${fnameWav}`);

        setTrackProgress(track.uuid, 55, `Đang tải MP3 (${preset.toUpperCase()})...`);
        const mp3Blob = await downloadTrackFormatWithProgress(track, 'mp3', preset, (pct, msg) => {
          setTrackProgress(track.uuid, 50 + Math.round(pct * 0.5), msg);
        });
        const fnameMp3 = sanitizeMediaFilename(track.title, `master_${preset}`, 'mp3');
        downloadBlobSafely(mp3Blob, fnameMp3);
        addLog(`✓ Đã tải MP3 Master: ${fnameMp3}`);

        recordSunoDownload(2);
        setTrackProgress(track.uuid, 100, '✓ Đã tải xong cả 2 file!', true);
        return;
      }
    }
  } catch (err) {
    setTrackProgress(track.uuid, 0, `Lỗi: ${err.message}`, false, true);
    addLog(`[Lỗi tải bài ${track.title}]: ${err.message}`);
  }
}

async function sendTrackToQueue(track) {
  setTrackProgress(track.uuid, 15, 'Đang nạp vào hàng đợi...');

  try {
    const rawBlob = await fetchSunoAudioBlob(track.audioUrl, track);
    setTrackProgress(track.uuid, 60, 'Đang chuẩn bị file...');
    const cleanFileName = sanitizeMediaFilename(track.title, 'suno', 'mp3');
    const file = new File([rawBlob], cleanFileName, { type: rawBlob.type || 'audio/mp4' });

    fileQueue.push({
      id: 'file_' + Math.random().toString(36).substr(2, 9),
      file: file,
      status: 'pending',
      wavBlob: null,
      mp3Blob: null,
      wavUrl: null,
      mp3Url: null,
      sanitizedMp3Name: sanitizeMediaFilename(track.title, 'suno_fixed', 'mp3'),
      sanitizedWavName: sanitizeMediaFilename(track.title, 'suno_fixed', 'wav'),
      errorMsg: null
    });

    updateQueueUI();
    batchQueueSection.style.display = 'block';
    btnProcess.disabled = false;
    updateProcessButtonLabel();
    addLog(`Đã nạp "${track.title}" vào hàng đợi Audio Anonymization.`);

    setTrackProgress(track.uuid, 100, '✓ Đã nạp vào hàng đợi!', true);
    switchMainTab('anonymize');
  } catch (err) {
    setTrackProgress(track.uuid, 0, `Lỗi: ${err.message}`, false, true);
    addLog(`[Lỗi nạp hàng đợi]: ${err.message}`);
  }
}

function renderSunoTrackList() {
  const sunoTracksCount = document.getElementById('sunoTracksCount');
  const sunoTrackList = document.getElementById('sunoTrackList');
  const selSunoFormat = document.getElementById('selSunoFormat');

  if (sunoTracksCount) {
    if (sunoUnresolvedLinks.length > 0 && sunoResolvedTracks.length > 0) {
      sunoTracksCount.textContent = `${sunoResolvedTracks.length} bài khả dụng • ${sunoUnresolvedLinks.length} link không tồn tại`;
    } else if (sunoUnresolvedLinks.length > 0) {
      sunoTracksCount.textContent = `0 bài (${sunoUnresolvedLinks.length} link không tồn tại)`;
    } else {
      sunoTracksCount.textContent = sunoResolvedTracks.length;
    }
  }
  if (!sunoTrackList) return;

  sunoTrackList.innerHTML = '';

  // 1. Render all successfully resolved tracks
  sunoResolvedTracks.forEach((track) => {
    const card = document.createElement('div');
    card.className = 'suno-track-card';
    card.id = `suno-track-${track.uuid}`;

    card.innerHTML = `
      <div class="suno-track-left">
        <img class="suno-track-thumb" src="${track.image}" alt="${track.title}" onerror="this.src='https://cdn-o.suno.com/favicon-192x192.png'">
        <div class="suno-track-details">
          <div class="suno-track-title" title="${track.title}">${track.title}</div>
          <div class="suno-track-meta">
            <span class="suno-track-artist" title="${track.artist || 'Suno AI'}">${track.artist || 'Suno AI'}</span>
            <span>•</span>
            <span class="suno-track-uuid">ID: ${track.uuid.substring(0, 8)}...</span>
          </div>
          <div class="suno-track-player-row">
            <audio controls preload="none" class="suno-audio-player" src="${track.audioUrl}"></audio>
            <span id="suno-status-${track.uuid}" class="suno-status-cell"></span>
          </div>
        </div>
      </div>
      <div class="suno-track-actions">
        <button type="button" class="btn-track-action primary btn-dl-mp3" data-uuid="${track.uuid}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
          Tải MP3
        </button>
        <button type="button" class="btn-track-action secondary btn-dl-wav" data-uuid="${track.uuid}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
          Tải WAV
        </button>
        <button type="button" class="btn-track-action accent btn-dl-both" data-uuid="${track.uuid}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="3" x2="12" y2="15"></line><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path></svg>
          Tải cả hai
        </button>
      </div>
    `;

    sunoTrackList.appendChild(card);
  });

  // 2. Render all unresolved / not found links
  sunoUnresolvedLinks.forEach((err) => {
    const errCard = document.createElement('div');
    errCard.className = 'suno-track-card suno-track-card-error';
    errCard.innerHTML = `
      <div class="suno-track-left">
        <div class="suno-track-thumb-error">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
        </div>
        <div class="suno-track-details">
          <div class="suno-track-title" style="color:var(--text-muted); font-size:13px; word-break:break-all;">${err.url}</div>
          <div class="suno-track-meta">
            <span style="color:#ef4444; font-weight:600;">⚠️ Link không tồn tại trên Suno hoặc bài hát đã bị xóa</span>
          </div>
          <div style="font-size:11.5px; color:var(--text-muted); margin-top:4px;">
            Mẹo: Hãy mở Suno, vào bài hát cần tải bấm <strong>Share</strong> ➔ <strong>Copy Link</strong> để dán link mới.
          </div>
        </div>
      </div>
      <div class="suno-track-actions">
        <a href="${err.url}" target="_blank" rel="noopener noreferrer" class="btn-track-action secondary" style="text-decoration:none;">
          Kiểm tra link
        </a>
      </div>
    `;
    sunoTrackList.appendChild(errCard);
  });

  sunoTrackList.querySelectorAll('.btn-dl-mp3').forEach(btn => {
    btn.addEventListener('click', () => {
      const track = sunoResolvedTracks.find(t => t.uuid === btn.dataset.uuid);
      if (track) handleSingleTrackDownload(track, 'mp3', false);
    });
  });

  sunoTrackList.querySelectorAll('.btn-dl-wav').forEach(btn => {
    btn.addEventListener('click', () => {
      const track = sunoResolvedTracks.find(t => t.uuid === btn.dataset.uuid);
      if (track) handleSingleTrackDownload(track, 'wav', false);
    });
  });

  sunoTrackList.querySelectorAll('.btn-dl-both').forEach(btn => {
    btn.addEventListener('click', () => {
      const track = sunoResolvedTracks.find(t => t.uuid === btn.dataset.uuid);
      if (track) handleSingleTrackDownload(track, 'both', false);
    });
  });
}

async function fetchAndResolveSunoTracks() {
  const txtSunoLinks = document.getElementById('txtSunoLinks');
  const btnFetchSuno = document.getElementById('btnFetchSuno');
  const btnFetchSunoLabel = document.getElementById('btnFetchSunoLabel');
  const sunoTracksSection = document.getElementById('sunoTracksSection');
  const selSunoActionMode = document.getElementById('selSunoActionMode');
  const selSunoFormat = document.getElementById('selSunoFormat');
  const chkSunoAutoDownload = document.getElementById('chkSunoAutoDownload');

  const text = txtSunoLinks ? txtSunoLinks.value.trim() : '';
  const validInputs = extractSunoUrlsOrUuids(text);

  if (validInputs.length === 0) {
    alert('Vui lòng dán ít nhất 1 link bài hát từ Suno AI (hoặc mã UUID)!');
    if (txtSunoLinks) txtSunoLinks.focus();
    return;
  }

  btnFetchSuno.disabled = true;
  btnFetchSunoLabel.textContent = `Đang phân tích ${validInputs.length} bài hát từ Suno...`;

  try {
    const res = await fetch(`${API_BASE}/api/suno-resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: validInputs })
    });

    const data = await res.json();
    if (data.errors && data.errors.length > 0) {
      data.errors.forEach(e => {
        addLog(`⚠️ [Không tìm thấy bài]: "${e.url}" — ${e.error}`);
      });
    }

    sunoResolvedTracks = (data.tracks || []).map(t => ({
      ...t,
      status: 'idle',
      mp3Blob: null,
      wavBlob: null
    }));
    sunoUnresolvedLinks = data.errors || [];

    renderSunoTrackList();
    if (sunoTracksSection) sunoTracksSection.style.display = 'block';

    if (sunoResolvedTracks.length > 0) {
      addLog(`✓ Đã phân tích thành công ${sunoResolvedTracks.length}/${validInputs.length} bài hát từ Suno.`);
    }
    if (sunoUnresolvedLinks.length > 0) {
      addLog(`⚠️ Ghi chú: ${sunoUnresolvedLinks.length} link không khả dụng trên Suno.`);
    }

    if (sunoResolvedTracks.length === 0 && sunoUnresolvedLinks.length > 0) {
      alert(`Không tìm thấy bài hát nào từ link đã dán. Vui lòng kiểm tra lại link.`);
      return;
    }

    if (chkSunoAutoDownload && chkSunoAutoDownload.checked) {
      const fmt = selSunoFormat ? selSunoFormat.value : 'mp3';
      addLog(`Bắt đầu tải về ${sunoResolvedTracks.length} bài hát Master (Định dạng: ${fmt.toUpperCase()})...`);
      for (const track of sunoResolvedTracks) {
        await handleSingleTrackDownload(track, fmt, false);
        await new Promise(r => setTimeout(r, 600));
      }
    }
  } catch (err) {
    alert(`Lỗi phân tích nhạc Suno: ${err.message}`);
    addLog(`[Lỗi phân tích Suno]: ${err.message}`);
  } finally {
    btnFetchSuno.disabled = false;
    btnFetchSunoLabel.textContent = 'Phân tích & Tải nhạc Suno';
  }
}

function setupSunoDownloaderEvents() {
  const tabBtnAnonymize = document.getElementById('tabBtnAnonymize');
  const tabBtnDownloader = document.getElementById('tabBtnDownloader');
  const btnGoToSunoDownloader = document.getElementById('btnGoToSunoDownloader');
  const txtSunoLinks = document.getElementById('txtSunoLinks');
  const btnPasteClipboard = document.getElementById('btnPasteClipboard');
  const btnSampleLink = document.getElementById('btnSampleLink');
  const btnClearLinks = document.getElementById('btnClearLinks');
  const selSunoFormat = document.getElementById('selSunoFormat');
  const valSunoFormat = document.getElementById('valSunoFormat');
  const selSunoActionMode = document.getElementById('selSunoActionMode');
  const valSunoAction = document.getElementById('valSunoAction');
  const btnFetchSuno = document.getElementById('btnFetchSuno');

  const btnSunoDownloadAllMp3 = document.getElementById('btnSunoDownloadAllMp3');
  const btnSunoDownloadAllWav = document.getElementById('btnSunoDownloadAllWav');
  const btnSunoDownloadAllBoth = document.getElementById('btnSunoDownloadAllBoth');

  if (tabBtnAnonymize) tabBtnAnonymize.addEventListener('click', () => switchMainTab('anonymize'));
  if (tabBtnDownloader) tabBtnDownloader.addEventListener('click', () => switchMainTab('downloader'));
  if (btnGoToSunoDownloader) btnGoToSunoDownloader.addEventListener('click', () => switchMainTab('downloader'));

  // Khôi phục tab người dùng đã chọn trước đó từ localStorage
  try {
    const savedTab = localStorage.getItem('suno_active_main_tab');
    if (savedTab === 'downloader' || savedTab === 'anonymize') {
      switchMainTab(savedTab);
    }
  } catch (_) {}

  if (txtSunoLinks) {
    txtSunoLinks.addEventListener('input', updateSunoLinkCount);
    txtSunoLinks.addEventListener('paste', () => setTimeout(updateSunoLinkCount, 50));
  }

  if (btnPasteClipboard) {
    btnPasteClipboard.addEventListener('click', async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (text) {
          txtSunoLinks.value = (txtSunoLinks.value ? txtSunoLinks.value + '\n' : '') + text.trim();
          updateSunoLinkCount();
          addLog('Đã dán nội dung từ clipboard.');
        }
      } catch (err) {
        alert('Không thể đọc clipboard, vui lòng bấm Ctrl+V để dán trực tiếp.');
      }
    });
  }

  if (btnSampleLink) {
    btnSampleLink.addEventListener('click', () => {
      txtSunoLinks.value = 'https://suno.com/song/c1a16429-f3fe-4d99-bdcf-61ee13ed6f00\nhttps://suno.com/song/61e30791-afbd-41b9-b634-2d3f5a774834';
      updateSunoLinkCount();
    });
  }

  if (btnClearLinks) {
    btnClearLinks.addEventListener('click', () => {
      txtSunoLinks.value = '';
      updateSunoLinkCount();
    });
  }

  if (selSunoFormat && valSunoFormat) {
    selSunoFormat.addEventListener('change', () => {
      const v = selSunoFormat.value;
      if (v === 'mp3') valSunoFormat.textContent = 'MP3 Master';
      else if (v === 'wav') valSunoFormat.textContent = 'WAV Master';
      else if (v === 'both') valSunoFormat.textContent = 'Cả MP3 & WAV';
    });
  }

  const selSunoPreset = document.getElementById('selSunoPreset');
  const valSunoPreset = document.getElementById('valSunoPreset');

  if (selSunoPreset && valSunoPreset) {
    selSunoPreset.addEventListener('change', () => {
      const v = selSunoPreset.value;
      const PRESET_BADGES = {
        'pop': 'Pop (-10 LUFS)',
        'ballad': 'Ballad (-12.5 LUFS)',
        'vinahouse': 'Vinahouse (-8.0 LUFS)'
      };
      valSunoPreset.textContent = PRESET_BADGES[v] || v;

      sunoResolvedTracks.forEach(track => {
        const audioEl = document.querySelector(`#suno-track-${track.uuid} audio`);
        if (audioEl) {
          audioEl.src = `${API_BASE}/api/suno-audio?uuid=${track.uuid}&format=mp3&preset=${v}`;
        }
      });
      addLog(`Đã chọn preset Auto-Master: ${selSunoPreset.options[selSunoPreset.selectedIndex].text}`);
    });
  }

  if (selSunoActionMode && valSunoAction) {
    selSunoActionMode.addEventListener('change', () => {
      valSunoAction.textContent = 'Chỉ tải gốc';
    });
  }

  if (btnFetchSuno) {
    btnFetchSuno.addEventListener('click', fetchAndResolveSunoTracks);
  }

  if (btnSunoDownloadAllMp3) {
    btnSunoDownloadAllMp3.addEventListener('click', async () => {
      for (const track of sunoResolvedTracks) {
        await handleSingleTrackDownload(track, 'mp3', false);
        await new Promise(r => setTimeout(r, 600));
      }
    });
  }

  if (btnSunoDownloadAllWav) {
    btnSunoDownloadAllWav.addEventListener('click', async () => {
      for (const track of sunoResolvedTracks) {
        await handleSingleTrackDownload(track, 'wav', false);
        await new Promise(r => setTimeout(r, 600));
      }
    });
  }

  if (btnSunoDownloadAllBoth) {
    btnSunoDownloadAllBoth.addEventListener('click', async () => {
      for (const track of sunoResolvedTracks) {
        await handleSingleTrackDownload(track, 'both', false);
        await new Promise(r => setTimeout(r, 600));
      }
    });
  }

  if (btnDlFetchedMp3) {
    btnDlFetchedMp3.addEventListener('click', () => recordSunoDownload(1));
  }
  if (btnDlFetchedWav) {
    btnDlFetchedWav.addEventListener('click', () => recordSunoDownload(1));
  }

  // Khởi tạo bộ đếm và giao diện thống kê chân trang
  initFooterStatsEvents();
}

// ============================================================================
// Footer Statistics: Real-time File Processing & Suno Download Counts
// ============================================================================
const STATS_STORAGE_KEY_TOTAL_PROCESSED = 'suno_stats_total_processed';
const STATS_STORAGE_KEY_TOTAL_SUNO = 'suno_stats_total_suno_downloads';
const STATS_STORAGE_KEY_FILES = 'suno_stats_processed_files';

function getFooterStats() {
  let totalProcessed = 0;
  let totalSuno = 0;
  let files = {};

  try {
    totalProcessed = parseInt(localStorage.getItem(STATS_STORAGE_KEY_TOTAL_PROCESSED) || '0', 10);
    totalSuno = parseInt(localStorage.getItem(STATS_STORAGE_KEY_TOTAL_SUNO) || '0', 10);
    const rawFiles = localStorage.getItem(STATS_STORAGE_KEY_FILES);
    if (rawFiles) {
      files = JSON.parse(rawFiles);
    }
  } catch (e) {
    console.warn('[Stats] Failed to load stats from localStorage:', e);
  }

  return { totalProcessed, totalSuno, files };
}

function saveFooterStats(totalProcessed, totalSuno, files) {
  try {
    localStorage.setItem(STATS_STORAGE_KEY_TOTAL_PROCESSED, totalProcessed.toString());
    localStorage.setItem(STATS_STORAGE_KEY_TOTAL_SUNO, totalSuno.toString());
    localStorage.setItem(STATS_STORAGE_KEY_FILES, JSON.stringify(files));
  } catch (e) {
    console.warn('[Stats] Failed to save stats to localStorage:', e);
  }
}

function updateFooterStatsUI() {
  const footerTotalProcessed = document.getElementById('footerTotalProcessed');
  const footerTotalSuno = document.getElementById('footerTotalSuno');
  const footerTotalUniqueFiles = document.getElementById('footerTotalUniqueFiles');
  const fileStatsList = document.getElementById('fileStatsList');

  const { totalProcessed, totalSuno, files } = getFooterStats();

  if (footerTotalProcessed) footerTotalProcessed.textContent = totalProcessed.toLocaleString('vi-VN');
  if (footerTotalSuno) footerTotalSuno.textContent = totalSuno.toLocaleString('vi-VN');

  const fileEntries = Object.entries(files);
  if (footerTotalUniqueFiles) {
    footerTotalUniqueFiles.textContent = `${fileEntries.length.toLocaleString('vi-VN')} tệp`;
  }

  if (fileStatsList) {
    if (fileEntries.length === 0) {
      fileStatsList.innerHTML = `<div class="file-stats-empty">Chưa có tệp âm thanh nào được xử lý. Khi bạn xử lý âm thanh, số lượt của từng tệp sẽ được ghi nhận tại đây.</div>`;
    } else {
      fileEntries.sort((a, b) => b[1].count - a[1].count);

      fileStatsList.innerHTML = fileEntries.map(([name, data]) => `
        <div class="file-stats-item">
          <span class="file-stats-name" title="${name}">🎵 ${name}</span>
          <span class="file-stats-count-badge">${data.count} lượt xử lý</span>
        </div>
      `).join('');
    }
  }
}

function recordAudioProcessed(fileName) {
  if (!fileName) return;
  const { totalProcessed, totalSuno, files } = getFooterStats();

  const newTotal = totalProcessed + 1;
  const cleanName = fileName.trim();

  if (!files[cleanName]) {
    files[cleanName] = { count: 1, lastUpdated: new Date().toISOString() };
  } else {
    files[cleanName].count += 1;
    files[cleanName].lastUpdated = new Date().toISOString();
  }

  saveFooterStats(newTotal, totalSuno, files);
  updateFooterStatsUI();
}

function recordSunoDownload(count = 1) {
  const { totalProcessed, totalSuno, files } = getFooterStats();
  const newSuno = totalSuno + (typeof count === 'number' ? count : 1);
  saveFooterStats(totalProcessed, newSuno, files);
  updateFooterStatsUI();
}

function clearFooterStats() {
  if (confirm('Bạn có chắc chắn muốn đặt lại toàn bộ thống kê số lượt xử lý và tải tệp về 0?')) {
    saveFooterStats(0, 0, {});
    updateFooterStatsUI();
  }
}

function initFooterStatsEvents() {
  updateFooterStatsUI();

  const btnToggleFileStats = document.getElementById('btnToggleFileStats');
  const fileStatsDrawer = document.getElementById('fileStatsDrawer');
  const btnClearFileStats = document.getElementById('btnClearFileStats');

  if (btnToggleFileStats && fileStatsDrawer) {
    btnToggleFileStats.addEventListener('click', () => {
      const isHidden = fileStatsDrawer.style.display === 'none';
      fileStatsDrawer.style.display = isHidden ? 'block' : 'none';
      btnToggleFileStats.classList.toggle('open', isHidden);
    });
  }

  if (btnClearFileStats) {
    btnClearFileStats.addEventListener('click', clearFooterStats);
  }
}

// Initialize on page load (handles both deferred/module and regular script execution)
function initApp() {
  setupEvents();
  applyPreset('subtle'); // Matches user screenshot defaults
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

