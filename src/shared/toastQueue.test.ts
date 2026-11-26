import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_TOAST_DURATION_MS,
  MAX_VISIBLE_TOASTS,
  dismissToast,
  enqueueToast,
  type ToastItem,
} from './toastQueue';

test('enqueueToast adds toast with normalized fields and default duration', () => {
  const { queue, item } = enqueueToast(
    [],
    {
      id: 't-1',
      title: '  Imagem gerada com sucesso  ',
      description: '  Salva em Meu Espaço  ',
    },
    1000
  );

  assert.equal(queue.length, 1);
  assert.equal(item.id, 't-1');
  assert.equal(item.variant, 'success');
  assert.equal(item.title, 'Imagem gerada com sucesso');
  assert.equal(item.description, 'Salva em Meu Espaço');
  assert.equal(item.durationMs, DEFAULT_TOAST_DURATION_MS);
  assert.equal(item.createdAt, 1000);
});

test('enqueueToast caps visible queue at MAX_VISIBLE_TOASTS keeping newest items', () => {
  let queue: ToastItem[] = [];
  for (let i = 1; i <= MAX_VISIBLE_TOASTS + 2; i++) {
    queue = enqueueToast(queue, { id: `t-${i}`, title: `Toast ${i}` }, 1000 + i).queue;
  }

  assert.equal(queue.length, MAX_VISIBLE_TOASTS);
  assert.deepEqual(
    queue.map((t) => t.id),
    ['t-3', 't-4', 't-5', 't-6']
  );
});

test('dismissToast removes matching toast without mutating input array', () => {
  const first = enqueueToast([], { id: 'a', title: 'A' }, 100).queue;
  const both = enqueueToast(first, { id: 'b', title: 'B', variant: 'info' }, 200).queue;
  const after = dismissToast(both, 'a');

  assert.equal(both.length, 2);
  assert.deepEqual(
    after.map((t) => t.id),
    ['b']
  );
});
