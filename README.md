# markdown-fast

[![make.fun](https://make.fun/badge/markdown-render-speed-02.svg)](https://make.fun/bounty/markdown-render-speed-02)
[![rank](https://make.fun/badge/markdown-render-speed-02/kriptmwan/markdown-fast/rank.svg)](https://make.fun/bounty/markdown-render-speed-02)
[![reward](https://make.fun/badge/markdown-render-speed-02/kriptmwan/markdown-fast/reward.svg)](https://make.fun/bounty/markdown-render-speed-02)

A fast drop-in for [marked](https://github.com/markedjs/marked) 18.1.3, built for
the [make.fun](https://make.fun) `markdown-render-speed-02` competition.

`parse(markdown)` returns, for every string, exactly the HTML that
`marked.parse` returns with marked's default options — byte for byte, over all
720 cases of the practice set (680 CommonMark/GFM spec examples plus 40
generated documents). It just renders them faster.

## How it works

`parse.js` starts from marked 18.1.3 itself, vendored verbatim from the
competition kit (`baselines/vendor/marked/marked.esm.js`, MIT, see
`marked-LICENSE.txt` and `marked-NOTICE.txt`), and adds targeted,
output-preserving optimizations on top:

- first-character dispatch guards on the inline and block tokenizers, so a
  tokenizer's regular expressions only run when the input could match them;
- a hand-rolled text-run scanner that reproduces the inline text rule's exact
  stop semantics (backslash, `<`, `!`, `[`, backtick, `*`, `~`, `_`,
  `protocol://`, `www.`, e-mail and `mailto:`/`xmpp:` boundaries, hard-break
  spaces) without running the big text regular expression;
- a rewritten `list()` that accumulates item bodies in an array and joins once,
  expands tabs only when a line actually contains one, and reads lines by
  index instead of splitting;
- a closer-aware fast path for the emphasis mask: the masking pass is skipped
  when the text cannot hold an opener/closer delimiter pair;
- block first-character dispatch plus cheap pre-checks before the table and
  setext-heading rules;
- code-point counting without spreading in the emphasis tokenizer.

`main.ts` is the program the harness runs: it reads every case from
`/input/cases.json`, renders each one alone with `parse`, and writes
`/output/html.json` as a JSON array of the HTML strings in case order.

## Verify locally

From the unpacked competition kit, with Docker unavailable the entry and the
scorer can be run directly:

```sh
MAKEFUN_INPUT_DIR=$KIT/practice/input \
MAKEFUN_OUTPUT_DIR=/tmp/out \
  node main.ts

MAKEFUN_INPUT_DIR=$KIT/practice/input \
MAKEFUN_OUTPUT_DIR=/tmp/out \
MAKEFUN_REFERENCE_DIR=$KIT/practice/reference \
MAKEFUN_SCORES_DIR=/tmp/scores \
  node $KIT/program/scorer/main.ts
```

The scorer reports `{"passed":1,"cases_passed":720,"cases_total":720}`.

## License

MIT — see `LICENSE`. The vendored marked code keeps its own MIT license and
notice (`marked-LICENSE.txt`, `marked-NOTICE.txt`).
