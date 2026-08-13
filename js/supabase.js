// ============================================================
// CONFIGURAÇÃO DO SUPABASE
// ------------------------------------------------------------
// Substitui os valores abaixo pelas credenciais do meu projeto:
//   1. https://supabase.com → seu projeto → Settings → API
//   2. Copiei "Project URL" e "anon public" key
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://aniarwsmrviezoqclqpx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFuaWFyd3NtcnZpZXpvcWNscXB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzNzM4ODYsImV4cCI6MjEwMTk0OTg4Nn0.E8OW8WDJRbWxVCTlLL5I19xCZpdVX9AViE3XA1xjrI4';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
