import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate';

// Link import: benchmark files carried inside the page URL, so a CI job can hand out a link
// that loads its results without storing them anywhere. The contract for producers is in
// docs/link-import.md:
//
//   #/inferencex?data=<base64url(raw DEFLATE(UTF-8 JSON payload))>
//
// The data stays in the URL fragment, which browsers never send to the server.

export const LINK_IMPORT_PARAM = 'data';
export const LINK_IMPORT_VERSION = 1;

export interface LinkImportPayload {
  v: number;
  name?: string;
  run?: string;
  source?: string;
  files: Array<{ name: string; text: string }>;
}

export interface LinkImport {
  name: string;
  runId: string;
  source: string;
  files: Array<{ name: string; bytes: Uint8Array }>;
}

export class LinkImportError extends Error {
  constructor(message: string) {
    super(`Link import failed: ${message}`);
    this.name = 'LinkImportError';
  }
}

/** The import carried by ``hash``, or null when it carries none. Throws LinkImportError when malformed. */
export function readLinkImport(hash: string): LinkImport | null {
  const query = hash.indexOf('?');
  if (query < 0) return null;
  const encoded = new URLSearchParams(hash.slice(query + 1)).get(LINK_IMPORT_PARAM);
  if (!encoded) return null;
  return decodeLinkImport(encoded);
}

export function decodeLinkImport(encoded: string): LinkImport {
  let payload: unknown;
  try {
    payload = JSON.parse(strFromU8(inflateSync(base64UrlToBytes(encoded))));
  } catch {
    throw new LinkImportError('the data parameter is not base64url-encoded, DEFLATE-compressed JSON.');
  }
  if (!isRecord(payload)) throw new LinkImportError('the payload is not a JSON object.');
  if (payload.v !== LINK_IMPORT_VERSION) {
    throw new LinkImportError(`unsupported payload version ${String(payload.v)}; expected ${LINK_IMPORT_VERSION}.`);
  }
  if (!Array.isArray(payload.files) || payload.files.length === 0) {
    throw new LinkImportError('the payload has no files.');
  }
  const files = payload.files.map((file, index) => {
    if (!isRecord(file) || typeof file.name !== 'string' || typeof file.text !== 'string' || !file.name) {
      throw new LinkImportError(`file ${index + 1} needs a non-empty "name" and a "text" string.`);
    }
    return { name: file.name, bytes: strToU8(file.text) };
  });
  return {
    name: readText(payload.name),
    runId: readText(payload.run),
    source: readText(payload.source),
    files
  };
}

/** The ``data`` parameter value for ``payload``; the inverse of decodeLinkImport. */
export function encodeLinkImport(payload: LinkImportPayload): string {
  return bytesToBase64Url(deflateSync(strToU8(JSON.stringify(payload)), { level: 9 }));
}

/** ``hash`` without its query, so a reload does not import the same data again. */
export function stripLinkImport(hash: string): string {
  const query = hash.indexOf('?');
  return query < 0 ? hash : hash.slice(0, query);
}

function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value.replace(/-/gu, '+').replace(/_/gu, '/');
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/u, '');
}

function readText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
