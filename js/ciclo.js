'use strict';

// =====================================================================
//  Minha Horta — Fase 5: ciclo de cada planta ao longo do ano
//
//  Cada planta de uma área tem um "mês de plantio" (quando vai para o
//  canteiro). A partir dele e dos dias até a colheita, calculamos o que
//  acontece em cada mês: semear na bandeja, plantar, crescendo, colher.
// =====================================================================

const STATUS = {
  bandeja:   { nome: 'Semear na bandeja', icone: '🌰', cor: '#d0bfff' },
  plantar:   { nome: 'Plantar',           icone: '🌱', cor: '#8fca8f' },
  crescendo: { nome: 'Crescendo',         icone: '🪴', cor: '#c3e6c3' },
  colher:    { nome: 'Colher',            icone: '🧺', cor: '#ffc078' },
  florindo:  { nome: 'Florindo',          icone: '🌸', cor: '#fcc2d7' },
};

const mesMais = (m, k) => ((m - 1 + k) % 12 + 12) % 12 + 1;

// Meses em que a planta pode ir para o canteiro (mudas: meses de transplante)
const mesesDeIrProCanteiro = p => (p.forma === 'muda' && p.tr.length ? p.tr : [...p.sem, ...p.tr]);
// Os melhores meses para ir ao canteiro (se não informado, todos os possíveis são bons)
const mesesBons = p => (p.melhor && p.melhor.length ? p.melhor : mesesDeIrProCanteiro(p));
const temMelhor = p => !!(p.melhor && p.melhor.length);

// Primeiro mês bom para plantar a partir de "aPartirDe" (1–12)
function inicioPadrao(p, aPartirDe = new Date().getMonth() + 1) {
  const ok = mesesDeIrProCanteiro(p);
  if (!ok.length) return aPartirDe;
  for (let k = 0; k < 12; k++) if (ok.includes(mesMais(aPartirDe, k))) return mesMais(aPartirDe, k);
  return aPartirDe;
}

function inicioDe(z, entrada, p) {
  const v = z.plantio?.[entrada];
  return v >= 1 && v <= 12 ? v : (p ? inicioPadrao(p) : new Date().getMonth() + 1);
}

// Mudas: quantos dias ficam na bandeja (da semeadura ao transplante)
const DIAS_BANDEJA_PADRAO = [30, 40];
const diasBandeja = p => p.diasBandeja || DIAS_BANDEJA_PADRAO;
// ...e quantos meses do calendário isso ocupa (mín. 1)
const mesesBandeja = p => (p.forma === 'muda' ? Math.max(1, Math.round((diasBandeja(p)[0] + diasBandeja(p)[1]) / 60 - 0.1)) : 0);

// Meses (contados a partir do plantio) em que começa e termina a colheita
function cicloDe(p) {
  const bandeja = mesesBandeja(p);   // o ciclo do catálogo conta da semeadura; a bandeja sai da conta
  const c0 = Math.min(11, Math.max(1, Math.round(p.col[0] / 30) - bandeja));
  const c1 = Math.min(11, Math.max(c0, Math.round(p.col[1] / 30) - bandeja));
  return { bandeja: !!bandeja && !p.perene, mesesBandeja: bandeja, c0, c1 };
}

// O que a planta está fazendo NO CANTEIRO no mês m (ou null se não está lá)
function statusNoMes(p, inicio, m) {
  const k = (m - inicio + 12) % 12;
  const ci = cicloDe(p);
  if (k === 0) return 'plantar';
  if (k < ci.c0) return 'crescendo';
  if (p.perene || k <= ci.c1) return 'colher';
  return null;
}

// O que mostrar: flores não são colhidas, elas florescem
const statusVisto = (p, st) => (st === 'colher' && ehFlor(p) ? 'florindo' : st);

// Mudas: mês de semear na bandeja, e meses em que a muda está na bandeja
const mesSemear = (p, inicio) => mesMais(inicio, -mesesBandeja(p));
const emBandeja = (p, inicio, m) => {
  if (!cicloDe(p).bandeja) return false;
  const k = (inicio - m + 12) % 12;
  return k >= 1 && k <= mesesBandeja(p);
};

function mesesAtivos(p, inicio) {
  const s = new Set();
  for (let m = 1; m <= 12; m++) if (statusNoMes(p, inicio, m)) s.add(m);
  return s;
}
const seCruzam = (a, b) => { for (const m of a) if (b.has(m)) return true; return false; };

// Meses de risco de geada para Piraquara (hemisfério sul) ou equivalente no norte
const mesesGeada = () => (estado.local.lat < 0 ? [6, 7, 8] : [12, 1, 2]);

// Todas as entradas de uma área com planta, mês de plantio e meses em que ocupa o canteiro
function entradasDaZona(z) {
  return (z.plantas || []).map(entrada => {
    const id = idDaEntrada(entrada);
    const p = id ? plantaPorId(id) : null;
    const inicio = inicioDe(z, entrada, p);
    const ativos = p ? mesesAtivos(p, inicio) : new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    // Onde a planta fica dentro do canteiro (quadrados), se foi marcado — só vale o que ainda é deste canteiro
    const pos = (z.pos?.[entrada] || []).filter(i => estado.celulas[i] === z.id);
    const lado = estado.tamanhoCelulaCm / 100;
    return { entrada, id, p, inicio, ativos, qtd: z.qtd?.[entrada] > 0 ? z.qtd[entrada] : 0, pos, posArea: pos.length * lado * lado };
  });
}

// ---------------------------------------------------------------------
//  Rotação de culturas: evitar a mesma família (Solanáceas, Brássicas…)
//  em seguida no mesmo canteiro — no plano do ano ou no histórico do diário.
// ---------------------------------------------------------------------

function ultimoMesAtivo(ativos) {
  for (const m of ativos) if (!ativos.has(mesMais(m, 1))) return m;
  return null;
}

// Devolve um texto explicando o problema de rotação, ou null
function conflitoRotacao(zonaId, p, inicio, ativos, ents, excluirEntrada) {
  const fam = familiaDe(p);
  if (!FAMILIAS_ROTACAO.includes(fam)) return null;
  // 1. No plano: outra planta da mesma família acabou de sair do canteiro
  for (const o of ents) {
    if (!o.p || o.entrada === excluirEntrada || seCruzam(ativos, o.ativos) || familiaDe(o.p) !== fam) continue;
    const fim = ultimoMesAtivo(o.ativos);
    if (fim === null) continue;
    const intervalo = (inicio - fim + 12) % 12;
    if (intervalo >= 1 && intervalo <= 2) return `logo depois de ${o.p.nome} (mesma família: ${fam})`;
  }
  // 2. No diário: a mesma família foi plantada aqui nos últimos 12 meses
  const hoje = hojeISO();
  for (const r of estado.diario) {
    if (r.tipo !== 'plantio' || r.zona !== zonaId || !r.planta) continue;
    const dias = diasEntre(r.data, hoje);
    if (dias < 0 || dias > 365) continue;
    if (r.entrada === excluirEntrada && dias < 200) continue;   // é o próprio plantio atual
    const q = plantaPorId(r.planta);
    if (q && familiaDe(q) === fam) return `${q.nome} esteve aqui em ${MESES_CURTOS[Number(r.data.slice(5, 7)) - 1]}/${r.data.slice(0, 4)} (mesma família: ${fam})`;
  }
  return null;
}
