import { useMemo, useState } from 'react';
import { Bike, LockKeyhole, ShieldCheck, Store, UserRound, X } from 'lucide-react';
import type { AppUser, Role } from '../types';
import { ActionButton } from './Shared';

type AuthMode = 'login' | 'register';

interface AuthModalProps {
  mode: AuthMode;
  onClose: () => void;
  onComplete: (user: AppUser) => void;
}

const registerRoles: Array<{ role: Exclude<Role, 'admin'>; label: string; icon: typeof UserRound }> = [
  { role: 'client', label: 'Cliente', icon: UserRound },
  { role: 'delivery', label: 'Delivery', icon: Bike },
  { role: 'store', label: 'Tienda', icon: Store },
];

const loginRoles: Array<{ role: Role; label: string; icon: typeof UserRound }> = [
  ...registerRoles,
  { role: 'admin', label: 'Admin', icon: ShieldCheck },
];

export function AuthModal({ mode, onClose, onComplete }: AuthModalProps) {
  const isRegister = mode === 'register';
  const [selectedRole, setSelectedRole] = useState<Role>('client');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [storeName, setStoreName] = useState('');

  const title = isRegister ? 'Crear cuenta' : 'Iniciar sesion';
  const roles = useMemo(() => (isRegister ? registerRoles : loginRoles), [isRegister]);

  const submitAuth = () => {
    const fallbackNames: Record<Role, string> = {
      client: 'Ana Perez',
      delivery: 'Mario Campos',
      store: storeName || 'Carla Medina',
      admin: 'Jose Admin',
    };

    onComplete({
      id: `auth-${selectedRole}-${Date.now()}`,
      name: name.trim() || fallbackNames[selectedRole],
      phone: phone.trim() || '+58 412-555-0000',
      role: selectedRole,
      savedAddresses:
        selectedRole === 'client'
          ? ['Residencias Turia, Torre B', 'Oficina Torre Platinum, piso 4']
          : undefined,
    });
  };

  return (
    <div className="modal-backdrop" role="presentation">
      <section aria-labelledby="auth-title" className="auth-modal" role="dialog">
        <div className="modal-heading">
          <div>
            <span className="zone-label">
              <LockKeyhole size={15} aria-hidden="true" /> Acceso PideYa
            </span>
            <h2 id="auth-title">{title}</h2>
          </div>
          <button aria-label="Cerrar" className="icon-button" onClick={onClose} type="button">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="role-picker" role="group" aria-label="Tipo de usuario">
          {roles.map(({ role, label, icon: Icon }) => (
            <button
              className={selectedRole === role ? 'active' : ''}
              key={role}
              onClick={() => setSelectedRole(role)}
              type="button"
            >
              <Icon size={17} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div className="auth-fields">
          {isRegister ? (
            <input
              aria-label="Nombre completo"
              onChange={(event) => setName(event.target.value)}
              placeholder={selectedRole === 'store' ? 'Nombre del encargado' : 'Nombre completo'}
              value={name}
            />
          ) : null}
          {isRegister && selectedRole === 'store' ? (
            <input
              aria-label="Nombre de la tienda"
              onChange={(event) => setStoreName(event.target.value)}
              placeholder="Nombre de la tienda"
              value={storeName}
            />
          ) : null}
          <input
            aria-label="Correo electronico"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Correo electronico"
            type="email"
            value={email}
          />
          <input
            aria-label="Telefono"
            onChange={(event) => setPhone(event.target.value)}
            placeholder="Telefono"
            value={phone}
          />
          <input
            aria-label="Contrasena"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Contrasena"
            type="password"
            value={password}
          />
        </div>

        <p className="auth-note">
          {isRegister
            ? 'El registro es simulado; al continuar entraras a la interfaz del rol seleccionado.'
            : 'El acceso es simulado para probar las interfaces. Admin solo entra desde inicio de sesion.'}
        </p>

        <ActionButton icon={LockKeyhole} onClick={submitAuth} variant="primary">
          {isRegister ? 'Registrarme' : 'Entrar'}
        </ActionButton>
      </section>
    </div>
  );
}
