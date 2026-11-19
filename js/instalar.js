'use strict';

// =====================================================================
//  Minha Horta — app instalável (iPad / celular)
//  • Liga o funcionamento offline (sw.js).
//  • Pede ao navegador para não apagar os dados salvos.
//  • Mostra no menu como pôr o app na tela de início.
// =====================================================================
const rodandoComoApp = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

function montarInstalar() {
  // offline: só funciona em https ou localhost
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  // pedir para os dados não serem apagados quando o aparelho tiver pouco espaço
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  const caixa = $('instalarApp');
  if (!caixa) return;
  caixa.innerHTML = rodandoComoApp()
    ? `<p class="nota">✓ Você está usando o app instalado. Funciona sem internet; quando houver sinal, ele se atualiza sozinho.</p>
       <p class="nota">💾 Os dados ficam só neste aparelho. De vez em quando, use <b>Exportar arquivo</b> para guardar uma cópia.</p>`
    : `<p class="nota"><b>No iPad ou iPhone:</b> abra este endereço no Safari, toque em <b>Compartilhar</b> (□↑) e depois em <b>Adicionar à Tela de Início</b>.</p>
       <p class="nota"><b>No Android ou computador (Chrome/Edge):</b> menu do navegador → <b>Instalar app</b>.</p>
       <p class="nota">Depois de instalado, abre em tela cheia e funciona sem internet. Os dados de cada aparelho são separados — use <b>Exportar/Abrir arquivo</b> para levar a horta de um para outro.</p>`;
}
