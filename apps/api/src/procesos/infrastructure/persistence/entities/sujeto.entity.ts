import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, type Relation } from 'typeorm';
import { ProcesoEntity } from './proceso.entity.js';

@Entity('sujetos')
export class SujetoEntity {
  /** Surrogate `procesos.id`, not the CPNU `id_proceso`. */
  @PrimaryColumn({ name: 'id_proceso', type: 'uuid' })
  procesoId: string;

  /** Position in the CPNU list. */
  @PrimaryColumn({ type: 'integer' })
  orden: number;

  @Column({ type: 'text', nullable: true })
  tipo: string | null;

  @Column({ type: 'text', nullable: true })
  nombre: string | null;

  @ManyToOne(() => ProcesoEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_proceso', foreignKeyConstraintName: 'sujetos_id_proceso_fkey' })
  proceso?: Relation<ProcesoEntity>;
}
