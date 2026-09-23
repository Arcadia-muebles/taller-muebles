import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

test('migrations preserve employee visibility and account audit under PostgreSQL RLS', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  // Supabase-provided auth/storage objects, with request identity supplied by
  // the test. Application tables, functions, grants and RLS are real migrations.
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;
    create table storage.buckets (id text primary key, name text, public boolean);
    create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(name text) returns text[] language sql immutable as
      $$ select string_to_array(name, '/') $$;
  `);
  const migrationDir = path.resolve('supabase/migrations');
  const migrations = (await readdir(migrationDir)).filter((name) => name.endsWith('.sql')).sort();
  for (const name of migrations) {
    const sql = (await readFile(path.join(migrationDir, name), 'utf8'))
      // gen_random_uuid is built into PostgreSQL; no other pgcrypto function is used.
      .replace('create extension if not exists pgcrypto;', '');
    try { await db.exec(sql); } catch (error) { throw new Error(`Migration ${name}: ${error.message}`, { cause: error }); }
  }
  t.diagnostic(`Applied ${migrations.length} migrations in order.`);
  await db.exec("insert into system_settings (id, value) values (true, '{}') on conflict (id) do nothing");
  const ids = Object.fromEntries(['admin', 'manager', 'cutting', 'upholstery', 'commercial', 'mixed', 'viewer'].map((name) => [name, crypto.randomUUID()]));
  const profiles = {};
  for (const [name, userId] of Object.entries(ids)) {
    await db.query('insert into auth.users values ($1)', [userId]);
    const role = ['admin', 'manager', 'viewer'].includes(name) ? name : 'operator';
    const area = name === 'mixed' ? 'module_commercial,cutting' : name === 'commercial' ? 'module_commercial' : name;
    const result = await db.query('insert into profiles (user_id, full_name, role, area, active) values ($1, $2, $3, $4, $5) returning id', [userId, name, role, area, role !== 'viewer']);
    profiles[name] = result.rows[0].id;
  }
  const storeId = (await db.query("select id from stores where code = 'LH'")).rows[0].id;
  const orders = {};
  for (const [name, documentType, status, area, stepStatus] of [
    ['independent', 'production_intake', 'scheduled', 'cutting', 'pending'],
    ['future', 'production_intake', 'scheduled', 'upholstery', 'pending'],
    ['history', 'production_intake', 'completed', 'cutting', 'done'],
    ['unrelated', 'production_intake', 'scheduled', 'quality', 'pending'],
    ['quote', 'quote', 'draft', 'cutting', 'pending'],
    ['commercial', 'sales_note', 'scheduled', 'cutting', 'pending'],
  ]) {
    const result = await db.query(`insert into orders
      (store_id, internal_code, sales_note_number, client_name, product_name, entry_date, document_type, status, created_by)
      values ($1,$2,$2,'QA','Sofá QA',current_date,$3,$4,$5) returning id`, [storeId, name, documentType, status, profiles.admin]);
    orders[name] = result.rows[0].id;
    await db.query(`insert into production_steps (order_id, step, step_label, sort_order, status, completed_at)
      values ($1, 'structure', 'Estructura', 1, 'pending', null), ($1,$2,$2,2,$3,$4)`,
    [orders[name], area, stepStatus, stepStatus === 'done' ? '2020-01-01T00:00:00Z' : null]);
  }
  async function as(name) {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [ids[name]]);
    await db.exec('set role authenticated');
  }
  const visible = async () => (await db.query('select internal_code from orders order by internal_code')).rows.map((row) => row.internal_code);
  await t.test('independent work and historical work remain visible', async () => {
    await as('cutting');
    assert.deepEqual(await visible(), ['commercial', 'history', 'independent']);
  });
  await t.test('planning can read future assigned work and its steps', async () => {
    await as('upholstery');
    assert.deepEqual(await visible(), ['future']);
    assert.equal((await db.query('select * from production_steps')).rows.length, 2);
  });
  await t.test('commercial and workshop permissions combine instead of replacing each other', async () => {
    await as('commercial');
    assert.deepEqual(await visible(), ['commercial', 'quote']);
    await as('mixed');
    assert.deepEqual(await visible(), ['commercial', 'history', 'independent', 'quote']);
  });
  await t.test('supervisors can inspect all work but cannot manage accounts', async () => {
    await as('manager');
    assert.equal((await visible()).length, 6);
    const result = await db.query('update profiles set active = false where id = $1 returning id', [profiles.cutting]);
    assert.equal(result.rows.length, 0);
  });
  await t.test('direct writes cannot bypass operator or supervisor production permissions', async () => {
    await as('cutting');
    const operatorWrite = await db.query("update production_steps set status = 'done', updated_by = $1 where order_id = $2 returning id", [profiles.cutting, orders.independent]);
    assert.equal(operatorWrite.rows.length, 0);
    await as('admin');
    await db.query("update system_settings set value = jsonb_set(value, '{permissions}', '{\"managersCanEditOrders\": false}') where id = true");
    await as('manager');
    assert.equal((await db.query("update production_steps set status = 'active', updated_by = $1 where order_id = $2 returning id", [profiles.manager, orders.independent])).rows.length, 0);
    assert.equal((await db.query("update orders set observations = 'bypass' where id = $1 returning id", [orders.independent])).rows.length, 0);
    await as('admin');
    await db.query("update system_settings set value = jsonb_set(value, '{permissions}', '{\"managersCanEditOrders\": true}') where id = true");
    await as('manager');
    assert.equal((await db.query("update production_steps set status = 'active', updated_by = $1 where order_id = $2 and step = 'cutting' returning id", [profiles.manager, orders.independent])).rows.length, 1);
  });
  await t.test('admin profile changes preserve identity, record actor, and revoke active access', async () => {
    await as('admin');
    await assert.rejects(db.query('update profiles set role = $1 where id = $2', ['manager', profiles.admin]), /administrador/);
    await db.query('update profiles set active = false where id = $1', [profiles.cutting]);
    const audit = await db.query("select profile_id, new_value from audit_logs where entity_id = $1 and action = 'update_user'", [profiles.cutting]);
    assert.equal(audit.rows.length, 1);
    assert.equal(audit.rows[0].profile_id, profiles.admin);
    assert.equal(JSON.parse(audit.rows[0].new_value).active, false);
    await as('cutting');
    assert.deepEqual(await visible(), []);
    await as('admin');
    await db.query('update profiles set active = true where id = $1', [profiles.cutting]);
    await as('cutting');
    assert.ok((await visible()).includes('independent'));
    await as('viewer');
    assert.deepEqual(await visible(), []);
  });
});
