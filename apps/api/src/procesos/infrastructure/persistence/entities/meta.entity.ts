import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('meta')
export class MetaEntity {
  @PrimaryColumn({ type: 'text' })
  clave: string;

  @Column({ type: 'text', nullable: true })
  valor: string | null;
}
