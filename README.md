# YouTube Links Copier - Extensión de Chrome

Extensión de Chrome que detecta videos de YouTube en la página actual, extrae sus URLs, las normaliza, elimina duplicados y permite copiarlas al portapapeles.

**NUEVO**: Ahora soporta filtrado por playlist. Cuando estás en un video con parámetro `list=` (ej: `https://www.youtube.com/watch?v=6YnLB0XbTnI&list=PLangBM27OtEA`), la extensión detecta automáticamente la playlist y solo muestra los videos que pertenecen a ella.

## Arquitectura

### Componentes Principales

1. **manifest.json**: Configuración de la extensión (Manifest V3)
2. **content.js**: Script que se inyecta en páginas de YouTube para detectar enlaces
3. **popup.html/css/js**: Interfaz de usuario que muestra los videos encontrados
4. **background.js**: Service Worker que maneja la comunicación entre componentes

### Flujo de Funcionamiento

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌─────────────┐
│   Popup     │────▶│  Background  │────▶│   Content   │────▶│   YouTube   │
│   (UI)      │◀────│  (Service    │◀────│   Script    │◀────│    DOM      │
│             │     │   Worker)    │     │             │     │             │
└─────────────┘     └──────────────┘     └─────────────┘     └─────────────┘
```

1. El usuario abre el popup haciendo clic en el ícono de la extensión
2. El popup solicita los enlaces al background script
3. El background script envía un mensaje al content script en la pestaña activa
4. El content script escanea el DOM de YouTube y extrae todos los enlaces
5. Los enlaces se normalizan y devuelven al popup
6. El popup muestra la lista con checkboxes para seleccionar/deseleccionar
7. El usuario copia las URLs seleccionadas al portapapeles

## Detección de Videos en YouTube

### Estrategias de Detección

El content script utiliza varias estrategias para detectar enlaces de YouTube:

1. **Selección de elementos `<a>`**: Busca todos los enlaces con atributo `href`
2. **Normalización de URLs**: Convierte diferentes formatos a URL estándar
3. **Extracción de IDs**: Extrae el ID del video de diferentes formatos

### Formatos Soportados

- `https://www.youtube.com/watch?v=VIDEO_ID`
- `https://youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID`
- `https://www.youtube.com/shorts/VIDEO_ID`
- `https://www.youtube.com/embed/VIDEO_ID`
- `https://www.youtube.com/v/VIDEO_ID` (legacy)

### Riesgos con el DOM Dinámico

**Problemas Potenciales:**

1. **Carga diferida (Lazy Loading)**: YouTube carga contenido dinámicamente al hacer scroll
   - *Solución*: El usuario debe hacer scroll para cargar todos los videos antes de usar la extensión

2. **SPA (Single Page Application)**: YouTube usa navegación sin recarga
   - *Solución*: El botón "Actualizar" permite re-escanear el DOM después de navegar

3. **Shadow DOM**: Algunos elementos están dentro de Shadow DOM
   - *Limitación*: No podemos acceder directamente al Shadow DOM desde el content script

4. **Renderizado del lado del cliente**: El contenido se genera con JavaScript
   - *Solución*: Usamos `run_at: "document_idle"` para esperar a que el DOM esté listo

### Riesgos con el Portapapeles

**Problemas Potenciales:**

1. **Permisos del navegador**: Algunas versiones de Chrome requieren interacción del usuario
   - *Solución*: Usamos `navigator.clipboard.writeText()` que requiere gesto del usuario

2. **HTTPS requerido**: La API del portapapeles solo funciona en contextos seguros
   - *Solución*: YouTube siempre usa HTTPS, así que no hay problema

3. **Fallo silencioso**: La API puede fallar sin lanzar excepción en algunos casos
   - *Solución*: Implementamos modal de fallback con textarea para copia manual

## Instrucciones de Instalación

### Paso 1: Cargar la Extensión en Chrome

1. Abre Chrome y navega a `chrome://extensions/`
2. Activa el **"Modo de desarrollador"** (interruptor en la esquina superior derecha)
3. Haz clic en **"Cargar descomprimida"**
4. Selecciona la carpeta `/workspace` donde está la extensión
5. La extensión aparecerá en la lista

### Paso 2: Fijar la Extensión

1. Haz clic en el ícono de puzzle (Extensiones) en la barra de herramientas
2. Busca "YouTube Links Copier"
3. Haz clic en el pin para fijarla a la barra de herramientas

### Paso 3: Usar la Extensión

1. Navega a una página de YouTube (playlist, canal, búsqueda, etc.)
2. **Importante**: Haz scroll para cargar todos los videos que quieras capturar
3. Haz clic en el ícono de la extensión
4. Revisa la lista de videos detectados
5. Selecciona/deselecciona los videos que quieras
6. Elige si copiar solo URLs o título + URL
7. Haz clic en "Copiar Seleccionados"
8. Pega en NotebookLM o donde necesites

## Pruebas Manuales

### Escenario 1: Playlist desde un video específico (NUEVO)

1. Ve a una URL como `https://www.youtube.com/watch?v=6YnLB0XbTnI&list=PLangBM27OtEA`
2. La extensión mostrará automáticamente el ID de la playlist detectada
3. Solo se extraerán los videos que pertenecen a esa playlist específica
4. Todas las URLs copiadas incluirán el parámetro `&list=PLangBM27OtEA`
5. Haz scroll para cargar más videos de la playlist

### Escenario 2: Playlist completa

1. Ve a `https://www.youtube.com/playlist?list=PL...`
2. Haz scroll hasta cargar todos los videos
3. Abre la extensión
4. Verifica que aparezcan todos los videos
5. Copia y pega en un editor de texto

### Escenario 2: Canal de YouTube

1. Ve a `https://www.youtube.com/@NombreDelCanal/videos`
2. Haz scroll para cargar más videos
3. Abre la extensión
4. Verifica que los URLs estén normalizados

### Escenario 3: Búsqueda de YouTube

1. Busca un término en YouTube
2. Haz scroll para cargar resultados
3. Abre la extensión
4. Verifica que se detecten videos de diferentes canales

### Escenario 4: Shorts

1. Ve a `https://www.youtube.com/shorts`
2. Abre la extensión
3. Verifica que los shorts se conviertan a formato watch?v=

### Escenario 5: URLs Duplicadas

1. Abre una página con videos repetidos
2. Verifica que la extensión elimine duplicados automáticamente

## Limitaciones Conocidas

1. **Scroll necesario**: Debes hacer scroll manualmente para cargar todos los videos (YouTube usa lazy loading)

2. **Shadow DOM**: No podemos acceder a elementos dentro de Shadow DOM directamente

3. **Videos patrocinados**: Algunos anuncios pueden ser detectados como videos

4. **Títulos truncados**: En algunas páginas, los títulos pueden no estar disponibles

5. **Máximo de elementos**: El popup tiene un límite práctico de ~500 videos por rendimiento

6. **YouTube Music**: Puede no funcionar correctamente en music.youtube.com

7. **YouTube Kids**: No compatible con kids.youtube.com

## Permisos Utilizados

- `activeTab`: Acceder a la pestaña activa
- `scripting`: Inyectar scripts en páginas
- `clipboardWrite`: Copiar al portapapeles
- `host_permissions`: Solo en dominios de YouTube

## Estructura de Archivos

```
/workspace/
├── manifest.json      # Configuración de la extensión
├── content.js         # Script inyectado en YouTube
├── background.js      # Service Worker
├── popup.html         # Interfaz del popup
├── popup.css          # Estilos del popup
├── popup.js           # Lógica del popup
├── icons/
│   ├── icon16.svg     # Ícono 16x16
│   ├── icon48.svg     # Ícono 48x48
│   └── icon128.svg    # Ícono 128x128
└── README.md          # Este archivo
```

## Formato de Salida

### Solo URLs (checkbox desmarcado)
```
https://www.youtube.com/watch?v=dQw4w9WgXcQ
https://www.youtube.com/watch?v=jNQXAC9IVRw
https://www.youtube.com/watch?v=9bZkp7q19f0
```

### Título + URL (checkbox marcado)
```
Rick Astley - Never Gonna Give You Up
https://www.youtube.com/watch?v=dQw4w9WgXcQ

Me at the zoo
https://www.youtube.com/watch?v=jNQXAC9IVRw

PSY - GANGNAM STYLE
https://www.youtube.com/watch?v=9bZkp7q19f0
```

## Solución de Problemas

### "No se encontraron videos"
- Asegúrate de estar en youtube.com (no en otras páginas)
- Haz scroll para cargar más contenido
- Recarga la página y vuelve a intentar

### "Error de conexión"
- Verifica que estás en una página de YouTube
- Recarga la página (F5)
- Cierra y vuelve a abrir el popup

### "No se pudo copiar"
- Aparecerá un modal con el texto para copiar manualmente
- Selecciona todo el texto y usa Ctrl+C

## Notas para NotebookLM

El formato de salida (una URL por línea o título + URL) está optimizado para pegar directamente en NotebookLM como fuente. Cada URL será reconocida como una fuente independiente de YouTube.
