import { ButtonLink } from '@/components/ui/button';
import { LogoMark } from '@/components/shell/logo';

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="grid max-w-md justify-items-center gap-4 text-center">
        <LogoMark className="size-12" />
        <h1 className="font-display text-[28px] font-[650] leading-[34px]">
          This page does not exist
        </h1>
        <p className="text-ink-muted">
          The link may be old, or the incident was removed. Start again from the overview.
        </p>
        <ButtonLink href="/">Go to Overview</ButtonLink>
      </div>
    </main>
  );
}
