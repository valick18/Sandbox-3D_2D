const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// A tiny sound synthesis function
// type: 'square', 'sawtooth', 'triangle', 'sine'
export function playSound(freq, type, duration, vol = 0.1, slide = 0) {
    if(audioCtx.state === 'suspended') return;

    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.type = type;
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    const now = audioCtx.currentTime;
    
    // Pitch slide
    osc.frequency.setValueAtTime(freq, now);
    if(slide !== 0) {
        osc.frequency.exponentialRampToValueAtTime(freq * slide, now + duration);
    }
    
    // Envelope to avoid clicking
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(vol, now + 0.05);
    gainNode.gain.setValueAtTime(vol, now + duration - 0.05);
    gainNode.gain.linearRampToValueAtTime(0, now + duration);

    osc.start(now);
    osc.stop(now + duration);
}

export function sfxJump() {
    playSound(150, 'square', 0.2, 0.05, 2.0);
}

export function sfxHit() {
    playSound(400, 'square', 0.02, 0.01, 1.0); // very short tick
}

export function sfxBreak() {
    playSound(300, 'triangle', 0.05, 0.03, 0.5); // short pop
}

export function sfxPlace() {
    playSound(200, 'sine', 0.1, 0.05, 1.5);
}

export function resumeAudio() {
    if(audioCtx.state === 'suspended') {
        audioCtx.resume();
        startAmbient();
    }
}

// AMBIENT NOISE
export let ambientGain;
let dayMusic;

function createNoiseBuffer() {
    let bufferSize = audioCtx.sampleRate * 2; // 2 seconds
    let buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    let output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
    }
    return buffer;
}

export function startAmbient() {
    if(!ambientGain) {
        ambientGain = audioCtx.createGain();
        ambientGain.gain.value = 0.02; // quite soft
        
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 300; // Deep wind sound
        
        const noiseSource = audioCtx.createBufferSource();
        noiseSource.buffer = createNoiseBuffer();
        noiseSource.loop = true;
        
        noiseSource.connect(filter);
        filter.connect(ambientGain);
        ambientGain.connect(audioCtx.destination);
        noiseSource.start();
    }
}

let cricketsTimer = 0;
export function updateAmbient(isNight, dt) {
    if(!ambientGain) return;
    
    // Wind sweeps up and down gently
    let targetGain = isNight ? 0.01 : 0.03;
    ambientGain.gain.value += (targetGain - ambientGain.gain.value) * 0.05;
    
    // Crickets at night
    if (isNight) {
        cricketsTimer -= dt;
        if (cricketsTimer <= 0 && Math.random() < 0.1) {
            playSound(3500 + Math.random()*200, 'square', 0.05, 0.01, 1.0);
            setTimeout(() => playSound(3600 + Math.random()*200, 'square', 0.05, 0.01, 1.0), 150);
            cricketsTimer = 1000 + Math.random() * 4000;
        }
    } else {
        // Very occasional daytime bird chirp
        if (Math.random() < 0.001) {
            playSound(4500 + Math.random()*500, 'sine', 0.1, 0.02, 1.2);
            setTimeout(() => playSound(4800 + Math.random()*500, 'sine', 0.1, 0.02, 0.8), 100);
        }
    }
}
