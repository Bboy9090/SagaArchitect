import { audioClipDuration, audioMixDuration, type PhoenixAudioMix } from './audio-mix';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

async function decodeAudio(context: BaseAudioContext, src: string): Promise<AudioBuffer> {
  const response = await fetch(src);
  if (!response.ok) throw new Error(`Failed to fetch audio source: ${response.status}`);
  const bytes = await response.arrayBuffer();
  return await context.decodeAudioData(bytes.slice(0));
}

export async function renderPhoenixAudioMix(
  mix: PhoenixAudioMix,
  sampleRate = 48000,
): Promise<AudioBuffer> {
  const duration = audioMixDuration(mix);
  const frameCount = Math.max(1, Math.ceil(duration * sampleRate));
  const context = new OfflineAudioContext(2, frameCount, sampleRate);

  const soloTracks = mix.tracks.filter(track => track.solo);
  const audibleTracks = mix.tracks.filter(track => {
    if (track.muted) return false;
    return soloTracks.length === 0 || track.solo;
  });

  for (const track of audibleTracks) {
    for (const clip of track.clips) {
      if (clip.muted) continue;
      const buffer = await decodeAudio(context, clip.src);
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = Math.max(0.05, clip.playbackRate);

      const gain = context.createGain();
      const panner = context.createStereoPanner();
      panner.pan.value = clamp(clip.pan, -1, 1);

      const clipDuration = audioClipDuration(clip);
      const baseGain = clamp(track.volume, 0, 2) * clamp(clip.volume, 0, 2);
      const start = Math.max(0, clip.start);
      const end = start + clipDuration;
      const fadeIn = Math.min(Math.max(0, clip.fadeIn), clipDuration / 2);
      const fadeOut = Math.min(Math.max(0, clip.fadeOut), clipDuration / 2);

      gain.gain.setValueAtTime(fadeIn > 0 ? 0 : baseGain, start);
      if (fadeIn > 0) gain.gain.linearRampToValueAtTime(baseGain, start + fadeIn);
      if (fadeOut > 0) {
        gain.gain.setValueAtTime(baseGain, Math.max(start + fadeIn, end - fadeOut));
        gain.gain.linearRampToValueAtTime(0, end);
      } else {
        gain.gain.setValueAtTime(baseGain, end);
      }

      source.connect(gain).connect(panner).connect(context.destination);
      const sourceOffset = Math.max(0, Math.min(clip.inPoint, buffer.duration));
      const sourceSpan = Math.max(0.01, Math.min(clip.outPoint, buffer.duration) - sourceOffset);
      source.start(start, sourceOffset, sourceSpan);
    }
  }

  return await context.startRendering();
}

function writeString(view: DataView, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

export function encodeAudioBufferToWav(buffer: AudioBuffer): Blob {
  const channels = Math.min(2, buffer.numberOfChannels);
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const dataLength = buffer.length * blockAlign;
  const arrayBuffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(arrayBuffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  const channelData = Array.from({ length: channels }, (_, index) => buffer.getChannelData(index));
  let offset = 44;
  for (let frame = 0; frame < buffer.length; frame += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const sample = clamp(channelData[channel][frame] || 0, -1, 1);
      const pcm = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, Math.round(pcm), true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

export async function exportPhoenixAudioMixWav(mix: PhoenixAudioMix): Promise<Blob> {
  return encodeAudioBufferToWav(await renderPhoenixAudioMix(mix));
}

export function downloadAudioBlob(blob: Blob, title: string): void {
  const safeName = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'phoenix-audio';
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${safeName}.wav`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
