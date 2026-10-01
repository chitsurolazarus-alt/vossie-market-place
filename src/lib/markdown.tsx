import { Fragment, type ReactNode } from "react";

/**
 * A deliberately tiny, safe markdown subset for Hub posts: ## / ### headings, **bold**, *italic*, [text](https://link),
 * "- " bullet lists, "1. " numbered lists and paragraphs. Output is React nodes only, so no HTML is ever injected.
 */
function inline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g;
  let last = 0, i = 0;
  for (const m of text.matchAll(re)) {
    const start = m.index ?? 0;
    if (start > last) out.push(text.slice(last, start));
    const tok = m[0];
    const key = `${keyPrefix}-${i++}`;
    if (tok.startsWith("**")) out.push(<strong key={key}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("[")) {
      const [, label, href] = tok.match(/^\[([^\]]+)\]\((.+)\)$/) ?? [];
      out.push(<a key={key} href={href} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold text-royal underline">{label}</a>);
    } else out.push(<em key={key}>{tok.slice(1, -1)}</em>);
    last = start + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ source }: { source: string }) {
  const lines = source.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flushPara = () => { if (para.length) { blocks.push(<p key={`p${blocks.length}`} className="mt-3 text-ink">{inline(para.join(" "), `p${blocks.length}`)}</p>); para = []; } };
  const flushList = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    blocks.push(
      <Tag key={`l${blocks.length}`} className={`mt-3 space-y-1 pl-6 text-ink ${list.ordered ? "list-decimal" : "list-disc"}`}>
        {list.items.map((it, k) => <li key={k}>{inline(it, `l${blocks.length}-${k}`)}</li>)}
      </Tag>,
    );
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const h = line.match(/^(#{2,3})\s+(.*)$/);
    const ul = line.match(/^[-*]\s+(.*)$/);
    const ol = line.match(/^\d+\.\s+(.*)$/);
    if (!line.trim()) { flushPara(); flushList(); continue; }
    if (h) {
      flushPara(); flushList();
      const cls = h[1].length === 2 ? "mt-6 font-display text-2xl font-bold text-navy" : "mt-5 font-display text-xl font-bold text-navy";
      blocks.push(h[1].length === 2 ? <h2 key={`h${blocks.length}`} className={cls}>{h[2]}</h2> : <h3 key={`h${blocks.length}`} className={cls}>{h[2]}</h3>);
    } else if (ul || ol) {
      flushPara();
      const ordered = !!ol;
      if (list && list.ordered !== ordered) flushList();
      if (!list) list = { ordered, items: [] };
      list.items.push((ul ?? ol)![1]);
    } else { flushList(); para.push(line.trim()); }
  }
  flushPara(); flushList();
  return <Fragment>{blocks}</Fragment>;
}
