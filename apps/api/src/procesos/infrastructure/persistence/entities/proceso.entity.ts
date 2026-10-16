import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('procesos')
export class ProcesoEntity {
  @PrimaryColumn({ name: 'id_proceso', type: 'text' })
  idProceso: string;

  @Index('procesos_radicado_idx')
  @Column({ type: 'text' })
  radicado: string;

  // CPNU-owned columns (written only by a refresh).
  @Column({ type: 'text', nullable: true })
  despacho: string | null;

  @Column({ name: 'sujetos_texto', type: 'text', nullable: true })
  sujetosTexto: string | null;

  @Column({ name: 'es_privado', type: 'boolean', default: false })
  esPrivado: boolean;

  // `any` (not `unknown`) so TypeORM's QueryDeepPartialEntity accepts the raw CPNU JSON.
  @Column({ type: 'jsonb', default: () => "'{}'" })
  detalle: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @Column({ name: 'ultima_consulta', type: 'timestamptz', nullable: true })
  ultimaConsulta: Date | null;

  // Office-owned columns (never written by a refresh).
  @Column({ type: 'text', default: '' })
  alias: string;

  @Column({ type: 'text', default: '' })
  responsable: string;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  etiquetas: string[];

  @Column({ name: 'nueva_instancia', type: 'boolean', default: false })
  nuevaInstancia: boolean;

  @Column({ name: 'agregado_por', type: 'text', default: '' })
  agregadoPor: string;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  agregado: Date;
}
