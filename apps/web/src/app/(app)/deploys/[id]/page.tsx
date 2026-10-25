import type { Metadata } from 'next';
import { DeployDetail } from '@/features/deploys/deploy-detail';

export const metadata: Metadata = { title: 'Deploy' };

export default async function DeployPage({ params }: { params: Promise<{ id: string }> }) {
  return <DeployDetail id={(await params).id} />;
}
