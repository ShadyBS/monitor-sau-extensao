// Importa o logger e o instancia para o contexto da ajuda
import { logger } from "./logger.js";
const helpLogger = logger("[Help]");

// Define o objeto de API do navegador de forma compatível (Chrome ou Firefox)
const browserAPI = globalThis.browser || globalThis.chrome;

// Inicialização quando o DOM estiver carregado
document.addEventListener("DOMContentLoaded", initializeHelp);

/**
 * Inicializa o sistema de ajuda
 */
function initializeHelp() {
  helpLogger.info("Inicializando sistema de ajuda");
  
  // Configura navegação entre seções
  setupNavigation();
  
  // Configura botões de ação
  setupActionButtons();
  
  // Verifica se deve mostrar tour para novos usuários
  checkFirstTimeUser();
}

/**
 * Configura a navegação entre seções
 */
function setupNavigation() {
  const navButtons = document.querySelectorAll('.nav-btn');
  const sections = document.querySelectorAll('.help-section');
  
  navButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetSection = button.dataset.section;
      
      // Remove classe active de todos os botões e seções
      navButtons.forEach(btn => btn.classList.remove('active'));
      sections.forEach(section => section.classList.remove('active'));
      
      // Adiciona classe active ao botão e seção clicados
      button.classList.add('active');
      document.getElementById(targetSection).classList.add('active');
      
      helpLogger.info(`Navegando para seção: ${targetSection}`);
    });
  });
}

/**
 * Configura os botões de ação do footer
 */
function setupActionButtons() {
  // Botão de iniciar tour
  const startTourBtn = document.getElementById('startTour');
  if (startTourBtn) {
    startTourBtn.addEventListener('click', startGuidedTour);
  }
  
  // Botão de fechar ajuda
  const closeHelpBtn = document.getElementById('closeHelp');
  if (closeHelpBtn) {
    closeHelpBtn.addEventListener('click', closeHelp);
  }
}

/**
 * Verifica se é a primeira vez do usuário e oferece tour
 */
async function checkFirstTimeUser() {
  try {
    const data = await browserAPI.storage.local.get(['helpTourCompleted', 'firstTimeUser']);
    
    // Se é primeira vez e ainda não fez o tour
    if (!data.helpTourCompleted && (data.firstTimeUser !== false)) {
      showFirstTimeWelcome();
    }
  } catch (error) {
    helpLogger.error("Erro ao verificar status de primeiro uso:", error);
  }
}

/**
 * Mostra mensagem de boas-vindas para novos usuários
 */
function showFirstTimeWelcome() {
  const welcomeModal = createWelcomeModal();
  document.body.appendChild(welcomeModal);
  
  // Auto-remove após 5 segundos se não interagir
  setTimeout(() => {
    if (welcomeModal.parentNode) {
      welcomeModal.remove();
    }
  }, 10000);
}

/**
 * Cria modal de boas-vindas
 */
function createWelcomeModal() {
  const modal = document.createElement('div');
  modal.className = 'welcome-modal';
  modal.innerHTML = `
    <div class="welcome-content">
      <h3>🎉 Bem-vindo ao Monitor SAU!</h3>
      <p>Parece que é sua primeira vez usando a extensão. Que tal fazer um tour rápido para conhecer todas as funcionalidades?</p>
      <div class="welcome-actions">
        <button class="btn-primary" onclick="startGuidedTour(); this.closest('.welcome-modal').remove();">
          🎯 Sim, fazer o tour!
        </button>
        <button class="btn-secondary" onclick="skipTour(); this.closest('.welcome-modal').remove();">
          ⏭️ Pular por agora
        </button>
      </div>
    </div>
  `;
  
  // Adiciona estilos inline para o modal
  const style = document.createElement('style');
  style.textContent = `
    .welcome-modal {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      animation: fadeIn 0.3s ease-in-out;
    }
    
    .welcome-content {
      background-color: var(--bg-primary);
      border-radius: var(--radius-lg);
      padding: var(--spacing-xl);
      max-width: 400px;
      text-align: center;
      box-shadow: var(--shadow-heavy);
      border: 1px solid var(--border-color);
    }
    
    .welcome-content h3 {
      margin: 0 0 var(--spacing-md) 0;
      color: var(--text-heading);
      font-size: 1.5rem;
    }
    
    .welcome-content p {
      margin: 0 0 var(--spacing-lg) 0;
      color: var(--text-primary);
      line-height: 1.5;
    }
    
    .welcome-actions {
      display: flex;
      gap: var(--spacing-md);
      justify-content: center;
    }
    
    .welcome-actions button {
      padding: var(--spacing-md) var(--spacing-lg);
      border: none;
      border-radius: var(--radius-md);
      cursor: pointer;
      font-size: var(--font-size-md);
      transition: all var(--transition-normal);
    }
  `;
  
  document.head.appendChild(style);
  return modal;
}

/**
 * Inicia o tour guiado
 */
async function startGuidedTour() {
  helpLogger.info("Iniciando tour guiado");
  
  // Marca que o usuário iniciou o tour
  try {
    await browserAPI.storage.local.set({ 
      helpTourStarted: true,
      firstTimeUser: false 
    });
  } catch (error) {
    helpLogger.error("Erro ao salvar status do tour:", error);
  }
  
  // Se estamos na página de ajuda, inicia tour aqui
  if (window.location.pathname.includes('help.html')) {
    startHelpPageTour();
  } else {
    // Se não, redireciona para popup e inicia tour lá
    redirectToPopupTour();
  }
}

/**
 * Inicia tour na página de ajuda
 */
function startHelpPageTour() {
  const tourSteps = [
    {
      element: '.help-nav',
      title: '📋 Navegação',
      content: 'Use estas abas para navegar entre as diferentes seções da ajuda.',
      position: 'bottom'
    },
    {
      element: '#getting-started',
      title: '🚀 Primeiros Passos',
      content: 'Comece aqui! Esta seção te guia pela configuração inicial da extensão.',
      position: 'top'
    },
    {
      element: '[data-section="configuration"]',
      title: '⚙️ Configurações',
      content: 'Clique aqui para aprender sobre todas as opções de configuração disponíveis.',
      position: 'bottom'
    },
    {
      element: '[data-section="features"]',
      title: '✨ Funcionalidades',
      content: 'Descubra todas as funcionalidades poderosas da extensão.',
      position: 'bottom'
    },
    {
      element: '#startTour',
      title: '🎯 Tour Guiado',
      content: 'Você pode sempre voltar aqui para refazer o tour ou ajudar outros usuários.',
      position: 'top'
    }
  ];
  
  runTour(tourSteps);
}

/**
 * Redireciona para o popup e inicia tour lá
 */
function redirectToPopupTour() {
  // Fecha a página de ajuda
  window.close();
  
  // Envia mensagem para o background script iniciar tour no popup
  browserAPI.runtime.sendMessage({ 
    action: "startPopupTour" 
  });
}

/**
 * Executa um tour com os passos fornecidos
 */
function runTour(steps) {
  let currentStep = 0;
  const overlay = createTourOverlay();
  document.body.appendChild(overlay);
  
  function showStep(stepIndex) {
    if (stepIndex >= steps.length) {
      completeTour();
      return;
    }
    
    const step = steps[stepIndex];
    const element = document.querySelector(step.element);
    
    if (!element) {
      helpLogger.warn(`Elemento não encontrado para o passo ${stepIndex}: ${step.element}`);
      showStep(stepIndex + 1);
      return;
    }
    
    // Cria spotlight no elemento
    createSpotlight(element);
    
    // Cria tooltip
    createTooltip(element, step, stepIndex, steps.length);
    
    overlay.classList.add('active');
  }
  
  function nextStep() {
    currentStep++;
    showStep(currentStep);
  }
  
  function prevStep() {
    if (currentStep > 0) {
      currentStep--;
      showStep(currentStep);
    }
  }
  
  function completeTour() {
    overlay.remove();
    markTourCompleted();
    showTourCompletedMessage();
  }
  
  // Expõe funções para os botões do tour
  window.tourNext = nextStep;
  window.tourPrev = prevStep;
  window.tourSkip = completeTour;
  
  // Inicia o tour
  showStep(0);
}

/**
 * Cria overlay para o tour
 */
function createTourOverlay() {
  const overlay = document.createElement('div');
  overlay.className = 'tour-overlay';
  return overlay;
}

/**
 * Cria spotlight em um elemento
 */
function createSpotlight(element) {
  // Remove spotlight anterior
  const existingSpotlight = document.querySelector('.tour-spotlight');
  if (existingSpotlight) {
    existingSpotlight.remove();
  }
  
  const rect = element.getBoundingClientRect();
  const spotlight = document.createElement('div');
  spotlight.className = 'tour-spotlight';
  spotlight.style.top = `${rect.top - 5}px`;
  spotlight.style.left = `${rect.left - 5}px`;
  spotlight.style.width = `${rect.width + 10}px`;
  spotlight.style.height = `${rect.height + 10}px`;
  
  document.body.appendChild(spotlight);
}

/**
 * Cria tooltip para um passo do tour
 */
function createTooltip(element, step, stepIndex, totalSteps) {
  // Remove tooltip anterior
  const existingTooltip = document.querySelector('.tour-tooltip');
  if (existingTooltip) {
    existingTooltip.remove();
  }
  
  const tooltip = document.createElement('div');
  tooltip.className = 'tour-tooltip';
  
  const rect = element.getBoundingClientRect();
  let top, left;
  
  // Posiciona tooltip baseado na posição preferida
  if (step.position === 'bottom') {
    top = rect.bottom + 15;
    left = rect.left;
  } else if (step.position === 'top') {
    top = rect.top - 150; // Altura estimada do tooltip
    left = rect.left;
  } else {
    top = rect.top;
    left = rect.right + 15;
  }
  
  // Ajusta se sair da tela
  if (left + 300 > window.innerWidth) {
    left = window.innerWidth - 320;
  }
  if (top < 0) {
    top = 10;
  }
  
  tooltip.style.top = `${top}px`;
  tooltip.style.left = `${left}px`;
  
  tooltip.innerHTML = `
    <h4>${step.title}</h4>
    <p>${step.content}</p>
    <div class="tour-controls">
      ${stepIndex > 0 ? '<button class="tour-btn-prev" onclick="tourPrev()">← Anterior</button>' : ''}
      <button class="tour-btn-skip" onclick="tourSkip()">Pular Tour</button>
      <button class="tour-btn-next" onclick="tourNext()">
        ${stepIndex === totalSteps - 1 ? 'Finalizar' : 'Próximo →'}
      </button>
    </div>
    <div style="text-align: center; margin-top: 10px; font-size: 0.8rem; color: var(--text-muted);">
      ${stepIndex + 1} de ${totalSteps}
    </div>
  `;
  
  document.body.appendChild(tooltip);
}

/**
 * Marca o tour como completado
 */
async function markTourCompleted() {
  try {
    await browserAPI.storage.local.set({ 
      helpTourCompleted: true,
      helpTourCompletedAt: new Date().toISOString()
    });
    helpLogger.info("Tour marcado como completado");
  } catch (error) {
    helpLogger.error("Erro ao marcar tour como completado:", error);
  }
}

/**
 * Mostra mensagem de tour completado
 */
function showTourCompletedMessage() {
  const message = document.createElement('div');
  message.className = 'tour-completed-message';
  message.innerHTML = `
    <div class="message-content">
      <h3>🎉 Tour Completado!</h3>
      <p>Agora você conhece todas as funcionalidades da extensão. Aproveite!</p>
      <button class="btn-primary" onclick="this.parentElement.parentElement.remove()">
        ✅ Entendi!
      </button>
    </div>
  `;
  
  // Adiciona estilos
  const style = document.createElement('style');
  style.textContent = `
    .tour-completed-message {
      position: fixed;
      top: 20px;
      right: 20px;
      background-color: var(--success-color);
      color: white;
      padding: var(--spacing-lg);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-heavy);
      z-index: 10000;
      animation: slideInRight 0.3s ease-in-out;
    }
    
    .message-content h3 {
      margin: 0 0 var(--spacing-sm) 0;
      font-size: 1.2rem;
    }
    
    .message-content p {
      margin: 0 0 var(--spacing-md) 0;
    }
    
    .message-content button {
      background-color: rgba(255, 255, 255, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.3);
      color: white;
      padding: var(--spacing-sm) var(--spacing-md);
      border-radius: var(--radius-md);
      cursor: pointer;
    }
    
    @keyframes slideInRight {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `;
  
  document.head.appendChild(style);
  document.body.appendChild(message);
  
  // Remove automaticamente após 5 segundos
  setTimeout(() => {
    if (message.parentNode) {
      message.remove();
    }
  }, 5000);
}

/**
 * Pula o tour e marca como não interessado
 */
async function skipTour() {
  try {
    await browserAPI.storage.local.set({ 
      helpTourSkipped: true,
      firstTimeUser: false 
    });
    helpLogger.info("Tour pulado pelo usuário");
  } catch (error) {
    helpLogger.error("Erro ao marcar tour como pulado:", error);
  }
}

/**
 * Fecha a página de ajuda
 */
function closeHelp() {
  helpLogger.info("Fechando página de ajuda");
  
  // Se foi aberta como popup/tab, fecha
  if (window.opener || window.history.length === 1) {
    window.close();
  } else {
    // Se não conseguir fechar, volta para a página anterior
    window.history.back();
  }
}

// Expõe funções globais para serem acessíveis pelos botões
window.startGuidedTour = startGuidedTour;
window.skipTour = skipTour;
window.closeHelp = closeHelp;