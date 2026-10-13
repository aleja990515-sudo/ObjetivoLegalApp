import type { Metadata } from 'next';
import Link from 'next/link';
import { Marca } from '@/components/marca/marca';
import { CLASE_TITULO } from '@/components/page-header/page-header';
import { Card } from '@/components/ui/card';
import { LoginForm } from '@/features/login/login-form';

export const metadata: Metadata = {
  title: 'Iniciar sesión · Mis Procesos',
};

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <Card className="w-full max-w-[400px] gap-5 px-7 py-7 shadow-[var(--shadow)]" aria-labelledby="titulo-login">
        <div className="flex items-center gap-2.5 text-lg font-semibold tracking-tight">
          <Marca size={28} labelClassName="" />
        </div>
        <h1 id="titulo-login" className={CLASE_TITULO}>
          Iniciar sesión
        </h1>
        <LoginForm />
        <p className="m-0 text-center text-sm text-muted-foreground">
          ¿No tienes cuenta? <Link href="/registro" className="font-medium text-primary underline-offset-4 hover:underline">Regístrate</Link>
        </p>
      </Card>
    </main>
  );
}
