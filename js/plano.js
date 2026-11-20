'use strict';

// =====================================================================
//  Minha Horta — Fase 4: o que plantar em cada área
//  Sugestões por sol, época e vizinhança; avisos de plantas que não combinam.
// =====================================================================

const TIPOS_PLANTAVEIS = ['canteiro', 'outro'];
const TIPOS_SEM_VIZINHANCA = ['muro', 'caminho', 'composteira'];
const DISTANCIA_VIZINHA_M = 1;   // áreas a até 1 m uma da outra são "vizinhas"

let cacheAnalise = null;
let buscaPlanta = '';
let soListaPlano = true;
let ultimaAdicionada = null;     // { zona, id } — para mostrar as companheiras


// "set–jan", "mar–mai, ago", "o ano todo"
function faixaMeses(lista) {
  const ms = [...new Set(lista)].sort((a, b) => a - b);
  if (!ms.length) return '—';
  if (ms.length === 12) return 'o ano todo';
  // começa num mês cujo anterior não está na lista, para juntar dez–jan
  const inicio = ms.find(m => !ms.includes(m === 1 ? 12 : m - 1)) ?? ms[0];
  const ordem = [];
  for (let k = 0; k < 12; k++) { const m = (inicio - 1 + k) % 12 + 1; if (ms.includes(m)) ordem.push(m); }
  const faixas = [];
  let a = ordem[0], b = ordem[0];
  for (const m of ordem.slice(1)) {
    if (m === b % 12 + 1) b = m;
    else { faixas.push([a, b]); a = b = m; }
  }
  faixas.push([a, b]);
  return faixas.map(([x, y]) => x === y ? MESES_CURTOS[x - 1] : `${MESES_CURTOS[x - 1]}–${MESES_CURTOS[y - 1]}`).join(', ');
}

// ---------------------------------------------------------------------
//  Análise
// ---------------------------------------------------------------------

function vizinhasDeZonas() {
  const { cols, celulas } = estado;
  const R = Math.round(DISTANCIA_VIZINHA_M * 100 / estado.tamanhoCelulaCm);
  const ignorar = new Set(estado.zonas.filter(z => TIPOS_SEM_VIZINHANCA.includes(z.tipo)).map(z => z.id));
  const viz = {};
  for (let i = 0; i < celulas.length; i++) {
    const a = celulas[i];
    if (!a || ignorar.has(a)) continue;
    const c = i % cols, r = (i - c) / cols;
    // só as bordas da área interessam
    if (celula(c - 1, r) === a && celula(c + 1, r) === a && celula(c, r - 1) === a && celula(c, r + 1) === a) continue;
    for (let dr = -R; dr <= R; dr++) {
      for (let dc = -R; dc <= R; dc++) {
        const b = celula(c + dc, r + dr);
        if (b > 0 && b !== a && !ignorar.has(b)) (viz[a] || (viz[a] = new Set())).add(b);
      }
    }
  }
  return viz;
}

const areaDePe = p => p.esp[0] * p.esp[1] / 10000;   // m² por planta
// Quantidade mínima que vale a pena plantar: miúdas (cebola, cenoura…) 10 pés,
// médias (alface, couve…) 3, grandes (abóbora, tomate…) 1
// (ervas e flores: qualquer quantidade vale a pena)
const minPes = p => (p.cat === 'ervas' || p.cat === 'flores' ? 1 : areaDePe(p) < 0.05 ? 10 : areaDePe(p) < 0.3 ? 3 : 1);

// Em quais OUTRAS áreas esta planta já está, nos mesmos meses
function repetidaEmOutras(an, zonaId, id, ativos) {
  const outras = [];
  for (const z of estado.zonas) {
    if (z.id === zonaId) continue;
    if ((an.entradasPorZona[z.id] || []).some(e => e.id === id && seCruzam(ativos, e.ativos))) outras.push(z);
  }
  return outras;
}
const naEpoca = (p, m) => p.sem.includes(m) || p.tr.includes(m);

// ---- Distâncias reais (plantas posicionadas dentro dos canteiros) ----
// Quadrados da borda de cada área (bastam para medir distâncias)
function bordasDasZonas() {
  const { cols, celulas } = estado;
  const res = {};
  celulas.forEach((id, i) => {
    if (!id) return;
    const c = i % cols, r = (i - c) / cols;
    if (celula(c - 1, r) === id && celula(c + 1, r) === id && celula(c, r - 1) === id && celula(c, r + 1) === id) return;
    (res[id] || (res[id] = [])).push(i);
  });
  return res;
}
// Dois conjuntos de quadrados estão a menos de 1 m um do outro?
function pertoCels(a, b) {
  if (!a.length || !b.length) return false;
  const cols = estado.cols;
  const R = Math.round(DISTANCIA_VIZINHA_M * 100 / estado.tamanhoCelulaCm);
  const caixa = l => {
    let c0 = Infinity, c1 = -1, r0 = Infinity, r1 = -1;
    for (const i of l) { const c = i % cols, r = (i - c) / cols; if (c < c0) c0 = c; if (c > c1) c1 = c; if (r < r0) r0 = r; if (r > r1) r1 = r; }
    return { c0, c1, r0, r1 };
  };
  const ka = caixa(a), kb = caixa(b);
  if (ka.c0 - kb.c1 > R || kb.c0 - ka.c1 > R || ka.r0 - kb.r1 > R || kb.r0 - ka.r1 > R) return false;
  const [menor, maior] = a.length <= b.length ? [a, b] : [b, a];
  const B = new Set(maior);
  for (const i of menor) {
    const c = i % cols, r = (i - c) / cols;
    for (let dr = -R; dr <= R; dr++) for (let dc = -R; dc <= R; dc++) {
      const cc = c + dc, rr = r + dr;
      if (cc >= 0 && rr >= 0 && cc < cols && rr < estado.rows && B.has(rr * cols + cc)) return true;
    }
  }
  return false;
}
// Onde uma planta está: a posição marcada, ou o canteiro inteiro (borda)
const celsDe = (e, zonaId, bordas) => (e.pos && e.pos.length ? e.pos : (bordas[zonaId] || []));

function analiseHorta() {
  if (cacheAnalise && cacheAnalise.mes === mesSol) return cacheAnalise;
  const mes = mesSol + 1;
  const sol = solPorZona();
  const viz = vizinhasDeZonas();
  const cont = contarCelulas();
  const lado = estado.tamanhoCelulaCm / 100;
  const geada = mesesGeada();
  const porZona = {};
  const entradasPorZona = {};
  for (const z of estado.zonas) entradasPorZona[z.id] = entradasDaZona(z);
  const bordas = bordasDasZonas();

  for (const z of estado.zonas) {
    if (!(z.plantas || []).length) continue;
    const ents = entradasPorZona[z.id];
    const area = (cont[z.id] || 0) * lado * lado;
    const horas = sol[z.id] ? sol[z.id].media : null;
    const vizinhas = [...(viz[z.id] || [])].map(zonaPorId).filter(Boolean);
    const plantas = [];
    let mal = 0, atencao = 0;

    // Espaço mês a mês: só contam as plantas que estão no canteiro naquele mês.
    // Plantas com quantidade definida ocupam espaço fixo; o espaço livre é dividido
    // igualmente entre as que estão sem quantidade (sugestão).
    const usoMes = {}, semQtdMes = {};
    for (let m = 1; m <= 12; m++) {
      usoMes[m] = 0; semQtdMes[m] = 0;
      for (const e of ents) {
        if (!e.p || !e.ativos.has(m)) continue;
        if (e.pos.length) usoMes[m] += e.posArea;            // posicionada: reserva a área marcada
        else if (e.qtd) usoMes[m] += e.qtd * areaDePe(e.p); else semQtdMes[m]++;
      }
    }
    const mesesExcesso = Object.keys(usoMes).map(Number).filter(m => usoMes[m] > area + 1e-9);

    for (const e of ents) {
      const { entrada, id, p, inicio, ativos } = e;
      const problemas = [];
      let pes = null, sugestao = null, maximo = null;
      const status = p ? statusNoMes(p, inicio, mes) : null;
      if (p) {
        const ap = areaDePe(p);
        const ms = [...ativos];
        if (e.pos.length) {
          // Posicionada: cabe o que couber na área marcada
          maximo = Math.floor(e.posArea / ap + 1e-9);
          if (e.qtd) pes = e.qtd; else sugestao = maximo;
          if (maximo < 1) problemas.push({ nivel: 'mal', texto: `📍 A área marcada (${fmt(e.posArea, 2)} m²) é pequena demais — cada pé precisa de ~${fmt(ap, 2)} m²` });
          else if (e.qtd && e.qtd > maximo) problemas.push({ nivel: 'mal', texto: `📍 Na área marcada cabem só ${maximo} pés` });
          else if (!e.qtd && maximo < minPes(p)) problemas.push({ nivel: 'atencao', texto: `🔢 Na área marcada cabem só ${maximo} pés — marque mais espaço` });
        } else if (e.qtd) {
          pes = e.qtd;
          maximo = Math.max(0, Math.min(...ms.map(m => Math.floor((area - usoMes[m] + pes * ap) / ap + 1e-9))));
          if (pes < minPes(p)) {
            problemas.push({ nivel: 'atencao', texto: `🔢 Só ${pes} ${pes === 1 ? 'pé' : 'pés'} — para valer a pena, plante pelo menos ${minPes(p)}${maximo >= minPes(p) ? ` (cabem até ${maximo})` : ', ou tire a planta deste canteiro'}` });
          }
        } else {
          const fatia = Math.min(...ms.map(m => Math.max(0, area - usoMes[m]) / Math.max(1, semQtdMes[m])));
          sugestao = Math.floor(fatia / ap + 1e-9);
          if (sugestao < 1) {
            problemas.push({ nivel: 'mal', texto: fatia <= 0
              ? '📏 Não sobra espaço para ela nos meses em que fica no canteiro — diminua outras plantas'
              : `📏 Não cabe: cada pé precisa de ~${fmt(ap, 2)} m² e sobram ~${fmt(fatia, 2)} m² para ela` });
          } else if (sugestao < minPes(p)) {
            problemas.push({ nivel: 'atencao', texto: `🔢 Só cabem ~${sugestao} pés aqui — pouco para valer a pena (o ideal é ${minPes(p)} ou mais). Tire outra planta ou mude o mês.` });
          }
        }
        // Sol
        if (horas !== null && horas < p.sol) {
          problemas.push(horas >= p.sol - 1.5
            ? { nivel: 'atencao', texto: `⛅ Sol um pouco abaixo do ideal (${fmt(horas, 1)} h; ideal ${p.sol} h ou mais)` }
            : { nivel: 'mal', texto: `☁️ Pouco sol para ela: ${fmt(horas, 1)} h por dia (precisa de ${p.sol} h ou mais)` });
        }
        // Vizinhas ruins na mesma área — só se ficam no canteiro ao mesmo tempo
        // (se as duas estão posicionadas, só conta se ficarem a menos de 1 m)
        const minhas = celsDe(e, z.id, bordas);
        const ruins = ents.filter(o => o.id && o.id !== id && saoInimigas(id, o.id) && seCruzam(ativos, o.ativos) &&
          (!e.pos.length || !o.pos.length || pertoCels(e.pos, o.pos)));
        if (ruins.length) problemas.push({ nivel: 'mal', texto: `⚠️ Não combina com ${[...new Set(ruins.map(o => nomePlanta(o.id)))].join(', ')} (mesma área, mesma época)` });
        // Vizinhas ruins nas áreas próximas
        for (const v of vizinhas) {
          const ruinsV = (entradasPorZona[v.id] || []).filter(o => o.id && saoInimigas(id, o.id) && seCruzam(ativos, o.ativos) &&
            ((!e.pos.length && !o.pos.length) || pertoCels(minhas, celsDe(o, v.id, bordas))));
          const nomes = [...new Set(ruinsV.map(o => nomePlanta(o.id)))];
          if (nomes.length) problemas.push({ nivel: 'atencao', texto: `⚠️ ${nomes.join(', ')} ${nomes.length > 1 ? 'estão' : 'está'} perto, em ${v.nome}` });
        }
        // Rotação de culturas
        const rot = conflitoRotacao(z.id, p, inicio, ativos, ents, entrada);
        if (rot) problemas.push({ nivel: 'atencao', texto: `🔄 Rotação: ${rot} — melhor alternar com outra família` });
        // Mesma cultura em outro canteiro, nos mesmos meses
        // (flores companheiras, como tagetes e capuchinha, podem — e devem — se repetir)
        const outrasZonas = p.cat === 'flores' ? [] : estado.zonas.filter(o => o.id !== z.id &&
          (entradasPorZona[o.id] || []).some(x => x.id === id && seCruzam(ativos, x.ativos)));
        if (outrasZonas.length) {
          problemas.push({ nivel: 'atencao', texto: `🔁 ${p.nome} também está em ${outrasZonas.map(o => o.nome).join(', ')} na mesma época — que tal outra cultura aqui?` });
        }
        // Época de plantio
        if (!p.perene && !mesesDeIrProCanteiro(p).includes(inicio)) {
          problemas.push({ nivel: 'atencao', texto: `📅 Plantar em ${MESES[inicio - 1].toLowerCase()} está fora de época (época: ${faixaMeses(mesesDeIrProCanteiro(p))})` });
        }
        // Possível, mas não é o melhor mês
        if (!p.perene && temMelhor(p) && mesesDeIrProCanteiro(p).includes(inicio) && !mesesBons(p).includes(inicio)) {
          problemas.push({ nivel: 'info', texto: `📅 ${MESES[inicio - 1]} dá, mas a melhor época é ${faixaMeses(mesesBons(p))}` });
        }
        // Geada
        const frio = geada.filter(m => ativos.has(m));
        if (p.geada && frio.length) {
          problemas.push({ nivel: 'atencao', texto: `❄️ Fica no canteiro em ${faixaMeses(frio)}, época de geada — proteja ou mude o mês de plantio` });
        }
      }
      mal += problemas.filter(x => x.nivel === 'mal').length;
      atencao += problemas.filter(x => x.nivel === 'atencao').length;
      plantas.push({ entrada, id, problemas, pes, sugestao, maximo, inicio, status, ativos, areaPe: p ? areaDePe(p) : 0, pos: e.pos, posArea: e.posArea });
    }
    if (mesesExcesso.length) mal++;
    const usado = usoMes[mes];
    porZona[z.id] = {
      zonaId: z.id, plantas, mal, atencao, area, horas, vizinhas, usoMes, mesesExcesso,
      usado, livre: area - usado, excesso: usado > area + 1e-9, semQtd: semQtdMes[mes],
    };
  }
  cacheAnalise = { mes: mesSol, porZona, viz, sol, entradasPorZona, cont };
  return cacheAnalise;
}

// Situação do canteiro no mês: livre, cabe mais ou cheio.
// Plantas sem quantidade contam com a quantidade mínima que vale a pena (minPes).
// Cores: cheio = verde (é o objetivo), cabe mais = amarelo, livre = azul. Vermelho só para problemas.
const SITUACAO = {
  livre:  { icone: '🔵', nome: 'livre' },
  espaco: { icone: '🟡', nome: 'cabe mais' },
  cheio:  { icone: '🟢', nome: 'cheio' },
};
function situacaoEspaco(zonaId) {
  const z = zonaPorId(zonaId);
  if (!z || !TIPOS_PLANTAVEIS.includes(z.tipo)) return null;
  const an = analiseHorta();
  const m = mesSol + 1;
  const lado = estado.tamanhoCelulaCm / 100;
  const area = (an.cont[zonaId] || 0) * lado * lado;
  const ents = (an.entradasPorZona[zonaId] || []).filter(e => e.p && e.ativos.has(m));
  if (!ents.length) return { tipo: 'livre', ...SITUACAO.livre, livre: area, area };
  const ocupado = ents.reduce((s, e) => s + (e.pos.length ? e.posArea : (e.qtd || minPes(e.p)) * areaDePe(e.p)), 0);
  const livre = Math.max(0, area - ocupado);
  const tipo = livre < area * 0.15 ? 'cheio' : 'espaco';
  return { tipo, ...SITUACAO[tipo], livre, area };
}

// Lista de sugestões (ou resultados da busca) para uma área
// opc.mes: avaliar outro mês (ex.: quando a muda da bandeja fica pronta); opc.todas: ignora “Só favoritos”
function sugestoesPara(z, texto, opc = {}) {
  const an = analiseHorta();
  const mes = opc.mes || mesSol + 1;
  const ids = idsDaZona(z);
  const horas = an.sol[z.id] ? an.sol[z.id].media : null;
  const cont = contarCelulas();
  const lado = estado.tamanhoCelulaCm / 100;
  const area = (cont[z.id] || 0) * lado * lado;
  const vizinhas = [...(an.viz[z.id] || [])].map(zonaPorId).filter(Boolean);
  // Plantas (com seus meses no canteiro) desta área e das vizinhas
  const entsAqui = an.entradasPorZona[z.id] || [];
  const entsViz = vizinhas.flatMap(v => (an.entradasPorZona[v.id] || []).map(e => ({ ...e, zona: v })));
  const usoMes = an.porZona[z.id]?.usoMes;
  const t = normalizar(texto);

  let lista = todasPlantas().filter(p => !ids.includes(p.id));
  if (t) lista = lista.filter(p => [p.nome, ...(p.alias || [])].some(n => normalizar(n).includes(t)));
  else if (!opc.todas && soListaPlano && temFavoritos()) lista = lista.filter(p => naLista(p.id));

  const res = lista.map(p => {
    let pontos = 0, ok = true;
    const motivos = [];
    // Ela entraria no canteiro no mês planejado (ou no próximo mês bom)
    const inicio = inicioPadrao(p, mes);
    const ativos = mesesAtivos(p, inicio);
    const junto = entsAqui.filter(o => o.id && seCruzam(ativos, o.ativos)).map(o => o.id);
    const juntoViz = entsViz.filter(o => o.id && seCruzam(ativos, o.ativos));
    if (mesesBons(p).includes(mes)) { pontos += 3; if (temMelhor(p)) motivos.push({ nivel: 'bem', texto: '📅 melhor época' }); }
    else if (mesesDeIrProCanteiro(p).includes(mes)) { pontos += 1; motivos.push({ nivel: 'info', texto: `📅 possível; melhor em ${faixaMeses(mesesBons(p))}` }); }
    else { ok = false; motivos.push({ nivel: 'atencao', texto: `📅 época: ${faixaMeses(mesesDeIrProCanteiro(p))}` }); }

    if (horas === null || horas >= p.sol) { pontos += 2; if (horas !== null) motivos.push({ nivel: 'bem', texto: `${NIVEIS_SOL[p.sol]?.icone || '☀️'} sol ok` }); }
    else if (horas >= p.sol - 1.5) { pontos -= 1; motivos.push({ nivel: 'atencao', texto: '⛅ sol um pouco curto' }); }
    else { ok = false; motivos.push({ nivel: 'mal', texto: `☁️ precisa de ${p.sol} h de sol` }); }

    const etiquetas = [];
    const ruins = [...new Set(junto.filter(o => saoInimigas(p.id, o)))];
    if (ruins.length) { pontos -= 6; etiquetas.push({ tipo: 'ruim', texto: `🚫 não combina com ${ruins.map(nomePlanta).join(', ')}` }); }
    const boas = [...new Set(junto.filter(o => saoAmigas(p.id, o)))];
    if (boas.length) { pontos += 2 * boas.length; motivos.push({ nivel: 'bem', texto: `🤝 combina com ${boas.map(nomePlanta).join(', ')}` }); }

    const ruinsV = [...new Set(juntoViz.filter(v => saoInimigas(p.id, v.id)).map(v => v.id))];
    if (ruinsV.length) { pontos -= 2; etiquetas.push({ tipo: 'perto', texto: `⚠️ ${ruinsV.map(nomePlanta).join(', ')} no canteiro vizinho` }); }
    const boasV = [...new Set(juntoViz.filter(v => saoAmigas(p.id, v.id)).map(v => v.id))].filter(id => !boas.includes(id));
    if (boasV.length) { pontos += Math.min(3, boasV.length); motivos.push({ nivel: 'bem', texto: `🤝 vizinha de ${boasV.slice(0, 3).map(nomePlanta).join(', ')}` }); }

    // Espaço livre: igual à etiqueta do canteiro — plantas sem quantidade contam com o mínimo que vale a pena
    const usoComMinimo = m => entsAqui.reduce((s, e) => s + (!e.p || !e.ativos.has(m) ? 0
      : e.pos.length ? e.posArea : (e.qtd || minPes(e.p)) * areaDePe(e.p)), 0);
    const livre = Math.max(0, Math.min(...[...ativos].map(m => area - usoComMinimo(m))));
    const cabem = Math.floor(livre / areaDePe(p) + 1e-9);
    if (cabem < 1) { ok = false; motivos.push({ nivel: 'mal', texto: livre < area ? '📏 não cabe no espaço livre' : '📏 precisa de mais espaço' }); }
    else if (cabem < minPes(p)) { ok = false; motivos.push({ nivel: 'mal', texto: `📏 só cabem ${cabem}` }); }
    else if (livre < area) motivos.push({ nivel: 'info', texto: `📏 cabem até ${cabem}` });
    const rotS = conflitoRotacao(z.id, p, inicio, ativos, entsAqui, null);
    if (rotS) { pontos -= 3; motivos.push({ nivel: 'atencao', texto: `🔄 ${rotS.split(' (mesma')[0]} (mesma família)` }); }
    // Evita repetir a mesma cultura em outro canteiro na mesma época
    const repetida = p.cat === 'flores' ? [] : repetidaEmOutras(an, z.id, p.id, ativos);
    if (repetida.length) { pontos -= 4; etiquetas.push({ tipo: 'repetida', texto: `🔁 já plantada em ${repetida.slice(0, 2).map(v => v.nome).join(', ')}` }); }
    if (naLista(p.id)) pontos += 1;
    return { p, ok, pontos, motivos, etiquetas };
  });

  return (t ? res : res.filter(r => r.ok))
    .sort((a, b) => (b.ok - a.ok) || (a.etiquetas.length - b.etiquetas.length) || (b.pontos - a.pontos) || a.p.nome.localeCompare(b.p.nome, 'pt'))
    .slice(0, t ? 25 : 999);
}

// ---------------------------------------------------------------------
//  Painel "Plantas desta área" (aba Mapa)
// ---------------------------------------------------------------------

// Grupos das sugestões
const GRUPOS_SUGESTAO = [
  { id: 'vegetais', nome: 'Vegetais', icone: '🥬' },
  { id: 'frutas', nome: 'Frutas', icone: '🍓' },
  { id: 'ervas', nome: 'Ervas e temperos', icone: '🌿' },
  { id: 'graos', nome: 'Grãos e feijões', icone: '🌾' },
  { id: 'flores', nome: 'Flores companheiras', icone: '🌼' },
];
const FRUTAS = ['morango', 'melancia', 'melao', 'physalis'];
const grupoDaPlanta = p => (FRUTAS.includes(p.id) ? 'frutas' : GRAOS.includes(p.id) ? 'graos' : p.cat === 'ervas' ? 'ervas' : p.cat === 'flores' ? 'flores' : 'vegetais');
const POR_GRUPO = 4;                 // quantas aparecem antes do "ver mais"
const gruposAbertos = new Set();     // grupos com "ver mais" aberto

function linhaSugestao(r) {
  const etiquetas = r.etiquetas.map(t => `<span class="tag-sug ${t.tipo}">${escapar(t.texto)}</span>`).join('');
  return `<button class="sug ${r.ok ? '' : 'ruim'} ${r.etiquetas.length ? 'com-etiqueta' : ''}" data-add-planta="${escapar(r.p.id)}">
      <span class="e">${escapar(r.p.emoji)}</span>
      <span class="n"><b>${escapar(r.p.nome)}</b>${naLista(r.p.id) ? ' <span class="estrela">★</span>' : ''}${r.p.nativa ? ' <span class="selo-nativa mini">nativa</span>' : ''}
        ${etiquetas ? `<span class="etiquetas">${etiquetas}</span>` : ''}
        <span class="motivos">${r.motivos.slice(0, 3).map(m => `<span class="${m.nivel}">${escapar(m.texto)}</span>`).join('')}</span></span>
      <span class="mais">+</span>
    </button>`;
}

function htmlSugestoes(z) {
  const lista = sugestoesPara(z, buscaPlanta);
  if (buscaPlanta) {
    const livre = !lista.some(r => normalizar(r.p.nome) === normalizar(buscaPlanta))
      ? `<button class="sug livre" data-add-texto="${escapar(buscaPlanta)}"><span class="e">✏️</span><span class="n">Adicionar “${escapar(buscaPlanta)}” <span class="motivos"><span class="info">sem dados do catálogo</span></span></span><span class="mais">+</span></button>`
      : '';
    return `<div class="rotulo">Resultados para “${escapar(buscaPlanta)}”</div>${lista.map(linhaSugestao).join('')}${livre}`;
  }
  if (!lista.length) {
    return `<div class="rotulo">Sugestões para ${MESES[mesSol].toLowerCase()}</div><p class="nota">${soListaPlano && temFavoritos() ? 'Nenhum favorito serve aqui agora. Desmarque “Só favoritos” para ver outras.' : 'Nenhuma planta serve aqui neste mês.'}</p>`;
  }
  let html = `<div class="rotulo">Sugestões para ${MESES[mesSol].toLowerCase()}${soListaPlano && temFavoritos() ? ' (favoritos)' : ''} · ${lista.length}</div>`;
  for (const g of GRUPOS_SUGESTAO) {
    const doGrupo = lista.filter(r => grupoDaPlanta(r.p) === g.id);
    if (!doGrupo.length) continue;
    const aberto = gruposAbertos.has(g.id);
    const mostrar = aberto ? doGrupo : doGrupo.slice(0, POR_GRUPO);
    html += `<div class="grupo-sug"><div class="grupo-sug-titulo">${g.icone} ${g.nome} <span class="qtd">${doGrupo.length}</span></div>
      ${mostrar.map(linhaSugestao).join('')}
      ${doGrupo.length > POR_GRUPO ? `<button class="ver-mais" data-ver-mais="${g.id}">${aberto ? '▲ Ver menos' : `▼ Ver mais ${doGrupo.length - POR_GRUPO}`}</button>` : ''}
    </div>`;
  }
  return html;
}

// Plantas da área que o usuário desligou no filtro de companheiras ("zona:id")
const compDesligadas = new Set();
const COMP_INICIAIS = 8;          // companheiras mostradas antes do "ver mais"
const compTodas = new Set();      // canteiros com todas as companheiras à mostra
const plantasAbertas = new Set(); // "zona|entrada" das plantas abertas (com todos os controles)
let adicionarZona = null;         // canteiro com a parte "＋ Adicionar planta" aberta

// Companheiras com base em TODAS as plantas da área (as ligadas no filtro)
function htmlCompanheiras(z) {
  const ids = idsDaZona(z);
  if (!ids.length) return '';
  const ativos = ids.filter(id => !compDesligadas.has(`${z.id}:${id}`));
  const mes = mesSol + 1;
  const an = analiseHorta();
  const horas = an.sol[z.id] ? an.sol[z.id].media : 12;
  const cabe = q => naEpoca(q, mes) && horas >= q.sol - 1.5;

  const candidatas = [];
  const evitar = new Set();
  for (const q of todasPlantas()) {
    if (ids.includes(q.id)) continue;
    const ruins = ids.filter(a => saoInimigas(q.id, a));   // conflito vale com qualquer planta da área
    if (ruins.some(a => ativos.includes(a))) { evitar.add(q.id); continue; }
    if (ruins.length) continue;
    const boas = ativos.filter(a => saoAmigas(q.id, a));
    if (boas.length) candidatas.push({ q, boas });
  }
  candidatas.sort((a, b) => (b.boas.length - a.boas.length) || (cabe(b.q) - cabe(a.q)) ||
    (naLista(b.q.id) - naLista(a.q.id)) || a.q.nome.localeCompare(b.q.nome, 'pt'));

  const filtro = ids.map(id => {
    const p = plantaPorId(id);
    const on = ativos.includes(id);
    return `<button class="filtro-comp ${on ? 'on' : ''}" data-filtro-comp="${escapar(id)}"
      title="${on ? 'Clique para ignorar esta planta nas sugestões' : 'Clique para considerar esta planta'}">${on ? '✓' : '○'} ${escapar(p.emoji)} ${escapar(p.nome)}</button>`;
  }).join('');

  const todas = compTodas.has(z.id);
  const chips = candidatas.slice(0, todas ? 999 : COMP_INICIAIS).map(({ q, boas }) => {
    const motivo = `combina com ${boas.map(nomePlanta).join(', ')}` +
      (cabe(q) ? '' : ` — fora de época ou sol curto agora (época: ${faixaMeses([...q.sem, ...q.tr])})`);
    return `<button class="chip-add ${cabe(q) ? '' : 'fora'}" data-add-planta="${escapar(q.id)}" title="${escapar(motivo)}">` +
      `${escapar(q.emoji)} ${escapar(q.nome)}${ativos.length > 1 ? ` <span class="qtd">${boas.length}</span>` : ''} +</button>`;
  }).join('');

  const viz = an.porZona[z.id]?.vizinhas || [];
  return `<div class="companheiras">
    <div class="titulo">🤝 Combinam com o que já está aqui</div>
    <div class="filtros-comp">${filtro}</div>
    <div class="chips">${!ativos.length ? '<span class="nota">Ligue pelo menos uma planta acima.</span>' : chips || '<span class="nota">Nenhuma companheira conhecida para essa combinação.</span>'}
      ${ativos.length && candidatas.length > COMP_INICIAIS ? `<button class="ver-mais" data-comp-todas>${todas ? '▲ Ver menos' : `▼ Ver mais ${candidatas.length - COMP_INICIAIS}`}</button>` : ''}</div>
    ${ativos.length > 1 && chips ? '<div class="nota">O número = com quantas das marcadas ela combina (' + TXT.passe.toLowerCase() + ' para ver quais).</div>' : ''}
    ${viz.length && chips ? `<div class="nota">Também servem nas vizinhas: ${viz.map(v => escapar(v.nome)).join(', ')}.</div>` : ''}
    ${evitar.size ? `<div class="evitar">🚫 Manter longe: ${[...evitar].map(nomePlanta).sort((a, b) => a.localeCompare(b, 'pt')).join(', ')}</div>` : ''}
  </div>`;
}

// Faixa curta no topo: sol do mês, quanto está ocupado e o botão ✨ Sugerir
function htmlResumoArea(z, info, st, cl) {
  const linhaSol = cl ? `<span title="${estado.norteDefinido ? '' : 'O norte ainda não foi definido (aba Sol e sombra): horas aproximadas'}">${cl.icone} <b>${fmt(st.media, 1)} h</b> de sol · ${cl.nome}${estado.norteDefinido ? '' : '*'}</span>` : '<span></span>';
  const sugerir = TIPOS_PLANO.includes(z.tipo) ? '<button class="btn-sugerir mini" data-sugerir-plano="zona" title="Sugerir plano para este canteiro">✨ Sugerir</button>' : '';
  let ocup = '';
  if (info && info.area) {
    const pct = Math.round(info.usado / info.area * 100);
    const sit = situacaoEspaco(info.zonaId);
    const texto = info.usado <= 0
      ? `${fmt(info.area, 1)} m² · vazio`
      : info.excesso
        ? `⚠️ plantas demais: ${fmt(info.usado, 1)} m² em ${fmt(info.area, 1)} m²`
        : `${pct}% ocupado · ${fmt(info.livre, 1)} m² livres`;
    ocup = `<div class="barra"><span style="width:${Math.min(100, pct)}%"></span></div>
      <div class="sit-linha ${sit ? sit.tipo : ''}">${sit ? sit.icone + ' ' : ''}${texto}</div>
      ${info.mesesExcesso.length && !info.excesso ? `<div class="mal-txt">⚠️ Passa do espaço em ${faixaMeses(info.mesesExcesso)}</div>` : ''}
      ${info.semQtd > 1 && info.livre > 0 ? '<button class="pequeno" data-preencher>💡 Usar as quantidades sugeridas em todas</button>' : ''}`;
  }
  return `<div class="resumo-area ${info && info.excesso ? 'mal' : ''}"><div class="linha1">${linhaSol}${sugerir}</div>${ocup}</div>`;
}

function definirQuantidade(entrada, n) {
  const z = zonaPorId(zonaAtiva);
  if (!z) return;
  n = Math.max(0, Math.floor(Number(n) || 0));
  if ((z.qtd[entrada] || 0) === n) return;
  registrar();
  if (n > 0) z.qtd[entrada] = n; else delete z.qtd[entrada];
  mudou();
}

// Sucessão: mais um plantio da mesma planta, no primeiro mês bom depois da última colheita
function plantarDeNovo(entrada) {
  const z = zonaPorId(zonaAtiva);
  const id = idDaEntrada(entrada);
  const p = id && plantaPorId(id);
  if (!z || !p) return;
  const mesmas = entradasDaZona(z).filter(e => e.id === id);
  const ocupados = new Set(mesmas.flatMap(e => [...e.ativos]));
  const ultima = mesmas.find(e => e.entrada === entrada) || mesmas[mesmas.length - 1];
  const fim = mesMais(ultima.inicio, cicloDe(p).c1);
  const bons = mesesDeIrProCanteiro(p);
  let mes = null;
  for (let k = 1; k <= 12 && !mes; k++) {
    const m = mesMais(fim, k);
    if (bons.length && !bons.includes(m)) continue;
    if (!seCruzam(mesesAtivos(p, m), ocupados)) mes = m;
  }
  if (!mes) {
    avisar(`Não sobra nenhum mês na época de ${p.nome} sem sobrepor os plantios que já estão aqui. Mude o mês de um deles para abrir espaço.`);
    return;
  }
  let n = 2;
  while (z.plantas.includes(`${id}#${n}`)) n++;
  const nova = `${id}#${n}`;
  registrar();
  // entra logo depois do último plantio desta planta na lista
  const ultimoIdx = Math.max(...z.plantas.map((t, i) => idDaEntrada(t) === id ? i : -1));
  z.plantas.splice(ultimoIdx + 1, 0, nova);
  z.plantio[nova] = mes;
  if (z.qtd[ultima.entrada]) z.qtd[nova] = z.qtd[ultima.entrada];
  mudou();
  avisar(`${rotuloEntrada(z, nova)}: plantar em ${MESES[mes - 1].toLowerCase()}, ${ehFlor(p) ? 'flores' : 'colher'} em ${faixaMeses([...mesesAtivos(p, mes)].filter(m => statusNoMes(p, mes, m) === 'colher'))}.`);
}

// ---- Posicionar plantas dentro do canteiro ----
let posicionando = null;
let apagandoPos = false;   // 🧽 no painel: apagar posição (no computador, Alt também apaga)   // { zona, entrada } enquanto a pessoa pinta a posição

function htmlPosicao(z, x) {
  if (!x.id) return '';
  const ativo = posicionando && posicionando.zona === z.id && posicionando.entrada === x.entrada;
  const tem = x.pos && x.pos.length;
  return `<div class="pos-linha">
    ${tem ? `<span>📍 ${fmt(x.posArea, 2)} m² marcados</span>` : ''}
    <button class="pos-btn ${ativo ? 'on' : ''}" data-posicionar="${escapar(x.entrada)}" title="Pinte no mapa o lugar desta planta dentro do canteiro">${ativo ? '✓ Concluir' : tem ? '📍 Mudar lugar' : '📍 Marcar no canteiro'}</button>
    ${ativo ? `<button class="pos-btn ${apagandoPos ? 'on' : ''}" data-apagar-pos title="Apagar partes da posição">🧽 ${apagandoPos ? 'apagando' : 'apagar'}</button>` : ''}
    ${tem && !ativo ? `<button class="pos-btn" data-limpar-pos="${escapar(x.entrada)}" title="Tirar a posição">limpar</button>` : ''}
  </div>`;
}

function alternarPosicionar(entrada) {
  const z = zonaPorId(zonaAtiva);
  if (!z) return;
  if (posicionando && posicionando.entrada === entrada && posicionando.zona === z.id) posicionando = null;
  else {
    posicionando = { zona: z.id, entrada };
    if (tamPincel > 3) tamPincel = 2;
    apagandoPos = false;
    avisar(`📍 Pinte no canteiro onde fica ${rotuloEntrada(z, entrada)}. Para apagar, toque em 🧽${TOQUE ? '' : ' (ou segure Alt)'}. “✓ Concluir” para terminar.`);
  }
  atualizarPaineis();
  desenhar();
}

// Pinta (ou apaga) a posição da planta; só dentro do próprio canteiro.
// Um quadrado não pode ter duas plantas ao mesmo tempo: quem estava lá nos mesmos meses perde o quadrado.
function pintarPosicao(c, r, apagar) {
  const z = zonaPorId(posicionando && posicionando.zona);
  if (!z) return false;
  const ent = entradasDaZona(z);
  const eu = ent.find(e => e.entrada === posicionando.entrada);
  if (!eu) return false;
  z.pos = z.pos || {};
  const minha = new Set(z.pos[eu.entrada] || []);
  let alterou = false;
  const off = Math.floor((tamPincel - 1) / 2);
  for (let dr = 0; dr < tamPincel; dr++) {
    for (let dc = 0; dc < tamPincel; dc++) {
      const cc = c - off + dc, rr = r - off + dr;
      if (!dentro(cc, rr) || estado.celulas[idx(cc, rr)] !== z.id) continue;
      const i = idx(cc, rr);
      if (apagar) { if (minha.delete(i)) alterou = true; continue; }
      if (minha.has(i)) continue;
      minha.add(i);
      alterou = true;
      for (const o of ent) {
        if (o.entrada === eu.entrada || !seCruzam(eu.ativos, o.ativos) || !z.pos[o.entrada]) continue;
        z.pos[o.entrada] = z.pos[o.entrada].filter(x => x !== i);
      }
    }
  }
  z.pos[eu.entrada] = [...minha];
  return alterou;
}

// Cor própria de cada planta (sempre a mesma)
function corDaPlanta(id) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

// Desenha as plantas posicionadas: área colorida + o emoji repetido no espaçamento da planta
function desenharPosicoes(g, s, X, Y) {
  const m = mesSol + 1;
  const L = estado.tamanhoCelulaCm;
  const cols = estado.cols;
  for (const z of estado.zonas) {
    if (!TIPOS_PLANTAVEIS.includes(z.tipo) || !z.pos) continue;
    const selZona = posicionando && posicionando.zona === z.id;
    const ents = entradasDaZona(z);
    const sel = selZona ? ents.find(e => e.entrada === posicionando.entrada) : null;
    for (const e of ents) {
      if (!e.p || !e.pos.length) continue;
      const ativo = statusNoMes(e.p, e.inicio, m);
      const eSel = sel && e.entrada === sel.entrada;
      // fora do mês: só aparece (bem clarinha) enquanto se posiciona outra planta da mesma época
      if (!ativo && !eSel && !(sel && seCruzam(sel.ativos, e.ativos))) continue;
      const h = corDaPlanta(e.id);
      g.fillStyle = `hsla(${h}, 55%, 58%, ${eSel ? 0.75 : ativo ? 0.5 : 0.22})`;
      for (const i of e.pos) {
        const c = i % cols, r = (i - c) / cols;
        g.fillRect(X(c), Y(r), X(c + 1) - X(c), Y(r + 1) - Y(r));
      }
      // emojis no espaçamento da planta
      let sx = Math.max(1, Math.round(e.p.esp[0] / L)), sy = Math.max(1, Math.round(e.p.esp[1] / L));
      if (s * sx < 13) sx = Math.ceil(13 / s);
      if (s * sy < 13) sy = Math.ceil(13 / s);
      const tam = Math.min(18, s * Math.min(sx, sy) * 0.8);
      if (tam < 8) continue;
      g.font = `${tam}px system-ui, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.globalAlpha = ativo || eSel ? 1 : 0.35;
      for (const i of e.pos) {
        const c = i % cols, r = (i - c) / cols;
        if (c % sx || r % sy) continue;
        g.fillText(e.p.emoji, (X(c) + X(c + 1)) / 2, (Y(r) + Y(r + 1)) / 2);
      }
      g.globalAlpha = 1;
      g.textAlign = 'left';
    }
  }
}

function definirPlantio(zonaId, entrada, mes) {
  const z = zonaPorId(zonaId);
  if (!z) return;
  registrar();
  z.plantio[entrada] = Number(mes);
  mudou();
}

function renderPlantio(z) {
  // trocou de canteiro (ou de aba): para de posicionar
  if (posicionando && (!z || posicionando.zona !== z.id || modo !== 'mapa' || editandoDesenho)) posicionando = null;
  const box = $('zPlantio');
  if (!z || !TIPOS_PLANTAVEIS.includes(z.tipo)) { box.innerHTML = ''; return; }
  const an = analiseHorta();
  const info = an.porZona[z.id];
  const st = an.sol[z.id];
  const cl = st ? classeSol(st.media) : null;

  if (adicionarZona !== null && adicionarZona !== z.id) adicionarZona = null;
  const abrirAdicionar = adicionarZona === z.id || !(z.plantas || []).length || !!buscaPlanta;
  const linhas = (info?.plantas || []).map(x => {
    const p = x.id && plantaPorId(x.id);
    const nivel = x.problemas.some(q => q.nivel === 'mal') ? 'mal' : x.problemas.some(q => q.nivel === 'atencao') ? 'atencao' : '';
    const e = escapar(x.entrada);
    // Cartão aberto: o que ela faz no mês, depois uma tabelinha (pés, mês, colheita) e os botões
    let detalheHtml = '';
    if (p) {
      const colheita = [...x.ativos].filter(m => statusNoMes(p, x.inicio, m) === 'colher');
      const st = x.status ? STATUS[statusVisto(p, x.status)] : null;
      const pes = x.pes
        ? `<input type="number" min="0" step="1" class="qtd" data-qtd="${e}" value="${x.pes}" title="Quantos pés você quer plantar">
           <span>${fmt(x.pes * x.areaPe, 2)} m² · <span class="max ${x.pes > x.maximo ? 'mal' : ''}">${x.pes > x.maximo ? `cabem só ${x.maximo}` : `máx. ${x.maximo}`}</span></span>`
        : `<input type="number" min="0" step="1" class="qtd" data-qtd="${e}" placeholder="${x.sugestao || 0}" title="Quantos pés você quer plantar">
           ${x.sugestao > 0 ? `<button class="usar" data-usar-sug="${e}" data-n="${x.sugestao}" title="Dividindo igualmente o espaço livre entre as plantas sem quantidade">💡 usar ~${x.sugestao}</button>` : ''}`;
      const mes = `<select data-plantio="${e}" title="Mês em que ela vai para o canteiro (“·” = fora da época)">${MESES_CURTOS.map((m, i) =>
        `<option value="${i + 1}" ${i + 1 === x.inicio ? 'selected' : ''}>${m}${mesesDeIrProCanteiro(p).includes(i + 1) ? '' : ' ·'}</option>`).join('')}</select>`;
      const fim = p.perene ? 'a partir de ' + MESES_CURTOS[mesMais(x.inicio, cicloDe(p).c0) - 1] : faixaMeses(colheita);
      detalheHtml = `
        <div class="agora-st">${st ? `${st.icone} ${st.nome} em ${MESES[mesSol].toLowerCase()}` : `Fora do canteiro em ${MESES[mesSol].toLowerCase()}`}</div>
        <div class="grade-planta">
          <span class="rot">Pés</span><span class="val">${pes}</span>
          <span class="rot">Ciclo</span><span class="val" title="Mês de plantio → ${ehFlor(p) ? 'flores' : 'colheita'}">${mes} → ${ehFlor(p) ? '🌸' : '🧺'} ${fim}</span>
        </div>
        <div class="acoes-planta">
          ${p.perene ? '' : `<button class="de-novo" data-sucessao="${e}" title="Adicionar outro plantio desta planta depois da colheita">🔁 Plantar de novo</button>`}
          ${'' /* 📍 Marcar no canteiro: escondido por enquanto (htmlPosicao) */}
        </div>`;
    }
    const chave = `${z.id}|${x.entrada}`;
    const aberta = plantasAbertas.has(chave) || (posicionando && posicionando.zona === z.id && posicionando.entrada === x.entrada);
    let resumo = '';
    if (p) {
      const colheita = [...x.ativos].filter(m => statusNoMes(p, x.inicio, m) === 'colher');
      const fim = p.perene ? 'a partir de ' + MESES_CURTOS[mesMais(x.inicio, cicloDe(p).c0) - 1] : faixaMeses(colheita);
      resumo = `${x.pes ? `${x.pes} ${x.pes === 1 ? 'pé' : 'pés'}` : '<i>sem quantidade</i>'} · ${MESES_CURTOS[x.inicio - 1]} → ${ehFlor(p) ? '🌸' : '🧺'} ${fim}`;
    } else resumo = 'não está no catálogo';
    const aviso = nivel === 'mal' ? '⛔' : nivel === 'atencao' ? '⚠️' : '';
    const probs = x.problemas.filter(q => aberta || q.nivel === 'mal');
    return `<li class="${nivel} ${p && !x.status ? 'inativa' : ''} ${aberta ? 'aberta' : 'fechada'}">
      <span class="e">${p ? escapar(p.emoji) : '✏️'}</span>
      <div class="n">
        <button class="linha-planta" data-abrir-planta="${e}" title="${aberta ? 'Recolher' : 'Mostrar quantidade, mês e posição'}">
          <b>${escapar(rotuloEntrada(z, x.entrada))}</b> ${aviso}${aberta && p ? '' : `<span class="resumo">${resumo}</span>`}<span class="seta">${aberta ? '▾' : '▸'}</span></button>
        ${aberta ? detalheHtml : ''}
        ${probs.map(q => `<div class="prob ${q.nivel}">${escapar(q.texto)}</div>`).join('')}
      </div>
      ${p ? `<button class="ver" data-ver-planta="${escapar(p.id)}" title="Ver no catálogo">ⓘ</button>` : ''}
      <button class="x" data-remover-planta="${escapar(x.entrada)}" title="Tirar desta área">×</button>
    </li>`;
  }).join('');

  box.innerHTML = `
    <div class="plantio">
      <div class="plantio-topo">
        <h4>Plantas desta área</h4>
        <span class="mes-plano">em ${MESES[mesSol].toLowerCase()}</span>
      </div>
      ${htmlResumoArea(z, info, st, cl)}
      ${linhas ? `<ul class="plantas-area">${linhas}</ul>` : '<p class="nota">Nenhuma planta ainda. Escolha nas sugestões abaixo.</p>'}
      ${abrirAdicionar ? `<div class="adicionar">
        ${linhas ? '<button class="btn-adicionar on" data-alternar-adicionar>＋ Adicionar planta ▾</button>' : ''}
        ${htmlCompanheiras(z)}
        <input type="search" class="busca-planta" data-busca-planta placeholder="🔍 Buscar planta…" value="${escapar(buscaPlanta)}" autocomplete="off">
        ${temFavoritos() ? `<label class="check"><input type="checkbox" data-so-lista ${soListaPlano ? 'checked' : ''}> Só favoritos ★</label>` : ''}
        <div class="sugestoes" data-sugestoes>${htmlSugestoes(z)}</div>
      </div>` : '<button class="btn-adicionar" data-alternar-adicionar>＋ Adicionar planta ▸</button>'}
    </div>`;
}

function adicionarPlanta(entrada) {
  const z = zonaPorId(zonaAtiva);
  if (!z || (z.plantas || []).includes(entrada)) return;
  registrar();
  z.plantas = [...(z.plantas || []), entrada];
  const id = idDaEntrada(entrada);
  // Mês de plantio: o mês planejado, ou o próximo mês bom para ela
  if (id) z.plantio[entrada] = inicioPadrao(plantaPorId(id), mesSol + 1);
  ultimaAdicionada = id ? { zona: z.id, id } : null;
  plantasAbertas.add(`${z.id}|${entrada}`);
  buscaPlanta = '';
  mudou();
  // Avisa na hora se a escolha tem problema
  const x = analiseHorta().porZona[z.id]?.plantas.find(q => q.entrada === entrada);
  const serios = (x?.problemas || []).filter(q => q.nivel !== 'info');
  if (serios.length) avisar(`${nomePlanta(entrada)}: ${serios.map(q => q.texto).join(' · ')}`);
}

function montarPlano() {
  const box = $('zPlantio');
  box.addEventListener('click', ev => {
    const ab = ev.target.closest('[data-abrir-planta]');
    if (ab) {
      const k = `${zonaAtiva}|${ab.dataset.abrirPlanta}`;
      if (plantasAbertas.has(k)) plantasAbertas.delete(k); else plantasAbertas.add(k);
      renderPlantio(zonaPorId(zonaAtiva));
      return;
    }
    if (ev.target.closest('[data-alternar-adicionar]')) {
      adicionarZona = adicionarZona === zonaAtiva ? null : zonaAtiva;
      buscaPlanta = '';
      renderPlantio(zonaPorId(zonaAtiva));
      if (adicionarZona !== null) box.querySelector('[data-busca-planta]')?.focus({ preventScroll: true });
      return;
    }
    if (ev.target.closest('[data-comp-todas]')) {
      if (compTodas.has(zonaAtiva)) compTodas.delete(zonaAtiva); else compTodas.add(zonaAtiva);
      renderPlantio(zonaPorId(zonaAtiva));
      return;
    }
    const add = ev.target.closest('[data-add-planta]');
    if (add) { adicionarPlanta(add.dataset.addPlanta); return; }
    const addT = ev.target.closest('[data-add-texto]');
    if (addT) { adicionarPlanta(addT.dataset.addTexto.trim()); return; }
    const rem = ev.target.closest('[data-remover-planta]');
    if (rem) {
      const z = zonaPorId(zonaAtiva);
      if (!z) return;
      registrar();
      z.plantas = z.plantas.filter(t => t !== rem.dataset.removerPlanta);
      delete z.qtd[rem.dataset.removerPlanta];
      delete z.plantio[rem.dataset.removerPlanta];
      if (z.pos) delete z.pos[rem.dataset.removerPlanta];
      if (z.origem) delete z.origem[rem.dataset.removerPlanta];
      if (posicionando && posicionando.entrada === rem.dataset.removerPlanta) posicionando = null;
      if (ultimaAdicionada && ultimaAdicionada.id === idDaEntrada(rem.dataset.removerPlanta)) ultimaAdicionada = null;
      mudou();
      return;
    }
    const ver = ev.target.closest('[data-ver-planta]');
    if (ver) {
      plantaAtiva = ver.dataset.verPlanta;
      editandoPlanta = false;
      const antes = modo;
      trocarModo('plantas');
      if (antes !== modo) ajustar();
      selecionarPlanta(plantaAtiva);
      return;
    }
    const pos = ev.target.closest('[data-posicionar]');
    if (pos) { alternarPosicionar(pos.dataset.posicionar); return; }
    if (ev.target.closest('[data-apagar-pos]')) { apagandoPos = !apagandoPos; atualizarPaineis(); return; }
    const lp = ev.target.closest('[data-limpar-pos]');
    if (lp) { const z = zonaPorId(zonaAtiva); if (z && z.pos) { registrar(); delete z.pos[lp.dataset.limparPos]; mudou(); } return; }
    const vm = ev.target.closest('[data-ver-mais]');
    if (vm) { const g = vm.dataset.verMais; if (gruposAbertos.has(g)) gruposAbertos.delete(g); else gruposAbertos.add(g); box.querySelector('[data-sugestoes]').innerHTML = htmlSugestoes(zonaPorId(zonaAtiva)); return; }
    const suc = ev.target.closest('[data-sucessao]');
    if (suc) { plantarDeNovo(suc.dataset.sucessao); return; }
    const usar = ev.target.closest('[data-usar-sug]');
    if (usar) { definirQuantidade(usar.dataset.usarSug, usar.dataset.n); return; }
    if (ev.target.closest('[data-preencher]')) {
      const z = zonaPorId(zonaAtiva);
      const info = z && analiseHorta().porZona[z.id];
      if (!info) return;
      registrar();
      for (const x of info.plantas) if (x.sugestao > 0) z.qtd[x.entrada] = x.sugestao;
      mudou();
      return;
    }
    const filtro = ev.target.closest('[data-filtro-comp]');
    if (filtro) {
      const k = `${zonaAtiva}:${filtro.dataset.filtroComp}`;
      if (compDesligadas.has(k)) compDesligadas.delete(k); else compDesligadas.add(k);
      renderPlantio(zonaPorId(zonaAtiva));
    }
  });
  box.addEventListener('input', ev => {
    if (!ev.target.matches('[data-busca-planta]')) return;
    buscaPlanta = ev.target.value;
    box.querySelector('[data-sugestoes]').innerHTML = htmlSugestoes(zonaPorId(zonaAtiva));
  });
  box.addEventListener('keydown', ev => {
    if (ev.target.matches('[data-busca-planta]') && ev.key === 'Enter') {
      const primeiro = box.querySelector('[data-sugestoes] .sug');
      if (primeiro) primeiro.click();
    }
  });
  box.addEventListener('change', ev => {
    if (ev.target.matches('[data-qtd]')) { definirQuantidade(ev.target.dataset.qtd, ev.target.value); return; }
    if (ev.target.matches('[data-plantio]')) { definirPlantio(zonaAtiva, ev.target.dataset.plantio, ev.target.value); return; }
    if (ev.target.matches('[data-so-lista]')) { soListaPlano = ev.target.checked; renderPlantio(zonaPorId(zonaAtiva)); }
    if (ev.target.matches('[data-mes-plano]')) { mesSol = Number(ev.target.value); atualizarPaineis(); desenhar(); }
  });
}
