/**
 * YouTube Links Copier - Content Script
 * Detecta enlaces de YouTube en la página y los extrae
 */

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

// Escuchar mensajes del popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractLinks') {
    const videos = extractYouTubeLinks();
    const playlistId = getCurrentPlaylistId();
    sendResponse({ 
      success: true, 
      videos: videos,
      playlistId: playlistId
    });
  }
  return true; // Mantener el canal abierto para respuesta asíncrona
});

// Enviar señal de que el content script está listo
console.log('YouTube Links Copier: Content script loaded');
