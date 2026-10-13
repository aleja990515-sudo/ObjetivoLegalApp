/** Estilo del `<h1>` de página. Compartido por page-header, detalle y las pantallas de acceso. */
export const CLASE_TITULO = 'm-0 text-xl font-semibold tracking-tight';

interface Props {
  titulo: string;
  descripcion?: string;
}

export function PageHeader({ titulo, descripcion }: Props) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        <h1 className={CLASE_TITULO}>{titulo}</h1>
        {descripcion && <p className="mt-1 mb-0 text-sm text-muted-foreground">{descripcion}</p>}
      </div>
    </header>
  );
}
