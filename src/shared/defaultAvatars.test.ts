import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_ABSTRACT_AVATARS,
  resolveProfileAvatarDisplay,
  selectDefaultAbstractAvatar,
} from './defaultAvatars.ts';

test('DEFAULT_ABSTRACT_AVATARS contains 4 unique studio avatar assets', () => {
  assert.equal(DEFAULT_ABSTRACT_AVATARS.length, 4);
  const ids = new Set(DEFAULT_ABSTRACT_AVATARS.map((a) => a.id));
  const srcs = new Set(DEFAULT_ABSTRACT_AVATARS.map((a) => a.src));
  assert.equal(ids.size, 4);
  assert.equal(srcs.size, 4);
  for (const avatar of DEFAULT_ABSTRACT_AVATARS) {
    assert.ok(avatar.src.startsWith('/src/assets/images/avatar_'));
    assert.ok(avatar.name.length > 0);
    assert.ok(avatar.description.length > 0);
  }
});

test('selectDefaultAbstractAvatar is deterministic and case-insensitive for the same user seed', () => {
  const first = selectDefaultAbstractAvatar('Maria@PromptFace.com.br');
  const second = selectDefaultAbstractAvatar('  maria@promptface.com.br  ');
  assert.equal(first.id, second.id);
  assert.equal(first.src, second.src);
});

test('selectDefaultAbstractAvatar falls back cleanly when seed is empty or null', () => {
  const fromNull = selectDefaultAbstractAvatar(null);
  const fromEmpty = selectDefaultAbstractAvatar('   ');
  assert.equal(fromNull.id, DEFAULT_ABSTRACT_AVATARS[0].id);
  assert.equal(fromEmpty.id, DEFAULT_ABSTRACT_AVATARS[0].id);
});

test('resolveProfileAvatarDisplay returns an abstract default avatar when faces array is empty', () => {
  const resolved = resolveProfileAvatarDisplay({
    faces: [],
    seed: 'user-no-photo@example.com',
    getMediaUrl: (path) => `/media${path}`,
  });

  assert.equal(resolved.isDefault, true);
  assert.ok(resolved.avatar !== null);
  assert.ok(resolved.src.startsWith('/src/assets/images/avatar_'));
  assert.ok(resolved.label.includes('Avatar padrão'));
});

test('resolveProfileAvatarDisplay automatically switches to uploaded face photo when present', () => {
  const resolved = resolveProfileAvatarDisplay({
    faces: [{ id: 'face-1', url: '/api/media/faces/user-1/selfie.jpg' }],
    seed: 'user-with-photo@example.com',
    getMediaUrl: (path) => `${path}?token=abc`,
  });

  assert.equal(resolved.isDefault, false);
  assert.equal(resolved.avatar, null);
  assert.equal(resolved.src, '/api/media/faces/user-1/selfie.jpg?token=abc');
  assert.equal(resolved.label, 'Foto de referência ativa');
});
