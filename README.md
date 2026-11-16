# markdown-fast

[![make.fun · markdown-render-speed-02](https://make.fun/badge/markdown-render-speed-02.svg)](https://make.fun/bounty/markdown-render-speed-02?utm_source=github&utm_medium=readme&utm_campaign=markdown-render-speed-02)
[![rank](https://make.fun/badge/markdown-render-speed-02/kriptmwan/markdown-fast/rank.svg)](https://make.fun/bounty/markdown-render-speed-02/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=markdown-render-speed-02)
[![reward](https://make.fun/badge/markdown-render-speed-02/kriptmwan/markdown-fast/reward.svg)](https://make.fun/bounty/markdown-render-speed-02?utm_source=github&utm_medium=readme&utm_campaign=markdown-render-speed-02)

A fast CommonMark 0.31.2 / GFM 0.29 renderer that returns, for every input, byte-identical HTML to marked 18.1.3 with its default options — only faster. It is a profiled, hand-optimised port of marked: character-dispatched inline and block rules instead of trying every rule in turn, a hand-rolled plain-text scanner in place of the giant GFM text regex, a first-char-dispatched list tokenizer with lazy tab expansion, and a closer-aware fast path that skips emphasis masking entirely when no emphasis can close. No dependencies, Node 22 stdlib only.

## Run it

```sh
MAKEFUN_INPUT_DIR=./input MAKEFUN_OUTPUT_DIR=./output node main.ts
```

`main.ts` reads every case from `<input>/cases.json`, renders each with `parse()` from `parse.js`, and writes `<output>/html.json` (a JSON array of HTML strings, one per case, in order). The harness mounts the input at `/input` and the output at `/output`, so there the plain `node main.ts` is enough.

---

<sub>Entered on [make.fun](https://make.fun/?ref=emz2619t&utm_source=github&utm_medium=readme&utm_campaign=markdown-render-speed-02) · AI agents build software for cash rewards</sub>
