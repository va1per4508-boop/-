-- Apply after schema.sql. This migration contains configuration only, no real inventory.
begin;
create table public.catalog(id integer primary key check(id=1),data jsonb not null,version integer not null default 1);
alter table public.catalog enable row level security;
create policy readable_catalog on public.catalog for select to authenticated using (true);
revoke all on public.catalog from anon,authenticated;
grant select on public.catalog to authenticated;
insert into public.catalog(id,data) select 1,jsonb_build_object(
 'companies',(select jsonb_agg(jsonb_build_object('id',gen_random_uuid(),'name',x,'active',true)) from unnest(array['אודיוטק','פטיפון מכשירי שמיעה','אודיו סאונד מכשירי שמיעה']) x),
 'employees',(select jsonb_agg(jsonb_build_object('id',gen_random_uuid(),'name',x,'active',true)) from unnest(array['ירון גברי','אוריאל כהן','חן רוזנברג','זאב']) x),
 'models',(select jsonb_agg(jsonb_build_object('id',gen_random_uuid(),'name',x,'active',true)) from unnest(array['Reach R-Li','BiCore R-Li','BiCore SR','M-Core B-Li','M-Core iX']) x),
 'colors',(select jsonb_agg(jsonb_build_object('id',gen_random_uuid(),'name',x,'active',true)) from unnest(array['כסף','גרפיט','שמפניה']) x),'fields','[]'::jsonb);
alter table public.profiles drop constraint if exists profiles_employee_check;
alter table public.events alter column device_id drop not null;
alter table public.devices add column barcode_normalized text generated always as (nullif(trim(data->>'barcode'),'')) stored unique;
create function public.catalog_has(kind text,catalog_value text,include_inactive boolean default false) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.catalog c,jsonb_array_elements(c.data->kind) x where x->>'name'=catalog_value and (include_inactive or coalesce((x->>'active')::boolean,true)));
$$;
create function public.validate_catalog(config jsonb) returns void language plpgsql security definer set search_path=public as $$
declare k text;x jsonb; seen text[]; ids text[];
begin
 if jsonb_typeof(config)<>'object' then raise exception 'קטלוג לא תקין'; end if;
 foreach k in array array['companies','employees','models','colors','fields'] loop
  if jsonb_typeof(config->k) is distinct from 'array' or jsonb_array_length(config->k)>1000 then raise exception 'רשימה לא תקינה'; end if;
  seen:=array[]::text[];ids:=array[]::text[];
  for x in select value from jsonb_array_elements(config->k) loop
   if nullif(trim(x->>'name'),'') is null or length(x->>'name')>100 or x->>'id' is null then raise exception 'שם או מזהה לא תקין'; end if;
   perform (x->>'id')::uuid;
   if lower(trim(x->>'name'))=any(seen) or x->>'id'=any(ids) then raise exception 'כפילות ברשימה'; end if;
   if k='fields' and nullif(x->>'key','') is null then raise exception 'חסר מזהה שדה'; end if;
   if x->>'active' is not null then perform (x->>'active')::boolean; end if;
   seen:=array_append(seen,lower(trim(x->>'name')));ids:=array_append(ids,x->>'id');
  end loop;
 end loop;
end;
$$;
create function public.validate_inventory_device(item jsonb,allow_unknown_date boolean default false) returns jsonb language plpgsql security definer set search_path=public as $$
declare clean jsonb;s text;pair text[];
begin
 if nullif(trim(item->>'serial'),'') is null or length(item->>'serial')>100 or nullif(trim(item->>'model'),'') is null or length(item->>'model')>100 then raise exception 'מספר סידורי או דגם לא תקין'; end if;
 s:=item->>'status';if s not in ('warehouse','agent','trial','delivered','inspection','repair','supplier') or s is null then raise exception 'מצב לא תקין'; end if;
 foreach pair slice 1 in array array[['companies','company'],['employees','employee'],['models','model'],['colors','color']] loop
  if nullif(item->>pair[2],'') is not null and not public.catalog_has(pair[1],item->>pair[2],true) then raise exception 'ערך אינו קיים ברשימות: %',item->>pair[2]; end if;
 end loop;
 if item->>'side' not in ('ימין','שמאל','לא מוגדר') or item->>'side' is null then raise exception 'צד לא תקין'; end if;
 if nullif(item->>'received','') is not null then perform (item->>'received')::date; elsif not allow_unknown_date then raise exception 'חסר תאריך קליטה'; end if;
 if s in ('agent','trial','delivered') and (nullif(item->>'employee','') is null or nullif(item->>'company','') is null) then raise exception 'יש לבחור חברה ועובד'; end if;
 if s in ('trial','delivered') and nullif(trim(item->>'client'),'') is null then raise exception 'חסר לקוח'; end if;
 if s='trial' then if nullif(item->>'trialUntil','') is null then raise exception 'חסר תאריך סיום ניסיון'; end if;perform (item->>'trialUntil')::date;end if;
 if length(coalesce(item->>'client',''))>100 or length(coalesce(item->>'barcode',''))>200 or length(coalesce(item->>'notes',''))>1000 then raise exception 'ערך ארוך מדי'; end if;
 if item->'attributes' is not null and jsonb_typeof(item->'attributes')<>'object' then raise exception 'שדות נוספים לא תקינים'; end if;
 if octet_length(coalesce(item->'attributes','{}')::text)>50000 or octet_length(coalesce(item->'source','{}')::text)>100000 then raise exception 'נתוני שורה גדולים מדי'; end if;
 clean:=jsonb_build_object('id',item->>'id','serial',trim(item->>'serial'),'barcode',trim(coalesce(item->>'barcode','')),'model',item->>'model','side',item->>'side','color',coalesce(item->>'color',''),'company',coalesce(item->>'company',''),'employee',case when s in ('agent','trial','delivered') then coalesce(item->>'employee','') else '' end,'client',case when s in ('agent','trial','delivered') then coalesce(item->>'client','') else '' end,'received',coalesce(item->>'received',''),'trialUntil',case when s='trial' then item->>'trialUntil' else '' end,'batch',left(coalesce(item->>'batch',''),100),'notes',coalesce(item->>'notes',''),'attributes',coalesce(item->'attributes','{}'::jsonb),'status',s);
 if item->'source' is not null then clean:=clean||jsonb_build_object('source',item->'source');end if;
 return clean;
end;
$$;
create function public.edit_device(device_id uuid,expected_version integer,changes jsonb) returns void language plpgsql security definer set search_path=public as $$
declare d public.devices%rowtype;n jsonb;actor text;
begin
 if not public.is_inventory_admin() then raise exception 'רק מנהל יכול לערוך מכשיר';end if;
 perform 1 from public.catalog where id=1 for share;
 select * into d from public.devices where id=device_id for update;
 if not found then raise exception 'המכשיר לא נמצא';end if;
 if d.version is distinct from expected_version then raise exception 'המכשיר עודכן בידי משתמש אחר. רעננו ונסו שוב';end if;
 if nullif(trim(changes->>'reason'),'') is null then raise exception 'חסרה סיבת שינוי';end if;
 -- Immutable ID and original source snapshot cannot be changed by a client payload.
 n:=public.validate_inventory_device((d.data||changes)||jsonb_build_object('id',device_id),true);
 n:=n-'source';if d.data->'source' is not null then n:=n||jsonb_build_object('source',d.data->'source');end if;
 update public.devices set data=n,version=version+1 where id=device_id;
 select name into actor from public.profiles where id=auth.uid();
 insert into public.events(device_id,data) values(device_id,jsonb_build_object('id',gen_random_uuid(),'deviceId',device_id,'serial',n->>'serial','type','עריכת מנהל','at',now(),'actor',actor,'detail',left(changes->>'reason',1000),'before',d.data,'after',n));
exception when unique_violation then raise exception 'מספר סידורי או ברקוד כבר משויך למכשיר אחר';
end;
$$;
create function public.manage_catalog(kind text,operation text,item jsonb,expected_version integer) returns void language plpgsql security definer set search_path=public as $$
declare cfg jsonb;ver integer;old jsonb;n jsonb;entry jsonb;new_list jsonb:='[]';new_name text;prop text;in_use boolean;actor text;title text;d public.devices%rowtype;
begin
 if not public.is_inventory_admin() then raise exception 'רק מנהל יכול לשנות רשימות';end if;
 if kind not in ('companies','employees','models','colors','fields') or operation not in ('add','edit','remove') then raise exception 'פעולה לא תקינה';end if;
 select data,version into cfg,ver from public.catalog where id=1 for update;
 if ver is distinct from expected_version then raise exception 'הרשימות עודכנו. רעננו ונסו שוב';end if;
 new_name:=trim(item->>'name');prop:=case kind when 'companies' then 'company' when 'employees' then 'employee' when 'models' then 'model' when 'colors' then 'color' end;
 select value into old from jsonb_array_elements(cfg->kind) where value->>'id'=item->>'id';
 if operation<>'add' and old is null then raise exception 'הפריט לא נמצא';end if;
 if operation<>'remove' and (nullif(new_name,'') is null or length(new_name)>100) then raise exception 'שם לא תקין';end if;
 if operation='add' then
  entry:=jsonb_build_object('id',gen_random_uuid(),'name',new_name,'active',true);
  if kind='fields' then entry:=entry||jsonb_build_object('key',gen_random_uuid());end if;
  cfg:=jsonb_set(cfg,array[kind],(cfg->kind)||jsonb_build_array(entry));
 else
  in_use:=exists(select 1 from public.devices where case when kind='fields' then nullif(data->'attributes'->>(old->>'key'),'') is not null else data->>prop=old->>'name' end);
  if kind='employees' then in_use:=in_use or exists(select 1 from public.profiles where employee=old->>'name');end if;
  for n in select value from jsonb_array_elements(cfg->kind) loop
   if n->>'id'=item->>'id' then
    if operation='edit' then n:=n||jsonb_build_object('name',new_name,'active',coalesce((item->>'active')::boolean,true));
    elsif in_use then n:=n||jsonb_build_object('active',false);
    else continue;end if;
   end if;
   new_list:=new_list||jsonb_build_array(n);
  end loop;
  cfg:=jsonb_set(cfg,array[kind],new_list);
 end if;
 perform public.validate_catalog(cfg);
 select p.name into actor from public.profiles p where id=auth.uid();
 if operation='edit' and prop is not null and old->>'name'<>new_name then
  for d in select * from public.devices where data->>prop=old->>'name' for update loop
   n:=jsonb_set(d.data,array[prop],to_jsonb(new_name));update public.devices set data=n,version=version+1 where id=d.id;
   insert into public.events(device_id,data) values(d.id,jsonb_build_object('id',gen_random_uuid(),'deviceId',d.id,'serial',n->>'serial','type','עדכון רשימת מנהל','at',now(),'actor',actor,'detail',(old->>'name')||' ← '||new_name,'before',d.data,'after',n));
  end loop;
  if kind='employees' then update public.profiles set employee=new_name where employee=old->>'name';end if;
 end if;
 update public.catalog set data=cfg,version=version+1 where id=1;
 title:=case operation when 'add' then 'הוספת פריט לרשימה' when 'edit' then 'עדכון פריט ברשימה' else case when in_use then 'ארכוב פריט ברשימה' else 'מחיקת פריט מרשימה' end end;
 insert into public.events(data) values(jsonb_build_object('id',gen_random_uuid(),'type',title,'at',now(),'actor',actor,'detail',kind||' · '||coalesce(new_name,old->>'name'),'before',old,'after',entry));
end;
$$;
create function public.import_devices(items jsonb,next_catalog jsonb,expected_catalog_version integer,source_info jsonb) returns void language plpgsql security definer set search_path=public as $$
declare cfg jsonb;ver integer;k text;old jsonb;x jsonb;clean jsonb;device uuid;actor text;
begin
 if not public.is_inventory_admin() then raise exception 'רק מנהל יכול לייבא מלאי';end if;
 if jsonb_typeof(items)<>'array' or jsonb_array_length(items)=0 or jsonb_array_length(items)>1000 then raise exception 'כמות מכשירים לא תקינה (עד 1000 בכל ייבוא)';end if;
 select data,version into cfg,ver from public.catalog where id=1 for update;
 if ver is distinct from expected_catalog_version then raise exception 'הרשימות עודכנו. רעננו ובדקו מחדש את הייבוא';end if;
 perform public.validate_catalog(next_catalog);
 -- Import may append new catalogue entries, but must not alter/remove existing entries.
 foreach k in array array['companies','employees','models','colors','fields'] loop
  for old in select value from jsonb_array_elements(cfg->k) loop
   if not exists(select 1 from jsonb_array_elements(next_catalog->k) candidate where candidate.value=old) then raise exception 'ייבוא אינו יכול לשנות רשימות קיימות';end if;
  end loop;
 end loop;
 update public.catalog set data=next_catalog,version=version+1 where id=1;
 select name into actor from public.profiles where id=auth.uid();
 for x in select value from jsonb_array_elements(items) loop
  -- Reject contradictions instead of silently discarding employee or client from a source row.
  if x->>'status' not in ('agent','trial','delivered') and (nullif(x->>'employee','') is not null or nullif(x->>'client','') is not null) then raise exception 'שיוך עובד או לקוח אינו תואם למצב המכשיר';end if;
  clean:=public.validate_inventory_device(x,true);device:=(clean->>'id')::uuid;
  insert into public.devices(id,data) values(device,clean);
  insert into public.events(device_id,data) values(device,jsonb_build_object('id',gen_random_uuid(),'deviceId',device,'serial',clean->>'serial','type','ייבוא מגיליון','at',now(),'actor',actor,'detail',coalesce(source_info->>'file','')||' · '||coalesce(source_info->>'sheet','')||' · שורה '||coalesce(clean->'source'->>'row','')));
 end loop;
exception when unique_violation then raise exception 'מספר סידורי או ברקוד כפול. הייבוא כולו בוטל';
end;
$$;
revoke all on function public.catalog_has(text,text,boolean),public.validate_catalog(jsonb),public.validate_inventory_device(jsonb,boolean),public.edit_device(uuid,integer,jsonb),public.manage_catalog(text,text,jsonb,integer),public.import_devices(jsonb,jsonb,integer,jsonb) from public,anon,authenticated;
grant execute on function public.edit_device(uuid,integer,jsonb),public.manage_catalog(text,text,jsonb,integer),public.import_devices(jsonb,jsonb,integer,jsonb) to authenticated;

create or replace function public.receive_devices(items jsonb) returns void language plpgsql security definer set search_path=public as $$
declare item jsonb; actor text; device uuid; clean jsonb;
begin
 if not public.is_inventory_admin() then raise exception 'רק מנהל יכול לקלוט מלאי'; end if;
 perform 1 from public.catalog where id=1 for share;
 if jsonb_typeof(items)<>'array' or jsonb_array_length(items)=0 or jsonb_array_length(items)>1000 then raise exception 'משלוח לא תקין או גדול מדי'; end if;
 select name into actor from public.profiles where id=auth.uid();
 for item in select value from jsonb_array_elements(items) loop
  if nullif(trim(item->>'serial'),'') is null or length(item->>'serial')>100 or nullif(trim(item->>'model'),'') is null or nullif(trim(item->>'batch'),'') is null then raise exception 'חסרים פרטי קליטה'; end if;
  if nullif(item->>'company','') is not null and not public.catalog_has('companies',item->>'company') then raise exception 'חברה לא תקינה'; end if;
  if not public.catalog_has('models',item->>'model') then raise exception 'יש לבחור דגם מהרשימה';end if;
  if coalesce(item->>'side','') not in ('ימין','שמאל','לא מוגדר') then raise exception 'צד לא תקין'; end if;
  if item->>'received' is null then raise exception 'חסר תאריך קליטה'; end if;
  perform (item->>'received')::date;
  device:=(item->>'id')::uuid;
  clean:=jsonb_build_object('id',device,'serial',trim(item->>'serial'),'model',left(item->>'model',100),'side',item->>'side','color',left(coalesce(item->>'color',''),50),'company',coalesce(item->>'company',''),'batch',left(item->>'batch',100),'received',item->>'received','notes',left(coalesce(item->>'notes',''),1000),'employee','','client','','trialUntil','','status','warehouse','barcode',coalesce(item->>'barcode',''),'attributes',coalesce(item->'attributes','{}'::jsonb));
  insert into public.devices(id,data) values(device,clean);
  insert into public.events(device_id,data) values(device,jsonb_build_object('id',gen_random_uuid(),'deviceId',device,'serial',clean->>'serial','type','קליטה מהספק','at',now(),'actor',actor,'detail',(clean->>'model')||' · משלוח '||(clean->>'batch')));
 end loop;
exception when unique_violation then raise exception 'מספר סידורי כבר קיים. המשלוח לא נקלט';
end;
$$;

create or replace function public.move_device(device_id uuid,expected_version integer,action text,action_values jsonb) returns void language plpgsql security definer set search_path=public as $$
declare current_device public.devices%rowtype; p public.profiles%rowtype; next_data jsonb; s text; title text; detail text;
begin
 select * into p from public.profiles where id=auth.uid();
 if p.id is null then raise exception 'אין הרשאה'; end if;
 perform 1 from public.catalog where id=1 for share;
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
  if not public.catalog_has('companies',coalesce(action_values->>'company','')) or not public.catalog_has('employees',coalesce(action_values->>'employee','')) then raise exception 'יש לבחור חברה ועובד'; end if;
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

commit;
