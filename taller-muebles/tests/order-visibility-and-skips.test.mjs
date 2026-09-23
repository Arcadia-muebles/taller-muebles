import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, unlink, rmdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { loadApp } from './load-app.mjs';

test('omitted steps persist and supervisor projection excludes prices', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'arcadia-skips-test-'));
  process.env.NODE_ENV = 'test';
  process.env.LOCAL_DEMO_MODE = '1';
  process.env.LOCAL_DATA_DIR = directory;
  t.after(async () => {
    await unlink(path.join(directory, 'production.json'));
    await rmdir(directory);
  });

  const { load } = loadApp();
  const store = load('src/lib/local-store.ts');
  const repo = load('src/lib/repositories/production.ts');
  const access = load('src/lib/module-access.ts');
  const order = await store.createLocalOrder({
    store: 'LR', documentType: 'sales_note', salesNoteNumber: 'LR-QA-01',
    clientName: 'QA', productName: 'Sofá', material: 'Cuero', color: 'Azul',
    entryDate: '2026-09-23', deliveryDate: '2026-10-23', priority: 'normal',
    isWarranty: false, total: 120000, unitPrice: 120000,
    steps: [
      { key: 'structure', label: 'Estructura', enabled: true, required: true, targetDays: 1 },
      { key: 'cutting', label: 'Corte', enabled: true, required: true, targetDays: 1 },
    ],
    skippedStepKeys: ['structure'],
  });

  assert.equal(order.steps[0].status, 'done');
  assert.match(order.steps[0].notes, /Omitida/);
  assert.equal(order.steps[1].status, 'pending');
  assert.equal((await store.getLocalOrder(order.id)).steps[0].status, 'done');
  const visible = await repo.getWorkshopOrder(order.id);
  assert.equal(visible.total, undefined);
  assert.equal(visible.unitPrice, undefined);
  assert.equal(access.canAccessModule({ role: 'manager' }, 'commercial'), false);
});
