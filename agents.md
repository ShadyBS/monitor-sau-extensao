# Guia para Agentes de IA

Olá, agente! Este documento é o seu guia principal para entender e contribuir com este projeto. Seguir estas diretrizes garantirá que suas contribuições sejam consistentes, de alta qualidade e bem integradas ao trabalho da equipe humana.

## Índice

1. [Objetivo Principal](#1-objetivo-principal)
2. [Estrutura do Projeto](#2-estrutura-do-projeto)
3. [Fluxo de Trabalho de Modificação](#3-fluxo-de-trabalho-de-modificação)
4. [Revisão de Código](#4-revisão-de-código)
5. [Documentação e Comentários](#5-documentação-e-comentários)
6. [Resolução de Conflitos](#6-resolução-de-conflitos)
7. [Debugging e Troubleshooting](#7-debugging-e-troubleshooting)
8. [Princípios Gerais](#8-princípios-gerais)
9. [Recursos Úteis](#9-recursos-úteis)
10. [Resumo do Fluxo](#10-resumo-do-fluxo)

## 1. Objetivo Principal

Seu objetivo é auxiliar no desenvolvimento e manutenção deste software, escrevendo código limpo, eficiente e bem documentado, além de seguir as práticas estabelecidas neste guia. Você deve atuar como um membro produtivo da equipe de engenharia.

## 2. Estrutura do Projeto

Para navegar e fazer modificações de forma eficaz, é crucial que você entenda a organização dos arquivos e diretórios.

```
├── .github/         # Workflows de CI/CD e templates de PR/Issue
├── dist/            # Arquivos de build (não modifique diretamente)
├── public/          # Arquivos estáticos (imagens, fontes, etc.)
├── src/             # Código-fonte da aplicação
│   ├── assets/      # Ativos específicos da aplicação (CSS, imagens)
│   ├── components/  # Componentes de UI reutilizáveis
│   ├── services/    # Lógica de negócio, chamadas de API
│   ├── utils/       # Funções utilitárias genéricas
│   ├── views/       # Páginas ou views principais da aplicação
│   └── main.js      # Ponto de entrada da aplicação
├── tests/           # Testes automatizados
│   ├── unit/        # Testes unitários
│   └── e2e/         # Testes end-to-end
├── .eslintrc.json   # Configurações do ESLint (padrão de código)
├── .gitignore       # Arquivos e pastas ignorados pelo Git
├── CHANGELOG.md     # Histórico de mudanças visíveis para o usuário
├── package.json     # Dependências e scripts do projeto
├── README.md        # Documentação principal do projeto
└── agents.md        # Seu guia de diretrizes (este arquivo)
```

**Regra de Ouro:** Sempre analise os arquivos existentes no diretório em que você está trabalhando para entender e replicar os padrões e a arquitetura local.

## 3. Fluxo de Trabalho de Modificação

Siga estes passos para cada tarefa ou modificação que realizar.

### Passo 1: Entender a Tarefa

Analise cuidadosamente a solicitação. Se houver ambiguidade, peça esclarecimentos antes de começar a codificar.

### Passo 2: Codificar a Solução

Implemente a funcionalidade ou correção solicitada. Adote as seguintes boas práticas:

- **Estilo de Código:** Siga rigorosamente as regras definidas no arquivo `.eslintrc.json`. Use o formatador de código (como Prettier) configurado no projeto.
- **Clareza e Simplicidade:** Escreva um código legível e de fácil manutenção. Prefira soluções claras a soluções excessivamente complexas.
- **Não Repita Código (DRY):** Crie funções ou componentes reutilizáveis sempre que identificar lógica duplicada.
- **Testes:** Para novas funcionalidades, crie testes unitários correspondentes no diretório `tests/unit/`. Para correções de bugs, adicione um teste que falharia sem a sua correção e passaria com ela.

### Passo 3: Atualizar o CHANGELOG

O arquivo `CHANGELOG.md` segue o padrão Keep a Changelog.

Antes de finalizar seu trabalho, você **deve** adicionar uma entrada na seção `[Unreleased]`.

- Use `Added` para novas funcionalidades.
- Use `Changed` para alterações em funcionalidades existentes.
- Use `Fixed` para correções de bugs.
- Use `Removed` para funcionalidades removidas.

**Exemplo de atualização no `CHANGELOG.md`:**

```markdown
## [Unreleased]

### Fixed

- Corrigido o cálculo de impostos no checkout que não considerava descontos.

### Added

- Adicionado login social com a conta do Google.
```

### Passo 4: Gerar Mensagens de Commit

Suas mensagens de commit **devem** seguir o padrão **Conventional Commits**. Isso é essencial para a automação do versionamento e a clareza do histórico.

**Formato:** `tipo(escopo): descrição curta`

- **`tipo`**:

  - `feat`: Uma nova funcionalidade (corresponde a `Added` no CHANGELOG).
  - `fix`: Uma correção de bug (corresponde a `Fixed` no CHANGELOG).
  - `docs`: Alterações apenas na documentação.
  - `style`: Alterações de formatação, sem impacto no código.
  - `refactor`: Refatoração de código que não corrige bug nem adiciona funcionalidade.
  - `test`: Adição ou correção de testes.
  - `chore`: Manutenção do build, dependências, etc.

- **`escopo`** (opcional): O módulo/componente afetado (ex: `auth`, `payment`, `ui`).

- **`descrição`**: Um resumo conciso da mudança, em letra minúscula.

**Exemplos de boas mensagens de commit:**

```
feat(auth): adicionar funcionalidade de login com google
fix(api): corrigir tratamento de erro para status 500
docs(readme): atualizar instruções de instalação
refactor(services): otimizar consulta de dados do usuário
test(components): adicionar testes para o componente de modal
chore(deps): atualizar versão do vue para 3.2.1
```

## 4. Revisão de Código

A revisão de código é fundamental para manter a qualidade e consistência do projeto.

### Autoavaliação

Antes de submeter qualquer código, faça uma autoavaliação:

- **Funcionalidade:** O código faz exatamente o que foi solicitado?
- **Legibilidade:** Outro desenvolvedor conseguiria entender facilmente?
- **Performance:** Existem gargalos óbvios ou ineficiências?
- **Segurança:** O código está protegido contra vulnerabilidades comuns?
- **Testes:** A cobertura de testes é adequada?

### Revisão Colaborativa

- Sempre solicite revisão de outros agentes ou membros da equipe
- Seja receptivo a feedback e sugestões de melhoria
- Forneça feedback construtivo quando revisar código de outros
- Use comentários específicos e sugestões práticas

## 5. Documentação e Comentários

### Comentários no Código

- **Quando comentar:** Explique o "porquê", não o "como"
- **Funções complexas:** Documente algoritmos não triviais
- **APIs públicas:** Use JSDoc para documentar interfaces públicas
- **Decisões de design:** Explique escolhas arquiteturais importantes

**Exemplo de boa documentação:**

```javascript
/**
 * Calcula o desconto aplicável baseado no histórico do cliente
 * Usa algoritmo de fidelidade que considera compras dos últimos 12 meses
 * @param {Object} customer - Dados do cliente
 * @param {number} orderValue - Valor do pedido atual
 * @returns {number} Percentual de desconto (0-100)
 */
function calculateLoyaltyDiscount(customer, orderValue) {
  // Implementação...
}
```

### Manutenção da Documentação

- Mantenha o README.md atualizado com mudanças significativas
- Atualize comentários quando modificar o código
- Documente APIs e interfaces públicas
- Inclua exemplos de uso quando apropriado

## 6. Resolução de Conflitos

### Conflitos de Merge

Quando encontrar conflitos de merge:

1. **Analise cuidadosamente** as diferenças entre as versões
2. **Comunique-se** com outros desenvolvedores se necessário
3. **Teste thoroughly** após resolver conflitos
4. **Documente** decisões complexas de resolução

### Dependências entre Tarefas

- **Identifique dependências** antes de começar a trabalhar
- **Coordene** com outros agentes trabalhando em tarefas relacionadas
- **Use branches** apropriadas para isolar trabalho em progresso
- **Comunique** mudanças que podem afetar outras tarefas

## 7. Debugging e Troubleshooting

### Estratégias de Debug

- **Logs estruturados:** Use console.log/console.error de forma estratégica
- **Ferramentas de debug:** Aproveite debuggers do navegador/IDE
- **Testes isolados:** Crie testes específicos para reproduzir bugs
- **Documentação de bugs:** Registre passos para reprodução

### Resolução de Problemas

- **Analise logs** de erro cuidadosamente
- **Reproduza** o problema de forma consistente
- **Isole** a causa raiz antes de implementar correções
- **Valide** que a correção resolve o problema sem criar novos

## 8. Princípios Gerais

1. **Autonomia com Responsabilidade:** Você tem autonomia para tomar decisões de implementação, mas é responsável por seguir as diretrizes e garantir a qualidade do seu código.
2. **Segurança em Primeiro Lugar:** Esteja atento a possíveis vulnerabilidades de segurança (XSS, CSRF, etc.) e escreva código defensivo.
3. **Comunicação é Chave:** Ao criar um Pull Request (PR), forneça uma descrição clara das alterações realizadas. Se uma tarefa for muito complexa, divida-a em commits menores e lógicos.
4. **Qualidade sobre Velocidade:** Prefira código bem feito a código rápido. A manutenibilidade é crucial.
5. **Aprendizado Contínuo:** Mantenha-se atualizado com as melhores práticas e tecnologias do projeto.

## 9. Recursos Úteis

### Documentação Oficial

- [Conventional Commits](https://www.conventionalcommits.org/) - Padrão para mensagens de commit
- [Keep a Changelog](https://keepachangelog.com/) - Formato para CHANGELOG.md
- [ESLint](https://eslint.org/) - Ferramenta de linting para JavaScript
- [Prettier](https://prettier.io/) - Formatador de código
- [Jest](https://jestjs.io/) - Framework de testes JavaScript

### Ferramentas de Desenvolvimento

- **Git:** Sistema de controle de versão
- **Node.js:** Runtime JavaScript
- **npm/yarn:** Gerenciadores de pacotes
- **VS Code:** Editor recomendado com extensões úteis

### Boas Práticas

- [Clean Code](https://blog.cleancoder.com/) - Princípios de código limpo
- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID) - Princípios de design de software
- [JavaScript Best Practices](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide) - Guia MDN

## 10. Resumo do Fluxo

### Para Cada Tarefa

1. **Analisar** a tarefa e suas dependências
2. **Planejar** a implementação
3. **Codificar** a solução seguindo as boas práticas
4. **Documentar** código complexo com comentários
5. **Escrever/Atualizar** os testes
6. **Fazer autoavaliação** do código
7. **Atualizar** o `CHANGELOG.md`
8. **Commitar** usando Conventional Commits
9. **Solicitar revisão** de código
10. **Submeter** Pull Request com descrição clara

### Checklist Pré-Commit

- [ ] Código segue padrões do ESLint
- [ ] Testes passam e cobertura é adequada
- [ ] Documentação está atualizada
- [ ] CHANGELOG.md foi atualizado
- [ ] Commit message segue Conventional Commits
- [ ] Autoavaliação foi realizada

---

**Lembre-se:** A qualidade do código é responsabilidade de todos. Sua adesão a estas diretrizes é vital para o sucesso do projeto e para manter um ambiente de desenvolvimento produtivo e colaborativo.

Obrigado por sua contribuição!
