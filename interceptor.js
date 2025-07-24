// interceptor.js
// Este script é injetado no 'world: MAIN' e tem como ÚNICA responsabilidade
// interceptar a resposta da requisição AJAX de tarefas e enviá-la para o content script.

(function () {
  // Injection guard para o interceptor
  if (window.sauInterceptorHasInjected) {
    return;
  }
  window.sauInterceptorHasInjected = true;

  const SAU_TASK_SEARCH_URL =
    "https://egov.santos.sp.gov.br/sau/ajax/pesquisar_Tarefa.sau";
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url) {
    this._url = url;
    originalOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function () {
    if (this._url && this._url.includes(SAU_TASK_SEARCH_URL)) {
      this.addEventListener("load", function () {
        if (this.status === 200) {
          // Envia a resposta para o content script através de um evento de window.
          // Esta é a ponte de comunicação entre o 'MAIN world' e o 'ISOLATED world'.
          // Usa origin específica em vez de "*" para segurança
          window.postMessage(
            {
              type: "SAU_TASKS_RESPONSE",
              htmlContent: this.responseText,
              timestamp: Date.now(), // Adiciona timestamp para validação
            },
            window.location.origin
          );
        }
      });
    }
    originalSend.apply(this, arguments);
  };
})();