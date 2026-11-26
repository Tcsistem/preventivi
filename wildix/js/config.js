// Configurazione Supabase del Preventivatore Wildix.
// Valori da Supabase > Project Settings > API (Project URL e chiave "anon public").
// La chiave "anon" è pubblica per definizione: i dati sono protetti dal login (RLS).
// Finché restano i segnaposto, il sito parte in MODALITÀ PROVA (dati solo nel browser).
window.WX_CONFIG = {
  SUPABASE_URL: "INCOLLA_QUI_PROJECT_URL",        // es. https://abcdefgh.supabase.co
  SUPABASE_ANON_KEY: "INCOLLA_QUI_ANON_PUBLIC_KEY"
};
