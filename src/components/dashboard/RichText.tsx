'use client';

import { Fragment, type ReactNode } from 'react';

interface RichTextProps {
  text: string;
  className?: string;
}

const INLINE_TOKEN_REGEX =
  /`[^`]+`|\b[A-Za-z]\([A-Za-z0-9_,+\-*/^ ]+\)|\b[A-Za-z]+_[A-Za-z0-9]+\b|\b[A-Za-z]+\^[A-Za-z0-9]+\b|\b[A-Za-z]+\s*=\s*[A-Za-z0-9_+\-*/^().]+\b|[Σ∑λμσθαβγπΩΔ≤≥≈≠→←∞]/g;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let tokenIndex = 0;

  for (const match of text.matchAll(INLINE_TOKEN_REGEX)) {
    const start = match.index ?? 0;
    const token = match[0];

    if (start > cursor) {
      nodes.push(
        <Fragment key={`${keyPrefix}-text-${tokenIndex}`}>
          {text.slice(cursor, start)}
        </Fragment>
      );
      tokenIndex += 1;
    }

    if (token.startsWith('`') && token.endsWith('`')) {
      nodes.push(
        <code key={`${keyPrefix}-code-${tokenIndex}`} className="rich-code">
          {token.slice(1, -1)}
        </code>
      );
    } else {
      nodes.push(
        <span key={`${keyPrefix}-formula-${tokenIndex}`} className="rich-formula">
          {token}
        </span>
      );
    }

    cursor = start + token.length;
    tokenIndex += 1;
  }

  if (cursor < text.length) {
    nodes.push(
      <Fragment key={`${keyPrefix}-tail`}>{text.slice(cursor)}</Fragment>
    );
  }

  return nodes;
}

function renderRich(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  const nodes: ReactNode[] = [];

  parts.forEach((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const inner = part.slice(2, -2);
      nodes.push(
        <strong key={`${keyPrefix}-strong-${index}`} className="rich-emphasis">
          {renderInline(inner, `${keyPrefix}-strong-inline-${index}`)}
        </strong>
      );
      return;
    }

    nodes.push(
      <Fragment key={`${keyPrefix}-plain-${index}`}>
        {renderInline(part, `${keyPrefix}-plain-inline-${index}`)}
      </Fragment>
    );
  });

  return nodes;
}

export function RichParagraph({ text, className = '' }: RichTextProps) {
  return <p className={`rich-paragraph ${className}`.trim()}>{renderRich(text, 'paragraph')}</p>;
}

export function RichInline({ text, className = '' }: RichTextProps) {
  return <span className={`rich-inline ${className}`.trim()}>{renderRich(text, 'inline')}</span>;
}
