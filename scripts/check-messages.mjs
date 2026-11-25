#!/usr/bin/env node
// Verifies every locale has the same keys as the source locale, that each
// message parses as ICU MessageFormat, and that arguments match the source.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, TYPE } from '@formatjs/icu-messageformat-parser';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const messagesDir = path.join(root, 'messages');
const locales = ['en'];
const sourceLocale = 'en';

const read = (locale) =>
  JSON.parse(readFileSync(path.join(messagesDir, `${locale}.json`), 'utf8'));

const flatten = (value, prefix = '', out = new Map()) => {
  for (const [key, child] of Object.entries(value)) {
    const id = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object') flatten(child, id, out);
    else out.set(id, child);
  }
  return out;
};

const argumentNames = (ast) => {
  const names = new Set();
  const walk = (nodes) => {
    for (const node of nodes) {
      if (node.type === TYPE.argument) names.add(node.value);
      if (node.type === TYPE.plural || node.type === TYPE.select) {
        names.add(node.value);
        for (const option of Object.values(node.options)) walk(option.value);
      }
      if (node.type === TYPE.tag) walk(node.children);
    }
  };
  walk(ast);
  return names;
};

const errors = [];
const source = flatten(read(sourceLocale));
const formatted = new Map();

for (const locale of locales) {
  const messages = flatten(read(locale));
  if (locale !== sourceLocale) {
    for (const key of source.keys()) {
      if (!messages.has(key)) errors.push(`${locale}: missing key "${key}"`);
    }
    for (const key of messages.keys()) {
      if (!source.has(key)) errors.push(`${locale}: key "${key}" is not in ${sourceLocale}`);
    }
  }
}

for (const [key, message] of source) {
  if (typeof message !== 'string') {
    errors.push(`${sourceLocale}: "${key}" must be a string`);
    continue;
  }
  try {
    parse(message, { requiresOtherClause: false });
  } catch (error) {
    errors.push(`${sourceLocale}: "${key}" is invalid ICU — ${error.message}`);
  }
}

for (const locale of locales) {
  const messages = flatten(read(locale));
  for (const [key, message] of messages) {
    if (typeof message !== 'string') continue;
    let ast;
    try {
      ast = parse(message, { requiresOtherClause: true });
    } catch (error) {
      errors.push(`${locale}: "${key}" is invalid ICU — ${error.message}`);
      continue;
    }
    formatted.set(`${locale}:${key}`, ast);
    const expected = source.get(key);
    if (typeof expected !== 'string') continue;
    let sourceAst;
    try {
      sourceAst = parse(expected, { requiresOtherClause: false });
    } catch {
      continue;
    }
    const want = [...argumentNames(sourceAst)].sort().join(',');
    const got = [...argumentNames(ast)].sort().join(',');
    if (want !== got) {
      errors.push(
        `${locale}: "${key}" uses arguments [${got || 'none'}] but ${sourceLocale} uses [${want || 'none'}]`,
      );
    }
  }
}

const localeCount = locales.length;
if (errors.length > 0) {
  console.error(`messages: ${errors.length} problem(s) across ${localeCount} locales`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log(
  `messages: ${source.size} keys × ${localeCount} ${localeCount === 1 ? 'locale' : 'locales'} verified (key parity, ICU syntax, arguments)`,
);
