'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowsClockwise, SignOut } from '@phosphor-icons/react';
import { Sidebar, type Conteos } from '@/components/sidebar/sidebar';
import { useSession } from '@/features/session/session-guard';
import { revisarTodos } from '@/features/procesos/revisar-todos';
import { fetchConteos } from '@/features/shell/conteos';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

const CONTEOS_VACIOS: Conteos = { novedades: 0, noVistas: 0 };

/** Barra lateral (o barra inferior en móvil) más el contenido de cada vista. */
export function AppShell({ children }: { children: ReactNode }) {
  const { nombre } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [conteos, setConteos] = useState<Conteos>(CONTEOS_VACIOS);
  const [revisando, setRevisando] = useState(false);
  const [mensaje, setMensaje] = useState('');

  // Las cuentas se piden una vez por navegación.
  useEffect(() => {
    let activo = true;
    fetchConteos()
      .then((c) => {
        if (activo) setConteos(c);
      })
      .catch(() => {});
    return () => {
      activo = false;
    };
  }, [pathname]);

  async function onRevisar() {
    setRevisando(true);
    setMensaje('Revisando en la Rama Judicial…');
    try {
      const instancias = await revisarTodos((hecho, total) => {
        setMensaje(`Revisando en la Rama Judicial… ${hecho} de ${total}`);
      });
      const nuevos = await fetchConteos();
      setConteos(nuevos);
      const sufijo = instancias ? `, ${instancias} instancia(s) nueva(s)` : '';
      setMensaje(`Revisión terminada: ${nuevos.noVistas} actuación(es) sin revisar${sufijo}.`);
    } catch {
      setMensaje('No se pudo completar la revisión.');
    } finally {
      setRevisando(false);
    }
  }

  async function onSalir() {
    await apiFetch('/logout').catch(() => {});
    router.replace('/login');
  }

  return (
    <div className="min-h-dvh">
      <a
        href="#contenido"
        className="absolute -top-12 left-3 z-50 rounded-md bg-primary px-3 py-2 font-semibold text-primary-foreground no-underline focus:top-3"
      >
        Saltar al contenido
      </a>

      <header className="sticky top-0 z-[15] flex h-[60px] items-center justify-between border-b border-line bg-surface px-4 min-[640px]:hidden">
        <span className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight">
          <img src="/icon.svg" alt="" width={22} height={22} />
          Mis Procesos
        </span>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="icon"
            onClick={onRevisar}
            disabled={revisando}
            aria-busy={revisando}
            aria-label="Revisar todos"
            className="size-11"
          >
            <ArrowsClockwise aria-hidden="true" className="size-5" />
          </Button>
          <Button variant="outline" size="icon" onClick={onSalir} aria-label="Salir" className="size-11">
            <SignOut aria-hidden="true" className="size-5" />
          </Button>
        </div>
      </header>

      <Sidebar nombre={nombre} conteos={conteos} revisando={revisando} onRevisar={onRevisar} onSalir={onSalir} />

      <main
        id="contenido"
        tabIndex={-1}
        className="min-w-0 pb-[calc(4rem+env(safe-area-inset-bottom))] outline-none min-[640px]:ml-[72px] min-[640px]:pb-0 min-[960px]:ml-[240px]"
      >
        <div className="mx-auto max-w-[1120px] px-4 pt-5 pb-8 min-[640px]:px-7 min-[640px]:pt-7 min-[640px]:pb-12">
          {children}
        </div>
      </main>

      <p
        role="status"
        aria-live="polite"
        hidden={!mensaje}
        className={cn(
          'fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 m-0 max-w-[min(420px,calc(100vw-2rem))] rounded-md bg-foreground px-3.5 py-2.5 text-sm text-background shadow-[var(--shadow)]',
          'min-[640px]:bottom-4',
        )}
      >
        {mensaje}
      </p>
    </div>
  );
}
