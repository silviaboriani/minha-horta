'use strict';

// =====================================================================
//  Minha Horta — funcionamento offline (service worker)
//  • Guarda o app (páginas, código, fotos) no aparelho na instalação.
//  • Código: tenta a internet primeiro (para receber atualizações); se
//    não houver sinal em 3 s, usa a cópia guardada — funciona na horta.
//  • Fotos e ícones: usa a cópia guardada (não mudam).
//  • Pedidos para outros sites (clima, busca de cidade) não são guardados.
//  Ao mudar a lista de arquivos, aumente VERSAO.
// =====================================================================
const VERSAO = 'horta-v5';

const APP = [
  './', 'index.html', 'manifest.webmanifest', 'css/estilo.css',
  'img/icone.svg', 'img/icone-180.png', 'img/icone-192.png', 'img/icone-512.png', 'img/favicon-32.png',
  'js/exemplo.js', 'js/toque.js', 'js/dialogo.js', 'js/inicio.js', 'js/sol.js', 'js/plantas.js', 'js/fotos.js', 'js/plantas-ui.js',
  'js/ciclo.js', 'js/plano.js', 'js/calendario.js', 'js/bandeja.js', 'js/sugerir.js', 'js/compras.js', 'js/diario.js',
  'js/lembretes.js', 'js/clima.js', 'js/limpar.js', 'js/formas.js', 'js/menu.js', 'js/instalar.js', 'js/paineis.js', 'js/app.js',
];

// A lista de fotos vem do próprio fotos.js (const FOTOS)
importScripts('js/fotos.js');
const FOTOS_ARQ = Object.values(FOTOS).map(f => f.arquivo);

self.addEventListener('install', ev => {
  ev.waitUntil((async () => {
    const cache = await caches.open(VERSAO);
    await cache.addAll(APP);
    // fotos uma a uma: se alguma falhar, o resto continua
    await Promise.all(FOTOS_ARQ.map(a => cache.add(a).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', ev => {
  ev.waitUntil((async () => {
    for (const nome of await caches.keys()) if (nome !== VERSAO) await caches.delete(nome);
    await self.clients.claim();
  })());
});

const ehImagem = url => /\.(webp|png|jpg|jpeg|svg)$/i.test(url.pathname);

self.addEventListener('fetch', ev => {
  const url = new URL(ev.request.url);
  if (ev.request.method !== 'GET' || url.origin !== self.location.origin) return;   // outros sites: direto

  if (ehImagem(url)) {
    ev.respondWith((async () => {
      const guardada = await caches.match(ev.request);
      if (guardada) return guardada;
      const resp = await fetch(ev.request);
      if (resp.ok) (await caches.open(VERSAO)).put(ev.request, resp.clone());
      return resp;
    })());
    return;
  }

  // código e páginas: internet primeiro, cópia guardada se demorar ou falhar
  ev.respondWith((async () => {
    const cache = await caches.open(VERSAO);
    const daRede = fetch(ev.request).then(resp => {
      if (resp.ok) cache.put(ev.request, resp.clone());
      return resp;
    });
    const guardada = await cache.match(ev.request, { ignoreSearch: true });
    if (!guardada) return daRede;
    const limite = new Promise(r => setTimeout(() => r(null), 3000));
    try {
      return (await Promise.race([daRede, limite])) || guardada;
    } catch {
      return guardada;
    }
  })());
});
