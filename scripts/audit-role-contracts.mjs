import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const base = new URL(process.env.ARENAPULSE_AUDIT_URL ?? 'http://127.0.0.1:18127');
const password = process.env.ARENAPULSE_DEMO_ACCOUNT_PASSWORD;
if (!['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname) || !password) {
  throw new Error('Run against a loopback local-demo instance with a disposable database and the demo password.');
}

const api = '/api/v1';
const tenant = '00000000-0000-0000-0000-000000000001';
const otherTenant = '00000000-0000-0000-0000-000000000002';
const missing = '00000000-0000-0000-0000-000000000042';
const runId = randomUUID().slice(0, 8);
const matrix = [];
const contracts = [];

async function request(method, path, { token, body, headers } = {}) {
  const res = await fetch(new URL(path, base), {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(12_000),
    redirect: 'manual',
  });
  const raw = await res.text();
  const data = res.headers.get('content-type')?.includes('/json') && raw ? JSON.parse(raw) : raw;
  return { status: res.status, data, headers: res.headers };
}

async function check(role, method, path, status, body, validate, headers) {
  const res = await request(method, api + path, { token: actors[role]?.accessToken, body, headers });
  matrix.push({ role, method, path, expected: status, status: res.status, passed: status === res.status });
  assert.equal(res.status, status, `${role} ${method} ${path} ${JSON.stringify(res.data).slice(0, 360)}`);
  validate?.(res.data, res.headers);
  return res.data;
}

const actors = {};
for (const [role, username] of Object.entries({
  USER: 'khach.thuesan', MANAGER: 'chusan.bachkhoa', STAFF: 'nhanvien.san01',
  ACCOUNTANT: 'ketoan.san', ADMIN: 'admin.arenapulse',
})) {
  actors[role] = await check('guest', 'POST', '/auth/login', 200, { username, password },
    (body) => assert(body.roles.some((grant) => grant.roleCode === role)));
}
for (const role of Object.keys(actors)) {
  await check(role, 'GET', '/users/me', 200, undefined, (body) => assert.equal(body.id, actors[role].userId));
}

const isList = body => assert(Array.isArray(body));
const actorPath = `?tenantId=${tenant}`;
const otherPath = `?tenantId=${otherTenant}`;
await check('guest', 'GET', '/bookings/my-tickets', 401);
await check('USER', 'GET', '/payments/history', 200, undefined, isList);
await check('MANAGER', 'GET', '/inventory/groups' + actorPath, 200, undefined, isList);
await check('MANAGER', 'GET', '/inventory/groups' + otherPath, 403);
await check('STAFF', 'GET', '/checkins/orders' + actorPath, 200, undefined, isList);
await check('STAFF', 'GET', '/checkins/orders' + otherPath, 403);
await check('USER', 'GET', '/checkins/orders' + actorPath, 403);
await check('STAFF', 'PATCH', `/tenants/${tenant}/settings`, 403, { isStaffChatEnabled: true });
await check('MANAGER', 'PATCH', `/tenants/${otherTenant}/settings`, 403, { isStaffChatEnabled: true });
await check('MANAGER', 'GET', '/analytics/lessor' + actorPath, 200, undefined,
  (body) => assert.equal(body.dataSource, 'POSTGRESQL_DB'));
await check('MANAGER', 'GET', '/analytics/lessor' + otherPath, 403);
await check('USER', 'GET', '/analytics/platform', 403);
await check('ADMIN', 'GET', '/analytics/platform', 200, undefined, (body) => {
  assert.equal(body.dataSource, 'POSTGRESQL_DB');
  assert.deepEqual(body.recentOrders, []);
});
await check('MANAGER', 'POST', '/analytics/reindex', 403);
await check('ACCOUNTANT', 'POST', '/analytics/reindex', 403);
await check('ACCOUNTANT', 'GET', '/finance/ledger', 200, undefined, (body) => assert(Array.isArray(body.content)));
await check('ACCOUNTANT', 'GET', '/finance/reconciliation', 200, undefined, (body) => assert(typeof body === 'object'));
await check('ACCOUNTANT', 'GET', '/payments/vietqr/review', 200, undefined, isList);
await check('USER', 'GET', '/finance/ledger', 403);
await check('STAFF', 'GET', '/payments/vietqr/review', 403);
await check('ACCOUNTANT', 'PATCH', `/admin/tenants/${tenant}/status`, 403, { status: 'ACTIVE' });
await check('ADMIN', 'GET', '/admin/rbac-matrix', 200, undefined, (body) => assert(typeof body === 'object'));
await check('ADMIN', 'GET', '/admin/users', 200, undefined, isList);
await check('USER', 'GET', '/admin/users', 403);
await check('ADMIN', 'GET', '/internal/lessor-applications', 200, undefined, isList);

const groupRequest = {
  tenantId: tenant, sportCode: 'PICKLEBALL', code: `QA_${runId.toUpperCase()}`, name: `Cụm kiểm thử ${runId}`,
  totalUnits: 2, basePrice: 180000, minPrice: 150000, maxPrice: 220000, slotMinutes: 60, depositPercent: 0,
  checkinMode: 'QR_STAFF',
};
await check('STAFF', 'POST', '/inventory/groups', 403, groupRequest);
await check('MANAGER', 'POST', '/inventory/groups', 403, { ...groupRequest, tenantId: otherTenant });
const group = await check('MANAGER', 'POST', '/inventory/groups', 201, groupRequest);
const groupId = group.id;
const start = new Date(Date.now() + 86_400_000);
start.setUTCMinutes(0, 0, 0);
const end = new Date(+start + 3_600_000);
const slotRequest = { groupId, slotStart: start.toISOString(), slotEnd: end.toISOString() };
await check('guest', 'GET', `/inventory/groups/${groupId}`, 404);
await check('STAFF', 'POST', '/inventory/slots', 403, slotRequest);
await check('MANAGER', 'POST', '/inventory/slots', 201, slotRequest);
await check('MANAGER', 'PATCH', `/inventory/groups/${groupId}/settings`, 204, {
  basePrice: 190000, addOnServices: [{ id: 'water', category: 'DRINKS', name: 'Nước', sportCode: 'PICKLEBALL',
    unitLabel: 'chai', unitPrice: 10000, maxQty: 2, enabled: true }],
});
await check('MANAGER', 'POST', `/inventory/groups/${groupId}/publish`, 200);
await check('guest', 'GET', '/listings', 200, undefined, (rows) => {
  const listing = rows.find(row => row.groupId === groupId);
  assert.equal(listing.basePrice, 190000);
  assert.equal(listing.addOnServices[0].unitPrice, 10000);
  assert.equal(listing.upcomingSlots[0].availableCourts, 2);
});

const customers = await Promise.all(Array.from({ length: 12 }, async (_, i) => {
  const username = `qa_${runId}_${i}`;
  const body = { username, password, email: `${username}@example.test`, firstName: 'QA', lastName: 'Customer' };
  await check('guest', 'POST', '/auth/register', 201, body);
  return check('guest', 'POST', '/auth/login', 200, { username, password });
}));
const quotes = await Promise.all(customers.map(({ accessToken }) =>
  request('GET', `${api}/pricing/quote?groupId=${groupId}&slotStart=${start.toISOString()}`, { token: accessToken })
));
assert(quotes.every(quote => quote.status === 200 && quote.data.priceLockToken));
assert.equal(new Set(quotes.map(quote => quote.data.priceLockToken)).size, quotes.length);
const holdRequests = quotes.map(({ data }, i) => ({
  ...slotRequest, userId: customers[i].userId, priceLockToken: data.priceLockToken, idempotencyKey: `qa-${runId}-${i}`,
}));
const holds = await Promise.all(customers.map(({ accessToken }, i) =>
  request('POST', api + '/bookings/hold', { token: accessToken, body: holdRequests[i] })
));
const winners = holds.map((row, i) => [row, i]).filter(([row]) => row.status === 201);
assert.equal(winners.length, 2);
assert(holds.every(row => [201, 409].includes(row.status)), JSON.stringify(holds.map(row => row.status)));
const [{ data: booked }, winner] = winners[0];
actors.WINNER = customers[winner];
await check('WINNER', 'POST', '/bookings/hold', 201, holdRequests[winner],
  (body) => assert.equal(body.reservationId, booked.reservationId));
await check('USER', 'GET', `/bookings/${booked.reservationId}/payment-status`, 403);
await check('WINNER', 'GET', `/bookings/${booked.reservationId}/payment-status`, 200, undefined,
  (body, headers) => {
    assert.notEqual(body.paymentStatus, 'VERIFIED');
    assert.equal(headers.get('cache-control'), 'no-store');
  });
const thread = await check('USER', 'POST', '/conversations', 201, { tenantId: tenant });
await check('USER', 'POST', '/conversations', 201, { tenantId: tenant }, body => assert.equal(body.id, thread.id));
await check('USER', 'POST', `/conversations/${thread.id}/messages`, 201, { body: 'Kiểm tra lịch sân' });
await check('STAFF', 'GET', `/conversations/${thread.id}/messages`, 200, undefined,
  rows => assert(rows.some(row => row.body === 'Kiểm tra lịch sân')));
await check('STAFF', 'POST', `/conversations/${thread.id}/messages`, 201, { body: 'Đã kiểm tra' });
await check('USER', 'GET', `/conversations/${thread.id}/messages`, 200, undefined,
  rows => assert(rows.some(row => row.body === 'Đã kiểm tra')));
await check('WINNER', 'GET', `/conversations/${thread.id}/messages`, 403);
await check('guest', 'GET', '/__missing__', 404);
await check('guest', 'DELETE', '/sport-types', 405);
await check('WINNER', 'POST', '/auth/logout', 204);
await check('WINNER', 'GET', '/users/me', 401);

const spec = (await request('GET', '/v3/api-docs')).data;
const methods = new Set(['get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'trace']);
for (const [path, routes] of Object.entries(spec.paths).filter(([path]) => path.startsWith(api))) {
  for (const [method, route] of Object.entries(routes).filter(([method]) => methods.has(method))) {
    const params = new URLSearchParams();
    for (const p of route.parameters ?? []) {
      if (p.in !== 'query' || !p.required || p.name === 'vnpParams') continue;
      params.set(p.name, p.schema.format === 'uuid' ? missing : p.name === 'end' ? end.toISOString() : start.toISOString());
    }
    const target = path.replace(/\{[^}]+\}/g, missing) + (params.size ? `?${params}` : '');
    const body = route.requestBody && method !== 'get' ? {} : undefined;
    const result = await request(method.toUpperCase(), target, { body });
    contracts.push({ method: method.toUpperCase(), path, status: result.status,
      response: typeof result.data === 'object' ? Object.keys(result.data ?? {}) : typeof result.data });
  }
}
const invalid = contracts.filter(({ status }) => status >= 500 || status === 405);
process.stdout.write(JSON.stringify({
  routeSmoke: contracts.length, roleChecks: matrix.length, concurrentHolds: holds.map(result => result.status),
  capacity: 2, matrix, contracts, unexpectedSmokeResults: invalid,
}, null, 2) + '\n');
assert.deepEqual(invalid, []);
