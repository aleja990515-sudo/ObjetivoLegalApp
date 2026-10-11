import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('usuarios')
export class UsuarioEntity {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ type: 'text' })
  nombre: string;

  @Column({ name: 'nombre_completo', type: 'text' })
  nombreCompleto: string;

  // Personal data: encrypted (AES-256-GCM) with an HMAC lookup index for uniqueness.
  @Column({ name: 'correo_indice', type: 'text', unique: true })
  correoIndice: string;

  @Column({ name: 'correo_cifrado', type: 'text' })
  correoCifrado: string;

  @Column({ name: 'cedula_indice', type: 'text', unique: true })
  cedulaIndice: string;

  @Column({ name: 'cedula_cifrada', type: 'text' })
  cedulaCifrada: string;

  @Column({ name: 'celular_cifrado', type: 'text' })
  celularCifrado: string;

  @Column({ name: 'password_hash', type: 'text' })
  passwordHash: string;

  @Column({ name: 'consentimiento_at', type: 'timestamptz', nullable: true })
  consentimientoAt: Date | null;

  @Column({ type: 'boolean', default: false })
  activo: boolean;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  creado: Date;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  actualizado: Date;
}
