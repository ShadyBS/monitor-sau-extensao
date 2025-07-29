/**
 * Storage Validator - Validação de Limites de Storage
 * 
 * Este módulo fornece validação de tamanho para operações de storage,
 * garantindo que os dados não excedam os limites do Chrome/Firefox.
 * 
 * Limites do Chrome:
 * - storage.sync: 100KB total, 8KB por item
 * - storage.local: 5MB total
 * 
 * Compatível com Chrome e Firefox (Manifest V3)
 */

import { logger } from "./logger.js";
const storageLogger = logger("[StorageValidator]");

// Define o objeto de API do navegador de forma compatível (Chrome ou Firefox)
const browserAPI = globalThis.browser || globalThis.chrome;

/**
 * Limites de storage do Chrome/Firefox
 */
const STORAGE_LIMITS = {
  sync: {
    totalBytes: 100 * 1024, // 100KB
    itemBytes: 8 * 1024,    // 8KB por item
    maxItems: 512           // Máximo de itens
  },
  local: {
    totalBytes: 5 * 1024 * 1024, // 5MB
    itemBytes: null,              // Sem limite por item no local
    maxItems: null                // Sem limite de itens no local
  }
};

/**
 * Calcula o tamanho em bytes de um objeto JSON
 * @param {any} data - Dados para calcular o tamanho
 * @returns {number} Tamanho em bytes
 */
function calculateDataSize(data) {
  try {
    const jsonString = JSON.stringify(data);
    // Usa TextEncoder para calcular tamanho real em bytes (UTF-8)
    return new TextEncoder().encode(jsonString).length;
  } catch (error) {
    storageLogger.error("Erro ao calcular tamanho dos dados:", error);
    return 0;
  }
}

/**
 * Obtém o uso atual de storage
 * @param {string} storageType - 'sync' ou 'local'
 * @returns {Promise<{bytesInUse: number, itemCount: number}>}
 */
async function getCurrentStorageUsage(storageType) {
  try {
    const storage = browserAPI.storage[storageType];
    
    // Obtém uso em bytes (se suportado)
    let bytesInUse = 0;
    if (storage.getBytesInUse) {
      bytesInUse = await storage.getBytesInUse();
    } else {
      // Fallback: calcula manualmente
      const allData = await storage.get();
      bytesInUse = calculateDataSize(allData);
    }
    
    // Conta número de itens
    const allData = await storage.get();
    const itemCount = Object.keys(allData).length;
    
    return { bytesInUse, itemCount };
  } catch (error) {
    storageLogger.error(`Erro ao obter uso do storage.${storageType}:`, error);
    return { bytesInUse: 0, itemCount: 0 };
  }
}

/**
 * Valida se os dados podem ser salvos sem exceder limites
 * @param {string} storageType - 'sync' ou 'local'
 * @param {Object} newData - Dados a serem salvos
 * @param {Object} existingData - Dados existentes (opcional)
 * @returns {Promise<{valid: boolean, reason?: string, details?: Object}>}
 */
async function validateStorageOperation(storageType, newData, existingData = null) {
  try {
    const limits = STORAGE_LIMITS[storageType];
    if (!limits) {
      return { valid: false, reason: `Tipo de storage inválido: ${storageType}` };
    }
    
    // Calcula tamanho dos novos dados
    const newDataSize = calculateDataSize(newData);
    const newItemCount = Object.keys(newData).length;
    
    // Obtém uso atual se não fornecido
    let currentUsage;
    if (existingData) {
      currentUsage = {
        bytesInUse: calculateDataSize(existingData),
        itemCount: Object.keys(existingData).length
      };
    } else {
      currentUsage = await getCurrentStorageUsage(storageType);
    }
    
    // Calcula tamanho após a operação
    // Para operações de set, assumimos que chaves existentes serão sobrescritas
    let estimatedNewSize = currentUsage.bytesInUse + newDataSize;
    let estimatedItemCount = currentUsage.itemCount + newItemCount;
    
    // Se existingData foi fornecido, ajusta para sobrescrita
    if (existingData) {
      for (const key of Object.keys(newData)) {
        if (existingData.hasOwnProperty(key)) {
          const oldItemSize = calculateDataSize({ [key]: existingData[key] });
          estimatedNewSize -= oldItemSize;
          estimatedItemCount -= 1; // Item será sobrescrito, não adicionado
        }
      }
    }
    
    // Validações específicas por tipo de storage
    const validations = [];
    
    // Validação de tamanho total
    if (estimatedNewSize > limits.totalBytes) {
      validations.push({
        type: 'totalSize',
        current: estimatedNewSize,
        limit: limits.totalBytes,
        exceeded: estimatedNewSize - limits.totalBytes
      });
    }
    
    // Validação de tamanho por item (apenas para sync)
    if (limits.itemBytes) {
      for (const [key, value] of Object.entries(newData)) {
        const itemSize = calculateDataSize({ [key]: value });
        if (itemSize > limits.itemBytes) {
          validations.push({
            type: 'itemSize',
            key: key,
            size: itemSize,
            limit: limits.itemBytes,
            exceeded: itemSize - limits.itemBytes
          });
        }
      }
    }
    
    // Validação de número de itens (apenas para sync)
    if (limits.maxItems && estimatedItemCount > limits.maxItems) {
      validations.push({
        type: 'itemCount',
        current: estimatedItemCount,
        limit: limits.maxItems,
        exceeded: estimatedItemCount - limits.maxItems
      });
    }
    
    const isValid = validations.length === 0;
    
    const result = {
      valid: isValid,
      details: {
        storageType,
        currentUsage,
        newDataSize,
        estimatedNewSize,
        estimatedItemCount,
        limits,
        validations
      }
    };
    
    if (!isValid) {
      const reasons = validations.map(v => {
        switch (v.type) {
          case 'totalSize':
            return `Tamanho total excederia limite (${formatBytes(v.current)} > ${formatBytes(v.limit)})`;
          case 'itemSize':
            return `Item '${v.key}' excede limite por item (${formatBytes(v.size)} > ${formatBytes(v.limit)})`;
          case 'itemCount':
            return `Número de itens excederia limite (${v.current} > ${v.limit})`;
          default:
            return `Validação falhou: ${v.type}`;
        }
      });
      result.reason = reasons.join('; ');
    }
    
    // Log detalhado para debugging
    storageLogger.debug(`Validação de storage.${storageType}:`, {
      valid: isValid,
      newDataSize: formatBytes(newDataSize),
      estimatedNewSize: formatBytes(estimatedNewSize),
      limit: formatBytes(limits.totalBytes),
      validations: validations.length
    });
    
    return result;
  } catch (error) {
    storageLogger.error("Erro durante validação de storage:", error);
    return { 
      valid: false, 
      reason: `Erro interno: ${error.message}`,
      details: { error: error.message }
    };
  }
}

/**
 * Wrapper seguro para storage.set com validação
 * @param {string} storageType - 'sync' ou 'local'
 * @param {Object} data - Dados a serem salvos
 * @param {Object} options - Opções adicionais
 * @returns {Promise<{success: boolean, error?: string, validation?: Object}>}
 */
async function safeStorageSet(storageType, data, options = {}) {
  try {
    // Validação prévia
    const validation = await validateStorageOperation(storageType, data);
    
    if (!validation.valid) {
      storageLogger.warn(`Storage.${storageType}.set rejeitado:`, validation.reason);
      return {
        success: false,
        error: validation.reason,
        validation: validation.details
      };
    }
    
    // Executa operação de storage
    const storage = browserAPI.storage[storageType];
    await storage.set(data);
    
    storageLogger.debug(`Storage.${storageType}.set executado com sucesso:`, {
      keys: Object.keys(data),
      size: formatBytes(validation.details.newDataSize)
    });
    
    return {
      success: true,
      validation: validation.details
    };
  } catch (error) {
    storageLogger.error(`Erro em storage.${storageType}.set:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Obtém estatísticas detalhadas de uso de storage
 * @returns {Promise<Object>} Estatísticas de uso
 */
async function getStorageStats() {
  try {
    const stats = {
      sync: {
        available: false,
        usage: { bytesInUse: 0, itemCount: 0 },
        limits: STORAGE_LIMITS.sync,
        percentUsed: { bytes: 0, items: 0 }
      },
      local: {
        available: true,
        usage: { bytesInUse: 0, itemCount: 0 },
        limits: STORAGE_LIMITS.local,
        percentUsed: { bytes: 0, items: 0 }
      }
    };
    
    // Verifica disponibilidade e uso do sync
    try {
      if (browserAPI.storage.sync) {
        await browserAPI.storage.sync.get('test');
        stats.sync.available = true;
        stats.sync.usage = await getCurrentStorageUsage('sync');
        stats.sync.percentUsed.bytes = (stats.sync.usage.bytesInUse / stats.sync.limits.totalBytes) * 100;
        stats.sync.percentUsed.items = (stats.sync.usage.itemCount / stats.sync.limits.maxItems) * 100;
      }
    } catch (error) {
      storageLogger.debug("Storage.sync não disponível:", error.message);
    }
    
    // Uso do local
    stats.local.usage = await getCurrentStorageUsage('local');
    stats.local.percentUsed.bytes = (stats.local.usage.bytesInUse / stats.local.limits.totalBytes) * 100;
    
    return stats;
  } catch (error) {
    storageLogger.error("Erro ao obter estatísticas de storage:", error);
    return null;
  }
}

/**
 * Formata bytes em formato legível
 * @param {number} bytes - Número de bytes
 * @returns {string} Formato legível (ex: "1.5 KB")
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Limpa dados antigos para liberar espaço
 * @param {string} storageType - 'sync' ou 'local'
 * @param {number} targetReduction - Redução desejada em bytes
 * @returns {Promise<{cleaned: boolean, freedBytes: number, removedKeys: string[]}>}
 */
async function cleanupOldData(storageType, targetReduction) {
  try {
    const storage = browserAPI.storage[storageType];
    const allData = await storage.get();
    
    // Identifica dados que podem ser limpos (implementar lógica específica)
    const cleanableKeys = [];
    let freedBytes = 0;
    
    // Exemplo: remove dados de tarefas muito antigas
    if (allData.lastKnownTasks && Array.isArray(allData.lastKnownTasks)) {
      const oldTasks = allData.lastKnownTasks.filter(task => {
        const taskAge = Date.now() - (task.lastNotifiedTimestamp || 0);
        return taskAge > 30 * 24 * 60 * 60 * 1000; // Mais de 30 dias
      });
      
      if (oldTasks.length > 0) {
        const newTasks = allData.lastKnownTasks.filter(task => {
          const taskAge = Date.now() - (task.lastNotifiedTimestamp || 0);
          return taskAge <= 30 * 24 * 60 * 60 * 1000;
        });
        
        const oldSize = calculateDataSize({ lastKnownTasks: allData.lastKnownTasks });
        const newSize = calculateDataSize({ lastKnownTasks: newTasks });
        
        if (oldSize - newSize >= targetReduction) {
          await storage.set({ lastKnownTasks: newTasks });
          freedBytes = oldSize - newSize;
          cleanableKeys.push('lastKnownTasks (tarefas antigas)');
        }
      }
    }
    
    storageLogger.info(`Limpeza de storage.${storageType}:`, {
      freedBytes: formatBytes(freedBytes),
      removedKeys: cleanableKeys
    });
    
    return {
      cleaned: freedBytes > 0,
      freedBytes,
      removedKeys: cleanableKeys
    };
  } catch (error) {
    storageLogger.error(`Erro na limpeza de storage.${storageType}:`, error);
    return {
      cleaned: false,
      freedBytes: 0,
      removedKeys: []
    };
  }
}

// Exporta as funções públicas
export {
  validateStorageOperation,
  safeStorageSet,
  getCurrentStorageUsage,
  getStorageStats,
  calculateDataSize,
  formatBytes,
  cleanupOldData,
  STORAGE_LIMITS
};