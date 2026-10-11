import type { Metadata } from 'next';
import Link from 'next/link';
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
          <img src="/icon.svg" alt="" width={28} height={28} />
          <span>Mis Procesos</span>
        </div>
        <h1 id="titulo-login" className="m-0 text-xl font-semibold tracking-tight">
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
