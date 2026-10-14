-- Bucket privado para PDFs de CV compartidos por enlace firmado
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('cvs','cvs', false, 10485760, array['application/pdf']) on conflict (id) do nothing;
drop policy if exists "cvs_insert_own" on storage.objects;
drop policy if exists "cvs_select_own" on storage.objects;
drop policy if exists "cvs_delete_own" on storage.objects;
create policy "cvs_insert_own" on storage.objects for insert to authenticated with check (bucket_id = 'cvs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "cvs_select_own" on storage.objects for select to authenticated using (bucket_id = 'cvs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "cvs_delete_own" on storage.objects for delete to authenticated using (bucket_id = 'cvs' and (storage.foldername(name))[1] = auth.uid()::text);

