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
  
  // Variável global para armazenar a instância do MutationObserver para cleanup
  let globalMutationObserver = null;

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
    // Desconecta observer anterior se existir (previne vazamentos de memória)
    if (globalMutationObserver) {
      globalMutationObserver.disconnect();
      contentLogger.debug("MutationObserver anterior desconectado.");
    }

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

    globalMutationObserver = new MutationObserver(callback);
    globalMutationObserver.observe(targetNode, config); // Inicia a observação
    contentLogger.info("MutationObserver configurado para divLista com throttling.");
  }

  /**
   * Limpa recursos do MutationObserver para prevenir vazamentos de memória.
   * Deve ser chamado quando a página é descarregada ou o script é finalizado.
   */
  function cleanupMutationObserver() {
    if (globalMutationObserver) {
      globalMutationObserver.disconnect();
      globalMutationObserver = null;
      contentLogger.info("MutationObserver desconectado e limpo com sucesso.");
    }
    
    // Limpa timeout pendente se existir
    if (mutationTimeout) {
      clearTimeout(mutationTimeout);
      mutationTimeout = null;
      contentLogger.debug("Timeout do MutationObserver limpo.");
    }
  }

  /**
   * Sanitiza dados de tarefa para prevenir XSS
   * @param {Object} task - Objeto de tarefa a ser sanitizado
   * @returns {Object} Tarefa sanitizada
   */
  function sanitizeTaskData(task) {
    const sanitized = {
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
      new URL(sanitized.link);
    } catch (error) {
      contentLogger.warn(`URL inválida na tarefa ${sanitized.id}: ${sanitized.link}`);
      sanitized.link = '#';
    }

    return sanitized;
  }

  /**
   * Cria um elemento DOM de forma segura usando textContent
   * @param {string} tag - Tag HTML
   * @param {string} textContent - Conteúdo de texto
   * @param {Object} attributes - Atributos do elemento
   * @returns {HTMLElement} Elemento criado
   */
  function createSafeElement(tag, textContent = '', attributes = {}) {
    const element = document.createElement(tag);
    
    if (textContent) {
      element.textContent = textContent; // Usa textContent em vez de innerHTML
    }
    
    // Define atributos de forma segura
    for (const [key, value] of Object.entries(attributes)) {
      element.setAttribute(key, String(value));
    }
    
    return element;
  }

  /**
   * Cria um item de tarefa de forma segura sem usar innerHTML
   * @param {Object} task - Dados da tarefa sanitizados
   * @returns {HTMLElement} Elemento da tarefa
   */
  function createSafeTaskItem(task) {
    // Container principal do item
    const itemDiv = createSafeElement('div', '', { class: 'sau-notification-item' });

    // Parágrafo principal com número e título
    const mainP = createSafeElement('p');
    const strongElement = createSafeElement('strong', task.numero);
    mainP.appendChild(strongElement);
    mainP.appendChild(document.createTextNode(`: ${task.titulo}`));
    itemDiv.appendChild(mainP);

    // Parágrafo com meta informações
    const metaP = createSafeElement('p', `Envio: ${task.dataEnvio} | Posição: ${task.posicao}`, {
      class: 'sau-notification-meta'
    });
    itemDiv.appendChild(metaP);

    // Container de ações
    const actionsDiv = createSafeElement('div', '', { class: 'sau-notification-actions' });
    
    // Botões de ação
    const openBtn = createSafeElement('button', 'Abrir', {
      class: 'sau-btn-open',
      'data-url': task.link,
      'data-id': task.id
    });
    
    const detailsBtn = createSafeElement('button', 'Detalhes', {
      class: 'sau-btn-details',
      'data-id': task.id
    });
    
    const ignoreBtn = createSafeElement('button', 'Ignorar', {
      class: 'sau-btn-ignore',
      'data-id': task.id
    });
    
    const snoozeBtn = createSafeElement('button', 'Lembrar Mais Tarde', {
      class: 'sau-btn-snooze',
      'data-id': task.id
    });

    actionsDiv.appendChild(openBtn);
    actionsDiv.appendChild(detailsBtn);
    actionsDiv.appendChild(ignoreBtn);
    actionsDiv.appendChild(snoozeBtn);
    itemDiv.appendChild(actionsDiv);

    // Container de detalhes expandidos
    const detailsDiv = createSafeElement('div', '', {
      class: 'sau-details-expanded',
      id: `sau-details-${task.id}`
    });

    // Adiciona campos de detalhes
    const detailFields = [
      { label: 'Solicitante', value: task.solicitante },
      { label: 'Unidade', value: task.unidade },
      { label: 'Descrição', value: task.descricao }
    ];

    detailFields.forEach(field => {
      const fieldP = createSafeElement('p');
      const labelStrong = createSafeElement('strong', `${field.label}: `);
      fieldP.appendChild(labelStrong);
      fieldP.appendChild(document.createTextNode(field.value));
      detailsDiv.appendChild(fieldP);
    });

    // Adiciona endereços se existirem
    if (task.enderecos && task.enderecos.length > 0) {
      const addressP = createSafeElement('p');
      const addressLabel = createSafeElement('strong', 'Endereço(s): ');
      addressP.appendChild(addressLabel);
      
      task.enderecos.forEach((addr, index) => {
        if (index > 0) {
          addressP.appendChild(document.createElement('br'));
        }
        const addrSpan = createSafeElement('span', addr);
        addressP.appendChild(addrSpan);
      });
      
      detailsDiv.appendChild(addressP);
    }

    // Adiciona link
    const linkP = createSafeElement('p');
    const linkLabel = createSafeElement('strong', 'Link: ');
    linkP.appendChild(linkLabel);
    
    const linkA = document.createElement('a');
    linkA.href = task.link;
    linkA.textContent = 'Abrir no SAU';
    linkA.target = '_blank';
    linkA.rel = 'noopener noreferrer';
    linkP.appendChild(linkA);
    
    detailsDiv.appendChild(linkP);
    itemDiv.appendChild(detailsDiv);

    return itemDiv;
  }

  /**
   * Injeta a interface de usuário visual para exibir notificações de novas tarefas na página.
   * CORRIGIDO: Agora usa DOM manipulation segura em vez de innerHTML para prevenir XSS.
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

    // Cria o container principal
    const notificationContainer = createSafeElement('div', '', {
      id: 'sau-notification-container',
      class: 'sau-notification-container'
    });

    // Cria o header
    const headerDiv = createSafeElement('div', '', { class: 'sau-notification-header' });
    const headerTitle = createSafeElement('h3', `Novas Tarefas SAU (${tasks.length})`);
    const closeBtn = createSafeElement('button', '×', {
      id: 'sau-notification-close',
      class: 'sau-close-btn'
    });
    
    headerDiv.appendChild(headerTitle);
    headerDiv.appendChild(closeBtn);
    notificationContainer.appendChild(headerDiv);

    // Cria o body
    const bodyDiv = createSafeElement('div', '', { class: 'sau-notification-body' });

    // Processa cada tarefa de forma segura
    tasks.forEach(task => {
      const sanitizedTask = sanitizeTaskData(task);
      const taskElement = createSafeTaskItem(sanitizedTask);
      bodyDiv.appendChild(taskElement);
    });

    notificationContainer.appendChild(bodyDiv);
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
    
    // Função auxiliar para descomprimir dados usando o mesmo algoritmo do data-compressor.js
    function decompressTaskData(compressedData) {
      try {
        // Verifica se está no formato comprimido do data-compressor.js
        if (compressedData && 
            typeof compressedData === 'object' && 
            compressedData.hasOwnProperty('compressed') &&
            compressedData.hasOwnProperty('data')) {
          
          if (!compressedData.compressed) {
            // Dados otimizados mas não comprimidos
            return compressedData.data;
          }
          
          // Dados comprimidos - implementa descompressão simples
          const compressedString = compressedData.data;
          if (typeof compressedString === 'string' && compressedString.includes('§')) {
            // Descompressão básica para referências simples
            let decompressed = compressedString;
            // Remove marcadores de compressão simples se existirem
            decompressed = decompressed.replace(/§\d+:\d+§/g, '');
            try {
              return JSON.parse(decompressed);
            } catch (parseError) {
              contentLogger.debug("Falha na descompressão, usando dados como string");
              return compressedString;
            }
          } else {
            // Tenta parsear diretamente se for string JSON
            try {
              return typeof compressedString === 'string' ? JSON.parse(compressedString) : compressedString;
            } catch (parseError) {
              return compressedString;
            }
          }
        }
        
        // Formato legado ou não comprimido
        return compressedData;
      } catch (error) {
        contentLogger.warn("Erro na descompressão de dados:", error);
        return compressedData;
      }
    }
    
    // Função auxiliar para extrair array de tarefas de diferentes formatos
    function extractTasksArray(rawData) {
      // Se já é um array, retorna diretamente
      if (Array.isArray(rawData)) {
        return rawData;
      }
      
      // Se é null ou undefined, retorna array vazio
      if (!rawData) {
        return [];
      }
      
      // Se é um objeto, tenta extrair de propriedades conhecidas
      if (typeof rawData === 'object') {
        // Formatos conhecidos de dados de tarefas
        const possibleArrays = [
          rawData.tasks,           // Formato padrão
          rawData.data,            // Formato de dados comprimidos
          rawData.lastKnownTasks,  // Formato aninhado
          rawData.items,           // Formato alternativo
          rawData.taskList         // Outro formato possível
        ];
        
        for (const possibleArray of possibleArrays) {
          if (Array.isArray(possibleArray)) {
            contentLogger.debug(`Tarefas extraídas de propriedade do objeto (${possibleArray.length} itens)`);
            return possibleArray;
          }
        }
        
        // Se o objeto tem propriedades que parecem tarefas, converte para array
        const objectKeys = Object.keys(rawData);
        if (objectKeys.length > 0) {
          // Verifica se as propriedades parecem IDs de tarefas
          const taskLikeObjects = objectKeys
            .map(key => rawData[key])
            .filter(value => 
              value && 
              typeof value === 'object' && 
              (value.id || value.numero || value.titulo)
            );
          
          if (taskLikeObjects.length > 0) {
            contentLogger.debug(`Convertendo objeto com ${taskLikeObjects.length} tarefas para array`);
            return taskLikeObjects;
          }
        }
        
        contentLogger.info("Objeto não contém array de tarefas reconhecível, retornando array vazio");
        return [];
      }
      
      // Para outros tipos, retorna array vazio
      contentLogger.info(`Tipo de dados não reconhecido (${typeof rawData}), retornando array vazio`);
      return [];
    }
    
    // Processamento principal dos dados de tarefas
    let rawTasks = data.lastKnownTasks;
    
    // Primeiro, tenta descomprimir se necessário
    const decompressedTasks = decompressTaskData(rawTasks);
    
    // Depois, extrai o array de tarefas do formato descomprimido
    currentSessionTasks = extractTasksArray(decompressedTasks);
    
    // Validação final robusta
    if (!Array.isArray(currentSessionTasks)) {
      contentLogger.error("Falha crítica: currentSessionTasks não é um array após processamento, forçando array vazio");
      currentSessionTasks = [];
    }
    
    // Sanitiza cada tarefa no array para garantir integridade
    currentSessionTasks = currentSessionTasks.filter(task => {
      if (!task || typeof task !== 'object') {
        contentLogger.debug("Removendo item inválido do array de tarefas");
        return false;
      }
      return true;
    });
    
    contentLogger.info("Tarefas conhecidas na sessão:", currentSessionTasks.length);

    // Lida com a tentativa de login automático se a página atual for a de login
    await handleLoginIfNecessary();

    // Procura por tarefas que já possam existir no DOM no momento do carregamento.
    scanForExistingTasks();

    // Adiciona um listener para receber mensagens do script interceptor (que roda no world: MAIN).
    // Esta é a ponte de comunicação para obter os dados do AJAX.
    window.addEventListener("message", (event) => {
      // Validação de segurança robusta contra injeção de dados maliciosos
      
      // 1. Validação de origem (mais importante que source para segurança)
      if (event.origin !== window.location.origin) {
        contentLogger.warn("Mensagem de origem incorreta rejeitada:", event.origin);
        return;
      }

      // 2. Validação de fonte mais flexível (permite MAIN world e ISOLATED world)
      if (event.source !== window && event.source !== window.parent && event.source !== window.top) {
        contentLogger.debug("Mensagem de fonte externa ignorada", {
          source: event.source,
          expected: window,
          origin: event.origin,
          type: event.data?.type
        });
        return;
      }

      // 3. Validação de estrutura de dados
      if (!event.data || typeof event.data !== "object") {
        contentLogger.warn("Dados de mensagem inválidos rejeitados");
        return;
      }

      // 4. Validação de tipo de mensagem específico
      if (event.data.type !== "SAU_TASKS_RESPONSE") {
        contentLogger.debug("Tipo de mensagem não reconhecido ignorado:", event.data.type);
        return;
      }

      // 5. Validação de timestamp obrigatório (previne replay attacks)
      if (!event.data.timestamp || typeof event.data.timestamp !== "number") {
        contentLogger.warn("Mensagem sem timestamp válido rejeitada");
        return;
      }

      // 6. Validação de janela temporal (mensagens não podem ser muito antigas - 30 segundos)
      const messageAge = Date.now() - event.data.timestamp;
      if (messageAge > 30000 || messageAge < 0) {
        contentLogger.warn(`Mensagem fora da janela temporal rejeitada (idade: ${messageAge}ms)`);
        return;
      }

      // 7. Validação de conteúdo HTML
      if (typeof event.data.htmlContent !== "string") {
        contentLogger.warn("Conteúdo HTML inválido rejeitado");
        return;
      }

      // 8. Validação de tamanho (limite de 5MB para prevenir ataques de DoS)
      if (event.data.htmlContent.length > 5 * 1024 * 1024) {
        contentLogger.warn("Conteúdo HTML muito grande rejeitado");
        return;
      }

      // 9. Validação de padrões suspeitos no HTML
      const suspiciousPatterns = [
        /<script[^>]*>/i,
        /javascript:/i,
        /on\w+\s*=/i,
        /<iframe[^>]*>/i,
        /<object[^>]*>/i,
        /<embed[^>]*>/i
      ];
      
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(event.data.htmlContent)) {
          contentLogger.warn("Conteúdo HTML com padrões suspeitos rejeitado");
          return;
        }
      }

      // 10. Validação de identificador único da mensagem (previne processamento duplicado)
      if (event.data.messageId) {
        const messageId = String(event.data.messageId);
        const storageKey = `processed_message_${messageId}`;
        
        // Verifica se a mensagem já foi processada
        if (window.sessionStorage && window.sessionStorage.getItem(storageKey)) {
          contentLogger.warn("Mensagem duplicada rejeitada:", messageId);
          return;
        }
        
        // Marca a mensagem como processada
        if (window.sessionStorage) {
          window.sessionStorage.setItem(storageKey, Date.now().toString());
        }
      }

      contentLogger.info("Resposta AJAX de tarefas validada e aceita do interceptor.");
      processTasksHtml(event.data.htmlContent);
    });

    // Configura o MutationObserver como um complemento/fallback para detectar mudanças no DOM
    setupMutationObserver();

    // Adiciona listeners para cleanup quando a página é descarregada (previne vazamentos de memória)
    window.addEventListener('beforeunload', () => {
      contentLogger.info("Página sendo descarregada. Executando cleanup do MutationObserver...");
      cleanupMutationObserver();
    });

    // Adiciona listener para visibilitychange como backup para cleanup
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        contentLogger.debug("Página ficou oculta. Executando cleanup preventivo...");
        cleanupMutationObserver();
      } else if (document.visibilityState === 'visible') {
        // Reconfigura o observer quando a página volta a ficar visível
        contentLogger.debug("Página ficou visível. Reconfigurando MutationObserver...");
        setupMutationObserver();
      }
    });

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
})(); // Fecha o IIFE do injection guard
