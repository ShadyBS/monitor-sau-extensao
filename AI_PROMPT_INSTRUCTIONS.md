# Instruções para Agentes de IA - Monitor SAU Extension

## INSTRUÇÕES OBRIGATÓRIAS PARA TODOS OS PROMPTS

**ANTES DE QUALQUER AÇÃO, LEIA E SIGA RIGOROSAMENTE O ARQUIVO `agents.md`**

Este documento contém instruções específicas que devem ser adicionadas a todos os prompts de IA que trabalham neste projeto. Seguir estas diretrizes é **OBRIGATÓRIO** para garantir consistência, qualidade e integração adequada com o fluxo de trabalho da equipe.

---

## 1. LEITURA OBRIGATÓRIA DO GUIA

**PRIMEIRA AÇÃO:** Sempre leia o arquivo `agents.md` na raiz do projeto antes de iniciar qualquer tarefa. Este arquivo contém:

- Estrutura completa do projeto
- Fluxos de trabalho específicos para extensões de navegador
- Práticas de segurança obrigatórias
- Padrões de código e convenções
- Scripts de automação disponíveis
- Checklist de qualidade

**Comando para ler o guia:**

```
Leia o arquivo c:\monitor-sau-extensao\agents.md
```

---

## 2. ESTRUTURA E CONTEXTO DO PROJETO

Este é um projeto de **extensão para navegador** (Chrome e Firefox) com as seguintes características:

### Tecnologias Principais

- **Manifest V3** (Chrome e Firefox)
- **JavaScript ES6+** com módulos
- **APIs de Extensão** compatíveis entre navegadores
- **Sistema de logging** centralizado (`logger.js`)
- **Sistema de sanitização** de segurança (`sanitizer.js`)

### Arquivos Críticos

- `manifest.json` e `manifest-firefox.json` (devem estar sincronizados)
- `background.js` (Service Worker principal)
- `content.js` (Script injetado nas páginas)
- `logger.js` (Sistema de logging - USE SEMPRE)
- `sanitizer.js` (Segurança - USE SEMPRE)

---

## 3. PRÁTICAS DE CÓDIGO OBRIGATÓRIAS

### APIs de Extensão

```javascript
// ✅ SEMPRE use compatibilidade Chrome/Firefox
const browserAPI = globalThis.browser || globalThis.chrome;
await browserAPI.storage.local.set({ key: value });

// ❌ NUNCA use apenas Chrome
chrome.storage.local.set({ key: value });
```

### Sistema de Logging

```javascript
// ✅ SEMPRE use o sistema de logging
import { logger } from "./logger.js";
const myLogger = logger("[ModuleName]");
myLogger.info("Mensagem informativa");
myLogger.warn("Aviso importante");
myLogger.error("Erro crítico");

// ❌ NUNCA use console.log diretamente
console.log("Debug info"); // PROIBIDO
```

### Segurança e Sanitização

```javascript
// ✅ SEMPRE use sanitizer.js para DOM
import { createSafeElement, sanitizeTaskData } from "./sanitizer.js";
const safeElement = createSafeElement("div", "Texto seguro", {
  class: "task-item",
});
const task = sanitizeTaskData(rawTaskData);

// ❌ NUNCA use innerHTML com dados não sanitizados
element.innerHTML = userInput; // VULNERÁVEL A XSS
```

---

## 4. FLUXO DE TRABALHO OBRIGATÓRIO

### Para CADA modificação, siga esta sequência:

1. **Validar ambiente:**

   ```bash
   npm run validate
   ```

2. **Analisar compatibilidade** Chrome/Firefox

3. **Codificar** seguindo padrões do `agents.md`

4. **Testar com scripts:**

   ```bash
   npm run build          # Build completo
   npm run build:chrome   # Apenas Chrome
   npm run build:firefox  # Apenas Firefox
   ```

5. **Atualizar CHANGELOG.md** na seção `[Unreleased]`

6. **Versionar** (se necessário):

   ```bash
   npm run version:patch  # Bugfixes
   npm run version:minor  # Novas funcionalidades
   npm run version:major  # Breaking changes
   ```

7. **Commit seguindo Conventional Commits:**
   ```bash
   git add .
   git commit -m "feat(popup): adicionar dropdown de snooze configurável"
   ```

---

## 5. CONVENTIONAL COMMITS OBRIGATÓRIO

**SEMPRE** use o padrão Conventional Commits para mensagens de commit:

### Formato

```
<tipo>(<escopo>): <descrição>

[corpo opcional]

[rodapé opcional]
```

### Tipos Principais

- `feat`: Nova funcionalidade
- `fix`: Correção de bug
- `docs`: Mudanças na documentação
- `style`: Formatação, espaços em branco, etc.
- `refactor`: Refatoração de código
- `test`: Adição ou correção de testes
- `chore`: Tarefas de manutenção

### Escopos Comuns

- `popup`: Interface do popup
- `background`: Service Worker
- `content`: Content script
- `options`: Página de configurações
- `build`: Scripts de build
- `security`: Correções de segurança

### Exemplos

```bash
git commit -m "feat(popup): adicionar sistema de snooze configurável"
git commit -m "fix(background): corrigir vazamento de memória no monitoramento"
git commit -m "docs(readme): atualizar instruções de instalação"
git commit -m "chore(release): v1.2.0"
```

---

## 6. ATUALIZAÇÃO AUTOMÁTICA DO CHANGELOG

### Após cada mudança significativa:

1. **Abra o arquivo `CHANGELOG.md`**
2. **Adicione entrada na seção `[Unreleased]`**
3. **Use as categorias apropriadas:**
   - `### Added` - Novas funcionalidades
   - `### Changed` - Mudanças em funcionalidades existentes
   - `### Fixed` - Correções de bugs
   - `### Removed` - Funcionalidades removidas
   - `### Security` - Correções de segurança

### Exemplo de entrada:

```markdown
## [Unreleased]

### Added

- Sistema de snooze configurável no popup
- Validação de URLs antes de abrir tarefas
- Opções de tempo personalizado para "Lembrar Mais Tarde"

### Fixed

- Correção de vazamento de memória no background script
- Sincronização entre manifests Chrome e Firefox

### Security

- Implementação de sanitização de dados de entrada
- Validação de origem em mensagens entre contextos
```

---

## 7. CHECKLIST PRÉ-COMMIT OBRIGATÓRIO

**ANTES de cada commit, verifique:**

- [ ] `npm run validate` passa sem erros
- [ ] Testado em Chrome E Firefox (se aplicável)
- [ ] Manifests sincronizados (`manifest.json` e `manifest-firefox.json`)
- [ ] CHANGELOG.md atualizado na seção `[Unreleased]`
- [ ] Logging usando `logger.js` (sem `console.log`)
- [ ] APIs compatíveis usando `browserAPI`
- [ ] Manipulação segura do DOM usando `sanitizer.js`
- [ ] Commit message segue Conventional Commits
- [ ] Build gera ZIPs válidos
- [ ] Documentação atualizada se necessário

---

## 8. SCRIPTS DE AUTOMAÇÃO

**SEMPRE use os scripts fornecidos:**

### Build e Qualidade

```bash
npm run build          # Build completo (Chrome + Firefox)
npm run build:chrome   # Build apenas Chrome
npm run build:firefox  # Build apenas Firefox
npm run validate       # Validações de qualidade e segurança
npm run clean          # Limpeza de arquivos temporários
```

### Versionamento

```bash
npm run version:patch  # 1.0.0 → 1.0.1 (bugfixes)
npm run version:minor  # 1.0.0 → 1.1.0 (novas funcionalidades)
npm run version:major  # 1.0.0 → 2.0.0 (breaking changes)
node scripts/version.js info  # Mostrar versões atuais
```

### Release

```bash
npm run release        # Release completo no GitHub
npm run release -- -y  # Release sem confirmação
```

---

## 9. GERAÇÃO AUTOMÁTICA DE COMMITS

### O projeto inclui automação para commits de release:

1. **Scripts de versionamento** criam commits automaticamente:

   ```bash
   npm run version:patch  # Cria commit: "chore(release): v1.0.1"
   ```

2. **Script de release** cria tags e commits:

   ```bash
   npm run release  # Cria tag e commit de release
   ```

3. **Para commits manuais**, sempre siga Conventional Commits

---

## 10. SEGURANÇA - PRÁTICAS OBRIGATÓRIAS

### Validação de Entrada

```javascript
// ✅ SEMPRE valide e sanitize dados
import { sanitizeTaskData } from "./sanitizer.js";
const task = sanitizeTaskData(rawTaskData);

// ✅ Valide URLs
try {
  new URL(taskLink);
} catch (error) {
  logger.warn(`URL inválida: ${taskLink}`);
  taskLink = "#"; // Fallback seguro
}
```

### Comunicação Entre Contextos

```javascript
// ✅ SEMPRE valide origem de mensagens
window.addEventListener("message", (event) => {
  if (event.origin !== window.location.origin) {
    console.warn("Mensagem de origem não confiável rejeitada");
    return;
  }
  // Processar mensagem...
});
```

### Manipulação do DOM

```javascript
// ✅ Use createSafeElement
import { createSafeElement } from "./sanitizer.js";
const element = createSafeElement("div", "Texto seguro", {
  class: "safe-class",
});

// ❌ NUNCA use innerHTML com dados não sanitizados
element.innerHTML = userInput; // PROIBIDO
```

---

## 11. COMPATIBILIDADE CHROME/FIREFOX

### APIs de Extensão

```javascript
// ✅ SEMPRE use wrapper compatível
const browserAPI = globalThis.browser || globalThis.chrome;

// ✅ Para storage
await browserAPI.storage.local.set({ key: value });
const data = await browserAPI.storage.local.get(["key"]);

// ✅ Para tabs
const tabs = await browserAPI.tabs.query({ active: true, currentWindow: true });

// ✅ Para notifications
await browserAPI.notifications.create(id, options);
```

### Manifests

- **SEMPRE** mantenha `manifest.json` e `manifest-firefox.json` sincronizados
- **USE** os scripts de build que fazem isso automaticamente
- **TESTE** em ambos os navegadores

---

## 12. DEBUGGING E TROUBLESHOOTING

### Ferramentas Disponíveis

```bash
# Validação completa
npm run validate

# Build com debug
DEBUG=1 npm run build

# Informações de versão
node scripts/version.js info
```

### Logs da Extensão

- **Chrome:** `chrome://extensions/` → Developer mode → Inspect views
- **Firefox:** `about:debugging` → This Firefox → Inspect
- **Sistema:** Use `logger.js` com níveis apropriados

---

## 13. RESUMO EXECUTIVO

### Para CADA tarefa de IA:

1. **LER** `agents.md` primeiro
2. **VALIDAR** ambiente com `npm run validate`
3. **CODIFICAR** seguindo padrões de segurança e compatibilidade
4. **TESTAR** com `npm run build`
5. **ATUALIZAR** CHANGELOG.md
6. **COMMITAR** com Conventional Commits
7. **VERSIONAR** se necessário
8. **VERIFICAR** checklist pré-commit

### Comandos Essenciais

```bash
# Antes de começar
npm run validate

# Durante desenvolvimento
npm run build

# Antes de commit
git add .
git commit -m "feat(scope): descrição da mudança"

# Para release
npm run version:patch
npm run release
```

---

## ⚠️ AVISOS CRÍTICOS

1. **NUNCA** modifique arquivos em `.dist/` - são gerados automaticamente
2. **SEMPRE** use `logger.js` em vez de `console.log`
3. **SEMPRE** use `sanitizer.js` para manipulação do DOM
4. **SEMPRE** mantenha compatibilidade Chrome/Firefox
5. **SEMPRE** atualize CHANGELOG.md
6. **SEMPRE** siga Conventional Commits
7. **SEMPRE** execute `npm run validate` antes de commit

---

**Este documento deve ser consultado em TODOS os prompts de IA que trabalham neste projeto. A não observância destas diretrizes pode resultar em código incompatível, inseguro ou que quebra o fluxo de trabalho da equipe.**

**Última atualização:** 2025-01-23 - Baseado no agents.md v2025-01-23
