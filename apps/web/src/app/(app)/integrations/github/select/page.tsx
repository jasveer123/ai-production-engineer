import type { Metadata } from 'next';
import { Suspense } from 'react';
import { GitHubRepoSelect } from '@/features/setup/components/github-repo-select';

export const metadata: Metadata = { title: 'Select GitHub repositories' };

export default function GitHubSelectPage() {
  return (
    <Suspense>
      <GitHubRepoSelect />
    </Suspense>
  );
}
