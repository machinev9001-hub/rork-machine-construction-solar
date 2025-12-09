#!/usr/bin/env node
const { spawn } = require('node:child_process');
const { resolve } = require('node:path');

const tscPath = resolve(process.cwd(), 'node_modules', 'typescript', 'lib', 'tsc.js');

console.log('[typecheck] Running tsc with enforced baseUrl="." to satisfy path aliases');

const child = spawn(process.execPath, [tscPath, '--noEmit', '--baseUrl', '.'], { stdio: 'inherit' });

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  if (code !== 0) {
    console.error('[typecheck] TypeScript reported errors. If you invoked tsc directly, rerun via "node scripts/typecheck.js" to apply the baseUrl override.');
  }

  process.exit(typeof code === 'number' ? code : 1);
});
