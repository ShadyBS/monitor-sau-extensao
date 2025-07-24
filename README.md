# Monitor de Tarefas SAU

Extensão para navegador que monitora novas tarefas no Sistema de Atendimento ao Usuário (SAU) da Prefeitura de Santos.

## 🚀 Funcionalidades

- **Monitoramento Automático**: Verifica periodicamente por novas tarefas
- **Notificações**: Alertas visuais e do navegador para novas tarefas
- **Login Automático**: Preenche credenciais automaticamente
- **Interface Configurável**: Personalize quais informações aparecem no popup
- **Sistema de Snooze Avançado**: Configure múltiplas opções de "Lembrar Mais Tarde"
- **Compatibilidade**: Funciona no Chrome e Firefox

## 📦 Instalação

### Chrome
1. Baixe o arquivo `monitor-sau-chrome.zip` da [página de releases](https://github.com/yourusername/monitor-sau-extensao/releases)
2. Extraia o arquivo ZIP
3. Abra `chrome://extensions/`
4. Ative o "Modo do desenvolvedor"
5. Clique em "Carregar sem compactação" e selecione a pasta extraída

### Firefox
1. Baixe o arquivo `monitor-sau-firefox.zip` da [página de releases](https://github.com/yourusername/monitor-sau-extensao/releases)
2. Abra `about:debugging`
3. Clique em "Este Firefox"
4. Clique em "Carregar extensão temporária"
5. Selecione o arquivo ZIP baixado

## ⚙️ Configuração

1. Clique no ícone da extensão
2. Clique em "Configurações"
3. Insira suas credenciais do SAU
4. Configure as opções de notificação e exibição

## 🛠️ Desenvolvimento

### Pré-requisitos

- Node.js 16+ 
- npm ou yarn
- Git
- GitHub CLI (para releases)

### Instalação das Dependências

```bash
npm install
```

### Scripts Disponíveis

#### Build
```bash
# Build para todos os navegadores
npm run build

# Build apenas para Chrome
npm run build:chrome

# Build apenas para Firefox
npm run build:firefox
```

#### Versionamento
```bash
# Incrementar versão patch (1.0.0 → 1.0.1)
npm run version:patch

# Incrementar versão minor (1.0.0 → 1.1.0)
npm run version:minor

# Incrementar versão major (1.0.0 → 2.0.0)
npm run version:major

# Mostrar informações de versão
node scripts/version.js info
```

#### Release
```bash
# Release completo (build + tag + GitHub release)
npm run release

# Release com confirmação automática
npm run release -- --auto-confirm
```

#### Utilitários
```bash
# Validar projeto
npm run validate

# Limpar arquivos de build
npm run clean

# Simulação de limpeza
npm run clean -- --dry-run
```

### Fluxo de Desenvolvimento

1. **Fazer mudanças no código**
2. **Atualizar CHANGELOG.md** com as mudanças
3. **Validar projeto**: `npm run validate`
4. **Incrementar versão**: `npm run version:patch` (ou minor/major)
5. **Fazer commit**: `git add . && git commit -m "feat: sua funcionalidade"`
6. **Fazer release**: `npm run release`

### Estrutura do Projeto

```
├── scripts/              # Scripts de build e release
│   ├── build.js          # Gera ZIPs para Chrome e Firefox
│   ├── version.js        # Gerencia versionamento SemVer
│   ├── release.js        # Automatiza releases no GitHub
│   ├── clean.js          # Limpa arquivos temporários
│   └── validate.js       # Valida qualidade do código
├── icons/                # Ícones da extensão
├── .dist/                # Arquivos de build (gerado)
├── background.js         # Service Worker principal
├── content.js            # Script injetado nas páginas
├── popup.html/js/css     # Interface do popup
├── options.html/js/css   # Página de configurações
├── manifest.json         # Manifest para Chrome
├── manifest-firefox.json # Manifest para Firefox
└── CHANGELOG.md          # Histórico de mudanças
```

## 🔒 Segurança

- Credenciais armazenadas localmente no navegador
- Comunicação apenas com domínios autorizados
- Validações de segurança nos scripts de build
- Sem coleta de dados externos

## 📝 Changelog

Veja [CHANGELOG.md](CHANGELOG.md) para histórico detalhado de mudanças.

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'feat: add AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

### Padrões de Commit

Este projeto usa [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` Nova funcionalidade
- `fix:` Correção de bug
- `docs:` Mudanças na documentação
- `style:` Formatação, sem mudança de lógica
- `refactor:` Refatoração de código
- `test:` Adição ou correção de testes
- `chore:` Manutenção, build, dependências

## 📄 Licença

Este projeto está licenciado sob a Licença MIT - veja o arquivo [LICENSE](LICENSE) para detalhes.

## 🐛 Reportar Bugs

Encontrou um bug? [Abra uma issue](https://github.com/yourusername/monitor-sau-extensao/issues/new) com:

- Descrição detalhada do problema
- Passos para reproduzir
- Versão da extensão e navegador
- Screenshots se aplicável

## 💡 Sugestões

Tem uma ideia para melhorar a extensão? [Abra uma issue](https://github.com/yourusername/monitor-sau-extensao/issues/new) com a tag `enhancement`.

## 📞 Suporte

- 📧 Email: seu-email@exemplo.com
- 🐛 Issues: [GitHub Issues](https://github.com/yourusername/monitor-sau-extensao/issues)
- 📖 Documentação: [Wiki](https://github.com/yourusername/monitor-sau-extensao/wiki)