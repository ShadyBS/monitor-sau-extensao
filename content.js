// Importa o logger e o instancia para o contexto do content script
import { logger } from "./logger.js";
const contentLogger = logger("[Content]");

// Injection Guard: Previne a re-execução do script se ele já foi injetado nesta página.
// Isso evita erros de "identifier has already been declared" e a duplicação de listeners.
(function () {
  if (window.monitorSauHasInjected) {
    // O script já foi injetado e está em execução. Não faz nada.
    return;
  }
  window.monitorSauHasInjected = true;

  // Define o objeto de API do navegador de forma compatível (Chrome ou Firefox)
  const browserAPI = globalThis.browser || globalThis.chrome;

  // Verificação de robustez: Garante que as APIs da extensão estão disponíveis.
  // Se não estiverem, o script não pode funcionar e deve parar.
  if (!browserAPI || !browserAPI.runtime || !browserAPI.storage) {
    contentLogger.error(
      "Monitor SAU: APIs da extensão (browserAPI.runtime, browserAPI.storage) não encontradas. " +
        "O script pode não estar sendo executado no contexto correto de uma extensão. " +
        "Verifique se o 'manifest.json' tem as permissões corretas (ex: \"storage\") e " +
        "se o script está sendo injetado corretamente (ex: via 'chrome.scripting.executeScript')."
    );
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

  /**
   * Lida com o login automático se a página atual for a página de login do SAU.
   * Tenta preencher e submeter o formulário de login com as credenciais salvas.
   */
  async function handleLoginIfNecessary() {
    // Verifica se a URL atual começa com a URL de login do SAU
    if (window.location.href.startsWith(SAU_LOGIN_URL)) {
      contentLogger.info(
        "Página de login detectada. Verificando credenciais para login automático..."
      );
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
              contentLogger.info(
                "Credenciais preenchidas e formulário submetido."
              );
            } else {
              contentLogger.warn(
                "Campos de usuário/senha (IDs: usuario, senha) não encontrados na página de login do SAU."
              );
            }
          } else {
            contentLogger.warn(
              "Formulário de login (ID: loginForm) não encontrado na página do SAU."
            );
          }
        } else {
          contentLogger.info(
            "Credenciais não salvas nas opções da extensão. Login automático desativado."
          );
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
        contentLogger.warn(
          "Content Script: Tabela de detalhes da tarefa não encontrada."
        );
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
      contentLogger.debug("Content Script: Data de Envio extraída:", dataEnvio);

      // Extração de Posição
      const posicaoElementInTable = Array.from(
        detailTable.querySelectorAll('td[align="right"]')
      ).find((td) => td.textContent.includes("Posição:"));
      posicao = posicaoElementInTable
        ? posicaoElementInTable.querySelector("b").textContent.trim()
        : null;
      contentLogger.debug("Content Script: Posição extraída:", posicao);

      // Extração de Solicitante
      solicitante = extractValueByLabel("Solicitante:", detailTable);
      contentLogger.debug("Content Script: Solicitante extraído:", solicitante);

      // Extração de Unidade
      unidade = extractValueByLabel("Unidade:", detailTable);
      contentLogger.debug("Content Script: Unidade extraída:", unidade);

      // Extração de Descrição
      descricao = extractValueByLabel("Descrição:", detailTable);
      contentLogger.debug("Content Script: Descrição extraída:", descricao);

      // Extração de Endereços
      const enderecosListElements = detailTable.querySelectorAll(
        ".enderecosTarefa li span"
      );
      enderecos = Array.from(enderecosListElements).map((el) =>
        el.textContent.trim()
      );
      contentLogger.debug("Content Script: Endereços extraídos:", enderecos);

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
        contentLogger.debug("Content Script: Tarefa parseada:", parsedTask); // Log detalhado da tarefa parseada
        return parsedTask;
      }
    } catch (e) {
      contentLogger.error(
        "Content Script: Erro ao parsear elemento da tarefa:",
        e,
        taskHtmlElement
      );
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
      contentLogger.info(
        "Content Script: Nenhuma tarefa encontrada para processar."
      );
      return; // Nenhuma tarefa encontrada para processar
    }

    contentLogger.info(
      "Content Script: Tarefas encontradas para processamento:",
      foundTasks.length,
      foundTasks
    ); // Log detalhado das tarefas encontradas

    // Filtra as tarefas que são realmente novas (não estão em currentSessionTasks)
    const newTasks = foundTasks.filter(
      (task) =>
        !currentSessionTasks.some((existingTask) => existingTask.id === task.id)
    );

    if (newTasks.length > 0) {
      contentLogger.info(
        "Content Script: Novas tarefas detectadas:",
        newTasks.length,
        newTasks
      ); // Log detalhado das novas tarefas
      // Adiciona as novas tarefas à lista de tarefas da sessão atual
      currentSessionTasks = [...currentSessionTasks, ...newTasks];
      // Envia as novas tarefas para o background script para processamento e notificação
      browserAPI.runtime
        .sendMessage({
          action: "newTasksFound",
          tasks: newTasks,
        })
        .then(() => {
          contentLogger.info(
            "Content Script: Mensagem 'newTasksFound' enviada com sucesso."
          );
        })
        .catch((error) => {
          contentLogger.error(
            "Content Script: Erro ao enviar mensagem 'newTasksFound':",
            error
          );
        });
    } else {
      contentLogger.info(
        "Content Script: Nenhuma nova tarefa detectada nesta verificação."
      );
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
      contentLogger.info(
        "Content Script: Opção 'Novas' não está selecionada. Ignorando processamento de tarefas para evitar notificações desnecessárias."
      );
      return;
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, "text/html");
    const taskElements = doc.querySelectorAll("table.tarefaLista");
    contentLogger.info(
      "Content Script: HTML de tarefas recebido para processamento. Elementos encontrados:",
      taskElements.length
    );
    processTaskElements(taskElements);
  }

  /**
   * Procura por tarefas que já existem na página no momento em que o script é carregado.
   */
  function scanForExistingTasks() {
    // Verifica se a opção "Novas" está selecionada antes de processar tarefas existentes
    if (!isNewTasksOptionSelected()) {
      contentLogger.info(
        "Content Script: Opção 'Novas' não está selecionada. Ignorando escaneamento de tarefas existentes."
      );
      return;
    }

    const taskElements = document.querySelectorAll("table.tarefaLista");
    if (taskElements.length > 0) {
      contentLogger.info(
        `Content Script: Encontradas ${taskElements.length} tarefas pré-existentes no DOM. Processando...`
      );
      processTaskElements(taskElements);
    } else {
      contentLogger.info(
        "Content Script: Nenhuma tarefa pré-existente encontrada no DOM."
      );
    }
  }

  /**
   * Configura um MutationObserver para monitorar mudanças no DOM.
   * Isso serve como um fallback ou complemento à interceptação AJAX,
   * caso as tarefas sejam injetadas diretamente no DOM sem uma requisição XHR óbvia.
   */
  function setupMutationObserver() {
    // Tenta encontrar o elemento que contém a lista de tarefas, ou monitora o body como fallback
    const targetNode = document.getElementById("divLista") || document.body;
    if (!targetNode) {
      contentLogger.warn(
        "Content Script: Elemento alvo para MutationObserver (divLista) não encontrado. Monitoramento de DOM pode ser limitado."
      );
      return;
    }

    // Configuração do observador: observar mudanças na lista de filhos e em subárvores
    const config = { childList: true, subtree: true };

    // Callback que será executado quando houver mutações no DOM
    const callback = function (mutationsList) {
      // Para simplificar e tornar mais robusto, qualquer mudança relevante no DOM
      // (como a adição de nós) aciona uma nova verificação completa por tarefas existentes.
      // A função `scanForExistingTasks` já lida com a filtragem de duplicatas.
      const hasRelevantChanges = mutationsList.some(
        (mutation) =>
          mutation.type === "childList" && mutation.addedNodes.length > 0
      );

      if (hasRelevantChanges) {
        contentLogger.info(
          "Content Script: Mudanças no DOM detectadas pelo MutationObserver. Re-escaneando por tarefas..."
        );
        scanForExistingTasks();
      }
    };

    const observer = new MutationObserver(callback);
    observer.observe(targetNode, config); // Inicia a observação
    contentLogger.info(
      "Content Script: MutationObserver configurado para divLista."
    );
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

    // Cria o HTML para cada tarefa na notificação
    let tasksHtml = tasks
      .map(
        (task) => `
        <div class="sau-notification-item">
            <p><strong>${task.numero}</strong>: ${task.titulo}</p>
            <p class="sau-notification-meta">Envio: ${
              task.dataEnvio
            } | Posição: ${task.posicao}</p>
            <div class="sau-notification-actions">
                <button class="sau-btn-open" data-url="${task.link}" data-id="${
          task.id
        }">Abrir</button>
                <button class="sau-btn-details" data-id="${
                  task.id
                }">Detalhes</button>
                <button class="sau-btn-ignore" data-id="${
                  task.id
                }">Ignorar</button>
                <button class="sau-btn-snooze" data-id="${
                  task.id
                }">Lembrar Mais Tarde</button>
            </div>
            <div class="sau-details-expanded" id="sau-details-${task.id}">
                <p><strong>Solicitante:</strong> ${
                  task.solicitante || "N/A"
                }</p>
                <p><strong>Unidade:</strong> ${task.unidade || "N/A"}</p>
                <p><strong>Descrição:</strong> ${task.descricao || "N/A"}</p>
                ${
                  task.enderecos && task.enderecos.length > 0
                    ? `<p><strong>Endereço(s):</strong> ${task.enderecos
                        .map((addr) => `<span>${addr}</span>`)
                        .join("<br>")}</p>`
                    : ""
                }
                <p><strong>Link:</strong> <a href="${
                  task.link
                }" target="_blank" rel="noopener noreferrer">Abrir no SAU</a></p>
            </div>
        </div>
    `
      )
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
            contentLogger.info(
              `Content Script: Botão 'Detalhes' clicado para a tarefa: ${taskId}. Alternando visibilidade dos detalhes.`
            );
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
    contentLogger.info("Content Script: Inicializando...");

    // Carrega as últimas tarefas conhecidas do storage local para a sessão atual do content script.
    // Isso é importante para que o content script não notifique sobre tarefas já vistas na mesma sessão.
    const data = await browserAPI.storage.local.get("lastKnownTasks");
    currentSessionTasks = data.lastKnownTasks || [];
    contentLogger.info(
      "Content Script: Tarefas conhecidas na sessão:",
      currentSessionTasks.length,
      currentSessionTasks // Log the actual content of currentSessionTasks
    );

    // Lida com a tentativa de login automático se a página atual for a de login
    await handleLoginIfNecessary();

    // Procura por tarefas que já possam existir no DOM no momento do carregamento.
    scanForExistingTasks();

    // Adiciona um listener para receber mensagens do script interceptor (que roda no world: MAIN).
    // Esta é a ponte de comunicação para obter os dados do AJAX.
    window.addEventListener("message", (event) => {
      // Validação de segurança aprimorada
      if (event.source !== window) {
        contentLogger.warn(
          "Content Script: Mensagem de fonte não confiável rejeitada"
        );
        return;
      }

      if (event.origin !== window.location.origin) {
        contentLogger.warn(
          "Content Script: Mensagem de origem incorreta rejeitada:",
          event.origin
        );
        return;
      }

      if (!event.data || typeof event.data !== "object") {
        contentLogger.warn(
          "Content Script: Dados de mensagem inválidos rejeitados"
        );
        return;
      }

      if (event.data.type === "SAU_TASKS_RESPONSE") {
        // Validação adicional do conteúdo
        if (typeof event.data.htmlContent !== "string") {
          contentLogger.warn(
            "Content Script: Conteúdo HTML inválido rejeitado"
          );
          return;
        }

        // Validação de tamanho (limite de 5MB para prevenir ataques de DoS)
        if (event.data.htmlContent.length > 5 * 1024 * 1024) {
          contentLogger.warn(
            "Content Script: Conteúdo HTML muito grande rejeitado"
          );
          return;
        }

        // Validação de timestamp (mensagens não podem ser muito antigas - 30 segundos)
        if (event.data.timestamp && Date.now() - event.data.timestamp > 30000) {
          contentLogger.warn("Content Script: Mensagem muito antiga rejeitada");
          return;
        }

        contentLogger.info(
          "Content Script: Resposta AJAX de tarefas recebida do interceptor."
        );
        processTasksHtml(event.data.htmlContent);
      }
    });

    // Configura o MutationObserver como um complemento/fallback para detectar mudanças no DOM
    setupMutationObserver();

    // Adiciona um listener para mensagens enviadas do background script para este content script.
    // Isso é usado para injetar a UI de notificação visual.
    browserAPI.runtime.onMessage.addListener(
      (message, sender, sendResponse) => {
        // O listener padrão e seguro para comunicação entre background e content scripts.
        if (message.action === "showNotificationUI") {
          contentLogger.info(
            "Content Script: Mensagem para mostrar UI de notificação recebida do Background:",
            message.tasks
          );
          // Injeta a UI de notificação visual na página
          injectNotificationUI(message.tasks);
          // Opcional: responder ao background que a ação foi concluída.
          // sendResponse({ status: "UI Injetada com sucesso" });
        }
      }
    );

    // Se o content script for injetado na página de consulta de tarefas,
    // simula um clique no botão de pesquisa para carregar as tarefas iniciais.
    if (window.location.href.startsWith(SAU_PREPARAR_PESQUISAR_TAREFA_URL)) {
      contentLogger.info(
        'Content Script: Página de consulta de tarefas ativa. Tentando simular clique em "Pesquisar" para verificação inicial.'
      );
      const searchButton = document.getElementById("btn_pesquisarTarefaForm"); // Botão de pesquisa principal
      const searchButtonAdvanced = document.getElementById(
        "btn_pesquisarTarefaFormAvancado"
      ); // Botão de pesquisa avançada

      if (searchButton) {
        searchButton.click();
        contentLogger.info(
          "Content Script: Botão de pesquisa principal clicado."
        );
      } else if (searchButtonAdvanced) {
        searchButtonAdvanced.click();
        contentLogger.info(
          "Content Script: Botão de pesquisa avançada clicado."
        );
      } else {
        contentLogger.warn(
          "Content Script: Nenhum botão de pesquisa de tarefas encontrado. A verificação inicial pode não ocorrer automaticamente."
        );
      }
    } else if (window.location.href.startsWith(SAU_HOME_URL)) {
      // Se o script for injetado na página inicial após o login,
      // redireciona para a página de consulta de tarefas para iniciar o processo.
      contentLogger.info(
        "Content Script: Página inicial (home) detectada. Redirecionando para a página de consulta de tarefas..."
      );
      window.location.href = SAU_PREPARAR_PESQUISAR_TAREFA_URL;
    }
  })();
})(); // Fecha o IIFE do injection guard
