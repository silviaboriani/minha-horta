'use strict';

// =====================================================================
//  Minha Horta — app instalável (iPad / celular)
//  • Liga o funcionamento offline (sw.js).
//  • Pede ao navegador para não apagar os dados salvos.
// =====================================================================

function montarInstalar() {
  // offline: só funciona em https ou localhost
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  // pedir para os dados não serem apagados quando o aparelho tiver pouco espaço
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
}
