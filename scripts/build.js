#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');

const targets = [
  {
    name: 'VLESS Worker',
    src: path.join(__dirname, '../Vless_workers_pages/vless源码.js'),
    dist: path.join(__dirname, '../Vless_workers_pages/_worker.js')
  },
  {
    name: 'Trojan Worker',
    src: path.join(__dirname, '../Trojan_workers_pages/trojan源码.js'),
    dist: path.join(__dirname, '../Trojan_workers_pages/_worker.js')
  },
  {
    name: 'Unified Dual-Protocol Worker',
    src: path.join(__dirname, '../Unified_workers_pages/unified源码.js'),
    dist: path.join(__dirname, '../Unified_workers_pages/_worker.js')
  }
];

const obfuscatorOptions = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.4,
  deadCodeInjection: false,
  debugProtection: false,
  disableConsoleOutput: false,
  identifierNamesGenerator: 'hexadecimal',
  log: false,
  renameGlobals: false,
  rotateStringArray: true,
  selfDefending: false,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.75,
  unicodeEscapeSequence: false,
  target: 'browser'
};

console.log('🚀 Starting build and obfuscation...');
const startTime = Date.now();

for (const target of targets) {
  if (!fs.existsSync(target.src)) {
    console.log(`⚠️ Skipping ${target.name}: ${target.src} not found.`);
    continue;
  }
  console.log(`📦 Building ${target.name} from ${path.basename(target.src)}...`);
  const code = fs.readFileSync(target.src, 'utf8');
  const t0 = Date.now();
  const obfuscated = JavaScriptObfuscator.obfuscate(code, obfuscatorOptions);
  const outCode = obfuscated.getObfuscatedCode();
  fs.writeFileSync(target.dist, outCode, 'utf8');
  const duration = ((Date.now() - t0) / 1000).toFixed(2);
  const origKb = (Buffer.byteLength(code, 'utf8') / 1024).toFixed(1);
  const distKb = (Buffer.byteLength(outCode, 'utf8') / 1024).toFixed(1);
  console.log(`   ✅ Saved ${target.dist} (${origKb} KB -> ${distKb} KB in ${duration}s)`);
}

const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
console.log(`✨ All builds completed successfully in ${totalDuration}s.`);
