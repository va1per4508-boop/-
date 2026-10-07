import {createClient} from '@supabase/supabase-js';
import {seed,transition,actions} from './data';
export const backend=import.meta.env.VITE_SUPABASE_URL&&import.meta.env.VITE_SUPABASE_ANON_KEY?createClient(import.meta.env.VITE_SUPABASE_URL,import.meta.env.VITE_SUPABASE_ANON_KEY):null;
const KEY='hearing-stock-demo-v1';
export function loadDemo(){try {const value=localStorage.getItem(KEY);return value?JSON.parse(value):seed();}catch {throw new Error('לא ניתן לקרוא את הנתונים השמורים בדפדפן. אין לאפס את האחסון לפני גיבוי.');}}
export function saveDemo(data){localStorage.setItem(KEY,JSON.stringify(data));}
export async function fetchRemote(){const [a,b]=await Promise.all([backend.from('devices').select('id,data,version'),backend.from('events').select('data').order('created_at',{ascending:false})]);if(a.error||b.error)throw a.error||b.error;return {devices:a.data.map(x=>({...x.data,id:x.id,version:x.version})),events:b.data.map(x=>x.data)};}
export async function addRemote(items){const {error}=await backend.rpc('receive_devices',{items});if(error)throw error;return fetchRemote();}
export async function moveRemote(device,type,values){const {error}=await backend.rpc('move_device',{device_id:device.id,expected_version:device.version,action:type,action_values:values});if(error)throw error;return fetchRemote();}
export function moveDemo(data,d,type,v){const next=transition(d,type,v);const event={id:crypto.randomUUID(),deviceId:d.id,serial:d.serial,type:actions[type],at:new Date().toISOString(),actor:'מנהל הדגמה',detail:[d.employee&&`מאת ${d.employee}`,next.employee&&`אל ${next.employee}`,next.company,next.client,v.reason,v.notes].filter(Boolean).join(' · ')};return {...data,devices:data.devices.map(x=>x.id===d.id?next:x),events:[event,...data.events]};}
