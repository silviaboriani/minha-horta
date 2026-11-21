'use strict';

// =====================================================================
//  Minha Horta — quantas plantas plantar, pensando em QUEM COME da horta
//  (e não em quantas cabem no canteiro).
//
//  Perfil da horta (estado.perfil): quantas pessoas e para que serve.
//  Cada planta tem uma quantidade por pessoa, POR PLANTIO. São estimativas
//  de consumo fresco (guias de horta caseira), para uma casa comum — ajuste
//  na caixinha de quantidade quando quiser mais ou menos.
//    • folhas de colheita única: poucos pés por pessoa, replantando a cada 3–4 semanas
//    • raízes: mais pés (cada pé é uma raiz)
//    • frutos (tomate, abobrinha…): 1–2 pés por pessoa produzem por meses
//    • ervas: poucos pés para a casa toda
//    • flores: um punhado por canteiro, não dependem de quantas pessoas
//    • grãos de lavoura (trigo, arroz…): ~1 m² por pessoa, como experiência
// =====================================================================

const OBJETIVOS = {
  fresco:    { nome: 'Comer fresco', desc: 'O suficiente para comer em casa, sem sobra.', mult: 1 },
  conservar: { nome: 'Comer e conservar', desc: 'Um extra para congelar, molhos e conservas (~2×).', mult: 2 },
  dividir:   { nome: 'Comer e dividir ou vender', desc: 'Bastante extra para dar ou vender (~3×).', mult: 3 },
  espaco:    { nome: 'Usar todo o espaço', desc: 'Sem limite: enche os canteiros com o que couber.', mult: Infinity },
};

// O que fazer com o espaço que sobra depois das quantidades da casa (✨ Sugerir plano)
const SOBRAS = {
  outras: { nome: 'Outras plantas', desc: 'Mais variedade: outras plantas, nas quantidades da casa.' },
  livre:  { nome: 'Deixar livre', desc: 'Não planta: fica para depois ou para você decidir.' },
  adubo:  { nome: 'Adubação verde', desc: 'Uma planta que melhora o solo (aveia-preta no frio, feijão-de-porco no calor).' },
};

// Pés por pessoa em cada plantio (o que não está aqui usa o padrão da categoria)
const POR_PESSOA = {
  // folhas
  alface: 5, rucula: 8, agriao: 4, couve: 1, repolho: 1.5, brocolis: 2, 'couve-flor': 1.5, acelga: 1, almeirao: 4,
  chicoria: 3, 'espinafre-nz': 1, bertalha: 1, mostarda: 3, tatsoi: 3, 'bok-choy': 3, salsao: 2, funcho: 2,
  espinafre: 4, 'couve-de-bruxelas': 1,
  // frutos
  tomate: 2, 'tomate-cereja': 1, 'tomate-italiano': 2, 'tomate-caqui': 1, pimentao: 1.5, pimentas: 0.5,
  'dedo-de-moca': 0.5, biquinho: 0.5, berinjela: 1, jilo: 1, abobrinha: 1, abobora: 0.5, 'abobora-moranga': 0.5,
  'abobora-cabotia': 0.5, 'abobora-menina': 0.5, 'abobora-pescoco': 0.5, pepino: 1.5, 'pepino-aodai': 1.5,
  'pepino-japones': 1.5, 'pepino-caipira': 1.5, 'pepino-conserva': 2, quiabo: 2, melancia: 0.5, melao: 0.5,
  morango: 6, maxixe: 1, physalis: 1,
  // raízes e tubérculos
  cenoura: 20, beterraba: 12, rabanete: 10, nabo: 8, 'batata-doce': 3, 'batata-salsa': 6, inhame: 4, gengibre: 2,
  curcuma: 2, batata: 8, alho: 20, cebola: 20, mandioca: 2, cara: 2, yacon: 1, rabano: 4, 'alho-poro': 8,
  araruta: 2, mangarito: 4,
  // grãos e vagens
  'milho-verde': 10, 'feijao-vagem': 6, 'feijao-vagem-trepador': 4, 'feijao-vagem-rasteiro': 8, 'ervilha-torta': 8,
  feijao: 30, 'feijao-de-corda': 15, fava: 10, 'grao-de-bico': 20, lentilha: 40, 'ervilha-grao': 20, edamame: 10,
  amendoim: 15, 'milho-pipoca': 10,
};
const POR_PESSOA_CAT = { folhas: 3, frutos: 1, tuberculos: 8, outras: 8 };
// Ervas: pés para a casa toda (não por pessoa)
const ERVAS_CASA = { manjericao: 2, salsinha: 3, coentro: 4, cebolinha: 3, endro: 2, camomila: 4 };
// Grãos de lavoura: área por pessoa (m²), não pés
const GRAOS_AREA = ['arroz', 'trigo', 'aveia', 'cevada', 'centeio', 'trigo-sarraceno', 'quinoa', 'amaranto'];

function perfilDaHorta(e = estado) {
  const p = e.perfil || {};
  return { pessoas: Math.max(1, Math.min(30, Math.round(Number(p.pessoas) || 2))), objetivo: OBJETIVOS[p.objetivo] ? p.objetivo : 'fresco' };
}
const semLimite = () => perfilDaHorta().objetivo === 'espaco';
const textoPerfil = () => { const pf = perfilDaHorta(); return `${pf.pessoas} ${pf.pessoas === 1 ? 'pessoa' : 'pessoas'} · ${OBJETIVOS[pf.objetivo].nome.toLowerCase()}`; };

// Quantos pés plantar desta planta, num plantio, para o perfil da horta (Infinity = sem limite)
function quantidadeAlvo(p) {
  const { pessoas, objetivo } = perfilDaHorta();
  const mult = OBJETIVOS[objetivo].mult;
  if (mult === Infinity) return Infinity;
  if (p.cat === 'flores') return areaDePe(p) < 0.1 ? 8 : areaDePe(p) < 0.3 ? 4 : 2;   // enfeite e companhia
  if (p.cat === 'ervas') {
    if (p.perene) return Math.ceil(pessoas / 4);                       // alecrim, orégano…: 1 pé basta
    return Math.ceil((ERVAS_CASA[p.id] || 1) * Math.max(1, pessoas / 2.5) * Math.min(mult, 2));
  }
  if (GRAOS_AREA.includes(p.id)) return Math.max(1, Math.ceil(pessoas * Math.min(mult, 3) / areaDePe(p)));   // ~1 m² por pessoa
  const base = POR_PESSOA[p.id] ?? POR_PESSOA_CAT[p.cat] ?? 4;
  return Math.max(1, Math.ceil(base * pessoas * mult));
}

// Plantas de adubação verde (cortadas na floração e deixadas sobre o solo)
const ADUBOS_VERDES = ['aveia', 'feijao-de-porco'];

// ---------------------------------------------------------------------
//  Perfil da horta no menu ☰
// ---------------------------------------------------------------------
function htmlCamposPerfil(pf, prefixo) {
  return `<label>Quantas pessoas comem da horta?
      <input type="number" min="1" max="30" step="1" data-${prefixo}-pessoas value="${pf.pessoas}"></label>
    <div class="objetivos">${Object.entries(OBJETIVOS).map(([k, o]) => `<label class="objetivo ${pf.objetivo === k ? 'on' : ''}">
      <input type="radio" name="${prefixo}-objetivo" value="${k}" data-${prefixo}-objetivo ${pf.objetivo === k ? 'checked' : ''}>
      <b>${o.nome}</b><span>${o.desc}</span></label>`).join('')}</div>`;
}
function renderPerfil() {
  const box = $('perfilHorta');
  if (!box || box.contains(document.activeElement)) return;
  box.innerHTML = htmlCamposPerfil(perfilDaHorta(), 'perfil') +
    '<p class="nota">Usado para sugerir quantas plantas de cada tipo. Dá para mudar a quantidade de cada plantio depois.</p>';
}
function definirPerfil(mudanca) {
  registrar();
  estado.perfil = { ...perfilDaHorta(), ...mudanca };
  mudou();
}
function montarPerfil() {
  const box = $('perfilHorta');
  box.addEventListener('change', ev => {
    if (ev.target.matches('[data-perfil-pessoas]')) definirPerfil({ pessoas: Number(ev.target.value) });
    if (ev.target.matches('[data-perfil-objetivo]')) { definirPerfil({ objetivo: ev.target.value }); document.activeElement?.blur(); renderPerfil(); }
  });
  renderPerfil();
}
