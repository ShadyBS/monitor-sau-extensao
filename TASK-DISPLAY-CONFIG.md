# Configuração de Exibição de Tarefas

## Visão Geral

A extensão Monitor de Tarefas SAU agora permite que os usuários configurem quais informações de cada tarefa devem aparecer no cabeçalho (sempre visível) e quais devem aparecer apenas nos detalhes expandidos.

## Como Usar

### 1. Acessar as Configurações

1. Clique no ícone da extensão na barra de ferramentas
2. No popup, clique em "Configurações"
3. Role até a seção "Exibição de Tarefas"

### 2. Configurar Informações do Cabeçalho

Na seção "Informações do Cabeçalho", você pode selecionar quais informações devem aparecer sempre visíveis:

- ✅ **Número da Tarefa** (sempre visível - não pode ser desabilitado)
- ✅ **Título da Tarefa** (sempre visível - não pode ser desabilitado)
- ☑️ **Data de Envio** (configurável)
- ☑️ **Posição na Fila** (configurável)
- ☑️ **Solicitante** (configurável)
- ☑️ **Unidade** (configurável)

### 3. Informações dos Detalhes

As informações **não selecionadas** no cabeçalho aparecerão automaticamente na seção de detalhes expandidos, junto com:

- **Descrição** (sempre nos detalhes)
- **Endereço(s)** (sempre nos detalhes, se disponível)
- **Link para o SAU** (sempre nos detalhes)

### 4. Salvar Configurações

Clique em "Salvar Configurações de Exibição" para aplicar as mudanças.

## Configurações Padrão

Por padrão, a extensão vem configurada com:

**No Cabeçalho:**
- Número da Tarefa ✅
- Título da Tarefa ✅
- Data de Envio ✅
- Posição na Fila ✅

**Nos Detalhes:**
- Solicitante
- Unidade
- Descrição
- Endereço(s)
- Link para o SAU

## Exemplos de Configuração

### Configuração Minimalista
**Cabeçalho:** Apenas número e título
**Detalhes:** Todas as outras informações

### Configuração Completa
**Cabeçalho:** Número, título, data, posição, solicitante e unidade
**Detalhes:** Apenas descrição, endereços e link

### Configuração Focada no Solicitante
**Cabeçalho:** Número, título e solicitante
**Detalhes:** Data, posição, unidade, descrição, endereços e link

## Benefícios

1. **Personalização**: Cada usuário pode configurar a exibição conforme sua preferência
2. **Eficiência**: Informações mais importantes ficam sempre visíveis
3. **Organização**: Interface mais limpa e organizada
4. **Flexibilidade**: Fácil de alterar conforme necessidade

## Implementação Técnica

### Arquivos Modificados

- `options.html` - Nova seção de configuração
- `options.js` - Lógica para salvar/carregar configurações
- `popup.js` - Lógica para exibir tarefas baseado nas configurações
- `options.css` - Estilos para checkboxes e nova seção

### Storage

As configurações são salvas em `chrome.storage.local` com a chave `taskDisplaySettings`:

```javascript
{
  headerFields: {
    numero: true,      // sempre true
    titulo: true,      // sempre true
    dataEnvio: boolean,
    posicao: boolean,
    solicitante: boolean,
    unidade: boolean
  }
}
```

### Compatibilidade

- ✅ Chrome (Manifest V3)
- ✅ Firefox (Manifest V3)
- ✅ Configurações persistem entre sessões
- ✅ Fallback para configurações padrão em caso de erro

## Troubleshooting

### Configurações não estão sendo salvas
1. Verifique se há erros no console do navegador
2. Tente recarregar a extensão
3. Verifique as permissões de storage

### Popup não reflete as configurações
1. Feche e abra o popup novamente
2. Clique em "Atualizar Agora" no popup
3. Verifique se as configurações foram salvas corretamente

### Restaurar configurações padrão
1. Vá para as configurações da extensão
2. Marque: Data de Envio e Posição na Fila
3. Desmarque: Solicitante e Unidade
4. Clique em "Salvar Configurações de Exibição"