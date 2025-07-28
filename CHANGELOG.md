Changelog do Monitor de Tarefas SAU
Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

## [Unreleased]

### Fixed
- **Sincronização de Versões**: Corrigida discrepância entre versões do package.json e manifests para release v1.1.5

## [1.1.5] - 2025-01-28

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

### Added
- **Sistema de Sincronização de Configurações**: Implementado salvamento das configurações no chrome.storage.sync com fallback para chrome.storage.local
- **Gerenciador de Configurações**: Novo módulo `config-manager.js` para gerenciar configurações de forma unificada
- **Compatibilidade Cross-Browser**: Sistema funciona tanto no Chrome quanto no Firefox com detecção automática de disponibilidade do sync
- **Migração Automática**: Configurações existentes são automaticamente migradas do local para sync quando disponível
- **Backup Automático**: Configurações sync são automaticamente copiadas para local storage como backup
- **Categorização Inteligente**: Configurações são categorizadas entre sincronizáveis e apenas locais (dados de sessão)

### Changed
- **Salvamento de Configurações**: Todas as configurações de usuário agora são salvas com sincronização automática
- **Carregamento de Configurações**: Sistema prioriza configurações do sync, com fallback para local storage
- **Página de Opções**: Atualizada para usar o novo gerenciador de configurações
- **Background Script**: Refatorado para usar o sistema unificado de configurações

### Technical Details
- Criado módulo `config-manager.js` com funções `setConfig`, `getConfig`, `setConfigs`, `getConfigs`
- Implementada detecção automática de disponibilidade do `chrome.storage.sync`
- Configurações sensíveis (credenciais) são sincronizadas entre dispositivos
- Dados de sessão (`lastKnownTasks`, `snoozeTime`) permanecem apenas locais
- Sistema de fallback robusto para quando sync não está disponível
- Migração automática de configurações existentes na primeira execução

## [1.1.4] - 2025-07-28

### Added

- **Novo Script de Changelog**: Adicionado script para automatizar a atualização do changelog.

### Fixed

- **Timeout para Abas Travadas**: Implementado sistema de timeout para detectar e lidar com abas do SAU que ficam não responsivas
- **Verificação de Responsividade**: Adicionada verificação de ping para detectar se abas estão travadas antes de tentar operações
- **Timeout de Injeção de Scripts**: Implementado timeout de 10 segundos para operações de injeção de scripts
- **Timeout de Reload**: Adicionado timeout de 5 segundos para operações de reload de abas
- **Fallback Robusto**: Melhorado sistema de fallback quando abas ficam inacessíveis ou travadas
- **Detecção de Abas Fechadas**: Melhorada detecção de abas que foram fechadas durante operações

### Added

- **Sistema de Ping**: Implementado sistema de ping/pong para verificar responsividade de abas
- **Timeouts Configuráveis**: Constantes para timeouts de diferentes operações (injeção, reload, ping)
- **Logs Detalhados**: Adicionados logs específicos para situações de timeout e abas não responsivas
- **Recuperação Automática**: Sistema automático de recuperação quando abas ficam travadas

### Technical Details

- Adicionada função `isTabResponsive()` para verificar se aba responde a mensagens
- Implementada função `injectScriptsWithTimeout()` com timeout de 10 segundos
- Criada constante `SCRIPT_INJECTION_TIMEOUT` para controlar timeout de injeção
- Adicionado tratamento de mensagem "ping" no content script
- Melhorada lógica de fallback em `checkAndNotifyNewTasks()` para lidar com abas travadas
- Implementados timeouts usando `Promise.race()` para operações críticas## [1.1.3] - 2025-07-25

### Fixed

- **Erro de Módulo em Content Script**: Corrigido o erro `Uncaught SyntaxError: Cannot use import statement outside a module` em `content.js`. A tentativa de usar `import` para o logger foi revertida devido a limitações na injeção de scripts como módulos. O `content.js` voltará a usar `console.*` para logs, com uma nota técnica explicando a limitação.

## [1.1.2] - 2025-07-25

### Fixed

- **Padronização de Logs**: Refatorados `background.js` e `content.js` para usar o sistema de logging centralizado (`logger.js`) em vez de `console.log`, `console.warn` e `console.error`, alinhando com as boas práticas do projeto.
- **Múltiplas Abas de Login**: Corrigido problema crítico onde extensão abria nova aba do SAU a cada verificação quando usuário não tinha credenciais salvas
- **Cooldown de Login**: Implementado sistema de cooldown de 5 minutos para evitar spam de abas de login
- **Verificação de Abas Existentes**: Extensão agora verifica se já existe aba de login aberta antes de criar nova
- **Login em Segundo Plano**: Abas de login agora são abertas em segundo plano para não interromper o usuário

### Added

- **Controle Inteligente de Abas**: Sistema para gerenciar abas de login sem credenciais
- **Rastreamento de Estado**: Variáveis para controlar timestamp e ID da última aba de login aberta
- **Listener de Abas Fechadas**: Detecta quando abas de login são fechadas para limpar estado interno

### Technical Details

- Adicionadas variáveis `lastLoginTabOpenedTimestamp` e `loginTabId` para controle de estado
- Implementada função `checkForExistingLoginTab()` para verificar abas de login existentes
- Criado sistema de cooldown de 5 minutos (`LOGIN_TAB_COOLDOWN`) para evitar spam
- Adicionado listener `tabs.onRemoved` para limpar estado quando abas são fechadas
- Melhorada lógica em `performAutomaticLogin()` para verificar condições antes de abrir nova aba

## [1.1.1] - 2025-07-24

### Fixed

- Release v1.1.1 com correções críticas de popup e build da extensão

## [1.1.1] - 2025-01-24

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

### Changed

- **Experiência do Usuário**: Completamente redesenhada para novos usuários
- **Arquitetura Modular**: Sistema extensível e bem documentado

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
