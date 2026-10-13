import type { Metadata } from 'next';
import { Marca } from '@/components/marca/marca';
import { CLASE_TITULO } from '@/components/page-header/page-header';
import { Card } from '@/components/ui/card';
import { RegistroForm } from '@/features/registro/registro-form';

export const metadata: Metadata = {
  title: 'Crear cuenta · Mis Procesos',
};

export default function RegistroPage() {
  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <Card className="w-full max-w-[440px] gap-5 px-7 py-7 shadow-[var(--shadow)]" aria-labelledby="titulo-registro">
        <div className="flex items-center gap-2.5 text-lg font-semibold tracking-tight">
          <Marca size={28} labelClassName="" />
        </div>
        <h1 id="titulo-registro" className={CLASE_TITULO}>
          Crear cuenta
        </h1>
        <RegistroForm />
      </Card>
    </main>
  );
}
