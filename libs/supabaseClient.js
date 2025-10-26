(function initializeSupabase() {
  if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
    console.warn('Supabase URL または anon key が設定されていません。config.js を確認してください。');
    return;
  }

  if (!window.supabase) {
    console.error('Supabase SDK が読み込まれていません。index.html のスクリプト読み込み順序を確認してください。');
    return;
  }

  window.supabaseClient = window.supabase.createClient(
    window.SUPABASE_URL,
    window.SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }
  );

  console.info('[keiba-ocr] Supabase client initialized.', { supabaseUrl: window.SUPABASE_URL });
})();
