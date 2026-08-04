// Edge Function: admin-usuarios
// Gestiona usuarios (crear, cambiar rol, activar/desactivar) desde la app,
// sin que la service_role key toque nunca el navegador.
//
// Seguridad: valida primero, con la sesión del que llama (su JWT, respetando
// RLS), que tenga permiso 'usuarios' antes de usar el cliente admin
// (service_role) para la operación privilegiada. Cualquiera sin ese permiso
// recibe 403, aunque conozca la URL de la función.
//
// SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY los inyecta
// Supabase automáticamente en cada Edge Function — no hay que configurar
// ningún secreto adicional.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'No autenticado' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Cliente "como el que llama" — respeta RLS, sirve para confirmar quién es y su permiso.
    const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !user) return json({ error: 'Sesión inválida' }, 401);

    const { data: perfil } = await callerClient.from('profiles').select('rol_id, estado').eq('id', user.id).maybeSingle();
    if (!perfil || perfil.estado !== 'ACTIVO') return json({ error: 'Tu cuenta no tiene un perfil activo' }, 403);

    const { data: permiso } = await callerClient.from('permisos')
      .select('crear, editar').eq('rol_id', perfil.rol_id).eq('modulo', 'usuarios').maybeSingle();

    // Cliente admin — service_role, bypasa RLS. Solo se usa DESPUÉS de validar el permiso arriba.
    const admin = createClient(supabaseUrl, serviceKey);

    const { action, ...p } = await req.json();

    if (action === 'crear') {
      if (!permiso?.crear) return json({ error: 'No tienes permiso para crear usuarios' }, 403);
      const { email, password, nombre, rol_codigo } = p;
      if (!email || !password || !nombre || !rol_codigo) return json({ error: 'Faltan datos' }, 400);
      if (password.length < 8) return json({ error: 'La contraseña debe tener al menos 8 caracteres' }, 400);

      const { data: rol } = await admin.from('roles').select('id').eq('codigo', rol_codigo).maybeSingle();
      if (!rol) return json({ error: 'Rol inválido' }, 400);

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
      });
      if (createErr) return json({ error: createErr.message }, 400);

      const { error: profileErr } = await admin.from('profiles').insert({
        id: created.user.id, nombre, email, rol_id: rol.id, estado: 'ACTIVO',
      });
      if (profileErr) {
        await admin.auth.admin.deleteUser(created.user.id); // revertir si falla el perfil
        return json({ error: profileErr.message }, 400);
      }
      return json({ ok: true, id: created.user.id });
    }

    if (action === 'cambiar_rol') {
      if (!permiso?.editar) return json({ error: 'No tienes permiso para editar usuarios' }, 403);
      const { user_id, rol_codigo } = p;
      const { data: rol } = await admin.from('roles').select('id').eq('codigo', rol_codigo).maybeSingle();
      if (!rol) return json({ error: 'Rol inválido' }, 400);
      const { error } = await admin.from('profiles').update({ rol_id: rol.id }).eq('id', user_id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === 'cambiar_estado') {
      if (!permiso?.editar) return json({ error: 'No tienes permiso para editar usuarios' }, 403);
      const { user_id, estado } = p;
      if (!['ACTIVO', 'INACTIVO'].includes(estado)) return json({ error: 'Estado inválido' }, 400);
      const { error } = await admin.from('profiles').update({ estado }).eq('id', user_id);
      if (error) return json({ error: error.message }, 400);
      // Además de bloquear el acceso a datos (RLS), bloquea el login mismo.
      await admin.auth.admin.updateUserById(user_id, {
        ban_duration: estado === 'INACTIVO' ? '87600h' : 'none',
      });
      return json({ ok: true });
    }

    return json({ error: 'Acción no reconocida' }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
