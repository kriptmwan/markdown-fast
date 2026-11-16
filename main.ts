// main.ts — entrypoint for the markdown-render-speed-02 entry.
//
// Reads every case from <input>/cases.json, renders each one with parse()
// from parse.js, and writes <output>/html.json: a JSON array of HTML strings,
// one per case, in the cases' order. The harness mounts the input at /input
// and the output at /output; outside a container the MAKEFUN_INPUT_DIR and
// MAKEFUN_OUTPUT_DIR variables stand in for them. Node 22, stdlib only.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from './parse.js';

interface Case {
  id: string;
  markdown: string;
}

function main(): void {
  const inputDir = process.env.MAKEFUN_INPUT_DIR ?? '/input';
  const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

  const cases = JSON.parse(readFileSync(join(inputDir, 'cases.json'), 'utf8')) as Case[];
  const html: string[] = new Array(cases.length);
  for (let i = 0; i < cases.length; i++) {
    html[i] = parse(cases[i].markdown);
  }

  mkdirSync(outputDir, { recursive: true });
  writeFileSync(join(outputDir, 'html.json'), JSON.stringify(html));
}

main();
