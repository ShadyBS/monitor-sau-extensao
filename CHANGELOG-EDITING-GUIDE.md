# 🚨 Guia Crítico: Edição Correta de CHANGELOG.md

## ❌ **PROBLEMA IDENTIFICADO**

### **O que aconteceu:**
- Tentativa de `replace_in_file` falhou por não encontrar match exato na seção `[Unreleased]`
- Uso de `echo >> CHANGELOG.md` como fallback
- **RESULTADO CRÍTICO**: Entradas adicionadas no FINAL do arquivo, não na seção `[Unreleased]`
- Criação de duplicatas e estrutura incorreta do changelog

### **Ambiente:** Windows/VSCode/PowerShell
- Comandos `echo >>` adicionam no final do arquivo
- Encoding pode ser alterado inadvertidamente
- Quebras de linha podem ser inconsistentes

---

## ✅ **SOLUÇÕES PERMANENTES**

### **1. Método Preferido - `replace_in_file` Preciso**

```bash
# SEMPRE ler arquivo primeiro para identificar estrutura exata
read_file CHANGELOG.md

# Procurar por padrões específicos na seção [Unreleased]
# Usar texto EXATO encontrado no arquivo, incluindo espaços e quebras
```

**Exemplo correto:**
```javascript
// Buscar por:
### Added

- **Verificação Inicial Automática**: Implementada verificação...

// E substituir por:
### Added

- **Verificaç��o Inicial Automática**: Implementada verificação...
- **Nova Funcionalidade**: Descrição da nova funcionalidade
```

### **2. Fallback Inteligente para Windows**

```powershell
# ❌ NUNCA FAÇA ISSO:
echo "### Added" >> CHANGELOG.md  # Adiciona no final!

# ✅ MÉTODO CORRETO no Windows PowerShell:
$content = Get-Content CHANGELOG.md -Raw
$newContent = $content -replace '(### Added)', '$1`r`n- **Nova Funcionalidade**: Descrição'
$newContent | Set-Content CHANGELOG.md -Encoding UTF8

# ✅ ALTERNATIVA: Usar array de linhas
$lines = Get-Content CHANGELOG.md
$newLines = @()
$addedFound = $false

foreach ($line in $lines) {
    $newLines += $line
    if ($line -match "### Added" -and -not $addedFound) {
        $newLines += "- **Nova Funcionalidade**: Descrição"
        $addedFound = $true
    }
}

$newLines | Set-Content CHANGELOG.md -Encoding UTF8
```

### **3. Validação Obrigatória Pós-Edição**

```powershell
# SEMPRE executar após qualquer edição de CHANGELOG:

# 1. Verificar duplicatas
(Get-Content CHANGELOG.md | Select-String "Script de Verificação").Count
# Deve retornar 1

# 2. Verificar estrutura
Get-Content CHANGELOG.md | Select-String "## \[Unreleased\]" -Context 5

# 3. Verificar encoding
Get-Content CHANGELOG.md -Encoding UTF8 | Measure-Object -Line

# 4. Verificar se entradas estão na seção correta (primeiras 50 linhas)
Get-Content CHANGELOG.md | Select-Object -First 50 | Select-String "Nova Funcionalidade"
```

---

## 🔧 **PROCESSO CORRIGIDO PARA CHANGELOG**

### **Fluxo Obrigatório:**

1. **📖 Leitura**: `read_file CHANGELOG.md`
2. **🔍 Identificação**: Localizar seção `## [Unreleased]` exata
3. **✏️ Edição**: Usar `replace_in_file` com match exato
4. **🔄 Fallback**: Se falhar, usar PowerShell com inserção programática
5. **✅ Validação**: Verificar estrutura e ausência de duplicatas
6. **🚨 Correção**: Se detectar problemas, corrigir ANTES de commit

### **Checklist de Validação:**

- [ ] Arquivo lido com `read_file` antes da edição
- [ ] Seção `[Unreleased]` identificada corretamente
- [ ] Edição feita na seção correta (não no final)
- [ ] Sem duplicatas de entradas
- [ ] Encoding UTF-8 preservado
- [ ] Estrutura Keep a Changelog mantida
- [ ] Commit realizado após validação completa

---

## ⚠️ **REGRAS ABSOLUTAS**

### **NUNCA:**
- ❌ Use `echo >> CHANGELOG.md` (adiciona no final)
- ❌ Edite sem ler o arquivo primeiro
- ❌ Faça commit sem validar estrutura
- ❌ Ignore problemas de encoding

### **SEMPRE:**
- ✅ Leia arquivo antes de editar
- ✅ Valide após cada edição
- ✅ Corrija problemas imediatamente
- ✅ Mantenha estrutura Keep a Changelog
- ✅ Use encoding UTF-8 consistente

---

## 🛠️ **COMANDOS ÚTEIS PARA WINDOWS**

### **Verificação Rápida:**
```powershell
# Ver últimas linhas
Get-Content CHANGELOG.md | Select-Object -Last 10

# Ver primeiras linhas da seção Unreleased
Get-Content CHANGELOG.md | Select-String "## \[Unreleased\]" -Context 0,20

# Contar ocorrências de uma entrada
(Get-Content CHANGELOG.md | Select-String "texto específico").Count

# Verificar encoding
Get-Content CHANGELOG.md -Encoding UTF8 -TotalCount 1
```

### **Correção de Emergência:**
```powershell
# Se arquivo estiver corrompido, restaurar do backup
Copy-Item CHANGELOG.md.backup CHANGELOG.md

# Remover linhas duplicadas do final
$content = Get-Content CHANGELOG.md
$cleanContent = $content | Select-Object -First ($content.Length - 5)  # Remove últimas 5 linhas
$cleanContent | Set-Content CHANGELOG.md -Encoding UTF8
```

---

**Criado:** 2025-07-29 - Lições aprendidas da correção de problemas de edição de CHANGELOG.md
**Ambiente:** Windows/VSCode/PowerShell
**Status:** Documento de referência permanente