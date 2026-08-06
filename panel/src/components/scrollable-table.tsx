import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { calculateHorizontalOverflow } from '../lib/scroll-state';

interface ScrollableTableProps {
  className?: string;
  children: ReactNode;
}

interface OverflowState {
  left: boolean;
  right: boolean;
}

export function ScrollableTable({ className = '', children }: ScrollableTableProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState<OverflowState>({ left: false, right: false });

  const updateOverflow = useCallback(() => {
    const node = scrollRef.current;
    if (!node) return;
    const next = calculateHorizontalOverflow(node);
    setOverflow(current => current.left === next.left && current.right === next.right ? current : next);
  }, []);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const resizeObserver = new ResizeObserver(updateOverflow);
    const mutationObserver = new MutationObserver(updateOverflow);
    resizeObserver.observe(node);
    if (node.firstElementChild) resizeObserver.observe(node.firstElementChild);
    mutationObserver.observe(node, { childList: true, subtree: true, characterData: true });
    node.addEventListener('scroll', updateOverflow, { passive: true });
    updateOverflow();
    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      node.removeEventListener('scroll', updateOverflow);
    };
  }, [updateOverflow]);

  return (
    <div
      className="scrollable-table"
      data-overflow-left={overflow.left}
      data-overflow-right={overflow.right}
    >
      <div
        ref={scrollRef}
        className={`table-scroll ${className}`.trim()}
        data-overflow-left={overflow.left}
        data-overflow-right={overflow.right}
      >{children}</div>
    </div>
  );
}
