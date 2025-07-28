# Scripts de Build e Release

Este documento descreve os scripts automatizados para build, versionamento e release da extensão Monitor SAU.

## 📋 Visão Geral

O projeto inclui scripts robustos para automatizar todo o processo de desenvolvimento, desde o build até o release no GitHub, com verificações de segurança e validações de qualidade.

## 🛠️ Scripts Disponíveis

### Build (`scripts/build.js`)

Gera ZIPs otimizados para Chrome e Firefox.

```bash
# Build para todos os navegadores
npm run build

# Build apenas para Chrome
npm run build:chrome

# Build apenas para Firefox
npm run build:firefox
```

**Funcionalidades:**

- ✅ Validação de arquivos obrigatórios
- ✅ Validação de manifests específicos por navegador
- ✅ Cópia inteligente de arquivos
- ✅ Compressão máxima dos ZIPs
- ✅ Verificações de segurança
- ✅ Relatório detalhado de tamanhos

**Saída:** Arquivos `.dist/monitor-sau-chrome.zip` e `.dist/monitor-sau-firefox.zip`

### Versionamento (`scripts/version.js`)

Gerencia versionamento seguindo SemVer com sincronização automática.

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

**Funcionalidades:**

- ✅ Validação SemVer
- ✅ Sincronização entre package.json e manifests
- ✅ Confirmação interativa
- ✅ Detecção de versões dessincronizadas
- ✅ Suporte a prerelease

### Changelog (`scripts/changelog.js`)

Automatiza a atualização do `CHANGELOG.md` para um novo release.

```bash
# Mover notas "Unreleased" para uma nova versão
npm run changelog
```

**Funcionalidades:**

- ✅ Lê a versão atual do `package.json`.
- ✅ Verifica se a versão já existe no `CHANGELOG.md` para evitar duplicatas.
- ✅ Move o conteúdo da seção `[Unreleased]` para uma nova seção de versão com a data atual.
- ✅ Limpa a seção `[Unreleased]` para o próximo ciclo.
- ✅ Retorna erro se a seção `[Unreleased]` estiver vazia.

**Pré-requisitos:**

- `package.json` com a versão desejada para o release.
- `CHANGELOG.md` com notas na seção `[Unreleased]`.

### Release (`scripts/release.js`)

Automatiza todo o processo de release no GitHub.

```bash
# Release completo
npm run release

# Release com confirmação automática
npm run release -- --auto-confirm
```

**Funcionalidades:**

- ✅ Validação de ambiente Git
- ✅ Verificação de mudanças não commitadas
- ✅ Validação do CHANGELOG.md
- ✅ Build automático
- ✅ Criação de tags Git
- ✅ Push automático
- ✅ Release no GitHub com assets
- ✅ Extração automática de release notes

**Pré-requisitos:**

- Git configurado
- GitHub CLI instalado e autenticado
- CHANGELOG.md atualizado
- Nenhuma mudança não commitada

### Validação (`scripts/validate.js`)

Executa verificações abrangentes de qualidade e segurança.

```bash
npm run validate
```

**Verificações:**

- ✅ Estrutura de arquivos obrigatórios
- ✅ Validação de manifests
- ✅ Sintaxe JavaScript básica
- ✅ Verificações de segurança
- ✅ Validação do CHANGELOG
- ✅ Verificação de ícones
- ✅ Detecção de arquivos sensíveis

### Limpeza (`scripts/clean.js`)

Remove arquivos temporários e de build.

```bash
# Limpeza completa
npm run clean

# Simulação (mostra o que seria removido)
npm run clean -- --dry-run
```

**Remove:**

- `.dist/` - Arquivos de build
- `*.log` - Arquivos de log
- `.tmp/`, `.temp/` - Arquivos temporários
- `node_modules/.cache` - Cache do npm

## 🔒 Verificações de Segurança

### Build

- Validação de manifests
- Verificação de permissões perigosas
- Exclusão de arquivos sensíveis
- Validação de tamanho dos arquivos

### Validação

- Detecção de `eval()` e outras práticas inseguras
- Verificação de arquivos `.env` e similares
- Validação de `.gitignore`
- Auditoria de dependências

### Release

- Verificação de autenticação GitHub
- Validação de estado Git limpo
- Confirmação interativa
- Backup automático via tags

## 📁 Estrutura de Saída

```
.dist/
├── monitor-sau-chrome.zip    # Extensão para Chrome
├── monitor-sau-firefox.zip   # Extensão para Firefox
└── release-notes.md          # Notas de release (temporário)
```

## 🔄 Fluxo de Desenvolvimento Recomendado

### 1. Desenvolvimento

```bash
# Fazer mudanças no código
# Atualizar CHANGELOG.md
npm run validate  # Verificar qualidade
```

### 2. Versionamento

```bash
npm run version:patch  # ou minor/major
# Revisar mudanças
git add .
git commit -m "chore(release): v1.0.1"
```

### 3. Release

```bash
npm run release
# Confirmar quando solicitado
```

## ⚙️ Configuração

### GitHub CLI

```bash
# Instalar GitHub CLI
winget install GitHub.cli

# Autenticar
gh auth login
```

### Variáveis de Ambiente

```bash
# Opcional: configurar token GitHub
export GITHUB_TOKEN=your_token_here
```

### Configuração do Repositório

Atualize as URLs no `package.json`:

```json
{
  "repository": {
    "type": "git",
    "url": "git+https://github.com/SEU_USUARIO/monitor-sau-extensao.git"
  }
}
```

## 🐛 Troubleshooting

### Erro: "GitHub CLI não encontrado"

```bash
# Windows
winget install GitHub.cli

# macOS
brew install gh

# Linux
sudo apt install gh
```

### Erro: "Não autenticado no GitHub"

```bash
gh auth login
# Seguir instruções interativas
```

### Erro: "Mudanças não commitadas"

```bash
git add .
git commit -m "suas mudanças"
```

### Erro: "CHANGELOG não atualizado"

Edite `CHANGELOG.md` e adicione suas mudanças na seção `[Unreleased]`.

### Erro: "Versões dessincronizadas"

```bash
node scripts/version.js patch  # Sincroniza automaticamente
```

## 📊 Métricas e Relatórios

### Build

- Tamanho dos ZIPs gerados
- Tempo de build
- Arquivos incluídos/excluídos

### Validação

- Número de erros/avisos
- Verificações de segurança
- Qualidade do código

### Release

- Versão criada
- Assets enviados
- URL do release

## 🔧 Personalização

### Adicionar Novos Arquivos ao Build

Edite `CONFIG.sourceFiles` em `scripts/build.js`:

```javascript
sourceFiles: [
  "background.js",
  "content.js",
  // ... arquivos existentes
  "seu-novo-arquivo.js", // Adicione aqui
];
```

### Personalizar Validações

Edite `scripts/validate.js` para adicionar novas verificações:

```javascript
async validateCustom() {
  // Suas validações personalizadas
}
```

### Modificar Processo de Release

Edite `scripts/release.js` para personalizar o fluxo:

```javascript
async customReleaseStep() {
  // Seus passos personalizados
}
```

## 📝 Logs e Debug

### Ativar Logs Detalhados

```bash
DEBUG=1 npm run build
DEBUG=1 npm run release
```

### Localização dos Logs

- Console: Saída em tempo real
- `.dist/`: Arquivos temporários de debug
- GitHub Actions: Logs de CI/CD

## 🚀 CI/CD Integration

Os scripts são totalmente compatíveis com GitHub Actions:

```yaml
- name: Build Extensions
  run: npm run build

- name: Validate Project
  run: npm run validate

- name: Create Release
  run: npm run release -- --auto-confirm
```

## 📚 Referências

- [Semantic Versioning](https://semver.org/)
- [Keep a Changelog](https://keepachangelog.com/)
- [GitHub CLI](https://cli.github.com/)
- [Chrome Extension Manifest V3](https://developer.chrome.com/docs/extensions/mv3/)
- [Firefox Extension Development](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions)
