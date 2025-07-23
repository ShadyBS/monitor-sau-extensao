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
browserAPI.runtime.onMessage.addListener((request, sender, sendResponse) => {
  popupLogger.debug("Mensagem recebida no popup:", request);
  // Se a mensagem for para atualizar o popup
  if (request.action === "updatePopup") {
    popupLogger.info(
      "Mensagem de atualização de popup recebida. Exibindo tarefas."
    );
    displayTasks(request.newTasks); // Atualiza a exibição das tarefas
    document.getElementById("status-message").textContent = request.message; // Atualiza a mensagem de status
  }
});

/**
 * Carrega os dados mais recentes das tarefas do background script e os exibe no popup.
 */
async function loadPopupData() {
  popupLogger.info("Carregando dados iniciais do popup...");
  // Solicita ao background script as últimas tarefas e o status
  browserAPI.runtime.sendMessage({ action: "getLatestTasks" }, (response) => {
    if (response) {
      popupLogger.debug("Dados de tarefas recebidos do background:", response);
      displayTasks(response.newTasks);
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
 */
function displayTasks(tasks) {
  const tasksList = document.getElementById("tasks-list");
  tasksList.innerHTML = ""; // Limpa a lista existente antes de adicionar novas tarefas

  // Se não houver tarefas, exibe uma mensagem
  if (tasks.length === 0) {
    tasksList.innerHTML =
      '<p class="no-tasks">Nenhuma tarefa nova encontrada.</p>';
    popupLogger.info("Nenhuma tarefa para exibir no popup.");
    return;
  }

  // Itera sobre as tarefas e cria elementos HTML para cada uma
  tasks.forEach((task) => {
    const taskElement = document.createElement("div");
    taskElement.className = "task-item";
    taskElement.innerHTML = `
            <p><strong>${task.numero}</strong>: ${task.titulo}</p>
            <p class="task-meta">Envio: ${task.dataEnvio} | Posição: ${task.posicao}</p>
            <div class="task-actions">
                <button data-action="open" data-url="${task.link}">Abrir</button>
                <button data-action="ignore" data-id="${task.id}">Ignorar</button>
                <button data-action="snooze" data-id="${task.id}">Lembrar Mais Tarde</button>
            </div>
        `;
    tasksList.appendChild(taskElement);

    // Adiciona event listeners para os botões de ação de cada tarefa
    taskElement
      .querySelector('[data-action="open"]')
      .addEventListener("click", (e) => {
        const url = e.target.dataset.url;
        popupLogger.info(`Botão 'Abrir' clicado para a tarefa: ${task.id}`);
        // Abre a URL da tarefa em uma nova aba
        browserAPI.tabs.create({ url: url });
        window.close(); // Fecha o popup após abrir a tarefa
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
      .addEventListener("click", (e) => {
        const taskId = e.target.dataset.id;
        popupLogger.info(
          `Botão 'Lembrar Mais Tarde' clicado para a tarefa: ${taskId}`
        );
        // Envia uma mensagem para o background script para "snooze" esta tarefa
        browserAPI.runtime.sendMessage({
          action: "snoozeTask",
          taskId: taskId,
        });
        e.target.closest(".task-item").remove(); // Remove o item da lista no popup
        // Se não houver mais tarefas, exibe a mensagem de "nenhuma tarefa"
        if (tasksList.children.length === 0) {
          tasksList.innerHTML =
            '<p class="no-tasks">Nenhuma tarefa nova encontrada.</p>';
          popupLogger.info("Todas as tarefas removidas do popup após snoozar.");
        }
      });
  });
}
