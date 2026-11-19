import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ButtonLink } from './ui';
import { cop } from '../utils';

export default function Header() {
  const { user, logout } = useAuth();
  return (
    <nav className="header">
      <div className="header__interior">
        <Link to="/" className="header__logo"><span>Study</span>Safe</Link>
        <Link to="/" className="header__enlace">Explorar</Link>
        {user ? (<>
          {user.rol === 'admin' && <Link to="/admin" className="header__enlace header__admin">Admin</Link>}
          <Link to="/mis-compras" className="header__enlace">Mis compras</Link>
          <Link to="/mis-materiales" className="header__enlace">Mis materiales</Link>
          <ButtonLink to="/publicar" variant="hl" className="btn--chico">Vender</ButtonLink>
          <Link to="/billetera" title="Tu billetera" className="header__saldo">{cop(user.billetera?.saldo)}</Link>
          <span className="header__usuario">{user.alias}</span>
          <button onClick={logout} className="header__enlace">Salir</button>
        </>) : (<>
          <Link to="/login" className="header__enlace">Entrar</Link>
          <ButtonLink to="/registro" variant="hl" className="btn--chico">Crear cuenta</ButtonLink>
        </>)}
      </div>
    </nav>
  );
}
