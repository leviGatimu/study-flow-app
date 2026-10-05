/**
 * Turn an answer's [S3] / [S2, S3] markers into numbered Markdown links to the
 * records they cite. A marker for a record that was not cited (the model made
 * the id up) is removed rather than shown as a dead reference. Code blocks
 * are left untouched.
 *
 * Pure, shared by the chat UI and tests.
 */

export type CitedSource = { id: string; href: string };

export function linkCitations(content: string, sources: CitedSource[]): string {
  const number = new Map(sources.map((s, i) => [s.id, { n: i + 1, href: s.href }]));
  return content
    .split(/(```[\s\S]*?```)/g)
    .map((part) =>
      part.startsWith('```')
        ? part
        : part.replace(/\s?\[(S\d+(?:\s*,\s*S\d+)*)\]/g, (_, ids: string) => {
            const links = ids
              .split(',')
              .map((id) => number.get(id.trim()))
              .filter((x): x is { n: number; href: string } => Boolean(x))
              .map((x) => `[${x.n}](${x.href})`);
            return links.length ? ` ${links.join(' ')}` : '';
          })
    )
    .join('');
}
