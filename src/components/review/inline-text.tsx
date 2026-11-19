import { Fragment } from 'react';

/** Renders text with `inline code` spans and paragraph breaks. Everything else stays plain text. */
export function InlineText({ text }: { text: string }) {
  const paragraphs = text.split(/\n{2,}/);
  return (
    <>
      {paragraphs.map((paragraph, index) => (
        <p key={index} className='text-sm whitespace-pre-wrap text-secondary'>
          {paragraph.split(/(`[^`\n]+`)/g).map((part, partIndex) =>
            part.startsWith('`') && part.endsWith('`') && part.length > 2 ? (
              <code
                key={partIndex}
                className='rounded-xs bg-secondary px-1 py-0.5 font-data text-[0.85em] text-primary'
              >
                {part.slice(1, -1)}
              </code>
            ) : (
              <Fragment key={partIndex}>{part}</Fragment>
            ),
          )}
        </p>
      ))}
    </>
  );
}
