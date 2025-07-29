/**
 * Data Compressor - Sistema de Compressão de Dados para Storage
 * 
 * Este módulo fornece compressão e descompressão de dados para otimizar
 * o uso de storage, especialmente para arrays grandes de tarefas.
 * 
 * Estratégias de compressão:
 * 1. Compressão LZ-string para dados grandes (>1KB)
 * 2. Otimização de estruturas de dados (remoção de campos redundantes)
 * 3. Migração automática de dados existentes
 * 
 * Compatível com Chrome e Firefox (Manifest V3)
 */

import { logger } from "./logger.js";
const compressorLogger = logger("[DataCompressor]");

/**
 * Configurações de compressão
 */
const COMPRESSION_CONFIG = {
  // Tamanho mínimo para aplicar compressão (1KB)
  minSizeForCompression: 1024,
  
  // Versão do formato de compressão (para migração futura)
  compressionVersion: 1,
  
  // Campos que podem ser otimizados/removidos para economizar espaço
  optimizableFields: {
    // Campos que podem ser truncados mais agressivamente
    truncatable: {
      'descricao': 500,  // Reduz de 1000 para 500 chars
      'titulo': 150,     // Reduz de 200 para 150 chars
      'unidade': 80,     // Reduz de 100 para 80 chars
    },
    
    // Campos que podem ser removidos se vazios ou padrão
    removableIfEmpty: ['enderecos', 'solicitante'],
    
    // Campos que podem ser convertidos para formatos mais compactos
    compactable: {
      'dataEnvio': 'date',  // Converter para timestamp
      'lastNotifiedTimestamp': 'timestamp'
    }
  }
};

/**
 * Implementação simples de compressão LZ baseada em repetições
 * (Alternativa leve ao LZ-string para evitar dependências externas)
 */
class SimpleLZCompressor {
  /**
   * Comprime uma string usando algoritmo simples baseado em repetições
   * @param {string} input - String para comprimir
   * @returns {string} String comprimida
   */
  static compress(input) {
    if (!input || typeof input !== 'string') return input;
    
    try {
      // Converte para array de caracteres para processamento
      const chars = input.split('');
      const compressed = [];
      const dictionary = new Map();
      let dictIndex = 0;
      
      let i = 0;
      while (i < chars.length) {
        let match = '';
        let matchLength = 0;
        let matchIndex = -1;
        
        // Procura pela maior sequência que já existe no dicionário
        for (let len = Math.min(255, chars.length - i); len > 0; len--) {
          const sequence = chars.slice(i, i + len).join('');
          if (dictionary.has(sequence)) {
            if (len > matchLength) {
              match = sequence;
              matchLength = len;
              matchIndex = dictionary.get(sequence);
            }
          }
        }
        
        if (matchLength > 2) {
          // Usa referência para sequência encontrada
          compressed.push(`§${matchIndex}:${matchLength}§`);
          i += matchLength;
        } else {
          // Adiciona caractere literal
          const char = chars[i];
          compressed.push(char);
          
          // Adiciona ao dicionário sequências de 3+ caracteres
          for (let len = 3; len <= Math.min(10, chars.length - i); len++) {
            const sequence = chars.slice(i, i + len).join('');
            if (!dictionary.has(sequence) && dictIndex < 1000) {
              dictionary.set(sequence, dictIndex++);
            }
          }
          i++;
        }
      }
      
      const result = compressed.join('');
      
      // Só retorna comprimido se realmente economizou espaço
      return result.length < input.length ? result : input;
    } catch (error) {
      compressorLogger.warn("Erro na compressão simples, retornando original:", error);
      return input;
    }
  }
  
  /**
   * Descomprime uma string comprimida
   * @param {string} compressed - String comprimida
   * @returns {string} String original
   */
  static decompress(compressed) {
    if (!compressed || typeof compressed !== 'string') return compressed;
    
    // Se não contém marcadores de compressão, retorna como está
    if (!compressed.includes('§')) return compressed;
    
    try {
      // Reconstrói o dicionário durante a descompressão
      const dictionary = [];
      const result = [];
      
      let i = 0;
      while (i < compressed.length) {
        if (compressed[i] === '§') {
          // Procura pelo fechamento da referência
          const endIndex = compressed.indexOf('§', i + 1);
          if (endIndex === -1) {
            result.push(compressed[i]);
            i++;
            continue;
          }
          
          const reference = compressed.slice(i + 1, endIndex);
          const [indexStr, lengthStr] = reference.split(':');
          const dictIndex = parseInt(indexStr);
          const length = parseInt(lengthStr);
          
          if (!isNaN(dictIndex) && !isNaN(length) && dictionary[dictIndex]) {
            const sequence = dictionary[dictIndex].slice(0, length);
            result.push(sequence);
          }
          
          i = endIndex + 1;
        } else {
          result.push(compressed[i]);
          
          // Reconstrói dicionário
          const currentPos = result.length - 1;
          if (currentPos >= 2) {
            for (let len = 3; len <= Math.min(10, result.length); len++) {
              if (currentPos - len + 1 >= 0) {
                const sequence = result.slice(currentPos - len + 1, currentPos + 1).join('');
                if (dictionary.length < 1000) {
                  dictionary.push(sequence);
                }
              }
            }
          }
          
          i++;
        }
      }
      
      return result.join('');
    } catch (error) {
      compressorLogger.warn("Erro na descompressão, retornando original:", error);
      return compressed;
    }
  }
}

/**
 * Otimiza um objeto de tarefa removendo dados redundantes
 * @param {Object} task - Objeto de tarefa
 * @returns {Object} Tarefa otimizada
 */
function optimizeTaskData(task) {
  if (!task || typeof task !== 'object') return task;
  
  const optimized = { ...task };
  const config = COMPRESSION_CONFIG.optimizableFields;
  
  // Trunca campos configurados
  for (const [field, maxLength] of Object.entries(config.truncatable)) {
    if (optimized[field] && typeof optimized[field] === 'string') {
      optimized[field] = optimized[field].substring(0, maxLength);
    }
  }
  
  // Remove campos vazios configurados
  for (const field of config.removableIfEmpty) {
    if (optimized[field] === undefined || 
        optimized[field] === null || 
        optimized[field] === '' ||
        (Array.isArray(optimized[field]) && optimized[field].length === 0)) {
      delete optimized[field];
    }
  }
  
  // Compacta campos de data
  for (const [field, type] of Object.entries(config.compactable)) {
    if (optimized[field]) {
      if (type === 'date' && typeof optimized[field] === 'string') {
        // Converte data string para timestamp se possível
        const date = new Date(optimized[field]);
        if (!isNaN(date.getTime())) {
          optimized[field] = date.getTime();
        }
      }
    }
  }
  
  return optimized;
}

/**
 * Restaura um objeto de tarefa otimizado
 * @param {Object} optimizedTask - Tarefa otimizada
 * @returns {Object} Tarefa restaurada
 */
function restoreTaskData(optimizedTask) {
  if (!optimizedTask || typeof optimizedTask !== 'object') return optimizedTask;
  
  const restored = { ...optimizedTask };
  const config = COMPRESSION_CONFIG.optimizableFields;
  
  // Restaura campos de data
  for (const [field, type] of Object.entries(config.compactable)) {
    if (restored[field] && typeof restored[field] === 'number') {
      if (type === 'date') {
        // Converte timestamp de volta para string de data
        restored[field] = new Date(restored[field]).toLocaleDateString('pt-BR');
      }
    }
  }
  
  // Restaura campos removidos com valores padrão
  for (const field of config.removableIfEmpty) {
    if (restored[field] === undefined) {
      if (field === 'enderecos') {
        restored[field] = [];
      } else {
        restored[field] = '';
      }
    }
  }
  
  return restored;
}

/**
 * Comprime dados para storage
 * @param {any} data - Dados para comprimir
 * @returns {Object} Objeto com dados comprimidos e metadados
 */
function compressData(data) {
  try {
    const startTime = performance.now();
    let optimizedData = data;
    
    // Otimiza arrays de tarefas
    if (Array.isArray(data)) {
      optimizedData = data.map(optimizeTaskData);
    } else if (data && typeof data === 'object' && data.lastKnownTasks) {
      optimizedData = {
        ...data,
        lastKnownTasks: data.lastKnownTasks.map(optimizeTaskData)
      };
    }
    
    // Serializa para JSON
    const jsonString = JSON.stringify(optimizedData);
    const originalSize = new TextEncoder().encode(jsonString).length;
    
    // Só aplica compressão se os dados forem grandes o suficiente
    if (originalSize < COMPRESSION_CONFIG.minSizeForCompression) {
      return {
        data: optimizedData,
        compressed: false,
        originalSize,
        compressedSize: originalSize,
        compressionRatio: 1,
        processingTime: performance.now() - startTime
      };
    }
    
    // Aplica compressão
    const compressedString = SimpleLZCompressor.compress(jsonString);
    const compressedSize = new TextEncoder().encode(compressedString).length;
    const compressionRatio = originalSize / compressedSize;
    
    // Só usa compressão se realmente economizou espaço significativo
    if (compressionRatio > 1.1) {
      compressorLogger.debug(`Compressão aplicada: ${originalSize} → ${compressedSize} bytes (${(compressionRatio * 100 - 100).toFixed(1)}% economia)`);
      
      return {
        data: compressedString,
        compressed: true,
        version: COMPRESSION_CONFIG.compressionVersion,
        originalSize,
        compressedSize,
        compressionRatio,
        processingTime: performance.now() - startTime
      };
    } else {
      // Compressão não foi eficaz, usa dados otimizados sem compressão
      return {
        data: optimizedData,
        compressed: false,
        originalSize,
        compressedSize: originalSize,
        compressionRatio: 1,
        processingTime: performance.now() - startTime
      };
    }
  } catch (error) {
    compressorLogger.error("Erro durante compressão:", error);
    return {
      data: data,
      compressed: false,
      error: error.message
    };
  }
}

/**
 * Descomprime dados do storage
 * @param {any} compressedData - Dados comprimidos ou objeto com metadados
 * @returns {any} Dados originais
 */
function decompressData(compressedData) {
  try {
    // Se não é um objeto com metadados de compressão, retorna como está
    if (!compressedData || 
        typeof compressedData !== 'object' || 
        !compressedData.hasOwnProperty('compressed')) {
      return compressedData;
    }
    
    const startTime = performance.now();
    
    // Se não foi comprimido, apenas restaura otimizações
    if (!compressedData.compressed) {
      let restoredData = compressedData.data;
      
      // Restaura otimizações em arrays de tarefas
      if (Array.isArray(restoredData)) {
        restoredData = restoredData.map(restoreTaskData);
      } else if (restoredData && typeof restoredData === 'object' && restoredData.lastKnownTasks) {
        restoredData = {
          ...restoredData,
          lastKnownTasks: restoredData.lastKnownTasks.map(restoreTaskData)
        };
      }
      
      return restoredData;
    }
    
    // Descomprime dados
    const decompressedString = SimpleLZCompressor.decompress(compressedData.data);
    const parsedData = JSON.parse(decompressedString);
    
    // Restaura otimizações
    let restoredData = parsedData;
    if (Array.isArray(parsedData)) {
      restoredData = parsedData.map(restoreTaskData);
    } else if (parsedData && typeof parsedData === 'object' && parsedData.lastKnownTasks) {
      restoredData = {
        ...parsedData,
        lastKnownTasks: parsedData.lastKnownTasks.map(restoreTaskData)
      };
    }
    
    const processingTime = performance.now() - startTime;
    compressorLogger.debug(`Descompressão concluída em ${processingTime.toFixed(2)}ms`);
    
    return restoredData;
  } catch (error) {
    compressorLogger.error("Erro durante descompressão:", error);
    // Em caso de erro, tenta retornar os dados como estão
    return compressedData.data || compressedData;
  }
}

/**
 * Migra dados existentes para o formato comprimido
 * @param {Object} existingData - Dados existentes no storage
 * @returns {Object} Dados migrados
 */
function migrateExistingData(existingData) {
  try {
    compressorLogger.info("Iniciando migração de dados existentes para formato comprimido");
    
    const migratedData = {};
    let totalOriginalSize = 0;
    let totalCompressedSize = 0;
    
    for (const [key, value] of Object.entries(existingData)) {
      // Calcula tamanho original
      const originalSize = new TextEncoder().encode(JSON.stringify(value)).length;
      totalOriginalSize += originalSize;
      
      // Comprime dados
      const compressed = compressData(value);
      migratedData[key] = compressed;
      
      totalCompressedSize += compressed.compressedSize || originalSize;
      
      compressorLogger.debug(`Migrado ${key}: ${originalSize} → ${compressed.compressedSize || originalSize} bytes`);
    }
    
    const overallRatio = totalOriginalSize / totalCompressedSize;
    compressorLogger.info(`Migração concluída: ${totalOriginalSize} → ${totalCompressedSize} bytes (${((overallRatio - 1) * 100).toFixed(1)}% economia)`);
    
    return migratedData;
  } catch (error) {
    compressorLogger.error("Erro durante migração:", error);
    return existingData;
  }
}

/**
 * Verifica se os dados estão no formato comprimido
 * @param {any} data - Dados para verificar
 * @returns {boolean} True se estão comprimidos
 */
function isCompressedFormat(data) {
  return data && 
         typeof data === 'object' && 
         data.hasOwnProperty('compressed') &&
         data.hasOwnProperty('data');
}

/**
 * Obtém estatísticas de compressão
 * @param {Object} compressedData - Dados comprimidos
 * @returns {Object} Estatísticas
 */
function getCompressionStats(compressedData) {
  if (!isCompressedFormat(compressedData)) {
    return {
      compressed: false,
      originalSize: 0,
      compressedSize: 0,
      compressionRatio: 1,
      spaceSaved: 0
    };
  }
  
  const { originalSize, compressedSize, compressionRatio } = compressedData;
  return {
    compressed: compressedData.compressed,
    originalSize: originalSize || 0,
    compressedSize: compressedSize || 0,
    compressionRatio: compressionRatio || 1,
    spaceSaved: (originalSize || 0) - (compressedSize || 0)
  };
}

// Exporta as funções públicas
export {
  compressData,
  decompressData,
  migrateExistingData,
  isCompressedFormat,
  getCompressionStats,
  optimizeTaskData,
  restoreTaskData,
  COMPRESSION_CONFIG
};