interface Props {
  /** Lado del icono en píxeles. */
  size?: number;
  /** Clases del texto, para el caso del riel donde solo debe leerse en escritorio. */
  labelClassName?: string;
}

/**
 * Lockup de marca: icono y nombre. Va dentro del elemento del llamador (`span`, `Link` o `div`)
 * porque cada sitio aporta su propia envoltura (tamaño de fila, relleno, enlace).
 */
export function Marca({ size = 28, labelClassName }: Props) {
  return (
    <>
      <img src="/icon.svg" alt="" width={size} height={size} />
      <span className={labelClassName}>Mis Procesos</span>
    </>
  );
}