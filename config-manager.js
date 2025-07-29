/**
 * Gerenciador de Configurações com Suporte a SYNC
 * 
 * Este módulo fornece uma interface unificada para salvar e carregar configurações
 * usando chrome.storage.sync como preferência e chrome.storage.local como fallback.
 * 
 * Compatível com Chrome e Firefox (Manifest V3)
 */

import { logger } from "./logger.js";
import { safeStorageSet, validateStorageOperation } from "./storage-validator.js";
const configLogger = logger("[ConfigManager]");

// Define o objeto de API do navegador de forma compatível (Chrome ou Firefox)
const browserAPI = globalThis.browser || globalThis.chrome;

/**
 * Configurações padrão da extensão
 */
const DEFAULT_CONFIG = {
  // Credenciais de login
  sauUsername: "",
  sauPassword: "",
  
  // Configurações de notificação
  checkInterval: 30,
  enableRenotification: false,
  renotificationInterval: 30,
  enableSigssTabRename: true, // Habilitado por padrão
  
  // Configurações de exibição
  taskDisplaySettings: {
    headerFields: {
      numero: true,
      titulo: true,
      dataEnvio: true,
      posicao: true,
      solicitante: false,
      unidade: false,
    }
  },
  
  // Configurações de snooze
  snoozeSettings: {
    options: [
      { hours: 0, minutes: 15, totalMinutes: 15 },
      { hours: 0, minutes: 30, totalMinutes: 30 },
      { hours: 1, minutes: 0, totalMinutes: 60 },
      { hours: 2, minutes: 0, totalMinutes: 120 },
      { hours: 4, minutes: 0, totalMinutes: 240 }
    ],
    allowCustom: true
  },
  
  // Configurações de log
  logLevel: 1, // INFO por padrão
  
  // Configurações de ajuda
  helpTourCompleted: false,
  helpTourStarted: false,
  helpTourSkipped: false,
  helpDismissed: false,
  firstTimeUser: true,
  
  // Dados de sessão (sempre local)
  lastKnownTasks: [],
  snoozeTime: {}
};

/**
 * Chaves que devem ser sempre armazenadas localmente (não sincronizadas)
 */
const LOCAL_ONLY_KEYS = [
  'lastKnownTasks',
  'snoozeTime',
  'helpTourStarted',
  'firstTimeUser'
];

/**
 * Chaves sensíveis que podem ser opcionalmente sincronizadas
 */
const SENSITIVE_KEYS = [
  'sauUsername',
  'sauPassword'
];

/**
 * Verifica se o storage.sync está disponível
 */
async function isSyncAvailable() {
  try {
    if (!browserAPI.storage || !browserAPI.storage.sync) {
      return false;
    }
    
    // Testa se podemos usar o sync fazendo uma operação simples
    await browserAPI.storage.sync.get('test');
    return true;
  } catch (error) {
    configLogger.warn("Storage.sync não disponível:", error.message);
    return false;
  }
}

/**
 * Determina qual storage usar para uma chave específica
 */
function getStorageType(key) {
  if (LOCAL_ONLY_KEYS.includes(key)) {
    return 'local';
  }
  return 'sync'; // Preferência para sync quando disponível
}

/**
 * Salva uma configuração usando a estratégia apropriada com validação de tamanho
 */
async function setConfig(key, value) {
  const storageType = getStorageType(key);
  const syncAvailable = await isSyncAvailable();
  
  const data = { [key]: value };
  
  try {
    if (storageType === 'sync' && syncAvailable) {
      // Tenta salvar no sync primeiro com validação
      const syncResult = await safeStorageSet('sync', data);
      
      if (syncResult.success) {
        configLogger.debug(`Configuração '${key}' salva no storage.sync com validação`);
        
        // Também salva no local como backup
        const localResult = await safeStorageSet('local', data);
        if (localResult.success) {
          configLogger.debug(`Configuração '${key}' salva no storage.local como backup`);
        } else {
          configLogger.warn(`Backup local falhou para '${key}':`, localResult.error);
          // Continua mesmo se o backup falhar
        }
      } else {
        configLogger.warn(`Falha ao salvar '${key}' no sync:`, syncResult.error);
        
        // Fallback para local storage
        const localResult = await safeStorageSet('local', data);
        if (localResult.success) {
          configLogger.info(`Configuração '${key}' salva no storage.local (fallback após falha sync)`);
        } else {
          configLogger.error(`Falha total ao salvar '${key}':`, localResult.error);
          // Último recurso: salva sem validação
          await browserAPI.storage.local.set(data);
          configLogger.warn(`Configuração '${key}' salva sem validação como último recurso`);
        }
      }
    } else {
      // Usa apenas local storage com validação
      const result = await safeStorageSet('local', data);
      
      if (result.success) {
        configLogger.debug(`Configuração '${key}' salva no storage.local com validação`);
      } else {
        configLogger.warn(`Falha na validação para '${key}':`, result.error);
        // Fallback: salva sem validação
        await browserAPI.storage.local.set(data);
        configLogger.warn(`Configuração '${key}' salva no storage.local sem validação`);
      }
    }
  } catch (error) {
    configLogger.error(`Erro ao salvar configuração '${key}':`, error);
    
    // Fallback para local storage se sync falhar
    if (storageType === 'sync') {
      try {
        await browserAPI.storage.local.set(data);
        configLogger.info(`Configuração '${key}' salva no storage.local (fallback de emergência)`);
      } catch (localError) {
        configLogger.error(`Erro no fallback para storage.local:`, localError);
        throw localError;
      }
    } else {
      throw error;
    }
  }
}

/**
 * Salva múltiplas configurações de uma vez com validação de tamanho
 */
async function setConfigs(configs) {
  const syncConfigs = {};
  const localConfigs = {};
  
  // Separa as configurações por tipo de storage
  for (const [key, value] of Object.entries(configs)) {
    if (getStorageType(key) === 'local') {
      localConfigs[key] = value;
    } else {
      syncConfigs[key] = value;
    }
  }
  
  const syncAvailable = await isSyncAvailable();
  
  try {
    // Salva configurações sync com validação
    if (Object.keys(syncConfigs).length > 0) {
      if (syncAvailable) {
        const syncResult = await safeStorageSet('sync', syncConfigs);
        
        if (syncResult.success) {
          configLogger.debug(`Configurações salvas no storage.sync com validação:`, Object.keys(syncConfigs));
          
          // Backup no local
          const localBackupResult = await safeStorageSet('local', syncConfigs);
          if (localBackupResult.success) {
            configLogger.debug(`Configurações salvas no storage.local como backup:`, Object.keys(syncConfigs));
          } else {
            configLogger.warn(`Backup local falhou:`, localBackupResult.error);
            // Tenta backup sem validação
            await browserAPI.storage.local.set(syncConfigs);
            configLogger.debug(`Backup local salvo sem validação:`, Object.keys(syncConfigs));
          }
        } else {
          configLogger.warn(`Falha ao salvar no sync:`, syncResult.error);
          
          // Fallback para local
          const localResult = await safeStorageSet('local', syncConfigs);
          if (localResult.success) {
            configLogger.info(`Configurações salvas no storage.local (fallback):`, Object.keys(syncConfigs));
          } else {
            configLogger.error(`Falha total:`, localResult.error);
            // Último recurso: salva sem validação
            await browserAPI.storage.local.set(syncConfigs);
            configLogger.warn(`Configurações salvas no storage.local sem validação:`, Object.keys(syncConfigs));
          }
        }
      } else {
        const result = await safeStorageSet('local', syncConfigs);
        if (result.success) {
          configLogger.debug(`Configurações salvas no storage.local com validação:`, Object.keys(syncConfigs));
        } else {
          configLogger.warn(`Falha na validação:`, result.error);
          await browserAPI.storage.local.set(syncConfigs);
          configLogger.debug(`Configurações salvas no storage.local sem validação:`, Object.keys(syncConfigs));
        }
      }
    }
    
    // Salva configurações locais com validação
    if (Object.keys(localConfigs).length > 0) {
      const result = await safeStorageSet('local', localConfigs);
      if (result.success) {
        configLogger.debug(`Configurações locais salvas com validação:`, Object.keys(localConfigs));
      } else {
        configLogger.warn(`Falha na validação de configurações locais:`, result.error);
        await browserAPI.storage.local.set(localConfigs);
        configLogger.debug(`Configurações locais salvas sem validação:`, Object.keys(localConfigs));
      }
    }
  } catch (error) {
    configLogger.error("Erro ao salvar configurações:", error);
    
    // Fallback: salva tudo no local sem validação
    try {
      await browserAPI.storage.local.set(configs);
      configLogger.info("Configurações salvas no storage.local (fallback completo)");
    } catch (localError) {
      configLogger.error("Erro no fallback completo:", localError);
      throw localError;
    }
  }
}

/**
 * Carrega uma configuração específica
 */
async function getConfig(key, defaultValue = null) {
  const storageType = getStorageType(key);
  const syncAvailable = await isSyncAvailable();
  
  try {
    let result = null;
    
    if (storageType === 'sync' && syncAvailable) {
      // Tenta carregar do sync primeiro
      const syncData = await browserAPI.storage.sync.get(key);
      if (syncData[key] !== undefined) {
        result = syncData[key];
        configLogger.debug(`Configuração '${key}' carregada do storage.sync`);
      } else {
        // Fallback para local
        const localData = await browserAPI.storage.local.get(key);
        result = localData[key];
        configLogger.debug(`Configuração '${key}' carregada do storage.local (fallback)`);
      }
    } else {
      // Usa apenas local storage
      const localData = await browserAPI.storage.local.get(key);
      result = localData[key];
      configLogger.debug(`Configuração '${key}' carregada do storage.local`);
    }
    
    // Retorna valor padrão se não encontrado
    if (result === undefined) {
      result = defaultValue !== null ? defaultValue : DEFAULT_CONFIG[key];
    }
    
    return result;
  } catch (error) {
    configLogger.error(`Erro ao carregar configuração '${key}':`, error);
    return defaultValue !== null ? defaultValue : DEFAULT_CONFIG[key];
  }
}

/**
 * Carrega múltiplas configurações
 */
async function getConfigs(keys) {
  const syncKeys = [];
  const localKeys = [];
  
  // Separa as chaves por tipo de storage
  for (const key of keys) {
    if (getStorageType(key) === 'local') {
      localKeys.push(key);
    } else {
      syncKeys.push(key);
    }
  }
  
  const result = {};
  const syncAvailable = await isSyncAvailable();
  
  try {
    // Carrega configurações sync
    if (syncKeys.length > 0) {
      if (syncAvailable) {
        const syncData = await browserAPI.storage.sync.get(syncKeys);
        const localData = await browserAPI.storage.local.get(syncKeys);
        
        // Usa sync como preferência, local como fallback
        for (const key of syncKeys) {
          if (syncData[key] !== undefined) {
            result[key] = syncData[key];
          } else if (localData[key] !== undefined) {
            result[key] = localData[key];
          } else {
            result[key] = DEFAULT_CONFIG[key];
          }
        }
        configLogger.debug(`Configurações sync carregadas:`, syncKeys);
      } else {
        const localData = await browserAPI.storage.local.get(syncKeys);
        for (const key of syncKeys) {
          result[key] = localData[key] !== undefined ? localData[key] : DEFAULT_CONFIG[key];
        }
        configLogger.debug(`Configurações carregadas do storage.local:`, syncKeys);
      }
    }
    
    // Carrega configurações locais
    if (localKeys.length > 0) {
      const localData = await browserAPI.storage.local.get(localKeys);
      for (const key of localKeys) {
        result[key] = localData[key] !== undefined ? localData[key] : DEFAULT_CONFIG[key];
      }
      configLogger.debug(`Configurações locais carregadas:`, localKeys);
    }
    
    return result;
  } catch (error) {
    configLogger.error("Erro ao carregar configurações:", error);
    
    // Fallback: carrega tudo do local
    try {
      const localData = await browserAPI.storage.local.get(keys);
      for (const key of keys) {
        result[key] = localData[key] !== undefined ? localData[key] : DEFAULT_CONFIG[key];
      }
      configLogger.info("Configurações carregadas do storage.local (fallback)");
      return result;
    } catch (localError) {
      configLogger.error("Erro no fallback:", localError);
      
      // Último recurso: retorna valores padrão
      for (const key of keys) {
        result[key] = DEFAULT_CONFIG[key];
      }
      return result;
    }
  }
}

/**
 * Migra configurações do local para sync (se disponível)
 */
async function migrateToSync() {
  const syncAvailable = await isSyncAvailable();
  if (!syncAvailable) {
    configLogger.info("Storage.sync não disponível, migração não necessária");
    return;
  }
  
  try {
    // Carrega todas as configurações do local
    const allKeys = Object.keys(DEFAULT_CONFIG);
    const localData = await browserAPI.storage.local.get(allKeys);
    
    const syncableData = {};
    
    // Filtra apenas as configurações que podem ser sincronizadas
    for (const [key, value] of Object.entries(localData)) {
      if (!LOCAL_ONLY_KEYS.includes(key) && value !== undefined) {
        syncableData[key] = value;
      }
    }
    
    if (Object.keys(syncableData).length > 0) {
      await browserAPI.storage.sync.set(syncableData);
      configLogger.info(`Migração concluída: ${Object.keys(syncableData).length} configurações movidas para sync`);
    }
  } catch (error) {
    configLogger.error("Erro durante migração para sync:", error);
  }
}

/**
 * Obtém informações sobre o status do storage
 */
async function getStorageInfo() {
  const syncAvailable = await isSyncAvailable();
  
  const info = {
    syncAvailable,
    localKeys: LOCAL_ONLY_KEYS,
    sensitiveKeys: SENSITIVE_KEYS,
    defaultConfig: DEFAULT_CONFIG
  };
  
  if (syncAvailable) {
    try {
      const syncUsage = await browserAPI.storage.sync.getBytesInUse();
      info.syncUsage = syncUsage;
    } catch (error) {
      configLogger.warn("Não foi possível obter uso do storage.sync:", error);
    }
  }
  
  try {
    const localUsage = await browserAPI.storage.local.getBytesInUse();
    info.localUsage = localUsage;
  } catch (error) {
    configLogger.warn("Não foi possível obter uso do storage.local:", error);
  }
  
  return info;
}

/**
 * Limpa configurações específicas
 */
async function clearConfig(keys) {
  const syncAvailable = await isSyncAvailable();
  
  try {
    if (syncAvailable) {
      await browserAPI.storage.sync.remove(keys);
      configLogger.debug(`Configurações removidas do storage.sync:`, keys);
    }
    
    await browserAPI.storage.local.remove(keys);
    configLogger.debug(`Configurações removidas do storage.local:`, keys);
  } catch (error) {
    configLogger.error("Erro ao limpar configurações:", error);
    throw error;
  }
}

// Exporta as funções públicas
export {
  setConfig,
  setConfigs,
  getConfig,
  getConfigs,
  migrateToSync,
  getStorageInfo,
  clearConfig,
  DEFAULT_CONFIG,
  LOCAL_ONLY_KEYS,
  SENSITIVE_KEYS,
  isSyncAvailable
};
