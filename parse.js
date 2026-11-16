// parse.js — fast CommonMark/GFM renderer, byte-identical to marked 18.1.3 (default options).
// Based on marked (MIT License, https://github.com/markedjs/marked) — see LICENSE.
// Optimized for speed: see comments at the optimization points.

// ==== rules.ts ====
const noopTest = { exec: () => null }                     ;

function cachedIndentRegex(createRegex                            ) {
  const cache           = [];
  return (indent        ) => {
    const cacheIndex = Math.max(0, Math.min(3, indent - 1));
    let regex = cache[cacheIndex];
    if (!regex) {
      regex = createRegex(cacheIndex);
      cache[cacheIndex] = regex;
    }
    return regex;
  };
}

function edit(regex                 , opt = '') {
  let source = typeof regex === 'string' ? regex : regex.source;
  const obj = {
    replace: (name                 , val                 ) => {
      let valSource = typeof val === 'string' ? val : val.source;
      valSource = valSource.replace(other.caret, '$1');
      source = source.replace(name, valSource);
      return obj;
    },
    getRegex: () => {
      return new RegExp(source, opt);
    },
  };
  return obj;
}

// use a default variable to ensure the regex is evaluated on client an not removed by minifiers
const supportsLookbehind = ((a = '') => {
try {
  return !!new RegExp('(?<=1)(?<!1)' + a);
} catch {
  // See browser support here:
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Regular_expressions/Lookbehind_assertion
  return false;
}
})();

const other = {
  codeRemoveIndent: /^(?: {0,3}\t| {1,4})/gm,
  outputLinkReplace: /\\([\[\]])/g,
  indentCodeCompensation: /^(\s+)(?:```)/,
  beginningSpace: /^\s+/,
  endingHash: /#$/,
  startingSpaceChar: /^ /,
  endingSpaceChar: / $/,
  endingSpaceTabChar: /[ \t]$/,
  nonSpaceChar: /[^ ]/,
  newLineCharGlobal: /\n/g,
  tabCharGlobal: /\t/g,
  leadingSpaceTab: /^[ \t]+/,
  multipleSpaceGlobal: /\s+/g,
  blankLine: /^[ \t]*$/,
  doubleBlankLine: /\n[ \t]*\n[ \t]*$/,
  blockquoteStart: /^ {0,3}>/,
  // Neutralize a lazy setext underline, including one with trailing tabs.
  // CommonMark §4.3 allows those tabs on a real underline, so the same class
  // has to be recognized here or a lazy `===\t` becomes a heading.
  blockquoteSetextReplace: /\n {0,3}((?:=+|-+)[ \t]*)(?=\n|$)/g,
  blockquoteSetextReplace2: /^ {0,3}>[ \t]?/gm,
  blockquoteMarkerWhitespace: /^( {0,3}>)([ \t]+)/gm,
  listReplaceNesting: /^ {1,4}(?=( {4})*[^ ])/g,
  listIsTask: /^\[[ xX]\][ \t]+\S/,
  listReplaceTask: /^\[[ xX]\][ \t]+/,
  listTaskCheckbox: /\[[ xX]\]/,
  anyLine: /\n.*\n/,
  hrefBrackets: /^<(.*)>$/,
  tableDelimiter: /[:|]/,
  tableAlignChars: /^\||\| *$/g,
  tableRowBlankLine: /\n[ \t]*$/,
  tableAlignRight: /^ *-+: *$/,
  tableAlignCenter: /^ *:-+: *$/,
  tableAlignLeft: /^ *:-+ *$/,
  startATag: /^<a /i,
  endATag: /^<\/a>/i,
  startPreScriptTag: /^<(pre|code|kbd|script)(\s|>)/i,
  endPreScriptTag: /^<\/(pre|code|kbd|script)(\s|>)/i,
  startAngleBracket: /^</,
  endAngleBracket: />$/,
  pedanticHrefTitle: /^([^'"]*[^\s])\s+(['"])(.*)\2/,
  unicodeAlphaNumeric: /[\p{L}\p{N}]/u,
  numericCharacterReference: /&#(?:(\d{1,7})|[Xx]([A-Fa-f0-9]{1,6}));/,
  numericCharacterReferenceOrAmpersand: /&#(?:(\d{1,7})|[Xx]([A-Fa-f0-9]{1,6}));|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g,
  escapeTest: /[&<>"']/,
  escapeReplace: /[&<>"']/g,
  escapeTestNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/,
  escapeReplaceNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g,
  caret: /(^|[^\[])\^/g,
  percentDecode: /%25/g,
  findPipe: /\|/g,
  splitPipe: / \|/,
  slashPipe: /\\\|/g,
  carriageReturn: /\r\n|\r/g,
  spaceLine: /^ +$/gm,
  notSpaceStart: /^\S*/,
  endingNewline: /\n$/,
  listItemRegex: (bull        ) => new RegExp(`^( {0,3}${bull})((?:[\t ][^\\n]*)?(?:\\n|$))`),
  nextBulletRegex: cachedIndentRegex((indent        ) => new RegExp(`^ {0,${indent}}(?:[*+-]|\\d{1,9}[.)])((?:[ \t][^\\n]*)?(?:\\n|$))`)),
  hrRegex: cachedIndentRegex((indent        ) => new RegExp(`^ {0,${indent}}((?:-[ \t]*){3,}|(?:_[ \t]*){3,}|(?:\\*[ \t]*){3,})(?:\\n+|$)`)),
  fencesBeginRegex: cachedIndentRegex((indent        ) => new RegExp(`^ {0,${indent}}(?:\`\`\`|~~~)`)),
  // an ATX heading needs a space (or the end of the line) after the hashes, so a line
  // like `#tag` does not end a list item; pedantic mode accepts it as a heading
  headingBeginRegex: cachedIndentRegex((indent        ) => new RegExp(`^ {0,${indent}}#{1,6}(?:\\s|$)`)),
  pedanticHeadingBeginRegex: cachedIndentRegex((indent        ) => new RegExp(`^ {0,${indent}}#`)),
  // a list item ends where a paragraph would be interrupted, so this mirrors the
  // html start conditions in the paragraph rule below; type 7 is excluded there
  htmlBeginRegex: cachedIndentRegex((indent        ) => new RegExp(`^ {0,${indent}}(?:</?(?:${_tag})(?: +|$|/?>)|<(?:(?:script|pre|style|textarea)(?:[\\s>]|$)|!--)|<\\?|<![A-Za-z]|<!\\[CDATA\\[)`, 'i')),
  blockquoteBeginRegex: cachedIndentRegex((indent        ) => new RegExp(`^ {0,${indent}}>`)),
};

/**
 * Block-Level Grammar
 */

const newline = /^(?:[ \t]*(?:\n|$))+/;
const blockCode = /^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/;
const fences = /^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}(?:(?=`)\1`*|(?=~)\1~*) *(?=\n|$)|$)/;
const hr = /^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/;
const heading = /^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/;
const bullet = / {0,3}(?:[*+-]|\d{1,9}[.)])/;
// The underline may end with spaces or tabs (CommonMark §4.3). Internal
// spaces or tabs still fail to match, and more than three spaces of indent
// still do not.
const lheadingCore = /^(?!bull |blockCode|fences|blockquote|heading|html|table)((?:.|\n(?!\s*?\n|bull |fences|blockquote|heading|hr|html|table))+?)\n {0,3}(=+|-+)[ \t]*(?:\n+|$)/;
const lheading = edit(lheadingCore)
  .replace(/bull/g, bullet) // lists can interrupt
  .replace(/blockCode/g, /(?: {4}| {0,3}\t)/) // indented code can start a block but cannot interrupt a paragraph
  .replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/) // fenced code blocks can interrupt
  .replace(/blockquote/g, / {0,3}>/) // blockquote can interrupt
  .replace(/heading/g, / {0,3}#{1,6}(?:\s|$)/) // ATX heading can interrupt
  .replace(/hr/g, / {0,3}(?:(?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/) // thematic break can interrupt
  .replace(/html/g, / {0,3}<[^\n>]+>\n/) // block html can interrupt
  .replace(/\|table/g, '') // table not in commonmark
  .getRegex();
const lheadingGfm = edit(lheadingCore)
  .replace(/bull/g, bullet) // lists can interrupt
  .replace(/blockCode/g, /(?: {4}| {0,3}\t)/) // indented code can start a block but cannot interrupt a paragraph
  .replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/) // fenced code blocks can interrupt
  .replace(/blockquote/g, / {0,3}>/) // blockquote can interrupt
  .replace(/heading/g, / {0,3}#{1,6}(?:\s|$)/) // ATX heading can interrupt
  .replace(/hr/g, / {0,3}(?:(?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/) // thematic break can interrupt
  .replace(/html/g, / {0,3}<[^\n>]+>\n/) // block html can interrupt
  .replace(/table/g, / {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n/) // table can interrupt
  .getRegex();
const _paragraph = /^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table|[ \t]+\n)[^\n]+)*)/;
const blockText = /^[^\n]+/;
const _blockLabel = /(?!\s*\])(?:\\[\s\S]|[^\[\]\\\n]|\n(?![ \t]*\n))+/;
const def = edit(/^ {0,3}\[(label)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)(title))? *(?:\n+|$)/)
  .replace('label', _blockLabel)
  // An escaped delimiter is part of the title, so a backslash must consume the
  // next character. An optional closer (`\"?`) lets that character backtrack
  // into the closing quote (`[foo]: /url "t\"` is not a title).
  .replace('title', /(?:"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\\n]|\n(?!\n))*'|\((?:\\[\s\S]|[^()\\])*\))/)
  .getRegex();

const list = edit(/^(bull)([ \t][^\n]*?)?(?:\n|$)/)
  .replace(/bull/g, bullet)
  .getRegex();

const _tag = 'address|article|aside|base|basefont|blockquote|body|caption'
  + '|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption'
  + '|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe'
  + '|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option'
  + '|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title'
  + '|tr|track|ul';
const _comment = /<!--(?:-?>|[\s\S]*?(?:-->|$))/;
const html = edit(
  '^ {0,3}(?:' // optional indentation
+ '<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n*|$)' // (1)
+ '|comment[^\\n]*(\\n+|$)' // (2)
+ '|<\\?[\\s\\S]*?(?:\\?>[^\\n]*\\n*|$)' // (3)
+ '|<![A-Z][\\s\\S]*?(?:>[^\\n]*\\n*|$)' // (4)
+ '|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>[^\\n]*\\n*|$)' // (5)
+ '|</?(tag)(?:[ \\t]+|\\n|/?>|$)[\\s\\S]*?(?:(?:\\n[ \t]*)+\\n|$)' // (6)
+ '|<(?!(?:script|pre|style|textarea)(?![a-z0-9-]))([a-z][a-z0-9-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ \t]*)+\\n|$)' // (7) open tag
+ '|</[a-z][a-z0-9-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ \t]*)+\\n|$)' // (7) closing tag
+ ')', 'i')
  .replace('comment', _comment)
  .replace('tag', _tag)
  .replace('attribute', / +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/)
  .getRegex();

const createParagraph = (listInterrupt        ) => edit(_paragraph)
  .replace('hr', hr)
  .replace('heading', ' {0,3}#{1,6}(?:\\s|$)')
  .replace('|lheading', '') // setext headings don't interrupt commonmark paragraphs
  .replace('|table', '')
  .replace('blockquote', ' {0,3}>')
  .replace('fences', ' {0,3}(?:`{3,}(?=[^`\\n]*(?:\\n|$))|~~~)[^\\n]*(?:\\n|$)')
  .replace('list', listInterrupt)
  .replace('html', ' {0,3}(?:</?(?:tag)(?: +|\\n|/?>)|<(?:(?:script|pre|style|textarea)(?:[\\s>]|$)|!--)|<\\?|<![A-Za-z]|<!\\[CDATA\\[)')
  .replace('tag', _tag) // pars can be interrupted by html blocks of types (1) to (6)
  .getRegex();

// only non-empty lists starting from 1 can interrupt paragraphs
const paragraph = createParagraph(/ {0,3}(?:[*+-]|1[.)])[ \t]+[^ \t\n]/);
// inside a blockquote a bare list marker (any number) starts a sibling list,
// so it must not be lazily continued as paragraph text (unlike a top level
// paragraph, where an empty list cannot interrupt)
const blockquoteParagraph = createParagraph(/ {0,3}(?:[*+-]|\d{1,9}[.)])(?:[ \t]|\n|$)/);

// a line with only whitespace after the marker is blank, so it must not start a
// paragraph that lazily continues onto the next line
const blockquote = edit(/^( {0,3}> ?(?:(?![ \t]*(?:\n|$))(paragraph)|[^\n]*)(?:\n|$))+/)
  .replace('paragraph', blockquoteParagraph)
  .getRegex();

/**
 * Normal Block Grammar
 */

const blockNormal = {
  blockquote,
  code: blockCode,
  def,
  fences,
  heading,
  hr,
  html,
  lheading,
  list,
  newline,
  paragraph,
  table: noopTest,
  text: blockText,
};

                                          

/**
 * GFM Block Grammar
 */

const gfmTable = edit(
  '^ *([^\\n ].*)\\n' // Header
+ ' {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)' // Align
+ '(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)') // Cells
  .replace('hr', hr)
  .replace('heading', ' {0,3}#{1,6}(?:\\s|$)')
  .replace('blockquote', ' {0,3}>')
  .replace('code', '(?: {4}| {0,3}\t)[^\\n]')
  .replace('fences', ' {0,3}(?:`{3,}(?=[^`\\n]*(?:\\n|$))|~~~)[^\\n]*(?:\\n|$)')
  .replace('list', ' {0,3}(?:[*+-]|1[.)])[ \\t]') // any bullet ends the table rows
  .replace('html', ' {0,3}(?:</?(?:tag)(?: +|\\n|/?>)|<(?:(?:script|pre|style|textarea)(?:[\\s>]|$)|!--)|<\\?|<![A-Za-z]|<!\\[CDATA\\[)')
  .replace('tag', _tag) // tables can be interrupted by html blocks of types (1) to (6)
  .getRegex();

const blockGfm                            = {
  ...blockNormal,
  lheading: lheadingGfm,
  table: gfmTable,
  paragraph: edit(_paragraph)
    .replace('hr', hr)
    .replace('heading', ' {0,3}#{1,6}(?:\\s|$)')
    .replace('|lheading', '') // setext headings don't interrupt commonmark paragraphs
    .replace('table', gfmTable) // interrupt paragraphs with table
    .replace('blockquote', ' {0,3}>')
    .replace('fences', ' {0,3}(?:`{3,}(?=[^`\\n]*(?:\\n|$))|~~~)[^\\n]*(?:\\n|$)')
    .replace('list', ' {0,3}(?:[*+-]|1[.)])[ \\t]+[^ \\t\\n]') // only non-empty lists starting from 1 can interrupt
    .replace('html', ' {0,3}(?:</?(?:tag)(?: +|\\n|/?>)|<(?:(?:script|pre|style|textarea)(?:[\\s>]|$)|!--)|<\\?|<![A-Za-z]|<!\\[CDATA\\[)')
    .replace('tag', _tag) // pars can be interrupted by html blocks of types (1) to (6)
    .getRegex(),
};

/**
 * Pedantic grammar (original John Gruber's loose markdown specification)
 */

const blockPedantic                            = {
  ...blockNormal,
  html: edit(
    '^ *(?:comment(?: *\\n|\\s*$)'
    + '|<(tag)[\\s\\S]+?</\\1>(?: *\\n{2,}|\\s*$)' // closed tag
    + '|<tag(?:"[^"]*"|\'[^\']*\'|\\s[^\'"/>\\s]*)*?/?>(?: *\\n{2,}|\\s*$))')
    .replace('comment', _comment)
    .replace(/tag/g, '(?!(?:'
      + 'a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub'
      + '|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)'
      + '\\b)\\w+(?!:|[^\\w\\s@]*@)\\b')
    .getRegex(),
  def: /^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/,
  heading: /^(#{1,6})(.*)(?:\n+|$)/,
  fences: noopTest, // fences not supported
  lheading: /^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/,
  paragraph: edit(_paragraph)
    .replace('hr', hr)
    .replace('heading', ' *#{1,6} *[^\n]')
    .replace('lheading', lheading)
    .replace('|table', '')
    .replace('blockquote', ' {0,3}>')
    .replace('|fences', '')
    .replace('|list', '')
    .replace('|html', '')
    .replace('|tag', '')
    .getRegex(),
};

/**
 * Inline-Level Grammar
 */

const escape = /^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/;
const inlineCode = /^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/;
const br = /^( {2,}|\\)\n(?!\s*$)[ \t]*/;
const inlineText = /^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/;

// list of unicode punctuation marks, plus any missing characters from CommonMark spec
const _punctuation = /[\p{P}\p{S}]/u;
const _punctuationOrSpace = /[\s\p{P}\p{S}]/u;
const _notPunctuationOrSpace = /[^\s\p{P}\p{S}]/u;
const punctuation = edit(/^((?![*_])punctSpace)/, 'u')
  .replace(/punctSpace/g, _punctuationOrSpace).getRegex();

/**
 * Opening punct/quotes excluded from pedantic LDelim nextChar so
 * `aa**"A"**bb` / `aa**(A)**bb` can start strong (Pi + Ps + ASCII straight quotes).
 */
const _openQuote = /[\p{Pi}\p{Ps}"']/u;

// GFM allows ~ inside strong and em for strikethrough
const _punctuationGfmStrongEm = /(?!~)[\p{P}\p{S}]/u;
const _punctuationOrSpaceGfmStrongEm = /(?!~)[\s\p{P}\p{S}]/u;
const _notPunctuationOrSpaceGfmStrongEm = /(?:[^\s\p{P}\p{S}]|~)/u;

// sequences em should skip over [title](link), `code`, <html>
const blockSkip = edit(/link|precode-code|html/, 'g')
  .replace('link', /\[(?:[^\[\]`]|(?<a>`+)[^`]+\k<a>(?!`))*?\]\((?:\\[\s\S]|[^\\\(\)]|\((?:\\[\s\S]|[^\\\(\)])*\))*\)/)
  .replace('precode-', supportsLookbehind ? '(?<!`)()' : '(^^|[^`])')
  .replace('code', /(?<b>`+)[^`]+\k<b>(?!`)/)
  .replace('html', /<(?! )[^<>]*?>/)
  .getRegex();

const emStrongLDelimCore = /^(?:\*+(?:((?!\*)punct)|([^\s*]))?)|^_+(?:((?!_)punct)|([^\s_]))?/;

const emStrongLDelim = edit(emStrongLDelimCore, 'u')
  .replace(/punct/g, _punctuation)
  .getRegex();

const emStrongLDelimGfm = edit(emStrongLDelimCore, 'u')
  .replace(/punct/g, _punctuationGfmStrongEm)
  .getRegex();

// Pedantic: do not treat opening punct/quotes as left-delim punct (e.g. **( / **").
const emStrongLDelimPedanticCore = /^(?:\*+(?:((?!\*)(?!openQuote)punct)|([^\s*]))?)|^_+(?:((?!_)(?!openQuote)punct)|([^\s_]))?/;

const emStrongLDelimPedantic = edit(emStrongLDelimPedanticCore, 'u')
  .replace(/openQuote/g, _openQuote)
  .replace(/punct/g, _punctuation)
  .getRegex();

const emStrongRDelimAstCore =
  '^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)' // Skip orphan inside strong
+ '|[^*]+(?=[^*])' // Consume to delim
+ '|(?!\\*)punct(\\*+)(?=[\\s]|$)' // (1) #*** can only be a Right Delimiter
+ '|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)' // (2) a***#, a*** can only be a Right Delimiter
+ '|(?!\\*)punctSpace(\\*+)(?=notPunctSpace)' // (3) #***a, ***a can only be Left Delimiter
+ '|[\\s](\\*+)(?!\\*)(?=punct)' // (4) ***# can only be Left Delimiter
+ '|(?!\\*)punct(\\*+)(?!\\*)(?=punct)' // (5) #***# can be either Left or Right Delimiter
+ '|notPunctSpace(\\*+)(?=notPunctSpace)'; // (6) a***a can be either Left or Right Delimiter

const emStrongRDelimAst = edit(emStrongRDelimAstCore, 'gu')
  .replace(/notPunctSpace/g, _notPunctuationOrSpace)
  .replace(/punctSpace/g, _punctuationOrSpace)
  .replace(/punct/g, _punctuation)
  .getRegex();

const emStrongRDelimAstGfm = edit(emStrongRDelimAstCore, 'gu')
  .replace(/notPunctSpace/g, _notPunctuationOrSpaceGfmStrongEm)
  .replace(/punctSpace/g, _punctuationOrSpaceGfmStrongEm)
  .replace(/punct/g, _punctuationGfmStrongEm)
  .getRegex();

// Pedantic: rule 3 requires whitespace before left delim; rule 6 allows punct before close (e.g. `:**bar`).
const emStrongRDelimAstPedanticCore =
  '^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)' // Skip orphan inside strong
+ '|[^*]+(?=[^*])' // Consume to delim
+ '|(?!\\*)punct(\\*+)(?=[\\s]|$)' // (1) #*** can only be a Right Delimiter
+ '|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)' // (2) a***#, a*** can only be a Right Delimiter
+ '|(?!\\*)[\\s](\\*+)(?=notPunctSpace)' // (3) ***a can only be Left Delimiter (whitespace required; not #***a)
+ '|[\\s](\\*+)(?!\\*)(?=punct)' // (4) ***# can only be Left Delimiter
+ '|(?!\\*)punct(\\*+)(?!\\*)(?=punct)' // (5) #***# can be either Left or Right Delimiter
+ '|(?:(?!\\*)punct|notPunctSpace)(\\*+)(?!\\*)(?=notPunctSpace)'; // (6) a***a, #***a, and :** (e.g. **foo:**bar)

const emStrongRDelimAstPedantic = edit(emStrongRDelimAstPedanticCore, 'gu')
  .replace(/notPunctSpace/g, _notPunctuationOrSpace)
  .replace(/punctSpace/g, _punctuationOrSpace)
  .replace(/punct/g, _punctuation)
  .getRegex();

// Normal: no rule 6 for _ (a___a cannot close as emphasis).
const emStrongRDelimUnd = edit(
  '^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)' // Skip orphan inside strong
+ '|[^_]+(?=[^_])' // Consume to delim
+ '|(?!_)punct(_+)(?=[\\s]|$)' // (1) #___ can only be a Right Delimiter
+ '|notPunctSpace(_+)(?!_)(?=punctSpace|$)' // (2) a___#, a___ can only be a Right Delimiter
+ '|(?!_)punctSpace(_+)(?=notPunctSpace)' // (3) #___a, ___a can only be Left Delimiter
+ '|[\\s](_+)(?!_)(?=punct)' // (4) ___# can only be Left Delimiter
+ '|(?!_)punct(_+)(?!_)(?=punct)', 'gu') // (5) #___# can be either Left or Right Delimiter
  .replace(/notPunctSpace/g, _notPunctuationOrSpace)
  .replace(/punctSpace/g, _punctuationOrSpace)
  .replace(/punct/g, _punctuation)
  .getRegex();

// Pedantic: same rule 3/6 adjustments as emStrongRDelimAstPedantic (e.g. `_foo:_bar`).
const emStrongRDelimUndPedanticCore =
  '^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)' // Skip orphan inside strong
+ '|[^_]+(?=[^_])' // Consume to delim
+ '|(?!_)punct(_+)(?=[\\s]|$)' // (1) #___ can only be a Right Delimiter
+ '|notPunctSpace(_+)(?!_)(?=punctSpace|$)' // (2) a___#, a___ can only be a Right Delimiter
+ '|(?!_)[\\s](_+)(?=notPunctSpace)' // (3) ___a can only be Left Delimiter (whitespace required; not #___a)
+ '|[\\s](_+)(?!_)(?=punct)' // (4) ___# can only be Left Delimiter
+ '|(?!_)punct(_+)(?!_)(?=punct)' // (5) #___# can be either Left or Right Delimiter
+ '|(?:(?!_)punct|notPunctSpace)(_+)(?!_)(?=notPunctSpace)'; // (6) a___a, #___a, and :__ (e.g. _foo:_bar)

const emStrongRDelimUndPedantic = edit(emStrongRDelimUndPedanticCore, 'gu')
  .replace(/notPunctSpace/g, _notPunctuationOrSpace)
  .replace(/punctSpace/g, _punctuationOrSpace)
  .replace(/punct/g, _punctuation)
  .getRegex();

// Tilde left delimiter for strikethrough (similar to emStrongLDelim for asterisk)
const delLDelim = edit(/^~~?(?:((?!~)punct)|[^\s~])/, 'u')
  .replace(/punct/g, _punctuation)
  .getRegex();

// Tilde delimiter patterns for strikethrough (similar to asterisk)
const delRDelimCore =
  '^[^~]+(?=[^~])' // Consume to delim
+ '|(?!~)punct(~~?)(?=[\\s]|$)' // (1) #~~ can only be a Right Delimiter
+ '|notPunctSpace(~~?)(?!~)(?=punctSpace|$)' // (2) a~~#, a~~ can only be a Right Delimiter
+ '|(?!~)punctSpace(~~?)(?=notPunctSpace)' // (3) #~~a, ~~a can only be Left Delimiter
+ '|[\\s](~~?)(?!~)(?=punct)' // (4) ~~# can only be Left Delimiter
+ '|(?!~)punct(~~?)(?!~)(?=punct)' // (5) #~~# can be either Left or Right Delimiter
+ '|notPunctSpace(~~?)(?=notPunctSpace)'; // (6) a~~a can be either Left or Right Delimiter

const delRDelim = edit(delRDelimCore, 'gu')
  .replace(/notPunctSpace/g, _notPunctuationOrSpace)
  .replace(/punctSpace/g, _punctuationOrSpace)
  .replace(/punct/g, _punctuation)
  .getRegex();

const anyPunctuation = edit(/\\(punct)/, 'gu')
  .replace(/punct/g, _punctuation)
  .getRegex();

// `anyPunctuation` for the em/strong mask. A backslash is literal inside a code
// span, so a code span (matched like `inline.code`), or a backtick run that
// opens none, is matched whole and kept; only the escapes outside code spans
// are masked.
const anyPunctuationOutsideCode = edit(/(`+)(?:[^`]|[^`][\s\S]*?[^`])\1(?!`)|`+|\\(punct)/, 'gu')
  .replace(/punct/g, _punctuation)
  .getRegex();

const autolink = edit(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/)
  .replace('scheme', /[a-zA-Z][a-zA-Z0-9+.-]{1,31}/)
  .replace('email', /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/)
  .getRegex();

const _inlineComment = edit(_comment).replace('(?:-->|$)', '-->').getRegex();
const tag = edit(
  '^comment'
    + '|^</[a-zA-Z][a-zA-Z0-9-]*\\s*>' // self-closing tag
    + '|^<[a-zA-Z][a-zA-Z0-9-]*(?:attribute)*?\\s*/?>' // open tag
    + '|^<\\?[\\s\\S]*?\\?>' // processing instruction, e.g. <?php ?>
    + '|^<![a-zA-Z]+\\s[\\s\\S]*?>' // declaration, e.g. <!DOCTYPE html>
    + '|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>') // CDATA section
  .replace('comment', _inlineComment)
  .replace('attribute', /\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/)
  .getRegex();

// One matched pair of brackets, holding no bracket of its own.
const _inlineLabelBrackets = /\[(?:\\[\s\S]|[^\[\]\\])*\]/;
// CommonMark lets the brackets in a link label nest to any depth, which a regex
// cannot follow, so it stops at a fixed one. Two levels is what the spec suite
// asks for: a third and a fourth flip no further example.
const _inlineLabel = edit(/(?:\[(?:brackets|\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|`+(?!`)[^`]*?`+(?!`)|``+(?=\])|[^\[\]\\`])*?/)
  .replace('brackets', _inlineLabelBrackets)
  .getRegex();

const link = edit(/^!?\[(label)\]\([ \t\n]*(href)(?:(?:[ \t]+(?:\n[ \t]*)?|\n[ \t]*)(title))?[ \t\n]*\)/)
  .replace('label', _inlineLabel)
  .replace('href', /<(?:\\.|[^\n<>\\])+>|[^ \t\n\x00-\x1f]+|(?=\))/)
  // Same as the definition title: the escaped character is not the closer.
  .replace('title', /"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|\((?:\\[\s\S]|[^)\\])*\)/)
  .getRegex();

const reflink = edit(/^!?\[(label)\]\[(ref)\]/)
  .replace('label', _inlineLabel)
  .replace('ref', _blockLabel)
  .getRegex();

const nolink = edit(/^!?\[(ref)\](?:\[\])?/)
  .replace('ref', _blockLabel)
  .getRegex();

// `reflink` and `nolink` are anchored, so the tokenizer tries each of them at a
// single position. `reflinkSearch` drops the anchors and runs with the global
// flag, which makes every '[' in the source a start position. A label crosses a
// bracket only by escaping it, and nothing caps how often it does, so a
// candidate that can never match still scans to the end of the source and the
// whole pass costs O(n^2).
//
// The labels below bound that scan. `_boundedInlineLabel` limits how many
// escapes, code spans and nested brackets a link text may hold, leaving runs of
// ordinary characters unbounded so link text of any length is still found.
// `_boundedBlockLabel` limits the label itself to 999 items, which is every
// label CommonMark allows: "A link label can have at most 999 characters
// inside the square brackets."
const _boundedBlockLabel = /(?!\s*\])(?:\\[\s\S]|[^\[\]\\]){1,999}/;
const _boundedInlineLabel = edit(/(?:[^\[\]\\`]*(?:\[(?:brackets|\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|`+(?!`)[^`]*?`+(?!`)|``+(?=\]))){0,999}?[^\[\]\\`]*?/)
  .replace('brackets', _inlineLabelBrackets)
  .getRegex();

const reflinkSearch = edit('reflink|nolink(?!\\()', 'g')
  .replace('reflink', edit(/^!?\[(label)\]\[(ref)\]/)
    .replace('label', _boundedInlineLabel)
    .replace('ref', _boundedBlockLabel)
    .getRegex())
  .replace('nolink', edit(/^!?\[(ref)\](?:\[\])?/)
    .replace('ref', _boundedBlockLabel)
    .getRegex())
  .getRegex();

const _caseInsensitiveProtocol = /[hH][tT][tT][pP][sS]?|[fF][tT][pP]/;
const _extendedEmail = /[A-Za-z0-9._+-]+@[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![\w-])/;
const _extendedEmailProtocol = edit(/(?:mailto:email|xmpp:email(?:\/[A-Za-z0-9@.]+)?)/)
  .replace(/email/g, _extendedEmail)
  .getRegex();

/**
 * Normal Inline Grammar
 */

const inlineNormal = {
  _backpedal: noopTest, // only used for GFM url
  anyPunctuation,
  anyPunctuationOutsideCode,
  autolink,
  blockSkip,
  br,
  code: inlineCode,
  del: noopTest,
  delLDelim: noopTest,
  delRDelim: noopTest,
  emStrongLDelim,
  emStrongRDelimAst,
  emStrongRDelimUnd,
  escape,
  link,
  nolink,
  punctuation,
  reflink,
  reflinkSearch,
  tag,
  text: inlineText,
  url: noopTest,
};

                                            

/**
 * Pedantic Inline Grammar
 */

const inlinePedantic                             = {
  ...inlineNormal,
  emStrongLDelim: emStrongLDelimPedantic,
  emStrongRDelimAst: emStrongRDelimAstPedantic,
  emStrongRDelimUnd: emStrongRDelimUndPedantic,
  link: edit(/^!?\[(label)\]\((.*?)\)/)
    .replace('label', _inlineLabel)
    .getRegex(),
  reflink: edit(/^!?\[(label)\]\s*\[([^\]]*)\]/)
    .replace('label', _inlineLabel)
    .getRegex(),
};

/**
 * GFM Inline Grammar
 */

const inlineGfm                             = {
  ...inlineNormal,
  emStrongRDelimAst: emStrongRDelimAstGfm,
  emStrongLDelim: emStrongLDelimGfm,
  delLDelim,
  delRDelim,
  url: edit(/^emailProtocol|^((?:protocol):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/)
    .replace('emailProtocol', _extendedEmailProtocol)
    .replace('protocol', _caseInsensitiveProtocol)
    .replace('email', /[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![\w-])/)
    .getRegex(),
  _backpedal: /(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/,
  del: /^(~~?)(?=[^\s~])((?:\\[\s\S]|[^\\])*?(?:\\[\s\S]|[^\s~\\]))\1(?=[^~]|$)/,
  text: edit(/^(?:[^a-zA-Z0-9](?=emailProtocol)|(`+|~+|[^`~])(?:(?=[`~])|(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|protocol:\/\/|wwwStart|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9](?=emailProtocol)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@))))/)
    .replace('protocol', _caseInsensitiveProtocol)
    .replace(/emailProtocol/g, /(?:mailto|xmpp):/)
    // GFM: a www autolink starts only at the beginning of a line, after whitespace or after
    // `*`, `_`, `~` or `(`. Without lookbehind support, keep stopping at every `www.`.
    .replace('wwwStart', supportsLookbehind ? '(?<![^\\s*_~(])www\\.' : 'www\\.')
    .getRegex(),
};

/**
 * GFM + Line Breaks Inline Grammar
 */

const inlineBreaks                             = {
  ...inlineGfm,
  br: edit(br).replace('{2,}', '*').getRegex(),
  text: edit(inlineGfm.text)
    .replace('\\b_', '\\b_| {2,}\\n')
    .replace(/\{2,\}/g, '*')
    .getRegex(),
};

/**
 * exports
 */

const block = {
  normal: blockNormal,
  gfm: blockGfm,
  pedantic: blockPedantic,
};

const inline = {
  normal: inlineNormal,
  gfm: inlineGfm,
  breaks: inlineBreaks,
  pedantic: inlinePedantic,
};

                        
                     
                                  
                                    
 


// ==== helpers.ts ====


/**
 * Helpers
 */
const escapeReplacements                              = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};
const getEscapeReplacement = (ch        ) => escapeReplacements[ch];

function escapeHtmlEntities(html        , encode          ) {
  if (encode) {
    if (other.escapeTest.test(html)) {
      return html.replace(other.escapeReplace, getEscapeReplacement);
    }
  } else {
    if (other.escapeTestNoEncode.test(html)) {
      return html.replace(other.escapeReplaceNoEncode, getEscapeReplacement);
    }
  }

  return html;
}

/**
 * Numeric character references are recognized outside code and are equivalent to the
 * character they name. Values that are zero, out of range, or a surrogate become the
 * replacement character.
 */
function decodeNumericCharacterReferences(text        ) {
  if (!other.numericCharacterReference.test(text)) {
    return text;
  }
  // A decoded character must not join its neighbours into a new reference,
  // so every `&` that is not already one is escaped here.
  return text.replace(other.numericCharacterReferenceOrAmpersand, (ref        , dec         , hex         ) => {
    if (dec === undefined && hex === undefined) {
      return '&amp;';
    }
    const code = dec === undefined ? Number.parseInt(hex , 16) : Number.parseInt(dec, 10);
    if (code === 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) {
      return '�';
    }
    return code === 38 ? '&amp;' : String.fromCodePoint(code);
  });
}

function cleanUrl(href        ) {
  try {
    href = encodeURI(href).replace(other.percentDecode, '%');
  } catch {
    return null;
  }
  return href;
}

function splitCells(tableRow        , count         ) {
  // ensure that every cell-delimiting pipe has a space
  // before it to distinguish it from an escaped pipe
  const row = tableRow.replace(other.findPipe, (match, offset, str) => {
      let escaped = false;
      let curr = offset;
      while (--curr >= 0 && str[curr] === '\\') escaped = !escaped;
      if (escaped) {
        // odd number of slashes means | is escaped
        // so we leave it alone
        return '|';
      } else {
        // add space before unescaped |
        return ' |';
      }
    }),
    cells = row.split(other.splitPipe);
  let i = 0;

  // First/last cell in a row cannot be empty if it has no leading/trailing pipe
  if (!cells[0].trim()) {
    cells.shift();
  }
  if (cells.length > 0 && !cells.at(-1)?.trim()) {
    cells.pop();
  }

  if (count) {
    if (cells.length > count) {
      cells.splice(count);
    } else {
      while (cells.length < count) cells.push('');
    }
  }

  for (; i < cells.length; i++) {
    // leading or trailing whitespace is ignored per the gfm spec
    cells[i] = cells[i].trim().replace(other.slashPipe, '|');
  }
  return cells;
}

/**
 * Remove trailing 'c's. Equivalent to str.replace(/c*$/, '').
 * /c*$/ is vulnerable to REDOS.
 *
 * @param str
 * @param c
 * @param invert Remove suffix of non-c chars instead. Default falsey.
 */
function rtrim(str        , c        , invert          ) {
  const l = str.length;
  if (l === 0) {
    return '';
  }

  // Length of suffix matching the invert condition.
  let suffLen = 0;

  // Step left until we fail to match the invert condition.
  while (suffLen < l) {
    const currChar = str.charAt(l - suffLen - 1);
    if (currChar === c && !invert) {
      suffLen++;
    } else if (currChar !== c && invert) {
      suffLen++;
    } else {
      break;
    }
  }

  return str.slice(0, l - suffLen);
}

function trimTrailingBlankLines(str        ) {
  const lines = str.split('\n');
  let end = lines.length - 1;
  while (end >= 0 && other.blankLine.test(lines[end])) {
    end--;
  }
  if (lines.length - end <= 2) {
    // we want to keep single trailing blank lines
    return str;
  }

  return lines.slice(0, end + 1).join('\n');
}

/**
 * Normalizes a link label so definitions and references can be matched.
 * CommonMark asks for a Unicode case fold, which `toLowerCase()` does not
 * reach: `ẞ` lowercases to `ß` and so never meets `SS`. Round-tripping
 * through upper case does, as in commonmark.js; the final `toLowerCase()`
 * keeps the folded label lower case, the form `def.tag` has always used.
 */
function normalizeLabel(label        ) {
  // The spec also asks for leading and trailing spaces, tabs and line endings
  // to be stripped, and for internal runs of them to collapse to one space.
  // Doing it here keeps every call site in agreement: the definition and the
  // reference have to normalize to the same key.
  return label.trim().replace(other.multipleSpaceGlobal, ' ').toLowerCase().toUpperCase().toLowerCase();
}

function findClosingBracket(str        , b        ) {
  // an opening bracket on its own is still unbalanced, so both have to be absent
  if (str.indexOf(b[0]) === -1 && str.indexOf(b[1]) === -1) {
    return -1;
  }

  let level = 0;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '\\') {
      i++;
    } else if (str[i] === b[0]) {
      level++;
    } else if (str[i] === b[1]) {
      level--;
      if (level < 0) {
        return i;
      }
    }
  }
  if (level > 0) {
    return -2;
  }

  return -1;
}

                                           
                                                                      
              
                                                                      
            
 

/**
 * Closer hints for one inline `maskedSrc`. Held only while that pass runs.
 */
                                      
                    
                                                                   
                                                                 
                                     
 

/**
 * Hint stacks for inline passes currently running. Keyed by the tokenizer
 * instance so parses do not share frames. Nested `inlineTokens` calls push
 * a frame. The entry is removed when the outermost pass ends, so
 * `maskedSrc` is not retained once parsing returns (#4099).
 */
const emStrongDelCloserHintStacks = new WeakMap                                      ();

/**
 * Last indexes of `*` / `_` runs that can close emphasis or strong, and of
 * a `~` run that can close strikethrough.
 *
 * A run can close only when it is not preceded by ASCII whitespace or the
 * start of the string. The right-delim regexes accept a closer only in
 * groups 1, 2, 5, and 6, and each of those requires that predecessor. When
 * the opener's window has no such run, the regex scan cannot succeed.
 * Finding one only means "keep looking": CommonMark rules 9–10 and mid-run
 * openers are still applied in the loop (#4099).
 */
function scanLastPossibleEmStrongDelClosers(src        )                             {
  const lastPossibleEmStrongCloserIndex                                  = { '*': -1, _: -1 };
  let lastPossibleDelCloserIndex = -1;
  const len = src.length;
  for (let i = 0; i < len; i++) {
    const ch = src[i];
    if (ch !== '*' && ch !== '_' && ch !== '~') {
      continue;
    }
    // A leading run has no predecessor, same as one after a line break.
    const prev = i === 0 ? '\n' : src[i - 1];
    let j = i + 1;
    while (j < len && src[j] === ch) {
      j++;
    }
    if (prev !== ' ' && prev !== '\t' && prev !== '\n' && prev !== '\r' && prev !== '\f') {
      if (ch === '~') {
        lastPossibleDelCloserIndex = i;
      } else {
        lastPossibleEmStrongCloserIndex[ch] = i;
      }
    }
    i = j - 1;
  }
  return {
    maskedSrc: src,
    lastPossibleEmStrongCloserIndex,
    lastPossibleDelCloserIndex,
  };
}

/**
 * Scan `maskedSrc` once for the last `*` / `_` run that can close emphasis
 * or strong and the last `~` run that can close strikethrough.
 * `endEmStrongDelCloserScan` drops this frame when the inline pass ends.
 */
function beginEmStrongDelCloserScan(tokenizer        , maskedSrc        )       {
  const frame = scanLastPossibleEmStrongDelClosers(maskedSrc);
  const stack = emStrongDelCloserHintStacks.get(tokenizer);
  if (stack) {
    stack.push(frame);
  } else {
    emStrongDelCloserHintStacks.set(tokenizer, [frame]);
  }
}

/**
 * Drop the closer-hint frame for the inline pass that just finished.
 * Removing the last frame drops the tokenizer's `maskedSrc` reference.
 */
function endEmStrongDelCloserScan(tokenizer        )       {
  const stack = emStrongDelCloserHintStacks.get(tokenizer);
  if (!stack) {
    return;
  }
  stack.pop();
  if (stack.length === 0) {
    emStrongDelCloserHintStacks.delete(tokenizer);
  }
}

/**
 * Index in `maskedSrc` of the last `*` or `_` run that can close emphasis
 * or strong. Uses the active inline-pass scan when `maskedSrc` is that
 * pass's source; otherwise scans this string and discards the result.
 */
function cachedLastPossibleEmStrongCloserIndex(tokenizer        , maskedSrc        , delim           )         {
  const frame = emStrongDelCloserHintStacks.get(tokenizer)?.at(-1);
  if (frame && frame.maskedSrc === maskedSrc) {
    return frame.lastPossibleEmStrongCloserIndex[delim];
  }
  return scanLastPossibleEmStrongDelClosers(maskedSrc).lastPossibleEmStrongCloserIndex[delim];
}

/**
 * Index in `maskedSrc` of the last `~` run that can close strikethrough.
 * Uses the active inline-pass scan when `maskedSrc` is that pass's
 * source; otherwise scans this string and discards the result.
 */
function cachedLastPossibleDelCloserIndex(tokenizer        , maskedSrc        )         {
  const frame = emStrongDelCloserHintStacks.get(tokenizer)?.at(-1);
  if (frame && frame.maskedSrc === maskedSrc) {
    return frame.lastPossibleDelCloserIndex;
  }
  return scanLastPossibleEmStrongDelClosers(maskedSrc).lastPossibleDelCloserIndex;
}

function expandTabs(line        , indent = 0) {
  let col = indent;
  let expanded = '';
  for (const char of line) {
    if (char === '\t') {
      const added = 4 - (col % 4);
      expanded += ' '.repeat(added);
      col += added;
    } else {
      expanded += char;
      col++;
    }
  }

  return expanded;
}


// ==== defaults.ts ====
                                                        

/**
 * Gets the original marked default options.
 */
function _getDefaults                                                ()                                              {
  return {
    async: false,
    breaks: false,
    extensions: null,
    gfm: true,
    hooks: null,
    pedantic: false,
    renderer: null,
    silent: false,
    tokenizer: null,
    walkTokens: null,
  };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _defaults                          = _getDefaults();

function changeDefaults                                                (newDefaults                                             ) {
  _defaults = newDefaults;
}


// ==== TextRenderer.ts ====
                                          
                                           

/**
 * TextRenderer
 * returns only the textual part of the token
 */
class _TextRenderer                          {
  parser                                   ;
  // no need for block level renderers
  strong({ text, tokens }               )                 {
    return (tokens ? this.parser.parseInline(tokens, this) : text)                  ;
  }

  em({ text, tokens }           )                 {
    return (tokens ? this.parser.parseInline(tokens, this) : text)                  ;
  }

  codespan({ text }                 )                 {
    return text                  ;
  }

  del({ text, tokens }            )                 {
    return (tokens ? this.parser.parseInline(tokens, this) : text)                  ;
  }

  html({ text }                          )                 {
    return text                  ;
  }

  text({ text }                                          )                 {
    return text                  ;
  }

  link({ text, tokens }             )                 {
    return (tokens ? this.parser.parseInline(tokens, this) : text)                  ;
  }

  image({ text, tokens }              )                 {
    return (tokens ? this.parser.parseInline(tokens, this) : text)                  ;
  }

  br()                 {
    return ''                  ;
  }

  checkbox({ raw }                 )                 {
    return raw                  ;
  }
}


// ==== Renderer.ts ====

                                                        
                                          
                                           

/**
 * Renderer
 */
class _Renderer                                                 {
  options                                             ;
  parser                                        ; // set by the parser
  constructor(options                                              ) {
    this.options = options || _defaults;
  }

  space(token              )                 {
    return ''                  ;
  }

  code({ text, lang, escaped }             )                 {
    const langString = (lang || '').match(other.notSpaceStart)?.[0];

    // An empty code block has no content, so it must not gain a newline.
    const code = text ? text.replace(other.endingNewline, '') + '\n' : '';

    if (!langString) {
      return '<pre><code>'
        + (escaped ? code : escapeHtmlEntities(code, true))
        + '</code></pre>\n'                  ;
    }

    return '<pre><code class="language-'
      + escapeHtmlEntities(langString)
      + '">'
      + (escaped ? code : escapeHtmlEntities(code, true))
      + '</code></pre>\n'                  ;
  }

  blockquote({ tokens }                   )                 {
    const body = this.parser.parse(tokens);
    return `<blockquote>\n${body}</blockquote>\n`                  ;
  }

  html({ text }                          )                 {
    return text                  ;
  }

  def(token            )                 {
    return ''                  ;
  }

  heading({ tokens, depth }                )                 {
    return `<h${depth}>${this.parser.parseInline(tokens)}</h${depth}>\n`                  ;
  }

  hr(token           )                 {
    return '<hr>\n'                  ;
  }

  list(token             )                 {
    const ordered = token.ordered;
    const start = token.start;

    let body = '';
    for (let j = 0; j < token.items.length; j++) {
      const item = token.items[j];
      body += this.listitem(item);
    }

    const type = ordered ? 'ol' : 'ul';
    const startAttr = (ordered && start !== 1) ? (' start="' + start + '"') : '';
    return '<' + type + startAttr + '>\n' + body + '</' + type + '>\n'                  ;
  }

  listitem(item                 )                 {
    return `<li>${this.parser.parse(item.tokens)}</li>\n`                  ;
  }

  checkbox({ checked }                 )                 {
    return '<input '
      + (checked ? 'checked="" ' : '')
      + 'disabled="" type="checkbox"> '                  ;
  }

  paragraph({ tokens }                  )                 {
    return `<p>${this.parser.parseInline(tokens)}</p>\n`                  ;
  }

  table(token              )                 {
    let header = '';

    // header
    let cell = '';
    for (let j = 0; j < token.header.length; j++) {
      cell += this.tablecell(token.header[j]);
    }
    header += this.tablerow({ text: cell                 });

    let body = '';
    for (let j = 0; j < token.rows.length; j++) {
      const row = token.rows[j];

      cell = '';
      for (let k = 0; k < row.length; k++) {
        cell += this.tablecell(row[k]);
      }

      body += this.tablerow({ text: cell                 });
    }
    if (body) body = `<tbody>${body}</tbody>`;

    return '<table>\n'
      + '<thead>\n'
      + header
      + '</thead>\n'
      + body
      + '</table>\n'                  ;
  }

  tablerow({ text }                               )                 {
    return `<tr>\n${text}</tr>\n`                  ;
  }

  tablecell(token                  )                 {
    const content = this.parser.parseInline(token.tokens);
    const type = token.header ? 'th' : 'td';
    const tag = token.align
      ? `<${type} align="${token.align}">`
      : `<${type}>`;
    return tag + content + `</${type}>\n`                  ;
  }

  /**
   * span level renderer
   */
  strong({ tokens }               )                 {
    return `<strong>${this.parser.parseInline(tokens)}</strong>`                  ;
  }

  em({ tokens }           )                 {
    return `<em>${this.parser.parseInline(tokens)}</em>`                  ;
  }

  codespan({ text }                 )                 {
    return `<code>${escapeHtmlEntities(text, true)}</code>`                  ;
  }

  br(token           )                 {
    return '<br>'                  ;
  }

  del({ tokens }            )                 {
    return `<del>${this.parser.parseInline(tokens)}</del>`                  ;
  }

  link({ href, title, text, tokens, autolink }             )                 {
    // References are not resolved inside an autolink, so every `&` there is
    // literal. Elsewhere only an `&` that cannot start one needs escaping.
    const parsedText = autolink
      ? escapeHtmlEntities(text, true)
      : this.parser.parseInline(tokens)          ;
    const cleanHref = cleanUrl(href);
    if (cleanHref === null) {
      return parsedText                  ;
    }
    href = escapeHtmlEntities(cleanHref, autolink);
    let out = '<a href="' + href + '"';
    if (title) {
      out += ' title="' + (escapeHtmlEntities(title)) + '"';
    }
    out += '>' + parsedText + '</a>';
    return out                  ;
  }

  image({ href, title, text, tokens }              )                 {
    if (tokens) {
      text = this.parser.parseInline(tokens, this.parser.textRenderer)          ;
    }
    const cleanHref = cleanUrl(href);
    if (cleanHref === null) {
      return escapeHtmlEntities(text)                  ;
    }
    href = cleanHref;

    let out = `<img src="${escapeHtmlEntities(href)}" alt="${escapeHtmlEntities(text)}"`;
    if (title) {
      out += ` title="${escapeHtmlEntities(title)}"`;
    }
    out += '>';
    return out                  ;
  }

  text(token                             )                 {
    return 'tokens' in token && token.tokens
      ? this.parser.parseInline(token.tokens)                             
      : ('escaped' in token && token.escaped ? token.text                   : escapeHtmlEntities(token.text)                  );
  }
}


// ==== Tokenizer.ts ====

                                        
                                         
                                                        
                                                        

function outputLink(cap          , link                                     , raw        , lexer        , rules       )                                         {
  const href = link.href;
  const title = link.title || null;
  const text = cap[1].replace(rules.other.outputLinkReplace, '$1');
  const isImage = cap[0].charAt(0) === '!';

  const outerInLink = lexer.state.inLink;
  const outerLinkEmitted = lexer.state.linkEmitted;
  const outerInRawBlock = lexer.state.inRawBlock;
  lexer.state.inLink = true;
  lexer.state.linkEmitted = false;
  const tokens = lexer.inlineTokens(text);
  const textHasLink = lexer.state.linkEmitted;
  lexer.state.linkEmitted = outerLinkEmitted;
  lexer.state.inLink = outerInLink;

  if (!isImage) {
    // CommonMark: "Links may not contain other links, at any level of nesting."
    // Bail so the caller falls through to text and the inner link is the one kept.
    // Images are exempt: their text is flattened into an alt attribute.
    if (textHasLink) {
      // these tokens are discarded, so undo the raw-block state they opened;
      // leaving it set would suppress escaping for the text that is re-scanned
      lexer.state.inRawBlock = outerInRawBlock;
      return;
    }
    lexer.state.linkEmitted = true;
  }

  return {
    type: isImage ? 'image' : 'link',
    raw,
    href,
    title,
    text,
    tokens,
  };
}

function indentCodeCompensation(raw        , text        , rules       ) {
  const matchIndentToCode = raw.match(rules.other.indentCodeCompensation);

  if (matchIndentToCode === null) {
    return text;
  }

  const indentToCode = matchIndentToCode[1];

  return text
    .split('\n')
    .map(node => {
      const matchIndentInNode = node.match(rules.other.beginningSpace);
      if (matchIndentInNode === null) {
        return node;
      }

      const [indentInNode] = matchIndentInNode;

      // Up to the fence's own indentation is removed from each line, so a line
      // indented less than the fence loses whatever indentation it has.
      return node.slice(Math.min(indentInNode.length, indentToCode.length));
    })
    .join('\n');
}

function isLabelEndInsideToken(src        , label        , labelStart        , rules       ) {
  if (!label.includes('<')) {
    return false;
  }

  for (let i = 0; i < label.length; i++) {
    if (label[i] === '\\') {
      i++;
      continue;
    }

    if (label[i] === '`') {
      const code = rules.inline.code.exec(label.slice(i));
      if (code) {
        i += code[0].length - 1;
        continue;
      }
    }

    if (label[i] !== '<') {
      continue;
    }

    const tokenSrc = src.slice(labelStart + i);
    const token = rules.inline.tag.exec(tokenSrc) || rules.inline.autolink.exec(tokenSrc);
    if (!token) {
      continue;
    }

    if (token[0].length > label.length - i) {
      return true;
    }
    i += token[0].length - 1;
  }
  return false;
}

/**
 * Tokenizer
 */
// ==== fast line helpers (used by the list tokenizer) ====
// First line of s (no array allocation like split('\n', 1)[0]).
function _firstLine(s) {
  const nl = s.indexOf('\n');
  return nl === -1 ? s : s.slice(0, nl);
}
// True when s is empty or all whitespace (same set as String.trim).
function _isBlank(s) {
  for (let i = 0; i < s.length; i++) {
    const cc = s.charCodeAt(i);
    if (cc === 32 || cc === 9 || cc === 10 || cc === 13 || cc === 11 || cc === 12) continue;
    if (cc >= 128 && /\s/.test(s[i])) continue;
    return false;
  }
  return true;
}
// Index of the first char not in [ \t\n\v\f\r] (the nonSpaceChar regex).
function _firstNonWS(s) {
  for (let i = 0; i < s.length; i++) {
    const cc = s.charCodeAt(i);
    if (cc === 32 || cc === 9 || cc === 10 || cc === 13 || cc === 11 || cc === 12) continue;
    return i;
  }
  return s.length;
}
// Width of the leading whitespace, counting a tab as 4 (as if every tab
// were replaced by 4 spaces first, then the first non-space char is sought).
function _indentWidth(s) {
  let w = 0;
  for (let i = 0; i < s.length; i++) {
    const cc = s.charCodeAt(i);
    if (cc === 32) w++;
    else if (cc === 9) w += 4;
    else if (cc === 10 || cc === 11 || cc === 12 || cc === 13) w++;
    else break;
  }
  return w;
}
// Leading spaces + first non-space char code of a line (-1 when all spaces).
function _lineLead(s) {
  let lead = 0;
  while (lead < s.length && s.charCodeAt(lead) === 32) lead++;
  return { lead, ch: lead < s.length ? s.charCodeAt(lead) : -1 };
}

class _Tokenizer                                                 {
  options                                             ;
  rules        ; // set by the lexer
  lexer                                       ; // set by the lexer

  constructor(options                                              ) {
    this.options = options || _defaults;
  }

  space(src        )                           {
    const cap = this.rules.block.newline.exec(src);
    if (cap && cap[0].length > 0) {
      return {
        type: 'space',
        raw: cap[0],
      };
    }
  }

  code(src        )                          {
    const cap = this.rules.block.code.exec(src);
    if (cap) {
      const raw = this.options.pedantic
        ? cap[0]
        : trimTrailingBlankLines(cap[0]);
      const text = raw.replace(this.rules.other.codeRemoveIndent, '');
      return {
        type: 'code',
        raw,
        codeBlockStyle: 'indented',
        text,
      };
    }
  }

  fences(src        )                          {
    const cap = this.rules.block.fences.exec(src);
    if (cap) {
      const raw = cap[0];
      const text = indentCodeCompensation(raw, cap[3] || '', this.rules);

      return {
        type: 'code',
        raw,
        lang: cap[2] ? cap[2].trim().replace(this.rules.inline.anyPunctuation, '$1') : cap[2],
        text,
      };
    }
  }

  heading(src        )                             {
    const cap = this.rules.block.heading.exec(src);
    if (cap) {
      let text = cap[2].trim();

      // remove trailing #s
      if (this.rules.other.endingHash.test(text)) {
        const trimmed = rtrim(text, '#');
        if (this.options.pedantic) {
          text = trimmed.trim();
        } else if (!trimmed || this.rules.other.endingSpaceTabChar.test(trimmed)) {
          // CommonMark requires a space or tab before trailing #s
          text = trimmed.trim();
        }
      }

      return {
        type: 'heading',
        raw: rtrim(cap[0], '\n'),
        depth: cap[1].length,
        text,
        tokens: this.lexer.inline(text),
      };
    }
  }

  hr(src        )                        {
    const cap = this.rules.block.hr.exec(src);
    if (cap) {
      return {
        type: 'hr',
        raw: rtrim(cap[0], '\n'),
      };
    }
  }

  blockquote(src        )                                {
    const cap = this.rules.block.blockquote.exec(src);
    if (cap) {
      let lines = rtrim(cap[0], '\n').split('\n');
      let raw = '';
      let text = '';
      const tokens          = [];

      while (lines.length > 0) {
        let inBlockquote = false;
        const currentLines = [];

        let i;
        for (i = 0; i < lines.length; i++) {
          // get lines up to a continuation
          if (this.rules.other.blockquoteStart.test(lines[i])) {
            currentLines.push(lines[i]);
            inBlockquote = true;
          } else if (!inBlockquote) {
            currentLines.push(lines[i]);
          } else {
            break;
          }
        }
        lines = lines.slice(i);

        const currentRaw = currentLines.join('\n');
        const currentText = currentRaw
          // a tab after the block quote marker runs to the next tab stop, and
          // the marker only consumes one space of it; the rest is content
          .replace(
            this.rules.other.blockquoteMarkerWhitespace,
            (_, marker        , whitespace        ) => marker + expandTabs(whitespace, marker.length),
          )
          // precede setext continuation with 4 spaces so it isn't a setext
          .replace(this.rules.other.blockquoteSetextReplace, '\n    $1')
          .replace(this.rules.other.blockquoteSetextReplace2, '');
        raw = raw ? `${raw}\n${currentRaw}` : currentRaw;
        text = text ? `${text}\n${currentText}` : currentText;

        // parse blockquote lines as top level tokens
        // merge paragraphs if this is a continuation
        const top = this.lexer.state.top;
        this.lexer.state.top = true;
        this.lexer.blockTokens(currentText, tokens, true);
        this.lexer.state.top = top;

        // if there is no continuation then we are done
        if (lines.length === 0) {
          break;
        }

        const lastToken = tokens.at(-1);

        if (lastToken?.type === 'code' || lastToken?.type === 'heading' || lastToken?.type === 'hr' || lastToken?.type === 'html' || lastToken?.type === 'table') {
          // blockquote continuation cannot be preceded by a code block, heading, hr, html block or table
          break;
        } else if (lastToken?.type === 'blockquote') {
          // include continuation in nested blockquote
          const oldToken = lastToken                     ;
          // The continuation lines belong to the same nesting frame as the
          // nested blockquote, which already had one '>' marker stripped, so
          // strip one marker from them too. Otherwise a restated marker after a
          // lazy line is re-parsed as a spurious deeper blockquote.
          const continuation = lines.join('\n');
          const newText = oldToken.raw + '\n' + continuation.replace(this.rules.other.blockquoteSetextReplace2, '');
          const newToken = this.blockquote(newText) ;
          tokens[tokens.length - 1] = newToken;

          // Only include continuation lines the nested blockquote actually
          // consumed. Unconsumed trailing lines must stay out of `raw` so the
          // lexer can still tokenize them (paragraph, next blockquote, etc.).
          const leftover = newText.substring(newToken.raw.length).replace(/^\n/, '');
          const leftoverCount = leftover ? leftover.split('\n').length : 0;
          const consumed = leftoverCount ? lines.slice(0, -leftoverCount) : lines;
          if (consumed.length > 0) {
            raw = `${raw}\n${consumed.join('\n')}`;
          }
          text = text.substring(0, text.length - oldToken.text.length) + newToken.text;

          // A leftover line that starts with '>' still belongs to this
          // blockquote; any other leftover line ends it.
          lines = lines.slice(consumed.length);
          if (lines.length > 0 && this.rules.other.blockquoteStart.test(lines[0])) {
            continue;
          }
          break;
        } else if (lastToken?.type === 'list') {
          // include continuation in nested list
          const oldToken = lastToken               ;
          const newText = oldToken.raw + '\n' + lines.join('\n');
          const newToken = this.list(newText) ;
          tokens[tokens.length - 1] = newToken;

          // The list raw has no '>' markers, so it cannot be cut out of `raw`.
          // Count the continuation lines the list took and add those lines instead.
          const consumedCount = newToken.raw.length > oldToken.raw.length
            ? newText.slice(oldToken.raw.length + 1, newToken.raw.length).split('\n').length
            : 0;
          if (consumedCount > 0) {
            const consumed = lines.slice(0, consumedCount).join('\n');
            raw = `${raw}\n${consumed}`;
            text = `${text}\n${consumed}`;
          }
          lines = lines.slice(consumedCount);
          continue;
        }
      }

      return {
        type: 'blockquote',
        raw,
        tokens,
        text,
      };
    }
  }

  list(src        )                          {
    let cap = this.rules.block.list.exec(src);
    if (cap) {
      // src is only consumed from the front, so every raw below is a slice of
      // listSrc rather than a string built up line by line
      const listSrc = src;
      const taken = () => listSrc.length - src.length;
      let bull = cap[1].trim();
      const isordered = bull.length > 1;

      const list              = {
        type: 'list',
        raw: '',
        ordered: isordered,
        start: isordered ? +bull.slice(0, -1) : '',
        loose: false,
        items: [],
      };

      bull = isordered ? `\\d{1,9}\\${bull.slice(-1)}` : `\\${bull}`;

      // Get next list item
      const itemRegex = this.rules.other.listItemRegex(bull);
      let endsWithBlankLine = false;
      // Check if current bullet point can start a new List Item
      while (src) {
        let endEarly = false;
        // Item lines are collected and joined once: repeated '+= \n' on the
        // growing string copies it every line (quadratic for long items).
        const itemParts = [];
        if (!(cap = itemRegex.exec(src))) {
          break;
        }

        // End list if bullet was actually HR (fast pre-check: hr can only
        // start with -, _ or * after at most 3 spaces)
        const _hrLead = _lineLead(src);
        if ((_hrLead.ch === 45 || _hrLead.ch === 95 || _hrLead.ch === 42) && _hrLead.lead <= 3
          && this.rules.block.hr.test(src)) {
          break;
        }

        const itemStart = taken();
        src = src.substring(cap[0].length);

        const firstLine = _firstLine(cap[2]);
        const bulletIndent = cap[1].length;
        // Expand leading tabs of the first line only when it has any
        let line;
        {
          let k = 0, hasTab = false;
          while (k < firstLine.length) {
            const cc = firstLine.charCodeAt(k);
            if (cc === 32) k++;
            else if (cc === 9) { hasTab = true; break; }
            else break;
          }
          line = hasTab
            ? firstLine.replace(this.rules.other.leadingSpaceTab, whitespace => expandTabs(whitespace, bulletIndent))
            : firstLine;
        }
        let nextLine = _firstLine(src);
        let blankLine = _isBlank(line);
        const firstLineBlank = blankLine;

        let indent = 0;
        if (blankLine) {
          indent = bulletIndent + 1;
        } else {
          indent = _firstNonWS(line); // Find first non-space char
          indent = indent > 4 ? 1 : indent; // Treat indented code blocks (> 4 spaces) as having only 1 indent
          itemParts.push(line.slice(indent));
          indent += bulletIndent;
        }

        if (blankLine && _isBlank(nextLine)) { // Items begin with at most one blank line
          src = src.substring(nextLine.length + 1);
          endEarly = true;
        }

        if (!endEarly) {
          const nextBulletRegex = this.rules.other.nextBulletRegex(indent);
          const hrRegex = this.rules.other.hrRegex(indent);
          const fencesBeginRegex = this.rules.other.fencesBeginRegex(indent);
          const headingBeginRegex = this.rules.other.headingBeginRegex(indent);
          const htmlBeginRegex = this.rules.other.htmlBeginRegex(indent);
          const blockquoteBeginRegex = this.rules.other.blockquoteBeginRegex(indent);

          // Check if following lines should be included in List Item
          while (src) {
            const nl = src.indexOf('\n');
            const rawLine = nl === -1 ? src : src.slice(0, nl);
            nextLine = rawLine;

            // Leading spaces + first non-space char (a tab stops the scan:
            // every break regex below needs spaces then its construct char)
            let lead = 0;
            while (lead < rawLine.length && rawLine.charCodeAt(lead) === 32) lead++;
            const ch = lead < rawLine.length ? rawLine.charCodeAt(lead) : -1;

            // Expand leading tabs only when the line's leading whitespace has one
            let nextLineWithoutTabs = nextLine;
            if (ch === 9) {
              nextLineWithoutTabs = nextLine.replace(this.rules.other.leadingSpaceTab, whitespace => expandTabs(whitespace));
            }

            // Break checks, dispatched on the first char (each regex can only
            // match when the line starts with its construct, within `indent` spaces)
            if (lead <= indent) {
              if (ch === 96 || ch === 126) { // ` or ~: fences
                if (fencesBeginRegex.test(nextLine)) break;
              } else if (ch === 35) { // #: heading
                if (headingBeginRegex.test(nextLine)) break;
              } else if (ch === 60) { // <: html block
                if (htmlBeginRegex.test(nextLine)) break;
              } else if (ch === 62) { // >: blockquote
                if (blockquoteBeginRegex.test(nextLine)) break;
              } else if (ch === 42 || ch === 43 || ch === 45 || (ch >= 48 && ch <= 57)) { // * + - digit: bullet or hr
                if (nextBulletRegex.test(nextLine)) break;
                if (hrRegex.test(nextLine)) break;
              } else if (ch === 95) { // _: hr
                if (hrRegex.test(nextLine)) break;
              }
            }

            // First non-whitespace position of the (tab-expanded) line
            let firstNW;
            if (ch === 9 || ch === 11 || ch === 12 || ch === 13 || ch === 10) {
              firstNW = _firstNonWS(nextLineWithoutTabs);
            } else if (ch === -1) {
              firstNW = nextLineWithoutTabs.length;
            } else {
              firstNW = lead;
            }
            if (firstNW >= indent || _isBlank(nextLine)) { // Dedent if possible
              itemParts.push(nextLineWithoutTabs.slice(indent));
            } else {
              // not enough indentation
              if (blankLine) {
                break;
              }

              // paragraph continuation unless last line was a different block level element
              if (_indentWidth(line) >= 4) { // indented code block
                break;
              }
              const ll = _lineLead(line);
              if (ll.lead <= indent) {
                if (ll.ch === 96 || ll.ch === 126) {
                  if (fencesBeginRegex.test(line)) break;
                } else if (ll.ch === 35) {
                  if (headingBeginRegex.test(line)) break;
                } else if (ll.ch === 60) {
                  if (htmlBeginRegex.test(line)) break;
                } else if (ll.ch === 45 || ll.ch === 95 || ll.ch === 42) {
                  if (hrRegex.test(line)) break;
                }
              }

              // A lazy continuation can look like a setext underline after
              // list indentation is removed. Keep it in the paragraph.
              const setextContinuation = /^ {0,3}(?:=+|-+) *$/.test(nextLine)
                && this.rules.block.lheading.test(`${line}\n${nextLine}`);
              const continuation = setextContinuation
                ? `    ${nextLineWithoutTabs.replace(/^ {0,3}/, '')}`
                : nextLine;
              itemParts.push(continuation);
            }

            blankLine = _isBlank(nextLine);

            src = src.substring(rawLine.length + 1);
            line = nextLineWithoutTabs.slice(indent);
          }
        }

        // Join the collected lines. A blank first line means the original
        // started with a '\n' before the first appended line.
        let itemContents = itemParts.join('\n');
        if (firstLineBlank && itemParts.length > 0) itemContents = '\n' + itemContents;

        // The loops above appended a '\n' the source may not have had. It could
        // only land on the item that exhausts src, whose raw is trimmed below,
        // and after which nothing reads endsWithBlankLine
        const raw = listSrc.slice(itemStart, taken());

        if (!list.loose) {
          // If the previous item ended with a blank line, the list is loose
          if (endsWithBlankLine) {
            list.loose = true;
          } else if (this.rules.other.doubleBlankLine.test(raw)) {
            endsWithBlankLine = true;
          }
        }

        list.items.push({
          type: 'list_item',
          raw,
          task: !!this.options.gfm && this.rules.other.listIsTask.test(itemContents),
          loose: false,
          text: itemContents,
          tokens: [],
        });
      }

      // Do not consume newlines at end of final item. Alternatively, make itemRegex *start* with any newlines to simplify/speed up endsWithBlankLine logic
      const lastItem = list.items.at(-1);
      if (lastItem) {
        lastItem.raw = lastItem.raw.trimEnd();
        lastItem.text = lastItem.text.trimEnd();
      } else {
        // not a list since there were no items
        return;
      }
      list.raw = listSrc.slice(0, taken()).trimEnd();

      // Item child tokens handled here at end because we needed to have the final item to trim it first
      // First pass: tokenize items and finalize list.loose from spacers before placing checkboxes
      for (const item of list.items) {
        this.lexer.state.top = false;
        item.tokens = this.lexer.blockTokens(item.text, []);

        if (!list.loose) {
          // Check if list should be loose
          const spacers = item.tokens.filter(t => t.type === 'space');
          const hasMultipleLineBreaks = spacers.length > 0 && spacers.some(t => this.rules.other.anyLine.test(t.raw));

          list.loose = hasMultipleLineBreaks;
        }
      }

      // Second pass: place task checkboxes using the final list.loose
      for (const item of list.items) {
        const itemToken = item.tokens[0];
        if (item.task && (itemToken?.type === 'text' || itemToken?.type === 'paragraph')) {
          // Remove checkbox markdown from item tokens
          item.text = item.text.replace(this.rules.other.listReplaceTask, '');
          itemToken.raw = itemToken.raw.replace(this.rules.other.listReplaceTask, '');
          itemToken.text = itemToken.text.replace(this.rules.other.listReplaceTask, '');
          for (let i = this.lexer.inlineQueue.length - 1; i >= 0; i--) {
            if (this.rules.other.listIsTask.test(this.lexer.inlineQueue[i].src)) {
              this.lexer.inlineQueue[i].src = this.lexer.inlineQueue[i].src.replace(this.rules.other.listReplaceTask, '');
              break;
            }
          }

          const taskRaw = this.rules.other.listTaskCheckbox.exec(item.raw);
          if (taskRaw) {
            const checkboxToken                  = {
              type: 'checkbox',
              raw: taskRaw[0] + ' ',
              checked: taskRaw[0] !== '[ ]',
            };
            item.checked = checkboxToken.checked;
            if (list.loose) {
              if (item.tokens[0] && ['paragraph', 'text'].includes(item.tokens[0].type) && 'tokens' in item.tokens[0] && item.tokens[0].tokens) {
                item.tokens[0].raw = checkboxToken.raw + item.tokens[0].raw;
                item.tokens[0].text = checkboxToken.raw + item.tokens[0].text;
                item.tokens[0].tokens.unshift(checkboxToken);
              } else {
                item.tokens.unshift({
                  type: 'paragraph',
                  raw: checkboxToken.raw,
                  text: checkboxToken.raw,
                  tokens: [checkboxToken],
                });
              }
            } else {
              item.tokens.unshift(checkboxToken);
            }
          }
        } else if (item.task) {
          item.task = false;
        }
      }

      // Set all items to loose if list is loose
      if (list.loose) {
        for (const item of list.items) {
          item.loose = true;
          for (const token of item.tokens) {
            if (token.type === 'text') {
              token.type = 'paragraph';
            }
          }
        }
      }

      return list;
    }
  }

  html(src        )                          {
    const cap = this.rules.block.html.exec(src);
    if (cap) {
      const raw = trimTrailingBlankLines(cap[0]);
      const token              = {
        type: 'html',
        block: true,
        raw,
        pre: cap[1] === 'pre' || cap[1] === 'script' || cap[1] === 'style',
        text: raw,
      };
      return token;
    }
  }

  def(src        )                         {
    const cap = this.rules.block.def.exec(src);
    if (cap) {
      // outside angle brackets a link destination holds only balanced parentheses
      if (!this.rules.other.startAngleBracket.test(cap[2]) && findClosingBracket(cap[2], '()') !== -1) {
        return;
      }

      const tag = normalizeLabel(cap[1]);
      const href = cap[2] ? cap[2].replace(this.rules.other.hrefBrackets, '$1').replace(this.rules.inline.anyPunctuation, '$1') : '';
      const title = cap[3] ? cap[3].substring(1, cap[3].length - 1).replace(this.rules.inline.anyPunctuation, '$1') : cap[3];
      return {
        type: 'def',
        tag,
        raw: rtrim(cap[0], '\n'),
        href,
        title,
      };
    }
  }

  table(src        )                           {
    const cap = this.rules.block.table.exec(src);
    if (!cap) {
      return;
    }

    if (!this.rules.other.tableDelimiter.test(cap[2])) {
      // delimiter row must have a pipe (|) or colon (:) otherwise it is a setext heading
      return;
    }

    const headers = splitCells(cap[1]);
    const aligns = cap[2].replace(this.rules.other.tableAlignChars, '').split('|');
    const rows = cap[3]?.trim() ? cap[3].replace(this.rules.other.tableRowBlankLine, '').split('\n') : [];

    const item               = {
      type: 'table',
      raw: rtrim(cap[0], '\n'),
      header: [],
      align: [],
      rows: [],
    };

    if (headers.length !== aligns.length) {
      // header and align columns must be equal, rows can be different.
      return;
    }

    for (const align of aligns) {
      if (this.rules.other.tableAlignRight.test(align)) {
        item.align.push('right');
      } else if (this.rules.other.tableAlignCenter.test(align)) {
        item.align.push('center');
      } else if (this.rules.other.tableAlignLeft.test(align)) {
        item.align.push('left');
      } else {
        item.align.push(null);
      }
    }

    for (let i = 0; i < headers.length; i++) {
      item.header.push({
        text: headers[i],
        tokens: this.lexer.inline(headers[i]),
        header: true,
        align: item.align[i],
      });
    }

    for (const row of rows) {
      item.rows.push(splitCells(row, item.header.length).map((cell, i) => {
        return {
          text: cell,
          tokens: this.lexer.inline(cell),
          header: false,
          align: item.align[i],
        };
      }));
    }

    return item;
  }

  lheading(src        )                             {
    const cap = this.rules.block.lheading.exec(src);
    if (cap) {
      const text = cap[1].trim();
      return {
        type: 'heading',
        raw: rtrim(cap[0], '\n'),
        depth: cap[2].charAt(0) === '=' ? 1 : 2,
        text,
        tokens: this.lexer.inline(text),
      };
    }
  }

  paragraph(src        )                               {
    const cap = this.rules.block.paragraph.exec(src);
    if (cap) {
      const text = cap[1].charAt(cap[1].length - 1) === '\n'
        ? cap[1].slice(0, -1)
        : cap[1];
      return {
        type: 'paragraph',
        raw: cap[0],
        text,
        tokens: this.lexer.inline(text),
      };
    }
  }

  text(src        )                          {
    const cap = this.rules.block.text.exec(src);
    if (cap) {
      return {
        type: 'text',
        raw: cap[0],
        text: cap[0],
        tokens: this.lexer.inline(cap[0]),
      };
    }
  }

  escape(src        )                            {
    const cap = this.rules.inline.escape.exec(src);
    if (cap) {
      return {
        type: 'escape',
        raw: cap[0],
        text: cap[1],
      };
    }
  }

  tag(src        )                         {
    const cap = this.rules.inline.tag.exec(src);
    if (cap) {
      if (!this.lexer.state.inLink && this.rules.other.startATag.test(cap[0])) {
        this.lexer.state.inLink = true;
      } else if (this.lexer.state.inLink && this.rules.other.endATag.test(cap[0])) {
        this.lexer.state.inLink = false;
      }
      if (!this.lexer.state.inRawBlock && this.rules.other.startPreScriptTag.test(cap[0])) {
        this.lexer.state.inRawBlock = true;
      } else if (this.lexer.state.inRawBlock && this.rules.other.endPreScriptTag.test(cap[0])) {
        this.lexer.state.inRawBlock = false;
      }

      return {
        type: 'html',
        raw: cap[0],
        inLink: this.lexer.state.inLink,
        inRawBlock: this.lexer.state.inRawBlock,
        block: false,
        text: cap[0],
      };
    }
  }

  link(src        )                                         {
    // The link regex backtracks quadratically over unterminated-link inputs
    // like '[a](b'.repeat(n): at every '[' its greedy unquoted-href run
    // re-partitions the whole remainder while hunting for a ')' that never
    // comes. inlineTokens anchors one paren scan per run in
    // state.linkParenPossible; when it is false the regex cannot match, so
    // bail out before running it.
    if (this.lexer.state.linkParenPossible === false) {
      return undefined;
    }
    const cap = this.rules.inline.link.exec(src);
    if (cap) {
      const labelStart = cap[0].charAt(0) === '!' ? 2 : 1;
      if (!this.options.pedantic && isLabelEndInsideToken(src, cap[1], labelStart, this.rules)) {
        return;
      }

      const trimmedUrl = cap[2].trim();
      if (!this.options.pedantic && this.rules.other.startAngleBracket.test(trimmedUrl)) {
        // commonmark requires matching angle brackets
        if (!(this.rules.other.endAngleBracket.test(trimmedUrl))) {
          return;
        }

        // ending angle bracket cannot be escaped
        const rtrimSlash = rtrim(trimmedUrl.slice(0, -1), '\\');
        if ((trimmedUrl.length - rtrimSlash.length) % 2 === 0) {
          return;
        }
      } else {
        // find closing parenthesis
        const lastParenIndex = findClosingBracket(cap[2], '()');
        if (lastParenIndex === -2) {
          // more open parens than closed
          return;
        }

        if (lastParenIndex > -1) {
          const start = cap[0].indexOf('!') === 0 ? 5 : 4;
          const linkLen = start + cap[1].length + lastParenIndex;
          cap[2] = cap[2].substring(0, lastParenIndex);
          cap[0] = cap[0].substring(0, linkLen).trim();
          cap[3] = '';
        }
      }
      // The ')' that ends the match is the link closer only when it is not
      // escaped. `[foo](/url\)` has no closer; that paren is destination text.
      const unescaped = rtrim(cap[0].slice(0, -1), '\\');
      if ((cap[0].length - unescaped.length) % 2 === 0) {
        return;
      }
      let href = cap[2];
      let title = '';
      if (this.options.pedantic) {
        // split pedantic href and title
        const link = this.rules.other.pedanticHrefTitle.exec(href);

        if (link) {
          href = link[1];
          title = link[3];
        }
      } else {
        title = cap[3] ? cap[3].slice(1, -1) : '';
      }

      href = href.trim();
      if (this.rules.other.startAngleBracket.test(href)) {
        if (this.options.pedantic && !(this.rules.other.endAngleBracket.test(trimmedUrl))) {
          // pedantic allows starting angle bracket without ending angle bracket
          href = href.slice(1);
        } else {
          href = href.slice(1, -1);
        }
      }
      return outputLink(cap, {
        href: href ? href.replace(this.rules.inline.anyPunctuation, '$1') : href,
        title: title ? title.replace(this.rules.inline.anyPunctuation, '$1') : title,
      }, cap[0], this.lexer, this.rules);
    }
  }

  reflink(src        , links       )                                                       {
    let cap;
    if ((cap = this.rules.inline.reflink.exec(src))
      || (cap = this.rules.inline.nolink.exec(src))) {
      const labelStart = cap[0].charAt(0) === '!' ? 2 : 1;
      if (!this.options.pedantic && isLabelEndInsideToken(src, cap[1], labelStart, this.rules)) {
        return;
      }

      const link = links[normalizeLabel(cap[2] || cap[1])];
      if (!link) {
        const text = cap[0].charAt(0);
        return {
          type: 'text',
          raw: text,
          text,
        };
      }
      return outputLink(cap, link, cap[0], this.lexer, this.rules);
    }
  }

  emStrong(src        , maskedSrc        , prevChar = '')                                        {
    let match = this.rules.inline.emStrongLDelim.exec(src);
    if (!match) return;
    if (!match[1] && !match[2] && !match[3] && !match[4]) return;

    const delimChar = match[0][0];
    // A mid-run opener (for example the second star of an unmatched `**`) must
    // only pair with a delimiter that can only close, otherwise it steals the
    // opener of a later span (`**a*b*c` must be `**a<em>b</em>c`).
    const midRun = prevChar === delimChar;

    // The start of this delimiter run may already be behind src, either taken
    // as text after the whole run failed to match or used to close an earlier
    // span. Flanking and rules 9-10 are about the whole run, so find its start.
    // Pedantic follows markdown.pl, which has no such rules.
    const srcStart = maskedSrc.length - src.length;
    let runStart = srcStart;
    while (!this.options.pedantic && runStart > 0 && maskedSrc[runStart - 1] === delimChar) {
      runStart--;
    }
    // Last code point before runStart (the slice is at most 2 units).
    let runPrevChar = '';
    if (runStart > 0) {
      const lo = maskedSrc.charCodeAt(runStart - 1);
      if (lo >= 0xDC00 && lo <= 0xDFFF && runStart >= 2
        && maskedSrc.charCodeAt(runStart - 2) >= 0xD800 && maskedSrc.charCodeAt(runStart - 2) <= 0xDBFF) {
        runPrevChar = maskedSrc.slice(runStart - 2, runStart);
      } else {
        runPrevChar = maskedSrc[runStart - 1];
      }
    }
    // The other delimiter character counts as punctuation here (`_**a*`)
    const runPrevPunct = runPrevChar === '*' || runPrevChar === '_' || !!this.rules.inline.punctuation.exec(runPrevChar);
    if (runStart < srcStart) {
      prevChar = runPrevChar;
    }
    const prevPunct = runStart < srcStart ? runPrevPunct : !!this.rules.inline.punctuation.exec(prevChar);

    // _ can't be between two alphanumerics. \p{L}\p{N} includes non-english alphabet/numbers as well
    if (match[4] && prevChar.match(this.rules.other.unicodeAlphaNumeric)) return;

    const nextChar = match[1] || match[3] || '';

    if (!nextChar || !prevChar || prevPunct) {
      // Code points of match[0] minus 1 (the delimiter run is ASCII; only
      // an astral following char makes code units differ from code points)
      let lLength = match[0].length - 1;
      {
        const ml = match[0].length;
        if (ml >= 2 && match[0].charCodeAt(ml - 1) >= 0xDC00 && match[0].charCodeAt(ml - 1) <= 0xDFFF
          && match[0].charCodeAt(ml - 2) >= 0xD800 && match[0].charCodeAt(ml - 2) <= 0xDBFF) lLength--;
      }
      let rDelim, rLength, delimTotal = lLength, midDelimTotal = 0;

      // Rules 9-10 count the whole run, and also apply when the opener could
      // close as well (`a*b**`, where `*` is both left- and right-flanking).
      const runLength = srcStart - runStart + lLength;
      const openerCanClose = !this.options.pedantic && !!runPrevChar.trim()
        && (!!nextChar || (delimChar === '*' && !runPrevPunct));
      if (delimChar !== '*' && delimChar !== '_') return;
      const endReg = delimChar === '*' ? this.rules.inline.emStrongRDelimAst : this.rules.inline.emStrongRDelimUnd;
      const lastPossibleEmStrongCloserIndex = cachedLastPossibleEmStrongCloserIndex(this, maskedSrc, delimChar);
      const emStrongCloserWindowStart = maskedSrc.length - src.length + lLength;
      if (lastPossibleEmStrongCloserIndex < emStrongCloserWindowStart) return;
      // Clip maskedSrc to same section of string as src (move to lexer?)
      maskedSrc = maskedSrc.slice(-1 * src.length + lLength);
      const lastPossibleEmStrongCloserIndexInWindow = lastPossibleEmStrongCloserIndex - emStrongCloserWindowStart;
      endReg.lastIndex = 0;

      while ((match = endReg.exec(maskedSrc)) !== null) {
        if (match.index > lastPossibleEmStrongCloserIndexInWindow) break;
        rDelim = match[1] || match[2] || match[3] || match[4] || match[5] || match[6];

        if (!rDelim) continue; // skip single * in __abc*abc__

        rLength = rDelim.length;

        if (match[3] || match[4]) { // found another Left Delim
          delimTotal += rLength;
          continue;
        } else if (match[5] || match[6] || openerCanClose) { // either Left or Right Delim
          if (midRun && (match[5] || match[6])) {
            // A mid-run opener cannot close against an ambiguous delimiter that
            // can also open; that delimiter opens its own emphasis span instead.
            break;
          }
          if (runLength % 3 && !((runLength + rLength) % 3)) {
            midDelimTotal += rLength;
            continue; // CommonMark Emphasis Rules 9-10
          }
        }

        delimTotal -= rLength;

        if (delimTotal > 0) continue; // Haven't found enough closing delimiters

        // Remove extra characters. *a*** -> *a*
        rLength = Math.min(rLength, rLength + delimTotal + midDelimTotal);
        // char length can be >1 for unicode characters;
        const lastCharLength = match[0].charCodeAt(0) >= 0xD800 && match[0].charCodeAt(0) <= 0xDBFF
          && match[0].charCodeAt(1) >= 0xDC00 && match[0].charCodeAt(1) <= 0xDFFF ? 2 : 1;
        const raw = src.slice(0, lLength + match.index + lastCharLength + rLength);

        // Create `em` if smallest delimiter has odd char count. *a***
        if (Math.min(lLength, rLength) % 2) {
          const text = raw.slice(1, -1);
          return {
            type: 'em',
            raw,
            text,
            tokens: this.lexer.inlineTokens(text),
          };
        }

        // Create 'strong' if smallest delimiter has even char count. **a***
        const text = raw.slice(2, -2);
        return {
          type: 'strong',
          raw,
          text,
          tokens: this.lexer.inlineTokens(text),
        };
      }
    }
  }

  codespan(src        )                              {
    const cap = this.rules.inline.code.exec(src);
    if (cap) {
      let text = cap[2].replace(this.rules.other.newLineCharGlobal, ' ');
      const hasNonSpaceChars = this.rules.other.nonSpaceChar.test(text);
      const hasSpaceCharsOnBothEnds = this.rules.other.startingSpaceChar.test(text) && this.rules.other.endingSpaceChar.test(text);
      if (hasNonSpaceChars && hasSpaceCharsOnBothEnds) {
        text = text.substring(1, text.length - 1);
      }
      return {
        type: 'codespan',
        raw: cap[0],
        text,
      };
    }
  }

  br(src        )                        {
    const cap = this.rules.inline.br.exec(src);
    if (cap) {
      return {
        type: 'br',
        raw: cap[0],
      };
    }
  }

  del(src        , maskedSrc        , prevChar = '')                         {
    let match = this.rules.inline.delLDelim.exec(src);
    if (!match) return;

    const nextChar = match[1] || '';

    if (!nextChar || !prevChar || this.rules.inline.punctuation.exec(prevChar)) {
      // unicode Regex counts emoji as 1 char; spread into array for proper count
      const lLength = [...match[0]].length - 1;
      let rDelim, rLength, delimTotal = lLength;

      const endReg = this.rules.inline.delRDelim;
      const lastPossibleDelCloserIndex = cachedLastPossibleDelCloserIndex(this, maskedSrc);
      const delCloserWindowStart = maskedSrc.length - src.length + lLength;
      if (lastPossibleDelCloserIndex < delCloserWindowStart) return;
      // Clip maskedSrc to same section of string as src
      maskedSrc = maskedSrc.slice(-1 * src.length + lLength);
      const lastPossibleDelCloserIndexInWindow = lastPossibleDelCloserIndex - delCloserWindowStart;
      endReg.lastIndex = 0;

      while ((match = endReg.exec(maskedSrc)) !== null) {
        if (match.index > lastPossibleDelCloserIndexInWindow) break;
        rDelim = match[1] || match[2] || match[3] || match[4] || match[5] || match[6];

        if (!rDelim) continue;

        rLength = [...rDelim].length;

        if (rLength !== lLength) continue;

        if (match[3] || match[4]) { // found another Left Delim
          delimTotal += rLength;
          continue;
        }

        delimTotal -= rLength;

        if (delimTotal > 0) continue; // Haven't found enough closing delimiters

        // Remove extra characters
        rLength = Math.min(rLength, rLength + delimTotal);
        // char length can be >1 for unicode characters
        const lastCharLength = [...match[0]][0].length;
        const raw = src.slice(0, lLength + match.index + lastCharLength + rLength);

        // Create del token - only single ~ or double ~~ supported
        const text = raw.slice(lLength, -lLength);
        return {
          type: 'del',
          raw,
          text,
          tokens: this.lexer.inlineTokens(text),
        };
      }
    }
  }

  autolink(src        )                          {
    const cap = this.rules.inline.autolink.exec(src);
    if (cap) {
      let text, href;
      if (cap[2] === '@') {
        text = cap[1];
        href = 'mailto:' + text;
      } else {
        text = cap[1];
        href = text;
      }

      return {
        type: 'link',
        raw: cap[0],
        text,
        href,
        autolink: true,
        tokens: [
          {
            type: 'text',
            raw: text,
            text,
          },
        ],
      };
    }
  }

  url(src        )                          {
    let cap;
    if (cap = this.rules.inline.url.exec(src)) {
      let text, href;
      if (cap[2] === '@') {
        text = cap[0];
        href = 'mailto:' + text;
      } else {
        // do extended autolink path validation
        let prevCapZero;
        do {
          prevCapZero = cap[0];
          cap[0] = this.rules.inline._backpedal.exec(cap[0])?.[0] ?? '';
        } while (prevCapZero !== cap[0]);
        text = cap[0];
        if (cap[1] === 'www.') {
          href = 'http://' + cap[0];
        } else {
          href = cap[0];
        }
      }
      return {
        type: 'link',
        raw: cap[0],
        text,
        href,
        autolink: true,
        tokens: [
          {
            type: 'text',
            raw: text,
            text,
          },
        ],
      };
    }
  }

  inlineText(src        )                          {
    const end = _textRunEnd(src);
    const raw = src.slice(0, end);
    const escaped = this.lexer.state.inRawBlock;
    return {
      type: 'text',
      raw,
      // raw HTML keeps whatever it was written with, everywhere else a numeric
      // character reference stands for the character itself
      text: escaped ? raw : decodeNumericCharacterReferences(raw),
      escaped,
    };
  }
}

// True when the second line could be a table delimiter row (it must contain '-').
function _tablePossible(src) {
  const nl1 = src.indexOf('\n');
  if (nl1 === -1) return false;
  const nl2 = src.indexOf('\n', nl1 + 1);
  const end = nl2 === -1 ? src.length : nl2;
  const dash = src.indexOf('-', nl1 + 1);
  return dash !== -1 && dash < end;
}
// True when a setext underline line (=== or ---) exists before the next
// blank line (scanning at most 100 lines; beyond that, say yes to be safe).
function _lheadingPossible(src) {
  let pos = 0;
  for (let lines = 0; lines < 100; lines++) {
    const nl = src.indexOf('\n', pos);
    const end = nl === -1 ? src.length : nl;
    let i = pos, spaces = 0;
    while (i < end && src.charCodeAt(i) === 32 && spaces < 3) { i++; spaces++; }
    let j = i;
    while (j < end && (src.charCodeAt(j) === 32 || src.charCodeAt(j) === 9)) j++;
    if (j === end) return false; // blank line: an lheading cannot cross it
    if (spaces <= 3 && i < end && (src.charCodeAt(i) === 61 || src.charCodeAt(i) === 45)) {
      const mark = src.charCodeAt(i);
      let k = i;
      while (k < end && src.charCodeAt(k) === mark) k++;
      while (k < end && (src.charCodeAt(k) === 32 || src.charCodeAt(k) === 9)) k++;
      if (k === end) return true;
    }
    if (nl === -1) return false;
    pos = nl + 1;
  }
  return true;
}

// ==== fast text-run scanner (replaces the GFM inline text regex) ====
// The text regex stops a run at: a special char (\ < ! [ ` * ~ _), a
// protocol://, www., mailto:/xmpp:, an email-like run, or "  \n". This
// finds the same stop with one cheap scan instead of the giant regex.
// The run always consumes at least its first character (a backtick/tilde
// run counts as one), and a stop must lie at or after that first char.
const _textStop = /[\\<!\[`*_~]|:\/\/|www\.|mailto:|xmpp:|@| {2,}\n/g;
const _emailCharCode = new Uint8Array(128);
for (const ch of "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.!#$%&'*+/=?_`{|}~-") {
  _emailCharCode[ch.charCodeAt(0)] = 1;
}
function _textRunEnd(src) {
  let from = 1;
  const c0 = src.charCodeAt(0);
  if (c0 === 96 || c0 === 126) { // ` or ~: consume the whole run as the first char
    while (from < src.length && src.charCodeAt(from) === c0) from++;
  }
  _textStop.lastIndex = from;
  let m;
  while ((m = _textStop.exec(src)) !== null) {
    const j = m.index;
    const t = m[0];
    if (t === '://') {
      // stop at the protocol start, if http/https/ftp ends right before it
      let p = -1;
      if (j >= 5 && src.slice(j - 5, j).toLowerCase() === 'https') p = j - 5;
      else if (j >= 4 && src.slice(j - 4, j).toLowerCase() === 'http') p = j - 4;
      else if (j >= 3 && src.slice(j - 3, j).toLowerCase() === 'ftp') p = j - 3;
      if (p >= from) return p;
      continue;
    }
    if (t === 'www.') {
      // www. only counts when preceded by start/whitespace/*/_/~/(
      const prev = src[j - 1];
      if (prev === ' ' || prev === '\t' || prev === '\n' || prev === '\r' || prev === '\f'
        || prev === '*' || prev === '_' || prev === '~' || prev === '(') return j;
      continue;
    }
    if (t === 'mailto:' || t === 'xmpp:') {
      // the text regex only stops before a protocol preceded by a
      // non-alphanumeric (e.g. "xmailto:a@b" is text up to the email)
      const prev = src[j - 1];
      if (!((prev >= 'a' && prev <= 'z') || (prev >= 'A' && prev <= 'Z') || (prev >= '0' && prev <= '9'))) return j;
      continue;
    }
    if (t === '@') {
      // email run: longest run of email chars ending just before '@'
      let k = j - 1;
      while (k >= from && _emailCharCode[src.charCodeAt(k)]) k--;
      const r = k + 1;
      if (r < j) return r;
      continue;
    }
    // a single special char, or "  \n" (stop before the spaces)
    return j;
  }
  return src.length;
}


// ==== Lexer.ts ====

                                                             
                                                        

/**
 * Block Lexer
 */
class _Lexer                                                 {
  tokens            ;
  options                                             ;
  state   
                    
                        
                                                                        
                         
       
                                                                       
                                                                         
                                             
       
                               
                 
   ;

         inlineQueue                                    ;

          tokenizer                                          ;

  constructor(options                                              ) {
    // TokenList cannot be created in one go
    this.tokens = []                         ;
    this.tokens.links = Object.create(null);
    this.options = options || _defaults;
    this.options.tokenizer = this.options.tokenizer || new _Tokenizer                              ();
    this.tokenizer = this.options.tokenizer;
    this.tokenizer.options = this.options;
    this.tokenizer.lexer = this;
    this.inlineQueue = [];
    this.state = {
      inLink: false,
      inRawBlock: false,
      linkEmitted: false,
      linkParenPossible: true,
      top: true,
    };

    const rules = {
      other,
      block: block.normal,
      inline: inline.normal,
    };

    if (this.options.pedantic) {
      rules.block = block.pedantic;
      rules.inline = inline.pedantic;
    } else if (this.options.gfm) {
      rules.block = block.gfm;
      if (this.options.breaks) {
        rules.inline = inline.breaks;
      } else {
        rules.inline = inline.gfm;
      }
    }
    this.tokenizer.rules = rules;
  }

  /**
   * Expose Rules
   */
  static get rules() {
    return {
      block,
      inline,
    };
  }

  /**
   * Static Lex Method
   */
  static lex                                                (src        , options                                              ) {
    const lexer = new _Lexer                              (options);
    return lexer.lex(src);
  }

  /**
   * Static Lex Inline Method
   */
  static lexInline                                                (src        , options                                              ) {
    const lexer = new _Lexer                              (options);
    return lexer.inlineTokens(src);
  }

  /**
   * Preprocessing
   */
  lex(src        ) {
    src = src.replace(other.carriageReturn, '\n');

    this.blockTokens(src, this.tokens);

    for (let i = 0; i < this.inlineQueue.length; i++) {
      const next = this.inlineQueue[i];
      // an inline <pre>, <code>, <kbd> or <script> left open ends with the block
      // holding it; carried over, it would stop every later block's text from
      // being escaped
      this.state.inRawBlock = false;
      this.inlineTokens(next.src, next.tokens);
    }
    this.inlineQueue = [];

    return this.tokens;
  }

  /**
   * Lexing
   */
                                                                                      
                                                                                            
  blockTokens(src        , tokens          = [], lastParagraphClipped = false) {
    this.tokenizer.lexer = this;

    let srcLength = Infinity;
    while (src) {
      if (src.length < srcLength) {
        srcLength = src.length;
      } else {
        this.infiniteLoopError(src.charCodeAt(0));
        break;
      }

      let token                            ;
      // First-char dispatch: most block rules can only start at specific
      // first characters (after at most 3 spaces), and an indented code
      // block (4+ spaces, or a tab within the first 4 columns) excludes
      // them all. (extensions are always null for this entry.)
      let lead = 0;
      while (lead < src.length && src.charCodeAt(lead) === 32) lead++;
      const ch = lead < src.length ? src.charCodeAt(lead) : -1;
      const indented = lead >= 4 || (lead <= 3 && ch === 9);
      let k = 0;
      while (k < src.length && (src.charCodeAt(k) === 32 || src.charCodeAt(k) === 9)) k++;
      const blankFirst = k >= src.length || src.charCodeAt(k) === 10;

      // newline
      if (blankFirst && (token = this.tokenizer.space(src))) {
        src = src.substring(token.raw.length);
        const lastToken = tokens.at(-1);
        if (token.raw.length === 1 && lastToken !== undefined) {
          // if there's a single \n as a spacer, it's terminating the last line,
          // so move it there so that we don't get unnecessary paragraph tags
          lastToken.raw += '\n';
        } else {
          tokens.push(token);
        }
        continue;
      }

      // code
      if (indented && (token = this.tokenizer.code(src))) {
        src = src.substring(token.raw.length);
        const lastToken = tokens.at(-1);
        // An indented code block cannot interrupt a paragraph.
        if (lastToken?.type === 'paragraph' || lastToken?.type === 'text') {
          lastToken.raw += (lastToken.raw.endsWith('\n') ? '' : '\n') + token.raw;
          lastToken.text += '\n' + token.text;
          this.inlineQueue.at(-1) .src = lastToken.text;
        } else {
          tokens.push(token);
        }
        continue;
      }

      // fences
      if (!indented && (ch === 96 || ch === 126) && (token = this.tokenizer.fences(src))) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }

      // heading
      if (!indented && ch === 35 && (token = this.tokenizer.heading(src))) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }

      // hr
      if (!indented && (ch === 45 || ch === 95 || ch === 42) && (token = this.tokenizer.hr(src))) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }

      // blockquote
      if (!indented && ch === 62 && (token = this.tokenizer.blockquote(src))) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }

      // list
      if (!indented && (ch === 42 || ch === 43 || ch === 45 || (ch >= 48 && ch <= 57)) && (token = this.tokenizer.list(src))) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }

      // html
      if (!indented && ch === 60 && (token = this.tokenizer.html(src))) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }

      // def
      if (!indented && ch === 91 && (token = this.tokenizer.def(src))) {
        src = src.substring(token.raw.length);
        const lastToken = tokens.at(-1);
        if (lastToken?.type === 'paragraph' || lastToken?.type === 'text') {
          lastToken.raw += (lastToken.raw.endsWith('\n') ? '' : '\n') + token.raw;
          lastToken.text += '\n' + token.raw;
          this.inlineQueue.at(-1) .src = lastToken.text;
        } else {
          // The first definition of a label wins, but a later one still consumes its text
          if (!this.tokens.links[token.tag]) {
            this.tokens.links[token.tag] = {
              href: token.href,
              title: token.title,
            };
          }
          tokens.push(token);
        }
        continue;
      }

      // table (gfm)
      if (_tablePossible(src) && (token = this.tokenizer.table(src))) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }

      // lheading
      if (_lheadingPossible(src) && (token = this.tokenizer.lheading(src))) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }

      // top-level paragraph
      if (this.state.top && (token = this.tokenizer.paragraph(src))) {
        const lastToken = tokens.at(-1);
        if (lastParagraphClipped && lastToken?.type === 'paragraph') {
          lastToken.raw += (lastToken.raw.endsWith('\n') ? '' : '\n') + token.raw;
          lastToken.text += '\n' + token.text;
          this.inlineQueue.pop();
          this.inlineQueue.at(-1) .src = lastToken.text;
        } else {
          tokens.push(token);
        }
        lastParagraphClipped = false;
        src = src.substring(token.raw.length);
        continue;
      }

      // text
      if (token = this.tokenizer.text(src)) {
        src = src.substring(token.raw.length);
        const lastToken = tokens.at(-1);
        if (lastToken?.type === 'text') {
          lastToken.raw += (lastToken.raw.endsWith('\n') ? '' : '\n') + token.raw;
          lastToken.text += '\n' + token.text;
          this.inlineQueue.pop();
          this.inlineQueue.at(-1) .src = lastToken.text;
        } else {
          tokens.push(token);
        }
        continue;
      }

      if (src) {
        this.infiniteLoopError(src.charCodeAt(0));
        break;
      }
    }

    this.state.top = true;
    return tokens;
  }

  inline(src        , tokens          = []) {
    this.inlineQueue.push({ src, tokens });
    return tokens;
  }

  /**
   * Does this link text hold a link already? An image does not count: an image
   * may hold a link, a link may not.
   */
          linkInText(text        )          {
    if (!text.includes('[')) {
      return false;
    }

    const linkRule = this.tokenizer.rules.inline.link;
    for (const match of text.matchAll(this.tokenizer.rules.inline.blockSkip)) {
      // blockSkip also matches code spans and html, and the `!` of an image is
      // left out of the match, so read the character before it.
      if (linkRule.test(match[0]) && text.charAt(match.index - 1) !== '!') {
        return true;
      }
    }

    for (const match of text.matchAll(this.tokenizer.rules.inline.reflinkSearch)) {
      const match0 = match[0];
      const refStart = match0.lastIndexOf('[');
      if (match0.charAt(0) === '!' || !Object.hasOwn(this.tokens.links, normalizeLabel(match0.slice(refStart + 1, -1)))) {
        continue;
      }
      // a candidate holding a link is not a link either, so it does not count
      if (refStart > 1 && this.linkInText(match0.slice(1, refStart - 1))) {
        continue;
      }
      return true;
    }

    return false;
  }

  /**
   * Lexing/Compiling
   */
  inlineTokens(src        , tokens          = [])          {
    this.tokenizer.lexer = this;
    // One paren scan per inline run, shared with Tokenizer.link: without a
    // ')' ahead the link regex cannot match, and skipping it avoids its
    // quadratic backtracking over unterminated-link inputs like
    // `'[a](b'.repeat(n)`. A nested run receives a substring of the outer
    // run, so if the outer had no ')' neither does this substring — skip
    // the scan in that case.
    const prevLinkParenPossible = this.state.linkParenPossible;
    this.state.linkParenPossible = prevLinkParenPossible && src.includes(')');
    try {
      return this.#inlineTokensInner(src, tokens);
    } finally {
      // A nested run (e.g. a link label) anchored on its own substring;
      // restore the outer run's flag for the rest of its loop.
      this.state.linkParenPossible = prevLinkParenPossible;
    }
  }

  #inlineTokensInner(src        , tokens         )          {
    // Fast path: when the raw source has no run of *, _ or ~ that can close
    // emphasis/strong/strikethrough, masking is pointless (it only removes
    // delimiters) and emStrong/del can never match, so skip the mask, the
    // closer-hint scan, and every emStrong/del call in this pass. A custom
    // tokenizer or an emStrongMask hook may still read maskedSrc, so those
    // always take the slow path (never set for this entry).
    const customEm = this.options.hooks?.emStrongMask
      || this.tokenizer.emStrong !== _Tokenizer.prototype.emStrong
      || this.tokenizer.del !== _Tokenizer.prototype.del;
    // No *, _ or ~ at all: no closer can exist, so masking, the hint scan
    // and every emStrong/del call are pointless. (A run that has a delimiter
    // but no closer is rare; scanning for it costs more than it saves.)
    const noCloser = !customEm
      && !src.includes('*') && !src.includes('_') && !src.includes('~');
    const prevSkip = this._skipEmDel;
    this._skipEmDel = noCloser;
    try {
      if (noCloser) {
        return this.#tokenizeInlines(src, src, tokens);
      }
      const maskedSrc = this.#maskSrc(src);
      // One scan of this maskedSrc for the last emphasis, strong, and
      // strikethrough closers, shared by every opener in the pass. Popped
      // when the pass ends so the source is not retained (#4099).
      beginEmStrongDelCloserScan(this.tokenizer, maskedSrc);
      try {
        return this.#tokenizeInlines(src, maskedSrc, tokens);
      } finally {
        endEmStrongDelCloserScan(this.tokenizer);
      }
    } finally {
      this._skipEmDel = prevSkip;
    }
  }

  #tokenizeInlines(src        , maskedSrc        , tokens         )          {
    let keepPrevChar = false;
    let prevChar = '';
    let srcLength = Infinity;
    while (src) {
      if (src.length < srcLength) {
        srcLength = src.length;
      } else {
        this.infiniteLoopError(src.charCodeAt(0));
        break;
      }

      if (!keepPrevChar) {
        prevChar = '';
      }
      keepPrevChar = false;

      let token                            ;
      // Dispatch on the first character: each inline rule can only match at
      // specific first characters, so most rules are never even attempted.
      // (extensions are always null for this entry, so those branches are gone.)
      const c = src.charCodeAt(0);
      if (c === 92) { // backslash: escape, br
        if (token = this.tokenizer.escape(src)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        if (token = this.tokenizer.br(src)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
      } else if (c === 60) { // '<': tag, autolink
        if (token = this.tokenizer.tag(src)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        if (token = this.tokenizer.autolink(src)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
      } else if (c === 91 || c === 33) { // '[' or '!': link, reflink
        if (token = this.tokenizer.link(src)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        if (token = this.tokenizer.reflink(src, this.tokens.links)) {
          src = src.substring(token.raw.length);
          const lastToken = tokens.at(-1);
          if (token.type === 'text' && lastToken?.type === 'text') {
            lastToken.raw += token.raw;
            lastToken.text += token.text;
          } else {
            tokens.push(token);
          }
          continue;
        }
      } else if (c === 42) { // '*': em & strong
        if (!this._skipEmDel && (token = this.tokenizer.emStrong(src, maskedSrc, prevChar))) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
      } else if (c === 95) { // '_': em & strong, then url (an email may start with _)
        if (!this._skipEmDel && (token = this.tokenizer.emStrong(src, maskedSrc, prevChar))) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        if (!this.state.inLink && (token = this.tokenizer.url(src))) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
      } else if (c === 96) { // '`': code
        if (token = this.tokenizer.codespan(src)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
      } else if (c === 126) { // '~': del (gfm)
        if (!this._skipEmDel && (token = this.tokenizer.del(src, maskedSrc, prevChar))) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
      } else if (c === 32) { // space: br
        if (token = this.tokenizer.br(src)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
      } else if (
        // url (gfm): may start at a letter, digit, '.', '+' or '-'
        !this.state.inLink
        && (c === 46 || c === 43 || c === 45
          || (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122))
        && (token = this.tokenizer.url(src))
      ) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }

      // text
      if (token = this.tokenizer.inlineText(src)) {
        src = src.substring(token.raw.length);
        if (token.raw.slice(-1) !== '_') { // Track prevChar before string of ____ started
          prevChar = token.raw.slice(-1);
        }
        keepPrevChar = true;
        const lastToken = tokens.at(-1);
        if (lastToken?.type === 'text') {
          lastToken.raw += token.raw;
          lastToken.text += token.text;
        } else {
          tokens.push(token);
        }
        continue;
      }

      if (src) {
        this.infiniteLoopError(src.charCodeAt(0));
        break;
      }
    }

    return tokens;
  }

  /**
   * Mask links, code, html and escapes so emStrong and del do not see their
   * delimiters inside them.
   */
  #maskSrc(src        )         {
    // String with links masked to avoid interference with em and strong
    let maskedSrc = src;

    // Mask out reflinks
    if (this.tokens.links && src.includes('[')) {
      const reflinkSearch = this.tokenizer.rules.inline.reflinkSearch;
      const maskReflink = (match0        )         => {
        const refStart = match0.lastIndexOf('[');
        if (!Object.hasOwn(this.tokens.links, normalizeLabel(match0.slice(refStart + 1, -1)))) {
          return match0;
        }
        // CommonMark: "Links may not contain other links, at any level of
        // nesting." A candidate whose text already holds one never becomes a
        // link, so flattening the whole span would hide the emphasis that
        // does still apply inside it. Mask the links it holds instead.
        // Images are exempt: their text is flattened into an alt attribute.
        if (refStart > 1 && match0.charAt(0) !== '!') {
          const text = match0.slice(1, refStart - 1);
          if (this.linkInText(text)) {
            return '[' + text.replace(reflinkSearch, maskReflink)
              + '][' + 'a'.repeat(match0.length - refStart - 2) + ']';
          }
        }
        return '[' + 'a'.repeat(match0.length - 2) + ']';
      };
      maskedSrc = maskedSrc.replace(reflinkSearch, maskReflink);
    }

    // Mask out escaped characters.
    // Every mask must keep the length it replaces: emStrong and del line
    // maskedSrc up with src by slicing from the end. `anyPunctuation` matches
    // unicode punctuation, so an escaped astral character is 3 code units.
    // A backslash inside a code span is literal, not an escape. Mask the
    // backticks inside the span instead, so blockSkip still skips all of it.
    // Only escapes (\ + punctuation) and code spans can match here.
    if (maskedSrc.includes('`') || maskedSrc.includes('\\')) {
      maskedSrc = maskedSrc.replace(this.tokenizer.rules.inline.anyPunctuationOutsideCode, (match0, code, punct) => {
        if (punct) {
          return '+'.repeat(match0.length);
        }
        if (code) {
          return code + match0.slice(code.length, -code.length).replace(/`/g, '+') + code;
        }
        return match0;
      });
    }

    // Mask out other blocks
    // Only links, code spans and html can match here.
    if (maskedSrc.includes('[') || maskedSrc.includes('`') || maskedSrc.includes('<')) {
      maskedSrc = maskedSrc.replace(this.tokenizer.rules.inline.blockSkip, (match0, _link, context) => {
        const offset = context ? context.length : 0;
        return match0.slice(0, offset) + '[' + 'a'.repeat(match0.length - offset - 2) + ']';
      });
    }

    // Mask out blocks from extensions
    maskedSrc = this.options.hooks?.emStrongMask?.call({ lexer: this }, maskedSrc) ?? maskedSrc;

    return maskedSrc;
  }

          infiniteLoopError(byte        ) {
    const errMsg = 'Infinite loop on byte: ' + byte;
    if (this.options.silent) {
      console.error(errMsg);
    } else {
      throw new Error(errMsg);
    }
  }
}


// ==== Parser.ts ====

                                                              
                                                        

/**
 * Parsing & Compiling
 */
class _Parser                                                 {
  options                                             ;
  renderer                                         ;
  textRenderer                               ;
  constructor(options                                              ) {
    this.options = options || _defaults;
    this.options.renderer = this.options.renderer || new _Renderer                              ();
    this.renderer = this.options.renderer;
    this.renderer.options = this.options;
    this.renderer.parser = this;
    this.textRenderer = new _TextRenderer                ();
    this.textRenderer.parser = this;
  }

  /**
   * Static Parse Method
   */
  static parse                                                (tokens         , options                                              ) {
    const parser = new _Parser                              (options);
    return parser.parse(tokens);
  }

  /**
   * Static Parse Inline Method
   */
  static parseInline                                                (tokens         , options                                              ) {
    const parser = new _Parser                              (options);
    return parser.parseInline(tokens);
  }

  /**
   * Parse Loop
   */
  parse(tokens         )               {
    this.renderer.parser = this;
    let out = '';

    for (let i = 0; i < tokens.length; i++) {
      const anyToken = tokens[i];

      // Run any renderer extensions
      if (this.options.extensions?.renderers?.[anyToken.type]) {
        const genericToken = anyToken                  ;
        const ret = this.options.extensions.renderers[genericToken.type].call({ parser: this }, genericToken);
        if (ret !== false || !['space', 'hr', 'heading', 'code', 'table', 'blockquote', 'list', 'checkbox', 'html', 'def', 'paragraph', 'text'].includes(genericToken.type)) {
          out += ret || '';
          continue;
        }
      }

      const token = anyToken               ;

      switch (token.type) {
        case 'space': {
          out += this.renderer.space(token);
          break;
        }
        case 'hr': {
          out += this.renderer.hr(token);
          break;
        }
        case 'heading': {
          out += this.renderer.heading(token);
          break;
        }
        case 'code': {
          out += this.renderer.code(token);
          break;
        }
        case 'table': {
          out += this.renderer.table(token);
          break;
        }
        case 'blockquote': {
          out += this.renderer.blockquote(token);
          break;
        }
        case 'list': {
          out += this.renderer.list(token);
          break;
        }
        case 'checkbox': {
          out += this.renderer.checkbox(token);
          break;
        }
        case 'html': {
          out += this.renderer.html(token);
          break;
        }
        case 'def': {
          out += this.renderer.def(token);
          break;
        }
        case 'paragraph': {
          out += this.renderer.paragraph(token);
          break;
        }
        case 'text': {
          out += this.renderer.text(token);
          break;
        }

        default: {
          const errMsg = 'Token with "' + token.type + '" type was not found.';
          if (this.options.silent) {
            console.error(errMsg);
            return ''                ;
          } else {
            throw new Error(errMsg);
          }
        }
      }
    }

    return out                ;
  }

  /**
   * Parse Inline Tokens
   */
  parseInline(tokens         , renderer                                                                          = this.renderer)               {
    this.renderer.parser = this;
    let out = '';

    for (let i = 0; i < tokens.length; i++) {
      const anyToken = tokens[i];

      // Run any renderer extensions
      if (this.options.extensions?.renderers?.[anyToken.type]) {
        const ret = this.options.extensions.renderers[anyToken.type].call({ parser: this }, anyToken);
        if (ret !== false || !['escape', 'html', 'link', 'image', 'checkbox', 'strong', 'em', 'codespan', 'br', 'del', 'text'].includes(anyToken.type)) {
          out += ret || '';
          continue;
        }
      }

      const token = anyToken               ;

      switch (token.type) {
        case 'escape': {
          out += renderer.text(token);
          break;
        }
        case 'html': {
          out += renderer.html(token);
          break;
        }
        case 'link': {
          out += renderer.link(token);
          break;
        }
        case 'image': {
          out += renderer.image(token);
          break;
        }
        case 'checkbox': {
          out += renderer.checkbox(token);
          break;
        }
        case 'strong': {
          out += renderer.strong(token);
          break;
        }
        case 'em': {
          out += renderer.em(token);
          break;
        }
        case 'codespan': {
          out += renderer.codespan(token);
          break;
        }
        case 'br': {
          out += renderer.br(token);
          break;
        }
        case 'del': {
          out += renderer.del(token);
          break;
        }
        case 'text': {
          out += renderer.text(token);
          break;
        }
        default: {
          const errMsg = 'Token with "' + token.type + '" type was not found.';
          if (this.options.silent) {
            console.error(errMsg);
            return ''                ;
          } else {
            throw new Error(errMsg);
          }
        }
      }
    }
    return out                ;
  }
}



// ==== entry ====
const _markedDefaults = _getDefaults();
export function parse(markdown) {
  const options = { ..._markedDefaults };
  const tokens = _Lexer.lex(markdown, options);
  return _Parser.parse(tokens, options);
}
