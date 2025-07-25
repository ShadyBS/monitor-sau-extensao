Changelog do Monitor de Tarefas SAU
Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

## [Unreleased]

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
