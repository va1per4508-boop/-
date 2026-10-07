-- Run once in a new Supabase project's SQL editor. No customer data is seeded.
begin;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 name text not null,
 role text not null check (role in ('admin','agent')),
 employee text check (employee in ('עובד לדוגמה 1','עובד לדוגמה 2','עובד לדוגמה 3','עובד לדוגמה 4')),
 check (role='admin' or employee is not null)
);
create table public.devices (
 id uuid primary key,
 data jsonb not null,
 version integer not null default 1,
 serial_normalized text generated always as (lower(trim(data->>'serial'))) stored unique not null,
 check (data->>'status' in ('warehouse','agent','trial','delivered','inspection','repair','supplier')),
 check (length(data->>'serial') between 1 and 100)
);
create table public.events (
 id uuid primary key default gen_random_uuid(),
 device_id uuid not null references public.devices(id),
 created_at timestamptz not null default now(),
 data jsonb not null
);
create index devices_employee on public.devices ((data->>'employee'));
create index events_device on public.events(device_id,created_at desc);
alter table public.profiles enable row level security;
alter table public.devices enable row level security;
alter table public.events enable row level security;
create function public.is_inventory_admin() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.profiles where id=auth.uid() and role='admin');
$$;
create policy own_profile on public.profiles for select to authenticated using (id=auth.uid() or public.is_inventory_admin());
create policy visible_devices on public.devices for select to authenticated using (
 public.is_inventory_admin() or data->>'employee'=(select employee from public.profiles where id=auth.uid())
);
create policy visible_events on public.events for select to authenticated using (
 public.is_inventory_admin() or exists(select 1 from public.devices d where d.id=device_id and d.data->>'employee'=(select employee from public.profiles where id=auth.uid()))
);
revoke all on public.profiles,public.devices,public.events from anon,authenticated;
grant select on public.profiles,public.devices,public.events to authenticated;
create function public.receive_devices(items jsonb) returns void language plpgsql security definer set search_path=public as $$
declare item jsonb; actor text; device uuid; clean jsonb;
begin
 if not public.is_inventory_admin() then raise exception 'רק מנהל יכול לקלוט מלאי'; end if;
 if jsonb_typeof(items)<>'array' or jsonb_array_length(items)=0 or jsonb_array_length(items)>1000 then raise exception 'משלוח לא תקין או גדול מדי'; end if;
 select name into actor from public.profiles where id=auth.uid();
 for item in select value from jsonb_array_elements(items) loop
  if nullif(trim(item->>'serial'),'') is null or length(item->>'serial')>100 or nullif(trim(item->>'model'),'') is null or nullif(trim(item->>'batch'),'') is null then raise exception 'חסרים פרטי קליטה'; end if;
  if coalesce(item->>'company','') not in ('','חברה לדוגמה 1','חברה לדוגמה 2 מכשירי שמיעה','חברה לדוגמה 3 מכשירי שמיעה') then raise exception 'חברה לא תקינה'; end if;
  if coalesce(item->>'side','') not in ('ימין','שמאל','לא מוגדר') then raise exception 'צד לא תקין'; end if;
  if item->>'received' is null then raise exception 'חסר תאריך קליטה'; end if;
  perform (item->>'received')::date;
  device:=(item->>'id')::uuid;
  clean:=jsonb_build_object('id',device,'serial',trim(item->>'serial'),'model',left(item->>'model',100),'side',item->>'side','color',left(coalesce(item->>'color',''),50),'company',coalesce(item->>'company',''),'batch',left(item->>'batch',100),'received',item->>'received','notes',left(coalesce(item->>'notes',''),1000),'employee','','client','','trialUntil','','status','warehouse');
  insert into public.devices(id,data) values(device,clean);
  insert into public.events(device_id,data) values(device,jsonb_build_object('id',gen_random_uuid(),'deviceId',device,'serial',clean->>'serial','type','קליטה מהספק','at',now(),'actor',actor,'detail',(clean->>'model')||' · משלוח '||(clean->>'batch')));
 end loop;
exception when unique_violation then raise exception 'מספר סידורי כבר קיים. המשלוח לא נקלט';
end;
$$;
create function public.move_device(device_id uuid,expected_version integer,action text,action_values jsonb) returns void language plpgsql security definer set search_path=public as $$
declare current_device public.devices%rowtype; p public.profiles%rowtype; next_data jsonb; s text; title text; detail text;
begin
 select * into p from public.profiles where id=auth.uid();
 if p.id is null then raise exception 'אין הרשאה'; end if;
 select * into current_device from public.devices where id=device_id for update;
 if not found then raise exception 'המכשיר לא נמצא'; end if;
 if current_device.version is distinct from expected_version then raise exception 'המכשיר עודכן בידי משתמש אחר. רעננו ונסו שוב'; end if;
 if p.role<>'admin' and (current_device.data->>'employee' is distinct from p.employee or action not in ('deliver','trial','return')) then raise exception 'אין הרשאה לפעולה'; end if;
 s:=current_device.data->>'status'; next_data:=current_device.data;
 if not (
  (s='warehouse' and action in ('assign','repair','supplier')) or
  (s='agent' and action in ('deliver','trial','return','reassign')) or
  (s='trial' and action in ('deliver','return')) or
  (s='delivered' and action='return') or
  (s='inspection' and action in ('approve','repair','supplier')) or
  (s='repair' and action in ('return','supplier'))
 ) then raise exception 'הפעולה אינה אפשרית במצב הנוכחי'; end if;
 if action in ('assign','reassign') then
  if coalesce(action_values->>'company','') not in ('חברה לדוגמה 1','חברה לדוגמה 2 מכשירי שמיעה','חברה לדוגמה 3 מכשירי שמיעה') or coalesce(action_values->>'employee','') not in ('עובד לדוגמה 1','עובד לדוגמה 2','עובד לדוגמה 3','עובד לדוגמה 4') then raise exception 'יש לבחור חברה ועובד'; end if;
  next_data:=next_data||jsonb_build_object('status','agent','company',action_values->>'company','employee',action_values->>'employee','client','','trialUntil','');
 elsif action in ('deliver','trial') then
  if nullif(trim(action_values->>'client'),'') is null or length(action_values->>'client')>100 then raise exception 'יש להזין שם לקוח'; end if;
  if action='trial' then
   if nullif(action_values->>'trialUntil','') is null or (action_values->>'trialUntil')::date < (now() at time zone 'Asia/Jerusalem')::date then raise exception 'תאריך ניסיון לא תקין'; end if;
  end if;
  next_data:=next_data||jsonb_build_object('status',case when action='trial' then 'trial' else 'delivered' end,'client',trim(action_values->>'client'),'trialUntil',case when action='trial' then action_values->>'trialUntil' else '' end);
 elsif action='return' then
  if nullif(trim(action_values->>'reason'),'') is null then raise exception 'חסרה סיבת החזרה'; end if;
  next_data:=next_data||jsonb_build_object('status','inspection','employee','','client','','trialUntil','','notes',left(action_values->>'reason',1000));
 elsif action='approve' then
  if action_values->>'checked' is distinct from 'true' then raise exception 'חסר אישור בדיקת תקינות'; end if;
  next_data:=next_data||jsonb_build_object('status','warehouse','employee','','client','','trialUntil','');
 elsif action in ('repair','supplier') then
  next_data:=next_data||jsonb_build_object('status',action,'employee','','client','','trialUntil','');
 end if;
 if action<>'return' and nullif(action_values->>'notes','') is not null then next_data:=next_data||jsonb_build_object('notes',left(action_values->>'notes',1000)); end if;
 title:=case action when 'assign' then 'העברה לעובד' when 'reassign' then 'העברה בין עובדים' when 'deliver' then 'מסירה ללקוח' when 'trial' then 'מסירה לניסיון' when 'return' then 'החזרה לבדיקה' when 'approve' then 'אישור חזרה למחסן' when 'repair' then 'שליחה לתיקון' when 'supplier' then 'החזרה לספק' end;
 detail:=concat_ws(' · ',nullif(current_device.data->>'employee',''),nullif(next_data->>'employee',''),nullif(next_data->>'company',''),nullif(next_data->>'client',''),nullif(action_values->>'reason',''),nullif(action_values->>'notes',''));
 update public.devices set data=next_data,version=version+1 where id=device_id;
 insert into public.events(device_id,data) values(device_id,jsonb_build_object('id',gen_random_uuid(),'deviceId',device_id,'serial',next_data->>'serial','type',title,'at',now(),'actor',p.name,'detail',detail));
end;
$$;
revoke all on function public.is_inventory_admin(),public.receive_devices(jsonb),public.move_device(uuid,integer,text,jsonb) from public,anon;
grant execute on function public.is_inventory_admin(),public.receive_devices(jsonb),public.move_device(uuid,integer,text,jsonb) to authenticated;
commit;
-- Create users in Supabase Authentication (disable public sign-ups).
-- Then insert profiles using their Authentication user IDs:
-- insert into public.profiles(id,name,role,employee) values ('USER_UUID','מנהל מערכת','admin',null);
-- insert into public.profiles(id,name,role,employee) values ('USER_UUID','עובד לדוגמה 1','agent','עובד לדוגמה 1');
-- Repeat for עובד לדוגמה 2, עובד לדוגמה 3, עובד לדוגמה 4. Do not expose service-role keys in the frontend.
