import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, type Relation } from 'typeorm';
import { ProcesoEntity } from './proceso.entity.js';

@Entity('sujetos')
export class SujetoEntity {
  @PrimaryColumn({ name: 'id_proceso', type: 'text' })
  idProceso: string;

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
