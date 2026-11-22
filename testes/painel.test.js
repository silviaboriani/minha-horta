'use strict';
// =====================================================================
//  Testes do painel do canteiro (painel da direita, aba Horta): unitários + integrados.
//
//  Como rodar: abra o app numa aba SEPARADA (http://localhost:8080/) e, no console:
//    const s = document.createElement('script'); s.src = 'testes/painel.test.js'; document.body.append(s);
//  O resultado aparece no console e em window.resultadoTestes.
//  Desliga o salvar() e usa a horta de exemplo: nada é gravado no navegador.
// =====================================================================
(() => {
  window.salvar = () => {};
  const erros = [];
  window.addEventListener('error', ev => erros.push(ev.message));

  const resultados = [];
  const teste = (nome, fn) => {
    try { const ok = fn(); resultados.push({ nome, ok: ok === true, detalhe: ok === true ? '' : String(ok) }); }
    catch (e) { resultados.push({ nome, ok: false, detalhe: 'erro: ' + e.message }); }
  };
  const planta = id => todasPlantas().find(p => p.id === id);

  // Canteiro 1 da horta de exemplo, só com brócolis, selecionado na aba Horta
  function abrir(pes = 3) {
    estado = migrar(criarExemploHorta()); invalidarSol();
    document.querySelectorAll('.modal').forEach(m => m.classList.add('oculto'));
    if (modo !== 'mapa') trocarModo('mapa');
    if (editandoDesenho) alternarDesenho(false);
    const z = estado.zonas.find(x => x.nome === 'Canteiro 1');
    Object.assign(z, { plantas: ['brocolis'], qtd: { brocolis: pes }, plantio: { brocolis: mesSol + 1 }, pos: {}, origem: {} });
    zonaAtiva = z.id; formZonaId = null; buscaPlanta = '';
    atualizarPaineis();
    return z;
  }

  // ---------------------------------------------------------------- unitários
  teste('naoCabe: sem espaço para o mínimo de pés → não cabe', () => {
    const alface = planta('alface');
    const umPe = areaDePe(alface);
    return (naoCabe(0, alface) && !naoCabe(umPe * Math.max(1, minPes(alface)), alface)) || 'errado';
  });
  teste('livreNosMeses: conta o que já está no canteiro nos meses em que a nova ficaria', () => {
    const p = planta('alface');
    const ents = [{ p, ativos: new Set([1, 2]), pos: [], qtd: 2 }];
    const ocupado = 2 * areaDePe(p);
    return (Math.abs(livreNosMeses(4, ents, new Set([2, 3])) - (4 - ocupado)) < 1e-9 && livreNosMeses(4, ents, new Set([5])) === 4) || 'errado';
  });

  // ---------------------------------------------------------------- integrados
  teste('topo do painel: nome, sol e ocupação ficam juntos e fixos', () => {
    abrir();
    const topo = $('zTopo');
    return ($('zTitulo').textContent.includes('Canteiro 1') && !!topo.querySelector('.resumo-area')
      && getComputedStyle(topo).position === 'sticky' && !$('zPlantio').querySelector('.resumo-area')) || 'topo incompleto';
  });

  teste('rolando o painel, o topo continua no alto', () => {
    abrir();
    const painel = document.querySelector('.painel.direita');
    const altura = painel.style.maxHeight;
    painel.style.maxHeight = '300px';   // garante que dá para rolar, qualquer que seja o tamanho da janela
    painel.scrollTop = 400;
    const ok = painel.scrollTop > 0 && Math.abs($('zTopo').getBoundingClientRect().top - painel.getBoundingClientRect().top) < 2;
    painel.scrollTop = 0; painel.style.maxHeight = altura;
    return ok || 'o topo rolou junto';
  });

  teste('edição (nome, tipo, cor, grupo) fica embaixo e fechada; ✏️ editar abre; Salvar fecha e guarda', () => {
    abrir();
    const ordem = [...$('formZona').children].map(el => el.id);
    if (ordem.indexOf('zDetalhes') < ordem.indexOf('zPlantio')) return 'edição ainda está em cima';
    if ($('zDetalhes').open) return 'começou aberta';
    document.querySelector('[data-editar-area]').click();
    if (!$('zDetalhes').open) return 'editar não abriu';
    $('zNome').value = 'Alfaces'; $('zNome').dispatchEvent(new Event('input', { bubbles: true }));
    if (document.querySelector('[data-editar-area]')) return '"✏️ editar" continua com a edição aberta';
    $('zSalvar').click();
    return (!$('zDetalhes').open && zonaPorId(zonaAtiva).nome === 'Alfaces' && $('zTitulo').textContent.includes('Alfaces')
      && !!document.querySelector('[data-editar-area]')) || 'Salvar não fechou/guardou, ou o "✏️ editar" não voltou';
  });

  teste('desenhando: a edição vem logo abaixo do topo (e volta para baixo depois)', () => {
    abrir();
    alternarDesenho(true); atualizarPaineis();
    const emCima = $('zTopo').nextElementSibling === $('zDetalhes') && $('zDetalhes').open;
    alternarDesenho(false); atualizarPaineis();
    const embaixo = $('zDetalhes').nextElementSibling === $('zMais');
    return (emCima && embaixo) || `em cima ao desenhar: ${emCima}, embaixo depois: ${embaixo}`;
  });

  teste('sem botão "Adicionar planta": companheiras, busca e sugestões sempre à mostra', () => {
    abrir();
    return (!document.querySelector('[data-alternar-adicionar], .btn-adicionar') && !!document.querySelector('#zPlantio .companheiras')
      && !!document.querySelector('#zPlantio [data-busca-planta]') && !!document.querySelector('#zPlantio .sugestoes')) || 'algo faltando';
  });

  teste('"Só favoritos ★" começa desmarcado', () => {
    const marcadoAoAbrir = soListaPlano;   // antes de qualquer teste mexer
    abrir();
    const caixa = document.querySelector('#zPlantio [data-so-lista]');
    return (!marcadoAoAbrir && (!caixa || !caixa.checked)) || 'começou marcado';
  });

  teste('caminhos, muros etc. continuam com a edição aberta (não têm plantas)', () => {
    abrir();
    const muro = estado.zonas.find(z => !TIPOS_PLANTAVEIS.includes(z.tipo));
    zonaAtiva = muro.id; atualizarPaineis();
    return ($('zDetalhes').open && $('zResumoArea').innerHTML === '') || 'edição fechada ou faixa sobrando';
  });

  teste('depois de pôr uma planta, as que combinam e as sugestões continuam à mostra', () => {
    abrir();
    const sug = document.querySelector('#zPlantio .sug[data-add-planta]');
    const id = sug.dataset.addPlanta;
    sug.click();
    return (zonaPorId(zonaAtiva).plantas.includes(id) && !!document.querySelector('#zPlantio .companheiras')
      && !!document.querySelector('#zPlantio [data-busca-planta]')) || 'a parte de adicionar fechou';
  });

  teste('canteiro cheio: companheiras e resultados da busca ficam vermelhos', () => {
    abrir(40);   // brócolis demais: não sobra espaço
    const chips = [...document.querySelectorAll('#zPlantio .chip-add')];
    const busca = document.querySelector('[data-busca-planta]');
    busca.value = 'alface'; busca.dispatchEvent(new Event('input', { bubbles: true }));
    const sugs = [...document.querySelectorAll('#zPlantio .sug[data-add-planta]')];
    return (chips.length > 0 && chips.every(c => c.classList.contains('nao-cabe'))
      && sugs.length > 0 && sugs.every(s => s.classList.contains('nao-cabe'))) || `chips ${chips.length}, sugestões ${sugs.length}`;
  });

  teste('canteiro com espaço: companheiras que cabem não ficam vermelhas', () => {
    abrir(1);
    const chips = [...document.querySelectorAll('#zPlantio .chip-add')];
    const pequena = chips.find(c => areaDePe(planta(c.dataset.addPlanta)) < 0.1);   // uma planta pequena: cabe com certeza
    return (!!pequena && !pequena.classList.contains('nao-cabe')) || `nenhuma companheira pequena sem vermelho (${chips.length} chips)`;
  });

  teste('pôr uma companheira pelo botão dela funciona e a parte de adicionar continua aberta', () => {
    abrir(1);
    const chip = document.querySelector('#zPlantio .chip-add');
    const id = chip.dataset.addPlanta;
    chip.click();
    return (zonaPorId(zonaAtiva).plantas.includes(id) && !!document.querySelector('#zPlantio .companheiras')) || 'não pôs, ou fechou';
  });

  teste('"Usar as quantidades sugeridas" (na faixa do topo) continua funcionando', () => {
    abrir();
    const z = zonaPorId(zonaAtiva);
    Object.assign(z, { plantas: ['alface', 'cenoura'], qtd: {}, plantio: { alface: mesSol + 1, cenoura: mesSol + 1 } });
    invalidarSol(); atualizarPaineis();
    const b = document.querySelector('#zResumoArea [data-preencher]');
    if (!b) return 'botão não apareceu';
    b.click();
    return (Object.keys(zonaPorId(zonaAtiva).qtd).length === 2) || 'não preencheu';
  });

  teste('nenhum erro no console durante os testes', () => !erros.length || erros.join(' | '));

  const falhas = resultados.filter(r => !r.ok);
  console.log(`painel: ${resultados.length - falhas.length}/${resultados.length} ok`);
  for (const f of falhas) console.warn('FALHOU:', f.nome, '—', f.detalhe);
  window.resultadoTestes = { total: resultados.length, falhas: falhas.length, resultados };
})();
