import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn, type Relation } from 'typeorm';
import type { Confianza } from '../../../domain/autos.js';
import { ProcesoEntity } from './proceso.entity.js';
import { bigintToNumber } from './transformers.js';

@Entity('autos_publicados')
export class AutoPublicadoEntity {
  @PrimaryColumn({ name: 'id_proceso', type: 'text' })
  idProceso: string;

  /** CPNU `idRegActuacion` (no FK: a CPNU refresh rewrites the actuaciones). */
  @PrimaryColumn({ name: 'id_actuacion', type: 'bigint', transformer: bigintToNumber })
  idActuacion: number;

  @Column({ type: 'text' })
  confianza: Confianza;

  @Column({ name: 'url_pdf', type: 'text', nullable: true })
  urlPdf: string | null;

  @Column({ name: 'nombre_archivo', type: 'text', nullable: true })
  nombreArchivo: string | null;

  @Column({ name: 'url_estado', type: 'text', nullable: true })
  urlEstado: string | null;

  @Column({ name: 'numero_estado', type: 'text', nullable: true })
  numeroEstado: string | null;

  @Column({ name: 'fecha_publicacion', type: 'text', nullable: true })
  fechaPublicacion: string | null;

  @Column({ name: 'buscado_en', type: 'timestamptz' })
  buscadoEn: Date;

  @Column({ type: 'integer', default: 1 })
  intentos: number;

  @ManyToOne(() => ProcesoEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_proceso', foreignKeyConstraintName: 'autos_publicados_id_proceso_fkey' })
  proceso?: Relation<ProcesoEntity>;
}
