'use client';

import { type FormEvent, useState } from 'react';
import { Button } from '@eylulg/ui/button';
import { Card, CardHeader } from '@eylulg/ui/card';
import { Input } from '@eylulg/ui/input';
import { Select, SelectItem } from '@eylulg/ui/select';
import { Switch } from '@eylulg/ui/switch';
import { ArrowRight } from 'lucide-react';
import type { Key } from 'react-aria-components';
import { parsePullRequestUrl } from '@/lib/github';
import { MODEL_OPTIONS } from '@/lib/models';
import type { ReviewRequest } from '@/lib/types';

interface LandingProps {
  demo: boolean;
  defaultModel: string;
  onStart: (request: ReviewRequest) => void;
}

interface Example {
  url: string;
  repo: string;
  title: string;
  size: string;
}

export const URL_INPUT_ID = 'pull-request-url';

/** Real public pull requests used as one-click examples. */
const EXAMPLES: Example[] = [
  {
    url: 'https://github.com/vitejs/vite/pull/24041',
    repo: 'vitejs/vite',
    title: 'perf(css): import sass once instead of per file',
    size: 'Small, 1 file',
  },
  {
    url: 'https://github.com/vitejs/vite/pull/24044',
    repo: 'vitejs/vite',
    title: 'fix: escape ids in resolve virtual modules',
    size: 'Medium, 5 files',
  },
  {
    url: 'https://github.com/pmndrs/zustand/pull/3595',
    repo: 'pmndrs/zustand',
    title: 'fix(middleware): devtools action dispatching',
    size: 'Large, 3 files',
  },
];

/** Demo mode replays one saved review, so it offers exactly that one instead of three pull requests it cannot show. */
const SAMPLE_EXAMPLE: Example = {
  url: 'https://github.com/sample/team-directory/pull/42',
  repo: 'sample/team-directory',
  title: 'Add search and pagination to the people table',
  size: '3 files, 9 findings',
};

const INVALID_URL_MESSAGE =
  'Enter a pull request URL such as https://github.com/owner/repo/pull/123.';

export function Landing({ demo, defaultModel, onStart }: LandingProps) {
  const examples = demo ? [SAMPLE_EXAMPLE] : EXAMPLES;
  const [url, setUrl] = useState('');
  const [model, setModel] = useState(defaultModel);
  const [includeSkipped, setIncludeSkipped] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function submit(value: string) {
    if (!parsePullRequestUrl(value)) {
      setError(INVALID_URL_MESSAGE);
      return;
    }
    setError(null);
    onStart({ url: value.trim(), model, includeSkipped });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit(url);
  }

  function handleUrlChange(value: string) {
    setUrl(value);
    setError(null);
  }

  function handleModelChange(key: Key | null) {
    const option = MODEL_OPTIONS.find((candidate) => candidate.id === key);
    if (option) setModel(option.id);
  }

  function handleExample(exampleUrl: string) {
    setUrl(exampleUrl);
    submit(exampleUrl);
  }

  return (
    <div className='mx-auto flex max-w-3xl flex-col gap-10 py-6 md:py-12'>
      <div className='flex flex-col gap-4'>
        <h1 className='text-display-sm md:text-display-md font-semibold text-primary'>
          Review a pull request with Claude
        </h1>
        <p className='text-lg text-tertiary'>
          Paste a public GitHub pull request. Claude reads the diff file by file and streams back
          findings with a severity, a line and, when the fix is certain, a suggested change. Accept,
          dismiss or edit each one, then copy them as review comments.
        </p>
      </div>

      <Card className='gap-6'>
        <form noValidate onSubmit={handleSubmit} className='flex flex-col gap-6'>
          <Input
            id={URL_INPUT_ID}
            label='Pull request URL'
            name='url'
            type='url'
            inputMode='url'
            autoComplete='off'
            placeholder='https://github.com/owner/repo/pull/123'
            value={url}
            onChange={handleUrlChange}
            isInvalid={error !== null}
            hint='Public repositories work without a token.'
            errorMessage={error ?? undefined}
          />

          <Select
            label='Model'
            selectedKey={model}
            onSelectionChange={handleModelChange}
            items={MODEL_OPTIONS}
          >
            {(option) => (
              <SelectItem id={option.id} description={option.description}>
                {option.label}
              </SelectItem>
            )}
          </Select>

          <Switch
            isSelected={includeSkipped}
            onChange={setIncludeSkipped}
            hint='Skipped by default because they rarely need a human review. Binaries are always skipped.'
          >
            Include lockfiles, generated and deleted files
          </Switch>

          <div>
            <Button type='submit' size='lg' iconTrailing={ArrowRight}>
              Start review
            </Button>
          </div>
        </form>
      </Card>

      <section aria-labelledby='examples-heading' className='flex flex-col gap-3'>
        <h2 id='examples-heading' className='text-md font-semibold text-primary'>
          {demo ? 'Or replay the sample review' : 'Or try an example'}
        </h2>
        {demo && (
          <p className='text-sm text-tertiary'>
            Demo mode has one saved review, of a sample pull request. Any URL you paste replays it
            too, with no call to GitHub or Claude.
          </p>
        )}
        <ul className='grid gap-3 md:grid-cols-3'>
          {examples.map((example) => (
            <li key={example.url}>
              <ExampleButton example={example} onSelect={handleExample} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function ExampleButton({
  example,
  onSelect,
}: {
  example: Example;
  onSelect: (url: string) => void;
}) {
  function handlePress() {
    onSelect(example.url);
  }

  return (
    <Card onPress={handlePress} className='h-full'>
      <CardHeader title={example.title} description={`${example.repo}, ${example.size}`} />
    </Card>
  );
}
