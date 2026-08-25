"use client";

import katex from "katex";
import { useMemo } from "react";

interface FormulaProps {
  tex: string;
  className?: string;
  displayMode?: boolean;
}

/** Render công thức LaTeX bằng KaTeX (client-side, an toàn với SSR vì useMemo chạy cả server). */
export function Formula({ tex, className, displayMode = false }: FormulaProps) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(tex, {
        displayMode,
        throwOnError: false,
        output: "html",
      });
    } catch {
      return `<span class="text-ink-3">${tex}</span>`;
    }
  }, [tex, displayMode]);

  return (
    <span
      className={className}
      // KaTeX output là markup tĩnh đã escape bởi thư viện
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
