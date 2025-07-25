# GitHub Actions Release Troubleshooting

Este documento explica como resolver problemas comuns com GitHub Actions e releases.

## Problema: "Resource not accessible by integration"

### Sintomas
```
Run softprops/action-gh-release@v1
⚠️ Unexpected error fetching GitHub release for tag refs/tags/v1.1.1: 
HttpError: Resource not accessible by integration
Error: Resource not accessible by integration
```

### Causa
O `GITHUB_TOKEN` padrão não tem permissões suficientes para fazer upload de assets em releases.

### Soluções Implementadas

#### 1. Permissões no Workflow
Adicionadas permissões explícitas no arquivo `.github/workflows/ci.yml`:

```yaml
permissions:
  contents: write
  packages: write
  pull-requests: read
```

#### 2. Trigger por Tags
O workflow agora executa quando tags são criadas:

```yaml
on:
  push:
    branches: [ main, develop ]
    tags: [ 'v*' ]  # ← Novo trigger
```

#### 3. Workflow Manual de Backup
Criado `.github/workflows/upload-assets.yml` para upload manual:

```bash
# Uso via GitHub UI:
# 1. Vá para Actions → Upload Release Assets
# 2. Clique em "Run workflow"
# 3. Digite a tag (ex: v1.1.1)
# 4. Execute
```

#### 4. Release Script Melhorado
O script `scripts/release.js` agora:
- Cria releases sem assets inicialmente
- Permite que GitHub Actions faça upload posteriormente
- Detecta releases existentes e atualiza apenas assets

## Como Usar

### Método 1: Release Automático (Recomendado)
```bash
# 1. Atualize CHANGELOG.md
# 2. Execute o release script
npm run release

# 3. GitHub Actions fará upload automaticamente quando a tag for criada
```

### Método 2: Upload Manual via GitHub Actions
```bash
# 1. Crie o release manualmente ou via script
npm run release

# 2. Se o upload falhar, use o workflow manual:
# - Vá para GitHub → Actions → "Upload Release Assets"
# - Execute com a tag desejada (ex: v1.1.1)
```

### Método 3: Upload via GitHub CLI
```bash
# Se tudo mais falhar, use GitHub CLI diretamente:
npm run build
gh release upload v1.1.1 .dist/monitor-sau-chrome.zip .dist/monitor-sau-firefox.zip --clobber
```

## Verificação de Sucesso

### 1. Verificar Permissões do Repositório
```bash
# Verificar se o repositório permite GitHub Actions escrever
gh api repos/OWNER/REPO --jq '.permissions'
```

### 2. Verificar Assets do Release
```bash
# Listar assets de um release
gh release view v1.1.1 --json assets --jq '.assets[].name'
```

### 3. Verificar Logs do GitHub Actions
1. Vá para GitHub → Actions
2. Clique no workflow que falhou
3. Examine os logs detalhados

## Configurações do Repositório

### Permissões de Actions
Verifique em `Settings → Actions → General`:

- **Workflow permissions**: "Read and write permissions"
- **Allow GitHub Actions to create and approve pull requests**: ✅ Habilitado

### Branch Protection
Se houver branch protection, certifique-se de que:
- GitHub Actions pode fazer push
- Tags podem ser criadas

## Troubleshooting Avançado

### Problema: Token Expirado
```bash
# Re-autenticar GitHub CLI
gh auth login --web
```

### Problema: Release Já Existe
```bash
# Deletar release e tag (cuidado!)
gh release delete v1.1.1 --yes
git tag -d v1.1.1
git push origin :refs/tags/v1.1.1

# Recriar
npm run release
```

### Problema: Assets Corrompidos
```bash
# Limpar e rebuildar
npm run clean
npm run build

# Verificar integridade
ls -la .dist/
unzip -t .dist/monitor-sau-chrome.zip
unzip -t .dist/monitor-sau-firefox.zip
```

## Monitoramento

### Logs Úteis
```bash
# Status do último release
gh release list --limit 1

# Detalhes de um release específico
gh release view v1.1.1

# Status de workflows
gh run list --workflow=ci.yml --limit 5
```

### Notificações
Configure notificações no GitHub para:
- Falhas de workflow
- Releases criados
- Issues de segurança

## Prevenção

### Checklist Pré-Release
- [ ] `npm run validate` passa
- [ ] CHANGELOG.md atualizado
- [ ] Sem mudanças não commitadas
- [ ] GitHub CLI autenticado
- [ ] Permissões do repositório corretas

### Automação Futura
Considere implementar:
- Testes automáticos de upload
- Validação de assets antes do release
- Rollback automático em caso de falha
- Notificações de sucesso/falha

---

**Última atualização:** 2025-01-23
**Versão do documento:** 1.0.0