import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const ESTIRADO =
  "after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-3 focus-visible:after:ring-ring/50";

interface Props {
  href: string;
  className?: string;
  children: ReactNode;
}

/**
 * Enlace estirado: cubre toda la fila para que la fila entera sea clicable.
 * El contenedor padre debe ser `relative`.
 */
export function FilaEnlazada({ href, className, children }: Props) {
  return (
    <Link href={href} className={cn('font-semibold text-foreground no-underline', ESTIRADO, className)}>
      {children}
    </Link>
  );
}