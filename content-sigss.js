// SIGSS Content Script - Funcionalidade de Renomear Abas do SIGSS
// Responsável exclusivamente pela funcionalidade de renomear abas do SIGSS

// Injection Guard: Previne a re-execução do script se ele já foi injetado nesta página.
(function () {
  if (window.sigssContentScriptHasInjected) {
    return;
  }
  window.sigssContentScriptHasInjected = true;

  // Define o objeto de API do navegador de forma compatível (Chrome ou Firefox)
  const browserAPI = (() => {
    if (typeof globalThis !== 'undefined' && globalThis.browser) return globalThis.browser;
    if (typeof globalThis !== 'undefined' && globalThis.chrome) return globalThis.chrome;
    if (typeof window !== 'undefined' && window.browser) return window.browser;
    if (typeof window !== 'undefined' && window.chrome) return window.chrome;
    throw new Error('Browser extension API not available');
  })();

  // Logger simplificado para content script
  // NOTA TÉCNICA: Este script utiliza um logger simplificado em vez do logger.js completo
  // devido a uma limitação na forma como os content scripts são injetados programaticamente,
  // o que impede o uso de módulos ES6 (import/export) diretamente.
  const sigssLogger = {
    info: (...args) => console.info('[SIGSS Content Script]', ...args),
    warn: (...args) => console.warn('[SIGSS Content Script]', ...args),
    error: (...args) => console.error('[SIGSS Content Script]', ...args),
    debug: (...args) => console.debug('[SIGSS Content Script]', ...args)
  };

  // Verificação de robustez: Garante que as APIs da extensão estão disponíveis.
  if (!browserAPI || !browserAPI.runtime || !browserAPI.storage) {
    sigssLogger.error("Extensão não configurada corretamente. Reinstale a extensão.");
    return;
  }

  // Variáveis para funcionalidade de renomear abas do SIGSS
  let sigssTabRenamerEnabled = true; // Habilitado por padrão
  let sigssTabRenamerPreviousTitle = '';
  let sigssTabRenamerObserver = null; // Variável global para rastreamento e cleanup adequado

  // Configuração do MutationObserver
  const observerConfig = {
    childList: true,
    subtree: true,
    characterData: true
  };

  // Lista explícita de domínios SIGSS válidos para detecção consistente
  const VALID_SIGSS_DOMAINS = [
    'c1863prd.cloudmv.com.br',
    'c1863tst1.cloudmv.com.br'
  ];

  /**
   * Verifica se a funcionalidade de renomear abas do SIGSS está habilitada
   */
  async function checkSigssTabRenamerEnabled() {
    try {
      const data = await browserAPI.storage.sync.get(['enableSigssTabRename']);
      sigssTabRenamerEnabled = data.enableSigssTabRename !== false;
      sigssLogger.debug('Funcionalidade de renomear abas SIGSS:', sigssTabRenamerEnabled ? 'habilitada' : 'desabilitada');
      return sigssTabRenamerEnabled;
    } catch (error) {
      try {
        const data = await browserAPI.storage.local.get(['enableSigssTabRename']);
        sigssTabRenamerEnabled = data.enableSigssTabRename !== false;
        sigssLogger.debug('Funcionalidade de renomear abas SIGSS (local):', sigssTabRenamerEnabled ? 'habilitada' : 'desabilitada');
        return sigssTabRenamerEnabled;
      } catch (localError) {
        sigssLogger.warn('Erro ao verificar configuração SIGSS Tab Renamer, mantendo habilitado por padrão:', localError);
        sigssTabRenamerEnabled = true;
        return sigssTabRenamerEnabled;
      }
    }
  }

  /**
   * Atualiza o título da aba com base no elemento .sigss-title
   */
  function updateSigssTabTitle() {
    if (!sigssTabRenamerEnabled) {
      return;
    }

    // Procura pelo elemento que contém o título do SIGSS
    const titleElement = document.querySelector('.ui-widget-header.sigss-title');
    
    if (!titleElement) {
      return;
    }

    const newTitle = titleElement.textContent.trim();
    
    if (newTitle && newTitle !== sigssTabRenamerPreviousTitle) {
      sigssTabRenamerPreviousTitle = newTitle;
      document.title = newTitle;
      sigssLogger.debug('Título da aba SIGSS atualizado para:', newTitle);
    }
  }

  /**
   * Execução segura da atualização do título SIGSS
   */
  function safeSigssTabUpdate() {
    try {
      updateSigssTabTitle();
    } catch (error) {
      sigssLogger.warn('Erro na atualização do título SIGSS:', error);
    }
  }

  /**
   * Inicia o sistema de observação para renomear abas do SIGSS
   */
  function startSigssTabRenamerObserver() {
    if (!sigssTabRenamerEnabled) {
      return;
    }

    // Desconecta observer anterior se existir (previne vazamentos de memória)
    if (sigssTabRenamerObserver) {
      sigssTabRenamerObserver.disconnect();
      sigssLogger.debug("MutationObserver SIGSS anterior desconectado.");
    }

    // Callback do MutationObserver para SIGSS com throttling
    const sigssObserverCallback = (mutations) => {
      if (!document.hidden && sigssTabRenamerEnabled) {
        window.requestAnimationFrame(safeSigssTabUpdate);
      }
    };

    // Cria e inicia o novo observer para SIGSS
    sigssTabRenamerObserver = new MutationObserver(sigssObserverCallback);
    sigssTabRenamerObserver.observe(document.body, observerConfig);
    
    sigssLogger.info('Observer SIGSS Tab Renamer iniciado');
  }

  /**
   * Para o sistema de observação do SIGSS Tab Renamer
   * Limpa recursos do MutationObserver para prevenir vazamentos de memória.
   */
  function stopSigssTabRenamerObserver() {
    if (sigssTabRenamerObserver) {
      sigssTabRenamerObserver.disconnect();
      sigssTabRenamerObserver = null;
      sigssLogger.info('Observer SIGSS Tab Renamer parado e limpo com sucesso');
    }
  }

  /**
   * Limpa completamente os recursos do SIGSS Tab Renamer para prevenir vazamentos de memória.
   * Deve ser chamado quando a página é descarregada ou o script é finalizado.
   */
  function cleanupSigssTabRenamer() {
    stopSigssTabRenamerObserver();
    sigssLogger.info('Cleanup completo do SIGSS Tab Renamer executado');
  }

  /**
   * Verifica se a URL atual é uma página do SIGSS válida
   * Usa validação consistente com lista explícita de domínios
   */
  function isSigssPage() {
    const url = window.location.href;
    
    if (!url) return false;
    
    try {
      const urlObj = new URL(url);
      return VALID_SIGSS_DOMAINS.includes(urlObj.hostname) && 
             urlObj.pathname.includes('/sigss/');
    } catch (error) {
      // URL inválida
      sigssLogger.warn('URL inválida detectada:', url);
      return false;
    }
  }

  /**
   * Inicializa a funcionalidade de renomear abas do SIGSS
   */
  async function initializeSigssTabRenamer() {
    if (!isSigssPage()) {
      sigssLogger.debug('Não é uma página do SIGSS, funcionalidade de renomear abas não será ativada');
      return;
    }

    sigssLogger.info('Inicializando sistema de renomeação de abas SIGSS...');

    try {
      await checkSigssTabRenamerEnabled();

      if (sigssTabRenamerEnabled) {
        // Execução inicial
        safeSigssTabUpdate();

        // Inicia o observer após a verificação inicial
        startSigssTabRenamerObserver();

        sigssLogger.info('Sistema de renomeação de abas SIGSS inicializado com sucesso');
      } else {
        sigssLogger.info('Sistema de renomeação de abas SIGSS desabilitado nas configurações');
      }
    } catch (error) {
      sigssLogger.error('Erro na inicialização do sistema de renomeação de abas SIGSS:', error);
    }
  }

  /**
   * Listener para mudanças nas configurações do SIGSS Tab Renamer
   */
  function setupStorageListener() {
    browserAPI.storage.onChanged.addListener((changes, namespace) => {
      if (changes.enableSigssTabRename) {
        const newValue = changes.enableSigssTabRename.newValue;
        const oldValue = changes.enableSigssTabRename.oldValue;
        
        sigssLogger.info('Configuração de renomear abas SIGSS alterada:', oldValue, '->', newValue);
        
        sigssTabRenamerEnabled = newValue !== false;
        
        if (sigssTabRenamerEnabled && isSigssPage()) {
          startSigssTabRenamerObserver();
          safeSigssTabUpdate();
        } else {
          stopSigssTabRenamerObserver();
        }
      }
    });
  }

  // --- Execução Inicial do SIGSS Content Script ---
  (async () => {
    sigssLogger.info("Inicializando SIGSS Content Script...");

    // Inicializa a funcionalidade de renomear abas do SIGSS
    await initializeSigssTabRenamer();

    // Configura listener para mudanças nas configurações
    setupStorageListener();

    // Adiciona listeners para cleanup quando a página é descarregada (previne vazamentos de memória)
    window.addEventListener('beforeunload', () => {
      sigssLogger.info("Página SIGSS sendo descarregada. Executando cleanup do MutationObserver...");
      cleanupSigssTabRenamer();
    });

    // Adiciona listener para visibilitychange como backup para cleanup
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        sigssLogger.debug("Página SIGSS ficou oculta. Executando cleanup preventivo...");
        cleanupSigssTabRenamer();
      } else if (document.visibilityState === 'visible') {
        // Reconfigura o observer quando a página volta a ficar visível
        sigssLogger.debug("Página SIGSS ficou visível. Reconfigurando MutationObserver...");
        if (sigssTabRenamerEnabled && isSigssPage()) {
          startSigssTabRenamerObserver();
          safeSigssTabUpdate();
        }
      }
    });

    // Cleanup quando a página é descarregada (mantido como fallback)
    window.addEventListener('unload', () => {
      cleanupSigssTabRenamer();
    }, { once: true });

    sigssLogger.info("SIGSS Content Script inicializado com sucesso");
  })();

})(); // Fecha o IIFE do injection guard