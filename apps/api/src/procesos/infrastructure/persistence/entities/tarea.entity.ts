import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, type Relation } from 'typeorm';
import { ProcesoEntity } from './proceso.entity.js';
import { bigintToNumber } from './transformers.js';

@Entity('tareas')
@Index('tareas_proceso_idx', ['idProceso', 'seq'])
@Index('tareas_pendientes_idx', ['fecha'], { where: 'NOT hecha' })
export class TareaEntity {
  @PrimaryColumn({ type: 'text' })
  id: string;

  @Column({ name: 'id_proceso', type: 'text' })
  idProceso: string;

  /** Insertion order (identity column), used as a stable sort key. */
  @Column({
    type: 'bigint',
    generated: 'identity',
    generatedIdentity: 'ALWAYS',
    insert: false,
    update: false,
    transformer: bigintToNumber,
  })
  seq: number;

  @Column({ type: 'text' })
  titulo: string;

  /** TypeORM hydrates `date` columns as `YYYY-MM-DD` strings. */
  @Column({ type: 'date' })
  fecha: string;

  @Column({ type: 'text', default: '' })
  hora: string;

  @Column({ type: 'text', default: '' })
  responsable: string;

  @Column({ name: 'id_actuacion', type: 'text', nullable: true })
  idActuacion: string | null;

  @Column({ type: 'boolean', default: false })
  hecha: boolean;

  @Column({ name: 'hecha_por', type: 'text', nullable: true })
  hechaPor: string | null;

  @Column({ type: 'text', default: '' })
  autor: string;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  creada: Date;

  @ManyToOne(() => ProcesoEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_proceso', foreignKeyConstraintName: 'tareas_id_proceso_fkey' })
  proceso?: Relation<ProcesoEntity>;
}
