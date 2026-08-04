-- ══════════════════════════════════════════════════════════════════════════
-- OPERA · Fotos de empleados — bucket de Storage + políticas
-- Ejecutar en el SQL Editor de opera-dev.
-- ══════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public)
values ('empleados', 'empleados', true)
on conflict (id) do nothing;

-- Lectura pública (las fotos no son un dato tan sensible como salario/doc,
-- y así se sirven directo por URL sin necesitar firmar cada petición).
drop policy if exists empleados_fotos_select on storage.objects;
create policy empleados_fotos_select on storage.objects for select to public
  using (bucket_id = 'empleados');

-- Escritura solo para quien tenga permiso de editar empleados.
drop policy if exists empleados_fotos_insert on storage.objects;
create policy empleados_fotos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'empleados' and has_permiso('empleados','editar'));

drop policy if exists empleados_fotos_update on storage.objects;
create policy empleados_fotos_update on storage.objects for update to authenticated
  using (bucket_id = 'empleados' and has_permiso('empleados','editar'));

drop policy if exists empleados_fotos_delete on storage.objects;
create policy empleados_fotos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'empleados' and has_permiso('empleados','editar'));
