'use client';

import { useState, useRef, useEffect, ReactNode, useCallback } from 'react';
import Link from 'next/link';
import { IconDotsHorizontal } from '@/components/shell/icons';

export interface ActionMenuItem {
  id?: string;
  label: string;
  icon?: ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: 'default' | 'danger' | 'warning' | 'primary';
  disabled?: boolean;
  dividerBefore?: boolean;
}

interface TableActionMenuProps {
  items: ActionMenuItem[];
  align?: 'right' | 'left';
  triggerClassName?: string;
  label?: string;
}

export function TableActionMenu({
  items,
  align = 'right',
  triggerClassName,
  label = 'Actions',
}: TableActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpwards, setOpenUpwards] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const calculatePosition = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const spaceBelow = windowHeight - rect.bottom;
      // If less than 240px below the button, open upwards
      if (spaceBelow < 240 && rect.top > 240) {
        setOpenUpwards(true);
      } else {
        setOpenUpwards(false);
      }
    }
  }, []);

  const handleToggle = () => {
    if (!isOpen) {
      calculatePosition();
    }
    setIsOpen((prev) => !prev);
  };

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return (
    <div
      ref={containerRef}
      className={`relative inline-block text-left ${isOpen ? 'z-50' : 'z-10'}`}
    >
      <button
        type="button"
        onClick={handleToggle}
        aria-label={label}
        aria-expanded={isOpen}
        className={
          triggerClassName ??
          `inline-flex h-7 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-2xs hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 active:scale-95 transition-all cursor-pointer ${
            isOpen ? 'bg-slate-100 border-slate-400 text-slate-900 ring-2 ring-blue-500/20 shadow-xs' : ''
          }`
        }
        title={label}
      >
        <IconDotsHorizontal width={18} height={18} />
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          className={`absolute ${
            align === 'right' ? 'right-0' : 'left-0'
          } ${
            openUpwards ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          } z-50 w-52 sm:w-56 rounded-2xl border border-slate-200/90 bg-white/98 p-1.5 shadow-2xl backdrop-blur-md ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-100`}
        >
          <div className="py-1">
            {items.map((item, index) => {
              const key = item.id || `${item.label}-${index}`;
              const isDanger = item.variant === 'danger';
              const isWarning = item.variant === 'warning';
              const isPrimary = item.variant === 'primary';

              const itemClass = `group flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                item.disabled
                  ? 'opacity-40 cursor-not-allowed text-slate-400'
                  : isDanger
                    ? 'text-rose-600 hover:bg-rose-50 hover:text-rose-700'
                    : isWarning
                      ? 'text-amber-800 hover:bg-amber-50 hover:text-amber-900'
                      : isPrimary
                        ? 'text-blue-700 hover:bg-blue-50 hover:text-blue-800 font-bold'
                        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`;

              const content = (
                <>
                  {item.icon && (
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center text-sm transition-transform group-hover:scale-110">
                      {item.icon}
                    </span>
                  )}
                  <span className="truncate">{item.label}</span>
                </>
              );

              return (
                <div key={key}>
                  {item.dividerBefore && (
                    <div className="my-1 border-t border-slate-100" />
                  )}
                  {item.href ? (
                    <Link
                      href={item.href}
                      onClick={() => setIsOpen(false)}
                      className={itemClass}
                    >
                      {content}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      disabled={item.disabled}
                      onClick={() => {
                        setIsOpen(false);
                        item.onClick?.();
                      }}
                      className={itemClass}
                    >
                      {content}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
