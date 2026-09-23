import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, unlink, rmdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { loadApp } from './load-app.mjs';

const form = (values) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    for (const item of Array.isArray(value) ? value : [value]) data.append(key, String(item));
  }
  return data;
};

test('employee onboarding, permissions, production and account lifecycle', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'arcadia-employee-test-'));
  process.env.NODE_ENV = 'test';
  process.env.LOCAL_DEMO_MODE = '1';
  process.env.LOCAL_DATA_DIR = directory;
  t.after(async () => {
    await unlink(path.join(directory, 'production.json'));
    await rmdir(directory);
  });
  const { load } = loadApp();
  const auth = load('src/lib/auth.ts');
  const store = load('src/lib/local-store.ts');
  const accounts = load('src/app/admin/users/actions.ts');
  const production = load('src/app/taller/actions.ts');
  const repo = load('src/lib/repositories/production.ts');
  const access = load('src/lib/workshop-access.ts');
  const admin = await store.getLocalUserByEmail('admin@taller.local');
  await auth.signInLocal(admin);
  const employee = { name: 'QA Employee', email: 'QA.Employee@example.test', role: 'operator', areas: ['cutting', 'sewing'] };

  await t.test('reject missing or fabricated areas and normalize unique emails', async () => {
    assert.equal((await accounts.createUser(form({ ...employee, areas: [] }))).ok, false);
    assert.equal((await accounts.createUser(form({ ...employee, areas: ['invented_area'] }))).ok, false);
    assert.equal((await accounts.createUser(form(employee))).ok, true);
    assert.equal((await accounts.createUser(form({ ...employee, name: 'Overwrite', email: employee.email.toLowerCase() }))).ok, false);
    assert.equal((await store.getLocalUserByEmail(employee.email)).name, employee.name);
  });
  const worker = await store.getLocalUserByEmail(employee.email);
  await t.test('commercial-only employees land in their module, mixed employees in the workshop', () => {
    assert.equal(auth.dashboardPathForRole('operator', { areas: ['module_commercial'] }), '/admin/documents');
    assert.equal(auth.dashboardPathForRole('operator', { areas: ['module_commercial', 'cutting'] }), '/taller');
  });
  await t.test('self demotion and deactivation are rejected', async () => {
    assert.equal((await accounts.updateUser(form({ userId: admin.id, name: admin.name, role: 'manager' }))).ok, false);
    assert.equal((await accounts.setUserActive(form({ userId: admin.id, active: false }))).ok, false);
  });
  await t.test('operator login resolves assigned processes and blocks administration', async () => {
    await auth.signInLocal(worker);
    assert.deepEqual((await auth.getSessionUser()).areas, ['cutting', 'sewing']);
    await assert.rejects(accounts.createUser(form({ ...employee, email: 'other@example.test' })), /REDIRECT:\/taller/);
    await assert.rejects(auth.requireSession(['admin', 'manager']), /REDIRECT:\/taller/);
  });

  const order = {
    id: crypto.randomUUID(), code: 'LHQA01', groupCode: 'LHQA01', store: 'LH', documentType: 'production_intake',
    documentStatus: 'issued', client: 'QA only', product: 'Sofá QA', material: 'Cuero', color: 'Azul', includesVat: true,
    status: 'scheduled', condition: 'Sin condicion', priority: 'normal', isWarranty: false,
    entryDate: '2026-09-21', deliveryDate: '2026-10-01', assignedTo: 'QA', observations: 'Prueba aislada',
    customerEmail: 'private@example.test', total: 999999, balance: 1234,
    steps: ['structure', 'en_blanco', 'cutting', 'sewing', 'upholstery', 'quality', 'dispatch'].map((key) => ({ key, label: key, owner: 'QA', status: 'pending' })),
  };
  async function persistOrder(value) {
    const filename = path.join(directory, 'production.json');
    const data = JSON.parse(await readFile(filename, 'utf8'));
    data.orders = [value];
    await writeFile(filename, JSON.stringify(data));
  }
  await persistOrder(order);
  const change = (stepKey, status, reason) => production.updateProductionStep({ orderId: order.id, stepKey, status, reason });
  await t.test('independent areas operate, foreign areas and skipped transitions fail', async () => {
    assert.equal((await change('upholstery', 'active')).status, 'error');
    assert.equal((await change('cutting', 'done')).status, 'error');
    assert.equal((await change('cutting', 'active')).status, 'success');
    assert.equal((await change('cutting', 'blocked', 'Falta material')).status, 'error');
    const settings = await store.getLocalSystemSettings();
    settings.permissions.operatorsCanBlockSteps = true;
    await store.saveLocalSystemSettings(settings);
    assert.equal((await change('cutting', 'blocked')).status, 'error');
    assert.equal((await change('cutting', 'blocked', 'Falta material')).status, 'success');
    assert.equal((await change('cutting', 'active')).status, 'success');
    assert.equal((await change('cutting', 'done')).status, 'success');
    const saved = await store.getLocalOrder(order.id);
    assert.equal(saved.steps.find((s) => s.key === 'cutting').status, 'done');
    assert.equal(saved.steps.find((s) => s.key === 'structure').status, 'pending');
  });
  await t.test('closed orders and expired reversals cannot mutate', async () => {
    for (const status of ['cancelled', 'completed']) {
      await persistOrder({ ...order, status });
      assert.equal((await change('cutting', 'active')).status, 'error');
      assert.equal(access.workerActionStep(worker, { ...order, status }), undefined);
    }
    await persistOrder({ ...order, steps: order.steps.map((s) => s.key === 'cutting' ? { ...s, status: 'done', completedAt: '2020-01-01T00:00:00Z' } : s) });
    assert.equal((await change('cutting', 'pending')).status, 'error');
  });
  await t.test('planning and history remain visible, commercial values never reach workshop', async () => {
    const futureUser = { role: 'operator', name: 'QA', areas: ['upholstery'] };
    assert.equal(access.filterWorkerFutureOrders(futureUser, [order]).length, 1);
    assert.equal(access.workerActionStep(futureUser, order), undefined);
    assert.equal(access.workerActionStep({ ...futureUser, allowParallelSteps: true }, order).key, 'upholstery');
    const history = { ...order, steps: order.steps.map((s) => s.key === 'cutting' ? { ...s, status: 'done', completedAt: '2020-01-01T00:00:00Z' } : s) };
    assert.equal(access.filterWorkerHistoryOrders(worker, [history]).length, 1);
    assert.equal(access.filterWorkerHistoryOrders(worker, [{ ...history, status: 'cancelled' }]).length, 0);
    const projected = (await repo.listWorkshopOrders())[0];
    for (const key of ['total', 'balance', 'customerEmail', 'payments']) assert.equal(key in projected, false);
  });
  await t.test('supervisor permissions are enforced by the server', async () => {
    const manager = await store.getLocalUserByEmail('supervisor@taller.local');
    await auth.signInLocal(manager);
    await assert.rejects(accounts.setUserActive(form({ userId: worker.id, active: false })), /REDIRECT:\/admin/);
    await persistOrder(order);
    const settings = await store.getLocalSystemSettings();
    settings.permissions.managersCanEditOrders = false;
    await store.saveLocalSystemSettings(settings);
    assert.equal((await change('cutting', 'active')).status, 'error');
    settings.permissions.managersCanEditOrders = true;
    await store.saveLocalSystemSettings(settings);
    assert.equal((await change('cutting', 'active')).status, 'success');
  });
  await t.test('deactivation revokes existing session; reactivation preserves identity and audit', async () => {
    await auth.signInLocal(admin);
    assert.equal((await accounts.setUserActive(form({ userId: worker.id, active: false }))).ok, true);
    await auth.signInLocal(worker);
    assert.equal(await auth.getSessionUser(), null);
    await auth.signInLocal(admin);
    assert.equal((await accounts.setUserActive(form({ userId: worker.id, active: true }))).ok, true);
    const reactivated = await store.getLocalUserByEmail(employee.email);
    assert.equal(reactivated.id, worker.id);
    assert.deepEqual(reactivated.areas, worker.areas);
    assert.equal((await accounts.updateUser(form({ userId: worker.id, name: worker.name, role: 'manager' }))).ok, true);
    await auth.signInLocal(worker);
    assert.equal((await auth.getSessionUser()).role, 'manager');
    const data = JSON.parse(await readFile(path.join(directory, 'production.json'), 'utf8'));
    assert.ok(data.auditLogs.some((a) => a.action === 'deactivate_user' && a.summary.includes(admin.id)));
  });
});
