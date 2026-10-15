import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const link = await server.ssrLoadModule('/src/linkImport.ts');
  const decoder = new TextDecoder();
  const payload = {
    v: 1,
    name: 'dsv4 PD c4',
    run: '38678956785',
    source: 'https://github.com/o/r/actions/runs/38678956785',
    files: [{ name: 'agg_bmk.json', text: JSON.stringify([{ conc: 4, model: 'dsv4' }]) }]
  };

  const encoded = link.encodeLinkImport(payload);
  assert.match(encoded, /^[A-Za-z0-9_-]+$/u, 'base64url without padding');
  const decoded = link.readLinkImport(`#/inferencex?${link.LINK_IMPORT_PARAM}=${encoded}`);
  assert.deepEqual(
    { name: decoded.name, runId: decoded.runId, source: decoded.source },
    { name: payload.name, runId: payload.run, source: payload.source }
  );
  assert.equal(decoded.files.length, 1);
  assert.equal(decoded.files[0].name, 'agg_bmk.json');
  assert.equal(decoder.decode(decoded.files[0].bytes), payload.files[0].text);

  // Produced by Python: zlib.compressobj(9, zlib.DEFLATED, -15) + base64.urlsafe_b64encode, padding stripped.
  const fromPython =
    'NYzBCsMgEER_pew5ZGnJyV9JQjFijG11i7uGgPjvtYHcZubxpsAO6t5B1MGCgtUfkpOFDlKOrQ-PFplyMn-6iXxZITovW156QwEJE2ojniJjUxhPY_Ufy6DGcv1q555LePcvpti42EPaOpYJDEUzgboNdYY61x8';
  const python = link.decodeLinkImport(fromPython);
  assert.equal(python.runId, '42');
  assert.equal(decoder.decode(python.files[0].bytes), '[{"conc": 4}]');

  assert.equal(link.readLinkImport('#/inferencex'), null);
  assert.equal(link.readLinkImport('#/inferencex?other=1'), null);
  assert.equal(link.stripLinkImport(`#/inferencex?data=${encoded}`), '#/inferencex');
  assert.equal(link.stripLinkImport('#/plot-tool'), '#/plot-tool');

  assert.throws(() => link.decodeLinkImport('not-deflate'), link.LinkImportError);
  assert.throws(() => link.decodeLinkImport(link.encodeLinkImport({ ...payload, v: 2 })), /version 2/u);
  assert.throws(() => link.decodeLinkImport(link.encodeLinkImport({ ...payload, files: [] })), /no files/u);
  assert.throws(
    () => link.decodeLinkImport(link.encodeLinkImport({ ...payload, files: [{ name: '', text: '' }] })),
    /non-empty "name"/u
  );

  console.log('link import checks passed');
} finally {
  await server.close();
}
