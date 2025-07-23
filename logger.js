// logger.js
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4, // Para desativar todos os logs
};

// Nível de log padrão, será carregado do storage
let currentLogLevel = LOG_LEVELS.INFO;

// Buffer para armazenar as mensagens de log em memória
const logBuffer = [];
// Limite máximo de entradas de log para evitar consumo excessivo de memória
const MAX_LOG_ENTRIES = 1000; // Armazenar até 1000 mensagens de log

// Define o objeto de API do navegador de forma compatível (Chrome ou Firefox)
const browserAPI = globalThis.browser || globalThis.chrome;

// Carrega o nível de log do storage quando o script é carregado
browserAPI.storage.local.get("logLevel").then((data) => {
  if (data.logLevel !== undefined) {
    currentLogLevel = data.logLevel;
  }
  console.log(
    `[Logger] Nível de log inicial definido para: ${Object.keys(
      LOG_LEVELS
    ).find((key) => LOG_LEVELS[key] === currentLogLevel)}`
  );
});

// Adiciona um listener para mudanças no storage, para que o nível de log seja atualizado
// em tempo real em todos os scripts que usam o logger.
browserAPI.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === "local" && changes.logLevel !== undefined) {
    currentLogLevel = changes.logLevel.newValue;
    console.log(
      `[Logger] Nível de log atualizado para: ${Object.keys(LOG_LEVELS).find(
        (key) => LOG_LEVELS[key] === currentLogLevel
      )}`
    );
  }
});

/**
 * Função interna para registrar mensagens no console e no buffer.
 * @param {string} levelName - Nome do nível de log (ex: "INFO", "ERROR").
 * @param {number} levelValue - Valor numérico do nível de log.
 * @param {string} prefix - Prefixo do script (ex: "[Background]").
 * @param {Array<any>} args - Argumentos da mensagem de log.
 */
function log(levelName, levelValue, prefix, ...args) {
  const timestamp = new Date().toISOString(); // Usar ISO string para timestamp exato

  // Adiciona a mensagem ao buffer de logs
  const logEntry = {
    timestamp: timestamp,
    level: levelName,
    prefix: prefix,
    message: args
      .map((arg) =>
        typeof arg === "object" ? JSON.stringify(arg) : String(arg)
      )
      .join(" "),
  };
  logBuffer.push(logEntry);

  // Garante que o buffer não exceda o tamanho máximo
  if (logBuffer.length > MAX_LOG_ENTRIES) {
    logBuffer.shift(); // Remove o log mais antigo
  }

  // Exibe no console se o nível de log for adequado
  if (levelValue >= currentLogLevel) {
    const consoleMessage = `[${timestamp}] ${prefix} [${levelName}]`;
    switch (levelName) {
      case "DEBUG":
        console.debug(consoleMessage, ...args);
        break;
      case "INFO":
        console.info(consoleMessage, ...args);
        break;
      case "WARN":
        console.warn(consoleMessage, ...args);
        break;
      case "ERROR":
        console.error(consoleMessage, ...args);
        break;
      default:
        console.log(consoleMessage, ...args);
    }
  }
}

// Objeto Logger a ser exportado
const logger = (prefix) => ({
  debug: (...args) => log("DEBUG", LOG_LEVELS.DEBUG, prefix, ...args),
  info: (...args) => log("INFO", LOG_LEVELS.INFO, prefix, ...args),
  warn: (...args) => log("WARN", LOG_LEVELS.WARN, prefix, ...args),
  error: (...args) => log("ERROR", LOG_LEVELS.ERROR, prefix, ...args),

  // Métodos para obter e definir o nível de log (principalmente para a página de opções)
  getLogLevel: () => currentLogLevel,
  setLogLevel: async (level) => {
    if (LOG_LEVELS[level] !== undefined) {
      currentLogLevel = LOG_LEVELS[level];
      await browserAPI.storage.local.set({ logLevel: currentLogLevel });
      console.log(`[Logger] Nível de log configurado para: ${level}`);
    } else {
      console.warn(`[Logger] Nível de log inválido: ${level}`);
    }
  },
  // Novo método para obter os logs armazenados
  getStoredLogs: () => logBuffer.slice(), // Retorna uma cópia do buffer
});

// Exporta uma função que cria uma instância do logger com um prefixo
export { logger, LOG_LEVELS };
