'use client';

import { Badge } from '@eylulg/ui/badge';
import { Button } from '@eylulg/ui/button';
import { Card, CardBody, CardFooter, CardHeader } from '@eylulg/ui/card';
import { cx } from '@eylulg/ui/cx';
import { Check, ExternalLink, Pencil, X } from 'lucide-react';
import { LINK_CLASS, SCROLL_TARGET_CLASS } from '@/components/styles';
import { lineUrl } from '@/lib/github';
import { SEVERITY_LABEL } from '@/lib/markdown-export';
import type { FindingEdit, PullRequestMeta, TriageStatus, TriagedFinding } from '@/lib/types';
import { FindingEditor } from './finding-editor';
import { InlineText } from './inline-text';
import { SEVERITY_COLOR } from './severity';
import { SuggestionDiff } from './suggestion-diff';

interface FindingCardProps {
  finding: TriagedFinding;
  pr: PullRequestMeta | null;
  linkLines: boolean;
  isActive: boolean;
  isEditing: boolean;
  onStatusChange: (id: string, status: TriageStatus) => void;
  onEdit: (id: string) => void;
  onSaveEdit: (id: string, edit: FindingEdit) => void;
  onCloseEditor: (id: string) => void;
}

export function findingDomId(id: string): string {
  return `finding-${id}`;
}

export function editButtonId(id: string): string {
  return `${findingDomId(id)}-edit`;
}

export function titleInputId(id: string): string {
  return `${findingDomId(id)}-title-input`;
}

export function FindingCard({
  finding,
  pr,
  linkLines,
  isActive,
  isEditing,
  onStatusChange,
  onEdit,
  onSaveEdit,
  onCloseEditor,
}: FindingCardProps) {
  const lines = finding.endLine
    ? `Lines ${finding.line} to ${finding.endLine}`
    : `Line ${finding.line}`;

  function handleAccept() {
    onStatusChange(finding.id, 'accepted');
  }

  function handleDismiss() {
    onStatusChange(finding.id, 'dismissed');
  }

  function handleEdit() {
    onEdit(finding.id);
  }

  function handleSave(edit: FindingEdit) {
    onSaveEdit(finding.id, edit);
  }

  function handleCancel() {
    onCloseEditor(finding.id);
  }

  return (
    <Card
      id={findingDomId(finding.id)}
      role='article'
      tabIndex={-1}
      aria-label={finding.title}
      className={cx(
        SCROLL_TARGET_CLASS,
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
        isActive && 'ring-2 ring-focus',
        finding.status === 'dismissed' && 'opacity-70',
      )}
    >
      <div className='flex flex-wrap items-center gap-2'>
        <Badge color={SEVERITY_COLOR[finding.severity]}>{SEVERITY_LABEL[finding.severity]}</Badge>
        <Badge color='gray'>{finding.category}</Badge>
        {finding.status !== 'pending' && (
          <Badge color={finding.status === 'accepted' ? 'success' : 'gray'}>
            {finding.status === 'accepted' ? 'Accepted' : 'Dismissed'}
          </Badge>
        )}
        {finding.edited && <Badge color='brand'>Edited</Badge>}
        <span className='ml-auto text-xs text-tertiary'>
          {Math.round(finding.confidence * 100)}% confident
        </span>
      </div>

      <CardHeader
        headingLevel={4}
        title={finding.title}
        description={
          linkLines && pr ? (
            <a
              href={lineUrl(pr, finding.file, finding.line, finding.endLine)}
              target='_blank'
              rel='noreferrer'
              aria-label={`${lines} of ${finding.file} on GitHub (opens in a new tab)`}
              className={LINK_CLASS}
            >
              {lines}
              <ExternalLink aria-hidden='true' className='size-3.5' />
            </a>
          ) : (
            lines
          )
        }
      />

      {isEditing ? (
        <FindingEditor
          finding={finding}
          titleId={titleInputId(finding.id)}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      ) : (
        <>
          <CardBody className='flex flex-col gap-2'>
            <InlineText text={finding.explanation} />
          </CardBody>
          {finding.suggestion !== undefined && (
            <SuggestionDiff original={finding.originalCode} suggestion={finding.suggestion} />
          )}
          <CardFooter className='justify-start'>
            <Button
              size='sm'
              variant={finding.status === 'accepted' ? 'primary' : 'secondary'}
              iconLeading={Check}
              aria-label={`Accept finding: ${finding.title}`}
              aria-pressed={finding.status === 'accepted'}
              aria-keyshortcuts='a'
              onPress={handleAccept}
            >
              Accept
            </Button>
            <Button
              size='sm'
              variant='secondary'
              iconLeading={X}
              aria-label={`Dismiss finding: ${finding.title}`}
              aria-pressed={finding.status === 'dismissed'}
              aria-keyshortcuts='d'
              onPress={handleDismiss}
            >
              Dismiss
            </Button>
            <Button
              id={editButtonId(finding.id)}
              size='sm'
              variant='tertiary'
              iconLeading={Pencil}
              aria-label={`Edit finding: ${finding.title}`}
              aria-keyshortcuts='e'
              onPress={handleEdit}
            >
              Edit
            </Button>
          </CardFooter>
        </>
      )}
    </Card>
  );
}
