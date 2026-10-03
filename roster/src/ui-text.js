// ---------------------------------------------------------------------------
// Rich text: links, @mentions, $math$ (KaTeX → MathML), and a small Markdown
// subset for shared notes (**bold**, *italic*, lists, paragraphs).
// Everything except KaTeX's own output is rendered as text nodes.
// ---------------------------------------------------------------------------
const URL_SPLIT = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g;
function MathSpan({ tex }) {
  const out = Media.mathHtml(tex);
  if (!out) return html`<code class="tex">${tex}</code>`;
  return html`<span class="math" dangerouslySetInnerHTML=${{ __html: out }}></span>`;
}
function inlineParts(text, mentionNames, opts) {
  const out = [];
  const pushMentions = (s) => {
    if (!mentionNames || !mentionNames.length) { out.push(s); return; }
    const re = new RegExp("(@(?:" + mentionNames.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + "))", "g");
    s.split(re).forEach((p, j) => out.push(j % 2 === 1 ? html`<span class="mention">${p}</span>` : p));
  };
  const pushEmphasis = (s) => {
    if (!opts || !opts.md) { pushMentions(s); return; }
    s.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g).forEach((p) => {
      if (/^\*\*[^*]+\*\*$/.test(p)) out.push(html`<strong>${p.slice(2, -2)}</strong>`);
      else if (/^\*[^*]+\*$/.test(p)) out.push(html`<em>${p.slice(1, -1)}</em>`);
      else if (p) pushMentions(p);
    });
  };
  String(text || "").split(URL_SPLIT).forEach((part, i) => {
    if (i % 2 === 1) { out.push(html`<a href=${part} target="_blank" rel="noopener noreferrer">${part.replace(/^https?:\/\/(www\.)?/, "")}</a>`); return; }
    part.split(/(\$[^$\n]{1,200}\$)/g).forEach((seg) => {
      if (/^\$[^$]+\$$/.test(seg)) out.push(html`<${MathSpan} tex=${seg.slice(1, -1)} />`);
      else if (seg) pushEmphasis(seg);
    });
  });
  return out;
}
function RichText({ text, mentions }) {
  return inlineParts(text, mentions);
}
function NoteBody({ text }) {
  const blocks = [];
  let list = null;
  for (const raw of String(text || "").split("\n")) {
    const line = raw.trimEnd();
    const ul = line.match(/^\s*[-•]\s+(.*)$/), ol = line.match(/^\s*(\d+)\.\s+(.*)$/);
    if (ul || ol) {
      const kind = ul ? "ul" : "ol";
      if (!list || list.kind !== kind) { list = { kind, items: [] }; blocks.push(list); }
      list.items.push(ul ? ul[1] : ol[2]);
      continue;
    }
    list = null;
    if (!line.trim()) { blocks.push({ kind: "gap" }); continue; }
    blocks.push({ kind: "p", text: line });
  }
  return html`<div class="note-body">${blocks.map((b, i) => {
    if (b.kind === "ul") return html`<ul key=${i}>${b.items.map((t) => html`<li>${inlineParts(t, null, { md: true })}</li>`)}</ul>`;
    if (b.kind === "ol") return html`<ol key=${i}>${b.items.map((t) => html`<li>${inlineParts(t, null, { md: true })}</li>`)}</ol>`;
    if (b.kind === "gap") return null;
    return html`<p key=${i}>${inlineParts(b.text, null, { md: true })}</p>`;
  })}</div>`;
}
