'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Language } from '@/lib/data/types';
import { LANGUAGE_LABEL } from '@/lib/util/labels';

/**
 * Most wash staff read Marathi or Hindi rather than English, so this sits on
 * the profile tab rather than buried in a settings menu.
 */
export function LanguagePicker({
  current,
  options,
}: {
  current: Language;
  options: Language[];
}) {
  const router = useRouter();
  const [value, setValue] = useState<Language>(current);
  const [pending, setPending] = useState(false);

  async function choose(language: Language) {
    if (language === value) return;
    const previous = value;
    setValue(language);
    setPending(true);
    try {
      const response = await fetch('/api/staff/language', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language }),
      });
      if (!response.ok) {
        setValue(previous);
        return;
      }
      router.refresh();
    } catch {
      setValue(previous);
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className="flex gap-1 rounded-lg bg-surface-raised p-1"
      role="radiogroup"
      aria-label="App language"
    >
      {options.map((language) => (
        <button
          key={language}
          type="button"
          role="radio"
          aria-checked={value === language}
          disabled={pending}
          onClick={() => choose(language)}
          className={`flex-1 rounded-md py-2 text-sm font-bold transition-colors ${
            value === language
              ? 'bg-white text-navy-800 shadow-card'
              : 'text-ink-mute hover:text-ink'
          }`}
        >
          {LANGUAGE_LABEL[language]}
        </button>
      ))}
    </div>
  );
}
