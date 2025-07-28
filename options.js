import { logger, LOG_LEVELS } from "./logger.js";
import {
  setConfig,
  setConfigs,
  getConfig,
  getConfigs,
  getStorageInfo,
  migrateToSync,
} from "./config-manager.js";

const optionsLogger = logger("[Options]");

// Define o objeto de API do navegador de forma compatível (Chrome ou Firefox)
const browserAPI = globalThis.browser || globalThis.chrome;

document.addEventListener("DOMContentLoaded", loadOptions);

document.getElementById("saveLogin").addEventListener("click", saveLogin);
document.getElementById("saveSettings").addEventListener("click", saveSettings);
document
  .getElementById("saveDisplaySettings")
  .addEventListener("click", saveDisplaySettings);
document
  .getElementById("saveSnoozeSettings")
  .addEventListener("click", saveSnoozeSettings);
document
  .getElementById("addSnoozeOption")
  .addEventListener("click", addSnoozeOption);
document.getElementById("saveLogLevel").addEventListener("click", saveLogLevel);
document.getElementById("exportLogs").addEventListener("click", exportLogs);
document
  .getElementById("resetTasks")
  .addEventListener("click", resetTaskMemory);

function showStatus(elementId, message, isError = false) {
  const element = document.getElementById(elementId);
  element.textContent = message;
  element.style.color = isError ? "red" : "green";
  setTimeout(() => {
    element.textContent = "";
  }, 3000);
}

async function saveLogin() {
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  if (!username || !password) {
    showStatus("loginStatus", "Usuário e senha são obrigatórios.", true);
    return;
  }

  try {
    await setConfigs({
      sauUsername: username,
      sauPassword: password,
    });
    showStatus("loginStatus", "Credenciais salvas com sucesso!");
    await optionsLogger.info("Credenciais de login salvas com sincronização.");
  } catch (error) {
    await optionsLogger.error("Erro ao salvar credenciais:", error);
    showStatus("loginStatus", "Erro ao salvar credenciais.", true);
  }
}

async function saveSettings() {
  const checkInterval = parseInt(
    document.getElementById("checkInterval").value,
    10
  );
  const enableRenotification = document.getElementById(
    "enableRenotification"
  ).checked;
  const renotificationInterval = parseInt(
    document.getElementById("renotificationInterval").value,
    10
  );

  if (isNaN(checkInterval) || checkInterval < 10) {
    showStatus(
      "settingsStatus",
      "Intervalo de verificação inválido (mínimo 10 segundos).",
      true
    );
    return;
  }

  if (
    enableRenotification &&
    (isNaN(renotificationInterval) || renotificationInterval < 1)
  ) {
    showStatus(
      "settingsStatus",
      "Intervalo de renotificação inválido (mínimo 1 minuto).",
      true
    );
    return;
  }

  try {
    await setConfigs({
      checkInterval: checkInterval,
      enableRenotification: enableRenotification,
      renotificationInterval: renotificationInterval,
    });
    showStatus("settingsStatus", "Configurações salvas com sucesso!");
    await optionsLogger.info(
      "Configurações de notificação salvas com sincronização. Enviando mensagem para atualizar alarme."
    );
    browserAPI.runtime.sendMessage({ action: "updateAlarm" });
  } catch (error) {
    await optionsLogger.error("Erro ao salvar configurações:", error);
    showStatus("settingsStatus", "Erro ao salvar configurações.", true);
  }
}

async function saveDisplaySettings() {
  try {
    const displaySettings = {
      headerFields: {
        numero: true, // sempre visível
        titulo: true, // sempre visível
        dataEnvio: document.getElementById("header-dataEnvio").checked,
        posicao: document.getElementById("header-posicao").checked,
        solicitante: document.getElementById("header-solicitante").checked,
        unidade: document.getElementById("header-unidade").checked,
      },
    };

    await setConfig("taskDisplaySettings", displaySettings);

    showStatus(
      "displayStatus",
      "Configurações de exibição salvas com sucesso!"
    );
    await optionsLogger.info(
      "Configurações de exibição de tarefas salvas com sincronização:",
      displaySettings
    );
  } catch (error) {
    await optionsLogger.error(
      "Erro ao salvar configurações de exibição:",
      error
    );
    showStatus(
      "displayStatus",
      "Erro ao salvar configurações de exibição.",
      true
    );
  }
}

async function saveSnoozeSettings() {
  try {
    const snoozeOptions = [];
    const optionItems = document.querySelectorAll(".snooze-option-item");

    optionItems.forEach((item) => {
      const hours = parseInt(item.querySelector(".hours-input").value) || 0;
      const minutes = parseInt(item.querySelector(".minutes-input").value) || 0;

      if (hours > 0 || minutes > 0) {
        snoozeOptions.push({
          hours: hours,
          minutes: minutes,
          totalMinutes: hours * 60 + minutes,
        });
      }
    });

    const allowCustomSnooze =
      document.getElementById("allowCustomSnooze").checked;

    const snoozeSettings = {
      options: snoozeOptions,
      allowCustom: allowCustomSnooze,
    };

    await setConfig("snoozeSettings", snoozeSettings);

    showStatus(
      "snoozeSettingsStatus",
      "Configurações de 'Lembrar Mais Tarde' salvas com sucesso!"
    );
    await optionsLogger.info(
      "Configurações de snooze salvas com sincronização:",
      snoozeSettings
    );
  } catch (error) {
    await optionsLogger.error("Erro ao salvar configurações de snooze:", error);
    showStatus(
      "snoozeSettingsStatus",
      "Erro ao salvar configurações de snooze.",
      true
    );
  }
}

function addSnoozeOption() {
  const container = document.getElementById("snooze-options-container");
  const optionDiv = document.createElement("div");
  optionDiv.className = "snooze-option-item";

  optionDiv.innerHTML = `
    <span class="snooze-option-label">Opção:</span>
    <input type="number" class="hours-input" min="0" max="23" value="0" placeholder="0">
    <label>horas</label>
    <input type="number" class="minutes-input" min="0" max="59" value="15" placeholder="15">
    <label>minutos</label>
    <button type="button" class="remove-btn" onclick="removeSnoozeOption(this)">Remover</button>
  `;

  container.appendChild(optionDiv);
}

function removeSnoozeOption(button) {
  button.closest(".snooze-option-item").remove();
}

// Torna a função global para ser acessível pelo onclick
window.removeSnoozeOption = removeSnoozeOption;

function loadSnoozeOptions(snoozeSettings) {
  const container = document.getElementById("snooze-options-container");
  container.innerHTML = "";

  // Configurações padrão se não existirem
  const defaultOptions = snoozeSettings?.options || [
    { hours: 0, minutes: 15 },
    { hours: 0, minutes: 30 },
    { hours: 1, minutes: 0 },
    { hours: 2, minutes: 0 },
    { hours: 4, minutes: 0 },
  ];

  defaultOptions.forEach((option) => {
    const optionDiv = document.createElement("div");
    optionDiv.className = "snooze-option-item";

    optionDiv.innerHTML = `
      <span class="snooze-option-label">Opção:</span>
      <input type="number" class="hours-input" min="0" max="23" value="${option.hours}" placeholder="0">
      <label>horas</label>
      <input type="number" class="minutes-input" min="0" max="59" value="${option.minutes}" placeholder="15">
      <label>minutos</label>
      <button type="button" class="remove-btn" onclick="removeSnoozeOption(this)">Remover</button>
    `;

    container.appendChild(optionDiv);
  });

  // Configura o checkbox de permitir customização
  const allowCustom = snoozeSettings?.allowCustom !== false; // padrão true
  document.getElementById("allowCustomSnooze").checked = allowCustom;
}

async function saveLogLevel() {
  const logLevelSelect = document.getElementById("logLevel");
  const selectedLevelName = logLevelSelect.value;

  try {
    await optionsLogger.setLogLevel(selectedLevelName); // Usa o método do logger para atualizar e salvar
    showStatus("logLevelStatus", "Nível de log salvo com sucesso!");
    await optionsLogger.info(
      `Nível de log definido para: ${selectedLevelName}`
    );
  } catch (error) {
    await optionsLogger.error("Erro ao salvar nível de log:", error);
    showStatus("logLevelStatus", "Erro ao salvar nível de log.", true);
  }
}

/**
 * Solicita os logs do background script e os baixa como um arquivo de texto.
 */
async function exportLogs() {
  await optionsLogger.info("Solicitando logs para exportação...");
  try {
    // Envia uma mensagem para o background script para obter os logs armazenados
    const response = await browserAPI.runtime.sendMessage({
      action: "getLogs",
    });
    const logs = response.logs;

    if (logs && logs.length > 0) {
      // Formata os logs em uma string para o arquivo
      const formattedLogs = logs
        .map((entry) => {
          return `${entry.timestamp} ${entry.prefix} [${entry.level}] ${entry.message}`;
        })
        .join("\n");

      // Cria um Blob com o conteúdo do log
      const blob = new Blob([formattedLogs], {
        type: "text/plain;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);

      // Cria um link temporário e simula um clique para baixar o arquivo
      const a = document.createElement("a");
      a.href = url;
      a.download = `monitor_sau_logs_${new Date()
        .toISOString()
        .slice(0, 10)}.txt`; // Nome do arquivo com data
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url); // Libera o URL do objeto

      showStatus("logLevelStatus", "Logs exportados com sucesso!");
      await optionsLogger.info("Logs exportados com sucesso.");
    } else {
      showStatus("logLevelStatus", "Nenhum log para exportar.", false);
      await optionsLogger.warn(
        "Tentativa de exportar logs, mas o buffer está vazio."
      );
    }
  } catch (error) {
    await optionsLogger.error("Erro ao exportar logs:", error);
    showStatus("logLevelStatus", "Erro ao exportar logs.", true);
  }
}

/**
 * Envia uma mensagem para o background script para limpar todas as tarefas salvas.
 * Pede confirmação ao usuário antes de prosseguir.
 */
function resetTaskMemory() {
  if (
    confirm(
      "Você tem certeza que deseja apagar todas as tarefas conhecidas? Esta ação não pode ser desfeita e é usada para fins de teste."
    )
  ) {
    optionsLogger.warn("Solicitando reset da memória de tarefas...");
    browserAPI.runtime.sendMessage(
      { action: "resetTaskMemory" },
      async (response) => {
        if (response && response.status) {
          showStatus("resetStatus", response.status);
          await optionsLogger.info("Memória de tarefas resetada com sucesso.");
        }
      }
    );
  }
}

async function loadOptions() {
  try {
    // Executa migração para sync se necessário
    await migrateToSync();

    // Carrega configurações usando o gerenciador
    const data = await getConfigs([
      "sauUsername",
      "sauPassword",
      "checkInterval",
      "enableRenotification",
      "renotificationInterval",
      "logLevel",
      "taskDisplaySettings",
      "snoozeSettings",
    ]);

    if (data.sauUsername) {
      document.getElementById("username").value = data.sauUsername;
    }
    if (data.sauPassword) {
      document.getElementById("password").value = data.sauPassword;
    }
    if (data.checkInterval) {
      document.getElementById("checkInterval").value = data.checkInterval;
    }

    // Carrega configurações de renotificação
    document.getElementById("enableRenotification").checked =
      data.enableRenotification || false;
    document.getElementById("renotificationInterval").value =
      data.renotificationInterval || 30;

    if (data.logLevel !== undefined) {
      const logLevelSelect = document.getElementById("logLevel");
      const levelName = Object.keys(LOG_LEVELS).find(
        (key) => LOG_LEVELS[key] === data.logLevel
      );
      if (levelName) {
        logLevelSelect.value = levelName;
      }
    }

    // Carrega configurações de exibição de tarefas
    if (data.taskDisplaySettings && data.taskDisplaySettings.headerFields) {
      const headerFields = data.taskDisplaySettings.headerFields;
      document.getElementById("header-dataEnvio").checked =
        headerFields.dataEnvio || false;
      document.getElementById("header-posicao").checked =
        headerFields.posicao || false;
      document.getElementById("header-solicitante").checked =
        headerFields.solicitante || false;
      document.getElementById("header-unidade").checked =
        headerFields.unidade || false;
    } else {
      // Configurações padrão: mostrar data de envio e posição no cabeçalho
      document.getElementById("header-dataEnvio").checked = true;
      document.getElementById("header-posicao").checked = true;
      document.getElementById("header-solicitante").checked = false;
      document.getElementById("header-unidade").checked = false;
    }

    // Carrega configurações de snooze
    loadSnoozeOptions(data.snoozeSettings);

    // Exibe informações sobre o storage
    const storageInfo = await getStorageInfo();
    await optionsLogger.info("Opções carregadas na página de configurações.", {
      syncAvailable: storageInfo.syncAvailable,
      syncUsage: storageInfo.syncUsage,
      localUsage: storageInfo.localUsage,
    });
  } catch (error) {
    await optionsLogger.error("Erro ao carregar opções:", error);
  }
}
