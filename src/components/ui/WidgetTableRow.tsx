'use client';

import clsx from 'clsx';
import { useRouter } from 'next/navigation';
import type { ComponentProps, ReactNode } from 'react';

export interface WidgetTableRowProps extends ComponentProps<'tr'> {
  href?: string;
  className?: string;
  children: ReactNode;
}

export function WidgetTableRow({
  href,
  className,
  children,
  ...props
}: WidgetTableRowProps) {
  const router = useRouter();

  return (
    <tr
      {...props}
      onClick={href ? () => router.push(href) : undefined}
      className={clsx(
        'transition-colors hover:bg-slate-50/60',
        href && 'cursor-pointer',
        className,
      )}
    >
      {children}
    </tr>
  );
}
