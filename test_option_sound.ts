// Run: npx tsx test_option_sound.ts
import assert from 'node:assert/strict';
import { knockSamples, playOptionKnock } from './src/optionSound';

for (const rate of [44100, 48000]) {
  const samples = knockSamples(rate);
  assert.equal(samples.length, Math.ceil(rate * 0.20));
  assert(samples[0] === 0, 'Start without an abrupt click');
  assert(samples.every((sample) => Number.isFinite(sample) && Math.abs(sample) < 0.86));
  assert(samples.some((sample) => Math.abs(sample) > 0.84), 'Impact should reach the intended volume');
  const rms = Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length);
  assert(rms > 0.1, 'The body of the sound must be audible, not just its peak');
  assert(samples.slice(-Math.ceil(rate * 0.01)).every((sample) => Math.abs(sample) < 0.001), 'Tail should decay to silence');
}
await playOptionKnock(); // No Web Audio in Node: choosing an option must still work.
console.log('PASS: audible wooden knock, safe amplitude, quiet tail, unavailable-audio fallback');
