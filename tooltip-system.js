// Sistema de tooltips e ajuda contextual
import { logger } from "./logger.js";
const tooltipLogger = logger("[Tooltip]");

/**
 * Sistema de Tooltips e Ajuda Contextual
 * Fornece tooltips informativos e botões de ajuda para elementos da interface
 */
class TooltipSystem {
  constructor() {
    this.tooltips = new Map();
    this.currentTooltip = null;
    this.init();
  }

  /**
   * Inicializa o sistema de tooltips
   */
  init() {
    this.createTooltipStyles();
    this.setupEventListeners();
    tooltipLogger.info("Sistema de tooltips inicializado");
  }

  /**
   * Cria os estilos CSS para tooltips
   */
  createTooltipStyles() {
    if (document.getElementById('tooltip-styles')) return;

    const style = document.createElement('style');
    style.id = 'tooltip-styles';
    style.textContent = `
      .tooltip {
        position: absolute;
        background-color: var(--bg-primary, #ffffff);
        border: 1px solid var(--border-color, #e0e0e0);
        border-radius: var(--radius-md, 8px);
        padding: var(--spacing-md, 12px);
        box-shadow: var(--shadow-heavy, 0 4px 12px rgba(0,0,0,0.15));
        z-index: 10000;
        max-width: 300px;
        font-size: var(--font-size-sm, 14px);
        line-height: 1.4;
        color: var(--text-primary, #333333);
        opacity: 0;
        transform: translateY(-5px);
        transition: opacity 0.2s ease, transform 0.2s ease;
        pointer-events: none;
      }

      .tooltip.show {
        opacity: 1;
        transform: translateY(0);
      }

      .tooltip-title {
        font-weight: bold;
        margin-bottom: var(--spacing-xs, 4px);
        color: var(--text-heading, #1a1a1a);
        font-size: var(--font-size-md, 16px);
      }

      .tooltip-content {
        margin-bottom: var(--spacing-sm, 8px);
      }

      .tooltip-tip {
        background-color: var(--primary-color, #2196f3);
        color: white;
        padding: var(--spacing-xs, 4px) var(--spacing-sm, 8px);
        border-radius: var(--radius-sm, 4px);
        font-size: var(--font-size-xs, 12px);
        margin-top: var(--spacing-xs, 4px);
      }

      .tooltip-arrow {
        position: absolute;
        width: 0;
        height: 0;
        border-style: solid;
      }

      .tooltip-arrow.top {
        bottom: -8px;
        left: 50%;
        transform: translateX(-50%);
        border-width: 8px 8px 0 8px;
        border-color: var(--bg-primary, #ffffff) transparent transparent transparent;
      }

      .tooltip-arrow.bottom {
        top: -8px;
        left: 50%;
        transform: translateX(-50%);
        border-width: 0 8px 8px 8px;
        border-color: transparent transparent var(--bg-primary, #ffffff) transparent;
      }

      .tooltip-arrow.left {
        right: -8px;
        top: 50%;
        transform: translateY(-50%);
        border-width: 8px 0 8px 8px;
        border-color: transparent transparent transparent var(--bg-primary, #ffffff);
      }

      .tooltip-arrow.right {
        left: -8px;
        top: 50%;
        transform: translateY(-50%);
        border-width: 8px 8px 8px 0;
        border-color: transparent var(--bg-primary, #ffffff) transparent transparent;
      }

      .help-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background-color: var(--primary-color, #2196f3);
        color: white;
        border: none;
        cursor: pointer;
        font-size: 12px;
        font-weight: bold;
        margin-left: var(--spacing-xs, 4px);
        transition: all 0.2s ease;
        vertical-align: middle;
      }

      .help-button:hover {
        background-color: var(--primary-hover, #1976d2);
        transform: scale(1.1);
      }

      .help-button:active {
        transform: scale(0.95);
      }

      .help-button.large {
        width: 24px;
        height: 24px;
        font-size: 14px;
      }

      .help-section-button {
        background-color: var(--warning-color, #ff9800);
        color: white;
        border: none;
        padding: var(--spacing-xs, 4px) var(--spacing-sm, 8px);
        border-radius: var(--radius-sm, 4px);
        cursor: pointer;
        font-size: var(--font-size-xs, 12px);
        margin-left: var(--spacing-sm, 8px);
        transition: all 0.2s ease;
      }

      .help-section-button:hover {
        background-color: var(--warning-hover, #f57c00);
        transform: translateY(-1px);
      }

      .contextual-help {
        background-color: var(--bg-tertiary, #f5f5f5);
        border: 1px solid var(--border-light, #e8e8e8);
        border-radius: var(--radius-md, 8px);
        padding: var(--spacing-md, 12px);
        margin: var(--spacing-md, 12px) 0;
        font-size: var(--font-size-sm, 14px);
        color: var(--text-secondary, #666666);
      }

      .contextual-help-title {
        font-weight: bold;
        color: var(--text-primary, #333333);
        margin-bottom: var(--spacing-xs, 4px);
      }

      .contextual-help-icon {
        color: var(--primary-color, #2196f3);
        margin-right: var(--spacing-xs, 4px);
      }
    `;

    document.head.appendChild(style);
  }

  /**
   * Configura event listeners globais
   */
  setupEventListeners() {
    // Fecha tooltip ao clicar fora
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.tooltip') && !e.target.hasAttribute('data-tooltip')) {
        this.hideTooltip();
      }
    });

    // Fecha tooltip ao pressionar ESC
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.hideTooltip();
      }
    });

    // Reposiciona tooltip ao redimensionar janela
    window.addEventListener('resize', () => {
      if (this.currentTooltip) {
        this.hideTooltip();
      }
    });
  }

  /**
   * Adiciona tooltip a um elemento
   * @param {HTMLElement} element - Elemento que receberá o tooltip
   * @param {Object} config - Configuração do tooltip
   */
  addTooltip(element, config) {
    const tooltipId = this.generateTooltipId();
    
    const tooltipConfig = {
      id: tooltipId,
      title: config.title || '',
      content: config.content || '',
      tip: config.tip || '',
      position: config.position || 'top',
      trigger: config.trigger || 'hover',
      delay: config.delay || 300,
      ...config
    };

    this.tooltips.set(element, tooltipConfig);
    element.setAttribute('data-tooltip-id', tooltipId);

    // Configura event listeners baseado no trigger
    if (tooltipConfig.trigger === 'hover') {
      element.addEventListener('mouseenter', () => this.showTooltip(element));
      element.addEventListener('mouseleave', () => this.hideTooltip());
    } else if (tooltipConfig.trigger === 'click') {
      element.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggleTooltip(element);
      });
    }

    tooltipLogger.debug(`Tooltip adicionado ao elemento: ${tooltipId}`);
  }

  /**
   * Mostra tooltip para um elemento
   * @param {HTMLElement} element - Elemento que possui o tooltip
   */
  showTooltip(element) {
    const config = this.tooltips.get(element);
    if (!config) return;

    // Esconde tooltip atual se existir
    this.hideTooltip();

    const tooltip = this.createTooltipElement(config);
    document.body.appendChild(tooltip);

    // Posiciona o tooltip
    this.positionTooltip(tooltip, element, config.position);

    // Mostra o tooltip com animação
    setTimeout(() => {
      tooltip.classList.add('show');
    }, 10);

    this.currentTooltip = tooltip;
    tooltipLogger.debug(`Tooltip mostrado: ${config.id}`);
  }

  /**
   * Esconde o tooltip atual
   */
  hideTooltip() {
    if (this.currentTooltip) {
      this.currentTooltip.classList.remove('show');
      setTimeout(() => {
        if (this.currentTooltip && this.currentTooltip.parentNode) {
          this.currentTooltip.parentNode.removeChild(this.currentTooltip);
        }
        this.currentTooltip = null;
      }, 200);
    }
  }

  /**
   * Alterna visibilidade do tooltip
   * @param {HTMLElement} element - Elemento que possui o tooltip
   */
  toggleTooltip(element) {
    if (this.currentTooltip) {
      this.hideTooltip();
    } else {
      this.showTooltip(element);
    }
  }

  /**
   * Cria elemento HTML do tooltip
   * @param {Object} config - Configuração do tooltip
   * @returns {HTMLElement} Elemento do tooltip
   */
  createTooltipElement(config) {
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.setAttribute('data-tooltip-id', config.id);

    let content = '';
    
    if (config.title) {
      content += `<div class="tooltip-title">${config.title}</div>`;
    }
    
    if (config.content) {
      content += `<div class="tooltip-content">${config.content}</div>`;
    }
    
    if (config.tip) {
      content += `<div class="tooltip-tip">💡 ${config.tip}</div>`;
    }

    tooltip.innerHTML = content;

    // Adiciona seta
    const arrow = document.createElement('div');
    arrow.className = `tooltip-arrow ${config.position}`;
    tooltip.appendChild(arrow);

    return tooltip;
  }

  /**
   * Posiciona o tooltip em relação ao elemento
   * @param {HTMLElement} tooltip - Elemento do tooltip
   * @param {HTMLElement} element - Elemento de referência
   * @param {string} position - Posição desejada
   */
  positionTooltip(tooltip, element, position) {
    const elementRect = element.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    
    let top, left;

    switch (position) {
      case 'top':
        top = elementRect.top - tooltipRect.height - 10;
        left = elementRect.left + (elementRect.width / 2) - (tooltipRect.width / 2);
        break;
      case 'bottom':
        top = elementRect.bottom + 10;
        left = elementRect.left + (elementRect.width / 2) - (tooltipRect.width / 2);
        break;
      case 'left':
        top = elementRect.top + (elementRect.height / 2) - (tooltipRect.height / 2);
        left = elementRect.left - tooltipRect.width - 10;
        break;
      case 'right':
        top = elementRect.top + (elementRect.height / 2) - (tooltipRect.height / 2);
        left = elementRect.right + 10;
        break;
      default:
        top = elementRect.top - tooltipRect.height - 10;
        left = elementRect.left + (elementRect.width / 2) - (tooltipRect.width / 2);
    }

    // Ajusta para não sair da tela
    const margin = 10;
    if (left < margin) left = margin;
    if (left + tooltipRect.width > window.innerWidth - margin) {
      left = window.innerWidth - tooltipRect.width - margin;
    }
    if (top < margin) top = margin;
    if (top + tooltipRect.height > window.innerHeight - margin) {
      top = window.innerHeight - tooltipRect.height - margin;
    }

    tooltip.style.top = `${top + window.scrollY}px`;
    tooltip.style.left = `${left + window.scrollX}px`;
  }

  /**
   * Gera ID único para tooltip
   * @returns {string} ID único
   */
  generateTooltipId() {
    return `tooltip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cria botão de ajuda
   * @param {Object} config - Configuração do botão
   * @returns {HTMLElement} Elemento do botão
   */
  createHelpButton(config = {}) {
    const button = document.createElement('button');
    button.className = `help-button ${config.size === 'large' ? 'large' : ''}`;
    button.innerHTML = config.icon || '?';
    button.title = config.title || 'Clique para obter ajuda';
    button.type = 'button';

    if (config.tooltip) {
      this.addTooltip(button, {
        ...config.tooltip,
        trigger: 'click'
      });
    }

    return button;
  }

  /**
   * Cria botão de ajuda para seção
   * @param {Object} config - Configuração do botão
   * @returns {HTMLElement} Elemento do botão
   */
  createSectionHelpButton(config = {}) {
    const button = document.createElement('button');
    button.className = 'help-section-button';
    button.innerHTML = `${config.icon || '❓'} ${config.text || 'Ajuda'}`;
    button.type = 'button';

    if (config.onClick) {
      button.addEventListener('click', config.onClick);
    }

    return button;
  }

  /**
   * Cria elemento de ajuda contextual
   * @param {Object} config - Configuração da ajuda
   * @returns {HTMLElement} Elemento de ajuda
   */
  createContextualHelp(config = {}) {
    const helpDiv = document.createElement('div');
    helpDiv.className = 'contextual-help';

    let content = '';
    if (config.title) {
      content += `<div class="contextual-help-title">
        <span class="contextual-help-icon">${config.icon || 'ℹ️'}</span>
        ${config.title}
      </div>`;
    }
    
    if (config.content) {
      content += config.content;
    }

    helpDiv.innerHTML = content;
    return helpDiv;
  }

  /**
   * Remove tooltip de um elemento
   * @param {HTMLElement} element - Elemento que possui o tooltip
   */
  removeTooltip(element) {
    if (this.tooltips.has(element)) {
      this.tooltips.delete(element);
      element.removeAttribute('data-tooltip-id');
      tooltipLogger.debug("Tooltip removido do elemento");
    }
  }

  /**
   * Limpa todos os tooltips
   */
  clearAllTooltips() {
    this.hideTooltip();
    this.tooltips.clear();
    tooltipLogger.info("Todos os tooltips foram limpos");
  }
}

// Instância global do sistema de tooltips
const tooltipSystem = new TooltipSystem();

// Exporta a instância e a classe
export { tooltipSystem, TooltipSystem };