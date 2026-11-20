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
    ? `<p class="nota">✓ App instalado: funciona sem internet e se atualiza sozinho quando há sinal.</p>
       <p class="nota">💾 Os dados ficam só neste aparelho: de vez em quando, use <b>Exportar arquivo</b> para ter uma cópia.</p>`
    : `<p class="nota"><b>iPad ou iPhone:</b> no Safari, toque em <b>Compartilhar</b> (□↑) → <b>Adicionar à Tela de Início</b>.</p>
       <p class="nota"><b>Android ou computador:</b> menu do navegador → <b>Instalar app</b>.</p>
       <p class="nota">Instalado, abre em tela cheia e funciona sem internet. Cada aparelho guarda os seus dados: use <b>Exportar/Abrir arquivo</b> para passar a horta de um para outro.</p>`;
}
