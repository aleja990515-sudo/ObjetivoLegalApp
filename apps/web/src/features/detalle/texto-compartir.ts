import { fecha, fmtRadicado } from '@/features/procesos/formato';
import type { Actuacion, ProcesoDetalle } from '@/features/procesos/modelo';

type ProcesoParaCompartir = Pick<ProcesoDetalle, 'alias' | 'radicado' | 'detalle'>;

/** Texto de una actuación para WhatsApp (con negrita de WhatsApp) o correo (sin asteriscos). */
export function textoCompartir(actuacion: Actuacion, proceso: ProcesoParaCompartir): string {
  const despacho = typeof proceso.detalle.despacho === 'string' ? proceso.detalle.despacho : '';
  return [
    `*${proceso.alias || despacho || 'Proceso'}*`,
    `Radicado ${fmtRadicado(proceso.radicado)}`,
    despacho,
    `${fecha(actuacion.fecha)}: ${actuacion.actuacion}`,
    actuacion.anotacion || '',
    actuacion.fechaFinal ? `Término: ${fecha(actuacion.fechaInicial)} a ${fecha(actuacion.fechaFinal)}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
