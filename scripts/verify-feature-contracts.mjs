import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const directory = join(root, 'contracts', 'features');
const [requestedBranch, ...unexpectedArguments] = process.argv.slice(2);
assert.equal(unexpectedArguments.length, 0, 'Specify at most one service branch name.');

const specPath = process.env.ARENAPULSE_OPENAPI_FILE;
const openApi = specPath ? JSON.parse(await readFile(specPath, 'utf8')) : undefined;
const methods = new Set(['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'HEAD', 'OPTIONS', 'TRACE']);
const verifiedOperations = new Set();
let verifiedFeatures = 0;

const files = (await readdir(directory, { recursive: true, withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
  .map((entry) => join(entry.parentPath, entry.name))
  .sort();

for (const file of files) {
  const branch = 'service/' + relative(directory, file).slice(0, -'.json'.length).replaceAll('\\', '/');
  if (requestedBranch && branch !== requestedBranch) continue;
  const contract = JSON.parse(await readFile(file, 'utf8'));
  assert.match(branch, /^service\/(?:admin|accountant|customer|lessor|shared|staff)\/[a-z0-9-]+(?:\/[a-z0-9-]+)?$/);
  assert.equal(contract.branch, branch);
  assert(contract.title?.trim() && contract.scope?.trim(), `${branch}: missing title or scope`);
  assert(contract.operations?.length && contract.source?.length, `${branch}: missing operations or source`);

  for (const { file: source, anchors } of contract.source) {
    assert(source.startsWith('src/main/') || source.startsWith('frontend/src/'), `${branch}: invalid source ${source}`);
    assert(!source.split('/').includes('..'), `${branch}: source must be inside the repository`);
    const code = await readFile(join(root, source), 'utf8');
    assert(anchors?.length, `${branch}: missing anchors in ${source}`);
    for (const anchor of anchors) {
      assert(code.includes(anchor), `${branch}: missing ${JSON.stringify(anchor)} in ${source}`);
    }
  }

  for (const { path, method, operationId } of contract.operations) {
    const key = `${method} ${path}`;
    assert(methods.has(method) && path.startsWith('/api/v1/') && operationId, `${branch}: invalid operation ${key}`);
    if (openApi) {
      const actual = openApi.paths[path]?.[method.toLowerCase()]?.operationId;
      assert(actual === operationId || actual?.replace(/_\d+$/, '') === operationId,
        `${branch}: ${key} expected ${operationId}, got ${actual ?? 'no operation'}`);
    }
    verifiedOperations.add(key);
  }
  verifiedFeatures++;
}

assert(verifiedFeatures > 0, requestedBranch ? `Unknown service branch: ${requestedBranch}` : 'No feature contracts found.');
console.log(`Verified ${verifiedFeatures} feature contracts and ${verifiedOperations.size} distinct operations${openApi ? ' against OpenAPI' : ' in the catalogue'}.`);

if (openApi && !requestedBranch && process.env.ARENAPULSE_REQUIRE_FULL_COVERAGE === '1') {
  const uncovered = Object.entries(openApi.paths).flatMap(([path, operations]) =>
    path.startsWith('/api/v1/') ? Object.keys(operations)
      .map((method) => method.toUpperCase())
      .filter((method) => methods.has(method))
      .map((method) => `${method} ${path}`)
      .filter((key) => !verifiedOperations.has(key)) : []
  );
  assert.deepEqual(uncovered.sort(), [], 'Missing feature coverage for these OpenAPI operations.');
}
