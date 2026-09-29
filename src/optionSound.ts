let context: AudioContext | undefined;
let knock: AudioBuffer | undefined;

/** A dry wooden-door knock: sharp contact and short, inharmonic panel resonances. */
export function knockSamples(sampleRate: number) {
  const duration = 0.20;
  const samples = Float32Array.from({ length: Math.ceil(sampleRate * duration) }, (_, i) => {
    const t = i / sampleRate;
    const envelope = Math.min(t / 0.0007, 1) * Math.min((duration - t) / 0.03, 1);
    return envelope * (
      0.60 * Math.sin(2 * Math.PI * 190 * t) * Math.exp(-40 * t) +
      0.35 * Math.sin(2 * Math.PI * 477 * t) * Math.exp(-55 * t) +
      0.18 * Math.sin(2 * Math.PI * 1120 * t) * Math.exp(-90 * t) +
      0.30 * (Math.random() * 2 - 1) * Math.exp(-450 * t)
    );
  });
  const peak = samples.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
  return samples.map((value) => value * 0.85 / peak);
}

export async function playOptionKnock() {
  try {
    context ??= new AudioContext();
    if (context.state === 'suspended') await context.resume();
    if (context.state !== 'running') return;
    if (!knock) {
      const samples = knockSamples(context.sampleRate);
      knock = context.createBuffer(1, samples.length, context.sampleRate);
      knock.copyToChannel(samples, 0);
    }
    const source = context.createBufferSource();
    source.buffer = knock;
    source.connect(context.destination);
    source.onended = () => source.disconnect();
    source.start();
  } catch {
    // Audio support or permission must never block choosing a sticker option.
  }
}
