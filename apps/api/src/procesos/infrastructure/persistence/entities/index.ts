import { AutoPublicadoEntity } from './auto-publicado.entity.js';
import { ActuacionEntity } from './actuacion.entity.js';
import { EstadosProcesoEntity } from './estados-proceso.entity.js';
import { MetaEntity } from './meta.entity.js';
import { NotaEntity } from './nota.entity.js';
import { ProcesoEntity } from './proceso.entity.js';
import { SujetoEntity } from './sujeto.entity.js';
import { TareaEntity } from './tarea.entity.js';

export { ActuacionEntity, AutoPublicadoEntity, EstadosProcesoEntity, MetaEntity, NotaEntity, ProcesoEntity, SujetoEntity, TareaEntity };

export const PROCESOS_ENTITIES = [
  ProcesoEntity,
  ActuacionEntity,
  SujetoEntity,
  NotaEntity,
  TareaEntity,
  MetaEntity,
  AutoPublicadoEntity,
  EstadosProcesoEntity,
];
