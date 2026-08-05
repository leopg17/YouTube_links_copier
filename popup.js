/**
 * YouTube Links Copier - Popup Script
 * Maneja la lógica de la interfaz del popup
 */

let currentVideos = [];
let currentPlaylistId = null;

// Elementos del DOM
const videoListEl = document.getElementById('videoList');
const videoCountEl = document.getElementById('videoCount');
const selectedCountEl = document.getElementById('selectedCount');
const refreshBtn = document.getElementById('refreshBtn');
const selectAllBtn = document.getElementById('selectAllBtn');
const deselectAllBtn = document.getElementById('deselectAllBtn');
const copyBtn = document.getElementById('copyBtn');
const copyWithTitleCheckbox = document.getElementById('copyWithTitle');
const fallbackModal = document.getElementById('fallbackModal');
const fallbackTextEl = document.getElementById('fallbackText');
const closeModalBtn = document.getElementById('closeModalBtn');
const copyFromFallbackBtn = document.getElementById('copyFromFallbackBtn');
const errorMessageEl = document.getElementById('errorMessage');
const successMessageEl = document.getElementById('successMessage');
const playlistInfoEl = document.getElementById('playlistInfo');
const playlistIdDisplayEl = document.getElementById('playlistIdDisplay');

// Inicializar el popup
document.addEventListener('DOMContentLoaded', () => {
  loadVideos();
  
  // Event listeners
  refreshBtn.addEventListener('click', loadVideos);
  selectAllBtn.addEventListener('click', selectAllVideos);
  deselectAllBtn.addEventListener('click', deselectAllVideos);
  copyBtn.addEventListener('click', copySelectedVideos);
  closeModalBtn.addEventListener('click', closeFallbackModal);
  copyFromFallbackBtn.addEventListener('click', copyFromFallback);
});

// Cargar videos desde la página actual
async function loadVideos() {
  showLoading();
  hideError();
  hideSuccess();
  
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getLinksFromTab' });
    
    if (response && response.success) {
      currentVideos = response.videos || [];
      currentPlaylistId = response.playlistId || null;
      
      // Mostrar información de la playlist si existe
      updatePlaylistInfo();
      
      renderVideoList();
      updateStats();
      
      if (currentVideos.length === 0) {
        showNoVideos();
      }
    } else {
      showError(response?.error || 'Error al cargar los videos');
      videoListEl.innerHTML = '<div class="no-videos">No se pudieron cargar los videos</div>';
    }
  } catch (error) {
    console.error('Error loading videos:', error);
    showError('Error de conexión. Asegúrate de estar en una página de YouTube.');
    videoListEl.innerHTML = '<div class="no-videos">Error al conectar con YouTube</div>';
  }
}

// Actualizar información de la playlist
function updatePlaylistInfo() {
  if (currentPlaylistId) {
    playlistIdDisplayEl.textContent = currentPlaylistId;
    playlistInfoEl.classList.remove('hidden');
  } else {
    playlistInfoEl.classList.add('hidden');
  }
}

// Renderizar la lista de videos
function renderVideoList() {
  if (currentVideos.length === 0) {
    videoListEl.innerHTML = '<div class="no-videos">No se encontraron videos de YouTube en esta página</div>';
    return;
  }
  
  videoListEl.innerHTML = currentVideos.map((video, index) => `
    <div class="video-item" data-index="${index}">
      <input type="checkbox" checked data-index="${index}" class="video-checkbox">
      <div class="video-item-content">
        <div class="video-title" title="${escapeHtml(video.title)}">${escapeHtml(video.title)}</div>
        <div class="video-url">${escapeHtml(video.url)}</div>
      </div>
    </div>
  `).join('');
  
  // Añadir event listeners a los checkboxes
  document.querySelectorAll('.video-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', updateStats);
  });
}

// Actualizar estadísticas
function updateStats() {
  const totalVideos = currentVideos.length;
  const selectedVideos = document.querySelectorAll('.video-checkbox:checked').length;
  
  videoCountEl.textContent = `${totalVideos} video${totalVideos !== 1 ? 's' : ''} encontrado${totalVideos !== 1 ? 's' : ''}`;
  selectedCountEl.textContent = `${selectedVideos} seleccionado${selectedVideos !== 1 ? 's' : ''}`;
  
  // Deshabilitar botón de copiar si no hay videos seleccionados
  copyBtn.disabled = selectedVideos === 0;
  copyBtn.style.opacity = selectedVideos === 0 ? '0.6' : '1';
  copyBtn.style.cursor = selectedVideos === 0 ? 'not-allowed' : 'pointer';
}

// Seleccionar todos los videos
function selectAllVideos() {
  document.querySelectorAll('.video-checkbox').forEach(checkbox => {
    checkbox.checked = true;
  });
  updateStats();
}

// Deseleccionar todos los videos
function deselectAllVideos() {
  document.querySelectorAll('.video-checkbox').forEach(checkbox => {
    checkbox.checked = false;
  });
  updateStats();
}

// Copiar videos seleccionados
async function copySelectedVideos() {
  const selectedIndices = [];
  document.querySelectorAll('.video-checkbox:checked').forEach(checkbox => {
    selectedIndices.push(parseInt(checkbox.dataset.index));
  });
  
  if (selectedIndices.length === 0) {
    showError('No hay videos seleccionados');
    return;
  }
  
  const selectedVideos = selectedIndices.map(index => currentVideos[index]);
  const copyWithTitle = copyWithTitleCheckbox.checked;
  
  // Formatear texto para copiar
  let textToCopy = '';
  if (copyWithTitle) {
    textToCopy = selectedVideos.map(video => 
      `${video.title}\n${video.url}`
    ).join('\n\n');
  } else {
    textToCopy = selectedVideos.map(video => video.url).join('\n');
  }
  
  try {
    // Intentar usar navigator.clipboard.writeText
    await navigator.clipboard.writeText(textToCopy);
    showSuccess(`¡${selectedVideos.length} URL${selectedVideos.length !== 1 ? 's' : ''} copiada${selectedVideos.length !== 1 ? 's' : ''}!`);
  } catch (error) {
    console.error('Error copying to clipboard:', error);
    showFallbackModal(textToCopy);
  }
}

// Mostrar modal de fallback
function showFallbackModal(text) {
  fallbackTextEl.value = text;
  fallbackModal.classList.remove('hidden');
}

// Cerrar modal de fallback
function closeFallbackModal() {
  fallbackModal.classList.add('hidden');
}

// Intentar copiar desde el fallback
async function copyFromFallback() {
  const text = fallbackTextEl.value;
  try {
    await navigator.clipboard.writeText(text);
    closeFallbackModal();
    showSuccess('¡URLs copiadas al portapapeles!');
  } catch (error) {
    showError('No se pudo copiar. Por favor, selecciona y copia manualmente.');
  }
}

// Mostrar estado de carga
function showLoading() {
  videoListEl.innerHTML = '<div class="loading">Cargando videos...</div>';
}

// Mostrar mensaje de no videos
function showNoVideos() {
  videoListEl.innerHTML = '<div class="no-videos">No se encontraron videos de YouTube en esta página.<br><br>Asegúrate de estar en:<br>• Una playlist de YouTube<br>• Un canal de YouTube<br>• Resultados de búsqueda<br>• La página principal de YouTube</div>';
}

// Mostrar mensaje de error
function showError(message) {
  errorMessageEl.textContent = message;
  errorMessageEl.classList.remove('hidden');
  setTimeout(hideError, 5000);
}

// Ocultar mensaje de error
function hideError() {
  errorMessageEl.classList.add('hidden');
}

// Mostrar mensaje de éxito
function showSuccess(message) {
  successMessageEl.textContent = message;
  successMessageEl.classList.remove('hidden');
  setTimeout(hideSuccess, 2000);
}

// Ocultar mensaje de éxito
function hideSuccess() {
  successMessageEl.classList.add('hidden');
}

// Escapar HTML para prevenir XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
