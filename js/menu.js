'use strict';

// =====================================================================
//  Minha Horta — Menu ☰: gaveta com projeto e arquivo
// =====================================================================

function abrirMenu() {
  atualizarArquivo();
  $('menuLateral').classList.remove('oculto');
}
function fecharMenu() { $('menuLateral').classList.add('oculto'); }

function montarMenu() {
  $('btnMenu').onclick = () => ($('menuLateral').classList.contains('oculto') ? abrirMenu() : fecharMenu());
  $('menuLateral').addEventListener('click', ev => {
    if (ev.target.closest('[data-menu="fechar"]')) { fecharMenu(); return; }
    // qualquer ação do menu fecha a gaveta (as perguntas aparecem por cima)
    if (ev.target.closest('.botoes button, [data-projeto]')) fecharMenu();
  });
  document.addEventListener('keydown', ev => {
    if (ev.key === 'Escape' && !$('menuLateral').classList.contains('oculto')) fecharMenu();
  });
}
