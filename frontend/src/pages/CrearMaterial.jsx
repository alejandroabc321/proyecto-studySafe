import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { crearMaterial } from '../api/materiales';
import MaterialForm from '../components/MaterialForm';
import { Card } from '../components/ui';
import { armarFormData, msg } from '../utils';

export default function CrearMaterial() {
  const navigate = useNavigate();
  const [error, setError] = useState('');

  const enviar = async (datos, { archivo, previews }) => {
    setError('');
    try { const { data } = await crearMaterial(armarFormData(datos, archivo, previews)); navigate(`/material/${data.material._id}`); }
    catch (e) { setError(msg(e)); }
  };

  return (
    <Card className="tarjeta--formulario">
      <h1>Vender material</h1>
      <MaterialForm onSubmit={enviar} error={error} />
    </Card>
  );
}
