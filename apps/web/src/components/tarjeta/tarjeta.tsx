import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

interface Props extends ComponentProps<'div'> {
  /** `vacio` es el envoltorio de un estado vacío: mismo borde y fondo, sin relleno propio. */
  variante?: 'contenido' | 'vacio';
}

/** Superficie de contenido: el `rounded-lg border border-line bg-card p-4` que se repetía en ~20 sitios. */
export function Tarjeta({ variante = 'contenido', className, ...props }: Props) {
  return (
    <div
      className={cn('rounded-lg border border-line bg-card', variante === 'contenido' && 'p-4', className)}
      {...props}
    />
  );
}