import { logger, LOG_LEVELS } from "./logger.js";
const optionsLogger = logger("[Options]");

// Define o objeto de API do navegador de forma compatível (Chrome ou Firefox)
const browserAPI = globalThis.browser || globalThis.chrome;

document.addEventListener("DOMContentLoaded", loadOptions);

document.getElementById("saveLogin").addEventListener("click", saveLogin);
document.getElementById("saveSettings").addEventListener("click", saveSettings);
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
    await browserAPI.storage.local.set({
      sauUsername: username,
      sauPassword: password,
    });
    showStatus("loginStatus", "Credenciais salvas com sucesso!");
    optionsLogger.info("Credenciais de login salvas.");
  } catch (error) {
    optionsLogger.error("Erro ao salvar credenciais:", error);
    showStatus("loginStatus", "Erro ao salvar credenciais.", true);
  }
}

async function saveSettings() {
  const checkInterval = parseInt(
    document.getElementById("checkInterval").value,
    10
  );
  const snoozeTime = parseInt(document.getElementById("snoozeTime").value, 10);

  if (isNaN(checkInterval) || checkInterval < 10) {
    showStatus(
      "settingsStatus",
      "Intervalo de verificação inválido (mínimo 10 segundos).",
      true
    );
    return;
  }
  if (isNaN(snoozeTime) || snoozeTime < 1) {
    showStatus(
      "settingsStatus",
      'Tempo de "Lembrar Mais Tarde" inválido (mínimo 1 minuto).',
      true
    );
    return;
  }

  try {
    await browserAPI.storage.local.set({
      checkInterval: checkInterval,
      snoozeTime: snoozeTime,
    });
    showStatus("settingsStatus", "Configurações salvas com sucesso!");
    optionsLogger.info(
      "Configurações de notificação salvas. Enviando mensagem para atualizar alarme."
    );
    browserAPI.runtime.sendMessage({ action: "updateAlarm" });
  } catch (error) {
    optionsLogger.error("Erro ao salvar configurações:", error);
    showStatus("settingsStatus", "Erro ao salvar configurações.", true);
  }
}

async function saveLogLevel() {
  const logLevelSelect = document.getElementById("logLevel");
  const selectedLevelName = logLevelSelect.value;

  try {
    await optionsLogger.setLogLevel(selectedLevelName); // Usa o método do logger para atualizar e salvar
    showStatus("logLevelStatus", "Nível de log salvo com sucesso!");
    optionsLogger.info(`Nível de log definido para: ${selectedLevelName}`);
  } catch (error) {
    optionsLogger.error("Erro ao salvar nível de log:", error);
    showStatus("logLevelStatus", "Erro ao salvar nível de log.", true);
  }
}

/**
 * Solicita os logs do background script e os baixa como um arquivo de texto.
 */
async function exportLogs() {
  optionsLogger.info("Solicitando logs para exportação...");
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
      optionsLogger.info("Logs exportados com sucesso.");
    } else {
      showStatus("logLevelStatus", "Nenhum log para exportar.", false);
      optionsLogger.warn(
        "Tentativa de exportar logs, mas o buffer está vazio."
      );
    }
  } catch (error) {
    optionsLogger.error("Erro ao exportar logs:", error);
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
      (response) => {
        if (response && response.status) {
          showStatus("resetStatus", response.status);
          optionsLogger.info("Memória de tarefas resetada com sucesso.");
        }
      }
    );
  }
}

async function loadOptions() {
  try {
    const data = await browserAPI.storage.local.get([
      "sauUsername",
      "sauPassword",
      "checkInterval",
      "snoozeTime",
      "logLevel",
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
    if (data.snoozeTime) {
      document.getElementById("snoozeTime").value = data.snoozeTime;
    }
    if (data.logLevel !== undefined) {
      const logLevelSelect = document.getElementById("logLevel");
      const levelName = Object.keys(LOG_LEVELS).find(
        (key) => LOG_LEVELS[key] === data.logLevel
      );
      if (levelName) {
        logLevelSelect.value = levelName;
      }
    }
    optionsLogger.info("Opções carregadas na página de configurações.");
  } catch (error) {
    optionsLogger.error("Erro ao carregar opções:", error);
  }
}
