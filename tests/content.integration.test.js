const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

function loadContentScript(links, renderers = [], search = '') {
  const context = vm.createContext({
    URL,
    URLSearchParams,
    console: { log() {} },
    setTimeout() {},
    window: {
      location: { search },
      addEventListener() {}
    },
    document: {
      body: {},
      querySelectorAll(selector) {
        if (selector === 'a[href]') return links;
        if (selector.includes('ytd-rich-item-renderer')) return renderers;
        return links.filter(link => link.title !== null);
      }
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

function createLink({ href, title = null, renderer = null }) {
  return {
    href,
    title,
    matches(selector) {
      if (selector === 'a[href]') return Boolean(href);
      return title !== null && selector.split(', ').includes('a#video-title');
    },
    querySelector() { return null; },
    getAttribute(attribute) {
      return attribute === 'title' ? title : null;
    },
    get textContent() { return title; },
    closest() { return renderer; }
  };
}

test('obtiene el título desde el renderer que contiene una miniatura', () => {
  const titleElement = createLink({
    href: 'https://www.youtube.com/watch?v=abcdefghijk',
    title: 'Título real de YouTube'
  });
  const renderer = {
    matches() { return false; },
    querySelector() { return titleElement; }
  };
  const thumbnail = createLink({
    href: 'https://www.youtube.com/watch?v=abcdefghijk',
    renderer
  });

  const videos = loadContentScript([thumbnail]);

  assert.equal(videos[0].title, 'Título real de YouTube');
});

test('extrae los títulos completos del modelo de la playlist PLangBM27OtEA', () => {
  const expectedTitles = [
    'Agentes de IA automejorables de Stanford CS329A | Parte 1 | Resumen del curso',
    'Stanford CS329A Agentes de IA que se automejoran | Parte 2',
    'Stanford CS329A Agentes de IA auto-mejorables | Parte 3',
    'Stanford CS329A Agentes de IA auto-mejorables | Parte 4',
    'Stanford CS329A Agentes de IA auto-mejorables | Parte 5',
    'Agentes de IA automejorables de Stanford CS329A | Parte 6',
    'Agentes de IA automejorables de Stanford CS329A | Parte 7',
    'Agentes de IA automejorables de Stanford CS329A | Parte 8',
    'Agentes de IA automejorables de Stanford CS329A | Parte 9'
  ];
  const renderers = expectedTitles.map((title, index) => {
    const videoId = index === 0 ? '6YnLB0XbTnI' : `videoid${index}abc`.slice(0, 11);
    return {
      data: {
        videoId,
        // La playlist de YouTube entrega el título completo en runs aunque el
        // span visible termine en puntos suspensivos.
        title: { runs: [{ text: title }] }
      },
      closest() { return this; }
    };
  });
  const links = renderers.map((renderer, index) => createLink({
    href: `https://www.youtube.com/watch?v=${renderer.data.videoId}&list=PLangBM27OtEA&index=${index + 1}`,
    renderer
  }));

  const videos = loadContentScript(links, renderers, '?v=6YnLB0XbTnI&list=PLangBM27OtEA');

  assert.equal(videos.length, 9);
  assert.deepEqual(Array.from(videos, video => video.title), expectedTitles);
  assert.equal(videos[0].videoId, '6YnLB0XbTnI');
});

test('una aparición posterior reemplaza el título genérico pendiente', () => {
  const href = 'https://www.youtube.com/watch?v=abcdefghijk';
  const thumbnailWithoutRenderer = createLink({ href });
  const titleLink = createLink({ href, title: 'Nombre encontrado después' });

  const videos = loadContentScript([thumbnailWithoutRenderer, titleLink]);

  assert.equal(videos.length, 1);
  assert.equal(videos[0].title, 'Nombre encontrado después');
});

test('integra miniatura y título aunque sus URLs tengan parámetros distintos', () => {
  const videoId = 'abcdefghijk';
  const thumbnail = createLink({
    href: `https://www.youtube.com/watch?v=${videoId}&list=RDabcdefghijk`
  });
  const titleLink = createLink({
    href: `https://www.youtube.com/watch?v=${videoId}`,
    title: 'Título real con URL diferente'
  });

  const videos = loadContentScript([thumbnail, titleLink]);

  assert.equal(videos.length, 1);
  assert.equal(videos[0].videoId, videoId);
  assert.equal(videos[0].title, 'Título real con URL diferente');
});
