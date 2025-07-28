Changelog do Monitor de Tarefas SAU
Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

## [Unreleased]

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
- Implementados timeouts usando `Promise.race()` para operações críticas

## [1.1.3] - 2025-07-25

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
