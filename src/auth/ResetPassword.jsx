import { useState } from 'react';
import { Card, Btn, Field, Input, Icon } from '../components/ui.jsx';
import { useAuth } from './AuthProvider.jsx';

export default function ResetPassword(){
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState(false);
  const [cargando, setCargando] = useState(false);

  const guardar = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.');
    if (password !== confirmar) return setError('Las contraseñas no coinciden.');
    setCargando(true);
    const { error } = await updatePassword(password);
    setCargando(false);
    if (error) setError(error.message); else setOk(true);
  };

  return (
    <div className="min-h-screen grid place-items-center bg-ink-50 dark:bg-ink-950 px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 justify-center mb-6">
          <div className="w-11 h-11 rounded-xl bg-brand-500 grid place-items-center shadow-lg shadow-brand-500/25">
            <Icon n="key" c="w-6 h-6 text-white"/></div>
          <div>
            <p className="font-extrabold text-ink-900 dark:text-white text-lg leading-none">OPERA</p>
            <p className="text-[11px] text-ink-500 dark:text-ink-400 mt-0.5">Nueva contraseña</p>
          </div>
        </div>
        <Card>
          {ok ? (
            <div className="text-center py-4">
              <Icon n="check" c="w-8 h-8 mx-auto text-emerald-500"/>
              <h3 className="mt-3 font-bold text-ink-900 dark:text-white">Contraseña actualizada</h3>
              <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">Ya puedes usarla la próxima vez que inicies sesión.</p>
            </div>
          ) : (
            <form onSubmit={guardar} className="space-y-4">
              <h3 className="font-bold text-ink-900 dark:text-white">Define tu nueva contraseña</h3>
              <Field label="Contraseña nueva" req hint="Mínimo 8 caracteres">
                <Input type="password" required value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password"/>
              </Field>
              <Field label="Confirmar contraseña" req>
                <Input type="password" required value={confirmar} onChange={e => setConfirmar(e.target.value)} autoComplete="new-password"/>
              </Field>
              {error && <p className="text-xs font-semibold text-rose-600 bg-rose-50 dark:bg-rose-500/10 rounded-lg px-3 py-2">{error}</p>}
              <Btn type="submit" className="w-full" disabled={cargando}>{cargando ? 'Guardando…' : 'Guardar contraseña'}</Btn>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
