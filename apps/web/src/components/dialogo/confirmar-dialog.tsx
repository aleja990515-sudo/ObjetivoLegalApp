'use client';

import { AlertDialog } from '@base-ui/react/alert-dialog';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Props {
  abierto: boolean;
  titulo: string;
  descripcion: string;
  etiquetaConfirmar: string;
  /** Acción destructiva: el botón de confirmar usa el estilo de peligro. */
  destructiva?: boolean;
  onCancelar: () => void;
  onConfirmar: () => void;
}

/** Diálogo de confirmación con foco atrapado y cierre con Escape. */
export function ConfirmarDialog({
  abierto,
  titulo,
  descripcion,
  etiquetaConfirmar,
  destructiva = false,
  onCancelar,
  onConfirmar,
}: Props) {
  return (
    <AlertDialog.Root open={abierto} onOpenChange={(siguiente) => !siguiente && onCancelar()}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-40 bg-foreground/30 transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <AlertDialog.Popup className="fixed top-1/2 left-1/2 z-50 grid w-[min(440px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 gap-3 rounded-lg border border-line bg-card p-5 text-card-foreground shadow-[var(--shadow)] transition-[opacity,transform] duration-150 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
          <AlertDialog.Title className="m-0 text-base font-semibold">{titulo}</AlertDialog.Title>
          <AlertDialog.Description className="m-0 text-sm text-muted-foreground">{descripcion}</AlertDialog.Description>
          <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Close className={buttonVariants({ variant: 'outline' })}>Cancelar</AlertDialog.Close>
            <button
              type="button"
              onClick={onConfirmar}
              className={cn(buttonVariants({ variant: destructiva ? 'destructive' : 'default' }), 'justify-center')}
            >
              {etiquetaConfirmar}
            </button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
