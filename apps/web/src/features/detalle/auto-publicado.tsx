import { ArrowSquareOut, FilePdf } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { buttonVariants } from '@/components/ui/button';
import { fecha } from '@/features/procesos/formato';
import type { AutoPublicado, ConfianzaAuto } from '@/features/procesos/modelo';

/** Etiqueta visible de cada nivel de certeza. */
export const ETIQUETA_CONFIANZA: Record<ConfianzaAuto, string> = {
  exacto: 'PDF exacto',
  del_dia: 'PDF del día, revisar',
  estado: 'Ver estado',
  sin_resultado: 'No encontrado',
};

const AYUDA: Record<ConfianzaAuto, string> = {
  exacto: 'El nombre del archivo corresponde al radicado.',
  del_dia: 'El despacho publica un solo PDF con todos los autos del día. Busca el radicado dentro del documento.',
  estado: 'No se identificó el PDF del auto. Revisa los documentos del estado.',
  sin_resultado: 'No hay publicaciones del despacho para la fecha de esta actuación en Publicaciones Procesales.',
};

function EnlaceExterno({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className={buttonVariants({ variant: 'outline', size: 'sm' })} href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

/** Resultado de la búsqueda del auto en los estados electrónicos, con su nivel de certeza. */
export function ResultadoAutoPublicado({ auto }: { auto: AutoPublicado }) {
  const { confianza, urlPdf, urlEstado, nombreArchivo, numeroEstado, fechaPublicacion } = auto;
  const conPdf = (confianza === 'exacto' || confianza === 'del_dia') && urlPdf;
  const estado = [numeroEstado ? `Estado No. ${numeroEstado}` : null, fechaPublicacion ? `publicado ${fecha(fechaPublicacion)}` : null]
    .filter(Boolean)
    .join(', ');

  return (
    <div role="group" aria-label="Auto en Publicaciones Procesales" className="grid gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {conPdf && (
          <EnlaceExterno href={urlPdf}>
            <FilePdf aria-hidden="true" />
            {ETIQUETA_CONFIANZA[confianza]}
          </EnlaceExterno>
        )}
        {urlEstado && (!conPdf || confianza === 'del_dia') && (
          <EnlaceExterno href={urlEstado}>
            <ArrowSquareOut aria-hidden="true" />
            {ETIQUETA_CONFIANZA.estado}
          </EnlaceExterno>
        )}
        {!conPdf && !urlEstado && <span className="text-sm font-medium">{ETIQUETA_CONFIANZA.sin_resultado}</span>}
      </div>
      <p className="m-0 text-xs text-muted-foreground">
        {AYUDA[confianza]}
        {conPdf && nombreArchivo ? ` Archivo: ${nombreArchivo}.` : ''}
        {estado ? ` ${estado}.` : ''}
      </p>
    </div>
  );
}
