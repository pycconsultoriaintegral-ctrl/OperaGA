import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from './AuthProvider.jsx';

/**
 * Carga el perfil (profiles) y la matriz de permisos (permisos) del rol del
 * usuario autenticado. La UI usa `has(modulo, accion)` para ocultar/deshabilitar
 * botones — pero el control real siempre lo hace Row Level Security en Supabase,
 * esto es solo para no mostrar acciones que el servidor de todos modos rechazaría.
 */
export function usePermisos(){
  const { session } = useAuth();
  const [perfil, setPerfil] = useState(null);
  const [rol, setRol] = useState(null);
  const [matriz, setMatriz] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let vivo = true;
    async function cargar(){
      if (!session?.user) { setPerfil(null); setRol(null); setMatriz({}); setLoading(false); return; }
      setLoading(true);

      const { data: perfilData, error: perfilErr } = await supabase
        .from('profiles')
        .select('id, nombre, rol_id, estado, empleado_id, roles ( codigo, nombre )')
        .eq('id', session.user.id)
        .maybeSingle();

      if (!vivo) return;
      if (perfilErr || !perfilData) { setPerfil(null); setRol(null); setMatriz({}); setLoading(false); return; }

      setPerfil(perfilData);
      setRol(perfilData.roles || null);

      const { data: permisosData } = await supabase
        .from('permisos')
        .select('modulo, ver, crear, editar, eliminar, exportar')
        .eq('rol_id', perfilData.rol_id);

      if (!vivo) return;
      const m = {};
      (permisosData || []).forEach(p => { m[p.modulo] = p; });
      setMatriz(m);
      setLoading(false);
    }
    cargar();
    return () => { vivo = false; };
  }, [session?.user?.id]);

  const has = useCallback((modulo, accion) => !!(matriz[modulo] && matriz[modulo][accion]), [matriz]);

  return { perfil, rol, matriz, has, loading };
}
