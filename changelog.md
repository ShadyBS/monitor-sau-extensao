Changelog do Monitor de Tarefas SAU
Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

## [Unreleased]

### Added
- **Sistema de Ajuda Completo para Novos Usuários**: Implementado sistema abrangente de ajuda e onboarding
- **Página de Ajuda Completa** (`help.html`): Guia detalhado com seções organizadas (Primeiros Passos, Configurações, Funcionalidades, Solução de Problemas, FAQ)
- **Sistema de Tooltips Avançado** (`tooltip-system.js`): Sistema modular para tooltips informativos e ajuda contextual
- **Tour Guiado Interativo**: Tour passo-a-passo para novos usuários com navegação entre etapas
- **Ajuda Contextual no Popup**: Mensagem de boas-vindas para novos usuários com botões de ação
- **Botões de Ajuda Integrados**: Botão de ajuda principal no popup com tooltips informativos
- **Detecção de Primeiro Uso**: Sistema inteligente que detecta novos usuários e oferece ajuda automaticamente
- **Tour Rápido do Popup**: Tour específico da interface principal com explicações de cada elemento
- **Sistema de Navegação por Abas**: Interface organizada na página de ajuda com navegação fluida
- **Tooltips Informativos**: Tooltips em botões principais explicando suas funcionalidades
- **Animações e Transições**: Interface moderna com animações suaves e feedback visual
- **Responsividade Completa**: Design adaptativo para diferentes tamanhos de tela
- **Integração com Sistema de Logging**: Todas as ações de ajuda são registradas para diagnóstico

### Changed
- **Interface do Popup Modernizada**: Header reorganizado com botão de ajuda integrado
- **Melhor Experiência para Novos Usuários**: Fluxo de onboarding mais intuitivo e informativo
- **Navegação Aprimorada**: Ícones adicionados aos botões principais para melhor identificação
- **Sistema de Ajuda Contextual**: Ajuda específica baseada no contexto e estado do usuário

### Technical Details
- **Arquitetura Modular**: Sistema de tooltips como módulo independente e reutilizável
- **Compatibilidade Mantida**: Todos os novos recursos seguem padrões Chrome/Firefox
- **Segurança Preservada**: Sistema de sanitização aplicado a todos os novos elementos
- **Performance Otimizada**: Carregamento lazy de recursos de ajuda quando necessário
- **Persistência de Estado**: Preferências de ajuda salvas no storage local
- **Acessibilidade**: Suporte a navegação por teclado e leitores de tela

### Fixed
- Correção do botão "Detalhes" na popup que não estava funcionando devido a inconsistência entre ID criado e ID buscado
- Elemento de detalhes agora usa atributo `id` em vez de `data-id` para compatibilidade com `getElementById()`
- Adicionado atributo `id` à lista de atributos permitidos no sistema de sanitização

### Added
- **Instruções para Agentes de IA**: Criado arquivo `AI_PROMPT_INSTRUCTIONS.md` com diretrizes obrigatórias para todos os prompts de IA
- Guia completo de práticas de código, segurança e fluxo de trabalho baseado no `agents.md`
- Instruções específicas para Conventional Commits e atualização automática do CHANGELOG
- Checklist pré-commit obrigatório para agentes de IA
- Diretrizes de compatibilidade Chrome/Firefox e uso dos sistemas de logging e sanitização
- **Sistema de Renotificação de Tarefas Pendentes**: Nova funcionalidade que permite renotificar o usuário sobre tarefas que permanecem pendentes após um período configurável
- Configuração de renotificação na página de opções com checkbox para ativar/desativar
- Campo configurável para intervalo de renotificação em minutos (padrão: 30 minutos)
- Controle de timestamps de notificação para rastrear quando cada tarefa foi notificada pela última vez
- Lógica inteligente que só renotifica tarefas que já foram notificadas anteriormente (não renotifica tarefas que nunca foram vistas)
- Configuração personalizável de exibição de tarefas no popup
- Interface na página de opções para selecionar quais informações aparecem no cabeçalho vs detalhes
- Sistema de variáveis CSS centralizado para melhor manutenibilidade
- Classes utilitárias CSS para componentes comuns
- Sistema avançado de "Lembrar Mais Tarde" com múltiplas opções de tempo
- Dropdown expansível no botão "Lembrar Mais Tarde" com opç��es pré-configuradas
- Opção de tempo personalizado com inputs separados para horas e minutos
- Configuração de opções de snooze na página de configurações
- Possibilidade de adicionar/remover opções de tempo personalizadas
- Scripts automatizados de build para Chrome e Firefox
- Sistema de versionamento automático com SemVer
- Scripts de release automatizado para GitHub
- Validações de segurança e qualidade de código
- Pipeline de CI/CD com GitHub Actions
- Templates para issues e pull requests

### Changed
- Sistema de notificações agora suporta renotificação automática de tarefas pendentes
- Melhor controle de estado das tarefas com timestamps de notificação persistentes
- Popup agora exibe informações das tarefas baseado nas configurações do usuário
- CSS migrado para usar variáveis CSS centralizadas
- Melhor organização e consistência visual em todos os componentes
- Sistema de "Lembrar Mais Tarde" agora permite configuração por tarefa individual
- Interface do snooze substituída por dropdown com múltiplas opções
- Processo de build e release completamente automatizado

### Technical Details
- Adicionada variável global `taskNotificationTimestamps` para controlar renotificações
- Nova função `checkIfShouldRenotify()` que verifica se uma tarefa deve ser renotificada
- Atualizada função `handleNewTasks()` para incluir lógica de renotificação
- Configurações de renotificação persistidas no `chrome.storage.local`
- Sistema de reset de memória agora também limpa timestamps de notificação

[1.0] - 2025-07-23
Adicionado
Estrutura inicial do projeto da extensão.

Arquivo manifest.json com configurações básicas e permissões necessárias (Manifest V3).

Pastas icons para ícones da extensão.

Arquivo changelog.md para rastreamento de mudanças.

Página de Opções:

Arquivo options.html para interface de configuração.

Arquivo options.js para lógica de salvar/carregar credenciais e configurações.

Arquivo options.css para estilização da página de opções.

Popup da Extensão:

Arquivo popup.html para a interface do popup.

Arquivo popup.js para a lógica de exibição de tarefas e interação com o background script.

Arquivo popup.css para estilização do popup.

Lógica de Fundo (background.js):

Implementado o Service Worker (background.js) para gerenciar tarefas em segundo plano.

Funcionalidade de login automático utilizando credenciais salvas no chrome.storage.local.

Agendamento de verificações periódicas de tarefas usando chrome.alarms.

Lógica para notificar o usuário sobre novas tarefas via notificações do navegador.

Suporte para ações interativas nas notificações do navegador ("Abrir Todas", "Ignorar Todas").

Gerenciamento do estado das tarefas (lastKnownTasks, ignoredTasks, snoozedTasks) com persistência via chrome.storage.local.

Comunicação com o content.js para iniciar verificações e injetar a UI de notificação visual.

Interação com a Página (content.js e notification-ui.css):

Implementado o content.js para ser injetado nas páginas do SAU.

Lógica para detectar a página de login e acionar o preenchimento automático.

Interceptação de requisições AJAX (XMLHttpRequest) para pesquisar_Tarefa.sau para capturar dinamicamente a lista de tarefas.

Funções para parsear o HTML das tarefas e extrair informações relevantes (número, título, link, data de envio, posição).

Implementação de MutationObserver como um mecanismo complementar/fallback para detectar mudanças no DOM e novas tarefas.

Lógica para enviar novas tarefas detectadas ao background.js.

Funcionalidade para injetar uma interface de usuário visual de notificação diretamente na página do SAU quando novas tarefas são encontradas.

Estilos (notification-ui.css) para a notificação visual injetada, garantindo uma aparência moderna e não intrusiva.

Adicionados listeners para os botões da notificação visual (Abrir, Ignorar, Lembrar Mais Tarde), comunicando as ações de volta ao background.js.

Sistema de Log e Depuração:

Criado o módulo logger.js para centralizar o registro de logs.

Implementado suporte a níveis de log (DEBUG, INFO, WARN, ERROR, NONE).

Adicionado prefixo de contexto ([Background], [Content], etc.) e timestamp a todas as mensagens de log.

Integrado logger.js em background.js, content.js, popup.js e options.js, substituindo console.log/warn/error.

Adicionada opção de configuração de nível de log na página de opções (options.html e options.js).

Atualizado manifest.json para carregar logger.js como módulo e em content_scripts.

Funcionalidade de Exportação de Logs:

Adicionado botão "Exportar Logs" na página de opções (options.html).

Implementada a lógica em options.js para solicitar logs ao background.js e baixá-los como um arquivo .txt.

Modificado logger.js para armazenar logs em um buffer em memória (com limite de 1000 entradas) e expor um método getStoredLogs().

Adicionado manipulador de mensagens em background.js para responder às solicitações de logs da página de opções.

Revisões de Compatibilidade (Chrome e Firefox)
APIs de Extensão: Todas as chamadas chrome._ foram substituídas pelo padrão (globalThis.browser || globalThis.chrome)._ para garantir compatibilidade com ambos os navegadores.

Manifest V3: O manifest.json já está configurado para Manifest V3, que é suportado pelas versões recentes do Firefox.

DOM e CSS: As manipulações de DOM e os estilos CSS utilizados são padrão e funcionam em ambos os navegadores.

JavaScript Moderno: O código utiliza recursos modernos do JavaScript (ES6+), que são bem suportados por Chrome e Firefox.