import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn, type Relation } from 'typeorm';
import { ProcesoEntity } from './proceso.entity.js';

@Entity('estados_proceso')
export class EstadosProcesoEntity {
  /** Surrogate `procesos.id`, not the CPNU `id_proceso`: each copy records its own detections. */
  @PrimaryColumn({ name: 'id_proceso', type: 'uuid' })
  procesoId: string;

  /** Detail page of the estado; its identity within one proceso. */
  @PrimaryColumn({ name: 'url_estado', type: 'text' })
  urlEstado: string;

  @Column({ name: 'numero_estado', type: 'text', nullable: true })
  numeroEstado: string | null;

  /** `YYYY-MM-DD`. */
  @Column({ name: 'fecha_publicacion', type: 'date', nullable: true })
  fechaPublicacion: string | null;

  /** The radicado as it appeared in the LISTADO (a recurso can change the stored one). */
  @Column({ name: 'radicado_encontrado', type: 'text' })
  radicadoEncontrado: string;

  @Column({ type: 'boolean', default: false })
  visto: boolean;

  @Column({ name: 'detectado_en', type: 'timestamptz', default: () => 'now()' })
  detectadoEn: Date;

  @ManyToOne(() => ProcesoEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_proceso', foreignKeyConstraintName: 'estados_proceso_id_proceso_fkey' })
  proceso?: Relation<ProcesoEntity>;
}
