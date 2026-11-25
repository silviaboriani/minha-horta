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
  const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b) || `esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`;

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

  // ---- erros da revisão geral (24/11)
  teste('planta sem quantidade: o canteiro não aparece "vazio" (conta como a bolinha)', () => {
    const z = abrir();
    Object.assign(z, { plantas: ['brocolis'], qtd: {}, plantio: { brocolis: mesSol + 1 } });
    invalidarSol(); atualizarPaineis();
    const txt = $('zResumoArea').textContent;
    const sit = situacaoEspaco(z.id);
    return (!/vazio/.test(txt) && /ocupado/.test(txt) && sit.tipo !== 'livre') || `"${txt.replace(/s+/g, ' ')}", bolinha ${sit.tipo}`;
  });
  teste('canteiro sem nenhuma planta não diz que está ocupado', () => {
    const z = abrir();
    Object.assign(z, { plantas: [], qtd: {}, plantio: {} });
    invalidarSol(); atualizarPaineis();
    return !/ocupado/.test($('zResumoArea').textContent) || $('zResumoArea').textContent;
  });
  teste('variedades valem como a cultura nas amigas e inimigas (couve × tomate-cereja, tomate-cereja × milho-pipoca)', () =>
    (saoInimigas('couve', 'tomate-cereja') && saoInimigas('milho-pipoca', 'tomate-cereja') && saoInimigas('tomate', 'milho-verde')
      && !saoInimigas('tomate', 'tomate-cereja') && saoAmigas('tomate-cereja', 'manjericao')) || 'relações erradas');
  teste('canteiro a ~1,2 m do milho-pipoca: tomate-cereja é sugerido com o aviso do vizinho', () => {
    estado = migrar(estadoVazio({ largura: 10, comprimento: 10 })); invalidarSol();
    const a = criarZonaRet({ c0: 5, r0: 5, c1: 9, r1: 19 }, 'canteiro');    // 1 × 3 m
    const b = criarZonaRet({ c0: 5, r0: 26, c1: 24, r1: 35 }, 'canteiro');  // 6 quadrados (1,2 m) abaixo
    Object.assign(b, { plantas: ['milho-pipoca'], qtd: { 'milho-pipoca': 10 }, plantio: { 'milho-pipoca': 10 } });
    invalidarSol();
    const viz = vizinhasDeZonas()[a.id];
    const r = sugestoesPara(a, 'tomate', { mes: 10 }).find(x => x.p.id === 'tomate-cereja');
    const aviso = r && r.etiquetas.some(t => t.tipo === 'perto');
    return (!!viz?.has(b.id) && aviso) || `vizinhas ${viz && [...viz]}, aviso ${aviso}`;
  });

  // ---------------------------------------------------------------- Etapa 6
  teste('sugestões: a melhor variedade de cada cultura vem antes das outras variedades', () => {
    const r = id => ({ p: planta(id) });
    const lista = variedadesNoFim([r('abobora-moranga'), r('abobora-cabotia'), r('alface'), r('cenoura')].filter(x => x.p));
    const nomes = lista.map(x => x.p.id);
    return (nomes.indexOf('alface') < nomes.indexOf('abobora-cabotia') || !planta('abobora-cabotia')) || nomes.join(',');
  });
  teste('sugestões: planta grande num canteiro pequeno perde pontos; a pequena ganha', () => {
    const grande = todasPlantas().find(p => areaDePe(p) >= 1), pequena = planta('cenoura');
    return (pontosDeEspaco(1.5, grande) < 0 && pontosDeEspaco(1.5, pequena) > 0) || `grande ${pontosDeEspaco(1.5, grande)}, pequena ${pontosDeEspaco(1.5, pequena)}`;
  });
  teste('sugestões: num canteiro pequeno e vazio, as primeiras não são variedades repetidas', () => {
    const z = abrir(); z.plantas = []; z.qtd = {}; invalidarSol();
    const topo = sugestoesPara(z, '').slice(0, 8).map(r => r.p.base || r.p.id);
    return new Set(topo).size === topo.length || topo.join(',');
  });
  teste('"Combinam com o que já está aqui" não mostra a própria planta nem outra variedade dela', () => {
    const z = abrir(); z.plantas = ['tomate']; z.qtd = { tomate: 2 }; invalidarSol();
    compTodas.add(z.id);
    const html = htmlCompanheiras(z);
    compTodas.delete(z.id);
    const variedades = todasPlantas().filter(p => p.id !== 'tomate' && (p.base || p.id) === 'tomate').map(p => p.id);
    const aparece = variedades.filter(id => html.includes(`data-add-planta="${id}"`));
    return (variedades.length > 0 && !aparece.length) || `variedades ${variedades.length}, aparecem: ${aparece.join(',')}`;
  });
  teste('sugestões: variedade repetida desce, mas continua acima das que têm aviso', () => {
    const r = (id, etiquetas = []) => ({ p: planta(id), ok: true, etiquetas });
    const nomes = variedadesNoFim([r('abobora-moranga'), r('abobora-cabotia'), r('alface'), r('cenoura', [{ tipo: 'ruim' }])]).map(x => x.p.id);
    return igual(nomes, ['abobora-moranga', 'alface', 'abobora-cabotia', 'cenoura']);
  });
  teste('próximo passo "Planeje": fica no canteiro selecionado', () => {
    abrir(); const plantaveis = estado.zonas.filter(x => TIPOS_PLANTAVEIS.includes(x.tipo));
    plantaveis.forEach(x => { x.plantas = []; x.qtd = {}; });
    const z = plantaveis[plantaveis.length - 1]; zonaAtiva = z.id;   // não é o primeiro canteiro
    Object.assign(estado, { norteDefinido: true, inicio: { passos: true, semArvores: true } });
    renderCalendario();
    const b = $('proximoPasso').querySelector('[data-passo="ir"][data-ir="plano"]');
    if (!b) return 'próximo passo não é o plano: ' + $('proximoPasso').textContent.trim().slice(0, 60);
    b.click();
    return zonaAtiva === z.id || `foi para ${zonaPorId(zonaAtiva)?.nome}`;
  });
  teste('canteiro selecionado: o próximo passo continua à mostra, numa linha', () => {
    abrir(); estado.inicio = { passos: true, semArvores: false }; estado.diario = [];
    renderCalendario();
    const txt = $('proximoPasso').textContent;
    const botao = !!$('proximoPasso').querySelector('[data-passo="ir"]');
    estado.inicio.passos = false; renderCalendario();
    const escondido = $('proximoPasso').textContent.trim();
    return (/Próximo passo/.test(txt) && botao && !escondido) || `"${txt.trim().slice(0, 60)}" / "${escondido}"`;
  });
  teste('sem o norte: o sol do canteiro diz "aproximado", e o botão leva à bússola do desenho', () => {
    abrir(); estado.norteDefinido = false; atualizarPaineis();
    const b = document.querySelector('#painelZona [data-ir-norte], .resumo-area [data-ir-norte]');
    if (!b) return 'sem o botão';
    b.click();
    const ok = modo === 'mapa' && editandoDesenho;
    alternarDesenho(false);
    estado.norteDefinido = true; atualizarPaineis();
    const some = !document.querySelector('.resumo-area [data-ir-norte]');
    return (ok && some) || `desenho ${ok}, some com o norte ${some}`;
  });
  teste('aba Sol e sombra sem o norte: aviso fixo que leva à bússola', () => {
    abrir(); estado.norteDefinido = false; zonaAtiva = null;
    trocarModo('sol');
    const visivel = !$('btnNorteSol').classList.contains('oculto');
    $('btnNorteSol').click();
    const foi = modo === 'mapa' && editandoDesenho;
    alternarDesenho(false);
    return (visivel && foi) || `visível ${visivel}, foi ${foi}`;
  });
  teste('textos: singular e plural pelo número; "passe o mouse" só nas abas com mapa', () => {
    const palavras = [plural(1, 'plantio', 'plantios'), plural(2, 'plantio', 'plantios'), plural(0, 'mês', 'meses')];
    trocarModo('plantas');
    const escondido = $('stPos').offsetParent === null;
    trocarModo('mapa');
    const volta = $('stPos').offsetParent !== null;
    return (igual(palavras, ['plantio', 'plantios', 'meses']) === true && escondido && volta) || `${palavras}, escondido ${escondido}, volta ${volta}`;
  });

  teste('nenhum erro no console durante os testes', () => !erros.length || erros.join(' | '));

  const falhas = resultados.filter(r => !r.ok);
  console.log(`painel: ${resultados.length - falhas.length}/${resultados.length} ok`);
  for (const f of falhas) console.warn('FALHOU:', f.nome, '—', f.detalhe);
  window.resultadoTestes = { total: resultados.length, falhas: falhas.length, resultados };
})();
