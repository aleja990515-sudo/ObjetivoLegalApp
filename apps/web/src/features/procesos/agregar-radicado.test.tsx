import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AgregarRadicado } from './agregar-radicado';

function stubAlta(agregados: unknown[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ agregados }), { status: 201, headers: { 'Content-Type': 'application/json' } })),
  );
}

async function enviar() {
  fireEvent.change(screen.getByLabelText('Radicado'), { target: { value: '05001311000320260030200' } });
  fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));
}

describe('AgregarRadicado', () => {
  it('un proceso privado se agrega con un aviso, no con un error', async () => {
    stubAlta([{ idProceso: '9', esPrivado: true }]);
    const onAgregado = vi.fn();
    render(<AgregarRadicado onAgregado={onAgregado} />);
    await enviar();

    await waitFor(() => expect(onAgregado).toHaveBeenCalled());
    const aviso = await screen.findByRole('status');
    expect(aviso).toHaveTextContent('Proceso agregado.');
    expect(aviso).toHaveTextContent('privado en la Rama Judicial');
    expect(aviso).toHaveTextContent('estados del juzgado');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('un proceso público conserva el aviso simple', async () => {
    stubAlta([{ idProceso: '1', esPrivado: false }]);
    render(<AgregarRadicado onAgregado={vi.fn()} />);
    await enviar();

    expect(await screen.findByRole('status')).toHaveTextContent(/^Proceso agregado\.$/);
  });
});
