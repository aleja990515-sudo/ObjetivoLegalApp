import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import axe from 'axe-core';
import { describe, expect, it, vi } from 'vitest';
import { VistaAgenda } from '@/features/agenda/vista-agenda';
import { VistaDetalle } from '@/features/detalle/vista-detalle';
import { VistaNovedades } from '@/features/novedades/vista-novedades';
import { VistaLista } from '@/features/procesos/vista-lista';
import type { ProcesoDetalle, ProcesoResumen, RespuestaAgenda } from '@/features/procesos/modelo';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }),
}));

const resumen: ProcesoResumen = {
  idProceso: '1',
  radicado: '11001310300120240001200',
  alias: 'Pérez vs. Aseguradora',
  despacho: 'Juzgado 3 Civil',
  claseProceso: 'Ordinario',
  sujetos: 'Pérez, Aseguradora',
  ultimaActuacion: null,
  ultimoAuto: null,
  noVistas: 2,
  esPrivado: false,
  estadosNoVistos: 0,
  nuevaInstancia: false,
  proximaTarea: null,
  tareasVencidas: 1,
  responsable: 'Ana',
  etiquetas: ['urgente'],
  ultimaConsulta: null,
  agregadoPor: 'Ana',
  error: null,
};

const detalle: ProcesoDetalle = {
  ...resumen,
  sujetos: [{ tipo: 'Demandante', nombre: 'Pérez' }],
  detalle: { despacho: 'Juzgado 3 Civil' },
  actuaciones: [
    {
      id: 5,
      cons: 1,
      fecha: '2026-10-09',
      actuacion: 'Auto admite demanda',
      anotacion: 'Se admite.',
      fechaInicial: null,
      fechaFinal: null,
      fechaRegistro: '2026-10-09',
      conDocumentos: true,
    },
  ],
  noVistasIds: [5],
  estados: [],
  notas: [{ id: 'n1', texto: 'Llamar al cliente', autor: 'Ana', fecha: '2026-10-08T12:00:00.000Z' }],
  tareas: [
    {
      id: 't1',
      titulo: 'Contestar demanda',
      fecha: '2026-10-09',
      hora: '',
      responsable: 'Ana',
      idActuacion: null,
      hecha: false,
      hechaPor: null,
      autor: 'Ana',
      creada: '2026-10-01T10:00:00.000Z',
    },
  ],
};

const agenda: RespuestaAgenda = {
  hoy: '2026-10-10',
  ics: 'https://app.test/api/agenda.ics?t=abc',
  tareas: [{ ...detalle.tareas[0], idProceso: '1', radicado: resumen.radicado, alias: resumen.alias, despacho: 'Juzgado 3 Civil' }],
};

function stub(cuerpo: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'Content-Type': 'application/json' } })),
  );
}

/** Reglas de página completa (landmarks, un solo h1) no aplican a una vista suelta; el contraste se mide aparte. */
const OPCIONES_AXE = {
  rules: {
    region: { enabled: false },
    'landmark-one-main': { enabled: false },
    'page-has-heading-one': { enabled: false },
    'color-contrast': { enabled: false },
  },
};

async function violaciones(elemento: Element): Promise<string[]> {
  const resultado = await axe.run(elemento, OPCIONES_AXE);
  return resultado.violations.map((v) => `${v.id}: ${v.help}`);
}

describe('accesibilidad de las vistas (axe-core)', () => {
  it('lista de procesos sin violaciones', async () => {
    stub({ procesos: [resumen], ultimaRevision: null });
    const { container } = render(<VistaLista />);
    await screen.findByRole('link', { name: /Pérez vs. Aseguradora/ });
    expect(await violaciones(container)).toEqual([]);
  });

  it('novedades sin violaciones', async () => {
    stub([
      {
        tipo: 'instancia',
        idProceso: '1',
        radicado: resumen.radicado,
        alias: resumen.alias,
        despacho: 'Juzgado 3 Civil',
        fecha: '2026-10-09',
      },
    ]);
    const { container } = render(<VistaNovedades />);
    await screen.findByRole('link', { name: /Pérez vs. Aseguradora/ });
    expect(await violaciones(container)).toEqual([]);
  });

  it('detalle sin violaciones', async () => {
    stub(detalle);
    const { container } = render(<VistaDetalle id="1" />);
    await screen.findByRole('heading', { name: 'Pérez vs. Aseguradora' });
    expect(await violaciones(container)).toEqual([]);
  });

  it('agenda sin violaciones', async () => {
    stub(agenda);
    const { container } = render(<VistaAgenda />);
    await screen.findByRole('heading', { name: 'Vencidas (1)' });
    expect(await violaciones(container)).toEqual([]);
  });
});

/** Luminancia relativa WCAG de un color `#rrggbb`. */
function luminancia(hex: string): number {
  const canales = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = canales.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function razon(a: string, b: string): number {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (oscuro + 0.05);
}

/** Lee `--nombre: #hex` de un bloque de `globals.css`; el bloque oscuro empieza en la media query. */
function tokens(bloque: string): Record<string, string> {
  const valores: Record<string, string> = {};
  for (const [, nombre, valor] of bloque.matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{6});/g)) {
    valores[nombre] ??= valor;
  }
  return valores;
}

describe('contraste de los tokens de color (WCAG AA)', () => {
  const css = readFileSync(resolve(import.meta.dirname, '../app/globals.css'), 'utf8');
  const corte = css.indexOf('prefers-color-scheme: dark');
  const claro = tokens(css.slice(0, corte));
  const oscuro = tokens(css.slice(corte));

  const pares: [texto: string, fondo: string, minimo: number][] = [
    ['text', 'bg', 4.5],
    ['text', 'surface', 4.5],
    ['muted', 'bg', 4.5],
    ['muted', 'surface', 4.5],
    ['muted', 'surface-sunken', 4.5],
    ['placeholder', 'surface', 4.5],
    ['on-accent', 'accent', 4.5],
    ['accent', 'surface', 4.5],
    ['accent-soft-text', 'accent-soft', 4.5],
    ['danger', 'surface', 4.5],
    ['danger', 'bg', 4.5],
    ['line-input', 'surface', 3],
  ];

  for (const [modo, paleta] of [
    ['claro', claro],
    ['oscuro', oscuro],
  ] as const) {
    it(`pares de texto en modo ${modo} cumplen WCAG AA`, () => {
      for (const [texto, fondo, minimo] of pares) {
        const cociente = razon(paleta[texto], paleta[fondo]);
        expect(cociente, `${texto} sobre ${fondo} (${modo})`).toBeGreaterThanOrEqual(minimo);
      }
    });
  }
});
