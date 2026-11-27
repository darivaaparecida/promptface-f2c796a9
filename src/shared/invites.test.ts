import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INVITE_CODE_LENGTH,
  buildInviteLink,
  buildInviteShareMessage,
  isValidInviteCode,
  normalizeInviteCode,
} from './invites';

test('isValidInviteCode accepts 8 chars from the unambiguous alphabet', () => {
  assert.equal(isValidInviteCode('ABCDEFGH'), true);
  assert.equal(isValidInviteCode('abcd2345'), true);
  assert.equal(isValidInviteCode('  KLMN5678  '), true);
  assert.equal(isValidInviteCode('ABCDEFG'), false);
  assert.equal(isValidInviteCode('ABCDEFGHI'), false);
  assert.equal(isValidInviteCode('ABCD1FGH'), false);
  assert.equal(isValidInviteCode('ABCDOFGH'), false);
  assert.equal(isValidInviteCode('EXEMPLO1'), false);
  assert.equal(isValidInviteCode(''), false);
  assert.equal(isValidInviteCode(null), false);
  assert.equal(isValidInviteCode(undefined), false);
  assert.equal(INVITE_CODE_LENGTH, 8);
});

test('normalizeInviteCode uppercases and trims, or returns null', () => {
  assert.equal(normalizeInviteCode('abcd2345'), 'ABCD2345');
  assert.equal(normalizeInviteCode('  klmn5678 '), 'KLMN5678');
  assert.equal(normalizeInviteCode('curto'), null);
  assert.equal(normalizeInviteCode(null), null);
});

test('buildInviteLink and buildInviteShareMessage use the public URL', () => {
  const link = buildInviteLink('abcd2345');
  assert.equal(link, 'https://www.promptface.com.br/convite/ABCD2345');
  const message = buildInviteShareMessage(link);
  assert.ok(message.includes(link));
  assert.ok(message.includes('PromptFace'));
});
