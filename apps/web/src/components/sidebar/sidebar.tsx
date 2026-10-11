'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/icon';
import { cn } from '@/lib/utils';

export interface Conteos {
  /** Número de novedades (actuaciones nuevas agrupadas por proceso). */
  novedades: number;
  /** Suma de actuaciones sin revisar de todos los procesos. */
  noVistas: number;
}

interface Props {
  nombre: string;
  conteos: Conteos;
  revisando: boolean;
  onRevisar: () => void;
  onSalir: () => void;
}

const ENLACES = [
  { href: '/', etiqueta: 'Procesos', icono: 'i-folder-simple' },
  { href: '/novedades', etiqueta: 'Novedades', icono: 'i-bell' },
  { href: '/agenda', etiqueta: 'Agenda', icono: 'i-calendar-blank' },
] as const;

/*
 * Tres formas segun el ancho:
 *  - < 640px: barra inferior con iconos y texto, marca y acciones en la barra superior.
 *  - 640-959px: riel de iconos; el texto queda solo para lectores de pantalla.
 *  - >= 960px: barra lateral fija con texto.
 */
const CLASES_ASIDE = cn(
  'fixed inset-x-0 bottom-0 z-20 flex items-stretch border-t border-line bg-surface',
  'px-2 pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))]',
  'min-[640px]:inset-y-0 min-[640px]:right-auto min-[640px]:left-0 min-[640px]:w-[72px]',
  'min-[640px]:flex-col min-[640px]:items-center min-[640px]:gap-4 min-[640px]:border-t-0 min-[640px]:border-r',
  'min-[640px]:px-2.5 min-[640px]:py-4',
  'min-[960px]:w-[240px] min-[960px]:items-stretch min-[960px]:px-3.5 min-[960px]:py-5',
);

const SOLO_LECTORES = 'min-[640px]:max-[959px]:sr-only';

export function Sidebar({ nombre, conteos, revisando, onRevisar, onSalir }: Props) {
  const pathname = usePathname();

  function insignia(href: string): number {
    if (href === '/novedades') return conteos.novedades;
    if (href === '/') return conteos.noVistas;
    return 0;
  }

  return (
    <aside className={CLASES_ASIDE} aria-label="Navegación principal">
      <Link href="/" className="hidden items-center gap-2.5 rounded-md px-2.5 py-1 text-lg font-semibold tracking-tight text-foreground no-underline min-[640px]:flex">
        <img src="/icon.svg" alt="" width={28} height={28} />
        <span className={cn('overflow-hidden', SOLO_LECTORES)}>Mis Procesos</span>
      </Link>

      <nav className="grid flex-1 grid-cols-3 gap-0.5 min-[640px]:flex min-[640px]:flex-col min-[640px]:gap-1">
        {ENLACES.map((enlace) => {
          const activo = enlace.href === '/' ? pathname === '/' : pathname.startsWith(enlace.href);
          const cuenta = insignia(enlace.href);
          return (
            <Link
              key={enlace.href}
              href={enlace.href}
              aria-current={activo ? 'page' : undefined}
              className={cn(
                'relative flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1.5 text-xs font-medium text-muted-foreground no-underline transition-colors duration-150',
                'hover:bg-surface-sunken hover:text-foreground',
                'aria-[current=page]:bg-accent aria-[current=page]:text-accent-foreground',
                'min-[640px]:min-h-10 min-[640px]:flex-row min-[640px]:justify-start min-[640px]:gap-2.5 min-[640px]:px-2.5 min-[640px]:py-2 min-[640px]:text-sm',
                'min-[640px]:max-[959px]:w-full min-[640px]:max-[959px]:justify-center',
              )}
            >
              <Icon name={enlace.icono} />
              <span className={SOLO_LECTORES}>{enlace.etiqueta}</span>
              {cuenta > 0 && (
                <Badge
                  className={cn(
                    'absolute top-1 left-[calc(50%+6px)] h-[18px] min-w-[18px] px-1 text-[0.6875rem] tabular-nums',
                    'min-[640px]:top-0.5 min-[640px]:right-0.5 min-[640px]:left-auto',
                    'min-[960px]:static min-[960px]:ml-auto min-[960px]:h-[22px] min-[960px]:min-w-[22px] min-[960px]:px-[7px] min-[960px]:text-xs',
                  )}
                >
                  {cuenta}
                </Badge>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto hidden grid-cols-1 gap-2 border-t border-line pt-3.5 min-[640px]:grid min-[640px]:w-full">
        <p className={cn('m-0 px-2.5 text-sm break-words text-muted-foreground', SOLO_LECTORES)}>{nombre}</p>
        <Button
          variant="outline"
          onClick={onRevisar}
          disabled={revisando}
          aria-busy={revisando}
          className="w-full justify-start min-[640px]:max-[959px]:justify-center"
        >
          <Icon name="i-arrows-clockwise" />
          <span className={SOLO_LECTORES}>Revisar todos</span>
        </Button>
        <Button variant="outline" onClick={onSalir} className="w-full justify-start min-[640px]:max-[959px]:justify-center">
          <Icon name="i-sign-out" />
          <span className={SOLO_LECTORES}>Salir</span>
        </Button>
      </div>
    </aside>
  );
}
