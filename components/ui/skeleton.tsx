import { cn } from '@/lib/utils'

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn('bg-accent animate-pulse rounded-lg motion-reduce:animate-none', className)}
      {...props}
    />
  )
}

export { Skeleton }
