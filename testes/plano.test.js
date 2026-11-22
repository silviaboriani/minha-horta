'use strict';
// =====================================================================
//  Testes do ✨ Sugerir plano (unitários + integrados), rodados no navegador.
//
//  Como rodar: abra o app numa aba SEPARADA (http://localhost:8080/) e, no console:
//    const s = document.createElement('script'); s.src = 'testes/plano.test.js'; document.body.append(s);
//  O resultado aparece no console e em window.resultadoTestes.
//  Os testes desligam o salvar() antes de tudo e usam a horta de exemplo:
//  nada é gravado no navegador. Mesmo assim, não rode na aba onde você usa sua horta.
// =====================================================================
(() => {
  // nunca gravar nada
  window.salvar = () => {}; window.mudou = () => {}; window.registrar = () => {};
  const erros = [];
  window.addEventListener('error', ev => erros.push(ev.message));

  const resultados = [];
  const teste = (nome, fn) => {
    try { const ok = fn(); resultados.push({ nome, ok: ok === true, detalhe: ok === true ? '' : String(ok) }); }
    catch (e) { resultados.push({ nome, ok: false, detalhe: 'erro: ' + e.message }); }
  };
  const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b) || `esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`;
  const planta = id => todasPlantas().find(p => p.id === id);

  // horta de exemplo, perfil conhecido, janela aberta com o ano todo
  function abrir(perfil = { pessoas: 2, objetivo: 'fresco' }, sobra = 'outras') {
    estado = migrar(criarExemploHorta()); invalidarSol();   // sem isso, sobra a análise (em cache) da horta anterior
    estado.perfil = perfil;
    estado.semPlano = [];
    Object.assign(opcoesPlano, { manter: true, repetir: true, sobra });
    opcoesPlano.grupos = new Set(['vegetais', 'frutas', 'ervas', 'graos', 'flores']);
    document.querySelectorAll('.modal').forEach(m => m.classList.add('oculto'));
    abrirSugestaoPlano('horta');
    document.querySelector('[data-ano-todo]').click();
  }
  const foto = () => propostaPlano.zonas.map(r => r.zona.nome + ':' + r.novas.map(x => `${x.id}@${x.inicio}x${x.qtd}`).join(',')).join(' / ');
  const clicar = sel => document.querySelector(sel).click();
  const mudar = (sel, valor) => { const el = document.querySelector(sel); el.value = valor; el.dispatchEvent(new Event('change', { bubbles: true })); };

  // ---------------------------------------------------------------- unitários
  teste('ordemMeses começa no mês pedido', () => igual(ordemMeses(11), [10, 11, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9]));
  teste('ordemMeses(1) é jan–dez', () => igual(ordemMeses(1), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]));
  teste('precisaEspaco: abóbora e batata-doce sim; alface e tomate não', () =>
    igual(['abobora', 'batata-doce', 'alface', 'tomate'].map(id => precisaEspaco(planta(id))), [true, true, false, false]));
  teste('quantidadeAlvo: 2 pessoas comendo fresco = 10 alfaces; sem limite = Infinity', () => {
    estado = migrar(criarExemploHorta());
    estado.perfil = { pessoas: 2, objetivo: 'fresco' };
    const a = quantidadeAlvo(planta('alface'));
    estado.perfil = { pessoas: 2, objetivo: 'espaco' };
    return igual([a, quantidadeAlvo(planta('alface'))], [10, Infinity]);
  });
  teste('sorte: mesma semente e chave → mesmo número; outra semente → outro', () => {
    propostaPlano = { semente: 1 }; const a = sorte('1|alface|11'), a2 = sorte('1|alface|11');
    propostaPlano = { semente: 2 }; const b = sorte('1|alface|11');
    propostaPlano = null;
    return (a === a2 && a !== b && a >= 0 && a < 1) || `${a} ${a2} ${b}`;
  });
  teste('mostrarMes: linha do tempo sem repetir o ciclo', () => {
    propostaPlano = { ordem: ordemMeses(11) };
    const meses = (id, inicio, atual) => {
      const p = planta(id), x = { p, inicio, ativos: mesesAtivos(p, inicio), atual };
      return propostaPlano.ordem.filter(i => x.ativos.has(i + 1) && mostrarMes(x, i)).map(i => MESES_CURTOS[i]);
    };
    const r = {
      novaEmOut: meses('abobora', 10, false),                 // só aparece no fim (out do ano que vem)
      atualDeSet: meses('cenoura', 9, true).includes('set'),  // já no canteiro: não "volta" em set
      futuraEmMar: meses('alface', 3, true)[0],
      perene: meses('alecrim', 5, true).length,
    };
    propostaPlano = null;
    return igual(r, { novaEmOut: ['out'], atualDeSet: false, futuraEmMar: 'mar', perene: 12 });
  });
  teste('outros calendários continuam jan–dez', () =>
    (celulasAno({ p: planta('alface'), inicio: 3 }).match(/title="([^:]+):/) || [])[1] === 'Janeiro' || 'não começa em Janeiro');

  // ---------------------------------------------------------------- integrados
  teste('cabeçalho e botões começam no mês atual, com o ano', () => {
    abrir();
    const inicio = propostaPlano.inicio, ano = anoDoPlano(propostaPlano);
    const ths = [...document.querySelector('#modalPlano table.gantt tr').cells].slice(1);
    const botoes = [...document.querySelectorAll('.meses-plano .mes-plano')].map(b => Number(b.dataset.mesPlano));
    const jan = ths.find(th => th.textContent.endsWith('jan'));
    return (ths[0].textContent === ano + MESES_CURTOS[inicio - 1] && botoes[0] === inicio
      && (inicio === 1 || (jan.classList.contains('virada') && jan.textContent === (ano + 1) + 'jan'))) || ths.map(t => t.textContent).join(' ');
  });

  teste('plantas espaçosas vão para os canteiros grandes', () => {
    abrir();
    const cont = contarCelulas(), lado = estado.tamanhoCelulaCm / 100;
    let grande = 0, pequeno = 0;
    for (let k = 0; k < 10; k++) {
      clicar('[data-plano="outra"]');
      for (const r of propostaPlano.zonas) for (const x of r.novas) if (precisaEspaco(x.p)) {
        if ((cont[r.zona.id] || 0) * lado * lado >= 8) grande++; else pequeno++;
      }
    }
    return (grande > 0 && pequeno * 4 <= grande) || `grandes ${grande}, pequenos ${pequeno}`;   // a maioria nos grandes
  });

  teste('canteiros só pequenos não são tomados por plantas espaçosas', () => {
    abrir();
    const pequenos = estado.zonas.filter(z => z.tipo === 'canteiro' && /^Canteiro \d/.test(z.nome));
    let esp = 0, total = 0;
    for (let k = 0; k < 10; k++) {
      propostaPlano.semente = k + 1;
      for (const r of gerarPlano(pequenos, propostaPlano.inicio)) for (const x of r.novas) { total++; if (precisaEspaco(x.p)) esp++; }
    }
    return (total > 0 && esp / total < 0.25) || `${esp} de ${total}`;   // sem canteiro grande, algumas de verão ainda entram
  });

  teste('espaçosa de rama em canteiro pequeno ganha a dica de treliça (e só ela)', () => {
    abrir();
    const pequenos = estado.zonas.filter(z => z.tipo === 'canteiro' && /^Canteiro \d/.test(z.nome));
    let comDica = 0;
    for (let k = 0; k < 10; k++) {
      propostaPlano.semente = k + 1;
      for (const r of gerarPlano(pequenos, propostaPlano.inicio)) for (const x of r.novas) {
        const deveria = precisaEspaco(x.p) && podeTrelica(x.p);
        if (!!x.trelica !== deveria) return `${x.id} em ${r.zona.nome}: trelica=${x.trelica}`;
        if (x.trelica) { comDica++; if (!x.motivos.some(m => m.includes('treliça'))) return `${x.id} sem o motivo`; }
      }
    }
    // no maior canteiro não aparece
    const maior = estado.zonas.filter(z => z.tipo === 'canteiro').sort((a, b) => (contarCelulas()[b.id] || 0) - (contarCelulas()[a.id] || 0))[0];
    for (const r of gerarPlano([maior], propostaPlano.inicio)) for (const x of r.novas) if (x.trelica) return `${x.id} com treliça no maior canteiro`;
    return comDica > 0 || 'nenhuma dica de treliça em 10 sugestões';
  });

  teste('🪜 aparece na linha da planta com a dica; não nas outras', () => {
    abrir();
    const x = propostaPlano.zonas.flatMap(r => r.novas)[0];
    if (!x) return 'plano vazio';
    x.trelica = true; vistaPlano = 'mes'; renderModalPlano();
    const noMes = document.querySelector('#modalPlano .trelica-pl');
    vistaPlano = 'planta'; renderModalPlano();
    const naPlanta = document.querySelector('#modalPlano .trelica-pl');
    x.trelica = false; vistaPlano = 'canteiro'; renderModalPlano();
    if (!noMes || !naPlanta) return 'faltou nas vistas Mês/Planta';
    const sem = linhaPreview(x, true, '0|0'), com = linhaPreview({ ...x, trelica: true }, true, '0|0');
    return (!sem.includes('🪜') && com.includes('🪜') && !linhaPreview({ ...x, trelica: true }, false, '0|0').includes('🪜')) || 'marca errada';
  });

  teste('alternarAnoTodo: marca tudo e volta aos meses de antes', () => {
    const a = alternarAnoTodo(new Set([11, 3]), null, 11);
    const b = alternarAnoTodo(a.sel, a.antes, 11);
    const c = alternarAnoTodo(new Set([1,2,3,4,5,6,7,8,9,10,11,12]), null, 11);   // sem "antes": só o mês atual
    return (a.sel.size === 12 && igual([...b.sel].sort((p, q) => p - q), [3, 11]) === true && igual([...c.sel], [11]) === true) || 'errado';
  });

  teste('"Ano todo" clicado duas vezes volta aos meses escolhidos; mexer num mês recomeça', () => {
    abrir();   // abre com o ano todo marcado a partir de só o mês atual
    clicar('[data-ano-todo]');
    const atual = propostaPlano.inicio, outro = atual % 12 + 1;
    if (igual([...opcoesPlano.mesesSel], [atual]) !== true) return 'não voltou ao mês atual';
    clicar(`[data-mes-plano="${outro}"]`);
    clicar('[data-ano-todo]');
    if (opcoesPlano.mesesSel.size !== 12) return 'não marcou os 12';
    clicar('[data-ano-todo]');
    const volta = [...opcoesPlano.mesesSel].sort((p, q) => p - q).join();
    if (volta !== [atual, outro].sort((p, q) => p - q).join()) return 'voltou para ' + volta;
    clicar('[data-ano-todo]'); clicar(`[data-mes-plano="${outro}"]`);   // tirou um mês com tudo marcado
    clicar('[data-ano-todo]');   // agora marca de novo (11 → 12)
    if (opcoesPlano.mesesSel.size !== 12) return 'não marcou os 12 depois de mexer';
    clicar('[data-ano-todo]');   // e volta aos 11 escolhidos à mão
    if (opcoesPlano.mesesSel.size !== 11 || opcoesPlano.mesesSel.has(outro)) return 'não voltou aos 11';
    clicar(`[data-mes-plano="${outro}"]`);   // 12 marcados à mão → "Ano todo" volta a só o mês atual
    clicar('[data-ano-todo]');
    return igual([...opcoesPlano.mesesSel], [atual]);
  });

  teste('mudar uma regra e voltar devolve a mesma sugestão', () => {
    abrir();
    const a = foto();
    clicar('[data-op="manter"]'); const b = foto(); clicar('[data-op="manter"]');
    const c = foto();
    mudar('[data-plano-sobra]', 'livre'); mudar('[data-plano-sobra]', 'outras');
    const d = foto();
    clicar('[data-mes-plano="3"]'); clicar('[data-mes-plano="3"]');
    clicar('[data-tipo-plano="flores"]'); clicar('[data-tipo-plano="flores"]');
    return (a !== b && a === c && a === d && a === foto()) || 'a sugestão mudou';
  });

  teste('quantidade digitada e canteiro desmarcado sobrevivem à mudança de regra; "Outra sugestão" sorteia de novo', () => {
    abrir();
    mudar('[data-qtd-plano="0:0"]', 7);
    clicar('[data-aplicar-zona="1"]');
    clicar('[data-op="manter"]'); clicar('[data-op="manter"]');
    const mantidos = propostaPlano.zonas[0].novas[0].qtd === 7 && propostaPlano.zonas[1].aplicar === false;
    const antes = foto();
    clicar('[data-plano="outra"]');
    return (mantidos && foto() !== antes) || `mantidos=${mantidos}`;
  });

  teste('× tira a planta (também da adubação verde) e ↺ devolve o mesmo plano', () => {
    abrir({ pessoas: 2, objetivo: 'fresco' }, 'adubo');
    const ids = () => propostaPlano.zonas.flatMap(r => r.novas.map(x => x.id));
    const tinha = ids().includes('aveia'), a = foto();
    clicar('#modalPlano [data-tirar-planta="aveia"]');
    const tirou = !ids().includes('aveia') && estado.semPlano.includes('aveia') && !!document.querySelector('[data-voltar-planta="aveia"]');
    clicar('[data-voltar-planta="aveia"]');
    return (tinha && tirou && foto() === a && !document.querySelector('.fora-plano')) || `tinha=${tinha} tirou=${tirou}`;
  });

  // Digitar uma quantidade e clicar direto no × de outra planta, na ordem de eventos de cada aparelho
  const ORDENS = {
    'mouse': ['input', 'down', 'change', 'up', 'click'],
    'toque (iPad/celular)': ['input', 'down', 'up', 'change', 'click'],
    'iPad sem tirar o foco da caixa': ['input', 'down', 'up', 'click'],
  };
  for (const [aparelho, ordem] of Object.entries(ORDENS)) teste(`digitar quantidade e clicar no × não perde o clique (${aparelho})`, () => {
    abrir();
    const caixa = document.querySelector('#modalPlano tr.nova input.qtd-plano');
    const [zi, j] = caixa.dataset.qtdPlano.split(':').map(Number);
    const outra = propostaPlano.zonas.flatMap(r => r.novas).find(n => n.id !== propostaPlano.zonas[zi].novas[j].id);
    const botao = document.querySelector(`#modalPlano [data-tirar-planta="${outra.id}"]`);
    caixa.focus(); caixa.value = '3';
    const passo = {
      input: () => caixa.dispatchEvent(new Event('input', { bubbles: true })),
      down: () => botao.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })),
      up: () => botao.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })),
      change: () => { caixa.dispatchEvent(new Event('change', { bubbles: true })); caixa.blur(); },
      click: () => botao.click(),
    };
    for (const p of ordem) passo[p]();
    const ok = estado.semPlano.includes(outra.id) && Object.values(propostaPlano.editadas).includes(3);
    clicar(`[data-voltar-planta="${outra.id}"]`);
    return ok || `tirou=${estado.semPlano.includes(outra.id)} editadas=${JSON.stringify(propostaPlano.editadas)}`;
  });

  teste('sair da caixa de quantidade pelo teclado atualiza a janela na hora', () => {
    abrir();
    const caixa = document.querySelector('#modalPlano [data-qtd-plano="0:0"]');
    caixa.value = '4';
    caixa.dispatchEvent(new Event('change', { bubbles: true }));
    const nova = document.querySelector('#modalPlano [data-qtd-plano="0:0"]');
    return (nova !== caixa && nova.value === '4') || 'não redesenhou';
  });

  teste('× aparece nas três vistas', () => {
    abrir();
    const n = {};
    for (const v of ['mes', 'planta', 'canteiro']) { clicar(`[data-vista-plano="${v}"]`); n[v] = document.querySelectorAll('#modalPlano [data-tirar-planta]').length; }
    return (n.mes > 0 && n.planta > 0 && n.canteiro > 0) || JSON.stringify(n);
  });

  teste('vista Canteiro: ×, quantidade e mês sempre visíveis (nomes longos encurtam)', () => {
    abrir({ pessoas: 4, objetivo: 'espaco' });
    const dentro = (el, th) => { const b = el.getBoundingClientRect(), t = th.getBoundingClientRect(); return b.width > 0 && b.left >= t.left - 1 && b.right <= t.right + 1; };
    const ths = [...document.querySelectorAll('#modalPlano tr.nova th')];
    const ruins = ths.filter(th => !['.tirar-pl', 'input.qtd-plano', '.quando'].every(s => dentro(th.querySelector(s), th)));
    const semEstrela = ths.every(th => !th.querySelector('.quando').textContent.includes('✨'));
    return (ths.length > 0 && !ruins.length && semEstrela) || `${ruins.length} de ${ths.length} linhas cortadas`;
  });

  teste('fechar e abrir de novo não leva o estado da janela anterior', () => {
    abrir();
    mudar('[data-qtd-plano="0:0"]', 7);
    fecharPlano(); abrirSugestaoPlano('horta');
    return (propostaPlano.zonas.every(r => r.aplicar) && Object.keys(propostaPlano.editadas).length === 0) || 'sobrou estado';
  });

  teste('gerador: plantio no fim do plano não "dá a volta" para o começo', () => {
    abrir();
    const p = planta('abobora'), inicio = propostaPlano.inicio, ultimo = ((inicio + 10) % 12) + 1;
    const janela = [...naJanela({ p, inicio: ultimo, ativos: mesesAtivos(p, ultimo) })];
    // e nenhum canteiro passa de 100% de ocupação em mês nenhum
    const cont = contarCelulas(), lado = estado.tamanhoCelulaCm / 100;
    const cheio = propostaPlano.zonas.some(r => {
      const area = (cont[r.zona.id] || 0) * lado * lado;
      return area && MESES.some((_, i) => [...r.atuais, ...r.novas].reduce((s, x) => s + (naJanela(x).has(i + 1) ? x.area || 0 : 0), 0) > area * 1.001);
    });
    return (igual(janela, [ultimo]) === true && !cheio) || `janela ${janela}, passou de 100%: ${cheio}`;
  });

  teste('"Pode repetir…" só aparece em "Usar todo o espaço"', () => {
    abrir({ pessoas: 2, objetivo: 'fresco' });
    const naCasa = !!document.querySelector('[data-op="repetir"]');
    abrir({ pessoas: 2, objetivo: 'espaco' });
    const semLimite = document.querySelector('[data-op="repetir"]');
    return (!naCasa && semLimite && semLimite.checked) || `casa=${naCasa} semLimite=${!!semLimite}`;
  });

  teste('Ctrl+Z com a janela do plano aberta não mexe na horta', () => {
    abrir();
    let desfez = false; const original = window.desfazer; window.desfazer = () => { desfez = true; };
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
    window.desfazer = original;
    return !desfez || 'desfez com a janela aberta';
  });

  teste('migrar arruma semPlano inválido', () => igual(migrar({ ...criarExemploHorta(), semPlano: 'aveia' }).semPlano, []));

  teste('nenhum erro no console durante os testes', () => !erros.length || erros.join(' | '));

  fecharPlano();
  const falhas = resultados.filter(r => !r.ok);
  window.resultadoTestes = { total: resultados.length, falhas: falhas.length, resultados };
  console.log(`Testes do plano: ${resultados.length - falhas.length}/${resultados.length} ok`);
  for (const r of resultados) console.log(`${r.ok ? '✔' : '✘'} ${r.nome}${r.detalhe ? ' — ' + r.detalhe : ''}`);
})();
