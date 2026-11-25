import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ARTISTIC_FILTERS,
  SOCIAL_EXPORT_FORMATS,
  buildDownloadFilename,
  calculateCoverCropRect,
  getExtensionFromMime,
} from './artisticFilters';

test('artistic filters list includes original, bw, vintage, and cinematic presets', () => {
  const ids = ARTISTIC_FILTERS.map((f) => f.id);
  assert.ok(ids.includes('original'));
  assert.ok(ids.includes('bw'));
  assert.ok(ids.includes('vintage'));
  assert.ok(ids.includes('cinematic'));
  assert.equal(ARTISTIC_FILTERS.length >= 4, true);
});

test('social export formats include original, stories 9:16, feed 4:5, and square 1:1', () => {
  const ids = SOCIAL_EXPORT_FORMATS.map((f) => f.id);
  assert.deepEqual(ids, ['original', 'stories', 'instagram', 'square']);
});

test('calculateCoverCropRect crops horizontally when source is wider than target ratio', () => {
  const crop = calculateCoverCropRect(1600, 900, 1);
  assert.equal(crop.sw, 900);
  assert.equal(crop.sh, 900);
  assert.equal(crop.sx, 350);
  assert.equal(crop.sy, 0);
});

test('calculateCoverCropRect crops vertically with upper portrait bias when source is taller', () => {
  const crop = calculateCoverCropRect(1000, 2000, 1);
  assert.equal(crop.sw, 1000);
  assert.equal(crop.sh, 1000);
  assert.equal(crop.sx, 0);
  assert.equal(crop.sy, 350);
});

test('buildDownloadFilename sanitizes Portuguese accents and appends filter and format suffixes', () => {
  assert.equal(
    buildDownloadFilename('Pôr do Sol em São Paulo', 'gen-1', 'original', 'png'),
    'promptface-por-do-sol-em-sao-paulo.png'
  );
  assert.equal(
    buildDownloadFilename('Cinematográfico Urbano', 'gen-2', 'cinematic', 'jpg'),
    'promptface-cinematografico-urbano-cinematic.jpg'
  );
  assert.equal(
    buildDownloadFilename('Editorial Paris', 'gen-3', 'bw', 'jpg', 'stories'),
    'promptface-editorial-paris-bw-stories.jpg'
  );
});

test('getExtensionFromMime maps standard image mime types cleanly', () => {
  assert.equal(getExtensionFromMime('image/jpeg'), 'jpg');
  assert.equal(getExtensionFromMime('image/webp'), 'webp');
  assert.equal(getExtensionFromMime('image/png'), 'png');
});
