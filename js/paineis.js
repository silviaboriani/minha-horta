'use strict';

// =====================================================================
//  Minha Horta — painéis laterais recolhíveis
//  Uma aba na borda de cada painel (‹ ›) esconde/mostra o painel,
//  dando mais espaço ao mapa, às plantas ou ao diário.
//  Tela estreita (iPad em pé): os painéis abrem POR CIMA do mapa, um de
//  cada vez, e começam fechados. Tocar num canteiro abre o painel dele.
//  A escolha fica lembrada neste aparelho (larga e estreita separadas).
// =====================================================================
const CHAVE_PAINEIS = 'horta.paineis.v1';
const telaEstreita = window.matchMedia('(max-width: 1000px)');
let estadoPaineis = { largo: {}, estreito: { esq: true, dir: true } };

function lerPaineis() {
  try {
    const s = JSON.parse(localStorage.getItem(CHAVE_PAINEIS));
    if (s && s.largo) return s;
    if (s) return { largo: s, estreito: { esq: true, dir: true } };   // formato antigo
  } catch { /* sem armazenamento */ }
  return { largo: {}, estreito: { esq: true, dir: true } };
}
const paineisAtuais = () => (telaEstreita.matches ? estadoPaineis.estreito : estadoPaineis.largo);

function aplicarPaineis() {
  const p = paineisAtuais();
  document.body.classList.toggle('fecha-esq', !!p.esq);
  document.body.classList.toggle('fecha-dir', !!p.dir);
  const be = $('abaEsq'), bd = $('abaDir');
  be.textContent = p.esq ? '›' : '‹';
  bd.textContent = p.dir ? '‹' : '›';
  be.title = p.esq ? 'Mostrar painel da esquerda' : 'Recolher painel da esquerda';
  bd.title = p.dir ? 'Mostrar painel da direita' : 'Recolher painel da direita';
  be.setAttribute('aria-expanded', String(!p.esq));
  bd.setAttribute('aria-expanded', String(!p.dir));
}
function guardarPaineis() {
  try { localStorage.setItem(CHAVE_PAINEIS, JSON.stringify(estadoPaineis)); } catch { /* só nesta sessão */ }
}

// fechado = true/false para o lado 'esq' ou 'dir'
function definirPainel(lado, fechado) {
  const p = paineisAtuais();
  p[lado] = fechado;
  // na tela estreita, só um painel aberto por vez (eles ficam por cima do mapa)
  if (telaEstreita.matches && !fechado) p[lado === 'esq' ? 'dir' : 'esq'] = true;
  aplicarPaineis();
  guardarPaineis();
}
// Chamado ao tocar num canteiro: na tela estreita, mostra o painel com os detalhes
function abrirPainelDetalhe() {
  if (telaEstreita.matches && paineisAtuais().dir) definirPainel('dir', false);
}

function montarPaineis() {
  estadoPaineis = lerPaineis();
  aplicarPaineis();
  $('abaEsq').onclick = () => definirPainel('esq', !paineisAtuais().esq);
  $('abaDir').onclick = () => definirPainel('dir', !paineisAtuais().dir);
  telaEstreita.addEventListener('change', aplicarPaineis);   // girou o iPad
}
