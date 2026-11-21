'use strict';

// =====================================================================
//  Minha Horta — Fase 1: editor do mapa
// =====================================================================

const CHAVE = 'horta.mapa.v1';

const TIPOS = {
  canteiro:    { nome: 'Canteiro',            cor: '#d9ead3', icone: '🥬' },
  caminho:     { nome: 'Caminho',             cor: '#e8dcc4', icone: '👣' },
  muro:        { nome: 'Muro / cerca',        cor: '#9e9e9e', icone: '🧱' },
  composteira: { nome: 'Composteira',         cor: '#a1887f', icone: '🪱' },
  outro:       { nome: 'Outro',               cor: '#ffe599', icone: '📦' },
};
const TIPOS_COM_PLANTAS = ['canteiro', 'outro'];
// Grupos criados sozinhos em toda horta (a pessoa pode renomear, apagar ou criar outros).
// Cada área, árvore ou construção nova entra no grupo do seu tipo, se ele ainda existir.
const GRUPOS_AUTO = [
  { tipo: 'canteiro', nome: 'Canteiros', icone: '🥬' },
  { tipo: 'caminho', nome: 'Caminhos', icone: '👣' },
  { tipo: 'muro', nome: 'Muros e cercas', icone: '🧱' },
  { tipo: 'arvore', nome: 'Árvores', icone: '🌳' },
  { tipo: 'construcao', nome: 'Construções', icone: '🏠' },
  { tipo: 'composteira', nome: 'Composteiras', icone: '🪱' },
  { tipo: 'outro', nome: 'Outros', icone: '📦' },
];
const grupoAutoDe = (tipo, e = estado) => (e.grupos || []).find(g => g.tipoAuto === tipo)?.id ?? null;
const FERRAMENTAS_COM_PINCEL = ['pincel', 'borracha', 'meiaSombra', 'sombraTotal', 'limparSombra'];
const FERRAMENTAS_DE_PINTAR = [...FERRAMENTAS_COM_PINCEL, 'balde', 'retangulo'];

const FERRAMENTAS = [
  { id: 'forma', icone: '⬚', nome: 'Canteiros', tecla: 'F',
    dica: 'Arraste no vazio para criar · arraste uma área para mover · alças para o tamanho · Ctrl+D duplica.' },
  { id: 'selecionar', icone: '👆', nome: 'Selecionar', tecla: 'V',
    dica: `${TXT.clique} numa área para ver os detalhes; arraste para mover. ${TOQUE ? 'Arraste no vazio' : 'Ctrl+clique ou arraste no vazio'} para escolher várias.` },
  { id: 'pincel', icone: '🖌️', nome: 'Pincel', tecla: 'B',
    dica: 'Arraste para pintar com <b>{zona}</b>.' },
  { id: 'retangulo', icone: '⬛', nome: 'Retângulo', tecla: 'R',
    dica: `Arraste para desenhar um retângulo de <b>{zona}</b>. ${TOQUE ? 'Para apagar, use a Borracha.' : 'Segure Alt para apagar.'}` },
  { id: 'balde', icone: '🪣', nome: 'Preencher', tecla: 'G',
    dica: `${TXT.clique} para preencher o espaço com <b>{zona}</b>.` },
  { id: 'borracha', icone: '🧽', nome: 'Borracha', tecla: 'E',
    dica: 'Arraste para apagar.' },
];

// ---------- Estado ----------
const estadoSalvo = carregar();          // null na primeira vez: aí aparecem as boas-vindas
let estado = migrar(estadoSalvo || estadoVazio());
let historico = [];
let futuro = [];
const vista = { zoom: 14, ox: 50, oy: 40 };
let modo = 'mapa';                       // 'mapa' ou 'sol'
const ferramentaPorModo = { mapa: 'selecionar', sol: 'objeto', plantas: null, diario: null };
let editandoDesenho = false;              // aba Horta: false = planejar, true = ferramentas de desenho
let ferramenta = 'selecionar';
let tamPincel = 1;
let zonaAtiva = null;   // começa sem área selecionada: o painel mostra as tarefas do mês
let ponteiro = null;      // operação em andamento (pintar, retângulo, mover)
let cursor = null;        // célula sob o mouse
let espaco = false;       // barra de espaço pressionada (mover mapa)

// ---------- Elementos ----------
const $ = id => document.getElementById(id);
const canvas = $('mapa');
const ctx = canvas.getContext('2d');
const areaMapa = $('areaMapa');

// ---------- Utilidades ----------
const fmt = (n, d = 2) => n.toLocaleString('pt-BR', { maximumFractionDigits: d });
const metros = n => n * estado.tamanhoCelulaCm / 100;
const celsPorMetro = () => Math.max(1, Math.round(100 / estado.tamanhoCelulaCm));
const idx = (c, r) => r * estado.cols + c;
const dentro = (c, r) => c >= 0 && r >= 0 && c < estado.cols && r < estado.rows;
const celula = (c, r) => dentro(c, r) ? estado.celulas[idx(c, r)] : -1;
const zonaPorId = id => estado.zonas.find(z => z.id === id);
const escapar = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

// ---------- Salvar / carregar ----------
function valido(e) {
  return e && Array.isArray(e.celulas) && Array.isArray(e.zonas) &&
    Number.isInteger(e.cols) && Number.isInteger(e.rows) && e.celulas.length === e.cols * e.rows;
}
// Completa dados que versões anteriores do app não tinham
function migrar(e) {
  e.versao = 2;
  e.tamanhoCelulaCm = e.tamanhoCelulaCm || 20;
  if (!e.local || !Number.isFinite(e.local.lat)) e.local = { nome: 'Piraquara, PR', lat: -25.44 };
  if (typeof e.norteGraus !== 'number') e.norteGraus = 0;
  if (typeof e.norteDefinido !== 'boolean') e.norteDefinido = false;
  if (!Array.isArray(e.objetos)) e.objetos = [];
  if (!Array.isArray(e.sombra) || e.sombra.length !== e.cols * e.rows) e.sombra = new Array(e.cols * e.rows).fill(0);
  for (const z of e.zonas) if (typeof z.altura !== 'number') z.altura = z.tipo === 'muro' ? 1.5 : 0;
  e.proximoId = Math.max(e.proximoId || 1, ...e.zonas.map(z => z.id + 1));
  e.proximoObjId = Math.max(e.proximoObjId || 1, ...e.objetos.map(o => o.id + 1));
  if (!e.plantasEditadas || typeof e.plantasEditadas !== 'object') e.plantasEditadas = {};
  if (!Array.isArray(e.minhaLista)) e.minhaLista = [...LISTA_INICIAL];
  // Fase 4: plantas das áreas passam a ser ids do catálogo (textos desconhecidos ficam como estão)
  for (const z of e.zonas) {
    z.plantas = [...new Set((z.plantas || []).map(t => plantaPorId(t, e) || String(t).includes('#') ? t : (encontrarPlanta(t, e) || t)))];
  }
  // Categorias da lista de áreas
  if (!Array.isArray(e.grupos)) e.grupos = [];
  // O tipo "Flores e temperos" deixou de existir: essas áreas viram canteiros (cor e plantas continuam)
  for (const z of e.zonas) if (z.tipo === 'bordadura') z.tipo = 'canteiro';
  if (!Array.isArray(e.diario)) e.diario = [];
  if (!e.perfil) e.perfil = { pessoas: 2, objetivo: 'fresco' };   // quem come da horta (quantidades)
  if (e.local.definido === undefined) e.local.definido = true;
  if (!e.inicio) e.inicio = { passos: false, semArvores: false };   // hortas antigas: sem checklist
  if (!e.clima || typeof e.clima !== 'object') e.clima = { ativo: false };
  if (!Number.isFinite(e.local.lon)) e.local.lon = -49.06;   // Piraquara   // diário: plantios, colheitas, notas…
  e.proximoGrupoId = Math.max(e.proximoGrupoId || 1, ...e.grupos.map(g => g.id + 1));
  if (!Array.isArray(e.objetos)) e.objetos = [];
  // Uma vez só por horta: cria os grupos automáticos e põe neles o que não está em nenhum grupo
  if (!e.gruposAuto) {
    e.gruposAuto = true;
    const auto = GRUPOS_AUTO.map(t => ({ id: e.proximoGrupoId++, nome: t.nome, icone: t.icone, tipoAuto: t.tipo, fechado: false }));
    e.grupos = [...auto, ...e.grupos];
    const valido = id => e.grupos.some(g => g.id === id);
    for (const z of e.zonas) if (!valido(z.grupo)) z.grupo = grupoAutoDe(z.tipo, e);
    for (const o of e.objetos) if (!valido(o.grupo)) o.grupo = grupoAutoDe(o.tipo, e);
  }
  for (const z of e.zonas) {
    if (z.grupo === undefined) z.grupo = null;
    if (z.tipo === 'cultivo') z.tipo = 'canteiro';   // o tipo "Área de cultivo" foi juntado com Canteiro
    if (!z.qtd || typeof z.qtd !== 'object') z.qtd = {};   // quantos pés de cada planta
    if (!z.plantio || typeof z.plantio !== 'object') z.plantio = {};
    if (!z.pos || typeof z.pos !== 'object') z.pos = {};
    if (!z.origem || typeof z.origem !== 'object') z.origem = {};   // 'plano' = veio do Sugerir plano   // quadrados onde cada planta fica dentro do canteiro   // mês (1–12) em que cada planta vai para o canteiro
    if (z.nome === 'Bordadura de flores') z.nome = 'Flores e Temperos';
  }
  e.versao = 4;
  return e;
}
function carregar() {
  try {
    const t = localStorage.getItem(CHAVE);
    if (!t) return null;
    const e = JSON.parse(t);
    return valido(e) ? e : null;
  } catch (_) { return null; }
}
let timerSalvo;
function salvar() {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(estado));
    $('stSalvo').textContent = '✓ Salvo';
  } catch (_) {
    $('stSalvo').textContent = 'Não foi possível salvar neste navegador — exporte o arquivo';
  }
  clearTimeout(timerSalvo);
  timerSalvo = setTimeout(() => { $('stSalvo').textContent = ''; }, 2000);
}

// ---------- Desfazer / refazer ----------
function registrar(antes) {
  historico.push(antes ?? JSON.stringify(estado));
  if (historico.length > 200) historico.shift();
  futuro = [];
  atualizarBotoesHistorico();
}
function desfazer() {
  if (!historico.length) return;
  futuro.push(JSON.stringify(estado));
  estado = JSON.parse(historico.pop());
  depoisDeTrocarEstado();
}
function refazer() {
  if (!futuro.length) return;
  historico.push(JSON.stringify(estado));
  estado = JSON.parse(futuro.pop());
  depoisDeTrocarEstado();
}
function depoisDeTrocarEstado() {
  if (!zonaPorId(zonaAtiva)) zonaAtiva = estado.zonas[0]?.id ?? null;
  if (!objetoPorId(objetoAtivo)) objetoAtivo = null;
  mudou();
}
function atualizarBotoesHistorico() {
  $('btnDesfazer').disabled = !historico.length;
  $('btnRefazer').disabled = !futuro.length;
}
function mudou() {
  invalidarSol();
  salvar();
  atualizarPaineis();
  desenhar();
  atualizarBotoesHistorico();
}

// ---------- Operações de pintura ----------
function pintar(c, r, id) {
  let alterou = false;
  const off = Math.floor((tamPincel - 1) / 2);
  for (let dr = 0; dr < tamPincel; dr++) {
    for (let dc = 0; dc < tamPincel; dc++) {
      const cc = c - off + dc, rr = r - off + dr;
      if (dentro(cc, rr) && estado.celulas[idx(cc, rr)] !== id) {
        estado.celulas[idx(cc, rr)] = id;
        alterou = true;
      }
    }
  }
  return alterou;
}

// Percorre as células de uma linha reta (Bresenham) para o pincel não "pular" quadrados
function linha(c0, r0, c1, r1, fn) {
  const dc = Math.abs(c1 - c0), dr = Math.abs(r1 - r0);
  const sc = c0 < c1 ? 1 : -1, sr = r0 < r1 ? 1 : -1;
  let err = dc - dr;
  for (;;) {
    fn(c0, r0);
    if (c0 === c1 && r0 === r1) break;
    const e2 = 2 * err;
    if (e2 > -dr) { err -= dr; c0 += sc; }
    if (e2 < dc) { err += dc; r0 += sr; }
  }
}

function preencher(c, r, id) {
  const alvo = celula(c, r);
  if (alvo < 0 || alvo === id) return false;
  const pilha = [[c, r]];
  while (pilha.length) {
    const [x, y] = pilha.pop();
    if (celula(x, y) !== alvo) continue;
    estado.celulas[idx(x, y)] = id;
    pilha.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  return true;
}

function limitar(p) {
  return {
    c: Math.min(estado.cols - 1, Math.max(0, p.c)),
    r: Math.min(estado.rows - 1, Math.max(0, p.r)),
  };
}
function caixa(a, b) {
  return { c0: Math.min(a.c, b.c), r0: Math.min(a.r, b.r), c1: Math.max(a.c, b.c), r1: Math.max(a.r, b.r) };
}
function aplicarRetangulo(a, b, id) {
  const k = caixa(a, b);
  let alterou = false;
  for (let r = k.r0; r <= k.r1; r++) {
    for (let c = k.c0; c <= k.c1; c++) {
      if (estado.celulas[idx(c, r)] !== id) { estado.celulas[idx(c, r)] = id; alterou = true; }
    }
  }
  return alterou;
}

function exigirZona() {
  if (zonaAtiva && zonaPorId(zonaAtiva)) return true;
  avisar('Primeiro escolha uma área na lista à esquerda, ou crie uma nova com “+ Nova”.');
  return false;
}

let timerAviso;
function avisar(msg) {
  const el = $('aviso');
  el.textContent = msg;
  el.classList.remove('oculto');
  clearTimeout(timerAviso);
  timerAviso = setTimeout(() => el.classList.add('oculto'), 3500);
}

// ---------- Medidas ----------
function medidasDaZona(id) {
  let n = 0, c0 = Infinity, r0 = Infinity, c1 = -1, r1 = -1;
  for (let r = 0; r < estado.rows; r++) {
    for (let c = 0; c < estado.cols; c++) {
      if (estado.celulas[idx(c, r)] !== id) continue;
      n++;
      if (c < c0) c0 = c; if (c > c1) c1 = c;
      if (r < r0) r0 = r; if (r > r1) r1 = r;
    }
  }
  const lado = estado.tamanhoCelulaCm / 100;
  return {
    quadrados: n,
    area: n * lado * lado,
    largura: n ? (c1 - c0 + 1) * lado : 0,
    altura: n ? (r1 - r0 + 1) * lado : 0,
  };
}
function contarCelulas() {
  const cont = {};
  for (const id of estado.celulas) if (id) cont[id] = (cont[id] || 0) + 1;
  return cont;
}

// =====================================================================
//  Desenho
// =====================================================================

function desenhar() {
  const dpr = window.devicePixelRatio || 1;
  desenharEm(ctx, canvas.width / dpr, canvas.height / dpr, dpr, vista, true);
}

function desenharEm(g, W, H, escala, v, interativo) {
  const { cols, rows } = estado;
  const s = v.zoom;
  const X = c => Math.round(v.ox + c * s);
  const Y = r => Math.round(v.oy + r * s);

  g.setTransform(escala, 0, 0, escala, 0, 0);
  g.fillStyle = '#ecebe4';
  g.fillRect(0, 0, W, H);

  // Terreno
  g.fillStyle = 'rgba(0,0,0,.07)';
  g.fillRect(X(0) + 4, Y(0) + 4, X(cols) - X(0), Y(rows) - Y(0));
  g.fillStyle = '#fffdf8';
  g.fillRect(X(0), Y(0), X(cols) - X(0), Y(rows) - Y(0));

  // Parte visível
  const c0 = Math.max(0, Math.floor(-v.ox / s)), c1 = Math.min(cols, Math.ceil((W - v.ox) / s));
  const r0 = Math.max(0, Math.floor(-v.oy / s)), r1 = Math.min(rows, Math.ceil((H - v.oy) / s));

  // Células pintadas
  const cores = {};
  for (const z of estado.zonas) cores[z.id] = z.cor;
  for (let r = r0; r < r1; r++) {
    for (let c = c0; c < c1; c++) {
      const id = estado.celulas[idx(c, r)];
      if (!id) continue;
      g.fillStyle = cores[id] || '#cccccc';
      g.fillRect(X(c), Y(r), X(c + 1) - X(c), Y(r + 1) - Y(r));
    }
  }

  // Grade de 20 cm
  if (s >= 5) {
    g.beginPath();
    for (let c = c0; c <= c1; c++) { g.moveTo(X(c) + .5, Y(r0)); g.lineTo(X(c) + .5, Y(r1)); }
    for (let r = r0; r <= r1; r++) { g.moveTo(X(c0), Y(r) + .5); g.lineTo(X(c1), Y(r) + .5); }
    g.strokeStyle = 'rgba(60,60,50,.12)';
    g.lineWidth = 1;
    g.stroke();
  }
  // Linhas a cada metro
  const m = celsPorMetro();
  g.beginPath();
  for (let c = 0; c <= cols; c += m) { g.moveTo(X(c) + .5, Y(0)); g.lineTo(X(c) + .5, Y(rows)); }
  for (let r = 0; r <= rows; r += m) { g.moveTo(X(0), Y(r) + .5); g.lineTo(X(cols), Y(r) + .5); }
  g.strokeStyle = 'rgba(60,60,50,.28)';
  g.stroke();

  const modoSol = interativo && modo === 'sol';
  const modoCal = interativo && modo === 'mapa';
  if (modoSol) desenharCamadaSol(g, X, Y, c0, c1, r0, r1);
  if (modoCal && !editandoDesenho) desenharCamadaCalendario(g, X, Y, c0, c1, r0, r1);
  if (modoCal && !editandoDesenho) desenharPosicoes(g, s, X, Y);

  // Contornos das áreas (+ destaque da área selecionada)
  const contorno = new Path2D();
  const destaque = new Path2D();
  const vizinho = new Path2D();
  const modoMapa = interativo && modo === 'mapa';
  // Áreas vizinhas da selecionada (até 1 m) ganham contorno tracejado
  const vizAtiva = modoMapa && zonaAtiva && TIPOS_PLANTAVEIS.includes(zonaPorId(zonaAtiva)?.tipo)
    ? (analiseHorta().viz[zonaAtiva] || new Set()) : new Set();
  for (let r = r0; r < r1; r++) {
    for (let c = c0; c < c1; c++) {
      const id = estado.celulas[idx(c, r)];
      if (!id) continue;
      const alvo = (id === zonaAtiva || (editandoDesenho && zonasExtras.has(id))) && (modoMapa || modoCal) ? destaque : vizAtiva.has(id) ? vizinho : contorno;
      if (celula(c, r - 1) !== id) { alvo.moveTo(X(c), Y(r)); alvo.lineTo(X(c + 1), Y(r)); }
      if (celula(c, r + 1) !== id) { alvo.moveTo(X(c), Y(r + 1)); alvo.lineTo(X(c + 1), Y(r + 1)); }
      if (celula(c - 1, r) !== id) { alvo.moveTo(X(c), Y(r)); alvo.lineTo(X(c), Y(r + 1)); }
      if (celula(c + 1, r) !== id) { alvo.moveTo(X(c + 1), Y(r)); alvo.lineTo(X(c + 1), Y(r + 1)); }
    }
  }
  g.strokeStyle = 'rgba(0,0,0,.35)';
  g.lineWidth = 1.2;
  g.stroke(contorno);
  g.setLineDash([5, 4]);
  g.strokeStyle = 'rgba(232,89,12,.75)';
  g.lineWidth = 1.8;
  g.stroke(vizinho);
  g.setLineDash([]);
  g.strokeStyle = '#e8590c';
  g.lineWidth = 2.5;
  g.stroke(destaque);

  // Borda do terreno
  g.strokeStyle = '#6f6c60';
  g.lineWidth = 1.5;
  g.strokeRect(X(0), Y(0), X(cols) - X(0), Y(rows) - Y(0));

  desenharRotulos(g, s, X, Y, modoSol ? solPorZona() : null, modoCal);
  desenharReguas(g, s, X, Y, W, H);

  if (!interativo) return;

  if (modoCal) desenharFormas(g, X, Y);

  if (modoSol) {
    desenharObjetosSol(g, v);
    desenharBussolaMapa(g, W);
  }

  // Pré-visualização do retângulo
  if (ponteiro && ponteiro.modo === 'ret') {
    const k = caixa(ponteiro.ini, ponteiro.fim);
    const z = zonaPorId(zonaAtiva);
    const x = X(k.c0), y = Y(k.r0), w = X(k.c1 + 1) - x, h = Y(k.r1 + 1) - y;
    g.globalAlpha = .6;
    g.fillStyle = ponteiro.apagar ? '#ffffff' : (z ? z.cor : '#ccc');
    g.fillRect(x, y, w, h);
    g.globalAlpha = 1;
    g.setLineDash([5, 4]);
    g.strokeStyle = ponteiro.apagar ? '#b3261e' : '#e8590c';
    g.lineWidth = 2;
    g.strokeRect(x + 1, y + 1, w - 2, h - 2);
    g.setLineDash([]);
    const txt = `${fmt(metros(k.c1 - k.c0 + 1))} m × ${fmt(metros(k.r1 - k.r0 + 1))} m`;
    g.font = '600 12px system-ui, sans-serif';
    const tw = g.measureText(txt).width;
    g.fillStyle = 'rgba(43,43,39,.88)';
    g.fillRect(x, y - 22, tw + 12, 19);
    g.fillStyle = '#fff';
    g.textBaseline = 'middle';
    g.fillText(txt, x + 6, y - 12);
  }

  // Marca do cursor (tamanho do pincel)
  if (cursor && !ponteiro && FERRAMENTAS_DE_PINTAR.includes(ferramenta) && !espaco) {
    const t = FERRAMENTAS_COM_PINCEL.includes(ferramenta) ? tamPincel : 1;
    const off = Math.floor((t - 1) / 2);
    const cc = cursor.c - off, rr = cursor.r - off;
    if (dentro(cursor.c, cursor.r)) {
      g.strokeStyle = ['borracha', 'limparSombra'].includes(ferramenta) ? '#b3261e' : '#e8590c';
      g.lineWidth = 2;
      g.strokeRect(X(cc) + 1, Y(rr) + 1, X(cc + t) - X(cc) - 2, Y(rr + t) - Y(rr) - 2);
    }
  }
}

function desenharRotulos(g, s, X, Y, solZonas, calendario) {
  if (s < 9) return;
  const fs = Math.max(9, Math.min(15, s * 0.8));
  const fonte = 'system-ui, -apple-system, "Segoe UI", sans-serif';

  // Primeira célula (mais acima, mais à esquerda) de cada área
  const primeira = {};
  estado.celulas.forEach((id, i) => { if (id && primeira[id] === undefined) primeira[id] = i; });

  g.textBaseline = 'top';
  for (const z of estado.zonas) {
    const i = primeira[z.id];
    if (i === undefined) continue;
    const c = i % estado.cols, r = Math.floor(i / estado.cols);
    let w = 0; while (celula(c + w, r) === z.id) w++;
    let h = 0; while (celula(c, r + h) === z.id) h++;
    const bx = X(c), by = Y(r), bw = X(c + w) - bx, bh = Y(r + h) - by;

    // Nomes das plantas (⚠ nas que têm problema sério)
    const analise = modo === 'mapa' ? analiseHorta().porZona[z.id] : null;
    const sitEsp = calendario ? situacaoEspaco(z.id) : null;
    const nomeZona = (analise?.mal ? '⚠️ ' : '') + (sitEsp ? sitEsp.icone + ' ' : '') + z.nome;

    g.font = `650 ${fs}px ${fonte}`;
    if (g.measureText(nomeZona).width + 10 > bw || fs + 8 > bh) continue;

    g.save();
    g.beginPath();
    g.rect(bx, by, bw, bh);
    g.clip();
    g.fillStyle = analise?.mal ? '#a61e1e' : 'rgba(30,30,25,.9)';
    g.fillText(nomeZona, bx + 6, by + 5);

    let plantas = TIPOS_COM_PLANTAS.includes(z.tipo)
      ? (z.plantas || []).filter(t => t && nomePlanta(t).toLowerCase() !== z.nome.toLowerCase()).map(t => {
        const ruim = analise?.plantas.find(x => x.entrada === t)?.problemas.some(p => p.nivel === 'mal');
        return (ruim ? '⚠️ ' : '') + rotuloEntrada(z, t) + (z.qtd?.[t] ? ` ×${z.qtd[t]}` : '');
      })
      : [];
    if (solZonas) {
      // No modo Sol, mostra as horas de sol no lugar das plantas
      const st = solZonas[z.id];
      plantas = st && z.tipo !== 'caminho' ? [`${classeSol(st.media).icone} ${fmt(st.media, 1)} h de sol`] : [];
    }
    // No Calendário, mostra o que cada planta está fazendo no mês
    if (calendario) plantas = linhasCalendario(z, analise);
    if (plantas.length) {
      const fp = fs * 0.9;
      const alt = fp * 1.3;
      const topo = by + 5 + fs * 1.5;
      const cabem = Math.max(1, Math.floor((by + bh - topo - 2) / alt));
      const colunas = plantas.length > cabem && bw > 220 ? 2 : 1;
      const larg = (bw - 12) / colunas;
      g.font = `${fp}px ${fonte}`;
      g.fillStyle = 'rgba(30,30,25,.78)';
      plantas.forEach((p, k) => {
        const col = Math.floor(k / cabem);
        if (col >= colunas) return;
        const lin = k % cabem;
        g.fillText(solZonas || calendario ? p : '• ' + p, bx + 6 + col * larg, topo + lin * alt, larg - 4);
      });
    }
    g.restore();
  }
}

function desenharReguas(g, s, X, Y, W, H) {
  const m = celsPorMetro();
  const passo = s * m < 28 ? m * 2 : m;
  g.font = '11px system-ui, sans-serif';
  g.fillStyle = '#6f6c60';
  g.textAlign = 'center';
  g.textBaseline = 'bottom';
  const yTopo = Math.max(14, Y(0) - 5);
  for (let c = 0; c <= estado.cols; c += passo) g.fillText(`${fmt(metros(c), 1)} m`, X(c), yTopo);
  g.textAlign = 'right';
  g.textBaseline = 'middle';
  const xEsq = Math.max(34, X(0) - 6);
  for (let r = 0; r <= estado.rows; r += passo) g.fillText(`${fmt(metros(r), 1)} m`, xEsq, Y(r));
  g.textAlign = 'left';
}

// ---------- Zoom e tamanho ----------
function redimensionarCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const w = areaMapa.clientWidth, h = areaMapa.clientHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  desenhar();
}
function zoomEm(novo, x, y) {
  novo = Math.min(70, Math.max(3, novo));
  const k = novo / vista.zoom;
  vista.ox = x - (x - vista.ox) * k;
  vista.oy = y - (y - vista.oy) * k;
  vista.zoom = novo;
  atualizarZoomTxt();
  desenhar();
}
function zoomCentro(fator) {
  zoomEm(vista.zoom * fator, areaMapa.clientWidth / 2, areaMapa.clientHeight / 2);
}
function ajustar() {
  const w = areaMapa.clientWidth, h = areaMapa.clientHeight;
  // No modo Sol inclui as árvores e construções fora do terreno
  const k = modo === 'sol' ? limitesSol() : { c0: 0, r0: 0, c1: estado.cols, r1: estado.rows };
  const lc = k.c1 - k.c0, lr = k.r1 - k.r0;
  const topo = modo === 'mapa' ? 48 : 0;   // espaço para a barra de meses
  const z = Math.min((w - 90) / lc, (h - 70 - topo) / lr);
  vista.zoom = Math.min(70, Math.max(3, z));
  vista.ox = Math.round((w - lc * vista.zoom) / 2 + 15 - k.c0 * vista.zoom);
  vista.oy = Math.round((h - topo - lr * vista.zoom) / 2 + 5 + topo - k.r0 * vista.zoom);
  atualizarZoomTxt();
  desenhar();
}
function atualizarZoomTxt() {
  $('zoomTxt').textContent = Math.round(vista.zoom / 14 * 100) + '%';
}

// =====================================================================
//  Mouse / toque
// =====================================================================

function posicao(ev) {
  const rect = canvas.getBoundingClientRect();
  const x = ev.clientX - rect.left, y = ev.clientY - rect.top;
  return { x, y, c: Math.floor((x - vista.ox) / vista.zoom), r: Math.floor((y - vista.oy) / vista.zoom) };
}

canvas.addEventListener('contextmenu', ev => ev.preventDefault());

// ---- Dois dedos: pinça = zoom, arrastar = mover (iPad) ----
const dedos = new Map();      // pointerId → {x, y} dos toques na tela
let gesto = null;             // pinça em andamento
let esperarSoltar = false;    // depois da pinça, ignora o dedo que ficou até ele sair
const tipoPonteiro = { atual: 'mouse' };

// Cancela o que o primeiro dedo começou (pintar, mover forma…) quando entra o segundo
function cancelarPonteiro() {
  const pt = ponteiro;
  ponteiro = null;
  canvas.classList.remove('arrastando');
  if (pt && pt.antes && (pt.alterou || pt.moveu)) { estado = JSON.parse(pt.antes); depoisDeTrocarEstado(); }
}
function iniciarGesto() {
  const [a, b] = [...dedos.values()];
  cancelarPonteiro();
  gesto = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, zoom0: vista.zoom, ox0: vista.ox, oy0: vista.oy };
}
function moverGesto() {
  const [a, b] = [...dedos.values()];
  const rect = canvas.getBoundingClientRect();
  const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
  const zoom = Math.min(70, Math.max(3, gesto.zoom0 * d / gesto.d0));
  // o ponto do terreno que estava entre os dedos continua entre os dedos
  const wx = (gesto.mx - rect.left - gesto.ox0) / gesto.zoom0, wy = (gesto.my - rect.top - gesto.oy0) / gesto.zoom0;
  const mx = (a.x + b.x) / 2 - rect.left, my = (a.y + b.y) / 2 - rect.top;
  vista.zoom = zoom; vista.ox = mx - wx * zoom; vista.oy = my - wy * zoom;
  atualizarZoomTxt();
  desenhar();
}

canvas.addEventListener('pointerdown', ev => {
  tipoPonteiro.atual = ev.pointerType;
  try { canvas.setPointerCapture(ev.pointerId); } catch { /* ponteiro já solto */ }
  if (ev.pointerType === 'touch') {
    dedos.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (dedos.size === 2) { iniciarGesto(); return; }
    if (dedos.size > 2 || esperarSoltar) return;
  }
  const p = posicao(ev);
  cursor = p;

  if (ev.button === 1 || ev.button === 2 || ferramenta === 'mao' || espaco) {
    ponteiro = { modo: 'mover', x: ev.clientX, y: ev.clientY, ox: vista.ox, oy: vista.oy };
    canvas.classList.add('arrastando');
    return;
  }
  if (ev.button !== 0) return;
  if (modo === 'sol') { solPointerDown(ev, p); return; }
  if (modo === 'mapa' && editandoDesenho && formaPointerDown(ev, p)) { desenhar(); return; }
  if (modo === 'mapa' && posicionando && !editandoDesenho) {
    const antes = JSON.stringify(estado);
    const apagar = ev.altKey || apagandoPos;
    const alterou = pintarPosicao(p.c, p.r, apagar);
    ponteiro = { modo: 'pos', ult: p, apagar, alterou, antes };
    invalidarSol();
    desenhar();
    return;
  }

  switch (ferramenta) {
    case 'selecionar': {
      const id = celula(p.c, p.r);
      // No desenho, Selecionar arrasta as áreas e escolhe várias; no planejamento, só seleciona
      if (modo === 'mapa' && editandoDesenho) { selecionarNoDesenho(ev, p); desenhar(); return; }
      if (id > 0) {
        zonaAtiva = id; abrirPainelDetalhe();
        if (modo === 'mapa') ponteiro = { modo: 'dicaMover', ini: p };   // tentou arrastar no planejamento?
      }
      else {
        zonaAtiva = null;
        ponteiro = { modo: 'mover', x: ev.clientX, y: ev.clientY, ox: vista.ox, oy: vista.oy };
      }
      atualizarPaineis();
      desenhar();
      return;
    }
    case 'pincel':
    case 'borracha': {
      if (ferramenta === 'pincel' && !exigirZona()) return;
      const id = ferramenta === 'borracha' ? 0 : zonaAtiva;
      const antes = JSON.stringify(estado);
      const alterou = pintar(p.c, p.r, id);
      ponteiro = { modo: 'pintar', id, ult: p, alterou, antes };
      desenhar();
      return;
    }
    case 'retangulo': {
      if (!ev.altKey && !exigirZona()) return;
      const ini = limitar(p);
      ponteiro = { modo: 'ret', ini, fim: ini, apagar: ev.altKey };
      desenhar();
      return;
    }
    case 'balde': {
      if (!exigirZona() || !dentro(p.c, p.r)) return;
      const antes = JSON.stringify(estado);
      if (preencher(p.c, p.r, zonaAtiva)) { registrar(antes); mudou(); }
      return;
    }
  }
});

canvas.addEventListener('pointermove', ev => {
  if (dedos.has(ev.pointerId)) {
    dedos.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (gesto) { if (dedos.size >= 2) moverGesto(); return; }
    if (esperarSoltar) return;
  }
  const p = posicao(ev);
  cursor = p;
  atualizarStatus(p);
  if (!ponteiro) { cursorForma(p); desenhar(); return; }
  if (['moverZona', 'redim', 'novaForma', 'marquee'].includes(ponteiro.modo)) { formaPointerMove(p); desenhar(); return; }

  if (ponteiro.modo === 'mover') {
    vista.ox = ponteiro.ox + (ev.clientX - ponteiro.x);
    vista.oy = ponteiro.oy + (ev.clientY - ponteiro.y);
  } else if (ponteiro.modo === 'pos') {
    linha(ponteiro.ult.c, ponteiro.ult.r, p.c, p.r, (c, r) => { if (pintarPosicao(c, r, ponteiro.apagar)) ponteiro.alterou = true; });
    ponteiro.ult = p;
    invalidarSol();
  } else if (ponteiro.sol) {
    solPointerMove(p);
  } else if (ponteiro.modo === 'pintar') {
    linha(ponteiro.ult.c, ponteiro.ult.r, p.c, p.r, (c, r) => {
      if (pintar(c, r, ponteiro.id)) ponteiro.alterou = true;
    });
    ponteiro.ult = p;
  } else if (ponteiro.modo === 'ret') {
    ponteiro.fim = limitar(p);
  } else if (ponteiro.modo === 'dicaMover') {
    if (!ponteiro.avisou && Math.abs(p.c - ponteiro.ini.c) + Math.abs(p.r - ponteiro.ini.r) >= 2) {
      ponteiro.avisou = true;
      avisar('Para mover canteiros, toque em “✏️ Editar desenho” (no alto do painel da esquerda).');
    }
    return;
  }
  desenhar();
});

function soltar() {
  if (!ponteiro) return;
  const pt = ponteiro;
  ponteiro = null;
  canvas.classList.remove('arrastando');
  if (['moverZona', 'redim', 'novaForma', 'marquee'].includes(pt.modo)) {
    formaSoltar(pt);
  } else if (pt.modo === 'pos') {
    if (pt.alterou) { registrar(pt.antes); mudou(); }
  } else if (pt.sol) {
    solSoltar(pt);
  } else if (pt.modo === 'pintar') {
    if (pt.alterou) { registrar(pt.antes); mudou(); }
  } else if (pt.modo === 'ret') {
    const antes = JSON.stringify(estado);
    if (aplicarRetangulo(pt.ini, pt.fim, pt.apagar ? 0 : zonaAtiva)) { registrar(antes); mudou(); }
  }
  desenhar();
}
function fimDoDedo(ev) {
  if (dedos.has(ev.pointerId)) {
    dedos.delete(ev.pointerId);
    if (gesto) { if (dedos.size < 2) { gesto = null; esperarSoltar = dedos.size > 0; } return; }
    if (esperarSoltar) { if (!dedos.size) esperarSoltar = false; return; }
  }
  soltar();
}
canvas.addEventListener('pointerup', fimDoDedo);
canvas.addEventListener('pointercancel', fimDoDedo);
canvas.addEventListener('pointerleave', () => {
  if (ponteiro) return;
  cursor = null;
  $('stPos').textContent = TXT.mapaVazio;
  $('stZona').textContent = '';
  desenhar();
});

canvas.addEventListener('wheel', ev => {
  ev.preventDefault();
  const p = posicao(ev);
  const fator = Math.pow(1.0015, -ev.deltaY);
  zoomEm(vista.zoom * fator, p.x, p.y);
}, { passive: false });

function atualizarStatus(p) {
  if (!dentro(p.c, p.r)) {
    $('stPos').textContent = 'Fora do terreno';
    $('stZona').textContent = '';
    return;
  }
  $('stPos').textContent =
    `Quadrado a ${fmt(metros(p.c))} m da esquerda e ${fmt(metros(p.r))} m do topo`;
  const z = zonaPorId(celula(p.c, p.r));
  $('stZona').textContent = (z ? `· ${z.nome} ` : '· vazio ') + (modo === 'sol' ? statusSol(p) : '');
}

// =====================================================================
//  Teclado
// =====================================================================

document.addEventListener('keydown', ev => {
  if (ev.target.matches?.('input, textarea, select')) return;
  const tecla = ev.key.toLowerCase();
  const mod = ev.ctrlKey || ev.metaKey;
  if (mod && tecla === 'z') { ev.preventDefault(); ev.shiftKey ? refazer() : desfazer(); return; }
  if (mod && tecla === 'y') { ev.preventDefault(); refazer(); return; }
  if (mod || modo === 'plantas' || modo === 'diario') return;
  if (ev.code === 'Space') {
    ev.preventDefault();
    if (!espaco) { espaco = true; canvas.classList.add('mover'); desenhar(); }
    return;
  }
  if (tecla === '+' || tecla === '=') { zoomCentro(1.2); return; }
  if (tecla === '-') { zoomCentro(1 / 1.2); return; }
  if (tecla === '0') { ajustar(); return; }
  if (tecla === 'escape' && posicionando) { posicionando = null; atualizarPaineis(); desenhar(); return; }
  if (tecla === 'escape' && ponteiro) { ponteiro = null; desenhar(); return; }
  if (tecla === 'escape' && zonasExtras.size) { limparSelecaoExtra(); atualizarPaineis(); desenhar(); return; }
  if ((tecla === 'delete' || tecla === 'backspace') && modo === 'sol' && objetoAtivo) { excluirObjeto(); return; }
  if ((tecla === 'delete' || tecla === 'backspace') && modo === 'mapa' && zonaAtiva) { ev.preventDefault(); deletarZona(); return; }
  if (modo === 'mapa' && (tecla === 'arrowleft' || tecla === 'arrowright')) { escolherMes(mesSol + (tecla === 'arrowleft' ? -1 : 1)); return; }
  const f = ferramentasAtuais().find(f => f.tecla.toLowerCase() === tecla);
  if (f) escolherFerramenta(f.id);
});
document.addEventListener('keyup', ev => {
  if (ev.code === 'Space') { espaco = false; canvas.classList.remove('mover'); desenhar(); }
});

// =====================================================================
//  Painéis
// =====================================================================

// Liga/desliga as ferramentas de desenho da aba Horta
function alternarDesenho(ligar) {
  editandoDesenho = ligar;
  limparSelecaoExtra();
  ferramenta = ligar ? 'forma' : 'selecionar';
  if (ligar && vistaCal === 'ano') vistaCal = 'mes';
  montarFerramentas();
  aplicarVisibilidadeModo();
  atualizarPaineis();
  desenhar();
}
function atualizarBotaoDesenho() {
  $('btnEditarDesenho').innerHTML = editandoDesenho ? '✓ Terminar desenho' : '✏️ Editar desenho';
  $('notaDesenho').textContent = editandoDesenho
    ? 'Desenhe canteiros, caminhos e muros. Ao acabar, toque em “✓ Terminar desenho”.'
    : '';
}

function ferramentasAtuais() {
  return modo === 'sol' ? FERRAMENTAS_SOL : modo === 'plantas' || modo === 'diario' ? [] : editandoDesenho ? FERRAMENTAS : FERRAMENTAS_CAL;
}

// Mostra só os elementos marcados com data-modo do modo atual
function aplicarVisibilidadeModo() {
  document.body.className = 'modo-' + modo + (modo === 'mapa' && editandoDesenho ? ' editando' : '');
  if (typeof aplicarPaineis === 'function' && $('abaEsq')) aplicarPaineis();   // mantém painéis recolhidos
  document.querySelectorAll('[data-modo]').forEach(el => {
    el.classList.toggle('fora-do-modo', !el.dataset.modo.split(' ').includes(modo));
  });
  // Calendário em "Ano inteiro" troca o mapa pela linha do tempo
  const verAno = modo === 'mapa' && vistaCal === 'ano';
  $('areaAno').classList.toggle('oculto', !verAno);
  $('areaMapa').classList.toggle('oculto', verAno);
}

function montarFerramentas() {
  const box = $('ferramentas');
  box.innerHTML = '';
  // Com uma ferramenta só (planejando: Selecionar), a seção não ajuda em nada — fica escondida
  $('secFerramentas').classList.toggle('so-uma', ferramentasAtuais().length < 2);
  for (const f of ferramentasAtuais()) {
    const b = document.createElement('button');
    b.dataset.f = f.id;
    b.title = `${f.nome} (${f.tecla})`;
    b.innerHTML = `<span>${f.icone}</span><span>${f.nome}</span><span class="tecla">${f.tecla}</span>`;
    b.onclick = () => escolherFerramenta(f.id);
    box.appendChild(b);
  }
  document.querySelectorAll('#tamPincel button').forEach(b => {
    b.onclick = () => { tamPincel = Number(b.dataset.t); atualizarFerramentas(); };
  });
}

function escolherFerramenta(id) {
  ferramenta = id;
  atualizarFerramentas();
  desenhar();
}

function atualizarFerramentas() {
  document.querySelectorAll('#ferramentas button').forEach(b => b.classList.toggle('ativa', b.dataset.f === ferramenta));
  document.querySelectorAll('#tamPincel button').forEach(b => b.classList.toggle('ativa', Number(b.dataset.t) === tamPincel));
  $('linhaPincel').classList.toggle('oculto', !FERRAMENTAS_COM_PINCEL.includes(ferramenta));
  canvas.className = 'f-' + (ferramenta === 'objeto' ? 'selecionar' : ferramenta);
  canvas.style.cursor = '';
  atualizarPainelFormas();
  const f = ferramentasAtuais().find(f => f.id === ferramenta) || ferramentasAtuais()[0];
  if (!f) return;
  const z = zonaPorId(zonaAtiva);
  $('dica').innerHTML = f.dica.replace('{zona}', z ? escapar(z.nome) : '(escolha uma área)') +
    (TOQUE ? ' <span style="opacity:.6">· dois dedos: mover e zoom</span>' : ' <span style="opacity:.6">· Espaço + arrastar: mover</span>');
  // Posicionando uma planta dentro do canteiro
  if (modo === 'mapa' && typeof posicionando !== 'undefined' && posicionando) {
    const zp = zonaPorId(posicionando.zona);
    $('dica').innerHTML = `📍 Pinte onde fica <b>${escapar(rotuloEntrada(zp, posicionando.entrada))}</b> · Alt + arrastar apaga · Esc termina`;
    $('linhaPincel').classList.remove('oculto');
    canvas.className = 'f-pincel';
  }
}

// Ordem alfabética "natural" (Canteiro 2 antes de Canteiro 10)
const ordemNome = (a, b) => a.nome.localeCompare(b.nome, 'pt', { numeric: true, sensitivity: 'base' });
const grupoPorId = id => estado.grupos.find(g => g.id === id);

// Apaga a área selecionada (dá para desfazer com Ctrl+Z)
function deletarZona() {
  const sel = zonasSelecionadas();
  if (sel.length > 1) {
    registrar();
    const fora = new Set(sel);
    estado.celulas = estado.celulas.map(id => fora.has(id) ? 0 : id);
    estado.zonas = estado.zonas.filter(x => !fora.has(x.id));
    zonaAtiva = null; limparSelecaoExtra();
    mudou();
    avisar(`${sel.length} áreas deletadas. Ctrl+Z (ou ↶ Desfazer) traz de volta.`);
    return;
  }
  const z = zonaPorId(zonaAtiva);
  if (!z) return;
  registrar();
  estado.celulas = estado.celulas.map(id => id === z.id ? 0 : id);
  estado.zonas = estado.zonas.filter(x => x !== z);
  zonaAtiva = null;
  mudou();
  avisar(`“${z.nome}” foi deletada. Ctrl+Z (ou ↶ Desfazer) traz de volta.`);
}

// Pergunta o nome e cria uma categoria; devolve o id (ou null)
async function criarGrupo() {
  const nome = ((await perguntar({ titulo: 'Novo grupo', texto: 'Junta áreas na lista (ex.: Horta da frente, Frutíferas). Depois arraste as áreas para ele.', ok: 'Criar', campo: { placeholder: 'Nome do grupo' } })) || '').trim();
  if (!nome) return null;
  registrar();
  const id = estado.proximoGrupoId++;
  estado.grupos.push({ id, nome, fechado: false });
  return id;
}

// O que foi arrastado na lista: "z:3" (área) ou "o:2" (árvore/construção)
function itemArrastado(ev) {
  const [k, id] = String(ev.dataTransfer.getData('text/plain')).split(':');
  return k === 'z' ? zonaPorId(Number(id)) : k === 'o' ? objetoPorId(Number(id)) : null;
}
// Põe o item arrastado no grupo (null = Sem grupo)
function soltarNoGrupo(ev, grupoId) {
  ev.preventDefault();
  const item = itemArrastado(ev);
  if (!item || (grupoPorId(item.grupo) ? item.grupo : null) === grupoId) return;
  registrar(); item.grupo = grupoId; mudou();
  const g = grupoPorId(grupoId);
  avisar(`“${item.nome}” ${g ? `no grupo “${g.nome}”` : 'em “Sem grupo”'}.`);
}
// Liga um <li> da lista como alvo de soltar
function alvoDeSoltar(li, grupoId) {
  li.ondragover = ev => { ev.preventDefault(); li.classList.add('alvo'); };
  li.ondragleave = () => li.classList.remove('alvo');
  li.ondrop = ev => { li.classList.remove('alvo'); soltarNoGrupo(ev, grupoId); };
}
const grupoValido = item => (grupoPorId(item.grupo) ? item.grupo : null);

function itemZona(z, cont, lado) {
  const li = document.createElement('li');
  li.classList.toggle('ativa', z.id === zonaAtiva || (editandoDesenho && zonasExtras.has(z.id)));
  li.draggable = true;
  const area = (cont[z.id] || 0) * lado * lado;
  li.innerHTML = `<span class="amostra" style="background:${escapar(z.cor)}"></span>` +
    `<span class="nome">${escapar(z.nome)}</span>` +
    (() => { const s = situacaoEspaco(z.id); return s ? `<span class="sit ${s.tipo}" title="Em ${MESES[mesSol].toLowerCase()}: ${s.nome}">${s.icone}</span>` : ''; })() +
    `<span class="area">${fmt(area, 1)} m²</span>` +
    `<button class="lixo" title="Deletar área (Del)">🗑</button>`;
  li.title = `${TIPOS[z.tipo]?.nome || ''} — arraste para outro grupo`;
  li.onclick = ev => {
    if (editandoDesenho && (ev.ctrlKey || ev.metaKey || ev.shiftKey) && !ev.target.closest('.lixo')) { alternarNaSelecao(z.id); desenhar(); return; }
    limparSelecaoExtra();
    zonaAtiva = z.id;
    if (ev.target.closest('.lixo')) { deletarZona(); return; }
    if (editandoDesenho && ferramenta === 'borracha') ferramenta = 'retangulo';
    atualizarPaineis();
    desenhar();
  };
  li.ondragstart = ev => { ev.dataTransfer.setData('text/plain', 'z:' + z.id); ev.dataTransfer.effectAllowed = 'move'; };
  alvoDeSoltar(li, grupoValido(z));   // soltar em cima de uma área: vai para o grupo dela
  return li;
}

// Árvore ou construção na lista: tocar leva para a aba Sol e sombra com ela selecionada
function itemObjeto(o) {
  const li = document.createElement('li');
  li.className = 'item-objeto';
  li.draggable = true;
  li.innerHTML = `<span class="amostra-ic">${o.tipo === 'arvore' ? '🌳' : '🏠'}</span><span class="nome">${escapar(o.nome)}</span>` +
    `<span class="area">${fmt(o.altura, 1)} m</span><span class="ir" title="Editar em Sol e sombra">☀️ ›</span>`;
  li.title = 'Fica na aba Sol e sombra (faz sombra na horta) — arraste para outro grupo';
  li.onclick = () => {
    trocarModo('sol');
    objetoAtivo = o.id; ferramenta = 'objeto';
    ajustar(); atualizarPaineis(); desenhar();
  };
  li.ondragstart = ev => { ev.dataTransfer.setData('text/plain', 'o:' + o.id); ev.dataTransfer.effectAllowed = 'move'; };
  alvoDeSoltar(li, grupoValido(o));
  return li;
}

// Cabeçalho de grupo: clicar abre/fecha; ✏️ renomeia; 🗑 apaga (o conteúdo vai para "Sem grupo")
let semGrupoFechado = false;
function cabecalhoGrupo(g, n) {
  const li = document.createElement('li');
  const fechado = g ? g.fechado : semGrupoFechado;
  li.className = 'grupo-zonas' + (fechado ? ' fechado' : '') + (g ? '' : ' sem-grupo');
  li.innerHTML = `<span class="seta">${fechado ? '▸' : '▾'}</span>` +
    `<span class="nome">${g ? `${g.icone ? g.icone + ' ' : ''}${escapar(g.nome)}` : 'Sem grupo'}</span><span class="area">${n}</span>` +
    (g ? `<button class="acao" data-acao="renomear" title="Renomear grupo">✏️</button>` +
      `<button class="acao" data-acao="apagar" title="Apagar grupo (o que está nele vai para “Sem grupo”)">🗑</button>` : '');
  li.onclick = ev => {
    if (!g) { semGrupoFechado = !semGrupoFechado; atualizarListaZonas(); return; }
    const acao = ev.target.closest('[data-acao]')?.dataset.acao;
    if (acao === 'renomear') {
      perguntar({ titulo: 'Renomear grupo', ok: 'Renomear', campo: { valor: g.nome } }).then(v => {
        const nome = (v || '').trim();
        if (!nome) return;
        registrar(); g.nome = nome; mudou();
      });
    } else if (acao === 'apagar') {
      registrar();
      estado.grupos = estado.grupos.filter(x => x !== g);
      for (const z of estado.zonas) if (z.grupo === g.id) z.grupo = null;
      for (const o of estado.objetos) if (o.grupo === g.id) o.grupo = null;
      mudou();
      avisar(`Grupo “${g.nome}” apagado. O que estava nele foi para “Sem grupo”. (↶ desfaz)`);
    } else {
      g.fechado = !g.fechado;
      salvar();
      atualizarListaZonas();
    }
  };
  alvoDeSoltar(li, g ? g.id : null);
  return li;
}

function atualizarListaZonas() {
  const ul = $('listaZonas');
  ul.innerHTML = '';
  if (!estado.zonas.length && !estado.objetos.length) {
    ul.insertAdjacentHTML('beforeend', '<li class="vazio-lista">Nenhuma área ainda. Toque em <b>✏️ Editar desenho</b> e arraste no terreno.</li>');
  }
  const cont = contarCelulas();
  const lado = estado.tamanhoCelulaCm / 100;
  const itensDe = gid => [
    ...estado.zonas.filter(z => grupoValido(z) === gid).sort(ordemNome).map(z => () => itemZona(z, cont, lado)),
    ...estado.objetos.filter(o => grupoValido(o) === gid).sort(ordemNome).map(o => () => itemObjeto(o)),
  ];
  // Todos os grupos ficam sempre à mostra (na ordem em que existem), mesmo vazios
  for (const g of estado.grupos) {
    const itens = itensDe(g.id);
    ul.appendChild(cabecalhoGrupo(g, itens.length));
    if (g.fechado) continue;
    if (!itens.length) {
      const dica = document.createElement('li');
      dica.className = 'grupo-vazio';
      dica.textContent = TOQUE ? 'Vazio' : 'Vazio: arraste para cá';
      alvoDeSoltar(dica, g.id);
      ul.appendChild(dica);
    }
    itens.forEach(f => ul.appendChild(f()));
  }
  // "Sem grupo": só aparece quando tem algo
  const sem = itensDe(null);
  if (sem.length) {
    ul.appendChild(cabecalhoGrupo(null, sem.length));
    if (!semGrupoFechado) sem.forEach(f => ul.appendChild(f()));
  }
}

let formZonaId = null;   // qual área o formulário está mostrando
function atualizarFormZona() {
  const z = zonaPorId(zonaAtiva);
  $('secZona').classList.toggle('oculto', !z);
  const sel = zonasSelecionadas();
  $('zMulti').classList.toggle('oculto', sel.length < 2);
  $('formZona').classList.toggle('multi', sel.length > 1);
  if (sel.length > 1) {
    $('zMulti').innerHTML = `<div class="z-multi-titulo"><b>${sel.length} áreas selecionadas</b></div>
      <div class="nota">${sel.map(id => escapar(zonaPorId(id).nome)).join(', ')}</div>
      <div class="nota">Arraste uma delas para mover todas juntas. ${TOQUE ? '' : 'Esc tira a seleção.'}</div>
      <label class="mover-grupo">Mover para o grupo <select data-multi-grupo>
        <option value="" selected disabled>escolha…</option>
        <option value="0">Sem grupo</option>
        ${estado.grupos.map(g => `<option value="${g.id}">${escapar(g.nome)}</option>`).join('')}
        <option value="__nova">＋ Novo grupo…</option></select></label>
      <div class="grade2"><button data-multi="limpar">Só esta</button><button class="perigo" data-multi="deletar">🗑 Deletar as ${sel.length}</button></div>`;
  }
  renderAnoZona(z);
  atualizarMedidasExatas();
  $('semZona').classList.toggle('oculto', !!z);
  $('formZona').classList.toggle('oculto', !z);
  if (!z) { formZonaId = null; return; }
  // Trocou de área: tira o foco do campo antigo e atualiza todos os campos
  // (senão um campo que ficou com foco continua mostrando a área anterior)
  if (formZonaId !== z.id) {
    if ($('secZona').contains(document.activeElement)) document.activeElement.blur();
    formZonaId = z.id;
    // detalhes (nome, tipo, cor…) ficam recolhidos nos canteiros; abertos em caminhos, muros etc. e ao desenhar
    $('zDetalhes').open = !TIPOS_PLANTAVEIS.includes(z.tipo) || editandoDesenho;
  }
  const ativo = document.activeElement;
  if (ativo !== $('zNome')) $('zNome').value = z.nome;
  if (ativo !== $('zTipo')) $('zTipo').value = z.tipo;
  if (ativo !== $('zCor')) $('zCor').value = z.cor;
  if (ativo !== $('zAltura')) $('zAltura').value = z.altura || 0;
  $('zGrupo').innerHTML = `<option value="">Sem grupo</option>` +
    estado.grupos.map(g => `<option value="${g.id}">${escapar(g.nome)}</option>`).join('') +
    `<option value="__nova">＋ Novo grupo…</option>`;
  $('zGrupo').value = grupoPorId(z.grupo) ? String(z.grupo) : '';
  renderPlantio(z);
  if (ativo !== $('zAltura')) $('zAltura').value = z.altura || 0;
  $('zAlturaLinha').classList.toggle('oculto', !TIPOS_COM_ALTURA.includes(z.tipo));
  const md = medidasDaZona(z.id);
  $('zResumo').innerHTML = `<span>${escapar(TIPOS[z.tipo]?.icone || '')} <b>${escapar(z.nome || 'Sem nome')}</b>` +
    `${md.quadrados ? ` · ${fmt(md.area, 1)} m²` : ''}</span><span class="editar">✏️ editar</span>`;
  $('zLimpar').classList.toggle('oculto', !TIPOS_PLANTAVEIS.includes(z.tipo) || !(z.plantas || []).length);
  $('zMedidas').innerHTML = md.quadrados
    ? `Área: <b>${fmt(md.area)} m²</b> (${md.quadrados} quadrados)<br>Tamanho: <b>${fmt(md.largura)} m × ${fmt(md.altura)} m</b>`
    : 'Ainda não foi desenhada no mapa. Use o <b>Retângulo</b> ou o <b>Pincel</b>.';
}

function atualizarTerreno() {
  const ativo = document.activeElement;
  if (ativo !== $('tLarg')) $('tLarg').value = metros(estado.cols);
  if (ativo !== $('tComp')) $('tComp').value = metros(estado.rows);
  $('tInfo').innerHTML = `Cada quadrado = ${estado.tamanhoCelulaCm} cm × ${estado.tamanhoCelulaCm} cm. ` +
    `Área total: <b>${fmt(metros(estado.cols) * metros(estado.rows), 1)} m²</b> ` +
    `(${estado.cols} × ${estado.rows} quadrados).`;
  if (document.activeElement !== $('nomeHorta')) $('nomeHorta').value = estado.nome;
  document.title = estado.nome || 'Minha Horta';
}

function atualizarPaineis() {
  atualizarListaZonas();
  atualizarFormZona();
  atualizarTerreno();
  atualizarFerramentas();
  atualizarBotaoDesenho();
  atualizarPaineisSol();
  atualizarPaineisPlantas();
  renderCalendario();
  renderDiario();
  atualizarArquivo();
  renderPerfil();
}

// Liga um campo de texto ao estado, com um único "desfazer" por edição
function ligarCampo(el, aplicar) {
  let antes;
  el.addEventListener('focus', () => { antes = JSON.stringify(estado); });
  el.addEventListener('input', () => {
    if (antes === undefined) antes = JSON.stringify(estado);
    aplicar(el.value);
    invalidarSol();
    salvar();
    atualizarListaZonas();
    atualizarFormZona();
    atualizarFerramentas();
    atualizarTerreno();
    atualizarPaineisSol();
    desenhar();
  });
  el.addEventListener('change', () => {
    if (antes !== undefined && antes !== JSON.stringify(estado)) registrar(antes);
    antes = undefined;
  });
}

function montarFormularios() {
  const sel = $('zTipo');
  for (const [id, t] of Object.entries(TIPOS)) {
    const o = document.createElement('option');
    o.value = id;
    o.textContent = `${t.icone} ${t.nome}`;
    sel.appendChild(o);
  }

  ligarCampo($('nomeHorta'), v => { estado.nome = v; });
  ligarCampo($('zNome'), v => { const z = zonaPorId(zonaAtiva); if (z) z.nome = v; });
  ligarCampo($('zCor'), v => { const z = zonaPorId(zonaAtiva); if (z) z.cor = v; });
  ligarCampo($('zAltura'), v => {
    const z = zonaPorId(zonaAtiva);
    const n = Number(String(v).replace(',', '.'));
    if (z && Number.isFinite(n) && n >= 0 && n <= 30) z.altura = n;
  });
  ligarCampo($('zTipo'), v => {
    const z = zonaPorId(zonaAtiva);
    if (!z) return;
    // Se a cor era a padrão do tipo antigo, troca pela cor padrão do novo tipo
    if (z.cor === TIPOS[z.tipo]?.cor) z.cor = TIPOS[v].cor;
    if (z.grupo != null && z.grupo === grupoAutoDe(z.tipo)) z.grupo = grupoAutoDe(v);
    z.tipo = v;
    $('zCor').value = z.cor;
  });

  $('zExcluir').onclick = deletarZona;
  $('zGrupo').onchange = async ev => {
    const z = zonaPorId(zonaAtiva);
    if (!z) return;
    let g = ev.target.value;
    if (g === '__nova') {
      g = await criarGrupo();
      if (!g) { atualizarFormZona(); return; }
    }
    registrar();
    z.grupo = g ? Number(g) : null;
    mudou();
  };
  $('btnNovoGrupo').onclick = async () => { if (await criarGrupo()) mudou(); };

  const mudarTerreno = () => {
    const nc = Math.round(Number($('tLarg').value) * 100 / estado.tamanhoCelulaCm);
    const nr = Math.round(Number($('tComp').value) * 100 / estado.tamanhoCelulaCm);
    if (!(nc >= 5 && nr >= 5 && nc <= 500 && nr <= 500)) { atualizarTerreno(); return; }
    if (nc === estado.cols && nr === estado.rows) { atualizarTerreno(); return; }
    registrar();
    const nova = new Array(nc * nr).fill(0);
    const novaSombra = new Array(nc * nr).fill(0);
    for (let r = 0; r < Math.min(nr, estado.rows); r++) {
      for (let c = 0; c < Math.min(nc, estado.cols); c++) {
        nova[r * nc + c] = estado.celulas[idx(c, r)];
        novaSombra[r * nc + c] = estado.sombra[idx(c, r)];
      }
    }
    estado.cols = nc; estado.rows = nr; estado.celulas = nova; estado.sombra = novaSombra;
    mudou();
    ajustar();
  };
  $('tLarg').addEventListener('change', mudarTerreno);
  $('tComp').addEventListener('change', mudarTerreno);

  // Nova área
}


// ---------- Arquivo ----------
function nomeArquivo(ext) {
  const base = (estado.nome || 'horta').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'horta';
  return `${base}.${ext}`;
}
function baixar(blob, nome) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function montarArquivo() {
  $('btnExportar').onclick = () => {
    baixar(new Blob([JSON.stringify(estado, null, 1)], { type: 'application/json' }), nomeArquivo('json'));
  };
  $('btnImportar').onclick = () => $('arquivo').click();
  $('arquivo').onchange = async ev => {
    const f = ev.target.files[0];
    ev.target.value = '';
    if (!f) return;
    try {
      const e = JSON.parse(await f.text());
      if (!valido(e)) throw new Error('inválido');
      registrar();
      estado = migrar(e);
      objetoAtivo = null;
      zonaAtiva = estado.zonas[0]?.id ?? null;
      mudou();
      ajustar();
      avisar('Horta aberta com sucesso.');
    } catch (_) {
      avisar('Esse arquivo não parece ser uma horta exportada por este app.');
    }
  };
  $('btnImagem').onclick = () => {
    const s = 22, mx = 60, my = 70;
    const W = estado.cols * s + mx + 30, H = estado.rows * s + my + 30;
    const off = document.createElement('canvas');
    off.width = W; off.height = H;
    const g = off.getContext('2d');
    desenharEm(g, W, H, 1, { zoom: s, ox: mx, oy: my }, false);
    g.font = '700 20px system-ui, sans-serif';
    g.fillStyle = '#2b2b27';
    g.textBaseline = 'top';
    g.fillText(estado.nome || 'Minha Horta', mx, 12);
    off.toBlob(b => baixar(b, nomeArquivo('png')));
  };
  $('btnExemplo').onclick = async () => {
    if (!(await perguntar({ titulo: 'Restaurar o exemplo?', texto: 'O mapa atual será trocado pelo exemplo (a horta da planilha). Dá para desfazer com Ctrl+Z.', ok: 'Restaurar exemplo', perigo: true }))) return;
    registrar();
    const { local, norteGraus, norteDefinido, plantasEditadas, minhaLista } = estado;
    estado = migrar(criarExemploHorta());
    Object.assign(estado, { local, norteGraus, norteDefinido, plantasEditadas, minhaLista });
    zonaAtiva = 6;
    objetoAtivo = null;
    mudou();
    ajustar();
  };
  $('btnZerar').onclick = async () => {
    if (!(await perguntar({ titulo: 'Começar do zero?', texto: 'Todas as áreas, plantas dos canteiros, árvores e sombras serão apagadas — fica um terreno vazio do mesmo tamanho. A localização, o norte, o catálogo, a sua lista e o diário continuam. Dá para desfazer com Ctrl+Z.', ok: 'Apagar e começar do zero', perigo: true }))) return;
    registrar();
    estado = migrar({
      nome: estado.nome, tamanhoCelulaCm: estado.tamanhoCelulaCm,
      cols: estado.cols, rows: estado.rows, celulas: new Array(estado.cols * estado.rows).fill(0),
      zonas: [], proximoId: 1,
      local: estado.local, norteGraus: estado.norteGraus, norteDefinido: estado.norteDefinido,
      plantasEditadas: estado.plantasEditadas, minhaLista: estado.minhaLista,
      grupos: [], proximoGrupoId: 1, diario: estado.diario, clima: estado.clima,
    });
    zonaAtiva = null;
    objetoAtivo = null;
    mudou();
  };
}

// ---------- Topo ----------
$('btnDesfazer').onclick = desfazer;
$('btnRefazer').onclick = refazer;
$('btnZoomMais').onclick = () => zoomCentro(1.2);
$('btnZoomMenos').onclick = () => zoomCentro(1 / 1.2);
$('btnAjustar').onclick = ajustar;
$('btnEditarDesenho').onclick = () => alternarDesenho(!editandoDesenho);
document.querySelectorAll('[data-aba]').forEach(b => {
  b.onclick = () => { const antes = modo; trocarModo(b.dataset.aba); if (antes !== modo) ajustar(); };
});

// ---------- Início ----------
montarFerramentas();
montarFormularios();
montarArquivo();
montarSol();
montarDialogo();
montarPlantas();
montarPlano();
montarCalendario();
montarSugerir();
montarCompras();
montarDiario();
montarLembretes();
montarClima();
montarLimpar();
montarFormas();
montarBoasVindas();
montarPrimeirosPassos();
montarMenu();
montarInstalar();
montarPerfil();
montarToque();
montarPaineis();
montarBandeja();
aplicarVisibilidadeModo();
atualizarPaineis();
atualizarBotoesHistorico();
new ResizeObserver(redimensionarCanvas).observe(areaMapa);
redimensionarCanvas();
ajustar();
if (!estadoSalvo) abrirBoasVindas();
