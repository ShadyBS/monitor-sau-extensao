// URLs do SAU
const SAU_LOGIN_URL = "https://egov.santos.sp.gov.br/sau/entrar.sau";
const SAU_HOME_URL = "https://egov.santos.sp.gov.br/sau/menu/home.sau";
const SAU_TASK_SEARCH_URL =
  "https://egov.santos.sp.gov.br/sau/ajax/pesquisar_Tarefa.sau";
const SAU_PREPARAR_PESQUISAR_TAREFA_URL =
  "https://egov.santos.sp.gov.br/sau/comum/prepararPesquisar_Tarefa.sau";

// Importa o logger e o instancia para o contexto do background script
import { logger } from "./logger.js";
const backgroundLogger = logger("[Background]");

// Define o objeto de API do navegador de forma compatível (Chrome ou Firefox)
const browserAPI = globalThis.browser || globalThis.chrome;

// Variáveis globais para armazenar o estado da extensão.
// Serão persistidas no chrome.storage.local.
let lastKnownTasks = []; // Armazena as últimas tarefas conhecidas por ID
let ignoredTasks = {}; // { taskId: true } - Tarefas que o usuário escolheu ignorar
let snoozedTasks = {}; // { taskId: timestampWhenToNotifyAgain } - Tarefas "lembradas mais tarde"
let openedTasks = {}; // { taskId: true } - Tarefas que o usuário abriu e não devem mais ser notificadas
let lastCheckTimestamp = 0; // Último timestamp da verificação de tarefas
let taskNotificationTimestamps = {}; // { taskId: lastNotificationTimestamp } - Controla renotificações

/**
 * Carrega os dados persistentes do armazenamento local do Chrome.
 * Isso garante que o estado da extensão seja mantido entre as sessões do navegador.
 */
async function loadPersistentData() {
  try {
    const data = await browserAPI.storage.local.get([
      "lastKnownTasks",
      "ignoredTasks",
      "snoozedTasks",
      "openedTasks", // Carrega o novo estado
      "lastCheckTimestamp",
      "taskNotificationTimestamps", // Carrega timestamps de notificação
    ]);
    lastKnownTasks = data.lastKnownTasks || [];
    ignoredTasks = data.ignoredTasks || {};
    snoozedTasks = data.snoozedTasks || {};
    openedTasks = data.openedTasks || {}; // Inicializa o novo estado
    lastCheckTimestamp = data.lastCheckTimestamp || 0;
    taskNotificationTimestamps = data.taskNotificationTimestamps || {}; // Inicializa timestamps
    backgroundLogger.info("Dados persistentes carregados:", {
      lastKnownTasks: lastKnownTasks.length, // Log apenas o tamanho para evitar logs muito grandes
      ignoredTasks: Object.keys(ignoredTasks).length,
      snoozedTasks: Object.keys(snoozedTasks).length,
      openedTasks: Object.keys(openedTasks).length, // Log o tamanho do novo estado
      taskNotificationTimestamps: Object.keys(taskNotificationTimestamps).length,
      lastCheckTimestamp,
    });
    backgroundLogger.debug("Conteúdo de lastKnownTasks:", lastKnownTasks); // Log o conteúdo completo para depuração
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
 */
async function savePersistentData() {
  try {
    await browserAPI.storage.local.set({
      lastKnownTasks: lastKnownTasks,
      ignoredTasks: ignoredTasks,
      snoozedTasks: snoozedTasks,
      openedTasks: openedTasks, // Salva o novo estado
      lastCheckTimestamp: lastCheckTimestamp,
      taskNotificationTimestamps: taskNotificationTimestamps, // Salva timestamps de notificação
    });
    backgroundLogger.info("Dados persistentes salvos.");
  } catch (error) {
    backgroundLogger.error("Erro ao salvar dados persistentes:", error);
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
    const shouldRenotify = timeSinceLastNotification >= renotificationIntervalMs;
    
    backgroundLogger.debug(
      `Verificação de renotificação para tarefa ${taskId}: ` +
      `enableRenotification=${enableRenotification}, ` +
      `timeSinceLastNotification=${Math.round(timeSinceLastNotification / 60000)}min, ` +
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
browserAPI.runtime.onMessage.addListener((request, sender, sendResponse) => {
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
    case "getLatestTasks":
      // Retorna as tarefas que não foram ignoradas, abertas ou estão prontas para serem "lembradas"
      const currentPendingTasks = lastKnownTasks.filter(
        (task) =>
          !ignoredTasks[task.id] &&
          !openedTasks[task.id] && // Filtra tarefas abertas
          (!snoozedTasks[task.id] || snoozedTasks[task.id] <= Date.now())
      );
      backgroundLogger.debug(
        "Retornando últimas tarefas para popup:",
        currentPendingTasks.length,
        currentPendingTasks
      );
      sendResponse({
        newTasks: currentPendingTasks,
        message: `Última verificação: ${new Date(
          lastCheckTimestamp
        ).toLocaleTimeString()}`,
        lastCheck: lastCheckTimestamp,
      });
      break;
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
        backgroundLogger.debug("Popup não está aberto para receber atualização:", error.message);
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
          backgroundLogger.debug("Popup não está aberto para receber atualização:", error.message);
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
        backgroundLogger.debug("Popup não está aberto para receber atualização:", error.message);
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
      break;
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
      break;
  }
});

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
    // Se a aba encontrada for a página de pesquisa de tarefas, recarrega-a para garantir dados atualizados.
    // Isso também acionará a reinjeção do content script via webNavigation.onCompleted.
    if (sauTab.url.startsWith(SAU_PREPARAR_PESQUISAR_TAREFA_URL)) {
      backgroundLogger.info(`Recarregando aba de tarefas SAU: ${sauTab.url}`);
      try {
        await browserAPI.tabs.reload(sauTab.id);
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
    try {
      // Injeta o content script principal no contexto ISOLADO (padrão)
      await browserAPI.scripting.executeScript({
        target: { tabId: sauTab.id },
        files: ["content.js"],
      });
      // Injeta o script interceptor no contexto da PÁGINA (MAIN)
      await browserAPI.scripting.executeScript({
        target: { tabId: sauTab.id },
        files: ["interceptor.js"],
        world: "MAIN",
        injectImmediately: true, // Tenta injetar o mais rápido possível
      });
      backgroundLogger.info("Content script injetado na aba SAU.");
    } catch (error) {
      backgroundLogger.error("Erro ao injetar content script:", error);
      // Se a injeção falhar, pode ser que a aba não esteja mais acessível ou logada.
      // Tenta o login automático novamente como fallback.
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
 * Tenta realizar o login automático no SAU usando as credenciais salvas.
 * Abre uma nova aba para a página de login e injeta um script para preencher e submeter o formulário.
 */
async function performAutomaticLogin() {
  const data = await browserAPI.storage.local.get([
    "sauUsername",
    "sauPassword",
  ]);
  const username = data.sauUsername;
  const password = data.sauPassword;

  // Se as credenciais não estiverem salvas, notifica o usuário
  if (!username || !password) {
    backgroundLogger.warn(
      "Credenciais de login não encontradas. Login automático não será realizado."
    );
    browserAPI.notifications.create({
      type: "basic",
      iconUrl: "icons/icon48.png",
      title: "Monitor SAU: Login Necessário",
      message:
        "Credenciais não configuradas. Por favor, acesse as opções da extensão para configurar o login automático.",
    });
    // Abre a página de login para que o usuário possa fazer o login manualmente
    browserAPI.tabs.create({ url: SAU_LOGIN_URL, active: true }); // Mantém ativa para intervenção manual
    return;
  }

  // Abre uma nova aba para a página de login e a torna NÃO ativa
  const loginTab = await browserAPI.tabs.create({
    url: SAU_LOGIN_URL,
    active: false, // PRINCIPAL MUDANÇA: Abre em segundo plano
  });
  backgroundLogger.info(
    `Tentando login automático na aba ${loginTab.id} (em segundo plano).`
  );

  // Adiciona um listener para quando a página de login estiver completamente carregada
  // Este listener será removido assim que o script for injetado para evitar múltiplas injeções.
  browserAPI.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
    if (tabId === loginTab.id && changeInfo.status === "complete") {
      // Remove o listener para evitar que ele seja disparado novamente
      browserAPI.tabs.onUpdated.removeListener(listener);

      // Injeta um script na página para preencher e submeter o formulário de login
      // Usamos world: 'MAIN' para que o script possa acessar e manipular o DOM do formulário diretamente.
      browserAPI.scripting
        .executeScript({
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
                console.log(
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
        })
        .then(() => {
          backgroundLogger.info(
            `Script de preenchimento de login injetado na aba ${loginTab.id}.`
          );
          // Após a submissão, a página navegará. O webNavigation.onCompleted capturará a próxima página do SAU.
        })
        .catch((error) => {
          backgroundLogger.error(
            `Erro ao injetar script de login na aba ${loginTab.id}:`,
            error
          );
          browserAPI.notifications.create({
            type: "basic",
            iconUrl: "icons/icon48.png",
            title: "Monitor SAU: Erro no Login Automático",
            message:
              "Não foi possível preencher o formulário de login em segundo plano. Por favor, tente fazer o login manualmente.",
          });
          // Se o login falhar em segundo plano, a aba permanecerá em segundo plano.
        });
    }
  });
}

/**
 * Lida com as novas tarefas recebidas do content script.
 * Filtra, notifica o usuário e atualiza o estado persistente da extensão.
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
  const updatedLastKnownTasks = JSON.parse(JSON.stringify(lastKnownTasks));

  // Itera sobre as novas tarefas recebidas
  for (const newTask of newTasks) {
    const taskId = newTask.id; // O ID já vem do content script

    // Verifica se a tarefa já é conhecida em updatedLastKnownTasks
    const isAlreadyKnownIndex = updatedLastKnownTasks.findIndex(
      (task) => task.id === taskId
    );
    const isAlreadyKnown = isAlreadyKnownIndex !== -1;

    const isIgnored = ignoredTasks[taskId];
    const isSnoozed = snoozedTasks[taskId] && snoozedTasks[taskId] > Date.now();
    const isOpened = openedTasks[taskId]; // Verifica se a tarefa foi aberta

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
        // Verifica se deve renotificar esta tarefa
        const shouldRenotify = await checkIfShouldRenotify(taskId);
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
  }

  lastKnownTasks = updatedLastKnownTasks; // Atualiza a lista global de tarefas conhecidas
  await savePersistentData(); // Salva o estado atualizado no storage
  updateBadge(); // Atualiza o contador no ícone com as novas tarefas

  if (tasksToNotify.length > 0) {
    backgroundLogger.info(
      `Disparando notificação para ${tasksToNotify.length} nova(s) tarefa(s).`,
      tasksToNotify
    );
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
      backgroundLogger.info("Notificação do navegador criada:", notificationId);
    } catch (error) {
      backgroundLogger.error("Erro ao criar notificação do navegador:", error);
    }

    // Envia uma mensagem para o popup (se aberto) para que ele possa atualizar sua lista de tarefas
    try {
      browserAPI.runtime.sendMessage({
        action: "updatePopup",
        newTasks: tasksToNotify,
        message: `Novas tarefas encontradas: ${tasksToNotify.length}`,
      });
    } catch (error) {
      // Popup pode não estar aberto, isso é normal
      backgroundLogger.debug("Popup não está aberto para receber atualização:", error.message);
    }

    // Tenta enviar uma mensagem para a aba ativa do SAU para exibir a UI de notificação visual
    const [activeSauTab] = await browserAPI.tabs.query({
      active: true,
      currentWindow: true,
      url: "https://egov.santos.sp.gov.br/sau/*",
    });
    if (activeSauTab) {
      try {
        await browserAPI.tabs.sendMessage(activeSauTab.id, {
          action: "showNotificationUI",
          tasks: tasksToNotify,
        });
        backgroundLogger.info(
          "Comando para injetar UI de notificação enviado para content script."
        );
      } catch (error) {
        backgroundLogger.error(
          "Erro ao injetar UI de notificação visual:",
          error.message
        );
      }
    }
  } else {
    backgroundLogger.info("Nenhuma tarefa nova para notificar.");
    // Se não houver tarefas novas, ainda assim atualiza o popup para indicar que a verificação ocorreu
    try {
      browserAPI.runtime.sendMessage({
        action: "updatePopup",
        newTasks: [], // Nenhuma tarefa nova
        message: `Nenhuma tarefa nova. Última verificação: ${new Date(
          lastCheckTimestamp
        ).toLocaleTimeString()}`,
      });
    } catch (error) {
      backgroundLogger.debug("Popup não está aberto para receber atualização:", error.message);
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
          browserAPI.runtime.sendMessage({ action: "updatePopup", newTasks: [] });
        } catch (error) {
          backgroundLogger.debug("Popup não está aberto para receber atualização:", error.message);
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
          browserAPI.runtime.sendMessage({ action: "updatePopup", newTasks: [] });
        } catch (error) {
          backgroundLogger.debug("Popup não está aberto para receber atualização:", error.message);
        }
      }
    }
  }
);

/**
 * Adiciona um listener para o evento `webNavigation.onCompleted`.
 * Este evento é disparado quando uma navegação é concluída em uma aba.
 * Usamos isso para injetar o content script nas páginas do SAU.
 */
browserAPI.webNavigation.onCompleted.addListener(
  async (details) => {
    // Verifica se a URL da aba corresponde a uma das URLs do SAU que queremos monitorar
    const isSauPage =
      details.url.startsWith(SAU_LOGIN_URL) ||
      details.url.startsWith(SAU_HOME_URL) ||
      details.url.startsWith(SAU_PREPARAR_PESQUISAR_TAREFA_URL);

    if (isSauPage) {
      backgroundLogger.info(
        `Navegação completa para uma página SAU: ${details.url}. Injetando content script.`
      );
      try {
        // Injeta o content script principal no contexto ISOLADO (padrão)
        await browserAPI.scripting.executeScript({
          target: { tabId: details.tabId },
          files: ["content.js"],
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
    }
  },
  { url: [{ urlMatches: "https://egov.santos.sp.gov.br/sau/*" }] }
); // Filtra para URLs do SAU

/**
 * Função de inicialização do Service Worker.
 * Carrega os dados persistentes e agenda a primeira verificação.
 */
loadPersistentData().then(() => {
  browserAPI.storage.local.get("checkInterval").then((data) => {
    const interval = data.checkInterval || 30; // Padrão: 30 segundos
    scheduleNextCheck(interval);
    updateBadge(); // Atualiza o badge na inicialização
  });
});
