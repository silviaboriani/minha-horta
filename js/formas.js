'use strict';

// =====================================================================
//  Minha Horta — Desenhar com formas: canteiros como objetos
//  Arrastar no vazio cria; arrastar um canteiro move; alças mudam o tamanho;
//  duplicar; fileira de canteiros; medidas exatas; preencher caminhos.
//  Por baixo continua a mesma grade de 20 cm (estado.celulas).
// =====================================================================

let tipoNovaForma = 'canteiro';
// Jeito de desenhar a categoria escolhida
const FORMAS_DESENHO = [
  { id: 'ret', icone: '▭', nome: 'Retângulo' },
  { id: 'circulo', icone: '◯', nome: 'Círculo' },
  { id: 'linha', icone: '✎', nome: 'Linha' },
];
let formaDesenho = 'ret';
// Linha sendo desenhada, ponto a ponto: { pontos: [{ x, y }] } em quadrados (x = coluna, y = linha)
let tracado = null;
// Muro/cerca: a linha fica aberta (uma cerca de um quadrado de largura); o resto fecha numa área
const linhaAberta = () => tipoNovaForma === 'muro';
// Seleção de várias áreas (só no modo desenho): zonaAtiva + as "extras"
const zonasExtras = new Set();
function zonasSelecionadas() {
  if (!editandoDesenho) return zonaAtiva ? [zonaAtiva] : [];
  const ids = [zonaAtiva, ...zonasExtras].filter(id => id && zonaPorId(id));
  return [...new Set(ids)];
}
function limparSelecaoExtra() { zonasExtras.clear(); }
// Ctrl/⌘/Shift + clique: põe ou tira a área da seleção
function alternarNaSelecao(id) {
  const sel = zonasSelecionadas();
  if (sel.includes(id)) {
    if (zonaAtiva === id) { zonasExtras.delete(id); zonaAtiva = [...zonasExtras][0] ?? null; zonasExtras.delete(zonaAtiva); }
    else zonasExtras.delete(id);
  } else if (!zonaAtiva) zonaAtiva = id;
  else zonasExtras.add(id);
  atualizarPaineis();
}
const fileira = { n: 4, largura: 1.2, comprimento: 3, espaco: 0.6, direcao: 'lado' };

// ---------- Utilidades ----------
function celulasDaZona(id) {
  const res = [];
  estado.celulas.forEach((v, i) => { if (v === id) res.push(i); });
  return res;
}
function caixaDaZona(id) {
  const cols = estado.cols;
  let c0 = Infinity, c1 = -1, r0 = Infinity, r1 = -1, n = 0;
  estado.celulas.forEach((v, i) => {
    if (v !== id) return;
    n++;
    const c = i % cols, r = (i - c) / cols;
    if (c < c0) c0 = c; if (c > c1) c1 = c; if (r < r0) r0 = r; if (r > r1) r1 = r;
  });
  return n ? { c0, r0, c1, r1, n } : null;
}
const ehRetangulo = k => k && k.n === (k.c1 - k.c0 + 1) * (k.r1 - k.r0 + 1);
const ehCaminho = v => v > 0 && zonaPorId(v)?.tipo === 'caminho';
// Um canteiro pode ocupar quadrados vazios, de caminho, ou dele mesmo
const podeOcupar = (i, id) => { const v = estado.celulas[i]; return v === 0 || v === id || ehCaminho(v); };
// Parte da caixa que fica dentro do terreno (null se ficar toda fora)
function caixaNoTerreno(k) {
  const c0 = Math.max(0, k.c0), r0 = Math.max(0, k.r0), c1 = Math.min(estado.cols - 1, k.c1), r1 = Math.min(estado.rows - 1, k.r1);
  return c0 <= c1 && r0 <= r1 ? { c0, r0, c1, r1 } : null;
}
const celsDoRet = k => {
  const res = [];
  for (let r = k.r0; r <= k.r1; r++) for (let c = k.c0; c <= k.c1; c++) res.push(r * estado.cols + c);
  return res;
};
const retDentro = k => k.c0 >= 0 && k.r0 >= 0 && k.c1 < estado.cols && k.r1 < estado.rows && k.c0 <= k.c1 && k.r0 <= k.r1;
const medidaRet = k => `${fmt(metros(k.c1 - k.c0 + 1))} × ${fmt(metros(k.r1 - k.r0 + 1))} m`;

// Troca as células de uma área por outro conjunto (mover/redimensionar).
// Quadrados de caminho cobertos "trocam de lugar": o que fica livre vira caminho.
function trocarCelulasDaZona(z, novas) {
  const set = new Set(novas);
  if (novas.some(i => !podeOcupar(i, z.id))) return false;
  let caminho = 0;
  for (const i of novas) if (ehCaminho(estado.celulas[i])) { caminho = estado.celulas[i]; break; }
  if (!caminho) {
    // se o canteiro estava encostado num caminho, o espaço que sobra vira caminho
    const cols = estado.cols;
    for (const i of celulasDaZona(z.id)) {
      const c = i % cols, r = (i - c) / cols;
      for (const v of [celula(c - 1, r), celula(c + 1, r), celula(c, r - 1), celula(c, r + 1)]) if (ehCaminho(v)) { caminho = v; break; }
      if (caminho) break;
    }
  }
  for (const i of celulasDaZona(z.id)) if (!set.has(i)) estado.celulas[i] = caminho;
  for (const i of novas) estado.celulas[i] = z.id;
  return true;
}

function proximoNome(tipo) {
  const base = tipo === 'canteiro' ? 'Canteiro' : TIPOS[tipo].nome;
  let n = 0;
  for (const z of estado.zonas) {
    const m = z.nome.match(new RegExp('^' + base.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + ' (\\d+)$'));
    if (m) n = Math.max(n, Number(m[1]));
    else if (z.nome === base) n = Math.max(n, 1);
  }
  return tipo === 'canteiro' || n ? `${base} ${n + 1}` : base;
}

function criarZonaRet(k, tipo, modelo) { return criarZonaCelulas(celsDoRet(k), tipo, modelo); }

// Caminhos, muros e composteiras desenhados por cima de outro do mesmo tipo, ou encostados nele, viram uma coisa só
// (encostar conta para dar para emendar um muro começando ao lado da ponta). Canteiros não: cada um tem as suas plantas.
const TIPOS_QUE_JUNTAM = ['caminho', 'muro', 'composteira'];
const mesmoTipoQueJunta = (v, tipo) => v > 0 && TIPOS_QUE_JUNTAM.includes(tipo) && zonaPorId(v)?.tipo === tipo;
// Uma forma nova pode ocupar: o vazio, caminho, ou uma área do mesmo tipo (que junta)
const podeOcuparNova = (i, tipo) => podeOcupar(i, -1) || mesmoTipoQueJunta(estado.celulas[i], tipo);

// Quais áreas a forma nova junta: as do mesmo tipo embaixo dela ou encostadas (lado com lado).
// Pura: recebe os quadrados e a grade, devolve os ids, a maior primeiro.
function areasParaJuntar(cels, tipo, celulas, cols, contagem) {
  const perto = new Set();
  for (const i of cels) {
    const c = i % cols;
    perto.add(celulas[i]);
    if (c > 0) perto.add(celulas[i - 1]);
    if (c < cols - 1) perto.add(celulas[i + 1]);
    perto.add(celulas[i - cols]); perto.add(celulas[i + cols]);   // fora da grade dá undefined (não conta)
  }
  return [...perto].filter(v => mesmoTipoQueJunta(v, tipo))
    .sort((a, b) => (contagem[b] || 0) - (contagem[a] || 0) || a - b);
}

// Cria a forma nova, ou junta com as do mesmo tipo embaixo dela ou encostadas.
// Devolve { zona, juntou (quantas áreas), nada (desenhou só por cima do que já era dela), outras (as que sumiram) }.
function criarOuJuntar(cels, tipo) {
  if (!cels.length || cels.some(i => !podeOcuparNova(i, tipo))) return null;
  const ids = areasParaJuntar(cels, tipo, estado.celulas, estado.cols, contarCelulas());
  if (!ids.length) { const z = criarZonaCelulas(cels, tipo); return z && { zona: z, juntou: 0 }; }
  const [fica, ...outras] = ids, some = new Set(outras);
  const nada = !outras.length && cels.every(i => estado.celulas[i] === fica);
  const sumiram = estado.zonas.filter(z => some.has(z.id));
  for (const i of cels) estado.celulas[i] = fica;
  if (some.size) {
    estado.celulas = estado.celulas.map(v => (some.has(v) ? fica : v));
    estado.zonas = estado.zonas.filter(z => !some.has(z.id));
  }
  return { zona: zonaPorId(fica), juntou: ids.length, nada, outras: sumiram };
}

// Mensagem da junção; avisa quando um muro juntado tinha outra altura ou material (fica o da maior parte)
function textoJuntou(z, res) {
  const m2 = fmt(celulasDaZona(z.id).length * metros(1) * metros(1), 1);
  const diferente = z.tipo === 'muro' && res.outras.some(o => o.altura !== z.altura || (o.material || 'solido') !== (z.material || 'solido'));
  return `Juntado ${res.juntou > 1 ? `com ${res.juntou} áreas ` : ''}em “${z.nome}” (${m2} m²)` +
    (diferente ? ` — ficou tudo com ${fmt(z.altura, 1)} m${z.material === 'tela' ? ', de tela' : ''}, como a maior parte` : '') + '. Ctrl+Z desfaz.';
}
function criarZonaCelulas(cels, tipo, modelo) {
  if (!cels.length || cels.some(i => !podeOcupar(i, -1))) return null;
  const id = estado.proximoId++;
  const t = TIPOS[tipo];
  const z = {
    id, nome: proximoNome(tipo), tipo, cor: modelo?.cor || t.cor, plantas: [],
    altura: modelo?.altura ?? (tipo === 'muro' ? 1.5 : 0), grupo: modelo?.grupo ?? grupoAutoDe(tipo),
    qtd: {}, plantio: {}, pos: {}, origem: {},
  };
  estado.zonas.push(z);
  for (const i of cels) estado.celulas[i] = id;
  return z;
}

// ---------- Círculo e linha (funções puras: recebem medidas, devolvem quadrados) ----------
// Quadrados com o centro dentro da elipse que cabe na caixa k
function celsDoCirculo(k) {
  const cx = (k.c0 + k.c1 + 1) / 2, cy = (k.r0 + k.r1 + 1) / 2;
  const rx = (k.c1 - k.c0 + 1) / 2, ry = (k.r1 - k.r0 + 1) / 2;
  const res = [];
  for (let r = k.r0; r <= k.r1; r++) for (let c = k.c0; c <= k.c1; c++) {
    const dx = (c + 0.5 - cx) / rx, dy = (r + 0.5 - cy) / ry;
    if (dx * dx + dy * dy <= 1 && dentro(c, r)) res.push(r * estado.cols + c);
  }
  return res;
}
// Ponto (x, y) dentro do polígono? (raio horizontal: conta quantas bordas cruza)
function dentroDoPoligono(x, y, pts) {
  let dentroP = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) dentroP = !dentroP;
  }
  return dentroP;
}
// Área fechada: quadrados com o centro dentro do polígono
function celsDoPoligono(pts) {
  if (pts.length < 3) return [];
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const c0 = Math.max(0, Math.floor(Math.min(...xs))), c1 = Math.min(estado.cols - 1, Math.ceil(Math.max(...xs)));
  const r0 = Math.max(0, Math.floor(Math.min(...ys))), r1 = Math.min(estado.rows - 1, Math.ceil(Math.max(...ys)));
  const res = [];
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (dentroDoPoligono(c + 0.5, r + 0.5, pts)) res.push(r * estado.cols + c);
  return res;
}
// Linha aberta (muro/cerca): os quadrados por onde ela passa
function celsDaLinhaAberta(pts) {
  const set = new Set();
  const q = p => ({ c: Math.floor(p.x), r: Math.floor(p.y) });
  if (pts.length === 1) { const a = q(pts[0]); if (dentro(a.c, a.r)) set.add(a.r * estado.cols + a.c); }
  for (let i = 1; i < pts.length; i++) {
    const a = q(pts[i - 1]), b = q(pts[i]);
    linha(a.c, a.r, b.c, b.r, (c, r) => { if (dentro(c, r)) set.add(r * estado.cols + c); });
  }
  return [...set];
}
const celsDoTracado = pts => (linhaAberta() ? celsDaLinhaAberta(pts) : celsDoPoligono(pts));
// Só a borda de um conjunto de quadrados: os que têm um vizinho (em cima, embaixo, dos lados) fora dele
function contorno(cels) {
  const cols = estado.cols, s = new Set(cels);
  return cels.filter(i => { const c = i % cols; return !s.has(i - cols) || !s.has(i + cols) || c === 0 || c === cols - 1 || !s.has(i - 1) || !s.has(i + 1); });
}
// Quadrados de um retângulo ou círculo novo; muro e cerca ficam só com o contorno (como na Linha)
function celsDaNovaForma(forma, k, tipo) {
  const cels = forma === 'circulo' ? celsDoCirculo(k) : celsDoRet(k);
  return tipo === 'muro' ? contorno(cels) : cels;
}

// Ponto do mapa para a linha: área fechada encaixa nos cantos dos quadrados; muro, no meio deles
function pontoDoTracado(p) {
  const x = (p.x - vista.ox) / vista.zoom, y = (p.y - vista.oy) / vista.zoom;
  const lim = (v, max) => Math.min(max, Math.max(0, v));
  return linhaAberta()
    ? { x: lim(Math.floor(x), estado.cols - 1) + 0.5, y: lim(Math.floor(y), estado.rows - 1) + 0.5 }
    : { x: lim(Math.round(x), estado.cols), y: lim(Math.round(y), estado.rows) };
}
const pertoPt = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) < 0.6;

// Clique com a Linha: primeiro ponto, pontos seguintes. Termina ao clicar no primeiro ponto (fecha a forma;
// no muro, fecha a volta), de novo no último (ou duplo clique), com o botão direito ou com Enter.
const fechaNoInicio = pt => !!tracado && tracado.pontos.length >= 3 && pertoPt(pt, tracado.pontos[0]);
function pontoNoTracado(p) {
  const pt = pontoDoTracado(p);
  if (!tracado) { tracado = { pontos: [pt] }; atualizarFerramentas(); return; }
  const ps = tracado.pontos;
  if (fechaNoInicio(pt)) { if (linhaAberta()) ps.push({ ...ps[0] }); terminarTracado(); return; }
  if (pertoPt(pt, ps[ps.length - 1])) { terminarTracado(); return; }
  ps.push(pt);
  atualizarFerramentas();
}
function terminarTracado() {
  if (!tracado) return;
  const ps = tracado.pontos;
  const minimo = linhaAberta() ? 2 : 3;
  if (ps.length < minimo) { avisar(linhaAberta() ? 'Marque pelo menos dois pontos.' : 'Marque pelo menos três pontos para fechar a área.'); return; }
  const cels = celsDoTracado(ps);
  const antes = JSON.stringify(estado);
  const res = criarOuJuntar(cels, tipoNovaForma), nz = res?.zona;
  if (!nz) { avisar(cels.length ? 'Não dá para desenhar por cima de outra área (só por cima de caminho, do vazio ou de outro do mesmo tipo).' : 'A área ficou pequena demais.'); return; }
  tracado = null;
  limparSelecaoExtra();   // a área nova fica sozinha na seleção (não junto com o que estava selecionado)
  zonaAtiva = nz.id;
  objetoAtivo = null;
  if (res.nada) { atualizarFerramentas(); atualizarPaineis(); desenhar(); return; }   // só passou por cima dela mesma
  registrar(antes);
  mudou();
  atualizarFerramentas();
  if (nz.tipo === 'muro') abrirAlturaRapida({ zona: nz.id });
  if (res.juntou) avisar(textoJuntou(nz, res));
  else if (nz.tipo !== 'muro') avisar(`“${nz.nome}” criado (${fmt(cels.length * metros(1) * metros(1), 1)} m²).`);
}
function cancelarTracado() { tracado = null; atualizarFerramentas(); desenhar(); }
function desfazerPontoTracado() {
  if (!tracado) return;
  tracado.pontos.pop();
  if (!tracado.pontos.length) tracado = null;
  atualizarFerramentas(); desenhar();
}

// Dica da barra de baixo para a ferramenta de categoria
function dicaForma() {
  const nome = `<b>${escapar(TIPOS[tipoNovaForma].nome.toLowerCase())}</b>`;
  const fim = TOQUE ? 'toque de novo no último ponto' : 'duplo clique, botão direito ou Enter';
  if (formaDesenho === 'linha') return linhaAberta()
    ? `${TXT.clique} ponto a ponto para traçar o ${nome} · para terminar: ${fim} · no primeiro ponto, fecha a volta · Esc cancela.`
    : `${TXT.clique} ponto a ponto em volta da área · no primeiro ponto, fecha · ou ${fim} · Esc cancela.`;
  return `Arraste no vazio para desenhar um ${formaDesenho === 'circulo' ? 'círculo' : 'retângulo'} de ${nome}${tipoNovaForma === 'muro' ? ' (só a borda, um quadrado de largura)' : ''} · arraste uma área para mover${tipoNovaForma === 'muro' ? '' : ' · alças mudam o tamanho'} · Ctrl+D duplica.`;
}

// Linha logo abaixo das ferramentas: o jeito de desenhar e, com a linha pela metade, Terminar/Cancelar
function renderLinhaForma() {
  const box = $('linhaForma');
  if (!box) return;
  const mostrar = editandoDesenho && modo === 'mapa' && ferramenta === 'forma';
  box.classList.toggle('oculto', !mostrar);
  if (!mostrar) return;
  box.innerHTML = `<span>Desenhar</span><div class="seg">${FORMAS_DESENHO.map(f =>
    `<button data-forma-desenho="${f.id}" class="${f.id === formaDesenho ? 'ativa' : ''}" title="${f.nome}"><span>${f.icone}</span><span>${f.nome}</span></button>`).join('')}</div>` +
    (tracado ? `<div class="tracado-acoes"><span>${tracado.pontos.length} ${tracado.pontos.length === 1 ? 'ponto' : 'pontos'}</span>
      <button data-tracado="fim" class="principal">✓ Terminar</button><button data-tracado="cancelar">✕ Cancelar</button></div>` : '');
}

// ---------- Altura rápida: logo depois de desenhar um muro ou uma construção ----------
// Um campinho em cima do desenho para escrever a altura (e, no muro, o material), sem ir ao painel.
let alturaRapida = null;   // { zona: id, mostrado: '1,5' } ou { objeto: id, mostrado }
const alvoAlturaRapida = () => (alturaRapida?.zona ? zonaPorId(alturaRapida.zona) : alturaRapida?.objeto ? objetoPorId(alturaRapida.objeto) : null);
// Canto de cima à direita do que foi desenhado, em pixels do mapa
function cantoAlturaRapida(a) {
  if (alturaRapida.zona) { const k = caixaDaZona(a.id); return { x: vista.ox + (k.c1 + 1) * vista.zoom, y: vista.oy + k.r0 * vista.zoom }; }
  const L = ladoM();
  return { x: vista.ox + (a.x + a.largura) / L * vista.zoom, y: vista.oy + a.y / L * vista.zoom };
}
function abrirAlturaRapida(alvo) {
  alturaRapida = alvo;
  const a = alvoAlturaRapida();
  if (!a) { alturaRapida = null; return; }
  const box = $('alturaRapida');
  const muro = !!alturaRapida.zona;
  alturaRapida.mostrado = fmt(a.altura || 0, 1);   // só grava se a pessoa digitar outra coisa
  box.innerHTML = `<label>Altura <input inputmode="decimal" value="${alturaRapida.mostrado}" aria-label="Altura em metros"> m</label>
    ${muro ? `<div class="seg">${[['solido', 'Sólido'], ['tela', 'Tela']].map(([v, n]) =>
      `<button data-material="${v}" class="${(a.material || 'solido') === v ? 'ativa' : ''}" title="${v === 'tela' ? 'Tela, grade ou alambrado: não faz sombra' : 'Tijolo, madeira…: faz sombra'}">${n}</button>`).join('')}</div>` : ''}
    <button data-ok class="principal" title="Pronto">✓</button>`;
  box.classList.remove('oculto');
  posicionarAlturaRapida();
  // com mouse, o campo já fica pronto para digitar; no toque não (o teclado cobriria o mapa)
  if (tipoPonteiro.atual !== 'touch' && !TOQUE) { const inp = box.querySelector('input'); inp.focus({ preventScroll: true }); inp.select(); }
}
function posicionarAlturaRapida() {
  const a = alvoAlturaRapida();
  if (!a) return;
  const p = cantoAlturaRapida(a), box = $('alturaRapida'), area = box.parentElement;
  box.style.left = Math.max(4, Math.min(area.clientWidth - box.offsetWidth - 4, p.x + 6)) + 'px';
  box.style.top = Math.max(4, Math.min(area.clientHeight - box.offsetHeight - 4, p.y - box.offsetHeight - 6)) + 'px';
}
function fecharAlturaRapida() {
  if (!alturaRapida) return;
  aplicarAlturaRapida();
  descartarAlturaRapida();
}
// Fecha sem gravar (a horta foi trocada: outro projeto, mudança da nuvem, desfazer…)
function descartarAlturaRapida() {
  alturaRapida = null;
  $('alturaRapida').classList.add('oculto');
}
// Grava a altura digitada (se mudou e for válida); Ctrl+Z desfaz
function aplicarAlturaRapida() {
  const a = alvoAlturaRapida(), inp = $('alturaRapida').querySelector('input');
  if (!a || !inp || inp.value.trim() === alturaRapida.mostrado) return;   // não digitou: não mexe (a altura pode ter mudado no painel)
  const n = Number(String(inp.value).replace(',', '.'));
  const max = alturaRapida.zona ? 30 : 60;
  if (!Number.isFinite(n) || n < 0 || n > max || Math.abs(n - (a.altura || 0)) < 1e-9) return;
  registrar(); a.altura = n; mudou();
}
function montarAlturaRapida() {
  const box = $('alturaRapida');
  box.addEventListener('keydown', ev => {
    if (ev.key === 'Enter') { ev.preventDefault(); fecharAlturaRapida(); }
    else if (ev.key === 'Escape') { ev.preventDefault(); descartarAlturaRapida(); }
    if (ev.target.matches('input')) ev.stopPropagation();   // digitando, as teclas não viram atalhos do mapa (Delete, Ctrl+Z…)
  });
  box.addEventListener('click', ev => {
    const m = ev.target.closest('[data-material]');
    if (m) {
      const a = alvoAlturaRapida();
      if (a && (a.material || 'solido') !== m.dataset.material) { aplicarAlturaRapida(); registrar(); a.material = m.dataset.material; mudou(); }
      box.querySelectorAll('[data-material]').forEach(b => b.classList.toggle('ativa', b === m));
      return;
    }
    if (ev.target.closest('[data-ok]')) fecharAlturaRapida();
  });
}


// ---------- Alças de redimensionar ----------
const ALCAS = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
function posAlcas(k) {
  const x0 = vista.ox + k.c0 * vista.zoom, x1 = vista.ox + (k.c1 + 1) * vista.zoom;
  const y0 = vista.oy + k.r0 * vista.zoom, y1 = vista.oy + (k.r1 + 1) * vista.zoom;
  const xm = (x0 + x1) / 2, ym = (y0 + y1) / 2;
  return { nw: [x0, y0], n: [xm, y0], ne: [x1, y0], e: [x1, ym], se: [x1, y1], s: [xm, y1], sw: [x0, y1], w: [x0, ym] };
}
function alcaEm(p) {
  const z = zonaPorId(zonaAtiva);
  if (!z || ferramenta !== 'forma' || zonasSelecionadas().length > 1) return null;
  const k = caixaDaZona(z.id);
  if (!ehRetangulo(k)) return null;
  const pos = posAlcas(k);
  // dedo precisa de alvo maior — mas num canteiro pequeno as alças não podem cobrir o meio (senão não dá para arrastar)
  const lado = Math.min(pos.e[0] - pos.w[0], pos.s[1] - pos.n[1]);
  const tol = Math.max(5, Math.min(tipoPonteiro.atual === 'touch' || TOQUE ? 18 : 7, lado / 5));
  for (const a of ALCAS) if (Math.abs(p.x - pos[a][0]) <= tol && Math.abs(p.y - pos[a][1]) <= tol) return a;
  return null;
}
const CURSOR_ALCA = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize' };

function retRedimensionado(k, alca, p) {
  const n = { ...k };
  if (alca.includes('e')) n.c1 = Math.max(k.c0, Math.min(estado.cols - 1, p.c));
  if (alca.includes('w')) n.c0 = Math.min(k.c1, Math.max(0, p.c));
  if (alca.includes('s')) n.r1 = Math.max(k.r0, Math.min(estado.rows - 1, p.r));
  if (alca.includes('n')) n.r0 = Math.min(k.r1, Math.max(0, p.r));
  return n;
}

// Fileira de canteiros a partir do quadrado (c, r)
function retsDaFileira(c, r) {
  const w = Math.max(1, Math.round(fileira.largura * 100 / estado.tamanhoCelulaCm));
  const h = Math.max(1, Math.round(fileira.comprimento * 100 / estado.tamanhoCelulaCm));
  const gap = Math.max(0, Math.round(fileira.espaco * 100 / estado.tamanhoCelulaCm));
  const res = [];
  for (let k = 0; k < fileira.n; k++) {
    const c0 = fileira.direcao === 'lado' ? c + k * (w + gap) : c;
    const r0 = fileira.direcao === 'lado' ? r : r + k * (h + gap);
    res.push({ c0, r0, c1: c0 + w - 1, r1: r0 + h - 1 });
  }
  return res;
}
const retLivre = (k, id = -1) => retDentro(k) && celsDoRet(k).every(i => podeOcupar(i, id));

// ---------- Mouse (chamado por app.js no modo desenho) ----------
// Clique sem desenhar (no vazio ou fora do terreno): solta a ferramenta e a seleção, volta para Selecionar
function largarFerramenta() {
  limparSelecaoExtra(); zonaAtiva = null; objetoAtivo = null;
  escolherFerramenta('selecionar'); atualizarPaineis();
}
function formaPointerDown(ev, p) {
  const antes = JSON.stringify(estado);
  if (ferramenta !== 'forma') return false;

  const alca = alcaEm(p);
  if (alca) {
    const k = caixaDaZona(zonaAtiva);
    ponteiro = { modo: 'redim', alca, k0: k, k, antes };
    return true;
  }
  const id = celula(p.c, p.r);
  // o ponto entra ao soltar: se um 2º dedo começar um zoom (iPad), o toque é cancelado e não vira ponto
  if (formaDesenho === 'linha' && (tracado || !(id > 0 && !ehCaminho(id)))) { ponteiro = { modo: 'pontoLinha', p }; return true; }
  if (id > 0 && !ehCaminho(id)) { pegarZona(ev, id, p, antes); return true; }
  if (id >= 0) {
    ponteiro = { modo: 'novaForma', forma: formaDesenho, ini: limitar(p), fim: limitar(p), antes };
    return true;
  }
  // fora do terreno: larga a ferramenta (volta para Selecionar)
  if (formaDesenho !== 'linha') { largarFerramenta(); return true; }
  return false;
}

// Clique numa área no modo desenho (ferramentas Canteiros e Selecionar):
// com Ctrl/⌘/Shift entra ou sai da seleção; sem, começa a arrastar (ela sozinha ou o grupo selecionado)
function pegarZona(ev, id, p, antes = JSON.stringify(estado)) {
  if (ev.ctrlKey || ev.metaKey || ev.shiftKey) { alternarNaSelecao(id); return; }
  const sel = zonasSelecionadas();
  const grupo = sel.length > 1 && sel.includes(id) ? sel : [id];
  if (grupo.length === 1) { limparSelecaoExtra(); zonaAtiva = id; }
  objetoAtivo = null;
  const zonas = grupo.map(zonaPorId);
  const podeMover = zonas.every(z => z.tipo !== 'muro');
  ponteiro = { modo: 'moverZona', ini: p, dc: 0, dr: 0, antes, ids: grupo, clicada: id,
    cels: grupo.flatMap(celulasDaZona), podeMover };
  atualizarPaineis();
}
// Selecionar no modo desenho: área → pegar; vazio ou caminho → retângulo de seleção
function selecionarNoDesenho(ev, p) {
  if (pegarObjeto(p)) return;   // árvores e construções ficam por cima das áreas
  objetoAtivo = null;
  const id = celula(p.c, p.r);
  if (id > 0 && !ehCaminho(id)) { pegarZona(ev, id, p); return; }
  // a caixa usa o ponto de verdade (mesmo fora do terreno): clicar fora não pega o que está na borda, como o muro
  ponteiro = { modo: 'marquee', ini: p, fim: p, somar: ev.ctrlKey || ev.metaKey || ev.shiftKey };
}
// Move várias áreas juntas (todas ou nenhuma)
function moverGrupo(ids, dc, dr) {
  const cols = estado.cols;
  const grupo = new Set(ids);
  const novasPor = {};
  for (const id of ids) {
    const novas = [];
    for (const i of celulasDaZona(id)) {
      const c = i % cols + dc, r = (i - i % cols) / cols + dr;
      if (!dentro(c, r)) return false;
      const j = r * cols + c, v = estado.celulas[j];
      if (!(v === 0 || grupo.has(v) || ehCaminho(v))) return false;
      novas.push(j);
    }
    novasPor[id] = novas;
  }
  // o espaço que fica livre vira caminho se o grupo estava sobre um caminho
  let caminho = 0;
  for (const id of ids) for (const j of novasPor[id]) if (ehCaminho(estado.celulas[j])) { caminho = estado.celulas[j]; break; }
  for (const id of ids) for (const i of celulasDaZona(id)) estado.celulas[i] = caminho;
  for (const id of ids) for (const j of novasPor[id]) estado.celulas[j] = id;
  return true;
}

function formaPointerMove(p) {
  const pt = ponteiro;
  if (pt.modo === 'marquee') { pt.fim = p; return true; }
  if (pt.modo === 'moverZona' && pt.podeMover) { pt.dc = p.c - pt.ini.c; pt.dr = p.r - pt.ini.r; return true; }
  if (pt.modo === 'redim') { pt.k = retRedimensionado(pt.k0, pt.alca, p); return true; }
  if (pt.modo === 'novaForma') { pt.fim = limitar(p); return true; }
  return pt.modo === 'moverZona';
}

function celsMovidas(pt) {
  const cols = estado.cols;
  return pt.cels.map(i => {
    const c = i % cols + pt.dc, r = (i - i % cols) / cols + pt.dr;
    return dentro(c, r) ? r * cols + c : -1;
  });
}

function formaSoltar(pt) {
  if (pt.modo === 'pontoLinha') { pontoNoTracado(pt.p); return true; }
  const z = zonaPorId(zonaAtiva);
  if (pt.modo === 'marquee') {
    const k = caixaNoTerreno(caixa(pt.ini, pt.fim));
    const ids = [];
    for (const i of k ? celsDoRet(k) : []) { const v = estado.celulas[i]; if (v > 0 && !ehCaminho(v) && !ids.includes(v)) ids.push(v); }
    if (!pt.somar) { limparSelecaoExtra(); zonaAtiva = null; }
    for (const id of ids) { if (!zonaAtiva) zonaAtiva = id; else if (id !== zonaAtiva) zonasExtras.add(id); }
    atualizarPaineis();
    return true;
  }
  if (pt.modo === 'moverZona' && pt.ids && pt.ids.length > 1) {
    // clique sem arrastar num grupo: fica só a área clicada
    if (!pt.dc && !pt.dr) { limparSelecaoExtra(); zonaAtiva = pt.clicada; atualizarPaineis(); return true; }
    if (!pt.podeMover) return true;
    if (!moverGrupo(pt.ids, pt.dc, pt.dr)) { avisar('Não dá para colocar aí — encosta em outra área ou sai do terreno.'); return true; }
    const desloc = pt.dr * estado.cols + pt.dc;
    for (const id of pt.ids) { const zz = zonaPorId(id); for (const k of Object.keys(zz.pos || {})) zz.pos[k] = zz.pos[k].map(i => i + desloc); }
    registrar(pt.antes);
    mudou();
    return true;
  }
  if (pt.modo === 'moverZona') {
    if (!pt.dc && !pt.dr) return true;
    const novas = celsMovidas(pt);
    if (novas.includes(-1) || !trocarCelulasDaZona(z, novas)) { avisar('Não dá para colocar aí — encosta em outra área ou sai do terreno.'); return true; }
    // as plantas posicionadas vão junto
    const desloc = pt.dr * estado.cols + pt.dc;
    for (const k of Object.keys(z.pos || {})) z.pos[k] = z.pos[k].map(i => i + desloc);
    registrar(pt.antes);
    mudou();
    return true;
  }
  if (pt.modo === 'redim') {
    if (JSON.stringify(pt.k) === JSON.stringify(pt.k0)) return true;
    if (!trocarCelulasDaZona(z, celsDoRet(pt.k))) { avisar('Esse tamanho invade outra área.'); return true; }
    registrar(pt.antes);
    mudou();
    return true;
  }
  if (pt.modo === 'novaForma') {
    // clique sem arrastar no vazio: larga a ferramenta (volta para Selecionar) em vez de criar um quadradinho
    if (pt.ini.c === pt.fim.c && pt.ini.r === pt.fim.r) { largarFerramenta(); return true; }
    const k = caixa(pt.ini, pt.fim);
    const res = criarOuJuntar(celsDaNovaForma(pt.forma, k, tipoNovaForma), tipoNovaForma), nz = res?.zona;
    if (!nz) { avisar('Não dá para desenhar por cima de outra área (só por cima de caminho, do vazio ou de outro do mesmo tipo).'); return true; }
    limparSelecaoExtra();
    zonaAtiva = nz.id;
    objetoAtivo = null;
    if (res.nada) { atualizarPaineis(); return true; }   // só passou por cima dela mesma: nada a desfazer
    registrar(pt.antes);
    mudou();
    if (nz.tipo === 'muro') abrirAlturaRapida({ zona: nz.id });
    if (res.juntou) avisar(textoJuntou(nz, res));
    else if (nz.tipo !== 'muro') avisar(`“${nz.nome}” criado (${medidaRet(k)}).`);
    return true;
  }
  return false;
}

// Cursor conforme o que está embaixo do mouse
function cursorForma(p) {
  if (!editandoDesenho || !['forma', 'fileira'].includes(ferramenta) || ponteiro) return;
  const a = alcaEm(p);
  const id = celula(p.c, p.r);
  canvas.style.cursor = a ? CURSOR_ALCA[a] : ferramenta === 'forma' && id > 0 && !ehCaminho(id) ? 'move' : 'crosshair';
}

// ---------- Desenho (prévia, alças, medidas) ----------
function rotuloMedida(g, txt, x, y, cor = 'rgba(43,43,39,.88)') {
  g.font = '600 12px system-ui, sans-serif';
  const w = g.measureText(txt).width + 12;
  g.fillStyle = cor;
  g.fillRect(x, y - 21, w, 19);
  g.fillStyle = '#fff';
  g.textBaseline = 'middle';
  g.fillText(txt, x + 6, y - 11);
}

function desenharFormas(g, X, Y) {
  if (alturaRapida) posicionarAlturaRapida();   // o campinho da altura acompanha o mapa (zoom, mover)
  if (!editandoDesenho) return;
  const cols = estado.cols;
  const pt = ponteiro;
  const z = zonaPorId(zonaAtiva);
  const pintaRet = (k, ok, corZona) => {
    const x = X(k.c0), y = Y(k.r0), w = X(k.c1 + 1) - x, h = Y(k.r1 + 1) - y;
    g.globalAlpha = 0.55; g.fillStyle = ok ? corZona : '#ffa8a8'; g.fillRect(x, y, w, h); g.globalAlpha = 1;
    g.setLineDash([5, 4]); g.strokeStyle = ok ? '#2b8a3e' : '#c92a2a'; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, w - 2, h - 2); g.setLineDash([]);
    rotuloMedida(g, medidaRet(k) + (ok ? '' : ' — não cabe'), x, y, ok ? 'rgba(43,43,39,.88)' : '#c92a2a');
  };

  if (pt && pt.modo === 'marquee') {
    const k = caixa(pt.ini, pt.fim);
    const x = X(k.c0), y = Y(k.r0), w = X(k.c1 + 1) - x, h = Y(k.r1 + 1) - y;
    g.fillStyle = 'rgba(28,126,214,.08)'; g.fillRect(x, y, w, h);
    g.setLineDash([5, 4]); g.strokeStyle = '#1c7ed6'; g.lineWidth = 1.5; g.strokeRect(x + .5, y + .5, w - 1, h - 1); g.setLineDash([]);
  }
  const pintaCels = (cels, ok, corZona) => {
    g.globalAlpha = 0.55; g.fillStyle = ok ? corZona : '#ffa8a8';
    for (const i of cels) { const c = i % cols, r = (i - c) / cols; g.fillRect(X(c), Y(r), X(c + 1) - X(c), Y(r + 1) - Y(r)); }
    g.globalAlpha = 1;
  };
  if (pt && pt.modo === 'novaForma' && (pt.forma === 'circulo' || tipoNovaForma === 'muro')) {
    const k = caixa(pt.ini, pt.fim);
    const cels = celsDaNovaForma(pt.forma, k, tipoNovaForma);
    const ok = cels.every(i => podeOcuparNova(i, tipoNovaForma));
    pintaCels(cels, ok, TIPOS[tipoNovaForma].cor);
    g.setLineDash([5, 4]); g.strokeStyle = ok ? '#2b8a3e' : '#c92a2a'; g.lineWidth = 2;
    g.beginPath();
    if (pt.forma === 'circulo') g.ellipse((X(k.c0) + X(k.c1 + 1)) / 2, (Y(k.r0) + Y(k.r1 + 1)) / 2, (X(k.c1 + 1) - X(k.c0)) / 2, (Y(k.r1 + 1) - Y(k.r0)) / 2, 0, 0, Math.PI * 2);
    else g.rect(X(k.c0) + 1, Y(k.r0) + 1, X(k.c1 + 1) - X(k.c0) - 2, Y(k.r1 + 1) - Y(k.r0) - 2);
    g.stroke(); g.setLineDash([]);
    rotuloMedida(g, medidaRet(k) + (ok ? '' : ' — não cabe'), X(k.c0), Y(k.r0), ok ? 'rgba(43,43,39,.88)' : '#c92a2a');
  } else if (pt && pt.modo === 'novaForma') {
    const k = caixa(pt.ini, pt.fim);
    pintaRet(k, retDentro(k) && celsDoRet(k).every(i => podeOcuparNova(i, tipoNovaForma)), TIPOS[tipoNovaForma].cor);
  } else if (pt && pt.modo === 'redim' && z) {
    pintaRet(pt.k, celsDoRet(pt.k).every(i => podeOcupar(i, z.id)), z.cor);
  } else if (pt && pt.modo === 'moverZona' && z && (pt.dc || pt.dr)) {
    const novas = celsMovidas(pt);
    const grupo = new Set(pt.ids || [z.id]);
    const ok = !novas.includes(-1) && novas.every(i => podeOcupar(i, z.id) || grupo.has(estado.celulas[i]));
    g.globalAlpha = 0.6;
    g.fillStyle = ok ? z.cor : '#ffa8a8';
    for (const i of novas) { if (i < 0) continue; const c = i % cols, r = (i - c) / cols; g.fillRect(X(c), Y(r), X(c + 1) - X(c), Y(r + 1) - Y(r)); }
    g.globalAlpha = 1;
    const k = caixaDaZona(z.id);
    const nk = { c0: k.c0 + pt.dc, r0: k.r0 + pt.dr, c1: k.c1 + pt.dc, r1: k.r1 + pt.dr };
    g.setLineDash([5, 4]); g.strokeStyle = ok ? '#2b8a3e' : '#c92a2a'; g.lineWidth = 2;
    g.strokeRect(X(nk.c0) + 1, Y(nk.r0) + 1, X(nk.c1 + 1) - X(nk.c0) - 2, Y(nk.r1 + 1) - Y(nk.r0) - 2); g.setLineDash([]);
    rotuloMedida(g, `${fmt(metros(nk.c0))} m da esquerda, ${fmt(metros(nk.r0))} m do topo${ok ? '' : ' — não cabe'}`, X(nk.c0), Y(nk.r0), ok ? undefined : '#c92a2a');
  }

  if (false) {   // (a fileira agora é criada pela janela "Criar vários canteiros")
    for (const k of retsDaFileira(cursor.c, cursor.r)) {
      const ok = retLivre(k);
      if (!retDentro(k)) { g.strokeStyle = '#c92a2a'; }
      const kk = { c0: Math.max(0, k.c0), r0: Math.max(0, k.r0), c1: Math.min(estado.cols - 1, k.c1), r1: Math.min(estado.rows - 1, k.r1) };
      if (kk.c0 > kk.c1 || kk.r0 > kk.r1) continue;
      const x = X(kk.c0), y = Y(kk.r0), w = X(kk.c1 + 1) - x, h = Y(kk.r1 + 1) - y;
      g.globalAlpha = 0.45; g.fillStyle = ok ? TIPOS[fileira.tipo || 'canteiro'].cor : '#ffa8a8'; g.fillRect(x, y, w, h); g.globalAlpha = 1;
      g.setLineDash([4, 3]); g.strokeStyle = ok ? '#2b8a3e' : '#c92a2a'; g.lineWidth = 1.5; g.strokeRect(x + .5, y + .5, w - 1, h - 1); g.setLineDash([]);
    }
  }

  // Linha sendo desenhada (com o pedaço até o mouse)
  if (tracado) {
    const ps = [...tracado.pontos];
    if (cursor && cursor.x !== undefined) ps.push(pontoDoTracado(cursor));
    const cels = celsDoTracado(ps);
    const ok = cels.every(i => podeOcuparNova(i, tipoNovaForma));
    pintaCels(cels, ok, TIPOS[tipoNovaForma].cor);
    const XX = x => vista.ox + x * vista.zoom, YY = y => vista.oy + y * vista.zoom;
    g.strokeStyle = ok ? '#2b8a3e' : '#c92a2a'; g.lineWidth = 2; g.setLineDash([5, 4]);
    g.beginPath(); ps.forEach((p, i) => (i ? g.lineTo(XX(p.x), YY(p.y)) : g.moveTo(XX(p.x), YY(p.y))));
    if (!linhaAberta() && ps.length > 2) g.closePath();
    g.stroke(); g.setLineDash([]);
    // o primeiro ponto fecha a forma: fica maior e, com o mouse em cima, verde (é ali que termina)
    const vaiFechar = cursor && cursor.x !== undefined && fechaNoInicio(pontoDoTracado(cursor));
    tracado.pontos.forEach((p, i) => {
      const fecha = i === 0 && tracado.pontos.length >= 3;
      g.beginPath(); g.arc(XX(p.x), YY(p.y), fecha ? (vaiFechar ? 9 : 7) : 4, 0, Math.PI * 2);
      g.fillStyle = fecha ? (vaiFechar ? '#69db7c' : '#ebfbee') : '#fff'; g.fill(); g.strokeStyle = '#2b8a3e'; g.lineWidth = 2; g.stroke();
    });
    const ult = tracado.pontos[tracado.pontos.length - 1];
    rotuloMedida(g, `${fmt(cels.length * metros(1) * metros(1), 1)} m²${ok ? '' : ' — não cabe'}`, XX(ult.x) + 8, YY(ult.y) - 4, ok ? undefined : '#c92a2a');
  }

  // Alças da área selecionada
  if (ferramenta === 'forma' && z && zonasSelecionadas().length < 2 && !(pt && pt.modo === 'redim')) {
    const k = caixaDaZona(z.id);
    if (ehRetangulo(k)) {
      const pos = posAlcas(k);
      for (const a of ALCAS) {
        g.fillStyle = '#fff'; g.strokeStyle = '#e8590c'; g.lineWidth = 1.5;
        const t = TOQUE ? 14 : 9;
        g.fillRect(pos[a][0] - t / 2, pos[a][1] - t / 2, t, t); g.strokeRect(pos[a][0] - t / 2, pos[a][1] - t / 2, t, t);
      }
      if (!pt) rotuloMedida(g, medidaRet(k), X(k.c0), Y(k.r0) - 6);
    }
  }
}

// ---------- Duplicar ----------
function duplicarZona() {
  const z = zonaPorId(zonaAtiva);
  if (!z) return;
  const k = caixaDaZona(z.id);
  if (!k) return;
  const w = k.c1 - k.c0 + 1, h = k.r1 - k.r0 + 1;
  const gap = Math.max(1, Math.round(0.6 * 100 / estado.tamanhoCelulaCm));   // 60 cm de corredor
  const cols = estado.cols;
  const formato = celulasDaZona(z.id).map(i => [i % cols - k.c0, (i - i % cols) / cols - k.r0]);
  const cabe = (c0, r0) => formato.every(([dc, dr]) => dentro(c0 + dc, r0 + dr) && podeOcupar((r0 + dr) * cols + c0 + dc, -1));
  // tenta à direita, embaixo, à esquerda, em cima; depois procura qualquer lugar livre
  const tentativas = [[k.c0 + w + gap, k.r0], [k.c0, k.r0 + h + gap], [k.c0 - w - gap, k.r0], [k.c0, k.r0 - h - gap]];
  let lugar = tentativas.find(([c, r]) => cabe(c, r));
  for (let r = 0; !lugar && r < estado.rows; r++) for (let c = 0; !lugar && c < estado.cols; c++) if (cabe(c, r)) lugar = [c, r];
  if (!lugar) { avisar('Não há espaço livre do mesmo tamanho para a cópia.'); return; }
  registrar();
  const id = estado.proximoId++;
  const nz = { ...JSON.parse(JSON.stringify(z)), id, nome: proximoNome(z.tipo), plantas: [], qtd: {}, plantio: {}, pos: {}, origem: {} };
  estado.zonas.push(nz);
  for (const [dc, dr] of formato) estado.celulas[(lugar[1] + dr) * cols + lugar[0] + dc] = id;
  limparSelecaoExtra();
  zonaAtiva = id;
  mudou();
  avisar(`“${nz.nome}” criado — cópia de ${z.nome} (sem as plantas).`);
}

// ---------- Medidas exatas ----------
function aplicarMedidasExatas() {
  const z = zonaPorId(zonaAtiva);
  const k = z && caixaDaZona(z.id);
  if (!ehRetangulo(k)) return;
  const n = id => Number(String($(id).value).replace(',', '.'));
  const cel = m => Math.round(m * 100 / estado.tamanhoCelulaCm);
  const x = n('fX'), y = n('fY'), w = n('fL'), h = n('fC');
  if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0) { atualizarMedidasExatas(); return; }
  const nk = { c0: cel(x), r0: cel(y) };
  nk.c1 = nk.c0 + Math.max(1, cel(w)) - 1;
  nk.r1 = nk.r0 + Math.max(1, cel(h)) - 1;
  if (!retDentro(nk)) { avisar('Essas medidas passam da borda do terreno.'); atualizarMedidasExatas(); return; }
  const antes = JSON.stringify(estado);
  const desloc = (nk.r0 - k.r0) * estado.cols + (nk.c0 - k.c0);
  const mesmoTamanho = nk.c1 - nk.c0 === k.c1 - k.c0 && nk.r1 - nk.r0 === k.r1 - k.r0;
  if (!trocarCelulasDaZona(z, celsDoRet(nk))) { avisar('Nessa posição/tamanho ela invade outra área.'); atualizarMedidasExatas(); return; }
  if (mesmoTamanho) for (const key of Object.keys(z.pos || {})) z.pos[key] = z.pos[key].map(i => i + desloc);
  registrar(antes);
  mudou();
}

function atualizarMedidasExatas() {
  const box = $('zMedidasExatas');
  const z = zonaPorId(zonaAtiva);
  const k = z && caixaDaZona(z.id);
  if (!editandoDesenho || !k) { box.innerHTML = ''; return; }
  if (!ehRetangulo(k)) {
    box.innerHTML = '<p class="nota">Forma irregular: ajuste com o pincel e a borracha.</p>';
    return;
  }
  const ativo = document.activeElement;
  if (ativo && box.contains(ativo)) return;   // não atrapalha quem está digitando
  const v = c => fmt(metros(c), 2);
  box.innerHTML = `<div class="rotulo">Posição e tamanho (m)</div>
    <div class="grade4">
      <label>Da esquerda <input id="fX" inputmode="decimal" value="${v(k.c0)}"></label>
      <label>Do topo <input id="fY" inputmode="decimal" value="${v(k.r0)}"></label>
      <label>Largura <input id="fL" inputmode="decimal" value="${v(k.c1 - k.c0 + 1)}"></label>
      <label>Comprimento <input id="fC" inputmode="decimal" value="${v(k.r1 - k.r0 + 1)}"></label>
    </div>`;
}

// ---------- Preencher caminhos ----------
function preencherCaminhos() {
  const vazios = estado.celulas.reduce((s, v) => s + (v === 0 ? 1 : 0), 0);
  if (!vazios) { avisar('Não há espaço vazio para virar caminho.'); return; }
  registrar();
  let cam = estado.zonas.find(z => z.tipo === 'caminho');
  if (!cam) {
    cam = { id: estado.proximoId++, nome: 'Caminho', tipo: 'caminho', cor: TIPOS.caminho.cor, plantas: [], altura: 0, grupo: grupoAutoDe('caminho'), qtd: {}, plantio: {}, pos: {}, origem: {} };
    estado.zonas.push(cam);
  }
  if (cam.grupo == null) cam.grupo = grupoAutoDe('caminho');   // caminho feito antes, ainda em "Sem grupo"
  estado.celulas = estado.celulas.map(v => (v === 0 ? cam.id : v));
  mudou();
  avisar(`👣 ${fmt(vazios * (estado.tamanhoCelulaCm / 100) ** 2, 1)} m² viraram “${cam.nome}”. Ctrl+Z desfaz.`);
}

// ---------- Painel ----------
// ---------- Criar vários canteiros (fileira) ----------
// Primeiro lugar livre (de cima para baixo, da esquerda para a direita) onde a fileira toda cabe
function lugarParaFileira() {
  for (let r = 0; r < estado.rows; r++) for (let c = 0; c < estado.cols; c++) {
    const rets = retsDaFileira(c, r);
    if (rets.every(k => retLivre(k))) return rets;
  }
  return null;
}
const metrosFileira = () => {
  const w = fileira.largura, h = fileira.comprimento, n = fileira.n, e = fileira.espaco;
  return fileira.direcao === 'lado' ? [n * w + (n - 1) * e, h] : [w, n * h + (n - 1) * e];
};
function previaFileira() {
  const [tw, th] = metrosFileira();
  const W = 260, Hh = 110, esc = Math.min(W / tw, Hh / th);
  const cor = TIPOS[fileira.tipo || 'canteiro'].cor;
  let rets = '';
  for (let k = 0; k < fileira.n; k++) {
    const x = fileira.direcao === 'lado' ? k * (fileira.largura + fileira.espaco) : 0;
    const y = fileira.direcao === 'lado' ? 0 : k * (fileira.comprimento + fileira.espaco);
    rets += `<rect x="${(x * esc).toFixed(1)}" y="${(y * esc).toFixed(1)}" width="${(fileira.largura * esc).toFixed(1)}" height="${(fileira.comprimento * esc).toFixed(1)}" rx="2" fill="${cor}" stroke="#2b8a3e" stroke-width="1"/>`;
  }
  return `<svg viewBox="-2 -2 ${(tw * esc + 4).toFixed(1)} ${(th * esc + 4).toFixed(1)}" style="max-width:${W}px;max-height:${Hh}px">${rets}</svg>`;
}
function renderFileira() {
  const [tw, th] = metrosFileira();
  const cabe = lugarParaFileira();
  const caixaJanela = $('modalGeralCaixa');
  caixaJanela.querySelector('.fil-previa').innerHTML = previaFileira();
  caixaJanela.querySelector('.fil-total').innerHTML = cabe
    ? `Ocupa <b>${fmt(tw)} m × ${fmt(th)} m</b> no total.`
    : `Ocupa ${fmt(tw)} m × ${fmt(th)} m — <b class="mal-txt">não cabe em nenhum espaço livre do terreno.</b> Diminua a quantidade ou o tamanho, ou aumente o terreno.`;
  caixaJanela.querySelector('[data-fil="criar"]').disabled = !cabe;
}
function abrirFileira() {
  const campo = (k, rot, extra = '') => `<label>${rot} <input data-fil-campo="${k}" inputmode="decimal" value="${fmt(fileira[k])}" ${extra}></label>`;
  $('modalGeralCaixa').innerHTML = `
    <button class="fechar" data-fil="fechar" title="Fechar">×</button>
    <h3>▦ Criar vários canteiros</h3>
    <div class="grade2 form">
      <label>Quantos <input data-fil-campo="n" type="number" min="1" max="20" value="${fileira.n}"></label>
      <label>Tipo <select data-fil-campo="tipo">${Object.entries(TIPOS).filter(([id]) => id !== 'caminho').map(([id, t]) =>
        `<option value="${id}" ${id === (fileira.tipo || 'canteiro') ? 'selected' : ''}>${t.icone} ${t.nome}</option>`).join('')}</select></label>
      ${campo('largura', 'Largura (m)')}
      ${campo('comprimento', 'Comprimento (m)')}
      ${campo('espaco', 'Espaço entre eles (m)')}
      <label>Direção <select data-fil-campo="direcao">
        <option value="lado" ${fileira.direcao === 'lado' ? 'selected' : ''}>Lado a lado →</option>
        <option value="embaixo" ${fileira.direcao === 'embaixo' ? 'selected' : ''}>Um embaixo do outro ↓</option></select></label>
    </div>
    <div class="fil-previa"></div>
    <p class="nota fil-total"></p>
    <p class="nota">Eles aparecem no primeiro espaço livre e já ficam selecionados: arraste um deles para levar a fileira toda para onde quiser.</p>
    <div class="acoes-plano">
      <button data-fil="fechar">Cancelar</button>
      <button class="principal" data-fil="criar">✓ Criar</button>
    </div>`;
  $('modalGeral').classList.remove('oculto');
  renderFileira();
}
function criarFileira() {
  const rets = lugarParaFileira();
  if (!rets) return;
  const antes = JSON.stringify(estado);
  const ids = rets.map(k => criarZonaRet(k, fileira.tipo || 'canteiro')?.id).filter(Boolean);
  if (!ids.length) return;
  registrar(antes);
  limparSelecaoExtra();
  zonaAtiva = ids[0];
  for (const id of ids.slice(1)) zonasExtras.add(id);
  if (!['forma', 'selecionar'].includes(ferramenta)) escolherFerramenta('selecionar');
  $('modalGeral').classList.add('oculto');
  mudou();
  avisar(`${ids.length} canteiros criados e selecionados. Arraste um deles para mover todos juntos (↶ desfaz).`);
}
function montarFileira() {
  const modal = $('modalGeral');
  modal.addEventListener('click', ev => {
    const a = ev.target.closest('[data-fil]')?.dataset.fil;
    if (a === 'fechar') modal.classList.add('oculto');
    if (a === 'criar') criarFileira();
  });
  modal.addEventListener('input', ev => {
    const k = ev.target.dataset.filCampo;
    if (!k) return;
    if (ev.target.tagName === 'SELECT') fileira[k] = ev.target.value;
    else {
      const v = Number(String(ev.target.value).replace(',', '.'));
      if (!Number.isFinite(v) || v < 0) return;
      if (k === 'n') fileira.n = Math.max(1, Math.min(20, Math.round(v)));
      else if (k === 'espaco') fileira.espaco = Math.min(20, v);
      else if (v >= 0.2) fileira[k] = Math.min(100, v);   // menor que um quadradinho (20 cm) não dá
    }
    renderFileira();
  });
}

function atualizarPainelFormas() {
  const sec = $('secFormas');
  if (!sec) return;
  sec.classList.toggle('oculto', !editandoDesenho);
  renderLinhaForma();
}

function montarFormas() {
  montarAlturaRapida();
  // botões do quadro "N áreas selecionadas"
  $('zMulti').addEventListener('change', async ev => {
    if (!ev.target.matches('[data-multi-grupo]')) return;
    let g = ev.target.value;
    if (g === '__nova') { g = await criarGrupo(); if (!g) { atualizarPaineis(); return; } }
    const sel = zonasSelecionadas();
    registrar();
    for (const id of sel) zonaPorId(id).grupo = Number(g) || null;
    mudou();
    const gr = grupoPorId(Number(g));
    avisar(`${sel.length} áreas ${gr ? `no grupo “${gr.nome}”` : 'em “Sem grupo”'}.`);
  });
  $('zMulti').addEventListener('click', ev => {
    const b = ev.target.closest('[data-multi]');
    if (!b) return;
    if (b.dataset.multi === 'limpar') limparSelecaoExtra();
    if (b.dataset.multi === 'deletar') { deletarZona(); return; }
    atualizarPaineis(); desenhar();
  });
  $('linhaForma').addEventListener('click', ev => {
    const f = ev.target.closest('[data-forma-desenho]');
    if (f) { formaDesenho = f.dataset.formaDesenho; tracado = null; atualizarFerramentas(); desenhar(); return; }
    const t = ev.target.closest('[data-tracado]');
    if (t) { if (t.dataset.tracado === 'fim') terminarTracado(); else cancelarTracado(); }
  });
  $('btnFileira').onclick = abrirFileira;
  montarFileira();
  $('btnCaminhos').onclick = preencherCaminhos;
  $('zDuplicar').onclick = duplicarZona;
  $('zMedidasExatas').addEventListener('change', aplicarMedidasExatas);
  document.addEventListener('keydown', ev => {
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'd' && modo === 'mapa' && editandoDesenho && zonaAtiva && !ev.target.matches?.('input, textarea, select')) {
      ev.preventDefault();
      duplicarZona();
    }
  });
}
