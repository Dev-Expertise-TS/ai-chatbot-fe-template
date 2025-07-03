import Link from 'next/link';
import React, { memo, useRef, useState, useEffect } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import ScrollContainer from 'react-indiana-drag-scroll';
import { CodeBlock } from './code-block';
import { cn } from '@/lib/utils';
import { useTableContainerWidth } from '@/lib/hooks/use-table-container-width';

// Custom table component with scroll indicators
const TableWithScrollIndicator = ({ children, ...props }: any) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const containerWidth = useTableContainerWidth();

  const checkScrollability = () => {
    const element = scrollRef.current;
    if (!element) return;

    const { scrollLeft, scrollWidth, clientWidth } = element;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
  };

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    checkScrollability();
    element.addEventListener('scroll', checkScrollability);
    window.addEventListener('resize', checkScrollability);

    return () => {
      element.removeEventListener('scroll', checkScrollability);
      window.removeEventListener('resize', checkScrollability);
    };
  }, []);

  // containerWidth가 변경될 때마다 스크롤 가능 여부 재확인
  useEffect(() => {
    checkScrollability();
  }, [containerWidth]);

  return (
    <div
      className="markdown-table-container my-4 relative overflow-hidden"
      style={containerWidth !== undefined ? { width: containerWidth } : {}}
    >
      <ScrollContainer
        innerRef={scrollRef}
        className={cn(
          'overflow-x-auto w-full min-w-0 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm cursor-grab active:cursor-grabbing',
          canScrollLeft && 'scroll-shadow-left',
          canScrollRight && 'scroll-shadow-right',
        )}
        onEndScroll={checkScrollability}
      >
        <table
          className="markdown-table divide-y divide-gray-200 dark:divide-gray-700 w-max min-w-full"
          {...props}
        >
          {children}
        </table>
      </ScrollContainer>
    </div>
  );
};

const components: Partial<Components> = {
  // @ts-expect-error
  code: CodeBlock,
  pre: ({ children }) => <>{children}</>,
  ol: ({ node, children, ...props }) => {
    return (
      <ol className="list-decimal list-outside ml-4" {...props}>
        {children}
      </ol>
    );
  },
  li: ({ node, children, ...props }) => {
    return (
      <li className="py-1" {...props}>
        {children}
      </li>
    );
  },
  ul: ({ node, children, ...props }) => {
    return (
      <ul className="list-decimal list-outside ml-4" {...props}>
        {children}
      </ul>
    );
  },
  strong: ({ node, children, ...props }) => {
    return (
      <span className="font-semibold" {...props}>
        {children}
      </span>
    );
  },
  a: ({ node, children, ...props }) => {
    return (
      // @ts-expect-error
      <Link
        className="text-blue-500 hover:underline"
        target="_blank"
        rel="noreferrer"
        {...props}
      >
        {children}
      </Link>
    );
  },
  h1: ({ node, children, ...props }) => {
    return (
      <h1 className="text-3xl font-semibold mt-6 mb-2" {...props}>
        {children}
      </h1>
    );
  },
  h2: ({ node, children, ...props }) => {
    return (
      <h2 className="text-2xl font-semibold mt-6 mb-2" {...props}>
        {children}
      </h2>
    );
  },
  h3: ({ node, children, ...props }) => {
    return (
      <h3 className="text-xl font-semibold mt-6 mb-2" {...props}>
        {children}
      </h3>
    );
  },
  h4: ({ node, children, ...props }) => {
    return (
      <h4 className="text-lg font-semibold mt-6 mb-2" {...props}>
        {children}
      </h4>
    );
  },
  h5: ({ node, children, ...props }) => {
    return (
      <h5 className="text-base font-semibold mt-6 mb-2" {...props}>
        {children}
      </h5>
    );
  },
  h6: ({ node, children, ...props }) => {
    return (
      <h6 className="text-sm font-semibold mt-6 mb-2" {...props}>
        {children}
      </h6>
    );
  },
  table: ({ node, children, ...props }) => {
    return (
      <TableWithScrollIndicator {...props}>{children}</TableWithScrollIndicator>
    );
  },
  thead: ({ node, children, ...props }) => {
    return (
      <thead className="bg-gray-50 dark:bg-gray-800/70 w-fit" {...props}>
        {children}
      </thead>
    );
  },
  tbody: ({ node, children, ...props }) => {
    return (
      <tbody
        className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700 w-fit"
        {...props}
      >
        {children}
      </tbody>
    );
  },
  tr: ({ node, children, ...props }) => {
    return (
      <tr
        className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors w-fit"
        {...props}
      >
        {children}
      </tr>
    );
  },
  th: ({ node, children, ...props }) => {
    return (
      <th
        className="px-4 py-3 text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider w-fit max-w-[256px] min-w-0 overflow-hidden text-ellipsis"
        {...props}
      >
        <div className="max-w-[256px] overflow-hidden text-ellipsis">
          {children}
        </div>
      </th>
    );
  },
  td: ({ node, children, ...props }) => {
    return (
      <td
        className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 whitespace-normal break-words w-fit max-w-[256px] min-w-0 overflow-hidden text-ellipsis"
        {...props}
      >
        <div className="max-w-[256px] overflow-hidden text-ellipsis">
          {children}
        </div>
      </td>
    );
  },
  img: ({ src, alt, ...props }) => {
    return (
      <img
        src={src}
        alt={alt || ''}
        className="rounded-2xl markdown-image max-w-full"
        loading="lazy"
        {...props}
      />
    );
  },
};

const remarkPlugins = [remarkGfm];
const rehypePlugins = [rehypeRaw];

const NonMemoizedMarkdown = ({ children }: { children: string }) => {
  return (
    <ReactMarkdown
      remarkPlugins={remarkPlugins}
      rehypePlugins={rehypePlugins}
      components={components}
    >
      {children}
    </ReactMarkdown>
  );
};

export const Markdown = memo(
  NonMemoizedMarkdown,
  (prevProps, nextProps) => prevProps.children === nextProps.children,
);
