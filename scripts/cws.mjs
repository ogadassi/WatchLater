#!/usr/bin/env node
// Chrome Web Store publishing for YouTube Watch Later Manager (Chrome Web Store API v2).
//
// Usage (from the project folder):
//   node scripts/cws.mjs status     show what is published / in review
//   node scripts/cws.mjs build      rebuild WatchLaterExtension.zip from the current files
//   node scripts/cws.mjs upload     build + upload the zip as a new draft
//   node scripts/cws.mjs publish    submit the uploaded draft for review
//   node scripts/cws.mjs release    build + upload + submit for review
//
// Auth: a Google Cloud service account linked to the Web Store publisher account.
// Settings come from cws.config.json next to this repo's manifest (git-ignored), or env vars:
//   publisherId  / CWS_PUBLISHER_ID   publisher ID from the developer dashboard
//   keyFile      / CWS_KEY_FILE       path to the service account JSON key (keep it outside the repo)
//   extensionId  / CWS_EXTENSION_ID   optional, defaults to the store item below

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createSign } from 'node:crypto';
import { deflateRawSync, crc32 } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ZIP_PATH = join(ROOT, 'WatchLaterExtension.zip');
const ZIP_FILES = ['manifest.json', 'content.js', 'styles.css', 'icon16.png', 'icon48.png', 'icon128.png', 'LICENSE', 'README.md'];
const DEFAULT_EXTENSION_ID = 'cipblemimaiffjenjhnplnegbembhgmc';
const SCOPE = 'https://www.googleapis.com/auth/chromewebstore';
const API = 'https://chromewebstore.googleapis.com';

function fail(msg) {
  console.error(`Error: ${msg}`);
  process.exit(1);
}

function loadConfig() {
  const cfgPath = join(ROOT, 'cws.config.json');
  const file = existsSync(cfgPath) ? JSON.parse(readFileSync(cfgPath, 'utf8')) : {};
  const cfg = {
    publisherId: process.env.CWS_PUBLISHER_ID || file.publisherId,
    keyFile: process.env.CWS_KEY_FILE || file.keyFile,
    extensionId: process.env.CWS_EXTENSION_ID || file.extensionId || DEFAULT_EXTENSION_ID,
  };
  if (!cfg.publisherId) fail('No publisher ID. Set "publisherId" in cws.config.json or CWS_PUBLISHER_ID.');
  if (!cfg.keyFile) fail('No key file. Set "keyFile" in cws.config.json or CWS_KEY_FILE.');
  if (!existsSync(cfg.keyFile)) fail(`Key file not found: ${cfg.keyFile}`);
  return cfg;
}

// --- Auth: service account JWT -> access token (no dependencies) ---
async function getAccessToken(keyFile) {
  const key = JSON.parse(readFileSync(keyFile, 'utf8'));
  if (!key.client_email || !key.private_key) fail('Key file is not a service account JSON key.');
  const tokenUri = key.token_uri || 'https://oauth2.googleapis.com/token';
  const now = Math.floor(Date.now() / 1000);
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
    iss: key.client_email, scope: SCOPE, aud: tokenUri, iat: now, exp: now + 3600,
  })}`;
  const signature = createSign('RSA-SHA256').update(unsigned).sign(key.private_key, 'base64url');

  const res = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${signature}`,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) fail(`Could not get an access token (${res.status}): ${JSON.stringify(body)}`);
  return body.access_token;
}

async function call(method, url, token, body, contentType) {
  const headers = { Authorization: `Bearer ${token}` };
  if (contentType) headers['Content-Type'] = contentType;
  const res = await fetch(url, { method, headers, body });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  if (!res.ok) fail(`${method} ${url} -> ${res.status}\n${JSON.stringify(json, null, 2)}`);
  return json;
}

// --- Zip (stored with deflate, no dependencies) ---
function buildZip() {
  const locals = [];
  const centrals = [];
  let offset = 0;
  const dosTime = 0; // fixed timestamps keep builds reproducible
  const dosDate = (2026 - 1980) << 9 | 1 << 5 | 1;

  for (const name of ZIP_FILES) {
    const data = readFileSync(join(ROOT, name));
    const compressed = deflateRawSync(data, { level: 9 });
    const crc = crc32(data);
    const nameBuf = Buffer.from(name, 'utf8');

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(8, 8);      // deflate
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBuf, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(dosTime, 12);
    central.writeUInt16LE(dosDate, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);

    offset += local.length + nameBuf.length + compressed.length;
  }

  const centralBuf = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(ZIP_FILES.length, 8);
  end.writeUInt16LE(ZIP_FILES.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);

  const zip = Buffer.concat([...locals, centralBuf, end]);
  writeFileSync(ZIP_PATH, zip);
  const version = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8')).version;
  console.log(`Built WatchLaterExtension.zip (version ${version}, ${ZIP_FILES.length} files, ${zip.length} bytes)`);
  return zip;
}

// --- Commands ---
const itemUrl = (cfg) => `${API}/v2/publishers/${cfg.publisherId}/items/${cfg.extensionId}`;

async function status(cfg, token) {
  const s = await call('GET', `${itemUrl(cfg)}:fetchStatus`, token);
  console.log(JSON.stringify(s, null, 2));
  return s;
}

async function upload(cfg, token) {
  const zip = buildZip();
  const url = `${API}/upload/v2/publishers/${cfg.publisherId}/items/${cfg.extensionId}:upload`;
  let res = await call('POST', url, token, zip, 'application/zip');
  console.log(`Upload: ${res.uploadState || JSON.stringify(res)}`);
  for (let i = 0; res.uploadState === 'IN_PROGRESS' && i < 20; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    res = await call('GET', `${itemUrl(cfg)}:fetchStatus`, token);
    res.uploadState = res.lastAsyncUploadState || res.uploadState;
    console.log(`Upload: ${res.uploadState || 'checking...'}`);
  }
  if (res.uploadState && res.uploadState !== 'SUCCEEDED') fail(`Upload did not succeed:\n${JSON.stringify(res, null, 2)}`);
}

async function publish(cfg, token) {
  const res = await call('POST', `${itemUrl(cfg)}:publish`, token, '{}', 'application/json');
  console.log('Submitted for review:');
  console.log(JSON.stringify(res, null, 2));
}

const cmd = process.argv[2];
const commands = ['status', 'build', 'upload', 'publish', 'release'];
if (!commands.includes(cmd)) {
  console.log(`Usage: node scripts/cws.mjs <${commands.join('|')}>`);
  process.exit(cmd ? 1 : 0);
}

if (cmd === 'build') {
  buildZip();
} else {
  const cfg = loadConfig();
  const token = await getAccessToken(cfg.keyFile);
  if (cmd === 'status') await status(cfg, token);
  if (cmd === 'upload') await upload(cfg, token);
  if (cmd === 'publish') await publish(cfg, token);
  if (cmd === 'release') { await upload(cfg, token); await publish(cfg, token); }
}
