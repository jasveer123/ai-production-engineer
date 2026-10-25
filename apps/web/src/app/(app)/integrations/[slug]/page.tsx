import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Icon } from '@/components/ui/icon';
import { PageHeader } from '@/components/ui/page-header';
import { SetupView } from '@/features/integrations/components/setup-view';
import { getSendWay } from '@/features/integrations/ways';

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const way = getSendWay((await params).slug);
  return { title: way ? `Set up ${way.title}` : 'Not found' };
}

export default async function SetupPage({ params }: Params) {
  const { slug } = await params;
  const way = getSendWay(slug);
  if (!way) notFound();
  return (
    <>
      <Link
        href="/integrations/"
        className="inline-flex items-center gap-1.5 text-sm text-brand hover:underline"
      >
        <Icon name="arrowLeft" size="sm" />
        All integrations
      </Link>
      <PageHeader
        eyebrow={`Send data · Way ${way.number}`}
        title={way.title}
        description={way.bestFor}
      />
      <SetupView slug={slug} />
    </>
  );
}
