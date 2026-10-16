import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, type Relation } from 'typeorm';
import { ProcesoEntity } from './proceso.entity.js';
import { bigintToNumber } from './transformers.js';

@Entity('notas')
@Index('notas_proceso_idx', ['procesoId', 'seq'])
export class NotaEntity {
  @PrimaryColumn({ type: 'text' })
  id: string;

  /** Surrogate `procesos.id`, not the CPNU `id_proceso`. */
  @Column({ name: 'id_proceso', type: 'uuid' })
  procesoId: string;

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
  texto: string;

  @Column({ type: 'text', default: '' })
  autor: string;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  fecha: Date;

  @ManyToOne(() => ProcesoEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_proceso', foreignKeyConstraintName: 'notas_id_proceso_fkey' })
  proceso?: Relation<ProcesoEntity>;
}
