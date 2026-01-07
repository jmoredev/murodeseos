drop extension if exists "pg_net";


  create table "public"."group_members" (
    "id" uuid not null default gen_random_uuid(),
    "group_id" text not null,
    "user_id" uuid not null,
    "role" text default 'member'::text,
    "joined_at" timestamp with time zone default now(),
    "group_alias" text
      );


alter table "public"."group_members" enable row level security;


  create table "public"."groups" (
    "id" text not null,
    "name" text not null,
    "icon" text default '🎁'::text,
    "creator_id" uuid not null,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."groups" enable row level security;


  create table "public"."profiles" (
    "id" uuid not null,
    "updated_at" timestamp with time zone,
    "username" text,
    "full_name" text,
    "display_name" text,
    "avatar_url" text,
    "website" text,
    "shirt_size" text,
    "pants_size" text,
    "shoe_size" text,
    "favorite_brands" text,
    "favorite_color" text
      );


alter table "public"."profiles" enable row level security;


  create table "public"."tmp_auth_identities" (
    "provider_id" uuid,
    "user_id" uuid,
    "identity_data" jsonb,
    "provider" text,
    "last_sign_in_at" timestamp with time zone,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "email" text,
    "id" text
      );


alter table "public"."tmp_auth_identities" enable row level security;


  create table "public"."tmp_auth_users" (
    "instance_id" uuid,
    "id" uuid,
    "aud" text,
    "role" text,
    "email" text,
    "encrypted_password" text,
    "email_confirmed_at" timestamp with time zone,
    "invited_at" text,
    "confirmation_token" text,
    "confirmation_sent_at" text,
    "recovery_token" text,
    "recovery_sent_at" text,
    "email_change_token_new" text,
    "email_change" text,
    "email_change_sent_at" text,
    "last_sign_in_at" text,
    "raw_app_meta_data" jsonb,
    "raw_user_meta_data" jsonb,
    "is_super_admin" text,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "phone" text,
    "phone_confirmed_at" text,
    "phone_change" text,
    "phone_change_token" text,
    "phone_change_sent_at" text,
    "confirmed_at" timestamp with time zone,
    "email_change_token_current" text,
    "email_change_confirm_status" text,
    "banned_until" text,
    "reauthentication_token" text,
    "reauthentication_sent_at" text,
    "is_sso_user" boolean,
    "deleted_at" text,
    "is_anonymous" boolean
      );


alter table "public"."tmp_auth_users" enable row level security;


  create table "public"."user_aliases" (
    "id" uuid not null default gen_random_uuid(),
    "owner_id" uuid not null,
    "target_user_id" uuid not null,
    "alias" text not null,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."user_aliases" enable row level security;


  create table "public"."wishlist_items" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "title" text not null,
    "links" text[] default '{}'::text[],
    "image_url" text,
    "price" text,
    "notes" text,
    "priority" text default 'medium'::text,
    "reserved_by" uuid,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."wishlist_items" enable row level security;

CREATE UNIQUE INDEX group_members_group_id_user_id_key ON public.group_members USING btree (group_id, user_id);

CREATE UNIQUE INDEX group_members_pkey ON public.group_members USING btree (id);

CREATE UNIQUE INDEX groups_pkey ON public.groups USING btree (id);

CREATE INDEX idx_group_members_group_id ON public.group_members USING btree (group_id);

CREATE INDEX idx_group_members_user_id ON public.group_members USING btree (user_id);

CREATE INDEX idx_groups_creator_id ON public.groups USING btree (creator_id);

CREATE INDEX idx_user_aliases_owner_id ON public.user_aliases USING btree (owner_id);

CREATE INDEX idx_user_aliases_target_user_id ON public.user_aliases USING btree (target_user_id);

CREATE INDEX idx_wishlist_items_reserved_by ON public.wishlist_items USING btree (reserved_by);

CREATE INDEX idx_wishlist_items_user_id ON public.wishlist_items USING btree (user_id);

CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id);

CREATE UNIQUE INDEX profiles_username_key ON public.profiles USING btree (username);

CREATE UNIQUE INDEX user_aliases_owner_id_target_user_id_key ON public.user_aliases USING btree (owner_id, target_user_id);

CREATE UNIQUE INDEX user_aliases_pkey ON public.user_aliases USING btree (id);

CREATE UNIQUE INDEX wishlist_items_pkey ON public.wishlist_items USING btree (id);

alter table "public"."group_members" add constraint "group_members_pkey" PRIMARY KEY using index "group_members_pkey";

alter table "public"."groups" add constraint "groups_pkey" PRIMARY KEY using index "groups_pkey";

alter table "public"."profiles" add constraint "profiles_pkey" PRIMARY KEY using index "profiles_pkey";

alter table "public"."user_aliases" add constraint "user_aliases_pkey" PRIMARY KEY using index "user_aliases_pkey";

alter table "public"."wishlist_items" add constraint "wishlist_items_pkey" PRIMARY KEY using index "wishlist_items_pkey";

alter table "public"."group_members" add constraint "group_members_group_id_fkey" FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE not valid;

alter table "public"."group_members" validate constraint "group_members_group_id_fkey";

alter table "public"."group_members" add constraint "group_members_group_id_user_id_key" UNIQUE using index "group_members_group_id_user_id_key";

alter table "public"."group_members" add constraint "group_members_role_check" CHECK ((role = ANY (ARRAY['admin'::text, 'member'::text]))) not valid;

alter table "public"."group_members" validate constraint "group_members_role_check";

alter table "public"."group_members" add constraint "group_members_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."group_members" validate constraint "group_members_user_id_fkey";

alter table "public"."groups" add constraint "groups_creator_id_fkey" FOREIGN KEY (creator_id) REFERENCES auth.users(id) not valid;

alter table "public"."groups" validate constraint "groups_creator_id_fkey";

alter table "public"."profiles" add constraint "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) not valid;

alter table "public"."profiles" validate constraint "profiles_id_fkey";

alter table "public"."profiles" add constraint "profiles_username_key" UNIQUE using index "profiles_username_key";

alter table "public"."profiles" add constraint "username_length" CHECK ((char_length(username) >= 3)) not valid;

alter table "public"."profiles" validate constraint "username_length";

alter table "public"."user_aliases" add constraint "user_aliases_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."user_aliases" validate constraint "user_aliases_owner_id_fkey";

alter table "public"."user_aliases" add constraint "user_aliases_owner_id_target_user_id_key" UNIQUE using index "user_aliases_owner_id_target_user_id_key";

alter table "public"."user_aliases" add constraint "user_aliases_target_user_id_fkey" FOREIGN KEY (target_user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."user_aliases" validate constraint "user_aliases_target_user_id_fkey";

alter table "public"."wishlist_items" add constraint "wishlist_items_priority_check" CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text]))) not valid;

alter table "public"."wishlist_items" validate constraint "wishlist_items_priority_check";

alter table "public"."wishlist_items" add constraint "wishlist_items_reserved_by_fkey" FOREIGN KEY (reserved_by) REFERENCES auth.users(id) not valid;

alter table "public"."wishlist_items" validate constraint "wishlist_items_reserved_by_fkey";

alter table "public"."wishlist_items" add constraint "wishlist_items_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) not valid;

alter table "public"."wishlist_items" validate constraint "wishlist_items_user_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.check_wishlist_update_permissions()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_user_id UUID;
BEGIN
  current_user_id := (select auth.uid());
  
  -- 1. Nadie puede cambiar el propietario (user_id)
  IF OLD.user_id IS DISTINCT FROM NEW.user_id THEN
    RAISE EXCEPTION 'No se permite cambiar el propietario del item.';
  END IF;

  -- 2. Si soy el dueño, permito la edición
  IF OLD.user_id = current_user_id THEN
    RETURN NEW;
  END IF;

  -- 3. Si NO soy el dueño, solo permito cambiar reserved_by
  IF OLD.title IS DISTINCT FROM NEW.title OR
     OLD.links IS DISTINCT FROM NEW.links OR
     OLD.image_url IS DISTINCT FROM NEW.image_url OR
     OLD.price IS DISTINCT FROM NEW.price OR
     OLD.notes IS DISTINCT FROM NEW.notes OR
     OLD.priority IS DISTINCT FROM NEW.priority THEN
     RAISE EXCEPTION 'No tienes permiso para editar los detalles de este regalo. Solo puedes reservarlo.';
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_group_ids(user_uuid uuid)
 RETURNS TABLE(group_id text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT group_id 
  FROM group_members 
  WHERE user_id = user_uuid;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$function$
;

grant delete on table "public"."group_members" to "anon";

grant insert on table "public"."group_members" to "anon";

grant references on table "public"."group_members" to "anon";

grant select on table "public"."group_members" to "anon";

grant trigger on table "public"."group_members" to "anon";

grant truncate on table "public"."group_members" to "anon";

grant update on table "public"."group_members" to "anon";

grant delete on table "public"."group_members" to "authenticated";

grant insert on table "public"."group_members" to "authenticated";

grant references on table "public"."group_members" to "authenticated";

grant select on table "public"."group_members" to "authenticated";

grant trigger on table "public"."group_members" to "authenticated";

grant truncate on table "public"."group_members" to "authenticated";

grant update on table "public"."group_members" to "authenticated";

grant delete on table "public"."group_members" to "service_role";

grant insert on table "public"."group_members" to "service_role";

grant references on table "public"."group_members" to "service_role";

grant select on table "public"."group_members" to "service_role";

grant trigger on table "public"."group_members" to "service_role";

grant truncate on table "public"."group_members" to "service_role";

grant update on table "public"."group_members" to "service_role";

grant delete on table "public"."groups" to "anon";

grant insert on table "public"."groups" to "anon";

grant references on table "public"."groups" to "anon";

grant select on table "public"."groups" to "anon";

grant trigger on table "public"."groups" to "anon";

grant truncate on table "public"."groups" to "anon";

grant update on table "public"."groups" to "anon";

grant delete on table "public"."groups" to "authenticated";

grant insert on table "public"."groups" to "authenticated";

grant references on table "public"."groups" to "authenticated";

grant select on table "public"."groups" to "authenticated";

grant trigger on table "public"."groups" to "authenticated";

grant truncate on table "public"."groups" to "authenticated";

grant update on table "public"."groups" to "authenticated";

grant delete on table "public"."groups" to "service_role";

grant insert on table "public"."groups" to "service_role";

grant references on table "public"."groups" to "service_role";

grant select on table "public"."groups" to "service_role";

grant trigger on table "public"."groups" to "service_role";

grant truncate on table "public"."groups" to "service_role";

grant update on table "public"."groups" to "service_role";

grant delete on table "public"."profiles" to "anon";

grant insert on table "public"."profiles" to "anon";

grant references on table "public"."profiles" to "anon";

grant select on table "public"."profiles" to "anon";

grant trigger on table "public"."profiles" to "anon";

grant truncate on table "public"."profiles" to "anon";

grant update on table "public"."profiles" to "anon";

grant delete on table "public"."profiles" to "authenticated";

grant insert on table "public"."profiles" to "authenticated";

grant references on table "public"."profiles" to "authenticated";

grant select on table "public"."profiles" to "authenticated";

grant trigger on table "public"."profiles" to "authenticated";

grant truncate on table "public"."profiles" to "authenticated";

grant update on table "public"."profiles" to "authenticated";

grant delete on table "public"."profiles" to "service_role";

grant insert on table "public"."profiles" to "service_role";

grant references on table "public"."profiles" to "service_role";

grant select on table "public"."profiles" to "service_role";

grant trigger on table "public"."profiles" to "service_role";

grant truncate on table "public"."profiles" to "service_role";

grant update on table "public"."profiles" to "service_role";

grant delete on table "public"."tmp_auth_identities" to "anon";

grant insert on table "public"."tmp_auth_identities" to "anon";

grant references on table "public"."tmp_auth_identities" to "anon";

grant select on table "public"."tmp_auth_identities" to "anon";

grant trigger on table "public"."tmp_auth_identities" to "anon";

grant truncate on table "public"."tmp_auth_identities" to "anon";

grant update on table "public"."tmp_auth_identities" to "anon";

grant delete on table "public"."tmp_auth_identities" to "authenticated";

grant insert on table "public"."tmp_auth_identities" to "authenticated";

grant references on table "public"."tmp_auth_identities" to "authenticated";

grant select on table "public"."tmp_auth_identities" to "authenticated";

grant trigger on table "public"."tmp_auth_identities" to "authenticated";

grant truncate on table "public"."tmp_auth_identities" to "authenticated";

grant update on table "public"."tmp_auth_identities" to "authenticated";

grant delete on table "public"."tmp_auth_identities" to "service_role";

grant insert on table "public"."tmp_auth_identities" to "service_role";

grant references on table "public"."tmp_auth_identities" to "service_role";

grant select on table "public"."tmp_auth_identities" to "service_role";

grant trigger on table "public"."tmp_auth_identities" to "service_role";

grant truncate on table "public"."tmp_auth_identities" to "service_role";

grant update on table "public"."tmp_auth_identities" to "service_role";

grant delete on table "public"."tmp_auth_users" to "anon";

grant insert on table "public"."tmp_auth_users" to "anon";

grant references on table "public"."tmp_auth_users" to "anon";

grant select on table "public"."tmp_auth_users" to "anon";

grant trigger on table "public"."tmp_auth_users" to "anon";

grant truncate on table "public"."tmp_auth_users" to "anon";

grant update on table "public"."tmp_auth_users" to "anon";

grant delete on table "public"."tmp_auth_users" to "authenticated";

grant insert on table "public"."tmp_auth_users" to "authenticated";

grant references on table "public"."tmp_auth_users" to "authenticated";

grant select on table "public"."tmp_auth_users" to "authenticated";

grant trigger on table "public"."tmp_auth_users" to "authenticated";

grant truncate on table "public"."tmp_auth_users" to "authenticated";

grant update on table "public"."tmp_auth_users" to "authenticated";

grant delete on table "public"."tmp_auth_users" to "service_role";

grant insert on table "public"."tmp_auth_users" to "service_role";

grant references on table "public"."tmp_auth_users" to "service_role";

grant select on table "public"."tmp_auth_users" to "service_role";

grant trigger on table "public"."tmp_auth_users" to "service_role";

grant truncate on table "public"."tmp_auth_users" to "service_role";

grant update on table "public"."tmp_auth_users" to "service_role";

grant delete on table "public"."user_aliases" to "anon";

grant insert on table "public"."user_aliases" to "anon";

grant references on table "public"."user_aliases" to "anon";

grant select on table "public"."user_aliases" to "anon";

grant trigger on table "public"."user_aliases" to "anon";

grant truncate on table "public"."user_aliases" to "anon";

grant update on table "public"."user_aliases" to "anon";

grant delete on table "public"."user_aliases" to "authenticated";

grant insert on table "public"."user_aliases" to "authenticated";

grant references on table "public"."user_aliases" to "authenticated";

grant select on table "public"."user_aliases" to "authenticated";

grant trigger on table "public"."user_aliases" to "authenticated";

grant truncate on table "public"."user_aliases" to "authenticated";

grant update on table "public"."user_aliases" to "authenticated";

grant delete on table "public"."user_aliases" to "service_role";

grant insert on table "public"."user_aliases" to "service_role";

grant references on table "public"."user_aliases" to "service_role";

grant select on table "public"."user_aliases" to "service_role";

grant trigger on table "public"."user_aliases" to "service_role";

grant truncate on table "public"."user_aliases" to "service_role";

grant update on table "public"."user_aliases" to "service_role";

grant delete on table "public"."wishlist_items" to "anon";

grant insert on table "public"."wishlist_items" to "anon";

grant references on table "public"."wishlist_items" to "anon";

grant select on table "public"."wishlist_items" to "anon";

grant trigger on table "public"."wishlist_items" to "anon";

grant truncate on table "public"."wishlist_items" to "anon";

grant update on table "public"."wishlist_items" to "anon";

grant delete on table "public"."wishlist_items" to "authenticated";

grant insert on table "public"."wishlist_items" to "authenticated";

grant references on table "public"."wishlist_items" to "authenticated";

grant select on table "public"."wishlist_items" to "authenticated";

grant trigger on table "public"."wishlist_items" to "authenticated";

grant truncate on table "public"."wishlist_items" to "authenticated";

grant update on table "public"."wishlist_items" to "authenticated";

grant delete on table "public"."wishlist_items" to "service_role";

grant insert on table "public"."wishlist_items" to "service_role";

grant references on table "public"."wishlist_items" to "service_role";

grant select on table "public"."wishlist_items" to "service_role";

grant trigger on table "public"."wishlist_items" to "service_role";

grant truncate on table "public"."wishlist_items" to "service_role";

grant update on table "public"."wishlist_items" to "service_role";


  create policy "Los miembros pueden ver otros miembros de sus grupos"
  on "public"."group_members"
  as permissive
  for select
  to public
using ((group_id IN ( SELECT public.get_user_group_ids(( SELECT auth.uid() AS uid)) AS get_user_group_ids)));



  create policy "Los usuarios pueden actualizar su propia membresía"
  on "public"."group_members"
  as permissive
  for update
  to public
using ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "Los usuarios pueden salir de grupos"
  on "public"."group_members"
  as permissive
  for delete
  to public
using ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "Los usuarios pueden unirse a grupos"
  on "public"."group_members"
  as permissive
  for insert
  to public
with check ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "Cualquier usuario autenticado puede crear grupos"
  on "public"."groups"
  as permissive
  for insert
  to public
with check ((( SELECT auth.uid() AS uid) = creator_id));



  create policy "Los grupos son visibles para usuarios autenticados"
  on "public"."groups"
  as permissive
  for select
  to public
using ((( SELECT auth.uid() AS uid) IS NOT NULL));



  create policy "Solo el creador puede actualizar el grupo"
  on "public"."groups"
  as permissive
  for update
  to public
using ((creator_id = ( SELECT auth.uid() AS uid)));



  create policy "Solo el creador puede eliminar el grupo"
  on "public"."groups"
  as permissive
  for delete
  to public
using ((creator_id = ( SELECT auth.uid() AS uid)));



  create policy "Public profiles are viewable by everyone."
  on "public"."profiles"
  as permissive
  for select
  to public
using (true);



  create policy "Users can insert their own profile."
  on "public"."profiles"
  as permissive
  for insert
  to public
with check ((( SELECT auth.uid() AS uid) = id));



  create policy "Users can update own profile."
  on "public"."profiles"
  as permissive
  for update
  to public
using ((( SELECT auth.uid() AS uid) = id));



  create policy "Usuarios pueden actualizar sus propios alias"
  on "public"."user_aliases"
  as permissive
  for update
  to authenticated
using ((auth.uid() = owner_id))
with check ((auth.uid() = owner_id));



  create policy "Usuarios pueden crear alias"
  on "public"."user_aliases"
  as permissive
  for insert
  to authenticated
with check ((auth.uid() = owner_id));



  create policy "Usuarios pueden eliminar sus propios alias"
  on "public"."user_aliases"
  as permissive
  for delete
  to authenticated
using ((auth.uid() = owner_id));



  create policy "Usuarios pueden ver sus propios alias creados"
  on "public"."user_aliases"
  as permissive
  for select
  to authenticated
using ((auth.uid() = owner_id));



  create policy "Usuarios autenticados pueden actualizar items"
  on "public"."wishlist_items"
  as permissive
  for update
  to authenticated
using (true)
with check (true);



  create policy "Usuarios autenticados pueden ver todos los items"
  on "public"."wishlist_items"
  as permissive
  for select
  to authenticated
using ((( SELECT auth.uid() AS uid) IS NOT NULL));



  create policy "Usuarios pueden crear sus propios items"
  on "public"."wishlist_items"
  as permissive
  for insert
  to authenticated
with check ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "Usuarios pueden eliminar sus propios items"
  on "public"."wishlist_items"
  as permissive
  for delete
  to authenticated
using ((user_id = ( SELECT auth.uid() AS uid)));


CREATE TRIGGER tr_check_wishlist_update BEFORE UPDATE ON public.wishlist_items FOR EACH ROW EXECUTE FUNCTION public.check_wishlist_update_permissions();

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


  create policy "Imágenes de wishlist son públicas"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'wishlist-images'::text));



  create policy "Usuarios autenticados pueden subir imágenes"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check (((bucket_id = 'wishlist-images'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Usuarios pueden actualizar sus propias imágenes"
  on "storage"."objects"
  as permissive
  for update
  to public
using (((bucket_id = 'wishlist-images'::text) AND (auth.uid() = owner)));



  create policy "Usuarios pueden eliminar sus propias imágenes"
  on "storage"."objects"
  as permissive
  for delete
  to public
using (((bucket_id = 'wishlist-images'::text) AND (auth.uid() = owner)));



