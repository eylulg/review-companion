'use client';

import { useEffect, useRef } from 'react';

export interface ReviewShortcutHandlers {
  next: () => void;
  previous: () => void;
  accept: () => void;
  dismiss: () => void;
  edit: () => void;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    const type = (target as HTMLInputElement).type;
    return !['checkbox', 'radio', 'button', 'submit', 'reset'].includes(type);
  }
  return false;
}

/**
 * j / k move between findings, a accepts, d dismisses, e edits. Ignored while typing, with modifier
 * keys held, or when `enabled` is false (for example while a dialog is open).
 */
export function useReviewShortcuts(handlers: ReviewShortcutHandlers, enabled: boolean) {
  const latest = useRef(handlers);

  useEffect(() => {
    latest.current = handlers;
  });

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isTypingTarget(event.target)
      )
        return;
      const map: Record<string, keyof ReviewShortcutHandlers> = {
        j: 'next',
        k: 'previous',
        a: 'accept',
        d: 'dismiss',
        e: 'edit',
      };
      const action = map[event.key];
      if (!action) return;
      event.preventDefault();
      latest.current[action]();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}
