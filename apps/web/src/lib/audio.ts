export const SOUND_PREFERENCE_KEY = "banker-bros-sound-enabled";

export type JingleNote = {
  at: number;
  duration: number;
  frequency: number;
  gain: number;
  wave: OscillatorType;
};

// An original ascending brass-like ident written for Banker Bros. Frequencies are expressed
// directly so the game does not ship or imitate a recorded song, sample, or proprietary asset.
export const WALL_STREET_JINGLE: readonly JingleNote[] = [
  { at: 0.08, duration: 0.18, frequency: 261.63, gain: 0.18, wave: "triangle" },
  { at: 0.24, duration: 0.18, frequency: 329.63, gain: 0.18, wave: "triangle" },
  { at: 0.40, duration: 0.20, frequency: 392.00, gain: 0.19, wave: "triangle" },
  { at: 0.58, duration: 0.30, frequency: 523.25, gain: 0.21, wave: "triangle" },
  { at: 0.88, duration: 0.16, frequency: 493.88, gain: 0.15, wave: "square" },
  { at: 1.04, duration: 0.16, frequency: 392.00, gain: 0.15, wave: "square" },
  { at: 1.20, duration: 0.18, frequency: 440.00, gain: 0.17, wave: "triangle" },
  { at: 1.38, duration: 0.24, frequency: 587.33, gain: 0.20, wave: "triangle" },
  { at: 1.64, duration: 0.56, frequency: 523.25, gain: 0.22, wave: "triangle" },
];

export function wallStreetJingleDuration() {
  return Math.max(...WALL_STREET_JINGLE.map((note) => note.at + note.duration), 2.35);
}

export function storedSoundEnabled() {
  try {
    return window.localStorage.getItem(SOUND_PREFERENCE_KEY) !== "false";
  } catch {
    return true;
  }
}

export function storeSoundEnabled(enabled: boolean) {
  try {
    window.localStorage.setItem(SOUND_PREFERENCE_KEY, String(enabled));
  } catch {
    // Sound still works for the current session when storage is unavailable.
  }
}

function scheduleTone(
  context: AudioContext,
  destination: AudioNode,
  startTime: number,
  note: JingleNote,
) {
  const oscillator = context.createOscillator();
  const envelope = context.createGain();
  const startsAt = startTime + note.at;
  const endsAt = startsAt + note.duration;

  oscillator.type = note.wave;
  oscillator.frequency.setValueAtTime(note.frequency, startsAt);
  envelope.gain.setValueAtTime(0.0001, startsAt);
  envelope.gain.exponentialRampToValueAtTime(note.gain, startsAt + 0.018);
  envelope.gain.exponentialRampToValueAtTime(0.0001, endsAt);
  oscillator.connect(envelope).connect(destination);
  oscillator.start(startsAt);
  oscillator.stop(endsAt + 0.02);
}

function scheduleTickerClick(
  context: AudioContext,
  destination: AudioNode,
  at: number,
  emphasis: boolean,
) {
  const oscillator = context.createOscillator();
  const envelope = context.createGain();
  oscillator.type = "square";
  oscillator.frequency.setValueAtTime(emphasis ? 1_750 : 1_320, at);
  oscillator.frequency.exponentialRampToValueAtTime(620, at + 0.025);
  envelope.gain.setValueAtTime(emphasis ? 0.026 : 0.015, at);
  envelope.gain.exponentialRampToValueAtTime(0.0001, at + 0.032);
  oscillator.connect(envelope).connect(destination);
  oscillator.start(at);
  oscillator.stop(at + 0.04);
}

function scheduleExchangeBell(context: AudioContext, destination: AudioNode, at: number) {
  [1, 2.01, 3.98].forEach((partial, index) => {
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880 * partial, at);
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.exponentialRampToValueAtTime(0.12 / (index + 1), at + 0.008);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + 0.62 - index * 0.08);
    oscillator.connect(envelope).connect(destination);
    oscillator.start(at);
    oscillator.stop(at + 0.7);
  });
}

export async function playWallStreetJingle() {
  const AudioContextClass = window.AudioContext
    ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;

  const context = new AudioContextClass();
  await context.resume();
  const master = context.createGain();
  const startsAt = context.currentTime + 0.03;
  const duration = wallStreetJingleDuration();
  master.gain.setValueAtTime(0.62, startsAt);
  master.gain.setValueAtTime(0.62, startsAt + duration - 0.18);
  master.gain.linearRampToValueAtTime(0.0001, startsAt + duration);
  master.connect(context.destination);

  scheduleExchangeBell(context, master, startsAt);
  WALL_STREET_JINGLE.forEach((note) => scheduleTone(context, master, startsAt, note));
  for (let index = 0; index < 13; index += 1) {
    scheduleTickerClick(context, master, startsAt + 0.18 + index * 0.12, index % 4 === 0);
  }
  scheduleExchangeBell(context, master, startsAt + 1.86);

  window.setTimeout(() => void context.close(), Math.ceil((duration + 0.4) * 1_000));
}
