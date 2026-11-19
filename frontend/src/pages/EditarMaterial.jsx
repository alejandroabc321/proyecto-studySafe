import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { actualizarMaterial, obtenerMaterial } from '../api/materiales';
import MaterialForm from '../components/MaterialForm';
import { Card } from '../components/ui';
import { armarFormData, msg } from '../utils';

export default function EditarMaterial() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [valores, setValores] = useState(null);
  const [actual, setActual] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    obtenerMaterial(id)
      .then(({ data: { material: m } }) => { setActual({ archivo: m.archivo, previews: m.previews }); setValores({ titulo: m.titulo, descripcion: m.descripcion, materia: m.materia, profesor: m.profesor, tipo: m.tipo, precio: m.precio, archivo_url: '' }); })
      .catch((e) => setError(msg(e)));
  }, [id]);

  const enviar = async (datos, { archivo, previews }) => {
    setError('');
    try { const { data } = await actualizarMaterial(id, armarFormData(datos, archivo, previews)); navigate(`/material/${data.material._id}`); }
    catch (e) { setError(msg(e)); }
  };

  return (
    <Card className="tarjeta--formulario">
      <h1>Editar material</h1>
      <MaterialForm editando valoresIniciales={valores} actual={actual} onSubmit={enviar} error={error} />
    </Card>
  );
}
