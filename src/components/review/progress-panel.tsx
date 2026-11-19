import { ProgressBar } from '@eylulg/ui/progress-bar';
import { Spinner } from '@eylulg/ui/spinner';
import type { Progress, ReviewStatus } from '@/lib/types';

interface ProgressPanelProps {
  status: ReviewStatus;
  progress: Progress | null;
}

/** The live region screen readers use to follow the stream. Always mounted so announcements are not lost. */
export function ProgressPanel({ status, progress }: ProgressPanelProps) {
  const streaming = status === 'streaming';
  const percent =
    progress?.current !== undefined && progress.total
      ? Math.round((progress.current / progress.total) * 100)
      : null;

  return (
    <div className='flex flex-col gap-2'>
      <div
        role='status'
        aria-live='polite'
        aria-atomic='true'
        className='flex min-h-6 items-center gap-2 text-sm text-secondary'
      >
        {streaming && <Spinner size='sm' />}
        <span>{progress?.message ?? ''}</span>
      </div>
      {streaming && percent !== null && (
        <ProgressBar
          aria-label='Review progress'
          value={Math.max(5, percent)}
          hideValue
          size='sm'
        />
      )}
    </div>
  );
}
