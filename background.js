/**
 * YouTube Links Copier - Background Service Worker
 * Maneja la comunicación entre content script y popup
 */

// Escuchar mensajes del popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getLinksFromTab') {
    // Enviar mensaje al content script de la tab activa
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'extractLinks' }, (response) => {
          if (chrome.runtime.lastError) {
            sendResponse({ 
              success: false, 
              error: 'No se pudo conectar con la página. Recarga la página e inténtalo de nuevo.' 
            });
          } else {
            sendResponse(response);
          }
        });
      } else {
        sendResponse({ success: false, error: 'No hay pestañas activas' });
      }
    });
    return true; // Mantener el canal abierto para respuesta asíncrona
  }
});

console.log('YouTube Links Copier: Background service worker loaded');
