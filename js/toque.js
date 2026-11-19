'use strict';

// =====================================================================
//  Minha Horta — toque (iPad / celular)
//  • TOQUE: o aparelho usa o dedo como ponteiro principal.
//  • Tocar e segurar num botão/ícone mostra a dica que no computador
//    aparece ao passar o mouse (atributo title).
// =====================================================================
const TOQUE = window.matchMedia('(pointer: coarse)').matches;
// Textos que mudam entre mouse e dedo
const TXT = {
  passe: TOQUE ? 'Toque e segure' : 'Passe o mouse',
  moverMapa: TOQUE ? 'Arraste com um dedo para mover o mapa; afaste dois dedos para zoom.' : 'Arraste para mover o mapa. Roda do mouse: zoom.',
  mapaVazio: TOQUE ? 'Toque no mapa' : 'Passe o mouse sobre o mapa',
};

function montarToque() {
  if (TOQUE) document.documentElement.classList.add('toque');
  let timer = null, balao = null, inicio = null, engolirClique = false;

  const esconder = () => { if (balao) { balao.remove(); balao = null; } };
  const cancelar = () => { clearTimeout(timer); timer = null; };

  document.addEventListener('pointerdown', ev => {
    esconder();
    if (ev.pointerType !== 'touch') return;
    const alvo = ev.target.closest('[title]');
    if (!alvo || !alvo.title || ev.target.closest('canvas')) return;
    inicio = { x: ev.clientX, y: ev.clientY };
    cancelar();
    timer = setTimeout(() => {
      timer = null;
      balao = document.createElement('div');
      balao.className = 'balao-toque';
      balao.textContent = alvo.title;
      document.body.appendChild(balao);
      const r = alvo.getBoundingClientRect();
      const b = balao.getBoundingClientRect();
      const x = Math.max(8, Math.min(innerWidth - b.width - 8, r.left + r.width / 2 - b.width / 2));
      const y = r.top - b.height - 8 > 8 ? r.top - b.height - 8 : r.bottom + 8;
      balao.style.left = x + 'px'; balao.style.top = y + 'px';
      engolirClique = true;   // soltar o dedo depois da dica não aciona o botão
      setTimeout(esconder, 3500);
    }, 500);
  }, true);
  document.addEventListener('pointermove', ev => {
    if (timer && inicio && Math.hypot(ev.clientX - inicio.x, ev.clientY - inicio.y) > 10) cancelar();
  }, true);
  document.addEventListener('pointerup', cancelar, true);
  document.addEventListener('pointercancel', cancelar, true);
  document.addEventListener('click', ev => {
    if (engolirClique) { engolirClique = false; ev.preventDefault(); ev.stopPropagation(); }
  }, true);
  // menu de contexto do sistema (tocar e segurar) atrapalha a dica
  document.addEventListener('contextmenu', ev => { if (TOQUE && ev.target.closest('[title]')) ev.preventDefault(); });
}
