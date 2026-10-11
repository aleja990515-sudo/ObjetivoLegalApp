import type { InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Texto de la casilla. Sin etiqueta, la casilla se usa dentro de una fila que ya aporta el contexto. */
  children?: ReactNode;
  /** Ayuda opcional bajo la etiqueta. */
  descripcion?: string;
}

const CAJA = 'size-5 shrink-0 accent-primary';

/** Casilla de verificación con objetivo táctil de 44px. Sin etiqueta devuelve solo la caja. */
export function Casilla({ children, descripcion, className, ...props }: Props) {
  const caja = <input type="checkbox" className={cn(CAJA, className)} {...props} />;
  if (children === undefined) return caja;

  return (
    <label className="flex min-h-11 items-center gap-2.5 text-sm">
      {caja}
      <span className="grid gap-0.5">
        <span>{children}</span>
        {descripcion && <span className="text-xs text-muted-foreground">{descripcion}</span>}
      </span>
    </label>
  );
}