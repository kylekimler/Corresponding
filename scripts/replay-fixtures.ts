#!/usr/bin/env node
/**
 * CLI entry for fixture replay — writes reports/fixture-replay.json
 * Prefer: npm test -- tests/fixtures/replay.test.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { replayAllFixtures } from '../src/fixtures/replay.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const reportPath = path.resolve(__dirname, '../reports/fixture-replay.json');

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
const doc = dom.window.document;

const report = replayAllFixtures(undefined, doc);
mkdirSync(path.dirname(reportPath), { recursive: true });
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

console.log(`Wrote ${reportPath}`);
console.log(JSON.stringify(report.summary, null, 2));
