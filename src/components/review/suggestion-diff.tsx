import { CodeBlock } from '@eylulg/ui/code-block';

interface SuggestionDiffProps {
  original?: string;
  suggestion: string;
}

function prefixLines(text: string, marker: string): string {
  return text
    .split('\n')
    .map((line) => `${marker} ${line}`)
    .join('\n');
}

/** Shows the cited lines and the suggested replacement as a small removed and added diff. */
export function SuggestionDiff({ original, suggestion }: SuggestionDiffProps) {
  const diff = [
    original !== undefined ? prefixLines(original, '-') : null,
    prefixLines(suggestion, '+'),
  ]
    .filter((part) => part !== null)
    .join('\n');

  return (
    <CodeBlock label='Suggested change' wrap>
      {diff}
    </CodeBlock>
  );
}
