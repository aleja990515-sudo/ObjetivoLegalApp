import { type Icon as IconoPhosphor } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

interface Props {
  /** Conecta el encabezado con el `aria-labelledby` de su sección. */
  id: string;
  titulo: string;
  /** Icono decorativo a la izquierda; sin icono el encabezado va en una sola línea. */
  icono?: IconoPhosphor;
}

/** Encabezado de sección (`h2`) con icono opcional a la izquierda. */
export function TituloSeccion({ id, titulo, icono: Icono }: Props) {
  return (
    <h2 id={id} className={cn('m-0 text-base font-semibold', Icono && 'flex items-center gap-2')}>
      {Icono && <Icono aria-hidden="true" weight="regular" className="size-5 text-muted-foreground" />}
      {titulo}
    </h2>
  );
}