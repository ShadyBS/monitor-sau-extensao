import { logger, LOG_LEVELS } from "./logger.js";
import {
  setConfig,
  setConfigs,
  getConfig,
  getConfigs,
  getStorageInfo,
  migrateToSync,
} from "./config-manager.js";
import { tooltipSystem } from "./tooltip-system.js";
import { sanitizeHTML } from "./sanitizer.js";

const optionsLogger = logger("[Options]");

// Validation constants and rules
const VALIDATION_RULES = {
  username: {
    minLength: 3,
    maxLength: 50,
    pattern: /^[a-zA-Z0-9._-]+$/,
    required: true,
    errorMessage: "Usuário deve ter entre 3-50 caracteres e conter apenas letras, números, pontos, hífens e underscores."
  },
  password: {
    minLength: 4,
    maxLength: 100,
    required: true,
    errorMessage: "Senha deve ter entre 4-100 caracteres."
  },
  checkInterval: {
    min: 10,
    max: 3600, // 1 hour max
    required: true,
    errorMessage: "Intervalo de verificação deve estar entre 10 e 3600 segundos."
  },
  renotificationInterval: {
    min: 1,
    max: 1440, // 24 hours max
    required: false,
    errorMessage: "Intervalo de renotificação deve estar entre 1 e 1440 minutos."
  },
  snoozeHours: {
    min: 0,
    max: 23,
    required: false,
    errorMessage: "Horas devem estar entre 0 e 23."
  },
  snoozeMinutes: {
    min: 0,
    max: 59,
    required: false,
    errorMessage: "Minutos devem estar entre 0 e 59."
  }
};

/**
 * Validates a string input according to specified rules
 * @param {string} value - The value to validate
 * @param {Object} rules - Validation rules
 * @returns {Object} Validation result with isValid and errorMessage
 */
function validateStringInput(value, rules) {
  // Sanitize input first
  const sanitizedValue = typeof value === 'string' ? value.trim() : '';
  
  // Check if required
  if (rules.required && (!sanitizedValue || sanitizedValue.length === 0)) {
    return {
      isValid: false,
      errorMessage: "Este campo é obrigatório.",
      sanitizedValue: sanitizedValue
    };
  }
  
  // If not required and empty, it's valid
  if (!rules.required && sanitizedValue.length === 0) {
    return {
      isValid: true,
      sanitizedValue: sanitizedValue
    };
  }
  
  // Check length constraints
  if (rules.minLength && sanitizedValue.length < rules.minLength) {
    return {
      isValid: false,
      errorMessage: `Deve ter pelo menos ${rules.minLength} caracteres.`,
      sanitizedValue: sanitizedValue
    };
  }
  
  if (rules.maxLength && sanitizedValue.length > rules.maxLength) {
    return {
      isValid: false,
      errorMessage: `Deve ter no máximo ${rules.maxLength} caracteres.`,
      sanitizedValue: sanitizedValue
    };
  }
  
  // Check pattern if specified
  if (rules.pattern && !rules.pattern.test(sanitizedValue)) {
    return {
      isValid: false,
      errorMessage: rules.errorMessage || "Formato inválido.",
      sanitizedValue: sanitizedValue
    };
  }
  
  return {
    isValid: true,
    sanitizedValue: sanitizedValue
  };
}

/**
 * Validates a numeric input according to specified rules
 * @param {string|number} value - The value to validate
 * @param {Object} rules - Validation rules
 * @returns {Object} Validation result with isValid, errorMessage, and parsedValue
 */
function validateNumericInput(value, rules) {
  // Convert to string and sanitize
  const stringValue = String(value || '').trim();
  
  // Check if required
  if (rules.required && stringValue === '') {
    return {
      isValid: false,
      errorMessage: "Este campo é obrigatório.",
      parsedValue: null
    };
  }
  
  // If not required and empty, return default or null
  if (!rules.required && stringValue === '') {
    return {
      isValid: true,
      parsedValue: rules.defaultValue || null
    };
  }
  
  // Parse the number
  const parsedValue = parseInt(stringValue, 10);
  
  // Check if it's a valid number
  if (isNaN(parsedValue)) {
    return {
      isValid: false,
      errorMessage: "Deve ser um número válido.",
      parsedValue: null
    };
  }
  
  // Check range constraints
  if (rules.min !== undefined && parsedValue < rules.min) {
    return {
      isValid: false,
      errorMessage: `Deve ser pelo menos ${rules.min}.`,
      parsedValue: parsedValue
    };
  }
  
  if (rules.max !== undefined && parsedValue > rules.max) {
    return {
      isValid: false,
      errorMessage: `Deve ser no máximo ${rules.max}.`,
      parsedValue: parsedValue
    };
  }
  
  return {
    isValid: true,
    parsedValue: parsedValue
  };
}

/**
 * Validates snooze option inputs (hours and minutes combination)
 * @param {number} hours - Hours value
 * @param {number} minutes - Minutes value
 * @returns {Object} Validation result
 */
function validateSnoozeOption(hours, minutes) {
  const hoursValidation = validateNumericInput(hours, VALIDATION_RULES.snoozeHours);
  const minutesValidation = validateNumericInput(minutes, VALIDATION_RULES.snoozeMinutes);
  
  if (!hoursValidation.isValid) {
    return {
      isValid: false,
      errorMessage: `Horas: ${hoursValidation.errorMessage}`
    };
  }
  
  if (!minutesValidation.isValid) {
    return {
      isValid: false,
      errorMessage: `Minutos: ${minutesValidation.errorMessage}`
    };
  }
  
  const totalMinutes = (hoursValidation.parsedValue || 0) * 60 + (minutesValidation.parsedValue || 0);
  
  // Check if at least one value is greater than 0
  if (totalMinutes === 0) {
    return {
      isValid: false,
      errorMessage: "Pelo menos horas ou minutos deve ser maior que 0."
    };
  }
  
  // Check maximum total time (24 hours)
  if (totalMinutes > 1440) {
    return {
      isValid: false,
      errorMessage: "Tempo total não pode exceder 24 horas."
    };
  }
  
  return {
    isValid: true,
    hours: hoursValidation.parsedValue || 0,
    minutes: minutesValidation.parsedValue || 0,
    totalMinutes: totalMinutes
  };
}

/**
 * Shows validation error with enhanced styling and logging
 * @param {string} elementId - Status element ID
 * @param {string} message - Error message
 * @param {boolean} isError - Whether it's an error or success
 */
async function showValidationStatus(elementId, message, isError = false) {
  const element = document.getElementById(elementId);
  if (!element) {
    await optionsLogger.warn(`Status element not found: ${elementId}`);
    return;
  }
  
  // Sanitize the message before displaying
  const sanitizedMessage = await sanitizeHTML(message);
  element.textContent = sanitizedMessage;
  element.style.color = isError ? "#d32f2f" : "#2e7d32";
  element.style.fontWeight = "bold";
  element.style.padding = "8px";
  element.style.borderRadius = "4px";
  element.style.backgroundColor = isError ? "#ffebee" : "#e8f5e9";
  element.style.border = isError ? "1px solid #ffcdd2" : "1px solid #c8e6c9";
  
  // Log the validation result
  if (isError) {
    await optionsLogger.warn(`Validation error in ${elementId}: ${message}`);
  } else {
    await optionsLogger.info(`Validation success in ${elementId}: ${message}`);
  }
  
  setTimeout(() => {
    element.textContent = "";
    element.style.backgroundColor = "";
    element.style.border = "";
    element.style.padding = "";
  }, 5000);
}

// Define o objeto de API do navegador de forma compatível (Chrome ou Firefox)
const browserAPI = globalThis.browser || globalThis.chrome;

// Definições de ajuda para cada configuração
const helpDefinitions = {
  "login-auto": {
    title: "🔐 Login Automático",
    content:
      "Permite que a extensão faça login automaticamente no SAU usando suas credenciais salvas. Isso elimina a necessidade de inserir usuário e senha manualmente a cada verificação.",
    tip: "Suas credenciais são criptografadas e armazenadas apenas no seu navegador, nunca sendo enviadas para terceiros.",
  },
  username: {
    title: "👤 Campo Usuário",
    content:
      "Digite aqui o mesmo nome de usuário que você usa para acessar o SAU manualmente. Este campo é obrigatório para o funcionamento da extensão.",
    tip: "Use exatamente o mesmo usuário que você utiliza no site do SAU.",
  },
  password: {
    title: "🔑 Campo Senha",
    content:
      "Digite aqui a mesma senha que você usa para acessar o SAU manualmente. A senha será armazenada de forma segura e criptografada.",
    tip: "A senha é armazenada localmente no seu navegador e nunca é compartilhada.",
  },
  notifications: {
    title: "🔔 Configurações de Notificação",
    content:
      "Controla como e quando você será notificado sobre novas tarefas no SAU. Inclui configurações de intervalo de verificação e renotificação.",
    tip: "Ajuste essas configurações de acordo com sua rotina de trabalho.",
  },
  "check-interval": {
    title: "⏱️ Intervalo de Verificação",
    content:
      "Define de quantos em quantos segundos a extensão verifica se há novas tarefas no SAU. Valores menores significam verificações mais frequentes, mas podem sobrecarregar o servidor.",
    tip: "Recomendamos entre 30-60 segundos para um bom equilíbrio entre rapidez e performance.",
  },
  renotification: {
    title: "🔄 Renotificação de Tarefas Pendentes",
    content:
      "Sistema que relembra você sobre tarefas que ainda não foram atendidas. Útil para não esquecer de tarefas importantes.",
    tip: "Ative esta opção se você quer ser lembrado sobre tarefas que ainda não abriu.",
  },
  "enable-renotification": {
    title: "✅ Ativar Renotificação",
    content:
      "Quando ativado, a extensão irá renotificar você sobre tarefas pendentes que ainda não foram abertas ou ignoradas.",
    tip: "Desative se você não quer ser lembrado sobre tarefas antigas.",
  },
  "renotification-interval": {
    title: "⏰ Intervalo de Renotificação",
    content:
      "Define de quantos em quantos minutos você será lembrado sobre tarefas pendentes. Só funciona se a renotificação estiver ativada.",
    tip: "Configure um tempo que faça sentido para seu fluxo de trabalho, como 30 ou 60 minutos.",
  },
  "sigss-rename": {
    title: "🏷️ Renomear Abas do SIGSS",
    content:
      "Funcionalidade que melhora a organização das abas do SIGSS, renomeando-as automaticamente com o título da página atual.",
    tip: "Muito útil quando você trabalha com múltiplas abas do SIGSS abertas simultaneamente.",
  },
  "enable-sigss-rename": {
    title: "🔄 Ativar Renomeação SIGSS",
    content:
      "Quando ativado, as abas do SIGSS serão automaticamente renomeadas com o conteúdo do elemento '.sigss-title' da página, facilitando a identificação.",
    tip: "Desative se você preferir manter os títulos originais das abas do SIGSS.",
  },
  "snooze-settings": {
    title: "⏰ Configurações de 'Lembrar Mais Tarde'",
    content:
      "Permite personalizar as opções de tempo que aparecem quando você escolhe adiar uma tarefa. Você pode criar opções pré-configuradas e permitir tempos personalizados.",
    tip: "Configure opções que fazem sentido para sua rotina, como 15min, 1h, 4h.",
  },
  "snooze-options": {
    title: "📋 Opções Pré-configuradas",
    content:
      "Lista de tempos fixos que aparecerão no menu 'Lembrar Mais Tarde'. Cada opção pode ter horas e minutos específicos.",
    tip: "Adicione opções que você usa frequentemente, como intervalos de almoço ou reuniões.",
  },
  "snooze-general": {
    title: "⚙️ Configurações Gerais de Snooze",
    content:
      "Configurações que afetam o comportamento geral do sistema de 'Lembrar Mais Tarde', como permitir tempos personalizados.",
    tip: "O tempo personalizado permite que o usuário digite qualquer valor de horas e minutos.",
  },
  "custom-snooze": {
    title: "🎯 Tempo Personalizado",
    content:
      "Quando ativado, além das opções pré-configuradas, o usuário poderá inserir um tempo específico (horas e minutos) para ser lembrado.",
    tip: "Útil para situações específicas onde as opções pré-configuradas não atendem.",
  },
  "task-display": {
    title: "✅ Exibição de Tarefas",
    content:
      "Controla quais informações das tarefas são mostradas no cabeçalho (sempre visíveis) e quais ficam nos detalhes (visíveis ao expandir).",
    tip: "Personalize a interface para mostrar apenas as informações mais importantes para você.",
  },
  "header-info": {
    title: "📌 Informações do Cabeçalho",
    content:
      "Campos que ficam sempre visíveis no cabeçalho de cada tarefa. Número e título são obrigatórios, mas você pode adicionar outros campos.",
    tip: "Escolha campos que você consulta frequentemente para ter acesso rápido.",
  },
  "data-envio": {
    title: "📅 Data de Envio",
    content:
      "Mostra quando a tarefa foi enviada/criada no SAU. Útil para priorizar tarefas mais antigas ou identificar urgências.",
    tip: "Recomendado manter visível para controle de prazos.",
  },
  "posicao-fila": {
    title: "🔢 Posição na Fila",
    content:
      "Mostra a posição da tarefa na fila de atendimento. Ajuda a entender a ordem de prioridade das tarefas.",
    tip: "Útil para saber quais tarefas atender primeiro.",
  },
  solicitante: {
    title: "👤 Solicitante",
    content:
      "Mostra quem solicitou ou criou a tarefa. Pode ser útil para identificar tarefas de pessoas específicas ou setores.",
    tip: "Útil se você precisa priorizar tarefas de determinadas pessoas.",
  },
  unidade: {
    title: "🏢 Unidade",
    content:
      "Mostra a unidade ou setor relacionado à tarefa. Ajuda a categorizar e organizar o trabalho por departamento.",
    tip: "Útil para organizar tarefas por setor ou área de atuação.",
  },
  "details-info": {
    title: "📄 Informações dos Detalhes",
    content:
      "Campos que ficam ocultos inicialmente e só aparecem quando você expande os detalhes da tarefa. Ajuda a manter a interface limpa.",
    tip: "Informações menos consultadas ficam nos detalhes para não poluir a interface.",
  },
  "log-settings": {
    title: "📝 Configurações de Log",
    content:
      "Controla o nível de detalhamento dos logs da extensão. Logs são úteis para diagnóstico de problemas e suporte técnico.",
    tip: "Use DEBUG apenas para diagnóstico, pois gera muitos logs.",
  },
  "log-level": {
    title: "📊 Nível de Log",
    content:
      "Define quais tipos de mensagens serão registradas nos logs:<br>• ERROR: Apenas erros críticos<br>• WARN: Avisos e erros<br>• INFO: Informações gerais<br>• DEBUG: Informações detalhadas<br>• NONE: Desativa logs",
    tip: "Para uso normal, recomendamos INFO. Use DEBUG apenas para diagnóstico.",
  },
  "export-logs": {
    title: "📤 Exportar Logs",
    content:
      "Baixa um arquivo de texto com todos os logs registrados pela extensão. Útil para enviar ao suporte técnico em caso de problemas.",
    tip: "Os logs ajudam a identificar problemas e melhorar a extensão.",
  },
  development: {
    title: "🔧 Ferramentas de Desenvolvimento",
    content:
      "Ferramentas úteis para teste e diagnóstico da extensão. Use com cuidado, pois algumas ações não podem ser desfeitas.",
    tip: "Estas ferramentas são principalmente para teste e resolução de problemas.",
  },
  "reset-tasks": {
    title: "🗑️ Resetar Memória de Tarefas",
    content:
      "Remove todas as tarefas conhecidas, ignoradas e 'snoozed' da memória da extensão. Útil para testar notificações ou resolver problemas.",
    tip: "CUIDADO: Esta ação não pode ser desfeita. Use apenas para teste ou resolução de problemas.",
  },
};

/**
 * Configura os botões de ajuda na página
 */
function setupHelpButtons() {
  // Encontra todos os botões de ajuda
  const helpButtons = document.querySelectorAll(".help-button[data-help]");

  helpButtons.forEach((button) => {
    const helpKey = button.getAttribute("data-help");
    const helpConfig = helpDefinitions[helpKey];

    if (helpConfig) {
      // Adiciona tooltip ao botão
      tooltipSystem.addTooltip(button, {
        title: helpConfig.title,
        content: helpConfig.content,
        tip: helpConfig.tip,
        trigger: "click",
        position: "right",
      });
    }
  });

  optionsLogger.info(`Configurados ${helpButtons.length} botões de ajuda`);
}

document.addEventListener("DOMContentLoaded", () => {
  loadOptions();
  setupHelpButtons();
});

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
  const usernameInput = document.getElementById("username").value;
  const passwordInput = document.getElementById("password").value;

  // Validate username
  const usernameValidation = validateStringInput(usernameInput, VALIDATION_RULES.username);
  if (!usernameValidation.isValid) {
    await showValidationStatus("loginStatus", usernameValidation.errorMessage, true);
    return;
  }

  // Validate password
  const passwordValidation = validateStringInput(passwordInput, VALIDATION_RULES.password);
  if (!passwordValidation.isValid) {
    await showValidationStatus("loginStatus", passwordValidation.errorMessage, true);
    return;
  }

  try {
    await setConfigs({
      sauUsername: usernameValidation.sanitizedValue,
      sauPassword: passwordValidation.sanitizedValue,
    });
    await showValidationStatus("loginStatus", "Credenciais salvas com sucesso!");
    await optionsLogger.info("Credenciais de login salvas com sincronização.", {
      username: usernameValidation.sanitizedValue.substring(0, 3) + "***", // Log partial username for security
      passwordLength: passwordValidation.sanitizedValue.length
    });
  } catch (error) {
    await optionsLogger.error("Erro ao salvar credenciais:", error);
    await showValidationStatus("loginStatus", "Erro ao salvar credenciais.", true);
  }
}

async function saveSettings() {
  const checkIntervalInput = document.getElementById("checkInterval").value;
  const enableRenotification = document.getElementById("enableRenotification").checked;
  const renotificationIntervalInput = document.getElementById("renotificationInterval").value;
  const enableSigssTabRename = document.getElementById("enableSigssTabRename").checked;

  // Validate check interval
  const checkIntervalValidation = validateNumericInput(checkIntervalInput, VALIDATION_RULES.checkInterval);
  if (!checkIntervalValidation.isValid) {
    await showValidationStatus("settingsStatus", checkIntervalValidation.errorMessage, true);
    return;
  }

  // Validate renotification interval only if renotification is enabled
  let renotificationIntervalValue = null;
  if (enableRenotification) {
    const renotificationValidation = validateNumericInput(renotificationIntervalInput, {
      ...VALIDATION_RULES.renotificationInterval,
      required: true // Make it required when renotification is enabled
    });
    if (!renotificationValidation.isValid) {
      await showValidationStatus("settingsStatus", `Renotificação: ${renotificationValidation.errorMessage}`, true);
      return;
    }
    renotificationIntervalValue = renotificationValidation.parsedValue;
  } else {
    // If renotification is disabled, still validate the input but don't require it
    const renotificationValidation = validateNumericInput(renotificationIntervalInput, VALIDATION_RULES.renotificationInterval);
    if (renotificationIntervalInput.trim() !== '' && !renotificationValidation.isValid) {
      await showValidationStatus("settingsStatus", `Renotificação: ${renotificationValidation.errorMessage}`, true);
      return;
    }
    renotificationIntervalValue = renotificationValidation.parsedValue || 30; // Default value
  }

  try {
    await setConfigs({
      checkInterval: checkIntervalValidation.parsedValue,
      enableRenotification: enableRenotification,
      renotificationInterval: renotificationIntervalValue,
      enableSigssTabRename: enableSigssTabRename,
    });
    await showValidationStatus("settingsStatus", "Configurações salvas com sucesso!");
    await optionsLogger.info("Configurações de notificação salvas com sincronização.", {
      checkInterval: checkIntervalValidation.parsedValue,
      enableRenotification: enableRenotification,
      renotificationInterval: renotificationIntervalValue,
      enableSigssTabRename: enableSigssTabRename
    });
    browserAPI.runtime.sendMessage({ action: "updateAlarm" });
  } catch (error) {
    await optionsLogger.error("Erro ao salvar configurações:", error);
    await showValidationStatus("settingsStatus", "Erro ao salvar configurações.", true);
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
    const validationErrors = [];

    // Validate each snooze option
    optionItems.forEach((item, index) => {
      const hoursInput = item.querySelector(".hours-input").value;
      const minutesInput = item.querySelector(".minutes-input").value;

      // Validate the snooze option
      const validation = validateSnoozeOption(hoursInput, minutesInput);
      
      if (!validation.isValid) {
        validationErrors.push(`Opção ${index + 1}: ${validation.errorMessage}`);
      } else {
        snoozeOptions.push({
          hours: validation.hours,
          minutes: validation.minutes,
          totalMinutes: validation.totalMinutes,
        });
      }
    });

    // Check if there are validation errors
    if (validationErrors.length > 0) {
      await showValidationStatus("snoozeSettingsStatus", validationErrors.join("; "), true);
      return;
    }

    // Check if at least one option is provided
    if (snoozeOptions.length === 0) {
      await showValidationStatus("snoozeSettingsStatus", "Pelo menos uma opção de snooze deve ser configurada.", true);
      return;
    }

    // Check for duplicate options
    const duplicates = snoozeOptions.filter((option, index, arr) => 
      arr.findIndex(other => other.totalMinutes === option.totalMinutes) !== index
    );
    
    if (duplicates.length > 0) {
      await showValidationStatus("snoozeSettingsStatus", "Opções duplicadas detectadas. Cada opção deve ter um tempo único.", true);
      return;
    }

    const allowCustomSnooze = document.getElementById("allowCustomSnooze").checked;

    const snoozeSettings = {
      options: snoozeOptions.sort((a, b) => a.totalMinutes - b.totalMinutes), // Sort by total minutes
      allowCustom: allowCustomSnooze,
    };

    await setConfig("snoozeSettings", snoozeSettings);

    await showValidationStatus("snoozeSettingsStatus", "Configurações de 'Lembrar Mais Tarde' salvas com sucesso!");
    await optionsLogger.info("Configurações de snooze salvas com sincronização:", {
      optionsCount: snoozeOptions.length,
      allowCustom: allowCustomSnooze,
      options: snoozeOptions.map(opt => `${opt.hours}h${opt.minutes}m`)
    });
  } catch (error) {
    await optionsLogger.error("Erro ao salvar configurações de snooze:", error);
    await showValidationStatus("snoozeSettingsStatus", "Erro ao salvar configurações de snooze.", true);
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
    <button type="button" class="remove-btn" onclick="removeSnoozeOption(this)" title="Remover opção">🗑️</button>
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
      <button type="button" class="remove-btn" onclick="removeSnoozeOption(this)" title="Remover opção">🗑️</button>
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
      "enableSigssTabRename",
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

    // Carrega configuração de renomear abas do SIGSS (habilitada por padrão)
    document.getElementById("enableSigssTabRename").checked =
      data.enableSigssTabRename !== false;

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
