// ============================================================
// SUPABASE.JS — Conexão e Inicialização do Cliente Supabase
// ------------------------------------------------------------
// Este arquivo é o ponto único de conexão com o banco de dados
// e serviços de autenticação / storage do Supabase.
// ============================================================

// Importa a biblioteca oficial do Supabase via ESM
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Credenciais do projeto Supabase (URL e Chave Pública Anônima)
const SUPABASE_URL = 'https://aniarwsmrviezoqclqpx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFuaWFyd3NtcnZpZXpvcWNscXB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzNzM4ODYsImV4cCI6MjEwMTk0OTg4Nn0.E8OW8WDJRbWxVCTlLL5I19xCZpdVX9AViE3XA1xjrI4';

// Cria e exporta a instância do cliente para ser usada em todo o app
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,   // Renova automaticamente tokens expirados
    persistSession: true,      // Salva a sessão no localStorage para não deslogar ao recarregar
    detectSessionInUrl: true,  // Detecta tokens de recuperação de senha vindos por link de e-mail
  },
});
