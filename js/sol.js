'use strict';

// =====================================================================
//  Minha Horta — Fase 2: localização, norte, sombras e horas de sol
// =====================================================================

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho',
  'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const DIA_DO_MES = [15, 46, 74, 105, 135, 166, 196, 227, 258, 288, 319, 349]; // dia 15 de cada mês
const RAD = Math.PI / 180;
const PASSO_HORARIO = 5;          // graus de ângulo horário (5° = 20 minutos)
const ALTURA_MINIMA_SOL = 5;      // graus: sol mais baixo que isso quase não esquenta
const ALTURA_PLANTA = 0.2;        // m: altura (acima do chão) onde medimos o sol
const FATOR_SOMBRA_MANUAL = [1, 0.5, 0.15]; // nada / meia-sombra / sombra pintada à mão
const TIPOS_COM_ALTURA = ['muro', 'composteira', 'outro'];

// (árvores, construções e o norte ficam no desenho da aba Horta)
const FERRAMENTAS_SOL = [
  { id: 'meiaSombra', icone: '🌥️', nome: 'Meia-sombra', tecla: 'M',
    dica: 'Pinte onde fica na sombra parte do dia.' },
  { id: 'sombraTotal', icone: '☁️', nome: 'Sombra', tecla: 'S',
    dica: 'Pinte onde quase nunca bate sol.' },
  { id: 'limparSombra', icone: '🧽', nome: 'Apagar sombra', tecla: 'E',
    dica: 'Apague a sombra pintada à mão.' },
];

let mesSol = new Date().getMonth();
let mostrarSol = true;
let objetoAtivo = null;
let cacheSol = null;

// Chamado sempre que algo muda: limpa o cálculo do sol e a análise dos canteiros (plano.js)
function invalidarSol() { cacheSol = null; cacheAnalise = null; }
const objetoPorId = id => estado.objetos.find(o => o.id === id);
const ladoM = () => estado.tamanhoCelulaCm / 100;
const arred = (v, passo = 0.1) => Number((Math.round(v / passo) * passo).toFixed(2));

// ---------------------------------------------------------------------
//  Posição do sol
// ---------------------------------------------------------------------

function declinacao(diaDoAno) {
  return 23.44 * RAD * Math.sin(2 * Math.PI * (284 + diaDoAno) / 365);
}

// Lista de posições do sol ao longo de um dia típico do mês.
// Cada amostra traz a direção do sol já "girada" para o mapa (ux, uy),
// a inclinação (k = tangente da altura do sol) e quantas horas ela representa.
function amostrasDoSol(mes) {
  const phi = estado.local.lat * RAD;
  const d = declinacao(DIA_DO_MES[mes]);
  const lista = [];
  for (let hDeg = -180 + PASSO_HORARIO / 2; hDeg < 180; hDeg += PASSO_HORARIO) {
    const h = hDeg * RAD;
    const sinAlt = Math.sin(phi) * Math.sin(d) + Math.cos(phi) * Math.cos(d) * Math.cos(h);
    const alt = Math.asin(sinAlt);
    if (alt < ALTURA_MINIMA_SOL * RAD) continue;
    // Azimute medido a partir do norte, no sentido horário
    const az = Math.atan2(Math.sin(h), Math.cos(h) * Math.sin(phi) - Math.tan(d) * Math.cos(phi)) + Math.PI;
    const b = az + estado.norteGraus * RAD; // direção do sol no mapa (0 = topo do mapa)
    lista.push({ ux: Math.sin(b), uy: -Math.cos(b), k: Math.tan(alt), horas: PASSO_HORARIO / 15, manha: hDeg < 0 });
  }
  return lista;
}

// Direção do sol ao meio-dia (azimute a partir do norte)
function azimuteMeioDia(mes) {
  const phi = estado.local.lat * RAD;
  const d = declinacao(DIA_DO_MES[mes]);
  return Math.sin(phi) - Math.tan(d) * Math.cos(phi) < 0 ? 0 : Math.PI;
}

// ---------------------------------------------------------------------
//  Sombras
// ---------------------------------------------------------------------

function raioBateCaixa(px, py, a, b) {
  let tin = -Infinity, tout = Infinity;
  if (Math.abs(a.ux) < 1e-9) {
    if (px < b.x0 || px > b.x1) return false;
  } else {
    let t1 = (b.x0 - px) / a.ux, t2 = (b.x1 - px) / a.ux;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tin = Math.max(tin, t1); tout = Math.min(tout, t2);
  }
  if (Math.abs(a.uy) < 1e-9) {
    if (py < b.y0 || py > b.y1) return false;
  } else {
    let t1 = (b.y0 - py) / a.uy, t2 = (b.y1 - py) / a.uy;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tin = Math.max(tin, t1); tout = Math.min(tout, t2);
  }
  if (tout <= Math.max(tin, 0)) return false;
  return ALTURA_PLANTA + Math.max(tin, 0) * a.k < b.h;
}

// Copa da árvore = cilindro entre "base" e "topo"
function raioBateArvore(px, py, a, t) {
  const dx = t.x - px, dy = t.y - py;
  const t0 = dx * a.ux + dy * a.uy;
  const perp2 = dx * dx + dy * dy - t0 * t0;
  if (perp2 >= t.r * t.r) return false;
  const meio = Math.sqrt(t.r * t.r - perp2);
  const t2 = t0 + meio;
  if (t2 <= 0) return false;
  const t1 = Math.max(0, t0 - meio);
  return ALTURA_PLANTA + t1 * a.k < t.topo && ALTURA_PLANTA + t2 * a.k > t.base;
}

// Calcula as horas de sol direto em cada quadrado num dia típico do mês
function calcularSol(mes) {
  const { cols, rows, celulas } = estado;
  const L = ladoM();
  const n = cols * rows;
  const horas = new Float32Array(n), manha = new Float32Array(n), tarde = new Float32Array(n);
  const amostras = amostrasDoSol(mes);

  // Altura de cada quadrado (muros etc. desenhados no mapa)
  const alturaZona = {};
  for (const z of estado.zonas) alturaZona[z.id] = TIPOS_COM_ALTURA.includes(z.tipo) ? (z.altura || 0) : 0;
  const alt = new Float32Array(n);
  let maxParede = 0;
  for (let i = 0; i < n; i++) {
    alt[i] = alturaZona[celulas[i]] || 0;
    if (alt[i] > maxParede) maxParede = alt[i];
  }

  // Árvores de folhas caducas deixam passar mais sol no inverno
  const mesesSemFolhas = estado.local.lat < 0 ? [5, 6, 7] : [11, 0, 1];
  const semFolhas = mesesSemFolhas.includes(mes);
  const arvores = estado.objetos.filter(o => o.tipo === 'arvore').map(o => ({
    x: o.x, y: o.y, r: o.diametro / 2, topo: o.altura, base: o.altura * 0.3,
    bloqueio: o.folhas === 'caduca' && semFolhas ? 0.3 : 0.85,
  }));
  const predios = estado.objetos.filter(o => o.tipo === 'construcao').map(o => ({
    x0: o.x, y0: o.y, x1: o.x + o.largura, y1: o.y + o.profundidade, h: o.altura,
  }));

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (alt[i] > 0) { horas[i] = manha[i] = tarde[i] = NaN; continue; }
      const px = (c + 0.5) * L, py = (r + 0.5) * L;
      let m = 0, t = 0;
      for (const a of amostras) {
        let luz = 1;
        for (const b of predios) if (raioBateCaixa(px, py, a, b)) { luz = 0; break; }
        if (luz > 0) for (const tr of arvores) if (raioBateArvore(px, py, a, tr)) luz *= 1 - tr.bloqueio;
        if (luz > 0.01 && maxParede > ALTURA_PLANTA) {
          const tMax = Math.min(60, (maxParede - ALTURA_PLANTA) / a.k);
          for (let s = L / 2; s <= tMax; s += L / 2) {
            const cc = Math.floor((px + a.ux * s) / L), rr = Math.floor((py + a.uy * s) / L);
            if (cc < 0 || rr < 0 || cc >= cols || rr >= rows) break;
            const hh = alt[rr * cols + cc];
            if (hh > 0 && hh > ALTURA_PLANTA + s * a.k) { luz = 0; break; }
          }
        }
        if (a.manha) m += luz * a.horas; else t += luz * a.horas;
      }
      const f = FATOR_SOMBRA_MANUAL[estado.sombra[i] || 0];
      manha[i] = m * f; tarde[i] = t * f; horas[i] = (m + t) * f;
    }
  }
  return { mes, horas, manha, tarde, dia: amostras.length * PASSO_HORARIO / 15 };
}

function obterSol() {
  if (!cacheSol || cacheSol.mes !== mesSol) cacheSol = calcularSol(mesSol);
  return cacheSol;
}

function classeSol(h) {
  if (Number.isNaN(h)) return null;
  if (h >= 6) return { id: 'pleno', nome: 'Sol pleno', icone: '☀️' };
  if (h >= 3) return { id: 'meia', nome: 'Meia-sombra', icone: '⛅' };
  return { id: 'sombra', nome: 'Sombra', icone: '☁️' };
}

const ESCALA_SOL = [
  [0, [40, 58, 115]], [3, [118, 148, 205]], [4.5, [205, 218, 190]],
  [6, [255, 226, 110]], [9, [255, 184, 64]], [13, [240, 128, 40]],
];
function corHoras(h) {
  if (h <= ESCALA_SOL[0][0]) return `rgb(${ESCALA_SOL[0][1]})`;
  for (let i = 1; i < ESCALA_SOL.length; i++) {
    const [h1, c1] = ESCALA_SOL[i];
    if (h <= h1) {
      const [h0, c0] = ESCALA_SOL[i - 1];
      const f = (h - h0) / (h1 - h0);
      return `rgb(${c0.map((v, k) => Math.round(v + (c1[k] - v) * f))})`;
    }
  }
  return `rgb(${ESCALA_SOL[ESCALA_SOL.length - 1][1]})`;
}

function solPorZona() {
  const s = obterSol();
  const acc = {};
  estado.celulas.forEach((id, i) => {
    if (!id || Number.isNaN(s.horas[i])) return;
    const a = acc[id] || (acc[id] = { n: 0, soma: 0, manha: 0, tarde: 0, min: Infinity, max: -Infinity });
    const h = s.horas[i];
    a.n++; a.soma += h; a.manha += s.manha[i]; a.tarde += s.tarde[i];
    if (h < a.min) a.min = h;
    if (h > a.max) a.max = h;
  });
  for (const a of Object.values(acc)) {
    a.media = a.soma / a.n; a.manha /= a.n; a.tarde /= a.n;
  }
  return acc;
}

// ---------------------------------------------------------------------
//  Desenho no mapa
// ---------------------------------------------------------------------

function desenharCamadaSol(g, X, Y, c0, c1, r0, r1) {
  const cols = estado.cols;
  if (mostrarSol) {
    const sol = obterSol();
    g.globalAlpha = 0.62;
    for (let r = r0; r < r1; r++) {
      for (let c = c0; c < c1; c++) {
        const h = sol.horas[r * cols + c];
        if (Number.isNaN(h)) continue;
        g.fillStyle = corHoras(h);
        g.fillRect(X(c), Y(r), X(c + 1) - X(c), Y(r + 1) - Y(r));
      }
    }
    g.globalAlpha = 1;
  }
  // Sombra pintada à mão: listras diagonais
  const p = new Path2D();
  for (let r = r0; r < r1; r++) {
    for (let c = c0; c < c1; c++) {
      const v = estado.sombra[r * cols + c];
      if (!v) continue;
      p.moveTo(X(c), Y(r + 1)); p.lineTo(X(c + 1), Y(r));
      if (v === 2) { p.moveTo(X(c), Y(r)); p.lineTo(X(c + 1), Y(r + 1)); }
    }
  }
  g.strokeStyle = 'rgba(25,35,80,.55)';
  g.lineWidth = 1.2;
  g.stroke(p);
}

function rotuloObjeto(g, txt, x, y) {
  g.font = '600 12px system-ui, sans-serif';
  const w = g.measureText(txt).width + 10;
  g.fillStyle = 'rgba(255,255,255,.88)';
  g.fillRect(x - w / 2, y, w, 18);
  g.fillStyle = '#2b2b27';
  g.textAlign = 'center';
  g.textBaseline = 'top';
  g.fillText(txt, x, y + 3);
  g.textAlign = 'left';
}

function caixaMetros(a, b) {
  const x0 = arred(Math.min(a.x, b.x), 0.2), y0 = arred(Math.min(a.y, b.y), 0.2);
  const x1 = arred(Math.max(a.x, b.x), 0.2), y1 = arred(Math.max(a.y, b.y), 0.2);
  return { x: x0, y: y0, largura: arred(x1 - x0, 0.2), profundidade: arred(y1 - y0, 0.2) };
}

function desenharObjetosSol(g, v) {
  const L = ladoM();
  const sx = x => v.ox + x / L * v.zoom, sy = y => v.oy + y / L * v.zoom, sd = d => d / L * v.zoom;

  for (const o of estado.objetos) {
    const ativo = o.id === objetoAtivo;
    g.setLineDash(ativo ? [6, 4] : []);
    g.lineWidth = ativo ? 3 : 1.5;
    if (o.tipo === 'arvore') {
      const cx = sx(o.x), cy = sy(o.y), r = Math.max(5, sd(o.diametro / 2));
      g.beginPath();
      g.arc(cx, cy, r, 0, 2 * Math.PI);
      g.fillStyle = o.folhas === 'caduca' ? 'rgba(140,165,60,.38)' : 'rgba(46,125,50,.38)';
      g.fill();
      g.strokeStyle = ativo ? '#e8590c' : '#2e6b30';
      g.stroke();
      g.setLineDash([]);
      g.beginPath();
      g.arc(cx, cy, Math.max(2.5, sd(0.15)), 0, 2 * Math.PI);
      g.fillStyle = '#6d4c41';
      g.fill();
      rotuloObjeto(g, `🌳 ${o.nome} · ${fmt(o.altura, 1)} m`, cx, cy + r + 3);
    } else {
      const x = sx(o.x), y = sy(o.y), w = sd(o.largura), h = sd(o.profundidade);
      g.fillStyle = 'rgba(121,85,72,.5)';
      g.fillRect(x, y, w, h);
      g.strokeStyle = ativo ? '#e8590c' : '#4e342e';
      g.strokeRect(x, y, w, h);
      g.setLineDash([]);
      rotuloObjeto(g, `🏠 ${o.nome} · ${fmt(o.altura, 1)} m`, x + w / 2, y + h + 3);
    }
  }
  g.setLineDash([]);

  if (ponteiro && ponteiro.modo === 'novaConstrucao') {
    const k = caixaMetros(ponteiro.ini, ponteiro.fim);
    const x = sx(k.x), y = sy(k.y), w = sd(k.largura), h = sd(k.profundidade);
    g.fillStyle = 'rgba(121,85,72,.3)';
    g.fillRect(x, y, w, h);
    g.setLineDash([5, 4]);
    g.strokeStyle = '#e8590c';
    g.lineWidth = 2;
    g.strokeRect(x, y, w, h);
    g.setLineDash([]);
    rotuloObjeto(g, `${fmt(k.largura)} m × ${fmt(k.profundidade)} m`, x + w / 2, y - 22);
  }
}

// Rosa dos ventos (usada no mapa e no painel)
function desenharRosa(g, cx, cy, r, comSol) {
  const th = estado.norteGraus * RAD;
  g.save();
  g.beginPath();
  g.arc(cx, cy, r, 0, 2 * Math.PI);
  g.fillStyle = '#fff';
  g.shadowColor = 'rgba(0,0,0,.18)';
  g.shadowBlur = 8;
  g.fill();
  g.shadowBlur = 0;
  g.strokeStyle = '#c9c6b8';
  g.lineWidth = 1;
  g.stroke();

  // Marcas a cada 45°
  for (let a = 0; a < 360; a += 45) {
    const ang = th + a * RAD;
    const r1 = r - 3, r2 = a % 90 === 0 ? r - 7 : r - 5;
    g.beginPath();
    g.moveTo(cx + Math.sin(ang) * r1, cy - Math.cos(ang) * r1);
    g.lineTo(cx + Math.sin(ang) * r2, cy - Math.cos(ang) * r2);
    g.strokeStyle = '#b0ad9f';
    g.stroke();
  }

  // Agulha
  const tip = r * 0.62, base = Math.max(4, r * 0.12);
  const ux = Math.sin(th), uy = -Math.cos(th), px = -uy, py = ux;
  g.beginPath();
  g.moveTo(cx + ux * tip, cy + uy * tip);
  g.lineTo(cx + px * base, cy + py * base);
  g.lineTo(cx - px * base, cy - py * base);
  g.closePath();
  g.fillStyle = '#d6336c';
  g.fill();
  g.beginPath();
  g.moveTo(cx - ux * tip, cy - uy * tip);
  g.lineTo(cx + px * base, cy + py * base);
  g.lineTo(cx - px * base, cy - py * base);
  g.closePath();
  g.fillStyle = '#adb5bd';
  g.fill();

  // Letras
  const fs = Math.max(10, Math.round(r * 0.27));
  g.font = `700 ${fs}px system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (const [l, a] of [['N', 0], ['L', 90], ['S', 180], ['O', 270]]) {
    const ang = th + a * RAD, rr = r - 7 - fs * 0.75;
    g.fillStyle = l === 'N' ? '#c2255c' : '#57554c';
    g.fillText(l, cx + Math.sin(ang) * rr, cy - Math.cos(ang) * rr);
  }

  // Sol do meio-dia
  if (comSol) {
    const sa = azimuteMeioDia(mesSol) + th;
    const rs = r + 13;
    g.font = `${fs + 3}px system-ui, sans-serif`;
    g.fillText('☀️', cx + Math.sin(sa) * rs, cy - Math.cos(sa) * rs);
  }
  g.restore();
}

function desenharBussolaMapa(g, W) {
  desenharRosa(g, W - 72, 72, 42, true);
  g.font = '11px system-ui, sans-serif';
  g.fillStyle = '#6f6c60';
  g.textAlign = 'center';
  g.textBaseline = 'top';
  g.fillText(estado.norteDefinido ? '☀️ = sol ao meio-dia' : 'Norte ainda não definido', W - 72, 130);
  g.textAlign = 'left';
}

// ---------------------------------------------------------------------
//  Mouse no modo Sol
// ---------------------------------------------------------------------

function metrosDe(p) {
  const L = ladoM();
  return { x: (p.x - vista.ox) / vista.zoom * L, y: (p.y - vista.oy) / vista.zoom * L };
}

function objetoEm(m) {
  for (let i = estado.objetos.length - 1; i >= 0; i--) {
    const o = estado.objetos[i];
    if (o.tipo === 'arvore') {
      const r = Math.max(o.diametro / 2, 5 / vista.zoom * ladoM());
      if (Math.hypot(m.x - o.x, m.y - o.y) <= r) return o;
    } else if (m.x >= o.x && m.x <= o.x + o.largura && m.y >= o.y && m.y <= o.y + o.profundidade) {
      return o;
    }
  }
  return null;
}

function pintarSombra(c, r, v) {
  let alterou = false;
  const off = Math.floor((tamPincel - 1) / 2);
  for (let dr = 0; dr < tamPincel; dr++) {
    for (let dc = 0; dc < tamPincel; dc++) {
      const cc = c - off + dc, rr = r - off + dr;
      if (dentro(cc, rr) && estado.sombra[idx(cc, rr)] !== v) {
        estado.sombra[idx(cc, rr)] = v;
        alterou = true;
      }
    }
  }
  return alterou;
}

// Desenho (Selecionar): clicou numa árvore ou construção? seleciona e começa a arrastar
function pegarObjeto(p) {
  const m = metrosDe(p);
  const o = objetoEm(m);
  if (!o) return false;
  selecionarObjeto(o.id);
  ponteiro = { sol: true, modo: 'arrastarObj', o, ini: m, ox: o.x, oy: o.y, antes: JSON.stringify(estado), moveu: false };
  return true;
}
// Uma árvore/construção selecionada (e nenhuma área), com a ferramenta Selecionar
function selecionarObjeto(id) {
  objetoAtivo = id;
  zonaAtiva = null;
  limparSelecaoExtra();
  escolherFerramenta('selecionar');
  atualizarPaineis();
  desenhar();
}

// Árvore nova onde o dedo/mouse soltou (pode ser fora do terreno)
function porArvore(m) {
  const antes = JSON.stringify(estado);
  const n = estado.objetos.filter(o => o.tipo === 'arvore').length + 1;
  const o = { id: estado.proximoObjId++, tipo: 'arvore', nome: `Árvore ${n}`, x: arred(m.x), y: arred(m.y), diametro: 4, altura: 6, folhas: 'perene', grupo: grupoAutoDe('arvore') };
  estado.objetos.push(o);
  registrar(antes);
  selecionarObjeto(o.id);
  mudou();
  avisar('Árvore adicionada. Ajuste a altura e a largura da copa no painel à direita.');
}

function solPointerDown(ev, p) {
  const m = metrosDe(p);
  switch (ferramenta) {
    case 'arvore':
      ponteiro = { sol: true, modo: 'novaArvore', m };
      return;
    case 'construcao':
      ponteiro = { sol: true, modo: 'novaConstrucao', ini: m, fim: m };
      desenhar();
      return;
    case 'meiaSombra':
    case 'sombraTotal':
    case 'limparSombra': {
      const v = { meiaSombra: 1, sombraTotal: 2, limparSombra: 0 }[ferramenta];
      const antes = JSON.stringify(estado);
      const alterou = pintarSombra(p.c, p.r, v);
      ponteiro = { sol: true, modo: 'pintarSombra', v, ult: p, alterou, antes };
      desenhar();
      return;
    }
  }
}

function solPointerMove(p) {
  const pt = ponteiro;
  if (pt.modo === 'arrastarObj') {
    const m = metrosDe(p);
    pt.o.x = arred(pt.ox + m.x - pt.ini.x);
    pt.o.y = arred(pt.oy + m.y - pt.ini.y);
    pt.moveu = true;
  } else if (pt.modo === 'novaConstrucao') {
    pt.fim = metrosDe(p);
  } else if (pt.modo === 'pintarSombra') {
    linha(pt.ult.c, pt.ult.r, p.c, p.r, (c, r) => { if (pintarSombra(c, r, pt.v)) pt.alterou = true; });
    pt.ult = p;
  }
}

function solSoltar(pt) {
  if (pt.modo === 'novaArvore') { porArvore(pt.m); return; }
  if (pt.modo === 'arrastarObj' || pt.modo === 'pintarSombra') {
    if (pt.moveu || pt.alterou) { registrar(pt.antes); mudou(); }
  } else if (pt.modo === 'novaConstrucao') {
    const k = caixaMetros(pt.ini, pt.fim);
    if (k.largura < 0.4 || k.profundidade < 0.2) return;
    const antes = JSON.stringify(estado);
    const n = estado.objetos.filter(o => o.tipo === 'construcao').length + 1;
    const o = { id: estado.proximoObjId++, tipo: 'construcao', nome: `Construção ${n}`, ...k, altura: 3, grupo: grupoAutoDe('construcao') };
    estado.objetos.push(o);
    registrar(antes);
    selecionarObjeto(o.id);
    mudou();
    avisar('Construção adicionada. Ajuste a altura no painel à direita.');
  }
}

function excluirObjeto() {
  const o = objetoPorId(objetoAtivo);
  if (!o) return;
  registrar();
  estado.objetos = estado.objetos.filter(x => x !== o);
  objetoAtivo = null;
  mudou();
}

function statusSol(p) {
  const s = obterSol();
  const i = idx(p.c, p.r);
  const h = s.horas[i];
  if (Number.isNaN(h)) return '· muro / construção';
  const cl = classeSol(h);
  return `· ${cl.icone} ${fmt(h, 1)} h de sol em ${MESES[mesSol].toLowerCase()} ` +
    `(manhã ${fmt(s.manha[i], 1)} h, tarde ${fmt(s.tarde[i], 1)} h) — ${cl.nome}`;
}

function limitesSol() {
  const L = ladoM();
  const k = { c0: 0, r0: 0, c1: estado.cols, r1: estado.rows };
  for (const o of estado.objetos) {
    const [x0, y0, x1, y1] = o.tipo === 'arvore'
      ? [o.x - o.diametro / 2, o.y - o.diametro / 2, o.x + o.diametro / 2, o.y + o.diametro / 2 + 0.8]
      : [o.x, o.y, o.x + o.largura, o.y + o.profundidade + 0.8];
    k.c0 = Math.min(k.c0, x0 / L); k.r0 = Math.min(k.r0, y0 / L);
    k.c1 = Math.max(k.c1, x1 / L); k.r1 = Math.max(k.r1, y1 / L);
  }
  return k;
}

// ---------------------------------------------------------------------
//  Painéis do modo Sol
// ---------------------------------------------------------------------

function montarSol() {
  const sel = $('sMes');
  MESES.forEach((m, i) => {
    const o = document.createElement('option');
    o.value = i;
    o.textContent = m;
    sel.appendChild(o);
  });
  sel.value = mesSol;
  sel.onchange = () => { mesSol = Number(sel.value); atualizarPaineisSol(); desenhar(); };
  $('sMostrar').onchange = ev => { mostrarSol = ev.target.checked; desenhar(); };

  ligarCampo($('sCidade'), v => { estado.local.nome = v; estado.local.definido = true; });
  ligarCampo($('sLon'), v => {
    const n = Number(String(v).replace(',', '.'));
    if (Number.isFinite(n) && n >= -180 && n <= 180) estado.local.lon = n;
  });
  ligarCampo($('sLat'), v => {
    const n = Number(String(v).replace(',', '.'));
    if (Number.isFinite(n) && n >= -66 && n <= 66) { estado.local.lat = n; estado.local.definido = true; }
  });
  $('btnGeo').onclick = () => {
    if (!navigator.geolocation) { avisar('Este navegador não consegue informar a localização.'); return; }
    navigator.geolocation.getCurrentPosition(pos => {
      registrar();
      estado.local.lat = Number(pos.coords.latitude.toFixed(3));
      estado.local.lon = Number(pos.coords.longitude.toFixed(3));
      estado.local.definido = true;
      mudou();
      avisar('Latitude atualizada.');
    }, () => avisar('Não foi possível obter a localização. Digite a latitude à mão.'));
  };

  ligarCampo($('sNorte'), v => { estado.norteGraus = Number(v); estado.norteDefinido = true; });
  document.querySelectorAll('[data-norte]').forEach(b => {
    b.onclick = () => {
      registrar();
      estado.norteGraus = Number(b.dataset.norte);
      estado.norteDefinido = true;
      mudou();
    };
  });

  // Bússola do painel: arraste para girar
  const bus = $('bussola');
  let antes = null;
  const girar = ev => {
    const r = bus.getBoundingClientRect();
    const dx = ev.clientX - r.left - r.width / 2, dy = ev.clientY - r.top - r.height / 2;
    let ang = Math.round(Math.atan2(dx, -dy) / RAD / 5) * 5;
    ang = (ang + 360) % 360;
    if (ang !== estado.norteGraus || !estado.norteDefinido) {
      estado.norteGraus = ang;
      estado.norteDefinido = true;
      invalidarSol();
      atualizarPaineisSol();
      desenhar();
    }
  };
  bus.addEventListener('pointerdown', ev => { bus.setPointerCapture(ev.pointerId); antes = JSON.stringify(estado); girar(ev); });
  bus.addEventListener('pointermove', ev => { if (antes) girar(ev); });
  const fim = () => {
    if (!antes) return;
    if (antes !== JSON.stringify(estado)) { registrar(antes); mudou(); }
    antes = null;
  };
  bus.addEventListener('pointerup', fim);
  bus.addEventListener('pointercancel', fim);

  // Objeto selecionado
  const num = v => { const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) && n > 0 ? n : null; };
  const campoObj = (id, aplicar) => ligarCampo($(id), v => { const o = objetoPorId(objetoAtivo); if (o) aplicar(o, v); });
  campoObj('oNome', (o, v) => { o.nome = v; });
  campoObj('oAltura', (o, v) => { const n = num(v); if (n && n <= 60) o.altura = n; });
  campoObj('oDiametro', (o, v) => { const n = num(v); if (n && n <= 40) o.diametro = n; });
  campoObj('oFolhas', (o, v) => { o.folhas = v; });
  campoObj('oLargura', (o, v) => { const n = num(v); if (n && n <= 100) o.largura = n; });
  campoObj('oProfundidade', (o, v) => { const n = num(v); if (n && n <= 100) o.profundidade = n; });
  $('oExcluir').onclick = excluirObjeto;
}

function desenharBussolaPainel() {
  const c = $('bussola');
  const dpr = window.devicePixelRatio || 1;
  const t = 130;
  if (c.width !== t * dpr) { c.width = t * dpr; c.height = t * dpr; c.style.width = c.style.height = t + 'px'; }
  const g = c.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, t, t);
  // "Topo do mapa" como referência
  g.fillStyle = '#ecebe4';
  g.fillRect(t / 2 - 22, 2, 44, 12);
  g.font = '9px system-ui, sans-serif';
  g.fillStyle = '#6f6c60';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('topo do mapa', t / 2, 8);
  desenharRosa(g, t / 2, t / 2 + 6, 46, false);
}

let formObjetoId = null;   // qual árvore/construção o formulário está mostrando
function atualizarPaineisSol() {
  // Trocou de objeto: tira o foco do campo antigo para todos os campos serem atualizados
  if (objetoAtivo !== formObjetoId) {
    if ($('formObjeto').contains(document.activeElement)) document.activeElement.blur();
    formObjetoId = objetoAtivo;
  }
  const ativo = document.activeElement;
  const set = (id, v) => { if (ativo !== $(id)) $(id).value = v; };

  // 1. Local
  set('sCidade', estado.local.nome || '');
  set('sLat', estado.local.lat);
  set('sLon', estado.local.lon);
  const lat = estado.local.lat;
  $('okLocal').textContent = Number.isFinite(lat) ? '✓' : '';
  $('sHemisferio').innerHTML = lat < 0
    ? 'Hemisfério <b>sul</b>: o sol passa pelo lado <b>norte</b> do céu. O que fica ao <b>norte</b> dos canteiros faz mais sombra, principalmente no inverno.'
    : 'Hemisfério <b>norte</b>: o sol passa pelo lado <b>sul</b> do céu. O que fica ao <b>sul</b> dos canteiros faz mais sombra.';

  // 2. Norte
  set('sNorte', estado.norteGraus);
  $('sNorteTxt').textContent = `${estado.norteGraus}°`;
  $('okNorte').textContent = estado.norteDefinido ? '✓' : '';
  $('avisoNorte').classList.toggle('oculto', estado.norteDefinido);
  desenharBussolaPainel();

  // Árvore ou construção selecionada (no desenho)
  const o = objetoPorId(objetoAtivo);
  $('formObjeto').classList.toggle('oculto', !o);
  if (o) {
    $('formObjeto').dataset.tipo = o.tipo;
    $('oTitulo').textContent = o.tipo === 'arvore' ? '🌳 Árvore selecionada' : '🏠 Construção selecionada';
    set('oNome', o.nome);
    set('oAltura', o.altura);
    if (o.tipo === 'arvore') { set('oDiametro', o.diametro); set('oFolhas', o.folhas); }
    else { set('oLargura', o.largura); set('oProfundidade', o.profundidade); }
  }

  // 4. Sol em cada área
  if (modo !== 'sol') return;
  $('sMes').value = mesSol;
  const sol = obterSol();
  const stats = solPorZona();
  const zonas = estado.zonas.filter(z => stats[z.id] && z.tipo !== 'caminho');
  $('sDia').textContent = `Em ${MESES[mesSol].toLowerCase()}, o sol fica alto o suficiente por cerca de ${fmt(sol.dia, 1)} h por dia.`;
  $('tabSol').innerHTML = zonas.length ? zonas.map(z => {
    const s = stats[z.id];
    const cl = classeSol(s.media);
    const varia = s.max - s.min >= 3
      ? `<div class="varia">varia de ${fmt(s.min, 1)} a ${fmt(s.max, 1)} h</div>` : '';
    return `<tr>
      <td><span class="amostra" style="background:${escapar(z.cor)}"></span><span>${escapar(z.nome)}${varia}</span></td>
      <td><span class="pilula" style="background:${corHoras(s.media)};color:${s.media < 2.5 ? '#fff' : '#2b2b27'}" title="${cl.nome}">${cl.icone} ${fmt(s.media, 1)} h</span></td>
      <td class="mt">${fmt(s.manha, 1)} / ${fmt(s.tarde, 1)}</td>
    </tr>`;
  }).join('') : '<tr><td class="vazio">Desenhe canteiros na aba Horta.</td></tr>';
}

function trocarModo(m) {
  if (m === modo) return;
  tracado = null;
  ferramentaPorModo[modo] = ferramenta;
  modo = m;
  ferramenta = ferramentaPorModo[m];
  aplicarVisibilidadeModo();
  document.querySelectorAll('[data-aba]').forEach(b => b.classList.toggle('ativa', b.dataset.aba === m));
  montarFerramentas();
  atualizarPaineis();
  desenhar();
  if (m === 'sol' && !estado.norteDefinido) {
    avisar('Falta mostrar onde fica o norte: aba Horta → ✏️ Editar desenho (painel à direita).');
  }
}
