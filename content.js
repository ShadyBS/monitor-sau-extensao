// NOTA TÉCNICA: Este script utiliza um logger simplificado em vez do logger.js completo
// devido a uma limitação na forma como os content scripts são injetados programaticamente,
// o que impede o uso de módulos ES6 (import/export) diretamente.

// Injection Guard: Previne a re-execução do script se ele já foi injetado nesta página.
// Isso evita erros de "identifier has already been declared" e a duplicação de listeners.
(function () {
  if (window.monitorSauHasInjected) {
    // O script já foi injetado e está em execução. Não faz nada.
    return;
  }
  window.monitorSauHasInjected = true;

  // Define o objeto de API do navegador de forma compatível (Chrome ou Firefox)
  const browserAPI = (() => {
    if (typeof globalThis !== 'undefined' && globalThis.browser) return globalThis.browser;
    if (typeof globalThis !== 'undefined' && globalThis.chrome) return globalThis.chrome;
    if (typeof window !== 'undefined' && window.browser) return window.browser;
    if (typeof window !== 'undefined' && window.chrome) return window.chrome;
    throw new Error('Browser extension API not available');
  })();

  // Logger simplificado para content script
  const contentLogger = {
    info: (...args) => console.info('[Content Script]', ...args),
    warn: (...args) => console.warn('[Content Script]', ...args),
    error: (...args) => console.error('[Content Script]', ...args),
    debug: (...args) => console.debug('[Content Script]', ...args)
  };

  // Verificação de robustez: Garante que as APIs da extensão estão disponíveis.
  // Se não estiverem, o script não pode funcionar e deve parar.
  if (!browserAPI || !browserAPI.runtime || !browserAPI.storage) {
    contentLogger.error("Extensão não configurada corretamente. Reinstale a extensão.");
    // Interrompe a execução para evitar mais erros.
    return;
  }

  // URLs do SAU
  const SAU_LOGIN_URL = "https://egov.santos.sp.gov.br/sau/entrar.sau";
  const SAU_HOME_URL = "https://egov.santos.sp.gov.br/sau/menu/home.sau";
  const SAU_TASK_SEARCH_URL =
    "https://egov.santos.sp.gov.br/sau/ajax/pesquisar_Tarefa.sau";
  const SAU_PREPARAR_PESQUISAR_TAREFA_URL =
    "https://egov.santos.sp.gov.br/sau/comum/prepararPesquisar_Tarefa.sau";

  // Variável global para armazenar as últimas tarefas vistas nesta sessão do content script.
  // Isso ajuda a evitar o reprocessamento de tarefas já enviadas ao background script
  // dentro da mesma sessão da página.
  let currentSessionTasks = [];

  // Variável para armazenar a tarefa atualmente exibida no modal de detalhes da página
  let currentNotificationModalTask = null;

  // Throttling para MutationObserver
  let mutationTimeout = null;
  const MUTATION_THROTTLE_DELAY = 500; // 500ms

  /**
   * Lida com o login automático se a página atual for a página de login do SAU.
   * Tenta preencher e submeter o formulário de login com as credenciais salvas.
   */
  async function handleLoginIfNecessary() {
    // Verifica se a URL atual começa com a URL de login do SAU
    if (window.location.href.startsWith(SAU_LOGIN_URL)) {
      contentLogger.info("Página de login detectada. Verificando credenciais para login automático...");
      try {
        // Obtém as credenciais armazenadas no storage da extensão
        const data = await browserAPI.storage.local.get([
          "sauUsername",
          "sauPassword",
        ]);
        const username = data.sauUsername;
        const password = data.sauPassword;

        if (username && password) {
          const loginForm = document.getElementById("loginForm");
          if (loginForm) {
            const usernameInput = document.getElementById("usuario");
            const passwordInput = document.getElementById("senha");
            if (usernameInput && passwordInput) {
              usernameInput.value = username;
              passwordInput.value = password;
              loginForm.submit(); // Submete o formulário
              contentLogger.info("Credenciais preenchidas e formulário submetido.");
            } else {
              contentLogger.warn("Campos de usuário/senha não encontrados na página de login do SAU.");
            }
          } else {
            contentLogger.warn("Formulário de login não encontrado na página do SAU.");
          }
        } else {
          contentLogger.info("Credenciais não salvas nas opções da extensão. Login automático desativado.");
        }
      } catch (error) {
        contentLogger.error("Erro ao tentar login automático:", error);
      }
    }
  }

  /**
   * Analisa um elemento HTML de tarefa e extrai suas informações relevantes.
   * @param {HTMLElement} taskHtmlElement - O elemento HTML que representa uma tarefa individual.
   * @returns {Object|null} Um objeto contendo os detalhes da tarefa ou null se o parsing falhar.
   */
  function parseTaskFromHtml(taskHtmlElement) {
    try {
      // Seletores CSS para extrair informações da tarefa
      const numeroElement = taskHtmlElement.querySelector(".numeroTarefaLista");
      const tituloElement = taskHtmlElement.querySelector(".nomeTarefaLista");
      const linkElement = taskHtmlElement.querySelector(".acoesTarefaLista a");

      // Encontra a tabela de detalhes dentro do taskHtmlElement
      const detailTable = taskHtmlElement.querySelector(
        'table[width="100%"][cellpadding="2"][cellspacing="2"]'
      );

      if (!detailTable) {
        contentLogger.warn("Tabela de detalhes da tarefa não encontrada.");
        return null;
      }

      // Extrai os dados baseados na estrutura da tabela de detalhes
      let dataEnvio = null;
      let posicao = null;
      let solicitante = null;
      let unidade = null;
      let descricao = null;
      let enderecos = [];

      // Função auxiliar para extrair texto de um elemento irmão após um rótulo em negrito
      const extractValueByLabel = (label, parentElement) => {
        const row = Array.from(parentElement.querySelectorAll("tr")).find(
          (tr) =>
            tr.querySelector('td[align="right"] b') &&
            tr.querySelector('td[align="right"] b').textContent.trim() === label
        );
        return row
          ? row
              .querySelector('td[align="right"]')
              .nextElementSibling.textContent.trim()
          : null;
      };

      // Extração de Data de Envio
      dataEnvio = extractValueByLabel("Data de Envio:", detailTable);
      contentLogger.debug("Data de Envio extraída:", dataEnvio);

      // Extração de Posição
      const posicaoElementInTable = Array.from(
        detailTable.querySelectorAll('td[align="right"]')
      ).find((td) => td.textContent.includes("Posição:"));
      posicao = posicaoElementInTable
        ? posicaoElementInTable.querySelector("b").textContent.trim()
        : null;
      contentLogger.debug("Posição extraída:", posicao);

      // Extração de Solicitante
      solicitante = extractValueByLabel("Solicitante:", detailTable);
      contentLogger.debug("Solicitante extraído:", solicitante);

      // Extração de Unidade
      unidade = extractValueByLabel("Unidade:", detailTable);
      contentLogger.debug("Unidade extraída:", unidade);

      // Extração de Descrição
      descricao = extractValueByLabel("Descrição:", detailTable);
      contentLogger.debug("Descrição extraída:", descricao);

      // Extração de Endereços
      const enderecosListElements = detailTable.querySelectorAll(
        ".enderecosTarefa li span"
      );
      enderecos = Array.from(enderecosListElements).map((el) =>
        el.textContent.trim()
      );
      contentLogger.debug("Endereços extraídos:", enderecos);

      // Verifica se todos os elementos essenciais foram encontrados
      if (
        numeroElement &&
        tituloElement &&
        linkElement &&
        dataEnvio &&
        posicao
      ) {
        const numero = numeroElement.textContent.trim();
        let tituloCompleto = tituloElement.textContent.trim();
        // Remove os prefixos "Título: " e "Serviço: " para obter apenas o título limpo
        tituloCompleto = tituloCompleto
          .replace(/Título:\s*/, "")
          .replace(/Serviço:\s*/, "")
          .trim();
        // Pega apenas a primeira linha do título, caso haja quebras de linha
        const titulo = tituloCompleto.split("\n")[0].trim();

        const link = linkElement.href;

        // Cria um ID único para a tarefa combinando número e data de envio
        const id = `${numero}-${dataEnvio}`;

        const parsedTask = {
          id,
          numero,
          titulo,
          link,
          dataEnvio,
          posicao,
          solicitante,
          unidade,
          descricao,
          enderecos,
        };
        contentLogger.debug("Tarefa parseada:", parsedTask);
        return parsedTask;
      }
    } catch (e) {
      contentLogger.error("Erro ao parsear elemento da tarefa:", e);
      // Retorna objeto de fallback em vez de null
      return {
        id: `fallback-${Date.now()}`,
        numero: "Erro",
        titulo: "Tarefa com erro de parsing",
        link: "#",
        dataEnvio: new Date().toLocaleDateString(),
        posicao: "N/A",
        solicitante: "N/A",
        unidade: "N/A",
        descricao: "Erro ao processar dados da tarefa",
        enderecos: []
      };
    }
    return null; // Retorna null se não conseguir parsear a tarefa
  }

  /**
   * Processa uma lista de elementos HTML de tarefa, extrai as informações,
   * filtra as que são novas e as envia para o background script.
   * @param {NodeListOf<Element>} taskElements - Uma lista de nós de elementos de tarefa.
   */
  function processTaskElements(taskElements) {
    const foundTasks = [];
    taskElements.forEach((taskElement) => {
      const task = parseTaskFromHtml(taskElement);
      if (task) {
        foundTasks.push(task);
      }
    });

    if (foundTasks.length === 0) {
      contentLogger.info("Nenhuma tarefa encontrada para processar.");
      return; // Nenhuma tarefa encontrada para processar
    }

    contentLogger.info("Tarefas encontradas para processamento:", foundTasks.length);

    // Filtra as tarefas que são realmente novas (não estão em currentSessionTasks)
    const newTasks = foundTasks.filter(
      (task) =>
        !currentSessionTasks.some((existingTask) => existingTask.id === task.id)
    );

    if (newTasks.length > 0) {
      contentLogger.info("Novas tarefas detectadas:", newTasks.length);
      // Adiciona as novas tarefas à lista de tarefas da sessão atual
      currentSessionTasks = [...currentSessionTasks, ...newTasks];
      // Envia as novas tarefas para o background script para processamento e notificação
      browserAPI.runtime
        .sendMessage({
          action: "newTasksFound",
          tasks: newTasks,
        })
        .then(() => {
          contentLogger.info("Mensagem 'newTasksFound' enviada com sucesso.");
        })
        .catch((error) => {
          contentLogger.error("Erro ao enviar mensagem 'newTasksFound':", error);
        });
    } else {
      contentLogger.info("Nenhuma nova tarefa detectada nesta verificação.");
    }
  }

  /**
   * Verifica se a opção "Novas" está selecionada na página
   * @returns {boolean} true se a opção "Novas" estiver selecionada
   */
  function isNewTasksOptionSelected() {
    const novasOption = document.getElementById("tarefaPesquisaOpcao1");
    return novasOption && novasOption.checked;
  }

  /**
   * Processa o conteúdo HTML recebido de uma requisição AJAX
   * para extrair tarefas e identificar novas.
   * @param {string} htmlContent - O fragmento HTML contendo as tarefas.
   */
  function processTasksHtml(htmlContent) {
    // Verifica se a opção "Novas" está selecionada
    if (!isNewTasksOptionSelected()) {
      contentLogger.info("Opção 'Novas' não está selecionada. Ignorando processamento de tarefas para evitar notificações desnecessárias.");
      return;
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, "text/html");
    const taskElements = doc.querySelectorAll("table.tarefaLista");
    contentLogger.info("HTML de tarefas recebido para processamento. Elementos encontrados:", taskElements.length);
    processTaskElements(taskElements);
  }

  /**
   * Procura por tarefas que já existem na página no momento em que o script é carregado.
   */
  function scanForExistingTasks() {
    // Verifica se a opção "Novas" está selecionada antes de processar tarefas existentes
    if (!isNewTasksOptionSelected()) {
      contentLogger.info("Opção 'Novas' não está selecionada. Ignorando escaneamento de tarefas existentes.");
      return;
    }

    const taskElements = document.querySelectorAll("table.tarefaLista");
    if (taskElements.length > 0) {
      contentLogger.info(`Encontradas ${taskElements.length} tarefas pré-existentes no DOM. Processando...`);
      processTaskElements(taskElements);
    } else {
      contentLogger.info("Nenhuma tarefa pré-existente encontrada no DOM.");
    }
  }

  /**
   * Configura um MutationObserver para monitorar mudanças no DOM com throttling.
   * Isso serve como um fallback ou complemento à interceptação AJAX,
   * caso as tarefas sejam injetadas diretamente no DOM sem uma requisição XHR óbvia.
   */
  function setupMutationObserver() {
    // Tenta encontrar o elemento que contém a lista de tarefas, ou monitora o body como fallback
    const targetNode = document.getElementById("divLista") || document.body;
    if (!targetNode) {
      contentLogger.warn("Elemento alvo para MutationObserver (divLista) não encontrado. Monitoramento de DOM pode ser limitado.");
      return;
    }

    // Configuração do observador: observar mudanças na lista de filhos e em subárvores
    const config = { childList: true, subtree: true };

    // Callback com throttling que será executado quando houver mutações no DOM
    const callback = function (mutationsList) {
      // Se já há um timeout ativo, não faz nada (throttling)
      if (mutationTimeout) return;
      
      mutationTimeout = setTimeout(() => {
        const hasRelevantChanges = mutationsList.some(
          (mutation) =>
            mutation.type === "childList" && mutation.addedNodes.length > 0
        );

        if (hasRelevantChanges) {
          contentLogger.info("Mudanças no DOM detectadas pelo MutationObserver. Re-escaneando por tarefas...");
          scanForExistingTasks();
        }
        mutationTimeout = null;
      }, MUTATION_THROTTLE_DELAY);
    };

    const observer = new MutationObserver(callback);
    observer.observe(targetNode, config); // Inicia a observação
    contentLogger.info("MutationObserver configurado para divLista com throttling.");
  }

  /**
   * Injeta a interface de usuário visual para exibir notificações de novas tarefas na página.
   * @param {Array<Object>} tasks - Um array de objetos de tarefa a serem exibidos na notificação.
   */
  function injectNotificationUI(tasks) {
    // Remove qualquer notificação existente para evitar duplicação
    const existingNotification = document.getElementById(
      "sau-notification-container"
    );
    if (existingNotification) {
      existingNotification.remove();
    }

    const notificationContainer = document.createElement("div");
    notificationContainer.id = "sau-notification-container";
    notificationContainer.className = "sau-notification-container";

    // Cria o HTML para cada tarefa na notificação de forma segura
    let tasksHtml = tasks
      .map((task) => {
        // Sanitiza os dados da tarefa
        const safeTask = {
          numero: String(task.numero || '').substring(0, 50),
          titulo: String(task.titulo || '').substring(0, 200),
          dataEnvio: String(task.dataEnvio || '').substring(0, 50),
          posicao: String(task.posicao || '').substring(0, 50),
          solicitante: String(task.solicitante || 'N/A').substring(0, 100),
          unidade: String(task.unidade || 'N/A').substring(0, 100),
          descricao: String(task.descricao || 'N/A').substring(0, 1000),
          id: String(task.id || '').substring(0, 100),
          link: String(task.link || '#').substring(0, 500),
          enderecos: Array.isArray(task.enderecos) 
            ? task.enderecos.slice(0, 10).map(addr => String(addr).substring(0, 200))
            : []
        };

        // Valida URL
        try {
          new URL(safeTask.link);
        } catch (error) {
          contentLogger.warn(`URL inválida na tarefa ${safeTask.id}: ${safeTask.link}`);
          safeTask.link = '#';
        }

        return `
        <div class="sau-notification-item">
            <p><strong>${safeTask.numero}</strong>: ${safeTask.titulo}</p>
            <p class="sau-notification-meta">Envio: ${safeTask.dataEnvio} | Posição: ${safeTask.posicao}</p>
            <div class="sau-notification-actions">
                <button class="sau-btn-open" data-url="${safeTask.link}" data-id="${safeTask.id}">Abrir</button>
                <button class="sau-btn-details" data-id="${safeTask.id}">Detalhes</button>
                <button class="sau-btn-ignore" data-id="${safeTask.id}">Ignorar</button>
                <button class="sau-btn-snooze" data-id="${safeTask.id}">Lembrar Mais Tarde</button>
            </div>
            <div class="sau-details-expanded" id="sau-details-${safeTask.id}">
                <p><strong>Solicitante:</strong> ${safeTask.solicitante}</p>
                <p><strong>Unidade:</strong> ${safeTask.unidade}</p>
                <p><strong>Descrição:</strong> ${safeTask.descricao}</p>
                ${
                  safeTask.enderecos && safeTask.enderecos.length > 0
                    ? `<p><strong>Endereço(s):</strong> ${safeTask.enderecos
                        .map((addr) => `<span>${addr}</span>`)
                        .join("<br>")}</p>`
                    : ""
                }
                <p><strong>Link:</strong> <a href="${safeTask.link}" target="_blank" rel="noopener noreferrer">Abrir no SAU</a></p>
            </div>
        </div>
    `;
      })
      .join("");

    // Constrói o HTML completo da notificação
    notificationContainer.innerHTML = `
        <div class="sau-notification-header">
            <h3>Novas Tarefas SAU (${tasks.length})</h3>
            <button id="sau-notification-close" class="sau-close-btn">&times;</button>
        </div>
        <div class="sau-notification-body">
            ${tasksHtml}
        </div>
    `;

    document.body.appendChild(notificationContainer); // Adiciona a notificação ao corpo do documento

    // Adiciona listeners para o botão de fechar a notificação
    document
      .getElementById("sau-notification-close")
      .addEventListener("click", () => {
        notificationContainer.remove();
      });

    // Adiciona listeners para os botões de ação dentro de cada item de tarefa na notificação
    notificationContainer
      .querySelectorAll(".sau-btn-open")
      .forEach((button) => {
        button.addEventListener("click", (e) => {
          const url = e.target.dataset.url;
          const taskId = e.target.dataset.id; // Pega o ID da tarefa
          // Envia uma mensagem para o background script para marcar a tarefa como aberta
          browserAPI.runtime.sendMessage({
            action: "markTaskAsOpened",
            taskId: taskId,
          });
          browserAPI.runtime.sendMessage({ action: "openTab", url: url }); // Abre a URL
          // Remove o item de tarefa da notificação visual
          e.target.closest(".sau-notification-item").remove();
          // Se não houver mais itens, remove o container da notificação
          if (
            notificationContainer.querySelectorAll(".sau-notification-item")
              .length === 0
          ) {
            notificationContainer.remove();
          }
        });
      });

    notificationContainer
      .querySelectorAll(".sau-btn-details")
      .forEach((button) => {
        button.addEventListener("click", (e) => {
          const taskId = e.target.dataset.id;
          const task = tasks.find((t) => t.id === taskId);
          if (task) {
            contentLogger.info(`Botão 'Detalhes' clicado para a tarefa: ${taskId}. Alternando visibilidade dos detalhes.`);
            const detailsDiv = document.getElementById(
              `sau-details-${task.id}`
            );
            detailsDiv.classList.toggle("expanded");
          }
        });
      });

    notificationContainer
      .querySelectorAll(".sau-btn-ignore")
      .forEach((button) => {
        button.addEventListener("click", (e) => {
          const taskId = e.target.dataset.id;
          // Envia uma mensagem para o background script para ignorar esta tarefa
          browserAPI.runtime.sendMessage({
            action: "ignoreTask",
            taskId: taskId,
          });
          // Remove o item de tarefa da notificação visual
          e.target.closest(".sau-notification-item").remove();
          // Se não houver mais itens, remove o container da notificação
          if (
            notificationContainer.querySelectorAll(".sau-notification-item")
              .length === 0
          ) {
            notificationContainer.remove();
          }
        });
      });

    notificationContainer
      .querySelectorAll(".sau-btn-snooze")
      .forEach((button) => {
        button.addEventListener("click", (e) => {
          const taskId = e.target.dataset.id;
          // Envia uma mensagem para o background script para "snooze" esta tarefa
          browserAPI.runtime.sendMessage({
            action: "snoozeTask",
            taskId: taskId,
          });
          // Remove o item de tarefa da notificação visual
          e.target.closest(".sau-notification-item").remove();
          // Se não houver mais itens, remove o container da notificação
          if (
            notificationContainer.querySelectorAll(".sau-notification-item")
              .length === 0
          ) {
            notificationContainer.remove();
          }
        });
      });
  }

  // --- Execução Inicial do Content Script ---
  (async () => {
    contentLogger.info("Inicializando...");

    // Carrega as últimas tarefas conhecidas do storage local para a sessão atual do content script.
    // Isso é importante para que o content script não notifique sobre tarefas já vistas na mesma sessão.
    const data = await browserAPI.storage.local.get("lastKnownTasks");
    currentSessionTasks = data.lastKnownTasks || [];
    contentLogger.info("Tarefas conhecidas na sessão:", currentSessionTasks.length);

    // Lida com a tentativa de login automático se a página atual for a de login
    await handleLoginIfNecessary();

    // Procura por tarefas que já possam existir no DOM no momento do carregamento.
    scanForExistingTasks();

    // Adiciona um listener para receber mensagens do script interceptor (que roda no world: MAIN).
    // Esta é a ponte de comunicação para obter os dados do AJAX.
    window.addEventListener("message", (event) => {
      // Validação de segurança aprimorada
      if (event.source !== window) {
        contentLogger.warn("Mensagem de fonte não confiável rejeitada");
        return;
      }

      if (event.origin !== window.location.origin) {
        contentLogger.warn("Mensagem de origem incorreta rejeitada:", event.origin);
        return;
      }

      if (!event.data || typeof event.data !== "object") {
        contentLogger.warn("Dados de mensagem inválidos rejeitados");
        return;
      }

      if (event.data.type === "SAU_TASKS_RESPONSE") {
        // Validação adicional do conteúdo
        if (typeof event.data.htmlContent !== "string") {
          contentLogger.warn("Conteúdo HTML inválido rejeitado");
          return;
        }

        // Validação de tamanho (limite de 5MB para prevenir ataques de DoS)
        if (event.data.htmlContent.length > 5 * 1024 * 1024) {
          contentLogger.warn("Conteúdo HTML muito grande rejeitado");
          return;
        }

        // Validação de timestamp (mensagens não podem ser muito antigas - 30 segundos)
        if (event.data.timestamp && Date.now() - event.data.timestamp > 30000) {
          contentLogger.warn("Mensagem muito antiga rejeitada");
          return;
        }

        contentLogger.info("Resposta AJAX de tarefas recebida do interceptor.");
        processTasksHtml(event.data.htmlContent);
      }
    });

    // Configura o MutationObserver como um complemento/fallback para detectar mudanças no DOM
    setupMutationObserver();

    // Adiciona um listener para mensagens enviadas do background script para este content script.
    // Isso é usado para injetar a UI de notificação visual e responder a pings de responsividade.
    browserAPI.runtime.onMessage.addListener(
      (message, sender, sendResponse) => {
        // O listener padrão e seguro para comunicação entre background e content scripts.
        if (message.action === "showNotificationUI") {
          contentLogger.info("Mensagem para mostrar UI de notificação recebida do Background:", message.tasks);
          // Injeta a UI de notificação visual na página
          injectNotificationUI(message.tasks);
          // Opcional: responder ao background que a ação foi concluída.
          // sendResponse({ status: "UI Injetada com sucesso" });
        } else if (message.action === "ping") {
          // Responde ao ping de verificação de responsividade
          contentLogger.debug("Ping recebido do background script");
          sendResponse({ status: "pong", timestamp: Date.now() });
          return true; // Indica que a resposta será enviada de forma assíncrona
        }
      }
    );

    // Se o content script for injetado na página de consulta de tarefas,
    // simula um clique no botão de pesquisa para carregar as tarefas iniciais.
    if (window.location.href.startsWith(SAU_PREPARAR_PESQUISAR_TAREFA_URL)) {
      contentLogger.info('Página de consulta de tarefas ativa. Tentando simular clique em "Pesquisar" para verificação inicial.');
      const searchButton = document.getElementById("btn_pesquisarTarefaForm"); // Botão de pesquisa principal
      const searchButtonAdvanced = document.getElementById(
        "btn_pesquisarTarefaFormAvancado"
      ); // Botão de pesquisa avançada

      if (searchButton) {
        searchButton.click();
        contentLogger.info("Botão de pesquisa principal clicado.");
      } else if (searchButtonAdvanced) {
        searchButtonAdvanced.click();
        contentLogger.info("Botão de pesquisa avançada clicado.");
      } else {
        contentLogger.warn("Nenhum botão de pesquisa de tarefas encontrado. A verificação inicial pode não ocorrer automaticamente.");
      }
    } else if (window.location.href.startsWith(SAU_HOME_URL)) {
      // Se o script for injetado na página inicial após o login,
      // redireciona para a página de consulta de tarefas para iniciar o processo.
      contentLogger.info("Página inicial (home) detectada. Redirecionando para a página de consulta de tarefas...");
      window.location.href = SAU_PREPARAR_PESQUISAR_TAREFA_URL;
    }
  })();
    // Inicializa a funcionalidade de renomear abas do SIGSS
    await initializeSigssTabRenamer();
  })();

  // --- Funcionalidade de Renomear Abas do SIGSS ---
  
  // Variáveis para funcionalidade de renomear abas do SIGSS
  let sigssTabRenamerEnabled = true; // Habilitado por padrão
  let sigssTabRenamerPreviousTitle = '';
  let sigssTabRenamerObserver = null;

  /**
   * Verifica se a funcionalidade de renomear abas do SIGSS está habilitada
   */
  async function checkSigssTabRenamerEnabled() {
    try {
      const data = await browserAPI.storage.sync.get(['enableSigssTabRename']);
      sigssTabRenamerEnabled = data.enableSigssTabRename !== false;
      contentLogger.debug('Funcionalidade de renomear abas SIGSS:', sigssTabRenamerEnabled ? 'habilitada' : 'desabilitada');
      return sigssTabRenamerEnabled;
    } catch (error) {
      try {
        const data = await browserAPI.storage.local.get(['enableSigssTabRename']);
        sigssTabRenamerEnabled = data.enableSigssTabRename !== false;
        contentLogger.debug('Funcionalidade de renomear abas SIGSS (local):', sigssTabRenamerEnabled ? 'habilitada' : 'desabilitada');
        return sigssTabRenamerEnabled;
      } catch (localError) {
        contentLogger.warn('Erro ao verificar configuração SIGSS Tab Renamer, mantendo habilitado por padrão:', localError);
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

    const titleElement = document.querySelector('.ui-widget-header.sigss-title');
    
    if (!titleElement) {
      return;
    }

    const newTitle = titleElement.textContent.trim();
    
    if (newTitle && newTitle !== sigssTabRenamerPreviousTitle) {
      sigssTabRenamerPreviousTitle = newTitle;
      document.title = newTitle;
      contentLogger.debug('Título da aba SIGSS atualizado para:', newTitle);
    }
  }

  /**
   * Execução segura da atualização do título SIGSS
   */
  function safeSigssTabUpdate() {
    try {
      updateSigssTabTitle();
    } catch (error) {
      contentLogger.warn('Erro na atualização do título SIGSS:', error);
    }
  }

  /**
   * Inicia o sistema de observação para renomear abas do SIGSS
   */
  function startSigssTabRenamerObserver() {
    if (!sigssTabRenamerEnabled) {
      return;
    }

    // Para o observer anterior se existir
    if (sigssTabRenamerObserver) {
      sigssTabRenamerObserver.disconnect();
    }

    // Callback do MutationObserver para SIGSS
    const sigssObserverCallback = (mutations) => {
      if (!document.hidden && sigssTabRenamerEnabled) {
        window.requestAnimationFrame(safeSigssTabUpdate);
      }
    };

    // Cria e inicia o novo observer para SIGSS
    sigssTabRenamerObserver = new MutationObserver(sigssObserverCallback);
    sigssTabRenamerObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
    
    contentLogger.info('Observer SIGSS Tab Renamer iniciado');
  }

  /**
   * Para o sistema de observação do SIGSS Tab Renamer
   */
  function stopSigssTabRenamerObserver() {
    if (sigssTabRenamerObserver) {
      sigssTabRenamerObserver.disconnect();
      sigssTabRenamerObserver = null;
      contentLogger.info('Observer SIGSS Tab Renamer parado');
    }
  }

  /**
   * Verifica se a URL atual é uma página do SIGSS
   */
  function isSigssPage() {
    const url = window.location.href;
    return /sigss/i.test(url);
  }

  /**
   * Inicializa a funcionalidade de renomear abas do SIGSS
   */
  async function initializeSigssTabRenamer() {
    if (!isSigssPage()) {
      contentLogger.debug('Não é uma página do SIGSS, funcionalidade de renomear abas não será ativada');
      return;
    }

    contentLogger.info('Inicializando sistema de renomeação de abas SIGSS...');

    try {
      await checkSigssTabRenamerEnabled();

      if (sigssTabRenamerEnabled) {
        safeSigssTabUpdate();
        startSigssTabRenamerObserver();
        contentLogger.info('Sistema de renomeação de abas SIGSS inicializado com sucesso');
      } else {
        contentLogger.info('Sistema de renomeação de abas SIGSS desabilitado nas configurações');
      }
    } catch (error) {
      contentLogger.error('Erro na inicialização do sistema de renomeação de abas SIGSS:', error);
    }
  }

  // Listener para mudanças nas configurações do SIGSS Tab Renamer
  browserAPI.storage.onChanged.addListener((changes, namespace) => {
    if (changes.enableSigssTabRename) {
      const newValue = changes.enableSigssTabRename.newValue;
      const oldValue = changes.enableSigssTabRename.oldValue;
      
      contentLogger.info('Configuração de renomear abas SIGSS alterada:', oldValue, '->', newValue);
      
      sigssTabRenamerEnabled = newValue !== false;
      
      if (sigssTabRenamerEnabled && isSigssPage()) {
        startSigssTabRenamerObserver();
        safeSigssTabUpdate();
      } else {
        stopSigssTabRenamerObserver();
      }
    }
  });

  // Cleanup quando a página é descarregada
  window.addEventListener('unload', () => {
    stopSigssTabRenamerObserver();
  }, { once: true });

})(); // Fecha o IIFE do injection guard
