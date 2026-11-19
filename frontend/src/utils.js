export const cop = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n ?? 0);
export const fecha = (d) => new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
export const msg = (e) => e.response?.data?.mensaje || 'No se pudo conectar con el servidor';
export const tamano = (bytes = 0) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

// Arma el multipart que espera el backend: campos de texto + `archivo` + hasta 2 `previews`.
export const armarFormData = (datos, archivo, previews = []) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(datos)) if (v !== undefined && v !== '') f.append(k, v);
  if (archivo) f.append('archivo', archivo);
  previews.forEach((p) => f.append('previews', p));
  return f;
};

// Guarda un blob como archivo descargado (sin abrir otra pestaña).
export const guardarBlob = (blob, nombre) => {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: nombre });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
