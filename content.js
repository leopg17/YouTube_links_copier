/**
 * YouTube Links Copier - Content Script
 * Detecta enlaces de YouTube en la página y los extrae
 */

let isScanning = false;
let scanComplete = false;
let lastVideoCount = 0;

// Función para obtener el ID de playlist de la URL actual
function getCurrentPlaylistId() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('list');
  } catch (e) {
    return null;
  }
}

// Función para normalizar URLs de YouTube a formato estándar
function normalizeYouTubeUrl(url, targetPlaylistId = null) {
  try {
    const urlObj = new URL(url);
    let videoId = null;
    let playlistId = urlObj.searchParams.get('list');
    
    // Manejar diferentes formatos de URL de YouTube
    const hostname = urlObj.hostname.replace('www.', '').replace('m.', '');
    const pathname = urlObj.pathname;
    const searchParams = urlObj.searchParams;
    
    // Formato: youtube.com/watch?v=VIDEO_ID
    if (pathname === '/watch' && searchParams.has('v')) {
      videoId = searchParams.get('v');
    }
    // Formato: youtu.be/VIDEO_ID
    else if (hostname === 'youtu.be') {
      videoId = pathname.substring(1);
      // youtu.be puede tener list= como parámetro
      playlistId = searchParams.get('list') || playlistId;
    }
    // Formato: youtube.com/shorts/VIDEO_ID
    else if (pathname.startsWith('/shorts/')) {
      videoId = pathname.split('/')[2];
    }
    // Formato: youtube.com/embed/VIDEO_ID
    else if (pathname.startsWith('/embed/')) {
      videoId = pathname.split('/')[2];
      playlistId = searchParams.get('list') || playlistId;
    }
    // Formato: youtube.com/v/VIDEO_ID (legacy)
    else if (pathname.startsWith('/v/')) {
      videoId = pathname.split('/')[2];
    }
    
    if (videoId && videoId.length >= 11) {
      // Tomar solo los primeros 11 caracteres (ID estándar de YouTube)
      videoId = videoId.substring(0, 11);
      
      // Si estamos filtrando por playlist y este enlace no tiene la playlist correcta
      if (targetPlaylistId && playlistId !== targetPlaylistId) {
        return null;
      }
      
      // Construir URL con playlist si existe
      let normalizedUrl = `https://www.youtube.com/watch?v=${videoId}`;
      if (playlistId) {
        normalizedUrl += `&list=${playlistId}`;
      }
      
      return normalizedUrl;
    }
    
    return null;
  } catch (e) {
    return null;
  }
}

// Función para extraer todos los enlaces de YouTube de la página
function extractYouTubeLinks() {
  const links = document.querySelectorAll('a[href]');
  const videoMap = new Map(); // Usar Map para evitar duplicados
  
  // Obtener el ID de playlist actual si estamos en una playlist
  const currentPlaylistId = getCurrentPlaylistId();
  
  links.forEach(link => {
    const href = link.href;
    if (!href) return;
    
    const normalizedUrl = normalizeYouTubeUrl(href, currentPlaylistId);
    if (!normalizedUrl) return;
    
    // Extraer título si está disponible
    let title = '';
    const titleElement = link.querySelector('#video-title, .yt-simple-endpoint, a[title]');
    if (titleElement) {
      title = titleElement.textContent?.trim() || '';
    }
    
    // Si no hay título en el enlace, buscar en elementos padre
    if (!title) {
      const parentTitle = link.closest('ytd-thumbnail, .video-thumb, .playlist-video')
        ?.querySelector('#video-title, .yt-simple-endpoint')
        ?.textContent?.trim();
      if (parentTitle) {
        title = parentTitle;
      }
    }
    
    // Si aún no hay título, usar un título genérico
    if (!title) {
      title = `Video ${videoMap.size + 1}`;
    }
    
    // Guardar en el mapa (elimina duplicados automáticamente)
    if (!videoMap.has(normalizedUrl)) {
      videoMap.set(normalizedUrl, {
        url: normalizedUrl,
        title: title,
        videoId: normalizedUrl.split('v=')[1].split('&')[0] // Extraer solo el videoId sin parámetros adicionales
      });
    }
  });
  
  return Array.from(videoMap.values());
}

// Función para esperar a que YouTube cargue el contenido dinámico
async function waitForContentLoad(maxWaitTime = 5000) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const checkInterval = 500;
    
    function checkContent() {
      const currentCount = document.querySelectorAll('a[href*="/watch"], a[href*="/shorts"], a[href*="youtu.be"]').length;
      
      // Si han pasado más de 2 segundos y el conteo no ha cambiado, considerar completo
      if (Date.now() - startTime > 2000 && currentCount === lastVideoCount) {
        scanComplete = true;
        resolve();
        return;
      }
      
      // Si hemos esperado lo suficiente
      if (Date.now() - startTime > maxWaitTime) {
        scanComplete = true;
        resolve();
        return;
      }
      
      lastVideoCount = currentCount;
      setTimeout(checkContent, checkInterval);
    }
    
    checkContent();
  });
}

// Observador de Mutación para detectar contenido dinámico
function setupMutationObserver() {
  const observer = new MutationObserver((mutations) => {
    // Solo actuar si estamos escaneando activamente
    if (isScanning) return;
    
    let hasRelevantChanges = false;
    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        hasRelevantChanges = true;
        break;
      }
    }
    
    if (hasRelevantChanges) {
      // Resetear el estado de completado cuando hay nuevos nodos
      scanComplete = false;
    }
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  return observer;
}

// Escuchar mensajes del popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractLinks') {
    isScanning = true;
    
    // Configurar observador de mutaciones
    const observer = setupMutationObserver();
    
    // Esperar a que el contenido se cargue completamente
    waitForContentLoad(3000).then(async () => {
      isScanning = false;
      observer.disconnect();
      
      const videos = extractYouTubeLinks();
      const playlistId = getCurrentPlaylistId();
      
      console.log(`YouTube Links Copier: Encontrados ${videos.length} videos${playlistId ? ` en playlist ${playlistId}` : ''}`);
      
      sendResponse({ 
        success: true, 
        videos: videos,
        playlistId: playlistId
      });
    });
    
    return true; // Mantener el canal abierto para respuesta asíncrona
  }
  return true;
});

// Enviar señal de que el content script está listo
console.log('YouTube Links Copier: Content script loaded');

// Auto-escanear cuando la página termina de cargar (útil para playlists)
window.addEventListener('load', () => {
  console.log('YouTube Links Copier: Página cargada, esperando contenido dinámico...');
  setTimeout(() => {
    const count = document.querySelectorAll('a[href*="/watch"], a[href*="/shorts"]').length;
    console.log(`YouTube Links Copier: ${count} enlaces de video detectados inicialmente`);
  }, 2000);
});
