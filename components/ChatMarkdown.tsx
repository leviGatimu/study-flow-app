'use client';

import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

import { cn } from '@/lib/utils';

/**
 * An AI answer, rendered: headings, lists, tables, code and LaTeX maths
 * ($...$ inline, $$...$$ display). Styled by `.chat-md` in globals.css, which
 * follows the theme tokens so it reads in light and dark alike.
 *
 * react-markdown never renders raw HTML from the text, so a model reply
 * cannot inject markup into the page.
 */
export function ChatMarkdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn('chat-md', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, [remarkMath, { singleDollarTextMath: true }]]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: 'ignore' }]]}
        components={{
          // A link to one of the student's own records stays in the app; anything
          // else opens in a new tab.
          a: ({ href, children: label }) =>
            href?.startsWith('/') && !href.startsWith('//') ? (
              <Link href={href}>{label}</Link>
            ) : (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {label}
              </a>
            ),
          table: ({ children: rows }) => (
            <div className="chat-md-table">
              <table>{rows}</table>
            </div>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
