// Importa o logger e o instancia para o contexto do popup
import { logger } from "./logger.js";
import { createSafeTaskElement, sanitizeTaskData, safelyPopulateContainer, createSafeElement, setSafeTextContent } from "./sanitizer.js";
import { tooltipSystem } from "./tooltip-system.js";
const popupLogger = logger("[Popup]");

// Define o objeto de API do navegador de forma compatível (Chrome ou Firefox)
const browserAPI = globalThis.browser || globalThis.chrome;

// Adiciona um listener para quando o DOM estiver completamente carregado
document.addEventListener("DOMContentLoaded", initializePopup);

/**
 * Carrega as configurações de exibição de tarefas do storage
 */
async function getDisplaySettings() {
  try {
    const data = await browserAPI.storage.local.get(["taskDisplaySettings"]);
    if (data.taskDisplaySettings && data.taskDisplaySettings.headerFields) {
      return data.taskDisplaySettings.headerFields;
    } else {
      // Configurações padrão
      return {
        numero: true,
        titulo: true,
        dataEnvio: true,
        posicao: true,
        solicitante: false,
        unidade: false,
      };
    }
  } catch (error) {
    popupLogger.error("Erro ao carregar configurações de exibição:", error);
    // Retorna configurações padrão em caso de erro
    return {
      numero: true,
      titulo: true,
      dataEnvio: true,
      posicao: true,
      solicitante: false,
      unidade: false,
    };
  }
}

/**
 * Carrega as configurações de snooze do storage
 */
async function getSnoozeSettings() {
  try {
    const data = await browserAPI.storage.local.get(["snoozeSettings"]);
    if (data.snoozeSettings) {
      return data.snoozeSettings;
    } else {
      // Configurações padrão
      return {
        options: [
          { hours: 0, minutes: 15, totalMinutes: 15 },
          { hours: 0, minutes: 30, totalMinutes: 30 },
          { hours: 1, minutes: 0, totalMinutes: 60 },
          { hours: 2, minutes: 0, totalMinutes: 120 },
          { hours: 4, minutes: 0, totalMinutes: 240 }
        ],
        allowCustom: true
      };
    }
  } catch (error) {
    popupLogger.error("Erro ao carregar configurações de snooze:", error);
    // Retorna configurações padrão em caso de erro
    return {
      options: [
        { hours: 0, minutes: 15, totalMinutes: 15 },
        { hours: 0, minutes: 30, totalMinutes: 30 },
        { hours: 1, minutes: 0, totalMinutes: 60 },
        { hours: 2, minutes: 0, totalMinutes: 120 },
        { hours: 4, minutes: 0, totalMinutes: 240 }
      ],
      allowCustom: true
    };
  }
}

async function loadPopupData() {
  popupLogger.info("Carregando dados iniciais do popup...");
  try {
    // Solicita ao background script as últimas tarefas e o status usando Promise
    const response = await new Promise((resolve, reject) => {
      browserAPI.runtime.sendMessage({ action: "getLatestTasks" }, (response) => {
        if (browserAPI.runtime.lastError) {
          reject(browserAPI.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    });

    if (response) {
      popupLogger.debug("Dados de tarefas recebidos do background:", response);
      const displaySettings = await getDisplaySettings();
      displayTasks(response.newTasks, displaySettings);
      document.getElementById("status-message").textContent =
        response.message ||
        "Última verificação: " +
          new Date(response.lastCheck).toLocaleTimeString();
    } else {
      popupLogger.warn("Nenhuma resposta de tarefas recebida do background.");
      document.getElementById("status-message").textContent =
        "Nenhuma tarefa nova.";
    }
  } catch (error) {
    popupLogger.error("Erro ao carregar dados do popup:", error);
    document.getElementById("status-message").textContent =
      "Erro ao carregar dados. Tente atualizar.";
  }
}

/**
 * Exibe a lista de tarefas no popup.
 * @param {Array<Object>} tasks - Um array de objetos de tarefa a serem exibidos.
 * @param {Object} displaySettings - Configurações de exibição das tarefas.
 */
function displayTasks(tasks, displaySettings = null) {
  const tasksList = document.getElementById("tasks-list");
  
  // Limpa a lista existente de forma segura
  safelyPopulateContainer(tasksList, []);

  // Se não houver tarefas, exibe uma mensagem
  if (tasks.length === 0) {
    const noTasksP = createSafeElement('p', 'Nenhuma tarefa nova encontrada.', { class: 'no-tasks' });
    tasksList.appendChild(noTasksP);
    popupLogger.info("Nenhuma tarefa para exibir no popup.");
    return;
  }

  // Se não há configurações, usa as padrão
  if (!displaySettings) {
    displaySettings = {
      numero: true,
      titulo: true,
      dataEnvio: true,
      posicao: true,
      solicitante: false,
      unidade: false,
    };
  }

  // Itera sobre as tarefas e cria elementos HTML para cada uma de forma segura
  tasks.forEach((task) => {
    // Sanitiza os dados da tarefa
    const sanitizedTask = sanitizeTaskData(task);
    if (!sanitizedTask) {
      popupLogger.warn(`Tarefa inválida ignorada: ${task?.id || 'unknown'}`);
      return;
    }
    
    // Cria o elemento da tarefa de forma segura
    const taskElement = createSafeTaskElement(sanitizedTask, displaySettings);
    tasksList.appendChild(taskElement);

    // Adiciona event listeners para os botões de ação de cada tarefa
    taskElement
      .querySelector('[data-action="open"]')
      .addEventListener("click", (e) => {
        const url = e.target.dataset.url;
        const taskId = e.target.dataset.id; // Pega o ID da tarefa
        popupLogger.info(`Botão 'Abrir' clicado para a tarefa: ${taskId}`);

        // Envia mensagem para o background script para marcar a tarefa como aberta
        browserAPI.runtime.sendMessage({
          action: "markTaskAsOpened",
          taskId: taskId,
        });

        // Abre a URL da tarefa em uma nova aba
        browserAPI.tabs.create({ url: url });
        window.close(); // Fecha o popup após abrir a tarefa
      });

    taskElement
      .querySelector('[data-action="details"]')
      .addEventListener("click", () => {
        popupLogger.info(
          `Botão 'Detalhes' clicado para a tarefa: ${task.id}. Alternando visibilidade dos detalhes.`
        );
        const detailsDiv = document.getElementById(`details-${task.id}`);
        detailsDiv.classList.toggle("expanded");
      });

    taskElement
      .querySelector('[data-action="ignore"]')
      .addEventListener("click", (e) => {
        const taskId = e.target.dataset.id;
        popupLogger.info(`Botão 'Ignorar' clicado para a tarefa: ${taskId}`);
        // Envia uma mensagem para o background script para ignorar esta tarefa
        browserAPI.runtime.sendMessage({
          action: "ignoreTask",
          taskId: taskId,
        });
        e.target.closest(".task-item").remove(); // Remove o item da lista no popup
        // Se não houver mais tarefas, exibe a mensagem de "nenhuma tarefa"
        if (tasksList.children.length === 0) {
          const noTasksP = createSafeElement('p', 'Nenhuma tarefa nova encontrada.', { class: 'no-tasks' });
          tasksList.appendChild(noTasksP);
          popupLogger.info("Todas as tarefas removidas do popup após ignorar.");
        }
      });

    taskElement
      .querySelector('[data-action="snooze"]')
      .addEventListener("click", async (e) => {
        const taskId = e.target.dataset.id;
        popupLogger.info(
          `Botão 'Lembrar Mais Tarde' clicado para a tarefa: ${taskId}`
        );
        
        // Mostra o dropdown de opções de snooze
        await showSnoozeDropdown(e.target, taskId);
      });
  });
}

/**
 * Mostra o dropdown de opções de snooze
 */
async function showSnoozeDropdown(button, taskId) {
  // Remove qualquer dropdown existente
  const existingDropdown = document.querySelector('.snooze-dropdown');
  if (existingDropdown) {
    existingDropdown.remove();
  }

  const snoozeSettings = await getSnoozeSettings();
  
  // Cria o dropdown
  const dropdown = document.createElement('div');
  dropdown.className = 'snooze-dropdown show';
  
  let dropdownHTML = '';
  
  // Adiciona as opções pré-configuradas
  snoozeSettings.options.forEach(option => {
    const label = formatSnoozeTime(option.hours, option.minutes);
    dropdownHTML += `<div class="snooze-option" data-minutes="${option.totalMinutes}">${label}</div>`;
  });
  
  // Adiciona opção personalizada se permitida
  if (snoozeSettings.allowCustom) {
    dropdownHTML += `
      <div class="snooze-custom">
        <div class="snooze-custom-inputs">
          <input type="number" id="custom-hours-${taskId}" min="0" max="23" value="0" placeholder="0">
          <label>h</label>
          <input type="number" id="custom-minutes-${taskId}" min="0" max="59" value="15" placeholder="15">
          <label>min</label>
        </div>
        <div class="snooze-custom-buttons">
          <button class="btn-primary" data-action="apply-custom" data-task-id="${taskId}">Aplicar</button>
          <button class="btn-secondary" data-action="cancel-custom">Cancelar</button>
        </div>
      </div>
    `;
  }
  
  dropdown.innerHTML = dropdownHTML;
  
  // Adiciona event listeners para as opções pré-configuradas
  dropdown.querySelectorAll('.snooze-option').forEach(option => {
    option.addEventListener('click', () => {
      const minutes = parseInt(option.dataset.minutes);
      applySnooze(taskId, minutes);
    });
  });
  
  // Adiciona event listeners para os botões customizados
  const applyButton = dropdown.querySelector('[data-action="apply-custom"]');
  if (applyButton) {
    applyButton.addEventListener('click', () => {
      const currentTaskId = applyButton.dataset.taskId;
      applyCustomSnooze(currentTaskId);
    });
  }
  
  const cancelButton = dropdown.querySelector('[data-action="cancel-custom"]');
  if (cancelButton) {
    cancelButton.addEventListener('click', () => {
      closeSnoozeDropdown();
    });
  }
  
  // Adiciona o dropdown ao body para evitar problemas de overflow
  document.body.appendChild(dropdown);
  
  // Posiciona o dropdown próximo ao botão
  const buttonRect = button.getBoundingClientRect();
  const dropdownRect = dropdown.getBoundingClientRect();
  
  // Calcula a posição ideal
  let top = buttonRect.bottom + 5; // 5px abaixo do botão
  let left = buttonRect.left;
  
  // Verifica se o dropdown sairia da tela pela direita
  if (left + dropdownRect.width > window.innerWidth) {
    left = buttonRect.right - dropdownRect.width;
  }
  
  // Verifica se o dropdown sairia da tela por baixo
  if (top + dropdownRect.height > window.innerHeight) {
    top = buttonRect.top - dropdownRect.height - 5; // 5px acima do botão
  }
  
  // Aplica a posição
  dropdown.style.top = `${top}px`;
  dropdown.style.left = `${left}px`;
  
  // Fecha o dropdown ao clicar fora
  setTimeout(() => {
    document.addEventListener('click', closeSnoozeDropdownOnOutsideClick);
  }, 100);
}

/**
 * Formata o tempo de snooze para exibição
 */
function formatSnoozeTime(hours, minutes) {
  if (hours === 0) {
    return `${minutes} minuto${minutes !== 1 ? 's' : ''}`;
  } else if (minutes === 0) {
    return `${hours} hora${hours !== 1 ? 's' : ''}`;
  } else {
    return `${hours}h ${minutes}min`;
  }
}

/**
 * Aplica o snooze com tempo personalizado
 */
function applyCustomSnooze(taskId) {
  const hoursInput = document.getElementById(`custom-hours-${taskId}`);
  const minutesInput = document.getElementById(`custom-minutes-${taskId}`);
  
  if (!hoursInput || !minutesInput) {
    popupLogger.error(`Inputs de tempo personalizado não encontrados para tarefa ${taskId}`);
    alert('Erro interno: campos de tempo não encontrados.');
    return;
  }
  
  const hours = parseInt(hoursInput.value) || 0;
  const minutes = parseInt(minutesInput.value) || 0;
  const totalMinutes = hours * 60 + minutes;
  
  if (totalMinutes <= 0) {
    alert('Por favor, insira um tempo válido.');
    return;
  }
  
  popupLogger.info(`Aplicando snooze personalizado: ${hours}h ${minutes}min (${totalMinutes} minutos) para tarefa ${taskId}`);
  applySnooze(taskId, totalMinutes);
}

/**
 * Aplica o snooze para uma tarefa
 */
function applySnooze(taskId, minutes) {
  popupLogger.info(`Aplicando snooze de ${minutes} minutos para a tarefa: ${taskId}`);
  
  // Envia uma mensagem para o background script para "snooze" esta tarefa
  browserAPI.runtime.sendMessage({
    action: "snoozeTask",
    taskId: taskId,
    snoozeMinutes: minutes
  });
  
  // Remove o item da lista no popup
  const taskItem = document.querySelector(`[data-id="${taskId}"]`).closest(".task-item");
  taskItem.remove();
  
  // Se não houver mais tarefas, exibe a mensagem de "nenhuma tarefa"
  const tasksList = document.getElementById("tasks-list");
  if (tasksList.children.length === 0) {
    const noTasksP = createSafeElement('p', 'Nenhuma tarefa nova encontrada.', { class: 'no-tasks' });
    tasksList.appendChild(noTasksP);
    popupLogger.info("Todas as tarefas removidas do popup após snoozar.");
  }
  
  // Fecha o dropdown
  closeSnoozeDropdown();
}

/**
 * Fecha o dropdown de snooze
 */
function closeSnoozeDropdown() {
  const dropdown = document.querySelector('.snooze-dropdown');
  if (dropdown) {
    dropdown.remove();
  }
  document.removeEventListener('click', closeSnoozeDropdownOnOutsideClick);
}

/**
 * Fecha o dropdown ao clicar fora dele
 */
function closeSnoozeDropdownOnOutsideClick(event) {
  const dropdown = document.querySelector('.snooze-dropdown');
  if (dropdown && !dropdown.contains(event.target) && !event.target.closest('[data-action="snooze"]')) {
    closeSnoozeDropdown();
  }
}

/**
 * Inicializa o popup com todas as funcionalidades
 */
async function initializePopup() {
  popupLogger.info("Inicializando popup...");
  
  // Configura event listeners dos botões principais
  setupMainEventListeners();
  
  // Carrega dados do popup
  await loadPopupData();
  
  // Configura sistema de ajuda
  setupHelpSystem();
  
  // Verifica se deve mostrar ajuda para novos usuários
  await checkFirstTimeUser();
}

/**
 * Configura os event listeners dos botões principais
 */
function setupMainEventListeners() {
  // Adiciona um listener de clique para abrir a página de opções
  const openOptionsButton = document.getElementById("openOptions");
  if (openOptionsButton) {
    openOptionsButton.addEventListener("click", async () => {
      popupLogger.info('Botão "Configurações" clicado. Abrindo página de opções.');
      try {
        await browserAPI.runtime.openOptionsPage();
      } catch (error) {
        popupLogger.error('Erro ao abrir página de opções:', error);
        // Fallback: abre em nova aba
        try {
          await browserAPI.tabs.create({ url: browserAPI.runtime.getURL('options.html') });
        } catch (fallbackError) {
          popupLogger.error('Erro no fallback para abrir opções:', fallbackError);
        }
      }
    });
  }

  // Adiciona um listener de clique para forçar uma atualização manual de tarefas
  const refreshTasksButton = document.getElementById("refreshTasks");
  if (refreshTasksButton) {
    refreshTasksButton.addEventListener("click", () => {
      document.getElementById("status-message").textContent = "Atualizando...";
      popupLogger.info(
        'Botão "Atualizar Agora" clicado. Solicitando verificação manual.'
      );
      // Envia uma mensagem para o background script para iniciar uma verificação manual
      browserAPI.runtime.sendMessage({ action: "manualCheck" });
    });
  }

  // Adiciona um listener para mensagens recebidas do background script
  browserAPI.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    popupLogger.debug("Mensagem recebida no popup:", request);
    // Se a mensagem for para atualizar o popup
    if (request.action === "updatePopup") {
      popupLogger.info(
        "Mensagem de atualização de popup recebida. Exibindo tarefas."
      );
      const displaySettings = await getDisplaySettings();
      displayTasks(request.newTasks, displaySettings); // Atualiza a exibição das tarefas
      document.getElementById("status-message").textContent = request.message; // Atualiza a mensagem de status
    }
  });
}

/**
 * Configura o sistema de ajuda do popup
 */
function setupHelpSystem() {
  // Botão principal de ajuda
  const helpButton = document.getElementById('helpButton');
  if (helpButton) {
    helpButton.addEventListener('click', openHelpPage);
    
    // Adiciona tooltip ao botão de ajuda
    tooltipSystem.addTooltip(helpButton, {
      title: '🎯 Central de Ajuda',
      content: 'Clique para abrir o guia completo da extensão com tutoriais, configurações e solução de problemas.',
      tip: 'Ideal para novos usuários ou quando precisar de ajuda específica',
      position: 'bottom',
      trigger: 'hover'
    });
  }
  
  // Adiciona tooltips aos botões principais
  const configButton = document.getElementById('openOptions');
  if (configButton) {
    tooltipSystem.addTooltip(configButton, {
      title: '⚙️ Configurações',
      content: 'Configure suas credenciais do SAU, intervalos de verificação, opções de notificação e personalização da interface.',
      position: 'top',
      trigger: 'hover'
    });
  }
  
  const refreshButton = document.getElementById('refreshTasks');
  if (refreshButton) {
    tooltipSystem.addTooltip(refreshButton, {
      title: '🔄 Atualizar Agora',
      content: 'Força uma verificação imediata por novas tarefas no SAU, ignorando o intervalo configurado.',
      position: 'top',
      trigger: 'hover'
    });
  }
  
  // Configura botões da ajuda contextual
  const startTourButton = document.getElementById('startQuickTour');
  if (startTourButton) {
    startTourButton.addEventListener('click', startQuickTour);
  }
  
  const dismissHelpButton = document.getElementById('dismissFirstTimeHelp');
  if (dismissHelpButton) {
    dismissHelpButton.addEventListener('click', dismissFirstTimeHelp);
  }
}

/**
 * Verifica se é a primeira vez do usuário
 */
async function checkFirstTimeUser() {
  try {
    const data = await browserAPI.storage.local.get([
      'helpTourCompleted', 
      'firstTimeUser', 
      'helpDismissed',
      'username' // Verifica se já configurou credenciais
    ]);
    
    // Se é primeira vez, não fez tour, não dispensou ajuda e não tem credenciais
    const isFirstTime = data.firstTimeUser !== false;
    const hasCredentials = data.username && data.username.trim() !== '';
    const tourCompleted = data.helpTourCompleted === true;
    const helpDismissed = data.helpDismissed === true;
    
    if (isFirstTime && !hasCredentials && !tourCompleted && !helpDismissed) {
      showFirstTimeHelp();
    }
  } catch (error) {
    popupLogger.error("Erro ao verificar status de primeiro uso:", error);
  }
}

/**
 * Mostra ajuda para novos usuários
 */
function showFirstTimeHelp() {
  const helpElement = document.getElementById('firstTimeHelp');
  if (helpElement) {
    helpElement.style.display = 'block';
    popupLogger.info("Ajuda para novos usuários exibida");
  }
}

/**
 * Inicia tour rápido
 */
async function startQuickTour() {
  popupLogger.info("Iniciando tour rápido do popup");
  
  // Esconde a ajuda contextual
  dismissFirstTimeHelp();
  
  // Define passos do tour rápido
  const tourSteps = [
    {
      element: '.popup-header h1',
      title: '🚀 Monitor SAU',
      content: 'Esta é a interface principal da extensão. Aqui você vê suas tarefas novas e pode gerenciá-las.',
      position: 'bottom'
    },
    {
      element: '#helpButton',
      title: '❓ Botão de Ajuda',
      content: 'Clique aqui sempre que precisar de ajuda. Abre um guia completo com todas as funcionalidades.',
      position: 'bottom'
    },
    {
      element: '#status-message',
      title: '📊 Status da Extensão',
      content: 'Aqui você vê o status atual: se está verificando tarefas, quando foi a última verificação, etc.',
      position: 'bottom'
    },
    {
      element: '#tasks-list',
      title: '📋 Lista de Tarefas',
      content: 'Suas tarefas novas aparecem aqui. Você pode abrir, ignorar, ver detalhes ou adiar cada tarefa.',
      position: 'top'
    },
    {
      element: '#openOptions',
      title: '⚙️ Configurações',
      content: 'IMPORTANTE: Configure suas credenciais do SAU aqui para a extensão funcionar.',
      position: 'top'
    },
    {
      element: '#refreshTasks',
      title: '🔄 Atualizar',
      content: 'Use este botão para verificar tarefas imediatamente, sem esperar o intervalo automático.',
      position: 'top'
    }
  ];
  
  // Inicia o tour usando o sistema de tooltips
  runQuickTour(tourSteps);
}

/**
 * Executa o tour rápido
 */
function runQuickTour(steps) {
  let currentStep = 0;
  
  function showStep(stepIndex) {
    if (stepIndex >= steps.length) {
      completeTour();
      return;
    }
    
    const step = steps[stepIndex];
    const element = document.querySelector(step.element);
    
    if (!element) {
      popupLogger.warn(`Elemento não encontrado para o passo ${stepIndex}: ${step.element}`);
      showStep(stepIndex + 1);
      return;
    }
    
    // Remove tooltip anterior
    tooltipSystem.hideTooltip();
    
    // Cria tooltip especial para o tour
    const tourTooltip = {
      title: step.title,
      content: step.content + `<br><br><div style="text-align: center; margin-top: 10px;">
        ${stepIndex > 0 ? '<button onclick="tourPrev()" style="margin-right: 8px; padding: 4px 8px; border: none; border-radius: 4px; background: #ccc; cursor: pointer;">← Anterior</button>' : ''}
        <button onclick="tourSkip()" style="margin-right: 8px; padding: 4px 8px; border: none; border-radius: 4px; background: #f44336; color: white; cursor: pointer;">Pular</button>
        <button onclick="tourNext()" style="padding: 4px 8px; border: none; border-radius: 4px; background: #2196f3; color: white; cursor: pointer;">
          ${stepIndex === steps.length - 1 ? 'Finalizar' : 'Próximo →'}
        </button>
        <br><small style="color: #666; margin-top: 5px; display: block;">${stepIndex + 1} de ${steps.length}</small>
      </div>`,
      position: step.position,
      trigger: 'manual'
    };
    
    tooltipSystem.addTooltip(element, tourTooltip);
    tooltipSystem.showTooltip(element);
  }
  
  // Funções de controle do tour
  window.tourNext = () => {
    currentStep++;
    showStep(currentStep);
  };
  
  window.tourPrev = () => {
    if (currentStep > 0) {
      currentStep--;
      showStep(currentStep);
    }
  };
  
  window.tourSkip = () => {
    completeTour();
  };
  
  function completeTour() {
    tooltipSystem.hideTooltip();
    markTourCompleted();
    showTourCompletedMessage();
    
    // Limpa funções globais
    delete window.tourNext;
    delete window.tourPrev;
    delete window.tourSkip;
  }
  
  // Inicia o tour
  showStep(0);
}

/**
 * Marca o tour como completado
 */
async function markTourCompleted() {
  try {
    await browserAPI.storage.local.set({ 
      helpTourCompleted: true,
      firstTimeUser: false,
      helpTourCompletedAt: new Date().toISOString()
    });
    popupLogger.info("Tour rápido marcado como completado");
  } catch (error) {
    popupLogger.error("Erro ao marcar tour como completado:", error);
  }
}

/**
 * Mostra mensagem de tour completado
 */
function showTourCompletedMessage() {
  // Cria elemento de notificação
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: #4caf50;
    color: white;
    padding: 12px 16px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10000;
    font-size: 14px;
    animation: slideInRight 0.3s ease;
  `;
  
  notification.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px;">
      <span>🎉</span>
      <span>Tour completado! Agora configure suas credenciais.</span>
      <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; color: white; cursor: pointer; font-size: 16px; margin-left: 8px;">×</button>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  // Remove automaticamente após 5 segundos
  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
    }
  }, 5000);
}

/**
 * Dispensa a ajuda para novos usuários
 */
async function dismissFirstTimeHelp() {
  const helpElement = document.getElementById('firstTimeHelp');
  if (helpElement) {
    helpElement.style.display = 'none';
  }
  
  try {
    await browserAPI.storage.local.set({ 
      helpDismissed: true,
      firstTimeUser: false 
    });
    popupLogger.info("Ajuda para novos usuários dispensada");
  } catch (error) {
    popupLogger.error("Erro ao dispensar ajuda:", error);
  }
}

/**
 * Abre a página de ajuda completa
 */
function openHelpPage() {
  popupLogger.info("Abrindo página de ajuda");
  
  // Abre a página de ajuda em uma nova aba
  browserAPI.tabs.create({ 
    url: browserAPI.runtime.getURL('help.html')
  });
  
  // Fecha o popup
  window.close();
}

// Torna as funções globais para serem acessíveis pelo onclick
window.applyCustomSnooze = applyCustomSnooze;
window.closeSnoozeDropdown = closeSnoozeDropdown;
window.startQuickTour = startQuickTour;
window.dismissFirstTimeHelp = dismissFirstTimeHelp;