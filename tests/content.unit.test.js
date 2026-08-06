const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

function createContext() {
  const context = vm.createContext({
    URL,
    URLSearchParams,
    console: { log() {} },
    setTimeout() {},
    window: { location: { search: '' }, addEventListener() {} },
    document: { body: {}, querySelectorAll() { return []; } },
    chrome: { runtime: { onMessage: { addListener() {} } } },
    MutationObserver: class { observe() {} disconnect() {} }
  });
  vm.runInContext(fs.readFileSync('content.js', 'utf8'), context);
  return context;
}

test('normaliza una URL y conserva la playlist', () => {
  const context = createContext();
  const result = vm.runInContext(
    "normalizeYouTubeUrl('https://youtube.com/watch?v=abcdefghijk&list=PL123')",
    context
  );

  assert.equal(result, 'https://www.youtube.com/watch?v=abcdefghijk&list=PL123');
});

test('extrae el título cuando el contenedor es el propio enlace', () => {
  const context = createContext();
  context.element = {
    matches(selector) { return selector.includes('a#video-title'); },
    getAttribute(name) { return name === 'title' ? 'Nombre completo' : null; },
    textContent: 'Nombre visible truncado'
  };

  const result = vm.runInContext('extractVideoTitle(element)', context);

  assert.equal(result, 'Nombre completo');
});

test('extrae texto completo desde runs del modelo de YouTube', () => {
  const context = createContext();
  context.value = { runs: [{ text: 'Título ' }, { text: 'sin truncar' }] };

  const result = vm.runInContext('getYouTubeText(value)', context);

  assert.equal(result, 'Título sin truncar');
});
