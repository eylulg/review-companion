'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@eylulg/ui/button';
import { Drawer } from '@eylulg/ui/drawer';
import { Switch } from '@eylulg/ui/switch';
import { Textarea } from '@eylulg/ui/textarea';
import { Copy } from 'lucide-react';
import { buildReviewMarkdown, exportableFindings } from '@/lib/markdown-export';
import type { FileSummary, PullRequestMeta, TriagedFinding } from '@/lib/types';

interface ExportDrawerProps {
  onClose: () => void;
  findings: TriagedFinding[];
  files: FileSummary[];
  pr: PullRequestMeta | null;
  linkLines: boolean;
}

/** Mounted only while open (and loaded lazily), so its state starts fresh every time. */
export default function ExportDrawer({
  onClose,
  findings,
  files,
  pr,
  linkLines,
}: ExportDrawerProps) {
  const [includePending, setIncludePending] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const unmounted = useRef<AbortController | null>(null);
  const acceptedCount = findings.filter((finding) => finding.status === 'accepted').length;
  // With nothing accepted yet, export everything not dismissed so the drawer is never empty by surprise.
  const effectiveIncludePending = includePending || acceptedCount === 0;
  const fileOrder = files.map((file) => file.path);
  const markdown = buildReviewMarkdown(findings, pr, {
    includePending: effectiveIncludePending,
    linkLines,
    fileOrder,
  });
  const count = exportableFindings(findings, {
    includePending: effectiveIncludePending,
    fileOrder,
  }).length;

  useEffect(() => {
    const controller = new AbortController();
    unmounted.current = controller;
    return () => controller.abort();
  }, []);

  function handleOpenChange(open: boolean) {
    if (!open) onClose();
  }

  async function copy(signal: AbortSignal | undefined) {
    try {
      await navigator.clipboard.writeText(markdown);
      if (!signal?.aborted) setCopyStatus('Copied to clipboard.');
    } catch {
      if (!signal?.aborted) setCopyStatus('Copy failed. Select the text and copy it manually.');
    }
  }

  function handleCopy() {
    copy(unmounted.current?.signal).catch(() =>
      setCopyStatus('Copy failed. Select the text and copy it manually.'),
    );
  }

  return (
    <Drawer
      isOpen
      onOpenChange={handleOpenChange}
      size='lg'
      title='Export review comments'
      description='GitHub Markdown grouped by file. Paste each block as a comment on the cited line, or paste everything as the review summary.'
      footer={
        <>
          <p role='status' className='text-sm text-secondary sm:mr-auto sm:self-center'>
            {copyStatus}
          </p>
          <Button iconLeading={Copy} onPress={handleCopy} isDisabled={count === 0}>
            Copy Markdown
          </Button>
        </>
      }
    >
      <div className='flex flex-col gap-4'>
        <Switch
          isSelected={effectiveIncludePending}
          isDisabled={acceptedCount === 0}
          onChange={setIncludePending}
          hint={
            acceptedCount === 0
              ? 'Nothing is accepted yet, so every finding that is not dismissed is included.'
              : `${acceptedCount} accepted.`
          }
        >
          Include findings you have not triaged
        </Switch>
        <Textarea
          label={`Markdown for ${count} ${count === 1 ? 'comment' : 'comments'}`}
          value={markdown}
          isReadOnly
          rows={18}
          font='data'
        />
      </div>
    </Drawer>
  );
}
