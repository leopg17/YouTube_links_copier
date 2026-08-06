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

/**
 * Extrae el título de un video desde su contenedor.
 * Soporta los elementos de título usados en playlists, búsquedas y grids.
 */
function extractVideoTitle(container) {
  if (!container) return null;

  const getAccessibleTitle = (element) => {
    const title = element.getAttribute?.('title');
    if (title && title.trim()) return title.trim();

    const ariaLabel = element.getAttribute?.('aria-label');
    if (!ariaLabel || !ariaLabel.trim()) return null;

    // Los controles del reproductor para ir al video siguiente/anterior también
    // son enlaces de video, pero su aria-label describe la acción, no el video.
    // No deben impedir que otra aparición del mismo URL aporte el título real.
    const normalizedLabel = ariaLabel.trim();
    const navigationControlPattern = /^(?:siguiente|anterior|next|previous)(?:\s*\([^)]*\))?$/i;
    return navigationControlPattern.test(normalizedLabel) ? null : normalizedLabel;
  };

  // El enlace puede ser el único nodo que conserva el nombre accesible (por
  // ejemplo, en `aria-label`), aunque no sea uno de los nodos de título que
  // conocemos. Comprobar sus atributos antes de buscar en sus descendientes.
  const ownTitle = getAccessibleTitle(container);
  if (ownTitle) return ownTitle;

  // YouTube usa el mismo id tanto en enlaces como en spans, según la vista, y
  // las vistas nuevas encapsulan el título en los view models de lockup.
  const titleSelectors = [
    'a#video-title-link',
    'a#video-title',
    'span#video-title',
    'yt-formatted-string#video-title',
    'yt-lockup-view-model a.yt-lockup-metadata-view-model__title',
    'yt-lockup-view-model .yt-lockup-metadata-view-model__title',
    'yt-lockup-metadata-view-model a.yt-lockup-metadata-view-model__title',
    'yt-lockup-metadata-view-model .yt-lockup-metadata-view-model__title',
    'a.yt-lockup-metadata-view-model__title',
    '.yt-lockup-metadata-view-model__title',
    'h3.yt-lockup-title a',
    '.yt-simple-endpoint.style-scope.ytd-video-meta-block'
  ];

  for (const selector of titleSelectors) {
    const el = container.matches?.(selector) ? container : container.querySelector(selector);
    if (el) {
      const text = getAccessibleTitle(el) || el.textContent;
      if (text && text.trim()) {
        return text.trim();
      }
    }
  }

  return null;
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

    // Extraer título usando la función dedicada. Muchos enlaces encontrados son
    // miniaturas; el título es un elemento hermano dentro del renderer completo.
    let title = extractVideoTitle(link);

    // Si no hay título en el enlace directo, buscar en elementos padre
    if (!title) {
      const parentContainer = link.closest([
        'ytd-rich-item-renderer',
        'ytd-video-renderer',
        'ytd-grid-video-renderer',
        'ytd-compact-video-renderer',
        'ytd-playlist-video-renderer',
        'ytd-playlist-panel-video-renderer',
        'yt-playlist-panel-video-renderer',
        'yt-lockup-view-model',
        'yt-lockup-metadata-view-model',
        'ytd-reel-item-renderer',
        '.playlist-video',
        '.video-thumb'
      ].join(', '));
      if (parentContainer) {
        title = extractVideoTitle(parentContainer);
      }
    }

    // El mismo video suele aparecer varias veces en el DOM (miniatura, título,
    // menú, etc.). Si la primera aparición no tenía título, permitir que una
    // aparición posterior complete el registro en lugar de conservar "Video N".
    if (!videoMap.has(normalizedUrl)) {
      videoMap.set(normalizedUrl, {
        url: normalizedUrl,
        title: title,
        videoId: normalizedUrl.split('v=')[1].split('&')[0] // Extraer solo el videoId sin parámetros adicionales
      });
    } else if (!videoMap.get(normalizedUrl).title && title) {
      videoMap.get(normalizedUrl).title = title;
    }
  });

  // Usar el nombre genérico solo después de haber procesado todas las
  // apariciones del video y agotado las oportunidades de encontrar su título.
  return Array.from(videoMap.values()).map((video, index) => ({
    ...video,
    title: video.title || `Video ${index + 1}`
  }));
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
