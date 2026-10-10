import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, type Relation } from 'typeorm';
import { ProcesoEntity } from './proceso.entity.js';
import { bigintToNumber } from './transformers.js';

@Entity('actuaciones')
@Index('actuaciones_orden_idx', ['idProceso', 'orden'])
@Index('actuaciones_no_vista_idx', ['idProceso'], { where: 'no_vista' })
export class ActuacionEntity {
  @PrimaryColumn({ name: 'id_proceso', type: 'text' })
  idProceso: string;

  /** CPNU `idRegActuacion`. */
  @PrimaryColumn({ type: 'bigint', transformer: bigintToNumber })
  id: number;

  /** Position in the CPNU list (0 = most recent). */
  @Column({ type: 'integer' })
  orden: number;

  @Column({ type: 'integer', nullable: true })
  cons: number | null;

  @Column({ type: 'text', nullable: true })
  fecha: string | null;

  @Column({ type: 'text', nullable: true })
  actuacion: string | null;

  @Column({ type: 'text', nullable: true })
  anotacion: string | null;

  @Column({ name: 'fecha_inicial', type: 'text', nullable: true })
  fechaInicial: string | null;

  @Column({ name: 'fecha_final', type: 'text', nullable: true })
  fechaFinal: string | null;

  @Column({ name: 'fecha_registro', type: 'text', nullable: true })
  fechaRegistro: string | null;

  @Column({ name: 'con_documentos', type: 'boolean', nullable: true })
  conDocumentos: boolean | null;

  /** Unseen by the office (replaces the legacy `noVistas` id list). */
  @Column({ name: 'no_vista', type: 'boolean', default: false })
  noVista: boolean;

  @ManyToOne(() => ProcesoEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_proceso', foreignKeyConstraintName: 'actuaciones_id_proceso_fkey' })
  proceso?: Relation<ProcesoEntity>;
}
