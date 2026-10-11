import { VistaDetalle } from '@/features/detalle/vista-detalle';

export default async function DetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <VistaDetalle key={id} id={id} />;
}
