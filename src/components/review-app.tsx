'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { DemoBanner } from '@/components/demo-banner';
import { Landing, URL_INPUT_ID } from '@/components/landing/landing';
import { useHydrated } from '@/hooks/use-hydrated';
import { useReviewRunner } from '@/hooks/use-review-runner';
import { useReviewStore } from '@/store/review-store';

// The review screen, its cards and the store-driven triage code are only needed once a review starts.
const ReviewScreen = dynamic(
  () => import('@/components/review/review-screen').then((module) => module.ReviewScreen),
  { ssr: false },
);

interface ReviewAppProps {
  demo: boolean;
  defaultModel: string;
}

export function ReviewApp({ demo, defaultModel }: ReviewAppProps) {
  const hydrated = useHydrated();
  const status = useReviewStore((state) => state.status);
  const { start, cancel } = useReviewRunner();
  const showReview = hydrated && status !== 'idle';

  useEffect(() => {
    Promise.resolve(useReviewStore.persist.rehydrate()).catch(() =>
      useReviewStore.getState().reset(),
    );
  }, []);

  function handleNewReview() {
    cancel();
    useReviewStore.getState().reset();
    // The button that triggered this unmounts with the review screen, so focus the URL field instead.
    requestAnimationFrame(() => document.getElementById(URL_INPUT_ID)?.focus());
  }

  return (
    <>
      {demo && <DemoBanner />}
      {showReview ? (
        <ReviewScreen onStart={start} onCancel={cancel} onNewReview={handleNewReview} />
      ) : (
        <Landing demo={demo} defaultModel={defaultModel} onStart={start} />
      )}
    </>
  );
}
