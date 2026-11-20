'use strict';

// =====================================================================
//  Minha Horta — Desenhar com formas: canteiros como objetos
//  Arrastar no vazio cria; arrastar um canteiro move; alças mudam o tamanho;
//  duplicar; fileira de canteiros; medidas exatas; preencher caminhos.
//  Por baixo continua a mesma grade de 20 cm (estado.celulas).
// =====================================================================

let tipoNovaForma = 'canteiro';
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

function criarZonaRet(k, tipo, modelo) {
  const cels = celsDoRet(k);
  if (cels.some(i => !podeOcupar(i, -1))) return null;
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
  if (id > 0 && !ehCaminho(id)) { pegarZona(ev, id, p, antes); return true; }
  if (id >= 0) {
    ponteiro = { modo: 'novaForma', ini: limitar(p), fim: limitar(p), antes };
    return true;
  }
  return false;
}

// Clique numa área no modo desenho (ferramentas Canteiros e Selecionar):
// com Ctrl/⌘/Shift entra ou sai da seleção; sem, começa a arrastar (ela sozinha ou o grupo selecionado)
function pegarZona(ev, id, p, antes = JSON.stringify(estado)) {
  if (ev.ctrlKey || ev.metaKey || ev.shiftKey) { alternarNaSelecao(id); return; }
  const sel = zonasSelecionadas();
  const grupo = sel.length > 1 && sel.includes(id) ? sel : [id];
  if (grupo.length === 1) { limparSelecaoExtra(); zonaAtiva = id; }
  const zonas = grupo.map(zonaPorId);
  const podeMover = zonas.every(z => z.tipo !== 'muro');
  ponteiro = { modo: 'moverZona', ini: p, dc: 0, dr: 0, antes, ids: grupo, clicada: id,
    cels: grupo.flatMap(celulasDaZona), podeMover };
  atualizarPaineis();
}
// Selecionar no modo desenho: área → pegar; vazio ou caminho → retângulo de seleção
function selecionarNoDesenho(ev, p) {
  const id = celula(p.c, p.r);
  if (id > 0 && !ehCaminho(id)) { pegarZona(ev, id, p); return; }
  ponteiro = { modo: 'marquee', ini: limitar(p), fim: limitar(p), somar: ev.ctrlKey || ev.metaKey || ev.shiftKey };
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
  if (pt.modo === 'marquee') { pt.fim = limitar(p); return true; }
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
  const z = zonaPorId(zonaAtiva);
  if (pt.modo === 'marquee') {
    const k = caixa(pt.ini, pt.fim);
    const ids = [];
    for (const i of celsDoRet(k)) { const v = estado.celulas[i]; if (v > 0 && !ehCaminho(v) && !ids.includes(v)) ids.push(v); }
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
    const k = caixa(pt.ini, pt.fim);
    const nz = criarZonaRet(k, tipoNovaForma);
    if (!nz) { avisar('Não dá para desenhar por cima de outra área (só por cima de caminho ou do vazio).'); return true; }
    zonaAtiva = nz.id;
    registrar(pt.antes);
    mudou();
    avisar(`“${nz.nome}” criado (${medidaRet(k)}).`);
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
  if (pt && pt.modo === 'novaForma') {
    const k = caixa(pt.ini, pt.fim);
    pintaRet(k, retLivre(k), TIPOS[tipoNovaForma].cor);
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
    cam = { id: estado.proximoId++, nome: 'Caminho', tipo: 'caminho', cor: TIPOS.caminho.cor, plantas: [], altura: 0, grupo: null, qtd: {}, plantio: {}, pos: {}, origem: {} };
    estado.zonas.push(cam);
  }
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
  $('opcoesForma').classList.toggle('oculto', ferramenta !== 'forma');
  if (document.activeElement !== $('tipoForma')) $('tipoForma').value = tipoNovaForma;
}

function montarFormas() {
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
  const sel = $('tipoForma');
  for (const [id, t] of Object.entries(TIPOS)) sel.insertAdjacentHTML('beforeend', `<option value="${id}">${t.icone} ${t.nome}</option>`);
  sel.onchange = () => { tipoNovaForma = sel.value; };
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
