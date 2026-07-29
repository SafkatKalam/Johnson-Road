import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
  rounded?: 'sm' | 'md' | 'lg' | 'full';
}

const roundedMap = { sm: 'rounded', md: 'rounded-lg', lg: 'rounded-xl', full: 'rounded-full' };

export function Skeleton({ className, rounded = 'md' }: SkeletonProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden bg-white/[0.04]',
        roundedMap[rounded],
        className,
      )}
    >
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" />
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="surface p-5">
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-9" rounded="lg" />
        <Skeleton className="h-5 w-16" rounded="full" />
      </div>
      <Skeleton className="mt-4 h-7 w-24" />
      <Skeleton className="mt-2 h-3 w-32" />
      <Skeleton className="mt-4 h-2 w-full" />
    </div>
  );
}
