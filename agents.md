# Guia para Agentes de IA - Monitor SAU Extension

Olá, agente! Este documento é o seu guia principal para entender e contribuir com este projeto de extensão para navegador. Seguir estas diretrizes garantirá que suas contribuições sejam consistentes, de alta qualidade e bem integradas ao trabalho da equipe humana.

> **⚠️ IMPORTANTE:** Este documento deve ser mantido atualizado sempre que a estrutura do projeto, fluxos de trabalho ou ferramentas mudarem. Ao fazer modificações significativas no projeto, verifique se este guia precisa ser atualizado.

## Índice

1. [Objetivo Principal](#1-objetivo-principal)
2. [Estrutura do Projeto](#2-estrutura-do-projeto)
3. [Fluxo de Trabalho de Modificação](#3-fluxo-de-trabalho-de-modificação)
4. [Scripts e Automação](#4-scripts-e-automação)
5. [Revisão de Código](#5-revisão-de-código)
6. [Documentação e Comentários](#6-documentação-e-comentários)
7. [Debugging e Troubleshooting](#7-debugging-e-troubleshooting)
8. [Princípios Gerais](#8-princípios-gerais)
9. [Recursos Úteis](#9-recursos-úteis)
10. [Resumo do Fluxo](#10-resumo-do-fluxo)
11. [Manutenção deste Documento](#11-manutenção-deste-documento)
12. [Instruções Específicas para CHANGELOG e Commits](#12-instruções-específicas-para-changelog-e-commits)

## 1. Objetivo Principal

Seu objetivo é auxiliar no desenvolvimento e manutenção da **Monitor SAU Extension**, uma extensão para navegador que monitora tarefas no Sistema de Atendimento ao Usuário (SAU). Você deve escrever código limpo, eficiente e bem documentado, seguindo as práticas estabelecidas neste guia e atuando como um membro produtivo da equipe de engenharia.

## 2. Estrutura do Projeto

Esta é uma **extensão para navegador** (Chrome e Firefox) com estrutura específica para Manifest V3. Entenda a organização dos arquivos:

```
├── .github/                    # CI/CD e templates
│   ├── workflows/             # GitHub Actions
│   └── ISSUE_TEMPLATE/        # Templates para issues
├── .dist/                     # Arquivos de build (gerado automaticamente)
├── scripts/                   # Scripts de automação
│   ├── build.js              # Build para Chrome/Firefox
│   ├── version.js            # Gerenciamento de versões
│   ├── release.js            # Release automatizado
│   ├── validate.js           # Validações de qualidade
│   └── clean.js              # Limpeza de arquivos
├── icons/                     # Ícones da extensão (16px, 48px, 128px)
├── background.js              # Service Worker principal
├── content.js                 # Script injetado nas páginas
├── interceptor.js             # Interceptador de requisições
├── sanitizer.js               # Utilitários de segurança e sanitização
├── popup.html/js/css          # Interface do popup
├── options.html/js/css        # Página de configurações
├── notification-ui.css        # Estilos para notificações visuais
├── css-variables.css          # Variáveis CSS centralizadas
├── logger.js                  # Sistema de logging
├── manifest.json              # Manifest para Chrome
├── manifest-firefox.json      # Manifest para Firefox
├── package.json               # Dependências e scripts NPM
├── CHANGELOG.md               # Histórico de mudanças
├── README.md                  # Documentação principal
├── SCRIPTS.md                 # Documentação dos scripts
├── SECURITY-FIXES.md          # Guia de correções de segurança
├── SECURITY-AUDIT-SUMMARY.md  # Relatório de auditoria de segurança
├── LICENSE                    # Licença MIT
└── agents.md                  # Este guia
```

**Regras Importantes:**
- **NÃO modifique** arquivos em `.dist/` - são gerados automaticamente
- **Sempre analise** os arquivos existentes para entender padrões
- **Use o sistema de logging** (`logger.js`) em vez de `console.log`
- **Mantenha compatibilidade** entre Chrome e Firefox

## 3. Fluxo de Trabalho de Modificação

### Passo 1: Entender a Tarefa

Analise cuidadosamente a solicitação. Para extensões de navegador, considere:
- Compatibilidade entre Chrome e Firefox
- Limitações do Manifest V3
- Permissões necessárias
- Impacto na performance

### Passo 2: Validar Ambiente

Antes de começar, execute:
```bash
npm run validate  # Verifica qualidade e segurança
```

### Passo 3: Codificar a Solução

Adote as seguintes práticas específicas para extensões:

- **APIs de Extensão:** Use `(globalThis.browser || globalThis.chrome)` para compatibilidade
- **Logging:** Use o sistema `logger.js` em vez de `console.log`
- **Segurança:** Use `sanitizer.js` para manipulação segura do DOM, evite `eval()` e `innerHTML`
- **Performance:** Minimize o tamanho dos arquivos
- **Manifests:** Mantenha sincronizados `manifest.json` e `manifest-firefox.json`

**Exemplo de código compatível:**
```javascript
// ✅ Correto - compatível com Chrome e Firefox
const browserAPI = globalThis.browser || globalThis.chrome;
await browserAPI.storage.local.set({ key: value });

// ✅ Correto - usando sistema de logging
import { logger } from './logger.js';
const myLogger = logger('[MyModule]');
myLogger.info('Operação realizada com sucesso');

// ✅ Correto - manipulação segura do DOM
import { createSafeElement, sanitizeTaskData } from './sanitizer.js';
const safeElement = createSafeElement('div', 'Texto seguro', { class: 'task-item' });

// ❌ Incorreto - apenas Chrome
chrome.storage.local.set({ key: value });

// ❌ Incorreto - logging direto
console.log('Debug info');

// ❌ Incorreto - vulnerável a XSS
element.innerHTML = userInput;
```

**Práticas de Segurança Obrigatórias:**
```javascript
// ✅ Use sanitizer.js para manipulação do DOM
import { createSafeElement, sanitizeTaskData, safelyPopulateContainer } from './sanitizer.js';

// ✅ Sempre sanitize dados de entrada
const task = sanitizeTaskData(rawTaskData);

// ✅ Use validação de origem em mensagens
window.addEventListener("message", (event) => {
  if (event.origin !== window.location.origin) {
    console.warn("Mensagem de origem não confiável rejeitada");
    return;
  }
  // Processar mensagem...
});

// ✅ Valide URLs antes de usar
try {
  new URL(taskLink); // Valida formato da URL
} catch (error) {
  logger.warn(`URL inválida: ${taskLink}`);
  taskLink = '#'; // Fallback seguro
}
```

### Passo 4: Testar com Scripts

Use os scripts automatizados:
```bash
npm run build          # Build para ambos navegadores
npm run build:chrome   # Build apenas Chrome
npm run build:firefox  # Build apenas Firefox
npm run validate       # Validar qualidade
```

### Passo 5: Atualizar Documentação

- **CHANGELOG.md:** Adicione entrada na seção `[Unreleased]`
- **README.md:** Atualize se necessário
- **Comentários:** Documente código complexo
- **agents.md:** Atualize se mudou estrutura/fluxos

### Passo 6: Versionamento e Commit

```bash
# Para mudanças pequenas (bugfixes)
npm run version:patch

# Para novas funcionalidades
npm run version:minor

# Para mudanças breaking
npm run version:major

# Commit seguindo Conventional Commits
git add .
git commit -m "feat(popup): adicionar dropdown de snooze configurável"
```

## 4. Scripts e Automação

Este projeto possui scripts robustos para automação. **Use-os sempre:**

### Scripts de Build
```bash
npm run build          # Build completo (Chrome + Firefox)
npm run build:chrome   # Apenas Chrome
npm run build:firefox  # Apenas Firefox
npm run clean          # Limpar arquivos temporários
```

### Scripts de Qualidade
```bash
npm run validate       # Validações completas
npm run validate -- --fix  # Corrigir problemas automaticamente
```

### Scripts de Versionamento
```bash
npm run version:patch  # 1.0.0 → 1.0.1
npm run version:minor  # 1.0.0 → 1.1.0
npm run version:major  # 1.0.0 → 2.0.0
node scripts/version.js info  # Mostrar versões atuais
```

### Scripts de Release
```bash
npm run release        # Release completo no GitHub
npm run release -- -y  # Release sem confirmação
```

**Importante:** Os scripts incluem validações de segurança e verificações de qualidade. Não os contorne.

## 5. Revisão de Código

### Autoavaliação Específica para Extensões

Antes de submeter código, verifique:

- **Compatibilidade:** Funciona em Chrome E Firefox?
- **Permissões:** Usa apenas permissões necessárias?
- **Performance:** Não bloqueia a UI do navegador?
- **Segurança:** Não introduz vulnerabilidades?
- **Manifests:** Estão sincronizados?
- **Build:** Scripts de build passam sem erros?

### Checklist de Extensão
- [ ] Testado em Chrome e Firefox
- [ ] Manifests sincronizados
- [ ] Logging usando `logger.js`
- [ ] APIs compatíveis (`browserAPI`)
- [ ] Sem `console.log` em produção
- [ ] Manipulação segura do DOM usando `sanitizer.js`
- [ ] Validação de origem em mensagens entre contextos
- [ ] Sanitização de dados de entrada
- [ ] Validações de segurança passam
- [ ] Build gera ZIPs válidos

## 6. Documentação e Comentários

### Comentários Específicos para Extensões

```javascript
/**
 * Injeta content script na aba ativa do SAU
 * Compatível com Manifest V3 (Chrome/Firefox)
 * @param {number} tabId - ID da aba
 * @param {string} scriptPath - Caminho do script
 */
async function injectScript(tabId, scriptPath) {
  const browserAPI = globalThis.browser || globalThis.chrome;
  
  try {
    await browserAPI.scripting.executeScript({
      target: { tabId },
      files: [scriptPath]
    });
  } catch (error) {
    // Aba pode ter sido fechada ou não ter permissão
    logger.warn(`Falha ao injetar script: ${error.message}`);
  }
}
```

### Documentação de APIs

Para funções que interagem com APIs de extensão, documente:
- Permissões necessárias
- Compatibilidade de navegadores
- Tratamento de erros
- Limitações do Manifest V3

## 7. Debugging e Troubleshooting

### Ferramentas Específicas

- **Chrome DevTools:** `chrome://extensions/` → Developer mode
- **Firefox DevTools:** `about:debugging` → This Firefox
- **Logs da Extensão:** Use `npm run validate` para verificar problemas
- **Build Debug:** Execute scripts com `DEBUG=1 npm run build`

### Problemas Comuns

1. **Manifest V3 Limitations:**
   - Service Workers em vez de background pages
   - APIs assíncronas obrigatórias

2. **Compatibilidade Chrome/Firefox:**
   - Use `browserAPI` wrapper
   - Teste em ambos navegadores
   - Verifique diferenças de API

3. **Permissões:**
   - Declare todas as permissões necessárias
   - Use `host_permissions` para sites específicos
   - Evite permissões amplas como `<all_urls>`

## 8. Princípios Gerais

1. **Compatibilidade Primeiro:** Sempre considere Chrome E Firefox
2. **Segurança Rigorosa:** Extensões têm acesso privilegiado
3. **Performance Crítica:** Não impacte a experiência do usuário
4. **Automação Obrigatória:** Use os scripts fornecidos
5. **Documentação Viva:** Mantenha documentos atualizados

## 9. Recursos Úteis

### Documentação de Extensões
- [Chrome Extension Manifest V3](https://developer.chrome.com/docs/extensions/mv3/)
- [Firefox WebExtensions](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions)
- [Browser Extension APIs](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API)

### Ferramentas do Projeto
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Keep a Changelog](https://keepachangelog.com/)
- [Semantic Versioning](https://semver.org/)
- [GitHub CLI](https://cli.github.com/)

### Validação e Qualidade
- Scripts de validação personalizados
- GitHub Actions para CI/CD
- Verificações de segurança automatizadas

## 10. Resumo do Fluxo

### Para Cada Tarefa

1. **Validar ambiente:** `npm run validate`
2. **Analisar** compatibilidade Chrome/Firefox
3. **Codificar** usando padrões da extensão
4. **Testar** com `npm run build`
5. **Documentar** mudanças no CHANGELOG
6. **Versionar** com scripts NPM
7. **Commitar** usando Conventional Commits
8. **Revisar** checklist de extensão
9. **Release** com `npm run release`

### Checklist Pré-Commit para Extensões

- [ ] `npm run validate` passa sem erros
- [ ] Testado em Chrome e Firefox
- [ ] Manifests sincronizados
- [ ] CHANGELOG.md atualizado
- [ ] Logging usando `logger.js`
- [ ] APIs compatíveis (`browserAPI`)
- [ ] Commit message segue Conventional Commits
- [ ] Build gera ZIPs válidos
- [ ] Documentação atualizada se necessário

## 11. Manutenção deste Documento

### Quando Atualizar

Este documento **DEVE** ser atualizado quando:

- ✅ **Estrutura do projeto muda** (novos diretórios, arquivos importantes)
- ✅ **Novos scripts são adicionados** ou modificados
- ✅ **Fluxo de trabalho muda** (novos passos, ferramentas)
- ✅ **Novas ferramentas são introduzidas** (linters, validators)
- ✅ **Padrões de código mudam** (convenções, APIs)
- ✅ **Processo de release muda** (versionamento, CI/CD)

### Como Atualizar

1. **Identifique a mudança:** O que mudou no projeto?
2. **Localize seções afetadas:** Quais partes do guia precisam atualização?
3. **Atualize o conteúdo:** Mantenha consistência e clareza
4. **Teste as instruções:** Verifique se os exemplos funcionam
5. **Commit a mudança:** Use `docs(agents): atualizar guia com [mudança]`

### Responsabilidade

- **Desenvolvedores:** Ao fazer mudanças estruturais, verifique se este guia precisa atualização
- **Agentes IA:** Ao encontrar inconsistências, sinalize ou corrija
- **Revisores:** Incluam verificação deste documento em reviews significativos

### Exemplo de Atualização

```bash
# Após adicionar novo script ou ferramenta
git add agents.md
git commit -m "docs(agents): adicionar instruções para novo script de deploy"
```

---

**Lembre-se:** Este guia é um documento vivo. Sua precisão e utilidade dependem de mantê-lo atualizado com a evolução do projeto. A qualidade do código e a eficiência da equipe dependem de seguir e manter estas diretrizes.

**Última atualização:** 2025-01-23 - Implementadas correções críticas de segurança, adicionado sistema de sanitização e atualizadas práticas de desenvolvimento seguro.

Obrigado por sua contribuição!

---

## 12. Instruções Específicas para CHANGELOG e Commits

### ⚠️ PROBLEMAS COMUNS E SOLUÇÕES

#### Problema 1: Dificuldades com Edição do CHANGELOG.md

**Sintomas:** Erro "Could not find exact match" ao tentar editar CHANGELOG.md

**Soluções:**

**Método 1 - Edição Direta (Preferido):**
1. Leia o arquivo primeiro: `read_file CHANGELOG.md`
2. Identifique a seção `[Unreleased]` exata
3. Use `replace_in_file` com texto exato encontrado

**Método 2 - Adição via Terminal (Fallback):**
```bash
# Se a edição direta falhar, use comandos echo:
echo "" >> CHANGELOG.md
echo "### Fixed" >> CHANGELOG.md
echo "- **Sua Correção**: Descrição da correção implementada" >> CHANGELOG.md
```

**Método 3 - Adição no Final:**
```bash
# Adicione nova versão no final do arquivo
echo "" >> CHANGELOG.md
echo "## [1.x.x] - $(date +%Y-%m-%d)" >> CHANGELOG.md
echo "" >> CHANGELOG.md
echo "### Fixed" >> CHANGELOG.md
echo "- **Sua Correção**: Descrição detalhada" >> CHANGELOG.md
```

#### Problema 2: Não Realização de Commit ao Final

**⚠️ CRÍTICO:** SEMPRE finalize a tarefa com commit. Nunca deixe mudanças sem commit.

**Sequência Obrigatória:**

1. **Verificar Status:**
```bash
git status  # Veja quais arquivos foram modificados
```

2. **Adicionar Arquivos:**
```bash
git add .  # Adiciona todos os arquivos modificados
# OU específicos:
git add background.js CHANGELOG.md
```

3. **Commit com Conventional Commits:**
```bash
# Para correções de bugs:
git commit -m "fix(background): corrigir múltiplas abas de login sem credenciais"

# Para novas funcionalidades:
git commit -m "feat(popup): adicionar dropdown de snooze configurável"

# Para documentação:
git commit -m "docs(changelog): atualizar com correções de login"
```

### Categorias do CHANGELOG

**Use sempre estas categorias:**
- `### Added` - Novas funcionalidades
- `### Changed` - Mudanças em funcionalidades existentes  
- `### Fixed` - Correções de bugs
- `### Removed` - Funcionalidades removidas
- `### Security` - Correções de segurança

### Tipos de Commit Mais Comuns

- `fix`: Correção de bug
- `feat`: Nova funcionalidade
- `docs`: Mudanças na documentação
- `refactor`: Refatoração de código
- `chore`: Tarefas de manutenção
- `style`: Formatação, espaços em branco

### Escopos Comuns

- `background`: Service Worker
- `popup`: Interface do popup
- `content`: Content script
- `options`: Página de configurações
- `build`: Scripts de build
- `security`: Correções de segurança

### Exemplo Completo de Finalização

```bash
# 1. Verificar mudanças
git status

# 2. Adicionar arquivos
git add background.js CHANGELOG.md

# 3. Commit
git commit -m "fix(background): implementar cooldown para evitar múltiplas abas de login"

# 4. Versionamento (se necessário)
npm run version:patch

# 5. Validação final
npm run validate
npm run build
```

### Checklist Final Obrigatório

**ANTES de finalizar qualquer tarefa, verifique:**

- [ ] Código implementado e testado
- [ ] `npm run validate` passa sem erros
- [ ] `npm run build` executa com sucesso
- [ ] CHANGELOG.md atualizado (use fallback se necessário)
- [ ] `git status` verificado
- [ ] `git add .` executado
- [ ] `git commit -m "tipo(escopo): descrição"` executado
- [ ] Versionamento feito se necessário (`npm run version:patch/minor/major`)

**⚠️ NUNCA deixe uma tarefa sem commit final!**

### Exemplo de Mensagens de Commit para Esta Tarefa

```bash
# Commit principal da correção
git commit -m "fix(background): implementar cooldown para evitar múltiplas abas de login sem credenciais"

# Commit da documentação
git commit -m "docs(agents): adicionar instruções específicas para CHANGELOG e commits"

# Commit do changelog
git commit -m "docs(changelog): documentar correção de múltiplas abas de login"
```