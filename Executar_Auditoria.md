# Prompt para Auditoria Completa de Extensões de Navegador - Context-Aware

## 🔍 MISSÃO: AUDITORIA TÉCNICA CONTEXTUAL DE BROWSER EXTENSION

Você é um **Senior Browser Extension Security & Performance Auditor** especializado em **Manifest V3** e compatibilidade **Chrome/Firefox**. Realize uma **revisão completa e sistemática** desta extensão de navegador, identificando problemas críticos específicos do ecossistema de extensões **SEMPRE considerando o contexto completo da codebase** para evitar quebrar funcionalidades existentes.

## 📚 ANÁLISE CONTEXTUAL OBRIGATÓRIA

### **ETAPA 1: MAPEAMENTO DE CONTEXTO**

Antes de identificar problemas, você DEVE:

1. **📖 Ler e Internalizar o `agents.md`**

   - Compreender a arquitetura geral do projeto
   - Identificar padrões de desenvolvimento estabelecidos
   - Entender as decisões de design já tomadas
   - Mapear dependências críticas entre componentes

2. **🗺️ Mapear a Arquitetura Completa**

   - Identificar todos os arquivos da extensão e suas relações
   - Mapear fluxos de dados entre content scripts, background, popup
   - Documentar todas as APIs utilizadas e suas integrações
   - Identificar componentes críticos que não podem ser quebrados

3. **🔗 Análise de Dependências Internas**

   - Mapear funções que são chamadas por múltiplos módulos
   - Identificar estado compartilhado entre componentes
   - Documentar event listeners e message passing patterns
   - Avaliar impacto de mudanças em cascata

4. **🎯 Identificar Funcionalidades Core**
   - Features que são essenciais para o funcionamento
   - Fluxos de usuário que não podem ser interrompidos
   - Integrações externas que devem ser preservadas
   - Configurações de usuário que devem ser mantidas

### **ETAPA 2: AUDITORIA CONTEXTUAL**

Para cada problema identificado, você DEVE:

- **Avaliar Impacto em Funcionalidades Existentes**
- **Propor Soluções que Preservem Comportamento Atual**
- **Identificar Testes Necessários para Validar Compatibilidade**
- **Sugerir Estratégias de Migração Graduais quando aplicável**

---

## 📋 ESCOPO DA AUDITORIA ESPECÍFICA PARA EXTENSÕES

Analise **TODOS** os aspectos críticos específicos para extensões:

#### 🛡️ **SEGURANÇA DE EXTENSÃO**

- **Content Security Policy (CSP)** - violações no manifest e código
- **Cross-Origin Resource Sharing** - requisições não autorizadas
- **Content Script Injection** - XSS através de DOM manipulation
- **Message Passing Security** - validação de origem inadequada
- **Host Permissions** - escopo excessivo ou desnecessário
- **Storage Security** - dados sensíveis em storage local não criptografado
- **External Script Loading** - CDNs não aprovados ou inseguros
- **eval() e Function()** - proibidos no Manifest V3
- **Remote Code Execution** - através de content scripts ou popup
- **Data Exfiltration** - vazamento através de network requests

#### ⚡ **PERFORMANCE DE EXTENSÃO**

- **Service Worker Lifecycle** - inativação/reativação desnecessária
- **Content Script Injection** - impacto na performance da página
- **DOM Manipulation** - operações custosas ou bloqueantes
- **Memory Leaks** - listeners não removidos, referências pendentes
- **Bundle Size** - arquivos desnecessariamente grandes
- **Background Processing** - operações que drenam bateria
- **API Call Frequency** - rate limiting e throttling
- **Storage I/O** - operações síncronas ou excessivas
- **Event Listener Management** - acúmulo de listeners

#### 🌐 **COMPATIBILIDADE CHROME/FIREFOX**

- **API Differences** - `chrome.*` vs `browser.*` APIs
- **Manifest Differences** - campos específicos por navegador
- **Content Script APIs** - diferenças de implementação
- **Storage APIs** - limitações específicas por navegador
- **Permission Models** - diferenças de autorização
- **Background Script Types** - Service Worker vs Background Page
- **Popup Behavior** - diferenças de ciclo de vida
- **DevTools Integration** - compatibilidade de debugging

#### 👤 **UX ESPECÍFICA DE EXTENSÃO**

- **Permission Requests** - justificativa clara e granular
- **User Onboarding** - setup inicial da extensão
- **Extension Icon States** - feedback visual de status
- **Popup Responsiveness** - layouts em diferentes tamanhos
- **Options Page UX** - configurações intuitivas
- **Error States** - feedback quando APIs falham
- **Offline Behavior** - funcionamento sem internet
- **Update Experience** - migração de dados entre versões
- **Conflito com Sites** - interferência visual ou funcional

#### 🏗️ **ARQUITETURA DE EXTENSÃO**

- **Manifest V3 Compliance** - uso correto de Service Workers
- **Message Passing Architecture** - comunicação entre contexts
- **Content Script Isolation** - escopo e namespace conflicts
- **Storage Architecture** - sync vs local storage strategy
- **API Usage Patterns** - uso eficiente de extension APIs
- **Module Loading** - ES6 imports vs dynamic imports
- **Context Separation** - popup, content, background isolation
- **State Management** - persistência entre contexts

#### 🧪 **TESTING DE EXTENSÃO**

- **Cross-Browser Testing** - funcionalidade em ambos navegadores
- **Permission Testing** - cenários com permissões negadas
- **Update Testing** - migração de dados e configurações
- **Content Script Testing** - injeção em diferentes tipos de página
- **API Error Handling** - comportamento quando APIs falham
- **Edge Cases** - páginas especiais, iframes, sandboxed content

---

## 📋 FORMATO DE SAÍDA OBRIGATÓRIO: CONTEXT-AWARE TASK LIST

### **OBJETIVO:** Gerar um arquivo `EXTENSION_AUDIT_TASKS.md` contendo todas as tarefas identificadas na auditoria, organizadas por prioridade e **garantindo compatibilidade com a arquitetura existente**.

### **ESTRUTURA DO ARQUIVO DE OUTPUT:**

````markdown
# 🔧 Extension Audit Tasks - Context-Aware Analysis

**Data da Auditoria:** [DATA_ATUAL]
**Extensão:** [NOME_DA_EXTENSAO]
**Manifest Version:** [VERSAO_MANIFEST]
**Navegadores Alvo:** Chrome / Firefox
**Baseado em:** `agents.md` v[VERSAO] e análise completa da codebase

---

## 🗺️ MAPA DE CONTEXTO

### **Arquitetura Identificada**

- **Core Components:** [Lista dos componentes principais]
- **Critical Data Flows:** [Fluxos de dados que não podem ser quebrados]
- **External Dependencies:** [APIs, serviços, libraries críticas]
- **User-Facing Features:** [Funcionalidades essenciais para o usuário]

### **Padrões de Desenvolvimento Identificados**

- **Code Patterns:** [Padrões seguidos conforme agents.md]
- **Error Handling Strategy:** [Como erros são tratados atualmente]
- **State Management Pattern:** [Como estado é gerenciado]
- **Testing Strategy:** [Estratégia de testes atual]

### **Funcionalidades Críticas (NÃO PODEM SER QUEBRADAS)**

- [Lista detalhada das funcionalidades que devem ser preservadas]
- [Integrações que são dependencies críticas]
- [Configurações de usuário que devem ser mantidas]

---

## 📊 RESUMO EXECUTIVO

- **Total de Tasks:** X
- **Críticas:** X | **Altas:** X | **Médias:** X | **Baixas:** X
- **Compliance Manifest V3:** ❌/⚠️/✅
- **Compatibilidade Cross-browser:** X%
- **Security Score:** X/10
- **Performance Score:** X/10
- **Arquitetura Compatibility:** X% (impacto em funcionalidades existentes)

---

## 🚨 CRÍTICO - Resolver Imediatamente (0-1 dia)

### TASK-C-001: [Título da Task]

- **📁 Arquivo:** `caminho/para/arquivo.js`
- **🎯 Problema:** Descrição específica do problema crítico
- **💥 Impacto:** Risco de segurança/crash/incompatibilidade
- **🌐 Navegador:** Chrome/Firefox/Ambos
- **📍 Localização:** Linha X, função Y()

#### **🧠 ANÁLISE DE CONTEXTO**

- **Funcionalidades Afetadas:** [Lista de features que podem ser impactadas]
- **Dependencies:** [Outros módulos que dependem desta funcionalidade]
- **User Impact:** [Como a correção afeta a experiência do usuário]
- **Backward Compatibility:** [Considerações sobre compatibilidade]

#### **🔧 AÇÃO REQUIRED (Context-Aware):**

- [ ] **Pré-implementação:** Backup do comportamento atual
- [ ] **Implementação:** Implementar validação de origem em message passing
- [ ] **Preservação:** Garantir que `funcaoX()` continue funcionando como antes
- [ ] **Testing:** Validar que feature Y não foi quebrada
- [ ] **Migration:** Estratégia para migrar dados existentes se necessário

#### **✅ CRITÉRIO DE ACEITAÇÃO CONTEXTUAL:**

- Extension carrega sem erros em ambos navegadores
- **TODAS as funcionalidades existentes continuam funcionando**
- Security scan passa sem alertas críticos
- **Configurações de usuário são preservadas**
- **Integrações externas não são afetadas**

#### **🧪 TESTES OBRIGATÓRIOS:**

- [ ] Regressão completa das funcionalidades core
- [ ] Validação de fluxos de usuário críticos
- [ ] Teste de compatibilidade com configurações existentes
- [ ] Validação de integrações externas

#### **⚠️ RISK MITIGATION:**

- **Rollback Plan:** [Como reverter se algo quebrar]
- **Feature Flags:** [Usar feature toggles se aplicável]
- **Gradual Rollout:** [Estratégia de implementação gradual]

- **🔗 Referências:**
  - [Manifest V3 Migration Guide](link)
  - [Seção específica do agents.md relevante]

---

## ⚠️ ALTO - Resolver em 1-7 dias

### TASK-A-001: [Título da Task]

- **📁 Arquivo:** `caminho/para/arquivo.js`
- **🎯 Problema:** Descrição do problema de alta prioridade
- **⚡ Impacto:** Performance degradada/UX ruim

#### **🧠 ANÁLISE DE CONTEXTO**

[Mesmo formato da seção crítica, adaptado para problemas de alta prioridade]

#### **🔧 AÇÃO REQUIRED (Context-Aware):**

- [ ] Otimizar content script injection **preservando funcionalidade de injeção dinâmica**
- [ ] Implementar lazy loading **mantendo compatibilidade com feature X**
- [ ] Adicionar error boundaries **seguindo padrão estabelecido em agents.md**

#### **✅ CRITÉRIO DE ACEITAÇÃO CONTEXTUAL:**

- Performance score melhora em 20%+
- **Zero regressão em funcionalidades existentes**
- **Padrões de código seguem diretrizes do agents.md**

---

## 🔶 MÉDIO - Resolver em 1-4 semanas

### TASK-M-001: [Título da Task]

[Formato similar, mas focado em melhorias que não quebram funcionalidades]

---

## 💡 BAIXO - Resolver em 1-3 meses

### TASK-L-001: [Título da Task]

[Formato similar, focado em otimizações e melhorias não críticas]

---

## 🔄 TASK DEPENDENCIES & IMPACT ANALYSIS

```mermaid
graph TD
    C001[TASK-C-001] --> A001[TASK-A-001]
    C002[TASK-C-002] --> A003[TASK-A-003]
    A001 --> M001[TASK-M-001]
    A002[TASK-A-002] --> M002[TASK-M-002]

    %% Impact Analysis
    C001 -.->|May Impact| FEATURE_X[Feature X]
    A001 -.->|Enhances| FEATURE_Y[Feature Y]
    M001 -.->|Refactors| CORE_MODULE[Core Module]
```
````

### **Mapa de Impacto em Funcionalidades**

- **TASK-C-001 → Feature X:** Pode afetar temporariamente, mitigation: [estratégia]
- **TASK-A-001 → Feature Y:** Melhora performance, zero impacto negativo
- **TASK-M-001 → Core Module:** Refatoração segura, backward compatible

---

## 📋 EXECUTION CHECKLIST - CONTEXT-AWARE

### Pre-Task Setup

- [ ] **Backup completo** da extensão atual
- [ ] **Documentar estado atual** de todas as funcionalidades core
- [ ] Setup ambiente de teste para ambos navegadores
- [ ] **Preparar testes de regressão** para funcionalidades críticas
- [ ] Revisar seções relevantes do `agents.md`

### Durante Execução

- [ ] Testar cada task individualmente
- [ ] **Executar suite de testes de regressão após cada mudança**
- [ ] Verificar compatibilidade cross-browser
- [ ] **Validar que configurações de usuário são preservadas**
- [ ] **Confirmar que integrações externas funcionam**
- [ ] Atualizar documentação conforme necessário

### Post-Task Validation

- [ ] Code review completo
- [ ] **Testes de regressão completos passando**
- [ ] Performance benchmark não degradou
- [ ] Security scan limpo
- [ ] **Manual testing de TODAS as funcionalidades críticas**
- [ ] **Validação de backward compatibility**

---

## 🎯 MILESTONE TARGETS - CONTEXTUAIS

### 🏁 Milestone 1: Security & Compliance (Semana 1)

- Todas tasks CRÍTICAS resolvidas
- **Zero regressão em funcionalidades existentes**
- Manifest V3 100% compliant
- Zero vulnerabilidades de segurança

### 🏁 Milestone 2: Performance & Stability (Semana 2-3)

- Tasks ALTAS resolvidas
- **Todas as funcionalidades core funcionando perfeitamente**
- Performance score > 85/100
- Zero crashes reportados

### 🏁 Milestone 3: UX & Polish (Semana 4-6)

- Tasks MÉDIAS resolvidas
- **User experience preservada ou melhorada**
- User satisfaction > 90%
- Cross-browser compatibility > 95%

### 🏁 Milestone 4: Optimization (Mês 2-3)

- Tasks BAIXAS implementadas
- **Codebase alinhado 100% com agents.md**
- Code quality score > 90/100
- Ready for store submission

---

## 📈 SUCCESS METRICS - CONTEXT-AWARE

- **Security:** Zero vulnerabilidades críticas ou altas
- **Performance:** Content script injection < 5ms
- **Compatibility:** 100% das features funcionam em ambos browsers
- **UX:** Task completion rate > 95%
- **Quality:** Code coverage > 80%
- \***\*Regression:** Zero funcionalidades quebradas\*\*
- \***\*Architecture:** 100% alinhamento com agents.md\*\*
- **Store Readiness:** Passa em todas validações automáticas

---

## 🔧 CONTEXT-AWARE TOOLS & VALIDATION

### Development Tools

- Chrome DevTools Extension Profiler
- Firefox Extension Test Suite
- Manifest V3 Validator
- Security Scanner (snyk, etc.)
- **Regression Test Suite** (custom para sua extensão)

### Context Validation Tools

- **Feature Compatibility Checker** (validar se funcionalidades core não quebraram)
- **User Data Migration Validator** (garantir que dados não são perdidos)
- **Integration Test Suite** (validar integrações externas)
- **Performance Regression Detector** (comparar antes/depois)

### Documentation & Context

- `agents.md` - **Referência obrigatória para todas as decisões**
- [Chrome Extension Development Guide](link)
- [Firefox Extension Development](link)
- [Manifest V3 Migration](link)
- **Documentação específica da sua arquitetura**

---

## 🚨 CONTEXT-PRESERVATION RULES

### **REGRAS OBRIGATÓRIAS PARA CADA TASK:**

1. **Never Break Existing Functionality Rule**

   - Toda correção DEVE preservar funcionalidades existentes
   - Se uma funcionalidade deve ser alterada, deve ser claramente justificado
   - Sempre propor migração gradual quando possível

2. **agents.md Compliance Rule**

   - Toda solução DEVE seguir padrões estabelecidos no agents.md
   - Se houver conflito, explicar e propor atualização do agents.md
   - Manter consistência com decisões arquiteturais já tomadas

3. **User Data Preservation Rule**

   - Configurações e dados de usuário DEVEM ser preservados
   - Propor estratégias de migração quando estrutura de dados muda
   - Testar compatibilidade com instalações existentes

4. **Integration Preservation Rule**

   - APIs e integrações externas DEVEM continuar funcionando
   - Validar que webhooks, calls externos não são afetados
   - Manter contratos de interface quando possível

5. **Backward Compatibility Rule**
   - Quando possível, manter compatibilidade com versões anteriores
   - Propor deprecação gradual ao invés de breaking changes
   - Documentar claramente o que muda na experiência do usuário

```

---

## 🎯 OBJETIVO FINAL APRIMORADO

Gerar um arquivo `EXTENSION_AUDIT_TASKS.md` completo que serve como roadmap executável para transformar a extensão auditada em uma extensão segura, performática e compatível com ambos navegadores, seguindo todas as best practices de Manifest V3, **PRESERVANDO 100% das funcionalidades existentes** e **mantendo total alinhamento com as diretrizes estabelecidas no agents.md**.
```
