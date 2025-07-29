/**
 * Configurações padrão centralizadas para Monitor SAU Extension
 * Este arquivo define todos os valores padrão usados pela extensão
 * para garantir consistência entre diferentes módulos.
 */

// Configurações de exibição de tarefas
export const DEFAULT_TASK_DISPLAY_SETTINGS = {
  headerFields: {
    numero: true, // Sempre visível (obrigatório)
    titulo: true, // Sempre visível (obrigatório)
    dataEnvio: true, // Visível no cabeçalho por padrão
    posicao: true, // Visível no cabeçalho por padrão
    solicitante: true, // Visível apenas nos detalhes por padrão
    unidade: true, // Visível apenas nos detalhes por padrão
  },
};

// Configurações de snooze (lembrar mais tarde)
export const DEFAULT_SNOOZE_SETTINGS = {
  options: [
    { hours: 0, minutes: 15, totalMinutes: 15 },
    { hours: 0, minutes: 30, totalMinutes: 30 },
    { hours: 1, minutes: 0, totalMinutes: 60 },
    { hours: 2, minutes: 0, totalMinutes: 120 },
    { hours: 4, minutes: 0, totalMinutes: 240 },
  ],
  allowCustom: true,
};

// Configurações de notificação
export const DEFAULT_NOTIFICATION_SETTINGS = {
  checkInterval: 60, // Intervalo de verificação em segundos
  enableRenotification: true, // Renotificação desabilitada por padrão
  renotificationInterval: 30, // Intervalo de renotificação em minutos
  enableSigssTabRename: true, // Renomeação de abas SIGSS habilitada por padrão
};

// Configurações de logging
export const DEFAULT_LOG_SETTINGS = {
  logLevel: 1, // INFO por padrão (0=DEBUG, 1=INFO, 2=WARN, 3=ERROR, 4=NONE)
};

// Configurações de ajuda e tour
export const DEFAULT_HELP_SETTINGS = {
  firstTimeUser: true,
  helpTourCompleted: false,
  helpDismissed: false,
};

// Configurações de segurança
export const DEFAULT_SECURITY_SETTINGS = {
  messageTimeout: 30000, // Timeout para mensagens entre scripts (30s)
  notificationCooldown: 15000, // Cooldown entre notificações (15s)
  loginTabCooldown: 300000, // Cooldown para abrir abas de login (5min)
};

// URLs e domínios válidos
export const VALID_DOMAINS = {
  SAU: {
    LOGIN_URL: "https://egov.santos.sp.gov.br/sau/entrar.sau",
    HOME_URL: "https://egov.santos.sp.gov.br/sau/menu/home.sau",
    TASK_SEARCH_URL:
      "https://egov.santos.sp.gov.br/sau/ajax/pesquisar_Tarefa.sau",
    PREPARAR_PESQUISAR_TAREFA_URL:
      "https://egov.santos.sp.gov.br/sau/comum/prepararPesquisar_Tarefa.sau",
  },
  SIGSS: ["c1863prd.cloudmv.com.br", "c1863tst1.cloudmv.com.br"],
};

// Configurações de performance
export const DEFAULT_PERFORMANCE_SETTINGS = {
  mutationThrottleDelay: 500, // Delay para throttling do MutationObserver
  scriptInjectionTimeout: 30000, // Timeout para injeção de scripts
  maxLogEntries: 1000, // Máximo de entradas de log em memória
  maxRetries: 3, // Máximo de tentativas para operações críticas
  baseRetryDelay: 1000, // Delay base para retry (1s)
  maxRetryDelay: 10000, // Delay máximo para retry (10s)
};

// Configurações de storage
export const DEFAULT_STORAGE_SETTINGS = {
  compressionEnabled: true, // Compressão de dados habilitada
  maxStorageSize: 5242880, // 5MB limite para storage local
  cleanupThreshold: 0.8, // Limpar quando usar 80% do storage
  dataRetentionDays: 30, // Manter dados por 30 dias
};

/**
 * Função utilitária para obter configurações padrão por categoria
 * @param {string} category - Categoria de configuração
 * @returns {Object} Configurações padrão da categoria
 */
export function getDefaultConfig(category) {
  const configs = {
    taskDisplay: DEFAULT_TASK_DISPLAY_SETTINGS,
    snooze: DEFAULT_SNOOZE_SETTINGS,
    notification: DEFAULT_NOTIFICATION_SETTINGS,
    log: DEFAULT_LOG_SETTINGS,
    help: DEFAULT_HELP_SETTINGS,
    security: DEFAULT_SECURITY_SETTINGS,
    performance: DEFAULT_PERFORMANCE_SETTINGS,
    storage: DEFAULT_STORAGE_SETTINGS,
    domains: VALID_DOMAINS,
  };

  return configs[category] || {};
}

/**
 * Função utilitária para obter todas as configurações padrão
 * @returns {Object} Todas as configurações padrão
 */
export function getAllDefaultConfigs() {
  return {
    taskDisplaySettings: DEFAULT_TASK_DISPLAY_SETTINGS,
    snoozeSettings: DEFAULT_SNOOZE_SETTINGS,
    ...DEFAULT_NOTIFICATION_SETTINGS,
    ...DEFAULT_LOG_SETTINGS,
    ...DEFAULT_HELP_SETTINGS,
    ...DEFAULT_SECURITY_SETTINGS,
    ...DEFAULT_PERFORMANCE_SETTINGS,
    ...DEFAULT_STORAGE_SETTINGS,
  };
}

/**
 * Função utilitária para validar configurações contra os padrões
 * @param {Object} config - Configuração a ser validada
 * @param {string} category - Categoria de configuração
 * @returns {Object} Configuração validada com fallbacks
 */
export function validateConfig(config, category) {
  const defaults = getDefaultConfig(category);

  if (!config || typeof config !== "object") {
    return defaults;
  }

  // Merge com configurações padrão, mantendo valores válidos
  const validated = { ...defaults };

  for (const [key, value] of Object.entries(config)) {
    if (key in defaults && value !== undefined && value !== null) {
      // Validação específica por tipo
      if (typeof defaults[key] === typeof value) {
        validated[key] = value;
      }
    }
  }

  return validated;
}
