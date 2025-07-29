// URLs do SAU
const SAU_LOGIN_URL = "https://egov.santos.sp.gov.br/sau/entrar.sau";
const SAU_HOME_URL = "https://egov.santos.sp.gov.br/sau/menu/home.sau";
const SAU_TASK_SEARCH_URL =
  "https://egov.santos.sp.gov.br/sau/ajax/pesquisar_Tarefa.sau";
const SAU_PREPARAR_PESQUISAR_TAREFA_URL =
  "https://egov.santos.sp.gov.br/sau/comum/prepararPesquisar_Tarefa.sau";

// Importa o logger e o instancia para o contexto do background script
import { logger } from "./logger.js";
const backgroundLogger = logger('[Background]');

// Importa o config manager para sincronização de configurações
import { migrateToSync } from "./config-manager.js";
// Importa o validador de storage para verificação de limites
import { safeStorageSet, validateStorageOperation, getStorageStats } from "./storage-validator.js";
// Importa o sistema de compressão de dados
import { compressData, decompressData, migrateExistingData, isCompressedFormat, getCompressionStats } from "./data-compressor.js";
// Lista explícita de domínios SIGSS válidos para detecção consistente
const VALID_SIGSS_DOMAINS = [
  'c1863prd.cloudmv.com.br',
  'c1863tst1.cloudmv.com.br'
];

/**
 * Verifica se uma URL é de uma página SIGSS válida
 * @param {string} url - URL a ser verificada
 * @returns {boolean} - True se for uma URL SIGSS válida
 */
function isValidSigssUrl(url) {
  if (!url) return false;
  
  try {
    const urlObj = new URL(url);
    return VALID_SIGSS_DOMAINS.includes(urlObj.hostname) && 
           urlObj.pathname.includes('/sigss/');
  } catch (error) {
    // URL inválida
    return false;
  }
}

/**
 * Determina qual content script usar baseado na URL da aba
 * @param {number} tabId - ID da aba
 * @returns {Promise<string>} - Nome do arquivo do content script
 */
async function getContentScriptForTab(tabId) {
  try {
    const tab = await browserAPI.tabs.get(tabId);
    const url = tab.url || '';
    
    // Verifica se é uma página do SIGSS usando lista explícita de domínios
    if (isValidSigssUrl(url)) {
      return 'content-sigss.js';
    }
    
    // Padrão: páginas do SAU
    return 'content.js';
  } catch (error) {
    backgroundLogger.warn(`Erro ao determinar content script para aba ${tabId}:`, error);
    return 'content.js'; // Fallback para SAU
  }
}

// Define o objeto de API do navegador de forma compatível (Chrome ou Firefox)
const browserAPI = (() => {
  // Em Service Workers, 'self' é o escopo global.
  // 'self.browser' é para Firefox, 'self.chrome' é para Chrome/Edge.
  if (typeof self !== "undefined" && self.browser) return self.browser;
  if (typeof self !== "undefined" && self.chrome) return self.chrome;
  throw new Error("Browser extension API not available");
})();

// Variáveis globais para armazenar o estado da extensão.
// Serão persistidas no chrome.storage.local.
let lastKnownTasks = []; // Armazena as últimas tarefas conhecidas por ID
let ignoredTasks = {}; // { taskId: true } - Tarefas que o usuário escolheu ignorar
let snoozedTasks = {}; // { taskId: timestampWhenToNotifyAgain } - Tarefas "lembradas mais tarde"
let openedTasks = {}; // { taskId: true } - Tarefas que o usuário abriu e não devem mais ser notificadas
let lastCheckTimestamp = 0; // Último timestamp da verificação de tarefas
let taskNotificationTimestamps = {}; // { taskId: lastNotificationTimestamp } - Controla renotificações
let lastLoginTabOpenedTimestamp = 0; // Timestamp da última vez que uma aba de login foi aberta
let loginTabId = null; // ID da aba de login atualmente aberta (se houver)

// Rate limiting para notificações
let lastNotificationTime = 0;
const NOTIFICATION_COOLDOWN = 15000; // 15 segundos entre notificações

/**
 * Carrega os dados persistentes do armazenamento local do Chrome.
 * Isso garante que o estado da extensão seja mantido entre as sessões do navegador.
 * Agora com suporte a descompressão de dados para otimização de storage.
 */
async function loadPersistentData() {
  try {
    const data = await browserAPI.storage.local.get([
      "lastKnownTasks",
      "ignoredTasks",
      "snoozedTasks",
      "openedTasks",
      "lastCheckTimestamp",
      "taskNotificationTimestamps",
    ]);

    // Descomprime dados se necessário
    const decompressedLastKnownTasks = isCompressedFormat(data.lastKnownTasks) 
      ? decompressData(data.lastKnownTasks) 
      : data.lastKnownTasks || [];
    
    const decompressedIgnoredTasks = isCompressedFormat(data.ignoredTasks)
      ? decompressData(data.ignoredTasks)
      : data.ignoredTasks || {};
    
    const decompressedSnoozedTasks = isCompressedFormat(data.snoozedTasks)
      ? decompressData(data.snoozedTasks)
      : data.snoozedTasks || {};
    
    const decompressedOpenedTasks = isCompressedFormat(data.openedTasks)
      ? decompressData(data.openedTasks)
      : data.openedTasks || {};
    
    const decompressedTaskNotificationTimestamps = isCompressedFormat(data.taskNotificationTimestamps)
      ? decompressData(data.taskNotificationTimestamps)
      : data.taskNotificationTimestamps || {};

    // Atribui dados descomprimidos às variáveis globais
    lastKnownTasks = decompressedLastKnownTasks;
    ignoredTasks = decompressedIgnoredTasks;
    snoozedTasks = decompressedSnoozedTasks;
    openedTasks = decompressedOpenedTasks;
    lastCheckTimestamp = data.lastCheckTimestamp || 0;
    taskNotificationTimestamps = decompressedTaskNotificationTimestamps;

    // Log estatísticas de compressão se dados estavam comprimidos
    let compressionStats = {};
    if (isCompressedFormat(data.lastKnownTasks)) {
      compressionStats.lastKnownTasks = getCompressionStats(data.lastKnownTasks);
    }
    if (isCompressedFormat(data.ignoredTasks)) {
      compressionStats.ignoredTasks = getCompressionStats(data.ignoredTasks);
    }

    backgroundLogger.info("Dados persistentes carregados:", {
      lastKnownTasks: lastKnownTasks.length,
      ignoredTasks: Object.keys(ignoredTasks).length,
      snoozedTasks: Object.keys(snoozedTasks).length,
      openedTasks: Object.keys(openedTasks).length,
      taskNotificationTimestamps: Object.keys(taskNotificationTimestamps).length,
      lastCheckTimestamp,
      compressionUsed: Object.keys(compressionStats).length > 0,
      compressionStats: Object.keys(compressionStats).length > 0 ? compressionStats : undefined
    });

    backgroundLogger.debug("Conteúdo de lastKnownTasks:", lastKnownTasks);

    // Migra dados existentes para formato comprimido se necessário
    if (!isCompressedFormat(data.lastKnownTasks) && lastKnownTasks.length > 0) {
      backgroundLogger.info("Detectados dados não comprimidos. Iniciando migração...");
      await savePersistentData(); // Isso salvará os dados no formato comprimido
    }

  } catch (error) {
    backgroundLogger.error("Erro ao carregar dados persistentes:", error);
  }
}

/**
 * Atualiza o contador (badge) no ícone da extensão.
 * Exibe o número de tarefas pendentes (não ignoradas, "snoozed" ou abertas).
 */
function updateBadge() {
  const pendingTasksCount = lastKnownTasks.filter(
    (task) =>
      !ignoredTasks[task.id] &&
      !openedTasks[task.id] && // Filtra tarefas abertas
      (!snoozedTasks[task.id] || snoozedTasks[task.id] <= Date.now())
  ).length;

  browserAPI.action.setBadgeBackgroundColor({ color: "#e74c3c" }); // Cor vermelha para o fundo

  if (pendingTasksCount > 0) {
    browserAPI.action.setBadgeText({ text: String(pendingTasksCount) });
  } else {
    browserAPI.action.setBadgeText({ text: "" }); // Limpa o badge se não houver tarefas
  }
  backgroundLogger.debug(`Badge atualizado para: ${pendingTasksCount}`);
}

/**
 * Salva o estado atual das variáveis globais no armazenamento local do Chrome.
 * Agora com compressão de dados e validação de tamanho para otimizar uso de storage.
 */
async function savePersistentData() {
  try {
    // Comprime dados grandes antes de salvar
    const compressedLastKnownTasks = compressData(lastKnownTasks);
    const compressedIgnoredTasks = compressData(ignoredTasks);
    const compressedSnoozedTasks = compressData(snoozedTasks);
    const compressedOpenedTasks = compressData(openedTasks);
    const compressedTaskNotificationTimestamps = compressData(taskNotificationTimestamps);

    const dataToSave = {
      lastKnownTasks: compressedLastKnownTasks,
      ignoredTasks: compressedIgnoredTasks,
      snoozedTasks: compressedSnoozedTasks,
      openedTasks: compressedOpenedTasks,
      lastCheckTimestamp: lastCheckTimestamp, // Não comprime timestamps simples
      taskNotificationTimestamps: compressedTaskNotificationTimestamps,
    };

    // Log estatísticas de compressão
    const compressionStats = {
      lastKnownTasks: getCompressionStats(compressedLastKnownTasks),
      ignoredTasks: getCompressionStats(compressedIgnoredTasks),
      snoozedTasks: getCompressionStats(compressedSnoozedTasks),
      openedTasks: getCompressionStats(compressedOpenedTasks),
      taskNotificationTimestamps: getCompressionStats(compressedTaskNotificationTimestamps)
    };

    const totalOriginalSize = Object.values(compressionStats).reduce((sum, stat) => sum + stat.originalSize, 0);
    const totalCompressedSize = Object.values(compressionStats).reduce((sum, stat) => sum + stat.compressedSize, 0);
    const overallCompressionRatio = totalOriginalSize > 0 ? totalOriginalSize / totalCompressedSize : 1;

    backgroundLogger.debug("Estatísticas de compressão:", {
      totalOriginalSize: `${Math.round(totalOriginalSize / 1024)}KB`,
      totalCompressedSize: `${Math.round(totalCompressedSize / 1024)}KB`,
      overallCompressionRatio: overallCompressionRatio.toFixed(2),
      spaceSaved: `${Math.round((totalOriginalSize - totalCompressedSize) / 1024)}KB`,
      compressionUsed: Object.values(compressionStats).some(stat => stat.compressed)
    });

    // Usa o storage validator para verificar limites antes de salvar
    const result = await safeStorageSet('local', dataToSave);
    
    if (result.success) {
      backgroundLogger.info("Dados persistentes salvos com compressão e validação de tamanho.");
      
      // Log estatísticas de uso se em modo debug
      if (result.validation) {
        const { newDataSize, estimatedNewSize, limits } = result.validation;
        const usagePercent = ((estimatedNewSize / limits.totalBytes) * 100).toFixed(1);
        backgroundLogger.debug(`Storage usage: ${usagePercent}% (${Math.round(estimatedNewSize / 1024)}KB / ${Math.round(limits.totalBytes / 1024)}KB)`);
      }
    } else {
      backgroundLogger.error("Falha na validação de storage:", result.error);
      
      // Tenta limpeza automática se o problema for de tamanho
      if (result.error.includes('Tamanho total excederia limite')) {
        backgroundLogger.warn("Tentando limpeza automática de dados antigos...");
        
        // Remove tarefas muito antigas (mais de 30 dias)
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        const originalTaskCount = lastKnownTasks.length;
        
        lastKnownTasks = lastKnownTasks.filter(task => {
          const taskTimestamp = task.lastNotifiedTimestamp || 0;
          return taskTimestamp > thirtyDaysAgo;
        });
        
        // Remove entradas antigas de timestamps de notificação
        const validTaskIds = new Set(lastKnownTasks.map(task => task.id));
        for (const taskId in taskNotificationTimestamps) {
          if (!validTaskIds.has(taskId)) {
            delete taskNotificationTimestamps[taskId];
          }
        }
        
        // Remove entradas antigas de tarefas ignoradas/snoozed/abertas
        for (const taskId in ignoredTasks) {
          if (!validTaskIds.has(taskId)) {
            delete ignoredTasks[taskId];
          }
        }
        for (const taskId in snoozedTasks) {
          if (!validTaskIds.has(taskId)) {
            delete snoozedTasks[taskId];
          }
        }
        for (const taskId in openedTasks) {
          if (!validTaskIds.has(taskId)) {
            delete openedTasks[taskId];
          }
        }
        
        const cleanedTaskCount = lastKnownTasks.length;
        backgroundLogger.info(`Limpeza automática concluída: ${originalTaskCount - cleanedTaskCount} tarefas antigas removidas`);
        
        // Tenta salvar novamente após limpeza com compressão
        const cleanedCompressedData = {
          lastKnownTasks: compressData(lastKnownTasks),
          ignoredTasks: compressData(ignoredTasks),
          snoozedTasks: compressData(snoozedTasks),
          openedTasks: compressData(openedTasks),
          lastCheckTimestamp: lastCheckTimestamp,
          taskNotificationTimestamps: compressData(taskNotificationTimestamps),
        };
        
        const retryResult = await safeStorageSet('local', cleanedCompressedData);
        if (retryResult.success) {
          backgroundLogger.info("Dados persistentes salvos após limpeza automática com compressão.");
        } else {
          // Fallback: salva dados limpos sem compressão como último recurso
          backgroundLogger.error("Falha mesmo após limpeza. Salvando dados limpos sem compressão:", retryResult.error);
          const fallbackData = {
            lastKnownTasks: lastKnownTasks,
            ignoredTasks: ignoredTasks,
            snoozedTasks: snoozedTasks,
            openedTasks: openedTasks,
            lastCheckTimestamp: lastCheckTimestamp,
            taskNotificationTimestamps: taskNotificationTimestamps,
          };
          await browserAPI.storage.local.set(fallbackData);
        }
      } else {
        // Para outros tipos de erro, tenta salvar sem compressão
        backgroundLogger.warn("Salvando dados sem compressão devido a erro não relacionado a tamanho");
        const fallbackData = {
          lastKnownTasks: lastKnownTasks,
          ignoredTasks: ignoredTasks,
          snoozedTasks: snoozedTasks,
          openedTasks: openedTasks,
          lastCheckTimestamp: lastCheckTimestamp,
          taskNotificationTimestamps: taskNotificationTimestamps,
        };
        await browserAPI.storage.local.set(fallbackData);
      }
    }
  } catch (error) {
    backgroundLogger.error("Erro ao salvar dados persistentes:", error);
    
    // Fallback final: tenta salvar diretamente sem compressão
    try {
      await browserAPI.storage.local.set({
        lastKnownTasks: lastKnownTasks,
        ignoredTasks: ignoredTasks,
        snoozedTasks: snoozedTasks,
        openedTasks: openedTasks,
        lastCheckTimestamp: lastCheckTimestamp,
        taskNotificationTimestamps: taskNotificationTimestamps,
      });
      backgroundLogger.warn("Dados salvos usando fallback direto sem compressão");
    } catch (fallbackError) {
      backgroundLogger.error("Falha crítica ao salvar dados:", fallbackError);
    }
  }
}

/**
 * Verifica se uma tarefa deve ser renotificada baseado nas configurações de renotificação.
 * @param {string} taskId - ID da tarefa a ser verificada
 * @returns {Promise<boolean>} - True se deve renotificar, false caso contrário
 */
async function checkIfShouldRenotify(taskId) {
  try {
    const settings = await browserAPI.storage.local.get([
      "enableRenotification",
      "renotificationInterval",
    ]);

    const enableRenotification = settings.enableRenotification || false;
    const renotificationInterval = settings.renotificationInterval || 30; // padrão 30 minutos

    // Se renotificação está desabilitada, não renotifica
    if (!enableRenotification) {
      return false;
    }

    const lastNotificationTime = taskNotificationTimestamps[taskId];

    // Se nunca foi notificada, não renotifica (só notifica tarefas novas)
    if (!lastNotificationTime) {
      return false;
    }

    const now = Date.now();
    const timeSinceLastNotification = now - lastNotificationTime;
    const renotificationIntervalMs = renotificationInterval * 60 * 1000; // converte para ms

    // Renotifica se passou o tempo configurado desde a última notificação
    const shouldRenotify =
      timeSinceLastNotification >= renotificationIntervalMs;

    backgroundLogger.debug(
      `Verificação de renotificação para tarefa ${taskId}: ` +
        `enableRenotification=${enableRenotification}, ` +
        `timeSinceLastNotification=${Math.round(
          timeSinceLastNotification / 60000
        )}min, ` +
        `renotificationInterval=${renotificationInterval}min, ` +
        `shouldRenotify=${shouldRenotify}`
    );

    return shouldRenotify;
  } catch (error) {
    backgroundLogger.error("Erro ao verificar renotificação:", error);
    return false;
  }
}

/**
 * Agenda a próxima verificação de tarefas usando a API de alarmes do Chrome.
 * @param {number} intervalInSeconds - O intervalo em segundos para a verificação.
 */
async function scheduleNextCheck(intervalInSeconds) {
  // Limpa qualquer alarme existente para evitar duplicações
  browserAPI.alarms.clear("checkTasks");
  // Cria um novo alarme com o período especificado (convertido para minutos)
  browserAPI.alarms.create("checkTasks", {
    periodInMinutes: intervalInSeconds / 60,
  });
  backgroundLogger.info(
    `Próxima verificação agendada para daqui a ${intervalInSeconds} segundos.`
  );
}

/**
 * Listener para quando um alarme é disparado.
 * Se for o alarme 'checkTasks', inicia o processo de verificação de tarefas.
 */
browserAPI.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "checkTasks") {
    backgroundLogger.info(
      'Alarme "checkTasks" disparado. Verificando tarefas...'
    );
    await checkAndNotifyNewTasks();
  }
});

/**
 * Listener para mensagens recebidas de outras partes da extensão (popup, content script, options page).
 * Gerencia ações como atualizar o alarme, iniciar verificação manual,
 * obter últimas tarefas, ignorar/snooze tarefas, lidar com novas tarefas encontradas e obter logs.
 */
browserAPI.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  backgroundLogger.debug("Mensagem recebida no background:", request);

  switch (request.action) {
    case "updateAlarm":
      // Recarrega os dados e agenda o alarme com o novo intervalo
      loadPersistentData().then(() => {
        browserAPI.storage.local.get("checkInterval").then((data) => {
          const interval = data.checkInterval || 30; // Padrão: 30 segundos
          scheduleNextCheck(interval);
        });
      });
      break;
    case "manualCheck":
      // Inicia uma verificação manual de tarefas
      backgroundLogger.info("Verificação manual solicitada.");
      checkAndNotifyNewTasks();
      break;
    case "getLatestTasks": {
      // Responde imediatamente com os dados em memória para evitar fechamento do port
      try {
        const currentPendingTasks = lastKnownTasks.filter(
          (task) =>
            !ignoredTasks[task.id] &&
            !openedTasks[task.id] &&
            (!snoozedTasks[task.id] || snoozedTasks[task.id] <= Date.now())
        );
        backgroundLogger.debug(
          "Retornando últimas tarefas para popup:",
          currentPendingTasks.length,
          currentPendingTasks
        );
        sendResponse({
          newTasks: currentPendingTasks || [],
          message: `Última verificação: ${new Date(
            lastCheckTimestamp
          ).toLocaleTimeString()}`,
          lastCheck: lastCheckTimestamp,
        });
      } catch (error) {
        backgroundLogger.error("Erro ao processar getLatestTasks:", error);
        sendResponse({
          newTasks: [],
          message: "Erro ao carregar tarefas",
          lastCheck: lastCheckTimestamp,
          error: error.message
        });
      }
      return false; // Resposta síncrona, não precisa manter o port aberto
    }
    case "ignoreTask":
      // Marca uma tarefa como ignorada e salva o estado
      ignoredTasks[request.taskId] = true;
      // Remove de openedTasks e snoozedTasks se estiver lá
      delete openedTasks[request.taskId];
      delete snoozedTasks[request.taskId];
      savePersistentData();
      updateBadge(); // Atualiza o contador no ícone
      backgroundLogger.info(`Tarefa ${request.taskId} ignorada.`);
      // Notifica o popup para atualizar sua lista
      try {
        browserAPI.runtime.sendMessage({
          action: "updatePopup",
          newTasks: lastKnownTasks.filter(
            (task) =>
              !ignoredTasks[task.id] &&
              !openedTasks[task.id] && // Filtra tarefas abertas
              (!snoozedTasks[task.id] || snoozedTasks[task.id] <= Date.now())
          ),
        });
      } catch (error) {
        backgroundLogger.debug(
          "Popup não está aberto para receber atualização:",
          error.message
        );
      }
      break;
    case "snoozeTask":
      // Marca uma tarefa para ser lembrada mais tarde e salva o estado
      browserAPI.storage.local.get("snoozeTime").then((data) => {
        const snoozeMinutes = request.snoozeMinutes || 15;
        snoozedTasks[request.taskId] = Date.now() + snoozeMinutes * 60 * 1000;
        // Remove de openedTasks e ignoredTasks se estiver lá
        delete openedTasks[request.taskId];
        delete ignoredTasks[request.taskId];
        savePersistentData();
        updateBadge(); // Atualiza o contador no ícone
        backgroundLogger.info(
          `Tarefa ${request.taskId} snoozed por ${snoozeMinutes} minutos.`
        );
        // Notifica o popup para atualizar sua lista
        try {
          browserAPI.runtime.sendMessage({
            action: "updatePopup",
            newTasks: lastKnownTasks.filter(
              (task) =>
                !ignoredTasks[task.id] &&
                !openedTasks[task.id] && // Filtra tarefas abertas
                (!snoozedTasks[task.id] || snoozedTasks[task.id] <= Date.now())
            ),
          });
        } catch (error) {
          backgroundLogger.debug(
            "Popup não está aberto para receber atualização:",
            error.message
          );
        }
      });
      break;
    case "markTaskAsOpened": // NOVO CASE: Marcar tarefa como aberta
      openedTasks[request.taskId] = true;
      // Remove de ignoredTasks e snoozedTasks se estiver lá
      delete ignoredTasks[request.taskId];
      delete snoozedTasks[request.taskId];
      savePersistentData();
      updateBadge();
      backgroundLogger.info(`Tarefa ${request.taskId} marcada como aberta.`);
      // Notifica o popup para atualizar sua lista
      try {
        browserAPI.runtime.sendMessage({
          action: "updatePopup",
          newTasks: lastKnownTasks.filter(
            (task) =>
              !ignoredTasks[task.id] &&
              !openedTasks[task.id] && // Filtra tarefas abertas
              (!snoozedTasks[task.id] || snoozedTasks[task.id] <= Date.now())
          ),
        });
      } catch (error) {
        backgroundLogger.debug(
          "Popup não está aberto para receber atualização:",
          error.message
        );
      }
      break;
    case "newTasksFound":
      // Lida com as novas tarefas encontradas pelo content script
      backgroundLogger.debug(
        "Mensagem 'newTasksFound' recebida. Tarefas:",
        request.tasks
      );
      handleNewTasks(request.tasks);
      break;
    case "openTab":
      // Abre uma nova aba com a URL fornecida (não marca como aberta aqui, pois o clique do botão já fará isso)
      browserAPI.tabs.create({ url: request.url });
      backgroundLogger.info(`Abrindo nova aba: ${request.url}`);
      break;
    case "getLogs": // NOVO CASE PARA OBTER LOGS
      backgroundLogger.info(
        "Solicitação de logs recebida da página de opções."
      );
      sendResponse({ logs: backgroundLogger.getStoredLogs() });
      return true; // Indica que a resposta será enviada de forma síncrona
    case "resetTaskMemory": // NOVO CASE PARA RESETAR A MEMÓRIA
      backgroundLogger.warn("Resetando a memória de tarefas por solicitação.");
      lastKnownTasks = [];
      ignoredTasks = {};
      snoozedTasks = {};
      openedTasks = {}; // Reseta o novo estado também
      taskNotificationTimestamps = {}; // Reseta timestamps de notificação
      savePersistentData(); // Salva o estado limpo
      updateBadge(); // Limpa o contador no ícone
      sendResponse({ status: "Memória de tarefas resetada com sucesso." });
      // Força uma nova verificação para repopular a lista se a página estiver aberta
      checkAndNotifyNewTasks();
      return true; // Indica que a resposta será enviada de forma síncrona
    case "getStorageStats": // NOVO CASE PARA OBTER ESTATÍSTICAS DE STORAGE
      backgroundLogger.info("Solicitação de estatísticas de storage recebida.");
      getStorageStats().then((stats) => {
        sendResponse({ stats });
      }).catch((error) => {
        backgroundLogger.error("Erro ao obter estatísticas de storage:", error);
        sendResponse({ error: error.message });
      });
      return true; // Indica que a resposta será enviada de forma assíncrona
    case "getCompressionStats": // NOVO CASE PARA OBTER ESTATÍSTICAS DE COMPRESSÃO
      backgroundLogger.info("Solicitação de estatísticas de compressão recebida.");
      try {
        // Obtém dados atuais do storage para calcular estatísticas
        const data = await browserAPI.storage.local.get([
          "lastKnownTasks",
          "ignoredTasks", 
          "snoozedTasks",
          "openedTasks",
          "taskNotificationTimestamps"
        ]);
        
        const compressionStats = {
          lastKnownTasks: isCompressedFormat(data.lastKnownTasks) ? getCompressionStats(data.lastKnownTasks) : { compressed: false },
          ignoredTasks: isCompressedFormat(data.ignoredTasks) ? getCompressionStats(data.ignoredTasks) : { compressed: false },
          snoozedTasks: isCompressedFormat(data.snoozedTasks) ? getCompressionStats(data.snoozedTasks) : { compressed: false },
          openedTasks: isCompressedFormat(data.openedTasks) ? getCompressionStats(data.openedTasks) : { compressed: false },
          taskNotificationTimestamps: isCompressedFormat(data.taskNotificationTimestamps) ? getCompressionStats(data.taskNotificationTimestamps) : { compressed: false }
        };
        
        const totalOriginalSize = Object.values(compressionStats).reduce((sum, stat) => sum + (stat.originalSize || 0), 0);
        const totalCompressedSize = Object.values(compressionStats).reduce((sum, stat) => sum + (stat.compressedSize || 0), 0);
        const overallCompressionRatio = totalOriginalSize > 0 ? totalOriginalSize / totalCompressedSize : 1;
        
        sendResponse({
          compressionStats,
          summary: {
            totalOriginalSize,
            totalCompressedSize,
            overallCompressionRatio,
            spaceSaved: totalOriginalSize - totalCompressedSize,
            compressionEnabled: Object.values(compressionStats).some(stat => stat.compressed)
          }
        });
      } catch (error) {
        backgroundLogger.error("Erro ao obter estatísticas de compressão:", error);
        sendResponse({ error: error.message });
      }
      return true; // Indica que a resposta será enviada de forma assíncrona
  }
});

/**
 * Timeout para operações de injeção de script (30 segundos)
 * Aumentado para melhor compatibilidade com conexões lentas
 */
const SCRIPT_INJECTION_TIMEOUT = 30000;

/**
 * Verifica se uma aba está responsiva tentando enviar uma mensagem simples
 * @param {number} tabId - ID da aba a ser verificada
 * @returns {Promise<boolean>} - True se a aba está responsiva
 */
async function isTabResponsive(tabId) {
  try {
    // Tenta enviar uma mensagem de ping para a aba com timeout
    const response = await Promise.race([
      browserAPI.tabs.sendMessage(tabId, { action: "ping" }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Tab ping timeout")), 3000)
      ),
    ]);
    return true;
  } catch (error) {
    backgroundLogger.debug(
      `Aba ${tabId} não está responsiva: ${error.message}`
    );
    return false;
  }
}

/**
 * Injeta scripts com timeout e verificação de responsividade
 * @param {number} tabId - ID da aba onde injetar os scripts
 * @returns {Promise<boolean>} - True se a injeção foi bem-sucedida
 */
async function injectScriptsWithTimeout(tabId) {
  try {
    // Verifica se a aba ainda existe
    await browserAPI.tabs.get(tabId);

    // Injeta scripts com timeout
    await Promise.race([
      Promise.all([
        // Injeta o content script principal no contexto ISOLADO (padrão)
        browserAPI.scripting.executeScript({
          target: { tabId },
          files: [await getContentScriptForTab(tabId)],
        }),
        // Injeta o script interceptor no contexto da PÁGINA (MAIN)
        browserAPI.scripting.executeScript({
          target: { tabId },
          files: ["interceptor.js"],
          world: "MAIN",
          injectImmediately: true,
        }),
      ]),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Script injection timeout")),
          SCRIPT_INJECTION_TIMEOUT
        )
      ),
    ]);

    backgroundLogger.info(
      `Content scripts injetados com sucesso na aba ${tabId}.`
    );
    return true;
  } catch (error) {
    if (error.message === "Script injection timeout") {
      backgroundLogger.warn(
        `Timeout ao injetar scripts na aba ${tabId} - aba pode estar travada`
      );
    } else if (error.message.includes("No tab with id")) {
      backgroundLogger.debug(`Aba ${tabId} foi fechada durante a injeção`);
    } else {
      backgroundLogger.error(`Erro ao injetar scripts na aba ${tabId}:`, error);
    }
    return false;
  }
}

/**
 * Função principal para verificar novas tarefas e notificar o usuário.
 * Tenta encontrar uma aba do SAU logada, caso contrário, tenta o login automático.
 */
async function checkAndNotifyNewTasks() {
  backgroundLogger.info("Iniciando verificação de tarefas...");
  lastCheckTimestamp = Date.now(); // Atualiza o timestamp da última verificação
  await savePersistentData(); // Salva o timestamp imediatamente

  // Consulta todas as abas para encontrar uma do SAU
  const tabs = await browserAPI.tabs.query({
    url: "https://egov.santos.sp.gov.br/sau/*",
  });
  let sauTab = null;

  // Procura por uma aba do SAU que esteja na home ou na página de consulta de tarefas
  for (let tab of tabs) {
    if (
      tab.url.startsWith(SAU_HOME_URL) ||
      tab.url.startsWith(SAU_PREPARAR_PESQUISAR_TAREFA_URL)
    ) {
      sauTab = tab;
      backgroundLogger.debug(`Aba SAU encontrada: ${tab.url}`);
      break;
    }
  }

  // Se uma aba do SAU logada for encontrada
  if (sauTab) {
    // Verifica se a aba está responsiva antes de tentar operações
    const isResponsive = await isTabResponsive(sauTab.id);

    if (!isResponsive) {
      backgroundLogger.warn(
        `Aba SAU ${sauTab.id} não está responsiva. Tentando recarregar...`
      );

      try {
        await Promise.race([
          browserAPI.tabs.reload(sauTab.id),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Reload timeout")), 5000)
          ),
        ]);
        backgroundLogger.info(`Aba ${sauTab.id} recarregada com sucesso`);
        return; // Sai da função, o webNavigation.onCompleted fará a injeção
      } catch (error) {
        backgroundLogger.error(
          `Erro ao recarregar aba não responsiva ${sauTab.id}:`,
          error
        );
        // Se não conseguir recarregar, tenta login automático
        await performAutomaticLogin();
        return;
      }
    }

    // Se a aba encontrada for a página de pesquisa de tarefas, recarrega-a para garantir dados atualizados.
    // Isso também acionará a reinjeção do content script via webNavigation.onCompleted.
    if (sauTab.url.startsWith(SAU_PREPARAR_PESQUISAR_TAREFA_URL)) {
      backgroundLogger.info(`Recarregando aba de tarefas SAU: ${sauTab.url}`);
      try {
        await Promise.race([
          browserAPI.tabs.reload(sauTab.id),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Reload timeout")), 5000)
          ),
        ]);
        // Não precisamos injetar scripts aqui, pois o webNavigation.onCompleted Listener fará isso após o reload.
        return; // Sai da função, pois o reload vai disparar um novo ciclo de injeção.
      } catch (error) {
        backgroundLogger.error(`Erro ao recarregar aba ${sauTab.id}:`, error);
        // Se o reload falhar, tenta injetar os scripts como fallback.
        // Isso pode acontecer se a aba foi fechada ou ficou inacessível.
      }
    }

    // Se a aba não for a de pesquisa de tarefas (ex: home) ou o reload falhou,
    // ou se a aba foi recém-criada/navegada para, injeta os scripts.
    const injectionSuccess = await injectScriptsWithTimeout(sauTab.id);

    if (!injectionSuccess) {
      backgroundLogger.warn(
        "Falha na injeção de scripts. Tentando login automático como fallback."
      );
      await performAutomaticLogin();
    }
  } else {
    backgroundLogger.info(
      "Nenhuma aba do SAU logada encontrada. Tentando login automático..."
    );
    await performAutomaticLogin();
  }
}

/**
 * Verifica se já existe uma aba de login do SAU aberta
 * @returns {Promise<boolean>} - True se existe uma aba de login aberta
 */
async function checkForExistingLoginTab() {
  try {
    const tabs = await browserAPI.tabs.query({
      url: SAU_LOGIN_URL + "*",
    });

    // Verifica se alguma das abas encontradas ainda está válida
    for (const tab of tabs) {
      try {
        // Tenta acessar a aba para verificar se ainda existe
        await browserAPI.tabs.get(tab.id);
        backgroundLogger.debug(`Aba de login existente encontrada: ${tab.id}`);
        return true;
      } catch (error) {
        // Aba foi fechada, continua verificando outras
        backgroundLogger.debug(`Aba de login ${tab.id} não existe mais`);
      }
    }
    return false;
  } catch (error) {
    backgroundLogger.error(
      "Erro ao verificar abas de login existentes:",
      error
    );
    return false;
  }
}

/**
 * Configurações para retry logic
 */
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000, // 1 segundo
  maxDelay: 10000, // 10 segundos
  backoffMultiplier: 2
};

/**
 * Implementa retry com backoff exponencial
 * @param {Function} operation - Função assíncrona a ser executada
 * @param {Object} config - Configurações de retry
 * @param {string} operationName - Nome da operação para logs
 * @returns {Promise} - Resultado da operação ou erro final
 */
async function retryWithBackoff(operation, config = RETRY_CONFIG, operationName = 'operação') {
  let lastError;
  
  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      backgroundLogger.debug(`Tentativa ${attempt}/${config.maxRetries} para ${operationName}`);
      const result = await operation();
      
      if (attempt > 1) {
        backgroundLogger.info(`${operationName} bem-sucedida na tentativa ${attempt}`);
      }
      
      return result;
    } catch (error) {
      lastError = error;
      backgroundLogger.warn(`Tentativa ${attempt}/${config.maxRetries} falhou para ${operationName}:`, error.message);
      
      // Se não é a última tentativa, aguarda antes de tentar novamente
      if (attempt < config.maxRetries) {
        const delay = Math.min(
          config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1),
          config.maxDelay
        );
        
        backgroundLogger.debug(`Aguardando ${delay}ms antes da próxima tentativa`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // Se chegou aqui, todas as tentativas falharam
  backgroundLogger.error(`Todas as ${config.maxRetries} tentativas falharam para ${operationName}:`, lastError);
  throw lastError;
}

/**
 * Tenta realizar o login automático no SAU usando as credenciais salvas.
 * Abre uma nova aba para a página de login e injeta um script para preencher e submeter o formulário.
 * Agora com retry logic para operações críticas.
 */
async function performAutomaticLogin() {
  try {
    // Operação crítica 1: Obter credenciais com retry
    const data = await retryWithBackoff(
      () => browserAPI.storage.local.get(["sauUsername", "sauPassword"]),
      RETRY_CONFIG,
      'obtenção de credenciais'
    );
    
    const username = data.sauUsername;
    const password = data.sauPassword;

    // Se as credenciais não estiverem salvas, verifica se deve abrir uma nova aba
    if (!username || !password) {
      backgroundLogger.warn(
        "Credenciais de login não encontradas. Login automático não será realizado."
      );

      const now = Date.now();
      const timeSinceLastLoginTab = now - lastLoginTabOpenedTimestamp;
      const LOGIN_TAB_COOLDOWN = 5 * 60 * 1000; // 5 minutos em millisegundos

      // Verifica se já existe uma aba de login aberta
      const hasExistingLoginTab = await checkForExistingLoginTab();

      // Só abre uma nova aba se:
      // 1. Não há aba de login existente E
      // 2. Passou tempo suficiente desde a última aba aberta (cooldown)
      if (!hasExistingLoginTab && timeSinceLastLoginTab > LOGIN_TAB_COOLDOWN) {
        backgroundLogger.info(
          "Abrindo nova aba de login para configuração manual de credenciais"
        );

        // Operação crítica 2: Criar notificação com retry
        await retryWithBackoff(
          () => browserAPI.notifications.create({
            type: "basic",
            iconUrl: "icons/icon48.png",
            title: "Monitor SAU: Login Necessário",
            message:
              "Credenciais não configuradas. Por favor, acesse as opções da extensão para configurar o login automático.",
          }),
          RETRY_CONFIG,
          'criação de notificação'
        );

        // Operação crítica 3: Criar aba de login com retry
        const loginTab = await retryWithBackoff(
          () => browserAPI.tabs.create({
            url: SAU_LOGIN_URL,
            active: false, // Abre em segundo plano para não interromper o usuário
          }),
          RETRY_CONFIG,
          'criação de aba de login'
        );

        // Atualiza o timestamp e ID da última aba de login aberta
        lastLoginTabOpenedTimestamp = now;
        loginTabId = loginTab.id;

        backgroundLogger.info(
          `Nova aba de login criada: ${loginTab.id} (em segundo plano)`
        );
      } else if (hasExistingLoginTab) {
        backgroundLogger.debug("Aba de login já existe, não abrindo nova aba");
      } else {
        backgroundLogger.debug(
          `Cooldown ativo: ${Math.round(
            (LOGIN_TAB_COOLDOWN - timeSinceLastLoginTab) / 1000
          )}s restantes`
        );
      }

      return;
    }

    // Operação crítica 4: Criar aba de login automático com retry
    const loginTab = await retryWithBackoff(
      () => browserAPI.tabs.create({
        url: SAU_LOGIN_URL,
        active: false, // PRINCIPAL MUDANÇA: Abre em segundo plano
      }),
      RETRY_CONFIG,
      'criação de aba para login automático'
    );
    
    backgroundLogger.info(
      `Tentando login automático na aba ${loginTab.id} (em segundo plano).`
    );

    // Adiciona um listener para quando a página de login estiver completamente carregada
    // Este listener será removido assim que o script for injetado para evitar múltiplas injeções.
    browserAPI.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
      if (tabId === loginTab.id && changeInfo.status === "complete") {
        // Remove o listener para evitar que ele seja disparado novamente
        browserAPI.tabs.onUpdated.removeListener(listener);

        // Operação crítica 5: Injetar script de login com retry
        retryWithBackoff(
          () => browserAPI.scripting.executeScript({
            target: { tabId: loginTab.id },
            function: (user, pass) => {
              const loginForm = document.getElementById("loginForm");
              if (loginForm) {
                const usernameInput = document.getElementById("usuario");
                const passwordInput = document.getElementById("senha");
                if (usernameInput && passwordInput) {
                  usernameInput.value = user;
                  passwordInput.value = pass;
                  loginForm.submit();
                  // Logs no console da página (não do Service Worker)
                  // Usamos console.info aqui porque é no contexto da página e não no do Service Worker
                  console.info(
                    "Content Script (Login): Credenciais preenchidas e formulário submetido."
                  );
                } else {
                  console.error(
                    "Content Script (Login): Campos de login (IDs: usuario, senha) não encontrados na página do SAU."
                  );
                }
              } else {
                console.error(
                  'Content Script (Login): Formulário de login (id="loginForm") não encontrado na página do SAU.'
                );
              }
            },
            args: [username, password], // Passa as credenciais como argumentos para a função injetada
            world: "MAIN",
          }),
          RETRY_CONFIG,
          'injeção de script de login'
        )
        .then(() => {
          backgroundLogger.info(
            `Script de preenchimento de login injetado na aba ${loginTab.id}.`
          );
          // Após a submissão, a página navegará. O webNavigation.onCompleted capturará a próxima página do SAU.
        })
        .catch((error) => {
          backgroundLogger.error(
            `Erro ao injetar script de login na aba ${loginTab.id} após ${RETRY_CONFIG.maxRetries} tentativas:`,
            error
          );
          
          // Operação crítica 6: Notificação de erro com retry (fallback)
          retryWithBackoff(
            () => browserAPI.notifications.create({
              type: "basic",
              iconUrl: "icons/icon48.png",
              title: "Monitor SAU: Erro no Login Automático",
              message:
                "Não foi possível preencher o formulário de login em segundo plano após múltiplas tentativas. Por favor, tente fazer o login manualmente.",
            }),
            { ...RETRY_CONFIG, maxRetries: 2 }, // Menos tentativas para notificação de erro
            'notificação de erro de login'
          ).catch((notificationError) => {
            backgroundLogger.error("Falha crítica: não foi possível criar notificação de erro:", notificationError);
          });
          
          // Se o login falhar em segundo plano, a aba permanecerá em segundo plano.
        });
      }
    });
    
  } catch (error) {
    backgroundLogger.error("Falha crítica no login automático:", error);
    
    // Tenta criar notificação de falha crítica como último recurso
    try {
      await browserAPI.notifications.create({
        type: "basic",
        iconUrl: "icons/icon48.png",
        title: "Monitor SAU: Falha Crítica",
        message: "Erro crítico no sistema de login automático. Verifique as configurações da extensão.",
      });
    } catch (notificationError) {
      backgroundLogger.error("Não foi possível criar notificação de falha crítica:", notificationError);
    }
  }
}

/**
 * Utilitário para deep copy performático
 * @param {any} obj - Objeto para copiar
 * @returns {any} Cópia profunda do objeto
 */
function performantDeepCopy(obj) {
  // Use structuredClone se disponível (mais performático)
  if (typeof structuredClone !== "undefined") {
    return structuredClone(obj);
  }
  // Fallback para JSON (menos performático mas compatível)
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Lida com as novas tarefas recebidas do content script.
 * Filtra, notifica o usuário e atualiza o estado persistente da extensão.
 * Otimizado para processamento paralelo para evitar bloqueio do Service Worker.
 * @param {Array<Object>} newTasks - Um array de objetos de tarefa recém-encontradas.
 */
async function handleNewTasks(newTasks) {
  backgroundLogger.info(
    "Novas tarefas recebidas do content script:",
    newTasks.length,
    newTasks // Log completo das tarefas recebidas
  );

  const tasksToNotify = [];
  // Cria uma cópia profunda de lastKnownTasks para evitar mutações diretas durante a iteração
  const updatedLastKnownTasks = performantDeepCopy(lastKnownTasks);

  // Otimização: Processa verificações de renotificação em paralelo
  const renotificationChecks = await Promise.all(
    newTasks.map(async (newTask) => {
      const taskId = newTask.id;
      const isAlreadyKnownIndex = updatedLastKnownTasks.findIndex(
        (task) => task.id === taskId
      );
      const isAlreadyKnown = isAlreadyKnownIndex !== -1;
      const isIgnored = ignoredTasks[taskId];
      const isSnoozed =
        snoozedTasks[taskId] && snoozedTasks[taskId] > Date.now();
      const isOpened = openedTasks[taskId];

      // Se é tarefa conhecida e não está ignorada/snoozed/aberta, verifica renotificação
      let shouldRenotify = false;
      if (isAlreadyKnown && !isIgnored && !isSnoozed && !isOpened) {
        shouldRenotify = await checkIfShouldRenotify(taskId);
      }

      return {
        newTask,
        taskId,
        isAlreadyKnown,
        isAlreadyKnownIndex,
        isIgnored,
        isSnoozed,
        isOpened,
        shouldRenotify,
      };
    })
  );

  // Processa resultados das verificações de forma otimizada
  // Usa processamento em lotes para evitar bloqueio do Service Worker
  const BATCH_SIZE = 10; // Processa até 10 tarefas por vez
  for (let i = 0; i < renotificationChecks.length; i += BATCH_SIZE) {
    const batch = renotificationChecks.slice(i, i + BATCH_SIZE);
    
    // Processa lote atual em paralelo
    await Promise.all(
      batch.map(async (check) => {
        const {
          newTask,
          taskId,
          isAlreadyKnown,
          isAlreadyKnownIndex,
          isIgnored,
          isSnoozed,
          isOpened,
          shouldRenotify,
        } = check;

        backgroundLogger.debug(
          `Processando tarefa ${taskId}: isAlreadyKnown=${isAlreadyKnown}, isIgnored=${isIgnored}, isSnoozed=${isSnoozed}, isOpened=${isOpened}`
        );

        if (!isAlreadyKnown) {
          // Se a tarefa não é conhecida, adiciona-a à lista de tarefas a serem notificadas
          // e também à lista de tarefas conhecidas.
          tasksToNotify.push(newTask);
          const now = Date.now();
          updatedLastKnownTasks.push({
            ...newTask,
            lastNotifiedTimestamp: now,
          }); // Adiciona timestamp
          taskNotificationTimestamps[taskId] = now; // Registra timestamp de notificação
          backgroundLogger.debug(`Tarefa ${taskId} é nova e será notificada.`);
        } else {
          // Se a tarefa já é conhecida, atualiza seus detalhes se for necessário (ex: posição, descrição)
          // E verifica se deve ser re-notificada
          const existingTask = updatedLastKnownTasks[isAlreadyKnownIndex];
          // Atualiza os detalhes da tarefa existente com os novos dados, exceto o ID e o timestamp
          Object.assign(existingTask, {
            ...newTask,
            id: existingTask.id,
            lastNotifiedTimestamp: existingTask.lastNotifiedTimestamp,
          });

          // Lógica para re-notificar tarefas pendentes
          if (!isIgnored && !isSnoozed && !isOpened) {
            if (shouldRenotify) {
              tasksToNotify.push(newTask);
              taskNotificationTimestamps[taskId] = Date.now(); // Atualiza timestamp da renotificação
              backgroundLogger.debug(`Tarefa ${taskId} será renotificada.`);
            } else {
              backgroundLogger.debug(
                `Tarefa ${taskId} já conhecida, não ignorada, não snoozed e não aberta. Será considerada para o badge.`
              );
            }
          } else {
            backgroundLogger.debug(
              `Tarefa ${taskId} já conhecida e está ignorada, snoozed ou aberta.`
            );
          }
        }
      })
    );

    // Yield control para evitar bloqueio do Service Worker em lotes grandes
    if (i + BATCH_SIZE < renotificationChecks.length) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  lastKnownTasks = updatedLastKnownTasks; // Atualiza a lista global de tarefas conhecidas
  await savePersistentData(); // Salva o estado atualizado no storage
  updateBadge(); // Atualiza o contador no ícone com as novas tarefas

  if (tasksToNotify.length > 0) {
    backgroundLogger.info(
      `Disparando notificação para ${tasksToNotify.length} nova(s) tarefa(s).`,
      tasksToNotify
    );

    // Rate limiting para notificações
    const now = Date.now();
    if (now - lastNotificationTime >= NOTIFICATION_COOLDOWN) {
      try {
        // Cria uma notificação do navegador para as novas tarefas usando Promises (compatível com Chrome e Firefox)
        const notificationId = await browserAPI.notifications.create({
          type: "basic",
          iconUrl: "icons/icon48.png",
          title: `Monitor SAU: ${tasksToNotify.length} Nova(s) Tarefa(s)!`,
          message:
            tasksToNotify
              .map((t) => t.titulo)
              .join(", ")
              .substring(0, 100) + "...",
          buttons: [{ title: "Abrir Todas" }, { title: "Ignorar Todas" }],
        });
        lastNotificationTime = now; // Atualiza timestamp da última notificação
        backgroundLogger.info(
          "Notificação do navegador criada:",
          notificationId
        );
      } catch (error) {
        backgroundLogger.error(
          "Erro ao criar notificação do navegador:",
          error
        );
      }
    } else {
      const remainingCooldown = Math.ceil(
        (NOTIFICATION_COOLDOWN - (now - lastNotificationTime)) / 1000
      );
      backgroundLogger.debug(
        `Notificação suprimida devido ao rate limiting. Aguarde ${remainingCooldown}s`
      );
    }

    // Processa notificações de forma assíncrona e paralela
    const notificationPromises = [
      // Envia uma mensagem para o popup (se aberto) para que ele possa atualizar sua lista de tarefas
      browserAPI.runtime.sendMessage({
        action: "updatePopup",
        newTasks: tasksToNotify,
        message: `Novas tarefas encontradas: ${tasksToNotify.length}`,
      }).catch(error => {
        // Popup pode não estar aberto, isso é normal
        backgroundLogger.debug(
          "Popup não está aberto para receber atualização:",
          error.message
        );
      }),

      // Tenta enviar uma mensagem para a aba ativa do SAU para exibir a UI de notificação visual
      (async () => {
        try {
          const [activeSauTab] = await browserAPI.tabs.query({
            active: true,
            currentWindow: true,
            url: "https://egov.santos.sp.gov.br/sau/*",
          });
          if (activeSauTab) {
            await browserAPI.tabs.sendMessage(activeSauTab.id, {
              action: "showNotificationUI",
              tasks: tasksToNotify,
            });
            backgroundLogger.info(
              "Comando para injetar UI de notificação enviado para content script."
            );
          }
        } catch (error) {
          backgroundLogger.error(
            "Erro ao injetar UI de notificação visual:",
            error.message
          );
        }
      })()
    ];

    // Executa todas as notificações em paralelo sem bloquear
    await Promise.allSettled(notificationPromises);
  } else {
    backgroundLogger.info("Nenhuma tarefa nova para notificar.");
    // Se não houver tarefas novas, ainda assim atualiza o popup para indicar que a verificação ocorreu
    try {
      await browserAPI.runtime.sendMessage({
        action: "updatePopup",
        newTasks: [], // Nenhuma tarefa nova
        message: `Nenhuma tarefa nova. Última verificação: ${new Date(
          lastCheckTimestamp
        ).toLocaleTimeString()}`,
      });
    } catch (error) {
      backgroundLogger.debug(
        "Popup não está aberto para receber atualização:",
        error.message
      );
    }
  }
}

/**
 * Listener para cliques nos botões das notificações do navegador.
 * Permite ao usuário interagir com as notificações (abrir, ignorar).
 */
browserAPI.notifications.onButtonClicked.addListener(
  (notificationId, buttonIndex) => {
    backgroundLogger.info(
      `Botão de notificação clicado: ${notificationId}, Botão ${buttonIndex}`
    );
    if (notificationId) {
      if (buttonIndex === 0) {
        // Botão "Abrir Todas"
        // Marca todas as tarefas como abertas e as abre
        lastKnownTasks.forEach((task) => {
          if (
            !ignoredTasks[task.id] &&
            !openedTasks[task.id] &&
            (!snoozedTasks[task.id] || snoozedTasks[task.id] <= Date.now())
          ) {
            openedTasks[task.id] = true; // Marca como aberta
            browserAPI.tabs.create({ url: task.link });
          }
        });
        savePersistentData(); // Salva o estado após marcar como aberta
        updateBadge(); // Atualiza o badge
        browserAPI.notifications.clear(notificationId); // Limpa a notificação após a ação
        backgroundLogger.info(
          "Todas as tarefas da notificação abertas e notificação limpa."
        );
        // Notifica o popup para atualizar sua lista
        try {
          browserAPI.runtime.sendMessage({
            action: "updatePopup",
            newTasks: [],
          });
        } catch (error) {
          backgroundLogger.debug(
            "Popup não está aberto para receber atualização:",
            error.message
          );
        }
      } else if (buttonIndex === 1) {
        // Botão "Ignorar Todas"
        // Marca todas as tarefas como ignoradas
        lastKnownTasks.forEach((task) => {
          ignoredTasks[task.id] = true;
        });
        savePersistentData(); // Salva o estado atualizado
        browserAPI.notifications.clear(notificationId); // Limpa a notificação
        backgroundLogger.info(
          "Todas as tarefas da notificação ignoradas e notificação limpa."
        );
        // Notifica o popup para limpar a lista de tarefas
        try {
          browserAPI.runtime.sendMessage({
            action: "updatePopup",
            newTasks: [],
          });
        } catch (error) {
          backgroundLogger.debug(
            "Popup não está aberto para receber atualização:",
            error.message
          );
        }
      }
    }
  }
);

/**
 * Adiciona um listener para o evento `webNavigation.onCompleted`.
 * Este evento é disparado quando uma navegação é concluída em uma aba.
 * Usamos isso para injetar o content script nas páginas do SAU e SIGSS.
 */
browserAPI.webNavigation.onCompleted.addListener(
  async (details) => {
    // Verifica se a URL da aba corresponde a uma das URLs do SAU que queremos monitorar
    const isSauPage =
      details.url.startsWith(SAU_LOGIN_URL) ||
      details.url.startsWith(SAU_HOME_URL) ||
      details.url.startsWith(SAU_PREPARAR_PESQUISAR_TAREFA_URL);

    // Verifica se é uma página do SIGSS usando validação consistente
    const isSigssPage = isValidSigssUrl(details.url);

    if (isSauPage) {
      backgroundLogger.info(
        `Navegação completa para uma página SAU: ${details.url}. Injetando content script.`
      );
      try {
        // Injeta o content script principal no contexto ISOLADO (padrão)
        await browserAPI.scripting.executeScript({
          target: { tabId: details.tabId },
          files: [await getContentScriptForTab(details.tabId)],
        });
        // Injeta o script interceptor no contexto da PÁGINA (MAIN)
        // para que ele possa sobrescrever o XMLHttpRequest da página.
        await browserAPI.scripting.executeScript({
          target: { tabId: details.tabId },
          files: ["interceptor.js"],
          world: "MAIN",
          injectImmediately: true, // Tenta injetar o mais rápido possível
        });
        // Injeta o CSS da notificação visual
        await browserAPI.scripting.insertCSS({
          target: { tabId: details.tabId },
          files: ["notification-ui.css"],
        });
        backgroundLogger.info(
          `Content script e CSS de notificação injetados na aba ${details.tabId}.`
        );
      } catch (error) {
        backgroundLogger.error(
          `Erro ao injetar content script ou CSS na aba ${details.tabId}:`,
          error
        );
      }
    } else if (isSigssPage) {
      backgroundLogger.info(
        `Navegação completa para uma página SIGSS: ${details.url}. Injetando content script SIGSS.`
      );
      try {
        // Injeta o content script do SIGSS no contexto ISOLADO (padrão)
        await browserAPI.scripting.executeScript({
          target: { tabId: details.tabId },
          files: ['content-sigss.js'],
        });
        backgroundLogger.info(
          `Content script SIGSS injetado na aba ${details.tabId}.`
        );
      } catch (error) {
        backgroundLogger.error(
          `Erro ao injetar content script SIGSS na aba ${details.tabId}:`,
          error
        );
      }
    }
  },
  { 
    url: [
      { urlMatches: "https://egov.santos.sp.gov.br/sau/*" },
      { urlMatches: "http://c1863prd.cloudmv.com.br/sigss/*" },
      { urlMatches: "http://c1863tst1.cloudmv.com.br/sigss/*" }
    ] 
  }
); // Filtra para URLs do SAU e SIGSS

/**
 * Listener para quando abas são removidas/fechadas.
 * Limpa o estado das abas de login quando elas são fechadas.
 */
browserAPI.tabs.onRemoved.addListener((tabId) => {
  if (tabId === loginTabId) {
    backgroundLogger.debug(
      `Aba de login ${tabId} foi fechada, limpando estado`
    );
    loginTabId = null;
  }
});

/**
 * Função de inicialização do Service Worker.
 * Carrega os dados persistentes e agenda a primeira verificação.
 * Agora, também inicializa o logger após carregar os dados.
 */
loadPersistentData()
  .then(() => {
    // Inicializa o nível de log do logger APÓS os dados persistentes serem carregados,
    // garantindo que o logger esteja pronto antes de qualquer log mais detalhado.
    backgroundLogger
      .initialize()
      .then(async () => {
        backgroundLogger.info("Background Service Worker iniciado."); // Agora este log será com o nível configurado

        // Tenta migrar configurações para sync se disponível
        try {
          await migrateToSync();
          backgroundLogger.info("Migração de configurações para sync concluída");
        } catch (error) {
          backgroundLogger.warn("Erro na migração para sync:", error);
        }

        browserAPI.storage.local.get("checkInterval").then(async (data) => {
          const interval = data.checkInterval || 30; // Padrão: 30 segundos
          scheduleNextCheck(interval);
          updateBadge(); // Atualiza o badge na inicialização
          
          // ✅ NOVA FUNCIONALIDADE: Verificação inicial imediata
          backgroundLogger.info("Executando verificação inicial de tarefas...");
          try {
            await checkAndNotifyNewTasks();
            backgroundLogger.info("Verificação inicial concluída com sucesso");
          } catch (error) {
            backgroundLogger.error("Erro na verificação inicial:", error);
          }
        });
      })
      .catch((error) => {
        // Loga erro se a inicialização do logger falhar, mesmo que seja improvável
        console.error("[Background] Erro ao inicializar logger:", error);
      });
  })
  .catch((error) => {
    // Loga erro se o carregamento de dados persistentes falhar
    console.error(
      "[Background] Erro ao carregar dados persistentes na inicialização:",
      error
    );
  });


