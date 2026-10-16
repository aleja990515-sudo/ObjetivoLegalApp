import { Column, Entity, Index, PrimaryColumn, Unique } from 'typeorm';

@Entity('procesos')
@Unique('procesos_usuario_id_proceso_uniq', ['usuarioId', 'idProceso'])
export class ProcesoEntity {
  /** Surrogate key. The column also defaults in Postgres, so raw SQL can insert without one. */
  @PrimaryColumn({ name: 'id', type: 'uuid' })
  id: string;

  /** CPNU id: unique per owner, not per table, so two users can follow the same expediente. */
  @Column({ name: 'id_proceso', type: 'text' })
  idProceso: string;

  @Index('procesos_radicado_idx')
  @Column({ type: 'text' })
  radicado: string;

  /** Owner: only this user reads and writes the proceso. Null while unassigned. */
  @Index('procesos_usuario_idx')
  @Column({ name: 'usuario_id', type: 'uuid', nullable: true })
  usuarioId: string | null;

  // CPNU-owned columns (written only by a refresh).
  @Column({ type: 'text', nullable: true })
  despacho: string | null;

  @Column({ name: 'sujetos_texto', type: 'text', nullable: true })
  sujetosTexto: string | null;

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
