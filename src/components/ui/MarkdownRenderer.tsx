import React from 'react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
  // Parse paragraphs, headings, bullet lists, bold, italics, code blocks
  const renderFormatted = (text: string) => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let inCodeBlock = false;
    let codeBuffer: string[] = [];
    let listBuffer: string[] = [];

    const flushList = (keyPrefix: string) => {
      if (listBuffer.length > 0) {
        elements.push(
          <ul key={`${keyPrefix}-list`} className="my-2.5 ml-5 list-disc space-y-1 text-inherit">
            {listBuffer.map((item, idx) => (
              <li key={idx} className="leading-relaxed">
                {parseInline(item)}
              </li>
            ))}
          </ul>
        );
        listBuffer = [];
      }
    };

    const parseInline = (str: string): React.ReactNode => {
      // Bold **text**
      const parts = str.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
      return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} className="font-semibold text-inherit">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('*') && part.endsWith('*')) {
          return <em key={i} className="italic text-inherit">{part.slice(1, -1)}</em>;
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <code
              key={i}
              className="px-1.5 py-0.5 rounded bg-zinc-200/70 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono text-xs"
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        return part;
      });
    };

    lines.forEach((line, index) => {
      // Code blocks
      if (line.trim().startsWith('```')) {
        if (inCodeBlock) {
          elements.push(
            <pre
              key={`code-${index}`}
              className="my-3 overflow-x-auto rounded-lg bg-zinc-900 p-3.5 text-xs font-mono text-zinc-100 leading-relaxed"
            >
              <code>{codeBuffer.join('\n')}</code>
            </pre>
          );
          codeBuffer = [];
          inCodeBlock = false;
        } else {
          flushList(`flush-${index}`);
          inCodeBlock = true;
        }
        return;
      }

      if (inCodeBlock) {
        codeBuffer.push(line);
        return;
      }

      // Unordered lists
      const listMatch = line.match(/^(\*|-|\+)\s+(.+)$/);
      if (listMatch) {
        listBuffer.push(listMatch[2]);
        return;
      } else {
        flushList(`flush-${index}`);
      }

      // Ordered lists
      const orderedMatch = line.match(/^(\d+)\.\s+(.+)$/);
      if (orderedMatch) {
        elements.push(
          <div key={`ol-${index}`} className="my-1.5 flex items-start gap-2 text-inherit">
            <span className="font-medium text-zinc-500 dark:text-zinc-400 select-none">{orderedMatch[1]}.</span>
            <span className="leading-relaxed">{parseInline(orderedMatch[2])}</span>
          </div>
        );
        return;
      }

      // Headings
      if (line.startsWith('### ')) {
        elements.push(
          <h4 key={`h4-${index}`} className="mt-4 mb-2 text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {parseInline(line.slice(4))}
          </h4>
        );
        return;
      }
      if (line.startsWith('## ')) {
        elements.push(
          <h3 key={`h3-${index}`} className="mt-5 mb-2.5 text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100 border-b border-zinc-200 dark:border-zinc-800 pb-1">
            {parseInline(line.slice(3))}
          </h3>
        );
        return;
      }
      if (line.startsWith('# ')) {
        elements.push(
          <h2 key={`h2-${index}`} className="mt-6 mb-3 text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            {parseInline(line.slice(2))}
          </h2>
        );
        return;
      }

      // Empty lines
      if (!line.trim()) {
        elements.push(<div key={`space-${index}`} className="h-2" />);
        return;
      }

      // Regular paragraph
      elements.push(
        <p key={`p-${index}`} className="my-1.5 leading-relaxed text-zinc-700 dark:text-zinc-300">
          {parseInline(line)}
        </p>
      );
    });

    flushList('final-flush');
    return elements;
  };

  return <div className={`text-sm ${className}`}>{renderFormatted(content)}</div>;
};
