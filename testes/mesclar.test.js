'use strict';
// =====================================================================
//  Testes de mesclar() — juntar as mudanças de duas pessoas na mesma horta (unitários).
//
//  Como rodar: abra o app numa aba SEPARADA (http://localhost:8080/) e, no console:
//    const s = document.createElement('script'); s.src = 'testes/mesclar.test.js'; document.body.append(s);
//  O resultado aparece no console e em window.resultadoTestes.
//  Não mexe na horta nem grava nada: só chama a função com hortas pequenas inventadas.
// =====================================================================
(async () => {
  if (typeof mesclar !== 'function') await new Promise((ok, erro) => {
    const s = document.createElement('script'); s.src = 'js/mesclar.js?' + Date.now(); s.onload = ok; s.onerror = erro; document.body.append(s);
  });

  const resultados = [];
  const teste = (nome, fn) => {
    try { const ok = fn(); resultados.push({ nome, ok: ok === true, detalhe: ok === true ? '' : String(ok) }); }
    catch (e) { resultados.push({ nome, ok: false, detalhe: 'erro: ' + e.message }); }
  };
  const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b) || `esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`;
  const copia = v => JSON.parse(JSON.stringify(v));

  // Terreno de 4 × 2 quadradinhos com dois canteiros (1 e 2)
  const BASE = {
    nome: 'Horta', cols: 4, rows: 2,
    celulas: [1, 1, 2, 2, 0, 0, 0, 0], sombra: [0, 0, 0, 0, 0, 0, 0, 0],
    zonas: [{ id: 1, nome: 'Canteiro 1', plantas: ['alface'], grupo: 10 }, { id: 2, nome: 'Canteiro 2', plantas: [], grupo: 10 }],
    proximoId: 3, objetos: [], proximoObjId: 1,
    grupos: [{ id: 10, nome: 'Canteiros' }], proximoGrupoId: 11,
    diario: [{ id: 'r1', tipo: 'nota', zona: 1, texto: 'adubei' }],
    minhaLista: ['alface', 'cenoura'], perfil: { pessoas: 2, objetivo: 'fresco' },
  };
  const mexer = fn => { const e = copia(BASE); fn(e); return e; };

  teste('só eu mudei → fica o meu', () => {
    const meu = mexer(e => { e.nome = 'Horta da Silvia'; });
    return igual(mesclar(BASE, meu, BASE), meu);
  });

  teste('só a outra pessoa mudou → fica o dela', () => {
    const deles = mexer(e => { e.zonas[1].plantas = ['tomate']; });
    return igual(mesclar(BASE, BASE, deles), deles);
  });

  teste('canteiros diferentes mudados ao mesmo tempo → as duas mudanças ficam', () => {
    const meu = mexer(e => { e.zonas[0].nome = 'Alfaces'; });
    const deles = mexer(e => { e.zonas[1].plantas = ['tomate']; });
    const r = mesclar(BASE, meu, deles);
    return igual([r.zonas[0].nome, r.zonas[1].plantas], ['Alfaces', ['tomate']]);
  });

  teste('campos diferentes do mesmo canteiro → as duas mudanças ficam', () => {
    const meu = mexer(e => { e.zonas[0].nome = 'Alfaces'; });
    const deles = mexer(e => { e.zonas[0].plantas = ['alface', 'rucula']; });
    const r = mesclar(BASE, meu, deles);
    return igual(r.zonas[0], { id: 1, nome: 'Alfaces', plantas: ['alface', 'rucula'], grupo: 10 });
  });

  teste('a mesma coisa mudada dos dois lados → vale a minha (a mais nova)', () => {
    const meu = mexer(e => { e.zonas[0].nome = 'Meu nome'; });
    const deles = mexer(e => { e.zonas[0].nome = 'Nome dela'; });
    return igual(mesclar(BASE, meu, deles).zonas[0].nome, 'Meu nome');
  });

  teste('quadradinhos pintados em lugares diferentes → os dois ficam', () => {
    const meu = mexer(e => { e.celulas[4] = 1; e.celulas[5] = 1; });
    const deles = mexer(e => { e.celulas[6] = 2; e.celulas[7] = 2; });
    return igual(mesclar(BASE, meu, deles).celulas, [1, 1, 2, 2, 1, 1, 2, 2]);
  });

  teste('canteiro apagado de um lado e não mexido do outro → some', () => {
    const meu = mexer(e => { e.zonas = e.zonas.filter(z => z.id !== 2); e.celulas = e.celulas.map(v => (v === 2 ? 0 : v)); });
    const deles = mexer(e => { e.zonas[0].nome = 'Alfaces'; });
    const r = mesclar(BASE, meu, deles);
    return igual([r.zonas.map(z => z.id), r.celulas, r.zonas[0].nome], [[1], [1, 1, 0, 0, 0, 0, 0, 0], 'Alfaces']);
  });

  teste('os dois criam um canteiro ao mesmo tempo (mesmo número) → os dois ficam, com números diferentes', () => {
    const meu = mexer(e => { e.zonas.push({ id: 3, nome: 'Meu novo', plantas: [], grupo: 10 }); e.celulas[4] = 3; e.proximoId = 4;
      e.diario.push({ id: 'r2', tipo: 'nota', zona: 3, texto: 'plantei' }); });
    const deles = mexer(e => { e.zonas.push({ id: 3, nome: 'Novo dela', plantas: [], grupo: 10 }); e.celulas[7] = 3; e.proximoId = 4; });
    const r = mesclar(BASE, meu, deles);
    const meuNovo = r.zonas.find(z => z.nome === 'Meu novo'), dela = r.zonas.find(z => z.nome === 'Novo dela');
    if (!meuNovo || !dela) return 'sumiu um canteiro: ' + JSON.stringify(r.zonas.map(z => z.nome));
    if (meuNovo.id === dela.id) return 'mesmo número';
    if (r.celulas[4] !== meuNovo.id || r.celulas[7] !== dela.id) return 'quadradinhos trocados: ' + r.celulas;
    if (r.diario.find(x => x.id === 'r2').zona !== meuNovo.id) return 'diário aponta para o canteiro errado';
    return r.proximoId > Math.max(meuNovo.id, dela.id) || 'proximoId baixo: ' + r.proximoId;
  });

  teste('os dois criam um grupo com o mesmo número → os canteiros continuam no grupo certo', () => {
    const meu = mexer(e => { e.grupos.push({ id: 11, nome: 'Meus' }); e.zonas[0].grupo = 11; e.proximoGrupoId = 12; });
    const deles = mexer(e => { e.grupos.push({ id: 11, nome: 'Dela' }); e.zonas[1].grupo = 11; e.proximoGrupoId = 12; });
    const r = mesclar(BASE, meu, deles);
    const g = nome => r.grupos.find(x => x.nome === nome).id;
    return igual([r.zonas[0].grupo === g('Meus'), r.zonas[1].grupo === g('Dela'), g('Meus') !== g('Dela')], [true, true, true]);
  });

  teste('registros novos no diário dos dois lados → todos ficam', () => {
    const meu = mexer(e => { e.diario.push({ id: 'ra', tipo: 'colheita', zona: 1 }); });
    const deles = mexer(e => { e.diario.push({ id: 'rb', tipo: 'nota', zona: 2 }); });
    return igual(mesclar(BASE, meu, deles).diario.map(r => r.id).sort(), ['r1', 'ra', 'rb']);
  });

  teste('"Minha lista": um põe, outro tira → as duas coisas acontecem', () => {
    const meu = mexer(e => { e.minhaLista.push('tomate'); });
    const deles = mexer(e => { e.minhaLista = e.minhaLista.filter(p => p !== 'cenoura'); });
    return igual(mesclar(BASE, meu, deles).minhaLista, ['alface', 'tomate']);
  });

  teste('terreno mudou de tamanho de um lado → vale a grade inteira desse lado', () => {
    const meu = mexer(e => { e.cols = 2; e.celulas = [1, 1, 0, 0]; e.sombra = [0, 0, 0, 0]; });
    const deles = mexer(e => { e.celulas[6] = 2; });
    const r = mesclar(BASE, meu, deles);
    return igual([r.cols, r.celulas], [2, [1, 1, 0, 0]]);
  });

  teste('não muda as hortas que recebe', () => {
    const b = copia(BASE), meu = mexer(e => { e.zonas.push({ id: 3, nome: 'A' }); }), deles = mexer(e => { e.zonas.push({ id: 3, nome: 'B' }); });
    const m0 = JSON.stringify(meu), d0 = JSON.stringify(deles);
    mesclar(b, meu, deles);
    return (JSON.stringify(b) === JSON.stringify(BASE) && JSON.stringify(meu) === m0 && JSON.stringify(deles) === d0) || 'mudou a entrada';
  });

  teste('a horta de exemplo inteira, sem mudanças → sai igual', () => {
    const ex = migrar(criarExemploHorta());
    return igual(mesclar(ex, ex, ex), ex);
  });

  const falhas = resultados.filter(r => !r.ok);
  console.log(`mesclar: ${resultados.length - falhas.length}/${resultados.length} ok`);
  for (const f of falhas) console.warn('FALHOU:', f.nome, '—', f.detalhe);
  window.resultadoTestes = { total: resultados.length, falhas: falhas.length, resultados };
})();
