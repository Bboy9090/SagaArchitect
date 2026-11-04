import assert from 'node:assert/strict';
import test from 'node:test';
import {
  activeCaptionAt,
  addClipToTimeline,
  clipPlaybackRateAt,
  clipSourceTimeAt,
  clipTransitionOpacity,
  clipTransformAt,
  createPhoenixVideoTimeline,
  isTimelineTrackActive,
  moveTimelineClip,
  splitTimelineClip,
  timelineClipDuration,
  timelineDuration,
  trimTimelineClipAt,
} from '../src/lib/video-timeline.ts';

test('video timeline starts with video and audio tracks', () => {
  const timeline = createPhoenixVideoTimeline('project-1');
  assert.equal(timeline.tracks.length, 2);
  assert.deepEqual(timeline.tracks.map(track => track.kind), ['video', 'audio']);
});

test('clip duration honors trim points and playback rate', () => {
  const clip = {
    id: 'clip-1',
    trackId: 'track-1',
    name: 'clip',
    src: '/clip.mp4',
    mimeType: 'video/mp4',
    kind: 'video',
    start: 0,
    sourceDuration: 12,
    inPoint: 2,
    outPoint: 10,
    playbackRate: 2,
    volume: 1,
    muted: false,
    createdAt: new Date().toISOString(),
  };
  assert.equal(timelineClipDuration(clip), 4);
});

test('adding a clip extends the timeline duration', () => {
  let timeline = createPhoenixVideoTimeline('project-2');
  timeline = addClipToTimeline(timeline, {
    assetId: 'asset-1',
    name: 'Shot',
    src: '/shot.mp4',
    mimeType: 'video/mp4',
    kind: 'video',
    start: 3,
    sourceDuration: 5,
    inPoint: 0,
    outPoint: 5,
    playbackRate: 1,
    volume: 1,
    muted: false,
  });
  assert.equal(timelineDuration(timeline), 8);
});

test('split preserves total trimmed source range and creates two clips', () => {
  let timeline = createPhoenixVideoTimeline('project-3');
  timeline = addClipToTimeline(timeline, {
    name: 'Shot',
    src: '/shot.mp4',
    mimeType: 'video/mp4',
    kind: 'video',
    start: 2,
    sourceDuration: 10,
    inPoint: 1,
    outPoint: 9,
    playbackRate: 1,
    volume: 1,
    muted: false,
  });
  const original = timeline.tracks[0].clips[0];
  timeline = splitTimelineClip(timeline, original.id, 6);
  const clips = timeline.tracks[0].clips;
  assert.equal(clips.length, 2);
  assert.equal(clips[0].outPoint, 5);
  assert.equal(clips[1].inPoint, 5);
  assert.equal(clips[1].start, 6);
  assert.equal(timelineClipDuration(clips[0]) + timelineClipDuration(clips[1]), 8);
});

test('split outside clip interior is a no-op', () => {
  let timeline = createPhoenixVideoTimeline('project-4');
  timeline = addClipToTimeline(timeline, {
    name: 'Still',
    src: '/still.png',
    mimeType: 'image/png',
    kind: 'image',
    start: 0,
    sourceDuration: 5,
    inPoint: 0,
    outPoint: 5,
    playbackRate: 1,
    volume: 1,
    muted: false,
  });
  const clip = timeline.tracks[0].clips[0];
  const same = splitTimelineClip(timeline, clip.id, 0);
  assert.equal(same.tracks[0].clips.length, 1);
});


test('caption lookup returns the active timed cue', () => {
  const timeline = createPhoenixVideoTimeline('project-caption');
  timeline.captions.push({
    id: 'caption-1',
    text: 'Hello',
    start: 1,
    end: 3,
    position: 'bottom',
    fontSize: 40,
    color: '#fff',
    background: '#000',
  });
  assert.equal(activeCaptionAt(timeline, 2)?.text, 'Hello');
  assert.equal(activeCaptionAt(timeline, 4), null);
});

test('fade transitions calculate bounded opacity', () => {
  let timeline = createPhoenixVideoTimeline('project-fade');
  timeline = addClipToTimeline(timeline, {
    name: 'Fade',
    src: '/fade.mp4',
    mimeType: 'video/mp4',
    kind: 'video',
    start: 2,
    sourceDuration: 6,
    inPoint: 0,
    outPoint: 6,
    playbackRate: 1,
    volume: 1,
    muted: false,
    transitionIn: 'fade',
    transitionOut: 'fade',
    transitionDuration: 1,
  });
  const clip = timeline.tracks[0].clips[0];
  assert.equal(clipTransitionOpacity(clip, 2), 0);
  assert.ok(clipTransitionOpacity(clip, 2.5) > 0.45 && clipTransitionOpacity(clip, 2.5) < 0.55);
  assert.equal(clipTransitionOpacity(clip, 5), 1);
  assert.ok(clipTransitionOpacity(clip, 7.5) > 0.45 && clipTransitionOpacity(clip, 7.5) < 0.55);
});

test('transform keyframes interpolate linearly at the playhead', () => {
  let timeline = createPhoenixVideoTimeline('project-keyframes');
  timeline = addClipToTimeline(timeline, {
    name: 'Move',
    src: '/move.png',
    mimeType: 'image/png',
    kind: 'image',
    start: 1,
    sourceDuration: 5,
    inPoint: 0,
    outPoint: 5,
    playbackRate: 1,
    volume: 1,
    muted: false,
    transform: { scale: 1, x: 0, y: 0, rotation: 0 },
    keyframes: [
      { time: 0, transform: { scale: 1, x: 0, y: 0, rotation: 0 } },
      { time: 4, transform: { scale: 2, x: 100, y: 40, rotation: 20 } },
    ],
  });
  const clip = timeline.tracks[0].clips[0];
  const transform = clipTransformAt(clip, 3);
  assert.equal(transform.scale, 1.5);
  assert.equal(transform.x, 50);
  assert.equal(transform.y, 20);
  assert.equal(transform.rotation, 10);
});


test('track mute and solo resolve active lanes by media kind', () => {
  let timeline = createPhoenixVideoTimeline('project-track-controls');
  const firstVideo = timeline.tracks.find(track => track.kind === 'video');
  timeline.tracks.push({
    id: 'video-2',
    name: 'Video 2',
    kind: 'video',
    muted: false,
    solo: true,
    locked: false,
    order: 2,
    clips: [],
  });
  assert.equal(isTimelineTrackActive(timeline, firstVideo), false);
  assert.equal(isTimelineTrackActive(timeline, timeline.tracks.find(track => track.id === 'video-2')), true);
  timeline.tracks.find(track => track.id === 'video-2').muted = true;
  assert.equal(isTimelineTrackActive(timeline, firstVideo), true);
});

test('locked tracks reject shared clip move operations', () => {
  let timeline = createPhoenixVideoTimeline('project-track-lock');
  timeline = addClipToTimeline(timeline, {
    name: 'Locked Shot',
    src: '/locked.mp4',
    mimeType: 'video/mp4',
    kind: 'video',
    start: 1,
    sourceDuration: 5,
    inPoint: 0,
    outPoint: 5,
    playbackRate: 1,
    volume: 1,
    muted: false,
  });
  const track = timeline.tracks.find(item => item.kind === 'video');
  const clip = track.clips[0];
  track.locked = true;
  const moved = moveTimelineClip(timeline, clip.id, 4);
  assert.equal(moved.tracks.find(item => item.id === track.id).clips[0].start, 1);
});

test('speed ramps preserve trim endpoints while changing source velocity', () => {
  let timeline = createPhoenixVideoTimeline('project-speed-ramp');
  timeline = addClipToTimeline(timeline, {
    name: 'Ramp',
    src: '/ramp.mp4',
    mimeType: 'video/mp4',
    kind: 'video',
    start: 0,
    sourceDuration: 10,
    inPoint: 0,
    outPoint: 10,
    playbackRate: 1,
    volume: 1,
    muted: false,
  });
  const clip = timeline.tracks.find(track => track.kind === 'video').clips[0];
  clip.speedKeyframes = [
    { progress: 0.5, rate: 2, easing: 'linear' },
  ];
  assert.equal(clipSourceTimeAt(clip, 0), 0);
  assert.ok(Math.abs(clipSourceTimeAt(clip, 10) - 10) < 0.001);
  assert.ok(clipSourceTimeAt(clip, 2.5) < 2.5);
  assert.ok(clipSourceTimeAt(clip, 7.5) > 7.5);
  assert.ok(clipPlaybackRateAt(clip, 5) > 1);
});


test('speed-ramped split preserves the exact timeline edit point', () => {
  let timeline = createPhoenixVideoTimeline('project-speed-split');
  timeline = addClipToTimeline(timeline, {
    name: 'Ramp Split',
    src: '/ramp-split.mp4',
    mimeType: 'video/mp4',
    kind: 'video',
    start: 0,
    sourceDuration: 10,
    inPoint: 0,
    outPoint: 10,
    playbackRate: 1,
    volume: 1,
    muted: false,
  });
  const clip = timeline.tracks.find(track => track.kind === 'video').clips[0];
  clip.speedKeyframes = [{ progress: 0.5, rate: 2, easing: 'linear' }];
  timeline = splitTimelineClip(timeline, clip.id, 4);
  const clips = timeline.tracks.find(track => track.kind === 'video').clips;
  assert.equal(clips.length, 2);
  assert.ok(Math.abs(timelineClipDuration(clips[0]) - 4) < 0.001);
  assert.ok(Math.abs(timelineClipDuration(clips[1]) - 6) < 0.001);
  assert.equal(clips[1].start, 4);
});

test('speed-ramped trim preserves the requested timeline edge', () => {
  let timeline = createPhoenixVideoTimeline('project-speed-trim');
  timeline = addClipToTimeline(timeline, {
    name: 'Ramp Trim',
    src: '/ramp-trim.mp4',
    mimeType: 'video/mp4',
    kind: 'video',
    start: 0,
    sourceDuration: 10,
    inPoint: 0,
    outPoint: 10,
    playbackRate: 1,
    volume: 1,
    muted: false,
  });
  const clip = timeline.tracks.find(track => track.kind === 'video').clips[0];
  clip.speedKeyframes = [{ progress: 0.5, rate: 2, easing: 'linear' }];
  const trimmedOut = trimTimelineClipAt(timeline, clip.id, 4, 'out', false);
  assert.ok(Math.abs(timelineClipDuration(trimmedOut.tracks[0].clips[0]) - 4) < 0.001);

  const trimmedIn = trimTimelineClipAt(timeline, clip.id, 4, 'in', false);
  assert.ok(Math.abs(trimmedIn.tracks[0].clips[0].start - 4) < 0.001);
  assert.ok(Math.abs(timelineClipDuration(trimmedIn.tracks[0].clips[0]) - 6) < 0.001);
});
