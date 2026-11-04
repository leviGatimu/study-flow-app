import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export function Brand({ className }: { className?: string }) {
  return <Link href="/" aria-label="Study Flow home" className={cn('inline-flex w-fit items-center gap-3 rounded-lg text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',className)}>
    <Image src="/logo.png" alt="" width={36} height={36} className="shrink-0 rounded-lg" />
    <span className="text-lg font-semibold">Study Flow</span>
  </Link>;
}
