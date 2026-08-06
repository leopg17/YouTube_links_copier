const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

function loadContentScript(links) {
  const context = vm.createContext({
    URL,
    URLSearchParams,
    console: { log() {} },
    setTimeout() {},
    window: {
      location: { search: '' },
      addEventListener() {}
    },
    document: {
      body: {},
      querySelectorAll() { return links; }
    },
    chrome: {
      runtime: { onMessage: { addListener() {} } }
    },
    MutationObserver: class {
      observe() {}
      disconnect() {}
    }
  });

  vm.runInContext(fs.readFileSync('content.js', 'utf8'), context);
  return vm.runInContext('extractYouTubeLinks()', context);
}

function createElement({
  href = null,
  text = '',
  attributes = {},
  matchingSelectors = [],
  selectorElements = {},
  renderer = null,
  rendererName = null
} = {}) {
  return {
    href,
    matches(selector) { return matchingSelectors.includes(selector); },
    querySelector(selector) { return selectorElements[selector] || null; },
    getAttribute(attribute) { return attributes[attribute] ?? null; },
    get textContent() { return text; },
    closest(selectors) {
      return !rendererName || selectors.includes(rendererName) ? renderer : null;
    }
  };
}

function legacyPlaylistFixture(id, title) {
  const titleElement = createElement({
    text: title,
    matchingSelectors: ['span#video-title']
  });
  const renderer = createElement({
    selectorElements: { 'span#video-title': titleElement }
  });
  return createElement({
    href: `https://www.youtube.com/watch?v=${id}`,
    renderer,
    rendererName: 'ytd-playlist-panel-video-renderer'
  });
}

function modernPlaylistFixture(id, title, rendererName = 'yt-lockup-view-model') {
  const titleElement = createElement({
    href: `https://www.youtube.com/watch?v=${id}`,
    text: title,
    matchingSelectors: ['a.yt-lockup-metadata-view-model__title']
  });
  const renderer = createElement({
    selectorElements: {
      'yt-lockup-view-model a.yt-lockup-metadata-view-model__title': titleElement,
      'yt-lockup-metadata-view-model a.yt-lockup-metadata-view-model__title': titleElement,
      'a.yt-lockup-metadata-view-model__title': titleElement
    }
  });
  const thumbnail = createElement({
    href: `https://www.youtube.com/watch?v=${id}`,
    renderer,
    rendererName
  });
  return [thumbnail, titleElement];
}

test('extrae los nueve títulos visibles de las vistas antigua y moderna de playlist', () => {
  const expectedTitles = [
    'Introducción al curso',
    'Variables y tipos de datos',
    'Operadores y expresiones',
    'Estructuras condicionales',
    'Bucles y recorridos',
    'Funciones paso a paso',
    'Objetos y colecciones',
    'Programación asíncrona',
    'Proyecto final completo'
  ];
  const ids = [
    'video000001', 'video000002', 'video000003',
    'video000004', 'video000005', 'video000006',
    'video000007', 'video000008', 'video000009'
  ];
  const links = expectedTitles.flatMap((title, index) => {
    if (index < 4) return legacyPlaylistFixture(ids[index], title);
    const rendererName = index === 8
      ? 'yt-playlist-panel-video-renderer'
      : index === 7
        ? 'yt-lockup-metadata-view-model'
        : 'yt-lockup-view-model';
    return modernPlaylistFixture(ids[index], title, rendererName);
  });

  const videos = loadContentScript(links);

  assert.deepEqual(Array.from(videos, video => video.title), expectedTitles);
  assert.ok(videos.every(video => !video.title.startsWith('Video ')));
});

test('usa el aria-label del propio enlace aunque no sea un selector de título', () => {
  const link = createElement({
    href: 'https://www.youtube.com/watch?v=abcdefghijk',
    attributes: { 'aria-label': 'Título accesible del enlace' }
  });

  const videos = loadContentScript([link]);

  assert.equal(videos[0].title, 'Título accesible del enlace');
});

test('ignora el aria-label del control Siguiente y conserva el título real', () => {
  const href = 'https://www.youtube.com/watch?v=abcdefghijk';
  const nextControl = createElement({
    href,
    attributes: { 'aria-label': 'Siguiente (SHIFT+n)' }
  });
  const titleLink = createElement({
    href,
    text: 'Stanford CS329A Agentes de IA auto-mejorables | Parte 2',
    matchingSelectors: ['a.yt-lockup-metadata-view-model__title']
  });

  const videos = loadContentScript([nextControl, titleLink]);

  assert.equal(videos.length, 1);
  assert.equal(
    videos[0].title,
    'Stanford CS329A Agentes de IA auto-mejorables | Parte 2'
  );
});

test('una aparición posterior completa el título pendiente del mismo video', () => {
  const href = 'https://www.youtube.com/watch?v=abcdefghijk';
  const thumbnailWithoutRenderer = createElement({ href });
  const titleLink = createElement({
    href,
    attributes: { title: 'Nombre encontrado después' }
  });

  const videos = loadContentScript([thumbnailWithoutRenderer, titleLink]);

  assert.equal(videos.length, 1);
  assert.equal(videos[0].title, 'Nombre encontrado después');
});
