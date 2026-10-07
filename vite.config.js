import {defineConfig,loadEnv} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({mode})=>{const env=loadEnv(mode,process.cwd(),'VITE_');return {plugins:[react()],server:{host:'0.0.0.0'},define:{'import.meta.env.VITE_SUPABASE_URL':JSON.stringify(process.env.VITE_SUPABASE_URL||env.VITE_SUPABASE_URL||process.env.SUPABASE_URL||''),'import.meta.env.VITE_SUPABASE_ANON_KEY':JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY||env.VITE_SUPABASE_ANON_KEY||process.env.SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_ANON_KEY||'')}}});
