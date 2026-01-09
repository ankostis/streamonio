import assert from 'node:assert';
import test from 'node:test';
import { getStreamType, isStreamUrl } from '../../src/detect';

test('detects HLS by extension', () => {
  assert.strictEqual(isStreamUrl('https://example.com/live.m3u8'), true);
  assert.strictEqual(getStreamType('https://example.com/live.m3u8'), 'HLS');
});

test('detects DASH by extension', () => {
  assert.strictEqual(isStreamUrl('https://example.com/manifest.mpd'), true);
  assert.strictEqual(getStreamType('https://example.com/manifest.mpd'), 'DASH');
});

test('detects HTTP audio', () => {
  assert.strictEqual(
    isStreamUrl('https://cdn.example.com/audio.mp3?x=1'),
    true,
  );
  assert.strictEqual(
    getStreamType('https://cdn.example.com/audio.mp3?x=1'),
    'HTTP Audio',
  );
});

test('rejects non-stream URLs', () => {
  assert.strictEqual(isStreamUrl('https://example.com/page.html'), false);
});

test('protocol-based radio detection patterns', () => {
  assert.strictEqual(isStreamUrl('rtmp://radio.example.com/live'), true);
  assert.strictEqual(isStreamUrl('rtsp://radio.example.com/live'), true);
});
test('detects icecast streams: LifeGate Radio', () => {
  // Real-world test case: https://www.lifegate.it/lifegate-radio
  //
  // Page structure:
  //   lifegate.it/lifegate-radio (parent)
  //     └─ <iframe src="https://play.xdevel.com/12650/..."> (cross-origin)
  //          └─ <doz-router><dz-mount><x-controller><x-player> (Shadow DOM)
  //               └─ <video src="https://router.xdevel.com/.../icecast.audio">
  //
  // Element added dynamically when user clicks play button
  // Requires: 1) manifest.json "all_frames": true for iframes
  //           2) page.ts getAllMediaElements() for Shadow DOM traversal
  //
  // These URLs are valid Icecast streams (Content-Type: audio/mpeg, icy-* headers)
  // Pattern 3 matches: /^(https?|rtmp|rtsp|mms):\/\/.*(stream|radio|live|cast|audio|podcast)/i
  // Pattern 4 matches: /\/(listen|stream|;\?|dyn\/)\/?.*/i
  const lifegateUrl1 =
    'https://stream3.xdevel.com/audio0s975809-424/stream/icecast.audio';
  const lifegateUrl2 =
    'https://router.xdevel.com/audio0s975809-345/stream/icecast.audio';

  assert.strictEqual(
    isStreamUrl(lifegateUrl1),
    true,
    'LifeGate stream 1 should be detected',
  );
  assert.strictEqual(
    isStreamUrl(lifegateUrl2),
    true,
    'LifeGate stream 2 should be detected',
  );
  assert.strictEqual(
    getStreamType(lifegateUrl1),
    'Icecast/Shoutcast',
    'Should be classified as Icecast',
  );
});
