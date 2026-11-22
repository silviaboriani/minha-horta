'use strict';

// =====================================================================
//  Minha Horta — juntar as mudanças de duas pessoas na mesma horta
//
//  mesclar(base, meu, deles)
//    base  = a última versão que os dois lados viram
//    meu   = como a horta está neste aparelho
//    deles = como a horta está na nuvem (mudada por outra pessoa)
//  Devolve a horta juntada. O que só um lado mudou, vale; se os dois mudaram
//  exatamente a mesma coisa, vale "meu" (a mudança mais nova).
//  Canteiros, árvores, grupos e registros do diário são juntados um a um (pelo id);
//  os quadradinhos do mapa, um a um (pela posição).
//  Função pura: não lê nem grava nada, e não muda o que recebe.
// =====================================================================

const copiaJ = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const igualJ = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const ehObjeto = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const temIds = l => Array.isArray(l) && l.every(x => ehObjeto(x) && x.id !== undefined && x.id !== null);
const GRADE = ['cols', 'rows', 'celulas', 'sombra'];

function mesclar(base, meu, deles) {
  if (!base) return copiaJ(meu);
  const m = renumerar(base, copiaJ(meu), deles);
  const r = juntar(base, m, deles, '');
  // terreno de outro tamanho: os quadradinhos não batem posição a posição, vale a grade inteira de um lado
  if (m.cols !== deles.cols || m.rows !== deles.rows) {
    const lado = (m.cols !== base.cols || m.rows !== base.rows) ? m : deles;
    for (const k of GRADE) r[k] = copiaJ(lado[k]);
  }
  return r;
}

function juntar(b, m, d, chave) {
  if (igualJ(m, d)) return copiaJ(m);
  if (igualJ(m, b)) return copiaJ(d);
  if (igualJ(d, b)) return copiaJ(m);
  // os dois lados mudaram
  if (chave.startsWith('proximo') && typeof m === 'number' && typeof d === 'number') return Math.max(m, d);
  if (Array.isArray(m) && Array.isArray(d)) {
    if (temIds(m) && temIds(d) && (b === undefined || temIds(b))) return juntarPorId(b || [], m, d);
    if ((chave === 'celulas' || chave === 'sombra') && Array.isArray(b) && b.length === m.length && m.length === d.length)
      return m.map((v, i) => juntar(b[i], v, d[i], ''));
    if ([...m, ...d].every(x => !ehObjeto(x) && !Array.isArray(x))) return juntarConjunto(Array.isArray(b) ? b : [], m, d);
    return copiaJ(m);
  }
  if (ehObjeto(m) && ehObjeto(d)) {
    const bo = ehObjeto(b) ? b : {};
    const r = {};
    for (const k of new Set([...Object.keys(m), ...Object.keys(d)])) {
      const v = juntar(bo[k], m[k], d[k], k);
      if (v !== undefined) r[k] = v;
    }
    return r;
  }
  return copiaJ(m);
}

// Listas de coisas com id: junta item a item; apagado de um lado (e não mexido do outro) some
function juntarPorId(b, m, d) {
  const mapa = l => new Map(l.map(x => [x.id, x]));
  const B = mapa(b), M = mapa(m), D = mapa(d);
  const ids = [...M.keys(), ...[...D.keys()].filter(id => !M.has(id))];
  const r = [];
  for (const id of ids) {
    const v = juntar(B.get(id), M.get(id), D.get(id), '');
    if (v !== undefined) r.push(v);
  }
  return r;
}

// Listas simples (ex.: "Minha lista" de plantas): o que alguém tirou sai; o que alguém pôs entra
function juntarConjunto(b, m, d) {
  const tirados = new Set(b.filter(x => !m.includes(x) || !d.includes(x)));
  return [...new Set([...m, ...d])].filter(x => !tirados.has(x));
}

// Os dois criaram um canteiro (ou árvore, ou grupo) ao mesmo tempo e ganharam o mesmo número:
// o daqui ganha um número novo, e tudo o que apontava para ele aqui é ajustado
function renumerar(base, m, d) {
  const listas = [['zonas', 'proximoId'], ['objetos', 'proximoObjId'], ['grupos', 'proximoGrupoId']];
  for (const [lista, campo] of listas) {
    const naBase = new Set((base[lista] || []).map(x => x.id));
    const deles = new Map((d[lista] || []).map(x => [x.id, x]));
    const todos = [base, m, d].flatMap(e => (e[lista] || []).map(x => x.id));
    let prox = Math.max(0, ...todos, ...[base, m, d].map(e => (e[campo] || 1) - 1)) + 1;
    for (const item of m[lista] || []) {
      const velho = item.id;
      if (naBase.has(velho) || !deles.has(velho) || igualJ(item, deles.get(velho))) continue;
      const novo = prox++;
      item.id = novo;
      if (lista === 'zonas') {
        m.celulas = (m.celulas || []).map(v => (v === velho ? novo : v));
        for (const r of m.diario || []) if (r.zona === velho) r.zona = novo;
      }
      if (lista === 'grupos') for (const x of [...(m.zonas || []), ...(m.objetos || [])]) if (x.grupo === velho) x.grupo = novo;
    }
    m[campo] = Math.max(m[campo] || 1, prox);
  }
  return m;
}
