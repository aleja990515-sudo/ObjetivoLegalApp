import type { ReactNode } from 'react';

interface Props {
  titulo: string;
  descripcion?: string;
  /** Acción principal de la vista (botón o enlace). */
  accion?: ReactNode;
}

export function PageHeader({ titulo, descripcion, accion }: Props) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        <h1 className="m-0 text-xl font-semibold tracking-tight">{titulo}</h1>
        {descripcion && <p className="mt-1 mb-0 text-sm text-muted-foreground">{descripcion}</p>}
      </div>
      {accion && <div className="shrink-0">{accion}</div>}
    </header>
  );
}
