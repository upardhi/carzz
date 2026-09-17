'use client';

import clsx from 'clsx';
import { ReactNode } from 'react';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
  contentClassName?: string;
}

export function Tooltip({
  content,
  children,
  position = 'top',
  className,
  contentClassName,
}: TooltipProps) {
  return (
    <div className={clsx('group relative inline-flex items-center', className)}>
      {children}
      <div
        className={clsx(
          'pointer-events-none absolute z-50 flex opacity-0 transition-all duration-200 ease-in-out group-hover:opacity-100',
          position === 'top' && 'bottom-full left-1/2 mb-2 -translate-x-1/2 -translate-y-1 group-hover:-translate-y-0',
          position === 'bottom' && 'top-full left-1/2 mt-2 -translate-x-1/2 translate-y-1 group-hover:translate-y-0',
          position === 'left' && 'right-full top-1/2 mr-2 -translate-y-1/2 -translate-x-1 group-hover:-translate-x-0',
          position === 'right' && 'left-full top-1/2 ml-2 -translate-y-1/2 translate-x-1 group-hover:translate-x-0',
        )}
      >
        <div
          className={clsx(
            'whitespace-nowrap rounded-md bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg ring-1 ring-white/10',
            contentClassName
          )}
        >
          {content}
          
          {/* Arrow */}
          <div
            className={clsx(
              'absolute h-2 w-2 bg-slate-800 rotate-45',
              position === 'top' && 'bottom-[-4px] left-1/2 -translate-x-1/2 border-r border-b border-white/10',
              position === 'bottom' && 'top-[-4px] left-1/2 -translate-x-1/2 border-l border-t border-white/10',
              position === 'left' && 'right-[-4px] top-1/2 -translate-y-1/2 border-r border-t border-white/10',
              position === 'right' && 'left-[-4px] top-1/2 -translate-y-1/2 border-l border-b border-white/10'
            )}
          />
        </div>
      </div>
    </div>
  );
}
