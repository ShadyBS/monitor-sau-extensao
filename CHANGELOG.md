Changelog do Monitor de Tarefas SAU
Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

## [Unreleased]

### Security

- **Vulnerabilidade XSS Crítica**: Corrigida vulnerabilidade crítica de XSS na função `injectNotificationUI()` do content.js que permitia execução de código malicioso através de dados de tarefas não sanitizados
- **DOM Manipulation Segura**: Substituído uso inseguro de `innerHTML` por manipulação DOM segura usando `textContent`, `createElement` e `appendChild`
- **Sanitização de Dados**: Implementado sistema robusto de sanitização de dados de tarefas com validação de tipos, limitação de tamanho e validação de URLs
- **Prevenção de Injeção**: Adicionadas funções `sanitizeTaskData()`, `createSafeElement()` e `createSafeTaskItem()` para construção segura de elementos DOM
- **Validação de Mensagens Cross-Frame**: Implementada validação robusta contra injeção de dados maliciosos via mensagens cross-frame com 10 camadas de segurança incluindo validação de timestamp, padrões suspeitos e prevenção de replay attacks

### Fixed

- **Memory Leak - MutationObserver (SAU + SIGSS)**: Corrigido vazamento de memória crítico onde MutationObserver não era desconectado quando páginas eram fechadas, causando acúmulo de recursos em sessões longas com múltiplas abas
- **Cleanup Automático Dual**: Implementado sistema automático de limpeza de recursos em ambos content scripts (`content.js` para SAU e `content-sigss.js` para SIGSS) com listeners para `beforeunload` e `visibilitychange`
- **Gestão de Recursos Cross-Page**: Adicionadas variáveis globais (`globalMutationObserver` para SAU e `sigssTabRenamerObserver` para SIGSS) para rastreamento e cleanup adequado das instâncias dos observers
- **Prevenção de Vazamentos Multi-Tab**: Implementadas funções `cleanupMutationObserver()` e `cleanupSigssTabRenamer()` que desconectam observers e limpam recursos pendentes em ambos os tipos de páginas
- **Reconfiguração Inteligente Universal**: Sistema agora reconfigura automaticamente os MutationObservers quando páginas voltam a ficar visíveis, mantendo funcionalidade de renomeação de abas SIGSS em múltiplas abas
- **Performance - Processamento de Tarefas**: Otimizado processamento de tarefas em `handleNewTasks()` para evitar bloqueio do Service Worker através de processamento em lotes paralelos e yield control
- **Rate Limiting de Notificações**: Aumentado cooldown de notificações de 5 para 15 segundos para prevenir spam de notificações e melhorar experiência do usuário
- **Message Passing Security**: Corrigida validação insuficiente de origem em message passing que permitia contorno de verificações de segurança
- **Timeout de Operações de Rede**: Aumentado timeout de injeção de scripts de 10 para 30 segundos para melhor compatibilidade com conexões lentas e evitar falhas desnecessárias em redes instáveis
- **SIGSS URL Detection Consistency**: Corrigida inconsistência na detecção de URLs SIGSS substituindo regex genérico `/sigss/i.test(url)` por lista explícita de domínios válidos (`c1863prd.cloudmv.com.br`, `c1863tst1.cloudmv.com.br`) para garantir detecção precisa e evitar falsos positivos. Implementada função `isValidSigssUrl()` consistente em `background.js`, `content-sigss.js` e `sigss-tab-renamer.js` com validação de hostname e pathname
- **Storage Size Validation**: Implementado sistema robusto de validação de tamanho de storage para evitar exceder limites do Chrome (sync: 100KB, local: 5MB) com limpeza automática de dados antigos e fallbacks seguros
- **Retry Logic para Login Automático**: Implementado sistema robusto de retry com backoff exponencial para operações críticas do login automático, incluindo obtenção de credenciais, criação de abas, injeção de scripts e notificações. Sistema realiza até 3 tentativas com delays crescentes (1s, 2s, 4s) para melhorar confiabilidade em conexões instáveis e falhas temporárias de rede

## [2.1.0] - 2025-07-28

### Changed

- **Design da Página de Opções**: Melhorado o design geral da página de opções para um visual mais moderno e elegante, com melhor espaçamento, sombras e hierarquia visual
- **Tooltips**: Aumentado o tamanho da fonte dos tooltips para melhorar a legibilidade
- **Botões de Ajuda**: Consolidado os botões de ajuda na página de opções, substituindo múltiplos botões por um único botão por seção para uma interface mais limpa

### Fixed

- **Alinhamento de Checkbox**: Corrigido o problema de quebra de linha entre o checkbox e o texto na opção "Permitir tempo personalizado"

## [2.0.0] - 2025-07-28

### Added

- **Automatic Config Migration**: Sistema automático de migração de configurações do storage local para sync quando disponível
- **SIGSS URL Support**: Adicionado suporte completo para URLs do SIGSS no webNavigation listener
- **Enhanced Error Handling**: Melhorado tratamento de erros na injeção de scripts com logs mais detalhados

### Changed

- **Content Script Injection**: Melhorada lógica de injeção de content scripts baseada na URL da página
- **Configuration Loading**: Sistema de configuração agora prioriza storage.sync com fallback para local storage

### Fixed

- **Background Script Error**: Corrigido erro crítico `ReferenceError: tabId is not defined` na linha 1043 do background.js que impedia a injeção correta de content scripts
- **SIGSS Tab Renaming**: Corrigido problema onde títulos das abas do SIGSS não estavam sendo renomeados devido a falta de injeção do content script apropriado
- **WebNavigation Listener**: Adicionado suporte para páginas do SIGSS no listener de navegação, permitindo injeção automática do content-sigss.js
- **Sync Configuration Migration**: Implementada migração automática de configurações para chrome.storage.sync na inicialização da extensão
- **Cross-Device Sync**: Corrigido problema onde configurações salvas no sync não eram carregadas após reinstalação da extensão

### Technical Details

- Corrigido uso incorreto de `tabId` em vez de `details.tabId` no webNavigation listener
- Adicionadas URLs do SIGSS (c1863prd.cloudmv.com.br e c1863tst1.cloudmv.com.br) ao filtro de navegação
- Implementada chamada automática de `migrateToSync()` na inicialização do background script
- Melhorada detecção de páginas SIGSS com regex case-insensitive

## [1.1.5] - 2025-01-28

### Added

- **Sistema de Sincronização de Configurações**: Implementado salvamento das configurações no chrome.storage.sync com fallback para chrome.storage.local
- **Gerenciador de Configurações**: Novo módulo `config-manager.js` para gerenciar configurações de forma unificada
- **Compatibilidade Cross-Browser**: Sistema funciona tanto no Chrome quanto no Firefox com detecção automática de disponibilidade do sync
- **Migração Automática**: Configurações existentes são automaticamente migradas do local para sync quando disponível
- **Backup Automático**: Configurações sync são automaticamente copiadas para local storage como backup
- **Categorização Inteligente**: Configurações são categorizadas entre sincronizáveis e apenas locais (dados de sessão)

### Changed

- **Arquitetura Modular**: Refatorado content scripts para separação de responsabilidades - `content.js` para SAU e `content-sigss.js` para SIGSS
- **Injeção Inteligente**: Background script agora injeta o content script apropriado baseado na URL da página
- **Manutenibilidade**: Cada funcionalidade agora tem seu próprio arquivo, facilitando manutenção e testes
- **Salvamento de Configurações**: Todas as configurações de usuário agora são salvas com sincronização automática
- **Carregamento de Configurações**: Sistema prioriza configurações do sync, com fallback para local storage
- **Página de Opções**: Atualizada para usar o novo gerenciador de configurações
- **Background Script**: Refatorado para usar o sistema unificado de configurações

### Fixed

- **Build Script Missing File**: Corrigido problema crítico onde popup funcionava no modo desenvolvimento mas falhava no ZIP empacotado devido ao arquivo config-manager.js não estar incluído na lista sourceFiles do script de build
- **Syntax Error (Popup)**: Corrigido erro de sintaxe "Unexpected token ')'" no popup.js linha 251, causado por parêntese extra no final da função displayTasks
- **Comunicação Popup-Background**: Corrigido erro "Could not establish connection. Receiving end does not exist" adicionando return true nos message listeners que usam sendResponse
- **appendChild Error (Popup)**: Corrigido erro crítico "Failed to execute 'appendChild' on 'Node': parameter 1 is not of type 'Node'" no popup.js linha 150, causado por uso incorreto de async/await em forEach loops
- **appendChild Error (Sanitizer)**: Corrigido erro crítico "Failed to execute 'appendChild' on 'Node': parameter 1 is not of type 'Node'" em Edge/Chrome causado por uso incorreto de async/await em forEach loops no sanitizer.js
- **background.js**: Implementado cooldown para evitar múltiplas abas de login sem credenciais
- **Config Manager Loading Error**: Corrigido erro "Failed to load resource: net::ERR_FILE_NOT_FOUND" para config-manager.js no popup, atualizando popup.js para usar o novo sistema de gerenciamento de configurações
- **Popup Initialization Failure**: Corrigido falha na inicialização do popup devido a erros no config-manager, implementado sistema de fallback robusto que usa storage direto quando config-manager falha
- **Erro de Registro do Service Worker**: Corrigido erro "Service worker registration failed. Status code: 3" ao simplificar a inicialização da `browserAPI` em `background.js`, removendo uma função que lançava um erro fatal durante a inicialização
- **Erro de Script Injetado**: Prevenido um erro de `ReferenceError` no script de login automático ao substituir chamadas ao `backgroundLogger` (que não existe no contexto da página) por `console.log` e `console.error`
- **Logger Assíncrono**: Refatorado `logger.js` para inicialização lazy e assíncrona, evitando operações assíncronas no nível superior que violam regras do Service Worker
- **Compatibilidade com Service Worker**: Atualizados todos os arquivos para usar `await` com chamadas do logger (`background.js`, `popup.js`, `options.js`, `sanitizer.js`, `tooltip-system.js`, `help.js`)
- **Config Manager**: Adicionada configuração `enableSigssTabRename` ao DEFAULT_CONFIG para garantir valor padrão correto
- **Manifest Permissions**: Adicionadas permissões para URLs do SIGSS (c1863prd.cloudmv.com.br e c1863tst1.cloudmv.com.br) nos manifests Chrome e Firefox

### Technical Details

- Criado módulo `config-manager.js` com funções `setConfig`, `getConfig`, `setConfigs`, `getConfigs`
- Implementada detecção automática de disponibilidade do `chrome.storage.sync`
- Configurações sensíveis (credenciais) são sincronizadas entre dispositivos
- Dados de sessão (`lastKnownTasks`, `snoozeTime`) permanecem apenas locais
- Sistema de fallback robusto para quando sync não está disponível
- Migração automática de configurações existentes na primeira execução

## [1.1.4] - 2025-07-28

### Added

- **Novo Script de Changelog**: Adicionado script para automatizar a atualização do changelog
- **Sistema de Ping**: Implementado sistema de ping/pong para verificar responsividade de abas
- **Timeouts Configuráveis**: Constantes para timeouts de diferentes operações (injeção, reload, ping)
- **Logs Detalhados**: Adicionados logs específicos para situações de timeout e abas não responsivas
- **Recuperação Automática**: Sistema automático de recuperação quando abas ficam travadas

### Changed

- **Arquitetura Modular**: Refatorado content scripts para separação de responsabilidades - `content.js` para SAU e `content-sigss.js` para SIGSS
- **Injeção Inteligente**: Background script agora injeta o content script apropriado baseado na URL da página
- **Manutenibilidade**: Cada funcionalidade agora tem seu próprio arquivo, facilitando manutenção e testes

### Fixed

- **Timeout para Abas Travadas**: Implementado sistema de timeout para detectar e lidar com abas do SAU que ficam não responsivas
- **Verificação de Responsividade**: Adicionada verificação de ping para detectar se abas estão travadas antes de tentar operações
- **Timeout de Injeção de Scripts**: Implementado timeout de 10 segundos para operações de injeção de scripts
- **Timeout de Reload**: Adicionado timeout de 5 segundos para operações de reload de abas
- **Fallback Robusto**: Melhorado sistema de fallback quando abas ficam inacessíveis ou travadas
- **Detecção de Abas Fechadas**: Melhorada detecção de abas que foram fechadas durante operações

### Technical Details

- Adicionada função `isTabResponsive()` para verificar se aba responde a mensagens
- Implementada função `injectScriptsWithTimeout()` com timeout de 10 segundos
- Criada constante `SCRIPT_INJECTION_TIMEOUT` para controlar timeout de injeção
- Adicionado tratamento de mensagem "ping" no content script
- Melhorada lógica de fallback em `checkAndNotifyNewTasks()` para lidar com abas travadas
- Implementados timeouts usando `Promise.race()` para operações críticas

## [1.1.3] - 2025-07-25

### Changed

- **Arquitetura Modular**: Refatorado content scripts para separação de responsabilidades - `content.js` para SAU e `content-sigss.js` para SIGSS
- **Injeção Inteligente**: Background script agora injeta o content script apropriado baseado na URL da página
- **Manutenibilidade**: Cada funcionalidade agora tem seu próprio arquivo, facilitando manutenção e testes

### Fixed

- **Erro de Módulo em Content Script**: Corrigido o erro `Uncaught SyntaxError: Cannot use import statement outside a module` em `content.js`. A tentativa de usar `import` para o logger foi revertida devido a limitações na injeção de scripts como módulos. O `content.js` voltará a usar `console.*` para logs, com uma nota técnica explicando a limitação

## [1.1.2] - 2025-07-25

### Added

- **Controle Inteligente de Abas**: Sistema para gerenciar abas de login sem credenciais
- **Rastreamento de Estado**: Variáveis para controlar timestamp e ID da última aba de login aberta
- **Listener de Abas Fechadas**: Detecta quando abas de login são fechadas para limpar estado interno

### Changed

- **Arquitetura Modular**: Refatorado content scripts para separação de responsabilidades - `content.js` para SAU e `content-sigss.js` para SIGSS
- **Injeção Inteligente**: Background script agora injeta o content script apropriado baseado na URL da página
- **Manutenibilidade**: Cada funcionalidade agora tem seu próprio arquivo, facilitando manutenção e testes

### Fixed

- **Padronização de Logs**: Refatorados `background.js` e `content.js` para usar o sistema de logging centralizado (`logger.js`) em vez de `console.log`, `console.warn` e `console.error`, alinhando com as boas práticas do projeto
- **Múltiplas Abas de Login**: Corrigido problema crítico onde extensão abria nova aba do SAU a cada verificação quando usuário não tinha credenciais salvas
- **Cooldown de Login**: Implementado sistema de cooldown de 5 minutos para evitar spam de abas de login
- **Verificação de Abas Existentes**: Extensão agora verifica se já existe aba de login aberta antes de criar nova
- **Login em Segundo Plano**: Abas de login agora são abertas em segundo plano para não interromper o usuário

### Technical Details

- Adicionadas variáveis `lastLoginTabOpenedTimestamp` e `loginTabId` para controle de estado
- Implementada função `checkForExistingLoginTab()` para verificar abas de login existentes
- Criado sistema de cooldown de 5 minutos (`LOGIN_TAB_COOLDOWN`) para evitar spam
- Adicionado listener `tabs.onRemoved` para limpar estado quando abas são fechadas
- Melhorada lógica em `performAutomaticLogin()` para verificar condições antes de abrir nova aba

## [1.1.1] - 2025-01-24

### Changed

- **Arquitetura Modular**: Refatorado content scripts para separação de responsabilidades - `content.js` para SAU e `content-sigss.js` para SIGSS
- **Injeção Inteligente**: Background script agora injeta o content script apropriado baseado na URL da página
- **Manutenibilidade**: Cada funcionalidade agora tem seu próprio arquivo, facilitando manutenção e testes

### Fixed

- **Correção Crítica do Popup**: Botão de configurações não funcionava devido a erro de conexão
- **Comunicação Robusta**: Implementado tratamento de erro robusto para comunicação entre popup e background script
- **Erro de Conexão**: Corrigido problema "Could not establish connection. Receiving end does not exist"
- **Carregamento de Dados**: Melhorada função `loadPopupData()` para usar Promise em vez de callback
- **Fallback de Opções**: Adicionado fallback para abertura da página de opções em nova aba caso `openOptionsPage()` falhe
- **Event Listeners**: Corrigido problema crítico onde event listeners dos botões principais não eram configurados corretamente
- **Inicialização do DOM**: Reorganizada inicialização do popup para garantir que DOM esteja carregado antes de configurar event listeners
- **Tarefas no Popup**: Corrigido problema onde tarefas não apareciam no popup apesar da badge mostrar contador
- **Build da Extensão**: Corrigido script de build que não incluía arquivos críticos no ZIP (sanitizer.js, tooltip-system.js, help.\*)
- **Arquivos Essenciais**: Adicionados arquivos essenciais à lista de sourceFiles no script de build
- **Instalação via ZIP**: Resolvido problema onde extensão funcionava "sem pacote" mas falhava quando instalada via ZIP

### Technical Details

- Movidos todos os event listeners para dentro da função `initializePopup()` para execução após DOM ready
- Criada função `setupMainEventListeners()` para configurar botões principais de forma organizada
- Implementado tratamento de erro em todas as mensagens `runtime.sendMessage()` para evitar erros quando popup não está aberto
- Adicionados `sanitizer.js`, `tooltip-system.js` e arquivos de ajuda (`help.*`) ao script de build
- Resolvido erro de módulos não encontrados quando extensão é instalada via ZIP empacotado

## [1.1.0] - 2025-07-24

### Added

- **Primeiro Release Oficial**: Lançamento da versão 1.1.0 com sistema completo de ajuda para novos usuários
- **Sistema de Ajuda Abrangente**: Interface completa de onboarding e suporte
- **Compatibilidade Total**: Suporte completo para Chrome e Firefox
- **Pipeline de CI/CD**: Automação completa de build, teste e release
- **Documentação Completa**: Guias detalhados para usuários e desenvolvedores
- **Sistema de Ajuda Contextual**: Adicionados pequenos botões de ajuda rápida (?) em todas as configurações da página de opções
- **Tooltips Informativos**: Cada configuração agora possui tooltip explicativo detalhado com título, descrição e dicas práticas
- **Documentação SIGSS**: Adicionada explicação completa sobre a funcionalidade de renomeação de abas do SIGSS na seção de ajuda
- **Guia de Configurações**: Expandida seção de configurações no help.html com detalhes sobre renomeação de abas SIGSS

### Changed

- **Experiência do Usuário**: Completamente redesenhada para novos usuários
- **Arquitetura Modular**: Sistema extensível e bem documentado
- **Interface de Configurações**: Melhorada usabilidade da página de opções com botões de ajuda contextual
- **Sistema de Tooltips**: Integrado tooltip-system.js na página de configurações para fornecer ajuda instantânea
- **Experiência do Usuário**: Facilitado entendimento de cada configuração através de explicações práticas e diretas

### Fixed

- **Otimização de Performance**: Implementadas correções críticas para melhorar responsividade e experiência do usuário
- **Bloqueio da UI Principal**: Corrigido processamento síncrono de tarefas que causava travamentos temporários
- **Rate Limiting de Notificações**: Implementado cooldown de 5 segundos entre notificações para evitar spam
- **Throttling do MutationObserver**: Adicionado throttling de 500ms para reduzir verificações excessivas de DOM
- **Compatibilidade Robusta**: Melhorado wrapper de API do navegador com fallbacks para Chrome/Firefox
- **Memory Leaks**: Corrigidos vazamentos de memória em event listeners e MutationObserver
- **Tratamento de Erros**: Implementado tratamento robusto de erros de parsing com fallbacks seguros
- **Feedback Visual**: Adicionado indicadores de loading e estados de erro para operações assíncronas
- **Sanitização de Dados**: Melhorada validação e sanitização de dados de tarefas para prevenir XSS
- **Logging Padronizado**: Substituído console.log por sistema de logging centralizado no content script

### Technical Details

- Adicionados 20+ botões de ajuda contextual em options.html
- Criado sistema de definições de ajuda em options.js com explicações detalhadas
- Implementados estilos responsivos para botões de ajuda em options.css
- Integrado sistema de tooltips existente para fornecer ajuda contextual
- Expandida documentação sobre funcionalidade SIGSS no help.html
