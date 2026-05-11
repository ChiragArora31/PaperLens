'use client';

import { useState } from 'react';
import { Check, Share2 } from 'lucide-react';

export default function PublicShareButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const element = document.createElement('textarea');
      element.value = text;
      element.setAttribute('readonly', '');
      element.style.position = 'fixed';
      element.style.opacity = '0';
      document.body.appendChild(element);
      element.select();
      document.execCommand('copy');
      element.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <button className="stat-pill" onClick={() => void copy()} type="button">
      {copied ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
      {copied ? 'Copied' : 'Copy share snippet'}
    </button>
  );
}
