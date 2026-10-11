/** Icono Phosphor de `public/icons.svg`. Decorativo: el nombre accesible va en el texto o en aria-label del control. */
export function Icon({ name }: { name: string }) {
  return (
    <svg className="icon" aria-hidden="true" focusable="false">
      <use href={`/icons.svg#${name}`} />
    </svg>
  );
}
