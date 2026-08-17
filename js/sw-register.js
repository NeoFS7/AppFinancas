// ============================================================
// SW-REGISTER.JS — Registro e Ciclo de Vida do Service Worker
// ------------------------------------------------------------
// Registra o Service Worker ('sw.js') em navegadores com suporte
// e monitora atualizações de versão disponíveis.
// ============================================================

export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const registration = await navigator.serviceWorker.register('./sw.js', { scope: './' });
        console.log('[PWA] Service Worker registrado com sucesso:', registration.scope);

        // Ouve atualizações de versão do Service Worker
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[PWA] Nova versão disponível! O conteúdo será atualizado no próximo carregamento.');
              }
            });
          }
        });
      } catch (error) {
        console.error('[PWA] Falha ao registrar Service Worker:', error);
      }
    });
  } else {
    console.log('[PWA] Service Worker não é suportado neste navegador.');
  }
}

// Executa o registro imediatamente
registerServiceWorker();
