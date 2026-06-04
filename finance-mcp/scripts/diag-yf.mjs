#!/usr/bin/env node
/**
 * Diagnostic — print exactly what yahoo-finance2 exports look like in this env.
 * Run: node scripts/diag-yf.mjs
 */
import yfImp from 'yahoo-finance2';

console.log('=== yahoo-finance2 import diagnostics ===');
console.log('top level type:', typeof yfImp);
console.log('top keys:', Object.keys(yfImp).slice(0, 40));
console.log('typeof yfImp.quote:', typeof yfImp.quote);
console.log('typeof yfImp.historical:', typeof yfImp.historical);
console.log('typeof yfImp.default:', typeof yfImp.default);
if (yfImp.default) {
  console.log('default keys:', Object.keys(yfImp.default).slice(0, 40));
  console.log('typeof yfImp.default.quote:', typeof yfImp.default.quote);
  console.log('typeof yfImp.default.historical:', typeof yfImp.default.historical);
  if (yfImp.default.default) {
    console.log('default.default keys:', Object.keys(yfImp.default.default).slice(0, 40));
    console.log('typeof yfImp.default.default.quote:', typeof yfImp.default.default.quote);
  }
}

// 嘗試實際呼叫,看哪一個 path 能用
console.log('\n=== try invoking quote() ===');
const direct = [yfImp, yfImp?.default, yfImp?.default?.default].filter(Boolean);
for (let i = 0; i < direct.length; i++) {
  const c = direct[i];
  if (typeof c.quote === 'function') {
    try {
      const q = await c.quote('AAPL');
      console.log(`direct[${i}].quote('AAPL') → OK, price = ${q.regularMarketPrice}`);
    } catch (e) {
      console.log(`direct[${i}].quote('AAPL') → threw: ${e.message}`);
    }
  }
}

// 試 new yfImp() / new yfImp.default()
console.log('\n=== try `new` instantiation ===');
const ctors = [
  ['new yfImp()', typeof yfImp === 'function' ? yfImp : null],
  ['new yfImp.default()', typeof yfImp?.default === 'function' ? yfImp.default : null],
].filter((x) => x[1]);
for (const [label, Ctor] of ctors) {
  try {
    const inst = new Ctor();
    console.log(`${label} → instance typeof = ${typeof inst}, keys: ${Object.keys(inst).slice(0, 20).join(',')}`);
    console.log(`  inst.quote typeof: ${typeof inst.quote}`);
    console.log(`  inst.historical typeof: ${typeof inst.historical}`);
    console.log(`  inst.chart typeof: ${typeof inst.chart}`);
    if (typeof inst.quote === 'function') {
      const q = await inst.quote('AAPL');
      console.log(`  → ${label}.quote('AAPL') OK, price = ${q.regularMarketPrice}`);
    }
  } catch (e) {
    console.log(`${label} → threw: ${e.message}`);
  }
}

// 列出 prototype methods (constructor case)
if (typeof yfImp === 'function') {
  console.log('\n=== yfImp.prototype methods ===');
  const proto = yfImp.prototype;
  if (proto) {
    const methods = Object.getOwnPropertyNames(proto).filter((k) => k !== 'constructor');
    console.log('prototype methods:', methods.slice(0, 30));
  }
}

// 列出 package version(走 fs 不走 require,避開 exports 限制)
import { readFileSync } from 'node:fs';
try {
  const pkg = JSON.parse(
    readFileSync(new URL('../node_modules/yahoo-finance2/package.json', import.meta.url), 'utf8'),
  );
  console.log(`\nyahoo-finance2 installed version: ${pkg.version}`);
} catch (e) {
  console.log('\ncould not read yahoo-finance2 package.json:', e.message);
}
