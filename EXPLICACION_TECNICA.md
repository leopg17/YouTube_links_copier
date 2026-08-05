# YouTube Links Copier - Explicación Técnica

## Cómo Detectar Videos en YouTube

### Estrategia de Detección

La extensión utiliza un **Content Script** que se inyecta en las páginas de YouTube para detectar videos. La estrategia principal es:

1. **Seleccionar todos los elementos `<a>` con atributo `href`**:
   ```javascript
   const links = document.querySelectorAll('a[href]');
   ```

2. **Detectar si estamos en una playlist**:
   - Se extrae el parámetro `list` de la URL actual
   - Si existe, se filtra para solo incluir videos de esa playlist
   ```javascript
   const currentPlaylistId = getCurrentPlaylistId(); // Ej: "PLangBM27OtEA..."
   ```

3. **Filtrar y normalizar URLs de YouTube**:
   - Se analiza cada URL para identificar patrones de YouTube
   - Se extrae el ID del video (11 caracteres alfanuméricos)
   - Se preserva el ID de playlist si existe
   - Se convierte a formato estándar: `https://www.youtube.com/watch?v=VIDEO_ID&list=PLAYLIST_ID`

4. **Eliminar duplicados usando un Map**:
   ```javascript
   const videoMap = new Map(); // Clave = URL normalizada completa
   if (!videoMap.has(normalizedUrl)) {
     videoMap.set(normalizedUrl, videoData);
   }
   ```

5. **Extraer títulos asociados**:
   - Busca elementos con clases como `#video-title`, `.yt-simple-endpoint`
   - Navega por el DOM padre para encontrar metadatos

### Formatos de URL Soportados

| Formato | Ejemplo | Conversión |
|---------|---------|------------|
| watch?v= | `youtube.com/watch?v=dQw4w9WgXcQ` | ✅ Mantiene + agrega list si existe |
| watch?v=+list | `youtube.com/watch?v=dQw4w9WgXcQ&list=PL...` | ✅ Mantiene ambos |
| youtu.be | `youtu.be/dQw4w9WgXcQ` | ✅ Convierte a watch?v= + list |
| /shorts/ | `youtube.com/shorts/dQw4w9WgXcQ` | ✅ Convierte a watch?v= |
| /embed/ | `youtube.com/embed/dQw4w9WgXcQ` | ✅ Convierte a watch?v= + list |
| /v/ | `youtube.com/v/dQw4w9WgXcQ` | ✅ Convierte a watch?v= |

### Filtrado por Playlist

Cuando estás en una página con parámetro `list=` en la URL:
- URL ejemplo: `https://www.youtube.com/watch?v=6YnLB0XbTnI&list=PLangBM27OtEA`
- La extensión detecta `PLangBM27OtEA` como playlist activa
- Solo incluye videos que tienen ese mismo `list=` en sus enlaces
- Esto evita mezclar videos de otras playlists o sugerencias

---

## Riesgos con el DOM Dinámico

### 1. Lazy Loading (Carga Diferida)

**Problema**: YouTube no carga todos los videos de una vez. Solo carga los visibles + algunos adicionales. Al hacer scroll, se cargan más videos dinámicamente.

**Impacto**: Si el usuario no hace scroll, solo se detectarán los primeros videos.

**Solución implementada**:
- Botón "Actualizar" para re-escanear después de hacer scroll
- Mensaje informativo indicando que debe hacer scroll

**Limitación**: No podemos detectar automáticamente cuándo se cargan nuevos videos sin usar MutationObserver (que consumiría muchos recursos).

### 2. Single Page Application (SPA)

**Problema**: YouTube usa navegación sin recarga de página. Cuando haces clic en un video o cambias de sección, el URL cambia pero la página no se recarga.

**Impacto**: Los videos detectados pueden quedar desactualizados después de navegar.

**Solución implementada**:
- Botón "Actualizar" que vuelve a ejecutar la extracción
- El usuario debe actualizar manualmente después de navegar

### 3. Shadow DOM

**Problema**: Web Components usan Shadow DOM, que aísla el contenido del resto del documento.

**Impacto**: `document.querySelectorAll()` no encuentra elementos dentro de Shadow DOM.

**Solución parcial**:
- YouTube expone algunos enlaces en el DOM ligero (light DOM)
- Los enlaces principales suelen ser accesibles
- Limitación: Algunos elementos pueden no detectarse

### 4. Renderizado Asíncrono

**Problema**: El contenido se genera con JavaScript después de la carga inicial.

**Solución implementada**:
- `run_at: "document_idle"` en manifest.json
- Espera a que el navegador esté idle antes de ejecutar
- Botón de actualización manual

---

## Riesgos con el Portapapeles

### 1. Permisos y Seguridad del Navegador

**Requisitos**:
- ✅ Contexto seguro (HTTPS) - YouTube siempre usa HTTPS
- ✅ Interacción del usuario (click) - Nuestro botón provee esto
- ⚠️ Permiso `clipboard-write` - Chrome lo pide automáticamente

**Solución implementada**:
- Usamos `navigator.clipboard.writeText()` dentro del event listener del click
- El popup se abre solo por interacción del usuario

### 2. Fallos Silenciosos

**Solución implementada**:
- Modal de fallback con textarea
- Si falla la copia automática, muestra el texto para copia manual
- Mensaje de éxito temporal (2 segundos)

### 3. Límites de Tamaño

```
Límite típico: ~1-10 MB de texto
Nuestra extensión: ~500 URLs × 50 caracteres = ~25 KB ✅
```

---

## Arquitectura Completa

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌─────────────┐
│   Popup     │────▶│  Background  │────▶│   Content   │────▶│   YouTube   │
│   (UI)      │◀────│  (Service    │◀────│   Script    │◀────│    DOM      │
│             │     │   Worker)    │     │             │     │             │
└─────────────┘     └──────────────┘     └─────────────┘     └─────────────┘
```

1. Usuario abre el popup → solicita enlaces
2. Background script → consulta content script
3. Content script → escanea DOM de YouTube
4. Retorna array de videos normalizados
5. Popup muestra lista con checkboxes
6. Usuario copia al portapapeles

---

## Instrucciones para Cargar en Chrome

### Paso 1: Abrir Chrome Extensions
1. Abre Google Chrome
2. Navega a: `chrome://extensions/`

### Paso 2: Activar Modo Desarrollador
1. Activa el interruptor **"Modo de desarrollador"** (esquina superior derecha)

### Paso 3: Cargar la Extensión
1. Haz clic en **"Cargar descomprimida"**
2. Selecciona la carpeta `/workspace`
3. La extensión aparecerá en la lista

### Paso 4: Fijar la Extensión
1. Click en ícono de puzzle 🧩
2. Busca "YouTube Links Copier"
3. Click en el pin 📌

---

## Pruebas Manuales

### Test 1: Playlist desde un video específico (NUEVO)
```
URL: https://www.youtube.com/watch?v=6YnLB0XbTnI&list=PLangBM27OtEA
1. Abre la URL que contiene un video + parámetro list=
2. La extensión detectará automáticamente la playlist
3. Verifica que solo muestra videos de esa playlist específica
4. Cada URL copiada incluirá &list=PLangBM27OtEA
5. El popup mostrará una alerta amarilla con el ID de la playlist
```

### Test 2: Playlist completa
```
URL: https://www.youtube.com/playlist?list=PL...
1. Haz scroll para cargar todos los videos
2. Abre extensión
3. Verifica que todas las URLs incluyen el parámetro list=
4. Copia y verifica formato en NotebookLM
```

### Test 3: Shorts
```
URL: https://www.youtube.com/shorts
1. Verifica conversión a watch?v=
2. Si hay list=, verifica que se preserve
```

### Test 4: Búsqueda
```
URL: https://www.youtube.com/results?search_query=...
1. Scroll para cargar resultados
2. Verifica detección múltiple
3. No hay list=, así que URLs van sin parámetro adicional
```

### Test 5: Duplicados
```
1. Página con videos repetidos
2. Verifica eliminación automática
3. Mismo video en diferentes formatos = 1 sola entrada
```

### Test 6: youtu.be con playlist
```
URL: https://youtu.be/dQw4w9WgXcQ?list=PL...
1. Verifica conversión a youtube.com/watch?v=
2. Verifica preservación del parámetro list=
```

---

## Limitaciones

1. **Scroll necesario**: YouTube usa lazy loading - debes hacer scroll para cargar todos los videos de la playlist
2. **Shadow DOM**: Algunos elementos pueden no ser accesibles
3. **Anuncios**: Los videos patrocinados pueden detectarse como parte del contenido
4. **Máximo ~500 videos**: Límite práctico de rendimiento en playlists muy grandes
5. **YouTube Music**: No completamente compatible (estructura DOM diferente)
6. **Títulos faltantes**: Algunos videos pueden mostrar "Video N" si no se encuentra el título
7. **Filtrado por playlist**: Solo funciona cuando el parámetro `list=` está presente en la URL actual
8. **Videos sugeridos**: En páginas de video individual, puede incluir videos de la sección "A continuación" si comparten el mismo list=

### Nota importante sobre playlists

La extensión **NO** carga automáticamente todos los videos de una playlist desde la API de YouTube. Solo detecta los enlaces presentes en el DOM actual. Esto significa que:

- ✅ Debes hacer scroll hasta el final de la playlist para cargar todos los videos
- ✅ Solo se extraerán los videos cuyos enlaces estén visibles en el DOM
- ✅ Si la playlist tiene 100 videos pero solo cargaste 20, solo obtendrás 20

Esta limitación es intencional para mantener la extensión sin dependencias de APIs externas.

---

## Archivos Entregados

```
/workspace/
├── manifest.json      # Configuración (Manifest V3)
├── content.js         # Detección y normalización
├── background.js      # Service Worker
├── popup.html         # Interfaz
├── popup.css          # Estilos
├── popup.js           # Lógica UI
├── icons/             # Íconos SVG
├── README.md          # Guía completa
└── EXPLICACION_TECNICA.md  # Este archivo
```

Total: ~1000 líneas de código + documentación
