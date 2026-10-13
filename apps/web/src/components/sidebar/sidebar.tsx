'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ArrowsClockwise,
  Bell,
  CalendarBlank,
  Scales,
  SignOut,
  UserCircle,
  type Icon as IconoPhosphor,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { Marca } from '@/components/marca/marca';

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

const ENLACES: readonly { href: string; etiqueta: string; icono: IconoPhosphor }[] = [
  { href: '/', etiqueta: 'Procesos', icono: Scales },
  { href: '/novedades', etiqueta: 'Novedades', icono: Bell },
  { href: '/agenda', etiqueta: 'Agenda', icono: CalendarBlank },
];

/*
 * Tres formas segun el ancho:
 *  - < 640px: barra inferior con iconos y texto, marca y acciones en la barra superior.
 *  - 640-959px: riel de iconos; el texto queda solo para lectores de pantalla.
 *  - >= 960px: barra lateral fija con texto.
 *
 * En movil la barra mide exactamente `--tabbar-h` mas el area segura: el alto viene del token
 * y los enlaces se estiran dentro (`flex-1`), de modo que el relleno ya no lo desborda.
 */
const CLASES_ASIDE = cn(
  'fixed inset-x-0 bottom-0 z-20 flex items-stretch border-t border-line bg-surface shadow-[var(--shadow)]',
  'h-[calc(var(--tabbar-h)+env(safe-area-inset-bottom))] px-2 pt-1.5 pb-[env(safe-area-inset-bottom)]',
  'min-[640px]:inset-y-0 min-[640px]:right-auto min-[640px]:left-0 min-[640px]:h-auto min-[640px]:w-[var(--rail-w)]',
  'min-[640px]:flex-col min-[640px]:items-center min-[640px]:gap-4 min-[640px]:border-t-0 min-[640px]:border-r',
  'min-[640px]:px-2.5 min-[640px]:py-4',
  'min-[960px]:w-[var(--sidebar-w)] min-[960px]:items-stretch min-[960px]:px-3.5 min-[960px]:py-5',
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
        <Marca size={28} labelClassName={cn('overflow-hidden', SOLO_LECTORES)} />
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
                'relative flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1.5 text-xs font-medium text-muted-foreground no-underline transition-colors duration-ui ease-ui',
                'hover:bg-surface-sunken hover:text-foreground',
                'aria-[current=page]:bg-accent aria-[current=page]:text-accent-foreground',
                'min-[640px]:min-h-11 min-[640px]:flex-row min-[640px]:justify-start min-[640px]:gap-2.5 min-[640px]:px-2.5 min-[640px]:py-2 min-[640px]:text-sm',
                'min-[640px]:max-[959px]:w-full min-[640px]:max-[959px]:justify-center',
                'min-[960px]:min-h-10',
              )}
            >
              <enlace.icono aria-hidden="true" weight="regular" className="size-5 shrink-0" />
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
        <p className={cn('m-0 flex items-center gap-2 px-2.5 text-sm break-words text-muted-foreground', SOLO_LECTORES)}>
          <UserCircle aria-hidden="true" weight="regular" className="size-5 shrink-0" />
          {nombre}
        </p>
        <Button
          variant="outline"
          onClick={onRevisar}
          disabled={revisando}
          aria-busy={revisando}
          className="min-h-11 w-full justify-start min-[640px]:max-[959px]:justify-center min-[960px]:min-h-9"
        >
          <ArrowsClockwise aria-hidden="true" weight="regular" className="size-4" />
          <span className={SOLO_LECTORES}>Revisar todos</span>
        </Button>
        <Button
          variant="outline"
          onClick={onSalir}
          className="min-h-11 w-full justify-start min-[640px]:max-[959px]:justify-center min-[960px]:min-h-9"
        >
          <SignOut aria-hidden="true" weight="regular" className="size-4" />
          <span className={SOLO_LECTORES}>Salir</span>
        </Button>
      </div>
    </aside>
  );
}
