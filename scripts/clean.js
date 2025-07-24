#!/usr/bin/env node

/**
 * Script de Limpeza para Monitor SAU Extension
 * Remove arquivos de build e temporários
 */

const fs = require('fs').promises;
const path = require('path');

class CleanManager {
  constructor() {
    this.rootDir = process.cwd();
    this.cleanTargets = [
      '.dist',
      'node_modules/.cache',
      '*.log',
      '.tmp',
      '.temp'
    ];
  }

  /**
   * Remove um diretório ou arquivo
   */
  async removeTarget(target) {
    const targetPath = path.join(this.rootDir, target);
    
    try {
      const stats = await fs.stat(targetPath);
      
      if (stats.isDirectory()) {
        await fs.rm(targetPath, { recursive: true, force: true });
        console.log(`🗑️  Removido diretório: ${target}`);
      } else {
        await fs.unlink(targetPath);
        console.log(`🗑️  Removido arquivo: ${target}`);
      }
      
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn(`⚠️  Erro ao remover ${target}: ${error.message}`);
      }
    }
  }

  /**
   * Remove arquivos por padrão glob simples
   */
  async removeGlobPattern(pattern) {
    const dir = path.dirname(pattern);
    const filename = path.basename(pattern);
    
    if (!filename.includes('*')) {
      return this.removeTarget(pattern);
    }
    
    try {
      const dirPath = dir === '.' ? this.rootDir : path.join(this.rootDir, dir);
      const files = await fs.readdir(dirPath);
      
      const regex = new RegExp(filename.replace(/\*/g, '.*'));
      
      for (const file of files) {
        if (regex.test(file)) {
          const filePath = path.join(dirPath, file);
          await fs.unlink(filePath);
          console.log(`🗑️  Removido arquivo: ${path.join(dir, file)}`);
        }
      }
      
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn(`⚠️  Erro ao processar padrão ${pattern}: ${error.message}`);
      }
    }
  }

  /**
   * Executa limpeza completa
   */
  async clean() {
    console.log('🧹 Iniciando limpeza...\n');
    
    for (const target of this.cleanTargets) {
      if (target.includes('*')) {
        await this.removeGlobPattern(target);
      } else {
        await this.removeTarget(target);
      }
    }
    
    console.log('\n✅ Limpeza concluída!');
  }

  /**
   * Mostra o que seria removido sem remover
   */
  async dryRun() {
    console.log('🔍 Simulação de limpeza (dry run):\n');
    
    for (const target of this.cleanTargets) {
      const targetPath = path.join(this.rootDir, target);
      
      try {
        await fs.access(targetPath);
        console.log(`🗑️  Seria removido: ${target}`);
      } catch (error) {
        // Arquivo/diretório não existe
      }
    }
    
    console.log('\n💡 Execute sem --dry-run para remover os arquivos');
  }
}

// Execução principal
async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run') || args.includes('-n');
  
  const cleanManager = new CleanManager();
  
  if (isDryRun) {
    await cleanManager.dryRun();
  } else {
    await cleanManager.clean();
  }
}

// Executa apenas se chamado diretamente
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Erro durante limpeza:', error.message);
    process.exit(1);
  });
}

module.exports = { CleanManager };