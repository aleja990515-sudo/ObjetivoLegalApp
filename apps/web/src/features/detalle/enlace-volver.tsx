import { ArrowLeft } from '@phosphor-icons/react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface Props {
  /** Destino del enlace; por defecto, la lista de procesos. */
  href?: string;
  className?: string;
}

/** Enlace de retroceso al listado, compartido por la cabecera y el estado de error del detalle. */
export function EnlaceVolver({ href = '/', className }: Props) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex min-h-11 w-fit items-center gap-1.5 text-sm text-muted-foreground no-underline hover:text-foreground min-[640px]:min-h-9',
        className,
      )}
    >
      <ArrowLeft aria-hidden="true" weight="regular" className="size-4" />
      Volver a procesos
    </Link>
  );
}