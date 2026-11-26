#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Mock cloudflare:sockets by dynamically evaluating worker in sandbox or transforming import
async function loadWorkerModule(filePath) {
  let code = fs.readFileSync(path.resolve(__dirname, filePath), 'utf8');
  // Replace cloudflare:sockets import with mock
  code = code.replace(/import\s*\{\s*connect\s*\}\s*from\s*["']cloudflare:sockets["'];?/, 'const connect = () => ({ writable: { getWriter: () => ({ write: () => {}, releaseLock: () => {} }) }, readable: { pipeTo: () => Promise.resolve() }, closed: Promise.resolve() });');
  // Convert ES export to CommonJS or data URL
  const dataUrl = 'data:text/javascript;base64,' + Buffer.from(code).toString('base64');
  return await import(dataUrl);
}

async function testWorker(name, workerPath, authPath, isTrojan = false) {
  console.log(`🧪 Testing ${name}...`);
  const workerModule = await loadWorkerModule(workerPath);
  const worker = workerModule.default;

  // 1. Test Dashboard HTML
  {
    const req = new Request(`https://my-worker.workers.dev/${authPath}`, {
      headers: { Host: 'my-worker.workers.dev' }
    });
    const env = isTrojan ? { pswd: authPath } : { uuid: authPath };
    const res = await worker.fetch(req, env, {});
    assert.strictEqual(res.status, 200, 'Dashboard status should be 200');
    const html = await res.text();
    assert.ok(html.includes('控制台'), 'HTML should contain 控制台');
    assert.ok(html.includes(authPath), 'HTML should contain auth token');
    console.log(`   ✅ Dashboard HTML OK (${html.length} bytes)`);
  }

  // 2. Test Dynamic Sub (Auto / Base64)
  {
    const req = new Request(`https://my-worker.workers.dev/${authPath}/sub`, {
      headers: { Host: 'my-worker.workers.dev', 'User-Agent': 'Shadowrocket/1982' }
    });
    const env = isTrojan ? { pswd: authPath } : { uuid: authPath };
    const res = await worker.fetch(req, env, {});
    assert.strictEqual(res.status, 200);
    const body = await res.text();
    const decoded = Buffer.from(body, 'base64').toString('utf8');
    const protoPrefix = isTrojan ? 'trojan://' : 'vless://';
    assert.ok(decoded.includes(protoPrefix), `Decoded sub should contain ${protoPrefix}`);
    console.log(`   ✅ Universal Base64 Sub OK (${decoded.split('\n').length} nodes)`);
  }

  // 3. Test Clash YAML Sub
  {
    const req = new Request(`https://my-worker.workers.dev/${authPath}/cl`, {
      headers: { Host: 'my-worker.workers.dev' }
    });
    const env = isTrojan ? { pswd: authPath } : { uuid: authPath };
    const res = await worker.fetch(req, env, {});
    assert.strictEqual(res.status, 200);
    const yaml = await res.text();
    assert.ok(yaml.includes('proxies:'), 'Clash config should contain proxies:');
    assert.ok(yaml.includes('proxy-groups:'), 'Clash config should contain proxy-groups:');
    console.log(`   ✅ Clash YAML Sub OK (${yaml.length} bytes)`);
  }

  // 4. Test Sing-box JSON Sub
  {
    const req = new Request(`https://my-worker.workers.dev/${authPath}/sb`, {
      headers: { Host: 'my-worker.workers.dev' }
    });
    const env = isTrojan ? { pswd: authPath } : { uuid: authPath };
    const res = await worker.fetch(req, env, {});
    assert.strictEqual(res.status, 200);
    const jsonStr = await res.text();
    const parsed = JSON.parse(jsonStr);
    assert.ok(parsed.outbounds && parsed.outbounds.length > 0, 'Sing-box config should have outbounds');
    console.log(`   ✅ Sing-box JSON Sub OK (${parsed.outbounds.length} outbounds)`);
  }

  // 5. Test Query Parameter Dynamic Customization (?ip=...&pt=...)
  {
    const customIP = '104.16.88.99';
    const customPort = '8443';
    const req = new Request(`https://my-worker.workers.dev/${authPath}/sub?ip=${customIP}&pt=${customPort}&format=clash`, {
      headers: { Host: 'my-worker.workers.dev' }
    });
    const env = isTrojan ? { pswd: authPath } : { uuid: authPath };
    const res = await worker.fetch(req, env, {});
    assert.strictEqual(res.status, 200);
    const yaml = await res.text();
    assert.ok(yaml.includes(customIP), 'Clash config should contain custom IP');
    assert.ok(yaml.includes(customPort), 'Clash config should contain custom port');
    console.log(`   ✅ Query Parameter Customization OK (${customIP}:${customPort})`);
  }
}

async function run() {
  const uuid = '86c50e3a-5b87-49dd-bd20-03c7f2735e40';
  const pswd = 'my-secret-trojan';

  await testWorker('VLESS Source', '../Vless_workers_pages/vless源码.js', uuid, false);
  await testWorker('Trojan Source', '../Trojan_workers_pages/trojan源码.js', pswd, true);
  await testWorker('Unified Dual-Protocol Source (VLESS)', '../Unified_workers_pages/unified源码.js', uuid, false);
  await testWorker('Unified Dual-Protocol Source (Trojan)', '../Unified_workers_pages/unified源码.js', pswd, true);

  console.log('\n🎉 All automated tests passed successfully!');
}

run().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
