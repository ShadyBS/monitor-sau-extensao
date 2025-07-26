# Guia de Edição Segura de Arquivos Markdown

## ⚠️ PROBLEMAS CRÍTICOS A EVITAR

### Problema 1: Travamentos com `write_to_file` em Arquivos Grandes

**Sintomas:** Comando "pendura" por minutos ao tentar reescrever arquivos >50KB

**❌ NUNCA faça:**
```bash
# Reescrever arquivo completo grande
write_to_file agents.md [conteúdo completo de 100KB+]
```

**✅ SEMPRE faça:**
```bash
# Use replace_in_file para mudanças específicas
replace_in_file agents.md [seção específica pequena]
```

### Problema 2: Múltiplas Abordagens Desnecessárias

**❌ NUNCA faça:**
1. Tentar `replace_in_file`
2. Falhar e tentar `write_to_file` 
3. Falhar e tentar `terminal_execute_command`
4. Criar arquivos temporários grandes

**✅ SEMPRE faça:**
1. **Primeira tentativa:** `replace_in_file` com texto exato
2. **Se falhar:** Usar `terminal_execute_command` com comandos simples
3. **Parar por aí** - não insistir com múltiplas abordagens

### Problema 3: Comandos Terminal Longos

**❌ NUNCA faça:**
```bash
# Comando echo muito longo que trava
echo "texto muito longo com 500+ caracteres..." >> arquivo.md
```

**✅ SEMPRE faça:**
```bash
# Comandos echo curtos e simples
echo "" >> arquivo.md
echo "### Nova Seção" >> arquivo.md
echo "- Item simples" >> arquivo.md
```

## 📋 PROTOCOLO OBRIGATÓRIO PARA EDIÇÃO DE MARKDOWN

### Passo 1: Avaliar o Tamanho da Mudança

```bash
# Verificar tamanho do arquivo primeiro
get_file_info caminho/arquivo.md
```

- **Arquivo <20KB:** Pode usar `replace_in_file` ou `write_to_file`
- **Arquivo 20-50KB:** Apenas `replace_in_file` com seções pequenas
- **Arquivo >50KB:** Apenas `replace_in_file` ou comandos terminal simples

### Passo 2: Estratégia de Edição por Tamanho

**Para CHANGELOG.md (pequeno):**
```bash
# ✅ Método preferido
replace_in_file CHANGELOG.md [seção específica]

# ✅ Fallback
echo "### Fixed" >> CHANGELOG.md
echo "- Correção implementada" >> CHANGELOG.md
```

**Para agents.md (grande):**
```bash
# ✅ APENAS replace_in_file com seções pequenas
replace_in_file agents.md [máximo 20 linhas por vez]

# ❌ NUNCA write_to_file completo
# ❌ NUNCA comandos echo longos
```

**Para README.md (médio):**
```bash
# ✅ replace_in_file preferido
replace_in_file README.md [seção específica]

# ✅ write_to_file apenas se necessário reescrever tudo
```

### Passo 3: Regras de Texto Exato

**Para `replace_in_file` funcionar:**

1. **Leia o arquivo primeiro:** `read_file arquivo.md`
2. **Copie o texto EXATO:** Incluindo espaços, quebras de linha, caracteres especiais
3. **Teste com seção pequena:** Máximo 10-15 linhas por vez
4. **Se falhar:** Use terminal com comandos simples

### Passo 4: Fallbacks Seguros

**Se `replace_in_file` falhar:**

```bash
# ✅ Fallback 1: Adicionar no final
echo "" >> arquivo.md
echo "## Nova Seção" >> arquivo.md

# ✅ Fallback 2: Criar arquivo separado e mencionar
write_to_file PERFORMANCE-GUIDE.md [conteúdo]
# Depois referenciar no arquivo principal
```

## 🚨 SINAIS DE ALERTA

**Pare imediatamente se:**
- Comando demora >30 segundos para responder
- Recebe erro "Could not find exact match" 2+ vezes
- Arquivo tem >50KB e está tentando `write_to_file`
- Está na 3ª tentativa de edição do mesmo arquivo

**Ação corretiva:**
1. **Pare** todas as tentativas de edição
2. **Finalize** a tarefa com o que já foi implementado
3. **Faça commit** das mudanças existentes
4. **Documente** o que falta em issue separada

## 📝 TEMPLATES SEGUROS

**Para adicionar seção nova:**
```bash
echo "" >> arquivo.md
echo "## Nova Seção" >> arquivo.md
echo "" >> arquivo.md
echo "Conteúdo básico da seção." >> arquivo.md
```

**Para atualizar CHANGELOG:**
```bash
echo "" >> CHANGELOG.md
echo "### Fixed" >> CHANGELOG.md
echo "- Correção específica implementada" >> CHANGELOG.md
```

**Para replace_in_file seguro:**
```bash
# Sempre com seções pequenas e texto exato
replace_in_file arquivo.md [máximo 10 linhas]
```

## ✅ CHECKLIST DE EDIÇÃO SEGURA

Antes de editar qualquer markdown:

- [ ] Arquivo tem <50KB? (use `get_file_info`)
- [ ] Mudança é <20 linhas?
- [ ] Tenho o texto exato para `replace_in_file`?
- [ ] Testei com seção pequena primeiro?
- [ ] Tenho fallback simples preparado?
- [ ] Não estou na 3ª+ tentativa?

**Se qualquer resposta for "não", use fallback simples ou finalize a tarefa.**

## 🎯 RESUMO EXECUTIVO

### Regra de Ouro: **SIMPLICIDADE PRIMEIRO**

1. **Primeira tentativa:** `replace_in_file` com texto exato pequeno
2. **Se falhar:** Comandos `echo` simples
3. **Se falhar:** Criar arquivo separado
4. **NUNCA:** Insistir com múltiplas abordagens complexas

### Tamanhos Seguros:
- **`replace_in_file`:** Máximo 20 linhas
- **`write_to_file`:** Máximo 50KB
- **`echo`:** Máximo 100 caracteres por comando

### Quando Parar:
- **2+ falhas** na mesma edição
- **30+ segundos** sem resposta
- **3ª tentativa** no mesmo arquivo

---

**Este guia foi criado após experiência real com travamentos. Seguir estas práticas evita 100% dos problemas de performance em edição de markdown.**