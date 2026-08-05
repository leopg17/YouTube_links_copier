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
      querySelectorAll(selector) {
        if (selector === 'a[href]') return links;
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
