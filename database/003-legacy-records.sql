-- Import source rows as historical orders, not serial-numbered stock.
begin;
create table public.legacy_records(id uuid primary key,data jsonb not null,version integer not null default 1,source_key text generated always as(data->>'sourceKey') stored unique not null);
alter table public.legacy_records enable row level security;
create policy visible_legacy_records on public.legacy_records for select to authenticated using(public.is_inventory_admin() or nullif(data->>'employee','')=(select employee from public.profiles where id=auth.uid()));
revoke all on public.legacy_records from anon,authenticated;
grant select on public.legacy_records to authenticated;
create function public.validate_legacy_record(item jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if item->>'kind' not in ('device-order','other','cancelled') or item->>'kind' is null then raise exception 'סוג רשומה לא תקין';end if;
 if item->>'delivery' not in ('delivered','pending','unknown') or item->>'delivery' is null then raise exception 'מצב מסירה לא תקין';end if;
 if nullif(item->>'sourceKey','') is null or octet_length(item::text)>100000 then raise exception 'רשומה לא תקינה או גדולה מדי';end if;
 if not public.catalog_has('companies',item->>'company',true) then raise exception 'חברה לא קיימת';end if;
 if nullif(item->>'employee','') is not null and not public.catalog_has('employees',item->>'employee',true) then raise exception 'עובד לא קיים';end if;
 if nullif(item->>'orderDate','') is not null then perform (item->>'orderDate')::date;end if;
 if item->'quantity' is not null and item->'quantity'<>'null'::jsonb then if (item->>'quantity')::numeric<>floor((item->>'quantity')::numeric) or (item->>'quantity')::numeric<1 then raise exception 'כמות לא תקינה';end if;end if;
 if item->>'kind'='device-order' and (nullif(item->>'model','') is null or item->'quantity' is null or item->'quantity'='null'::jsonb) then raise exception 'חסר דגם או כמות';end if;
 return item;
end;
$$;
create function public.import_legacy_records(items jsonb,expected_catalog_version integer) returns void language plpgsql security definer set search_path=public as $$
declare cfg jsonb;ver integer;x jsonb;n jsonb;actor text;model text;
begin
 if not public.is_inventory_admin() then raise exception 'רק מנהל יכול לייבא רשומות';end if;
 if jsonb_typeof(items) is distinct from 'array' or jsonb_array_length(items)=0 or jsonb_array_length(items)>2000 then raise exception 'כמות רשומות לא תקינה';end if;
 select data,version into cfg,ver from public.catalog where id=1 for update;
 if ver is distinct from expected_catalog_version then raise exception 'הרשימות עודכנו. רעננו לפני הייבוא';end if;
 select name into actor from public.profiles where id=auth.uid();
 for x in select value from jsonb_array_elements(items) loop
  n:=public.validate_legacy_record(x);
  insert into public.legacy_records(id,data) values((n->>'id')::uuid,n);
  model:=nullif(trim(n->>'model'),'');
  if model is not null and not exists(select 1 from jsonb_array_elements(cfg->'models') m where m->>'name'=model) then cfg:=jsonb_set(cfg,array['models'],(cfg->'models')||jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'name',model,'active',true)));end if;
  insert into public.events(data) values(jsonb_build_object('id',gen_random_uuid(),'recordId',n->>'id','type','ייבוא רשומה מהגיליון','at',now(),'actor',actor,'detail',(n->>'company')||' · שורה '||coalesce(n->'source'->>'row',''),'after',n));
 end loop;
 perform public.validate_catalog(cfg);
 update public.catalog set data=cfg,version=version+1 where id=1;
exception when unique_violation then raise exception 'הרשומה כבר יובאה. הייבוא כולו בוטל';
end;
$$;
create function public.edit_legacy_record(record_id uuid,expected_version integer,changes jsonb,reason text) returns void language plpgsql security definer set search_path=public as $$
declare r public.legacy_records%rowtype;n jsonb;actor text;
begin
 if not public.is_inventory_admin() then raise exception 'רק מנהל יכול לערוך רשומה';end if;
 if nullif(trim(reason),'') is null then raise exception 'חסרה סיבת שינוי';end if;
 perform 1 from public.catalog where id=1 for share;
 select * into r from public.legacy_records where id=record_id for update;
 if not found then raise exception 'הרשומה לא נמצאה';end if;
 if r.version is distinct from expected_version then raise exception 'הרשומה עודכנה. רעננו ונסו שוב';end if;
 n:=public.validate_legacy_record((r.data||changes)||jsonb_build_object('id',record_id,'sourceKey',r.data->>'sourceKey','source',r.data->'source'));
 update public.legacy_records set data=n,version=version+1 where id=record_id;
 select name into actor from public.profiles where id=auth.uid();
 insert into public.events(data) values(jsonb_build_object('id',gen_random_uuid(),'recordId',record_id,'type','עריכת רשומה מהגיליון','at',now(),'actor',actor,'detail',left(reason,1000),'before',r.data,'after',n));
end;
$$;
create function public.cascade_legacy_catalog() returns trigger language plpgsql security definer set search_path=public as $$
declare k text;prop text;old_item jsonb;new_item jsonb;r public.legacy_records%rowtype;n jsonb;actor text;
begin
 select name into actor from public.profiles where id=auth.uid();
 foreach k in array array['companies','employees','models'] loop
  prop:=case k when 'companies' then 'company' when 'employees' then 'employee' when 'models' then 'model' end;
  for old_item in select value from jsonb_array_elements(old.data->k) loop
   select value into new_item from jsonb_array_elements(new.data->k) where value->>'id'=old_item->>'id';
   if new_item is not null and new_item->>'name'<>old_item->>'name' then
    for r in select * from public.legacy_records where data->>prop=old_item->>'name' for update loop
     n:=jsonb_set(r.data,array[prop],new_item->'name');update public.legacy_records set data=n,version=version+1 where id=r.id;
     insert into public.events(data) values(jsonb_build_object('id',gen_random_uuid(),'recordId',r.id,'type','עדכון שיוך רשומה','at',now(),'actor',actor,'detail',(old_item->>'name')||' ← '||(new_item->>'name'),'before',r.data,'after',n));
    end loop;
   end if;
  end loop;
 end loop;
 return new;
end;
$$;
create trigger legacy_catalog_renames after update on public.catalog for each row execute function public.cascade_legacy_catalog();
-- Treat catalogue entries used by legacy rows as in use when archiving/removing.
create function public.guard_legacy_catalog_removal() returns trigger language plpgsql security definer set search_path=public as $$
declare k text;prop text;x jsonb;
begin
 foreach k in array array['companies','employees','models'] loop
  prop:=case k when 'companies' then 'company' when 'employees' then 'employee' when 'models' then 'model' end;
  for x in select value from jsonb_array_elements(old.data->k) loop
   if not exists(select 1 from jsonb_array_elements(new.data->k) c where c->>'id'=x->>'id') and exists(select 1 from public.legacy_records where data->>prop=x->>'name') then new.data:=jsonb_set(new.data,array[k],(new.data->k)||jsonb_build_array(x||jsonb_build_object('active',false)));end if;
  end loop;
 end loop;
 return new;
end;
$$;
create trigger guard_legacy_removals before update on public.catalog for each row execute function public.guard_legacy_catalog_removal();
revoke all on function public.validate_legacy_record(jsonb),public.import_legacy_records(jsonb,integer),public.edit_legacy_record(uuid,integer,jsonb,text),public.cascade_legacy_catalog(),public.guard_legacy_catalog_removal() from public,anon,authenticated;
grant execute on function public.import_legacy_records(jsonb,integer),public.edit_legacy_record(uuid,integer,jsonb,text) to authenticated;
commit;
