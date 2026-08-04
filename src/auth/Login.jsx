import { useState } from 'react';
import { Card, Btn, Field, Input, Icon } from '../components/ui.jsx';
import { useAuth } from './AuthProvider.jsx';

export default function Login(){
  const { signIn, requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [modo, setModo] = useState('login'); // 'login' | 'recuperar' | 'enviado'
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const entrar = async (e) => {
    e.preventDefault();
    setError(''); setCargando(true);
    const { error } = await signIn(email.trim(), password);
    setCargando(false);
    if (error) setError(error.message === 'Invalid login credentials'
      ? 'Correo o contraseña incorrectos.' : error.message);
  };

  const recuperar = async (e) => {
    e.preventDefault();
    setError(''); setCargando(true);
    const { error } = await requestPasswordReset(email.trim());
    setCargando(false);
    if (error) setError(error.message);
    else setModo('enviado');
  };

  return (
    <div className="min-h-screen grid place-items-center bg-ink-50 dark:bg-ink-950 px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 justify-center mb-6">
          <div className="w-11 h-11 rounded-xl bg-brand-500 grid place-items-center shadow-lg shadow-brand-500/25">
            <Icon n="shield" c="w-6 h-6 text-white"/></div>
          <div>
            <p className="font-extrabold text-ink-900 dark:text-white text-lg leading-none">OPERA</p>
            <p className="text-[11px] text-ink-500 dark:text-ink-400 mt-0.5">Gestión de personal</p>
          </div>
        </div>

        <Card>
          {modo === 'enviado' ? (
            <div className="text-center py-4">
              <Icon n="check" c="w-8 h-8 mx-auto text-emerald-500"/>
              <h3 className="mt-3 font-bold text-ink-900 dark:text-white">Revisa tu correo</h3>
              <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
                Te enviamos un enlace a <b>{email}</b> para restablecer tu contraseña.</p>
              <Btn v="outline" className="mt-5 w-full" onClick={() => setModo('login')}>Volver a iniciar sesión</Btn>
            </div>
          ) : (
            <form onSubmit={modo === 'login' ? entrar : recuperar} className="space-y-4">
              <h3 className="font-bold text-ink-900 dark:text-white">
                {modo === 'login' ? 'Iniciar sesión' : 'Recuperar contraseña'}
              </h3>
              <Field label="Correo electrónico" req>
                <Input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  autoComplete="username" placeholder="nombre@correo.com"/>
              </Field>
              {modo === 'login' && (
                <Field label="Contraseña" req>
                  <Input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                    autoComplete="current-password"/>
                </Field>
              )}
              {error && <p className="text-xs font-semibold text-rose-600 bg-rose-50 dark:bg-rose-500/10 rounded-lg px-3 py-2">{error}</p>}
              <Btn type="submit" className="w-full" disabled={cargando}>
                {cargando ? 'Espera…' : modo === 'login' ? 'Entrar' : 'Enviar enlace de recuperación'}
              </Btn>
              <button type="button" onClick={() => { setModo(modo === 'login' ? 'recuperar' : 'login'); setError(''); }}
                className="w-full text-center text-xs font-semibold text-brand-600 hover:text-brand-700">
                {modo === 'login' ? '¿Olvidaste tu contraseña?' : 'Volver a iniciar sesión'}
              </button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
