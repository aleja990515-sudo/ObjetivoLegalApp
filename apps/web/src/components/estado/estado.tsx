import { WarningCircle, type Icon as IconoPhosphor } from '@phosphor-icons/react';
import type { ReactNode } from 'react';

interface PropsVacio {
  icono: IconoPhosphor;
  titulo: string;
  /** Cómo poblar la vista: qué hacer para que aparezca contenido. */
  children?: ReactNode;
}

/** Estado vacío: icono, título y el paso que llena la vista. */
export function EstadoVacio({ icono: Icono, titulo, children }: PropsVacio) {
  return (
    <div className="grid justify-items-center gap-2 px-4 py-10 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
        <Icono aria-hidden="true" weight="regular" className="size-6" />
      </span>
      <p className="m-0 font-medium text-foreground">{titulo}</p>
      {children && <p className="m-0 max-w-[46ch] text-sm text-muted-foreground">{children}</p>}
    </div>
  );
}

/** Error inline con el mensaje del servidor o uno genérico; no sustituye la vista. */
export function EstadoError({ mensaje }: { mensaje: string }) {
  return (
    <p role="alert" className="m-0 flex items-start gap-2 text-sm text-destructive">
      <WarningCircle aria-hidden="true" weight="regular" className="mt-0.5 size-4 shrink-0" />
      <span>{mensaje}</span>
    </p>
  );
}
