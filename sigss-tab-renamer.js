// SIGSS Tab Renamer - Funcionalidade para renomear abas do SIGSS
// Baseado no userscript "Sigss Title Replacer (Optimized)"

// Injection Guard: Previne a re-execução do script se ele já foi injetado nesta página.
(function () {
  if (window.sigssTabRenamerHasInjected) {
    return;
  }
  window.sigssTabRenamerHasInjected = true;

  // Define o objeto de API do navegador de forma compatível (Chrome ou Firefox)
  const browserAPI = (() => {
    if (typeof globalThis !== 'undefined' && globalThis.browser) return globalThis.browser;
    if (typeof globalThis !== 'undefined' && globalThis.chrome) return globalThis.chrome;
    if (typeof window !== 'undefined' && window.browser) return window.browser;
    if (typeof window !== 'undefined' && window.chrome) return window.chrome;
    throw new Error('Browser extension API not available');
  })();

  // Logger simplificado para content script
  const sigssLogger = {
    info: (...args) => console.info('[SIGSS Tab Renamer]', ...args),
    warn: (...args) => console.warn('[SIGSS Tab Renamer]', ...args),
    error: (...args) => console.error('[SIGSS Tab Renamer]', ...args),
    debug: (...args) => console.debug('[SIGSS Tab Renamer]', ...args)
  };

  // Verificação de robustez: Garante que as APIs da extensão estão disponíveis.
  if (!browserAPI || !browserAPI.runtime || !browserAPI.storage) {
    sigssLogger.error("Extensão não configurada corretamente. Reinstale a extensão.");
    return;
  }

  // Variáveis para controle do sistema de renomeação
  let previousTitle = '';
  let isEnabled = true; // Habilitado por padrão
  let observer = null;

  // Configuração do MutationObserver
  const observerConfig = {
    childList: true,
    subtree: true,
    characterData: true
  };

  /**
   * Verifica se a funcionalidade está habilitada nas configurações
   */
  async function checkIfEnabled() {
    try {
      const data = await browserAPI.storage.sync.get(['enableSigssTabRename']);
      // Se não existe a configuração, assume habilitado por padrão
      isEnabled = data.enableSigssTabRename !== false;
      sigssLogger.debug('Funcionalidade de renomear abas SIGSS:', isEnabled ? 'habilitada' : 'desabilitada');
      return isEnabled;
    } catch (error) {
      // Fallback para storage local se sync não estiver disponível
      try {
        const data = await browserAPI.storage.local.get(['enableSigssTabRename']);
        isEnabled = data.enableSigssTabRename !== false;
        sigssLogger.debug('Funcionalidade de renomear abas SIGSS (local):', isEnabled ? 'habilitada' : 'desabilitada');
        return isEnabled;
      } catch (localError) {
        sigssLogger.warn('Erro ao verificar configuração, mantendo habilitado por padrão:', localError);
        isEnabled = true;
        return isEnabled;
      }
    }
  }

  /**
   * Atualiza o título da aba com base no elemento .sigss-title
   */
  function updateTitle() {
    if (!isEnabled) {
      return;
    }

    // Procura pelo elemento que contém o título do SIGSS
    const titleElement = document.querySelector('.ui-widget-header.sigss-title');
    
    if (!titleElement) {
      return;
    }

    const newTitle = titleElement.textContent.trim();
    
    if (newTitle && newTitle !== previousTitle) {
      previousTitle = newTitle;
      document.title = newTitle;
      sigssLogger.debug('Título da aba atualizado para:', newTitle);
    }
  }

  /**
   * Execução segura da atualização do título
   */
  function safeUpdate() {
    try {
      updateTitle();
    } catch (error) {
      sigssLogger.warn('Erro na atualização do título:', error);
    }
  }

  /**
   * Inicia o sistema de observação de mudanças no DOM
   */
  function startObserver() {
    if (!isEnabled) {
      return;
    }

    // Para o observer anterior se existir
    if (observer) {
      observer.disconnect();
    }

    // Callback do MutationObserver com throttling
    const observerCallback = (mutations) => {
      if (!document.hidden && isEnabled) {
        window.requestAnimationFrame(safeUpdate);
      }
    };

    // Cria e inicia o novo observer
    observer = new MutationObserver(observerCallback);
    observer.observe(document.body, observerConfig);
    
    sigssLogger.info('MutationObserver iniciado para monitorar mudanças no título SIGSS');
  }

  /**
   * Para o sistema de observação
   */
  function stopObserver() {
    if (observer) {
      observer.disconnect();
      observer = null;
      sigssLogger.info('MutationObserver parado');
    }
  }

  /**
   * Listener para mudanças nas configurações
   */
  function setupStorageListener() {
    // Listener para mudanças no storage
    browserAPI.storage.onChanged.addListener((changes, namespace) => {
      if (changes.enableSigssTabRename) {
        const newValue = changes.enableSigssTabRename.newValue;
        const oldValue = changes.enableSigssTabRename.oldValue;
        
        sigssLogger.info('Configuração de renomear abas SIGSS alterada:', oldValue, '->', newValue);
        
        isEnabled = newValue !== false;
        
        if (isEnabled) {
          startObserver();
          safeUpdate(); // Atualiza imediatamente se habilitado
        } else {
          stopObserver();
          // Opcionalmente, restaura o título original
          // document.title = 'Título original'; // Seria necessário armazenar o título original
        }
      }
    });
  }

  /**
   * Verifica se a URL atual é uma página do SIGSS
   */
  function isSigssPage() {
    const url = window.location.href;
    // Verifica se contém 'sigss' na URL (case insensitive)
    return /sigss/i.test(url);
  }

  /**
   * Inicialização do sistema de renomeação de abas SIGSS
   */
  async function initializeSigssTabRenamer() {
    // Verifica se é uma página do SIGSS
    if (!isSigssPage()) {
      sigssLogger.debug('Não é uma página do SIGSS, funcionalidade não será ativada');
      return;
    }

    sigssLogger.info('Inicializando sistema de renomeação de abas SIGSS...');

    try {
      // Verifica se a funcionalidade está habilitada
      await checkIfEnabled();

      // Configura listener para mudanças nas configurações
      setupStorageListener();

      if (isEnabled) {
        // Execução inicial
        safeUpdate();

        // Inicia o observer após a verificação inicial
        startObserver();

        sigssLogger.info('Sistema de renomeação de abas SIGSS inicializado com sucesso');
      } else {
        sigssLogger.info('Sistema de renomeação de abas SIGSS desabilitado nas configurações');
      }

      // Cleanup quando a página é descarregada
      window.addEventListener('unload', () => {
        stopObserver();
      }, { once: true });

    } catch (error) {
      sigssLogger.error('Erro na inicialização do sistema de renomeação de abas SIGSS:', error);
    }
  }

  // Inicia o sistema quando o DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSigssTabRenamer);
  } else {
    // DOM já está pronto
    initializeSigssTabRenamer();
  }

})(); // Fecha o IIFE do injection guard