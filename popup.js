// Importa o logger e o instancia para o contexto do popup
import { logger } from "./logger.js";
const popupLogger = logger("[Popup]");

// Define o objeto de API do navegador de forma compatível (Chrome ou Firefox)
const browserAPI = globalThis.browser || globalThis.chrome;

// Adiciona um listener para quando o DOM estiver completamente carregado
document.addEventListener("DOMContentLoaded", loadPopupData);

// Adiciona um listener de clique para abrir a página de opções
document.getElementById("openOptions").addEventListener("click", () => {
  popupLogger.info('Botão "Configurações" clicado. Abrindo página de opções.');
  browserAPI.runtime.openOptionsPage();
});

// Adiciona um listener de clique para forçar uma atualização manual de tarefas
document.getElementById("refreshTasks").addEventListener("click", () => {
  document.getElementById("status-message").textContent = "Atualizando...";
  popupLogger.info(
    'Botão "Atualizar Agora" clicado. Solicitando verificação manual.'
  );
  // Envia uma mensagem para o background script para iniciar uma verificação manual
  browserAPI.runtime.sendMessage({ action: "manualCheck" });
});

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
  // Solicita ao background script as últimas tarefas e o status
  browserAPI.runtime.sendMessage({ action: "getLatestTasks" }, async (response) => {
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
  });
}

/**
 * Exibe a lista de tarefas no popup.
 * @param {Array<Object>} tasks - Um array de objetos de tarefa a serem exibidos.
 * @param {Object} displaySettings - Configurações de exibição das tarefas.
 */
function displayTasks(tasks, displaySettings = null) {
  const tasksList = document.getElementById("tasks-list");
  tasksList.innerHTML = ""; // Limpa a lista existente antes de adicionar novas tarefas

  // Se não houver tarefas, exibe uma mensagem
  if (tasks.length === 0) {
    tasksList.innerHTML =
      '<p class="no-tasks">Nenhuma tarefa nova encontrada.</p>';
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

  // Itera sobre as tarefas e cria elementos HTML para cada uma
  tasks.forEach((task) => {
    const taskElement = document.createElement("div");
    taskElement.className = "task-item";
    
    // Constrói o cabeçalho da tarefa baseado nas configurações
    let headerHTML = `<p><strong>${task.numero}</strong>: ${task.titulo}</p>`;
    
    // Constrói a linha de metadados do cabeçalho
    let metaItems = [];
    if (displaySettings.dataEnvio) {
      metaItems.push(`Envio: ${task.dataEnvio}`);
    }
    if (displaySettings.posicao) {
      metaItems.push(`Posição: ${task.posicao}`);
    }
    if (displaySettings.solicitante && task.solicitante) {
      metaItems.push(`Solicitante: ${task.solicitante}`);
    }
    if (displaySettings.unidade && task.unidade) {
      metaItems.push(`Unidade: ${task.unidade}`);
    }
    
    if (metaItems.length > 0) {
      headerHTML += `<p class="task-meta">${metaItems.join(' | ')}</p>`;
    }

    // Constrói os detalhes expandidos (informações que não estão no cabeçalho)
    let detailsHTML = '';
    
    if (!displaySettings.solicitante) {
      detailsHTML += `<p><strong>Solicitante:</strong> ${task.solicitante || "N/A"}</p>`;
    }
    if (!displaySettings.unidade) {
      detailsHTML += `<p><strong>Unidade:</strong> ${task.unidade || "N/A"}</p>`;
    }
    if (!displaySettings.dataEnvio) {
      detailsHTML += `<p><strong>Data de Envio:</strong> ${task.dataEnvio || "N/A"}</p>`;
    }
    if (!displaySettings.posicao) {
      detailsHTML += `<p><strong>Posição:</strong> ${task.posicao || "N/A"}</p>`;
    }
    
    // Sempre mostra descrição, endereços e link nos detalhes
    detailsHTML += `<p><strong>Descrição:</strong> ${task.descricao || "N/A"}</p>`;
    if (task.enderecos && task.enderecos.length > 0) {
      detailsHTML += `<p><strong>Endereço(s):</strong> ${task.enderecos
        .map((addr) => `<span>${addr}</span>`)
        .join("<br>")}</p>`;
    }
    detailsHTML += `<p><strong>Link:</strong> <a href="${task.link}" target="_blank" rel="noopener noreferrer">Abrir no SAU</a></p>`;

    taskElement.innerHTML = `
            ${headerHTML}
            <div class="task-actions">
                <button data-action="open" data-url="${task.link}" data-id="${task.id}">Abrir</button>
                <button data-action="details" data-id="${task.id}">Detalhes</button>
                <button data-action="ignore" data-id="${task.id}">Ignorar</button>
                <button data-action="snooze" data-id="${task.id}">Lembrar Mais Tarde</button>
            </div>
            <div class="task-details-expanded" id="details-${task.id}">
                ${detailsHTML}
            </div>
        `;
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
          tasksList.innerHTML =
            '<p class="no-tasks">Nenhuma tarefa nova encontrada.</p>';
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
          <input type="number" id="custom-hours" min="0" max="23" value="0" placeholder="0">
          <label>h</label>
          <input type="number" id="custom-minutes" min="0" max="59" value="15" placeholder="15">
          <label>min</label>
        </div>
        <div class="snooze-custom-buttons">
          <button class="btn-primary" onclick="applyCustomSnooze('${taskId}')">Aplicar</button>
          <button class="btn-secondary" onclick="closeSnoozeDropdown()">Cancelar</button>
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
  
  // Posiciona o dropdown
  button.style.position = 'relative';
  button.appendChild(dropdown);
  
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
  const hours = parseInt(document.getElementById('custom-hours').value) || 0;
  const minutes = parseInt(document.getElementById('custom-minutes').value) || 0;
  const totalMinutes = hours * 60 + minutes;
  
  if (totalMinutes <= 0) {
    alert('Por favor, insira um tempo válido.');
    return;
  }
  
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
    tasksList.innerHTML = '<p class="no-tasks">Nenhuma tarefa nova encontrada.</p>';
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

// Torna as funções globais para serem acessíveis pelo onclick
window.applyCustomSnooze = applyCustomSnooze;
window.closeSnoozeDropdown = closeSnoozeDropdown;