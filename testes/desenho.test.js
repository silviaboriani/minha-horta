'use strict';
// =====================================================================
//  Testes do desenho (aba Horta → ✏️ Editar desenho): unitários + integrados.
//  Ferramentas por categoria; retângulo, círculo e linha; árvores, construções e norte no desenho.
//
//  Como rodar: abra o app numa aba SEPARADA (http://localhost:8080/) e, no console:
//    const s = document.createElement('script'); s.src = 'testes/desenho.test.js'; document.body.append(s);
//  O resultado aparece no console e em window.resultadoTestes.
//  Desliga o salvar() e usa hortas inventadas: nada é gravado no navegador.
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
  const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b) || `esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`;

  // Terreno vazio de 10 × 10 m (50 × 50 quadrados), desenhando
  function vazio() {
    estado = migrar(estadoVazio({ largura: 10, comprimento: 10 })); invalidarSol();
    document.querySelectorAll('.modal').forEach(m => m.classList.add('oculto'));
    if (modo !== 'mapa') trocarModo('mapa');
    alternarDesenho(true);
    zonaAtiva = null; objetoAtivo = null; tracado = null; formaDesenho = 'ret';
    historico = []; futuro = [];
  }
  // eventos do ponteiro em (coluna, linha) do mapa — aceita frações e números negativos (fora do terreno)
  const ponto = (tipo, c, r, pointerType = 'mouse', pointerId = 1) => {
    const rect = canvas.getBoundingClientRect();
    canvas.dispatchEvent(new PointerEvent(tipo, { bubbles: true, button: 0, pointerId, pointerType,
      clientX: rect.left + vista.ox + c * vista.zoom, clientY: rect.top + vista.oy + r * vista.zoom }));
  };
  const arrastar = (c0, r0, c1, r1) => { ponto('pointerdown', c0, r0); ponto('pointermove', c1, r1); ponto('pointerup', c1, r1); };
  const clicar = (c, r) => { ponto('pointerdown', c, r); ponto('pointerup', c, r); };
  const tecla = key => document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  const categoria = tipo => document.querySelector(`#ferramentas [data-tipo="${tipo}"]`).click();
  const jeito = f => document.querySelector(`[data-forma-desenho="${f}"]`).click();
  const zonasPorTipo = t => estado.zonas.filter(z => z.tipo === t);

  // ---------------------------------------------------------------- unitários
  vazio();
  teste('círculo: quadrados com o centro dentro da elipse (10 × 10 ≈ 78)', () => {
    const n = celsDoCirculo({ c0: 0, r0: 0, c1: 9, r1: 9 }).length;
    return (n >= 76 && n <= 82) || `${n} quadrados`;
  });
  teste('polígono: triângulo retângulo de 10 × 10 tem cerca de metade dos quadrados', () => {
    const n = celsDoPoligono([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }]).length;
    return (n >= 40 && n <= 55) || `${n} quadrados`;
  });
  teste('polígono com menos de 3 pontos não vira área', () => igual(celsDoPoligono([{ x: 0, y: 0 }, { x: 5, y: 5 }]), []));
  teste('linha aberta (muro): um "L" passa por cada quadrado uma vez só', () => {
    const cels = celsDaLinhaAberta([{ x: 0.5, y: 0.5 }, { x: 9.5, y: 0.5 }, { x: 9.5, y: 4.5 }]);
    return (cels.length === 14 && new Set(cels).size === 14) || `${cels.length} quadrados`;
  });
  teste('dentroDoPoligono: centro do quadrado sim, fora não', () =>
    igual([dentroDoPoligono(2, 2, [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }]), dentroDoPoligono(5, 2, [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }])], [true, false]));

  // ---------------------------------------------------------------- ferramentas
  teste('ferramentas com o nome das categorias (e árvore e construção no desenho)', () => {
    vazio();
    const nomes = [...document.querySelectorAll('#ferramentas button')].map(b => b.querySelector('span:nth-child(2)').textContent);
    const esperados = ['Selecionar', ...Object.values(TIPOS).map(t => t.nome), 'Árvore', 'Construção'];
    return esperados.every(n => nomes.includes(n)) || 'faltou: ' + esperados.filter(n => !nomes.includes(n)).join(', ');
  });
  teste('escolher uma categoria mostra os três jeitos de desenhar; Selecionar esconde', () => {
    vazio();
    categoria('caminho');
    const jeitos = [...document.querySelectorAll('#linhaForma [data-forma-desenho]')].map(b => b.dataset.formaDesenho);
    const ativa = document.querySelector('#ferramentas button.ativa')?.dataset.tipo;
    document.querySelector('#ferramentas [data-f="selecionar"]').click();
    const escondida = $('linhaForma').classList.contains('oculto');
    return (igual(jeitos, ['ret', 'circulo', 'linha']) === true && ativa === 'caminho' && escondida) || `jeitos ${jeitos}, ativa ${ativa}, escondida ${escondida}`;
  });

  // ---------------------------------------------------------------- desenhar
  teste('retângulo de canteiro', () => {
    vazio(); categoria('canteiro'); jeito('ret');
    arrastar(2.5, 2.5, 6.5, 8.5);
    const z = zonasPorTipo('canteiro')[0];
    return (!!z && celulasDaZona(z.id).length === 35 && zonaAtiva === z.id) || 'não criou 5 × 7';
  });
  teste('círculo de composteira', () => {
    vazio(); categoria('composteira'); jeito('circulo');
    arrastar(10.5, 2.5, 19.5, 11.5);
    const z = zonasPorTipo('composteira')[0];
    const n = z && celulasDaZona(z.id).length;
    return (n >= 76 && n <= 82) || `${n} quadrados`;
  });
  teste('linha que fecha: clicar no primeiro ponto cria a área', () => {
    vazio(); categoria('caminho'); jeito('linha');
    clicar(10, 10); clicar(30, 10); clicar(10, 30);
    if (!tracado || tracado.pontos.length !== 3) return 'pontos não marcados';
    clicar(10.2, 10.1);   // perto do primeiro
    const z = zonasPorTipo('caminho')[0];
    return (!!z && !tracado && celulasDaZona(z.id).length > 150) || 'não fechou';
  });
  teste('muro: linha aberta, Enter termina', () => {
    vazio(); categoria('muro'); jeito('linha');
    clicar(2.5, 30.5); clicar(30.5, 30.5); clicar(30.5, 45.5);
    tecla('Enter');
    const z = zonasPorTipo('muro')[0];
    return (!!z && celulasDaZona(z.id).length === 44) || `muro com ${z && celulasDaZona(z.id).length} quadrados`;
  });
  teste('muro: clicar de novo no último ponto também termina', () => {
    vazio(); categoria('muro'); jeito('linha');
    clicar(2.5, 2.5); clicar(12.5, 2.5); clicar(12.5, 2.5);
    return (zonasPorTipo('muro').length === 1 && !tracado) || 'não terminou';
  });
  teste('linha: Backspace desfaz o último ponto; Esc cancela sem criar nada', () => {
    vazio(); categoria('canteiro'); jeito('linha');
    clicar(5, 5); clicar(15, 5); clicar(15, 15);
    tecla('Backspace');
    const depois = tracado.pontos.length;
    tecla('Escape');
    return (depois === 2 && !tracado && !estado.zonas.length) || `pontos ${depois}, tracado ${!!tracado}`;
  });
  teste('linha: botões Terminar e Cancelar (para o iPad, sem teclado)', () => {
    vazio(); categoria('canteiro'); jeito('linha');
    clicar(5, 5); clicar(15, 5); clicar(15, 15);
    const fim = document.querySelector('#linhaForma [data-tracado="fim"]');
    if (!fim) return 'sem botão Terminar';
    fim.click();
    return (zonasPorTipo('canteiro').length === 1 && !document.querySelector('#linhaForma [data-tracado]')) || 'não terminou';
  });
  teste('linha por cima de outra área: não cria e continua desenhando', () => {
    vazio(); categoria('canteiro'); jeito('ret'); arrastar(10.5, 10.5, 20.5, 20.5);
    jeito('linha'); clicar(5, 5); clicar(25, 5); clicar(25, 25); clicar(5, 25); tecla('Enter');
    return (estado.zonas.length === 1 && !!tracado) || 'desenhou por cima';
  });
  teste('trocar de ferramenta no meio da linha descarta a linha', () => {
    vazio(); categoria('canteiro'); jeito('linha');
    clicar(5, 5); clicar(15, 5);
    document.querySelector('#ferramentas [data-f="selecionar"]').click();
    return !tracado || 'a linha ficou pela metade';
  });
  teste('Ctrl+Z desfaz a área desenhada com a linha', () => {
    vazio(); categoria('canteiro'); jeito('linha');
    clicar(5, 5); clicar(15, 5); clicar(15, 15); tecla('Enter');
    const criou = estado.zonas.length === 1;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
    return (criou && estado.zonas.length === 0) || 'não desfez';
  });

  // ---------------------------------------------------------------- árvores, construções, norte
  teste('árvore pode ficar fora do terreno, e fica selecionada', () => {
    vazio();
    document.querySelector('#ferramentas [data-f="arvore"]').click();
    clicar(-5, 10);
    const o = estado.objetos[0];
    return (!!o && o.x < 0 && objetoAtivo === o.id && ferramenta === 'selecionar' && !$('formObjeto').classList.contains('oculto')) || 'não pôs fora / não selecionou';
  });
  teste('construção arrastando, fora do terreno', () => {
    vazio();
    document.querySelector('#ferramentas [data-f="construcao"]').click();
    arrastar(52, -10, 60, -4);
    const o = estado.objetos.find(x => x.tipo === 'construcao');
    return (!!o && o.y < 0 && o.largura > 1) || 'não criou';
  });
  teste('Selecionar arrasta a árvore; clicar num canteiro troca a seleção; Delete apaga a árvore', () => {
    vazio(); categoria('canteiro'); jeito('ret'); arrastar(20.5, 20.5, 30.5, 30.5);
    document.querySelector('#ferramentas [data-f="arvore"]').click(); clicar(5, 5);
    const o = estado.objetos[0], x0 = o.x;
    arrastar(5, 5, 8, 5);   // já está com Selecionar
    if (!(o.x > x0)) return 'não arrastou';
    clicar(25, 25);
    if (objetoAtivo !== null || !zonaAtiva) return 'seleção não trocou para o canteiro';
    clicar(8, 5); tecla('Delete');
    return (!estado.objetos.length && estado.zonas.length === 1) || 'Delete apagou a coisa errada';
  });
  teste('a vista do desenho mostra uma folga fora do terreno', () => {
    vazio(); ajustar();
    return (vista.ox > 30 && vista.oy > 30) || `ox ${vista.ox}, oy ${vista.oy}`;
  });
  teste('norte: no desenho (painel da direita), não na aba Sol e sombra', () => {
    vazio();
    const visivel = el => !!el && !!el.offsetParent;
    const noDesenho = visivel($('bussola'));
    trocarModo('sol');
    const noSol = visivel($('bussola'));
    const ferrSol = [...document.querySelectorAll('#ferramentas button')].map(b => b.dataset.f);
    const botao = document.querySelector('[data-ir-desenho]');
    botao.click();
    return (noDesenho && !noSol && !ferrSol.includes('arvore') && modo === 'mapa' && editandoDesenho) || `desenho ${noDesenho}, sol ${noSol}, ferramentas ${ferrSol}`;
  });
  teste('árvore na lista de áreas abre no desenho, selecionada', () => {
    vazio();
    estado.objetos.push({ id: 1, tipo: 'arvore', nome: 'Pitangueira', x: 2, y: 2, diametro: 3, altura: 4, folhas: 'perene', grupo: grupoAutoDe('arvore') });
    alternarDesenho(false); atualizarPaineis();
    const li = [...document.querySelectorAll('#listaZonas .item-objeto')].find(l => l.textContent.includes('Pitangueira'));
    if (!li) return 'não está na lista';
    li.click();
    return (modo === 'mapa' && editandoDesenho && objetoAtivo === 1) || 'não abriu no desenho';
  });
  teste('primeiros passos: norte e árvores levam ao desenho', () =>
    igual(passosIniciais().filter(p => p.id === 'norte' || p.id === 'sombra').map(p => p.ir), ['desenho', 'desenho']));
  teste('boas-vindas: o tamanho é do terreno todo, não de um canteiro', () => {
    abrirBoasVindas(); novo.passo = PASSOS_BV.findIndex(p => p.id === 'tamanho'); renderBoasVindas();
    const txt = $('inicioCaixa').textContent;
    $('modalInicio').classList.add('oculto');
    return (/terreno todo/.test(txt) && /não o tamanho de um canteiro/.test(txt)) || 'texto sem a explicação';
  });

  teste('busca de cidade: o mesmo nome no mesmo estado aparece uma vez só', () => {
    const r = semCidadesRepetidas([
      { name: 'Piraquara', admin1: 'Paraná', country: 'Brasil', latitude: -25.44 },
      { name: 'Piraquara', admin1: 'Pará', country: 'Brasil' },
      { name: 'Piraquara', admin1: 'Paraná', country: 'Brasil', latitude: -25.5 },
    ]);
    return (r.length === 2 && r[0].latitude === -25.44) || JSON.stringify(r);
  });
  teste('norte: olhando para o leste, o norte fica à esquerda (270); para o sul, embaixo (180)', () =>
    igual([0, 90, 180, 270, 45].map(norteDoMapa), [0, 270, 180, 90, 315]));
  teste('boas-vindas: o passo do norte vem logo depois do lugar e antes do tamanho', () =>
    igual(PASSOS_BV.map(p => p.id), ['inicio', 'nome', 'lugar', 'norte', 'tamanho', 'perfil']));
  teste('boas-vindas: escolher o lado define o norte; sem escolher, só dá para pular', () => {
    abrirBoasVindas(); novo.passo = PASSOS_BV.findIndex(p => p.id === 'norte'); renderBoasVindas();
    const cx = $('inicioCaixa');
    const travado = cx.querySelector('[data-bv="avancar"]').disabled && !!cx.querySelector('[data-bv="pular"]');
    cx.querySelector('[data-bv="rumo"][data-g="90"]').click();
    const liberou = !cx.querySelector('[data-bv="avancar"]').disabled && /à esquerda/.test(cx.textContent);
    const com = hortaDasRespostas(novo), sem = hortaDasRespostas({ ...novo, rumo: null });
    $('modalInicio').classList.add('oculto');
    return (travado && liberou && com.norteDefinido && com.norteGraus === 270 && !sem.norteDefinido) ||
      `travado ${travado}, liberou ${liberou}, com ${com.norteGraus}/${com.norteDefinido}, sem ${sem.norteDefinido}`;
  });
  teste('boas-vindas: ajuste fino e agulha da bússola acertam o norte entre os 8 lados', () => {
    abrirBoasVindas(); novo.passo = PASSOS_BV.findIndex(p => p.id === 'norte'); renderBoasVindas();
    const cx = $('inicioCaixa'), faixa = cx.querySelector('[data-bv-norte]'), c = cx.querySelector('[data-bv-bussola]');
    const temBussola = !!c && c.width > 0;
    faixa.value = '265'; faixa.dispatchEvent(new Event('input', { bubbles: true }));
    const porFaixa = hortaDasRespostas(novo).norteGraus, txt = cx.querySelector('[data-bv-norte-ok]').textContent;
    const semBotao = !cx.querySelector('[data-bv="rumo"].escolhido') && !cx.querySelector('[data-bv="avancar"]').disabled;
    // agulha: arrastar para a direita do centro = norte mais ou menos à direita (90°)
    const r = c.getBoundingClientRect();
    const ev = (tipo, x, y) => c.dispatchEvent(new PointerEvent(tipo, { bubbles: true, pointerId: 5, clientX: x, clientY: y }));
    ev('pointerdown', r.left + r.width / 2, r.top + 10); ev('pointermove', r.left + r.width - 4, r.top + r.height / 2); ev('pointerup', r.left + r.width - 4, r.top + r.height / 2);
    const porAgulha = hortaDasRespostas(novo).norteGraus;
    $('modalInicio').classList.add('oculto');
    return (temBussola && porFaixa === 265 && /mais ou menos para o leste/.test(txt) && semBotao && Math.abs(porAgulha - 90) <= 15) ||
      `bússola ${temBussola}, faixa ${porFaixa} "${txt}", sem botão ${semBotao}, agulha ${porAgulha}`;
  });
  teste('primeiros passos: o norte vem antes dos canteiros', () => {
    const ids = passosIniciais().map(p => p.id);
    return ids.indexOf('norte') < ids.indexOf('canteiros') || ids.join(',');
  });

  // ---------------------------------------------------------------- toque (iPad) e seleção
  const toque = (c, r, id = 7) => { ponto('pointerdown', c, r, 'touch', id); ponto('pointerup', c, r, 'touch', id); };
  const zoomDoisDedos = (c, r) => {
    ponto('pointerdown', c, r, 'touch', 1); ponto('pointerdown', c + 10, r + 10, 'touch', 2);
    ponto('pointermove', c - 2, r - 2, 'touch', 1); ponto('pointermove', c + 14, r + 14, 'touch', 2);
    ponto('pointerup', c - 2, r - 2, 'touch', 1); ponto('pointerup', c + 14, r + 14, 'touch', 2);
  };
  teste('iPad: tocar marca pontos da linha; zoom com dois dedos não marca ponto', () => {
    vazio(); categoria('canteiro'); jeito('linha');
    toque(5, 5); toque(15, 5);
    const antes = vista.zoom;
    zoomDoisDedos(20, 20);
    return (tracado?.pontos.length === 2 && vista.zoom !== antes) || `pontos ${tracado?.pontos.length}, zoom mudou ${vista.zoom !== antes}`;
  });
  teste('iPad: zoom com dois dedos com a Árvore escolhida não põe árvore', () => {
    vazio(); document.querySelector('#ferramentas [data-f="arvore"]').click();
    zoomDoisDedos(20, 20);
    const nada = !estado.objetos.length;
    toque(20, 20);
    return (nada && estado.objetos.length === 1) || `árvores ${estado.objetos.length}`;
  });
  teste('desenhar com uma árvore selecionada: só a área nova fica selecionada (Delete apaga a área)', () => {
    vazio(); document.querySelector('#ferramentas [data-f="arvore"]').click(); clicar(-3, 5);
    categoria('canteiro'); jeito('ret'); arrastar(10.5, 10.5, 15.5, 15.5);
    if (objetoAtivo !== null || !zonaAtiva) return 'árvore e área selecionadas juntas';
    tecla('Delete');
    return (estado.zonas.length === 0 && estado.objetos.length === 1) || 'Delete apagou a coisa errada';
  });
  teste('desfazer com uma árvore selecionada não seleciona também uma área', () => {
    vazio(); categoria('canteiro'); jeito('ret'); arrastar(10.5, 10.5, 15.5, 15.5);
    document.querySelector('#ferramentas [data-f="arvore"]').click(); clicar(-3, 5);
    arrastar(-3, 5, -6, 5);   // arrasta a árvore
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
    return (objetoAtivo !== null && zonaAtiva === null) || `objeto ${objetoAtivo}, área ${zonaAtiva}`;
  });
  teste('trocar de aba descarta a linha pela metade', () => {
    vazio(); categoria('canteiro'); jeito('linha'); clicar(5, 5); clicar(15, 5);
    trocarModo('sol'); trocarModo('mapa');
    return !tracado || 'a linha voltou';
  });
  teste('Ctrl+Z com a linha pela metade desfaz o último ponto (não a área anterior)', () => {
    vazio(); categoria('canteiro'); jeito('ret'); arrastar(30.5, 30.5, 35.5, 35.5);
    jeito('linha'); clicar(5, 5); clicar(15, 5); clicar(15, 15);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
    return (tracado?.pontos.length === 2 && estado.zonas.length === 1) || `pontos ${tracado?.pontos.length}, áreas ${estado.zonas.length}`;
  });
  teste('área na lista com a Borracha: vira Selecionar (sem ferramenta escondida) e tira a árvore da seleção', () => {
    vazio(); categoria('canteiro'); jeito('ret'); arrastar(10.5, 10.5, 15.5, 15.5);
    document.querySelector('#ferramentas [data-f="arvore"]').click(); clicar(-3, 5);
    document.querySelector('#ferramentas [data-f="borracha"]').click();
    document.querySelector('#listaZonas li:not(.grupo-zonas):not(.item-objeto)')?.click();
    const visivel = ferramentasAtuais().some(x => x.id === ferramenta);
    return (visivel && ferramenta === 'selecionar' && objetoAtivo === null && !!zonaAtiva) || `ferramenta ${ferramenta}, objeto ${objetoAtivo}`;
  });

  // ---- erros da revisão geral (24/11)
  teste('"Preencher caminhos" põe o caminho no grupo Caminhos (não em "Sem grupo")', () => {
    vazio(); categoria('canteiro'); jeito('ret'); arrastar(10.5, 10.5, 15.5, 15.5);
    preencherCaminhos();
    const cam = zonasPorTipo('caminho')[0];
    return (!!cam && cam.grupo !== null && cam.grupo === grupoAutoDe('caminho')) || `grupo ${cam?.grupo}`;
  });
  teste('clicar fora do terreno com Selecionar não seleciona o muro da borda', () => {
    vazio(); categoria('muro'); jeito('ret'); arrastar(0.5, 0.5, 49.5, 1.5);
    document.querySelector('#ferramentas [data-f="selecionar"]').click();
    // cada clique fora (à esquerda, em cima, à direita da borda do muro) é conferido sozinho
    const pegou = [[-4, 1], [20, -4], [55, 1]].filter(([c, r]) => { zonaAtiva = null; limparSelecaoExtra(); clicar(c, r); return zonaAtiva !== null; });
    return !pegou.length || `selecionou o muro clicando em ${JSON.stringify(pegou)}`;
  });
  teste('arrastar de fora do terreno até um canteiro ainda seleciona o canteiro', () => {
    vazio(); categoria('canteiro'); jeito('ret'); arrastar(10.5, 10.5, 15.5, 15.5);
    const id = zonaAtiva;
    document.querySelector('#ferramentas [data-f="selecionar"]').click();
    zonaAtiva = null; arrastar(-4, -4, 12, 12);
    return zonaAtiva === id || `selecionou ${zonaAtiva}`;
  });
  teste('área nova (linha ou retângulo) fica sozinha na seleção, sem as que já estavam selecionadas', () => {
    vazio(); categoria('canteiro'); jeito('ret');
    arrastar(10.5, 10.5, 15.5, 15.5); const a = zonaAtiva;
    arrastar(20.5, 10.5, 25.5, 15.5); const b = zonaAtiva;
    zonaAtiva = a; zonasExtras.add(b);
    categoria('muro'); jeito('linha'); clicar(2, 40); clicar(40, 40); tecla('Enter');
    const linhaOk = zonaPorId(zonaAtiva)?.tipo === 'muro' && !zonasExtras.size;
    zonaAtiva = a; zonasExtras.add(b);
    categoria('canteiro'); jeito('ret'); arrastar(30.5, 20.5, 35.5, 25.5);
    const retOk = zonaAtiva !== a && zonaAtiva !== b && !zonasExtras.size;
    return (linhaOk && retOk) || `linha ${linhaOk}, retângulo ${retOk}`;
  });

  teste('caminho feito antes (em "Sem grupo") vai para Caminhos ao preencher de novo', () => {
    vazio(); categoria('canteiro'); jeito('ret'); arrastar(10.5, 10.5, 15.5, 15.5);
    preencherCaminhos();
    const cam = zonasPorTipo('caminho')[0]; cam.grupo = null;
    categoria('canteiro'); jeito('ret'); arrastar(20.5, 20.5, 25.5, 25.5);
    estado.celulas = estado.celulas.map(v => (v === cam.id ? 0 : v));   // abre espaço vazio de novo
    preencherCaminhos();
    return cam.grupo === grupoAutoDe('caminho') || `grupo ${cam.grupo}`;
  });
  teste('Duplicar: a cópia fica sozinha na seleção', () => {
    vazio(); categoria('canteiro'); jeito('ret');
    arrastar(10.5, 10.5, 15.5, 15.5); const a = zonaAtiva;
    arrastar(20.5, 10.5, 25.5, 15.5); const b = zonaAtiva;
    zonaAtiva = a; zonasExtras.add(b);
    duplicarZona();
    return (zonaAtiva !== a && zonaAtiva !== b && !zonasExtras.size) || `ativa ${zonaAtiva}, extras ${[...zonasExtras]}`;
  });

  // ---- Etapa 5: desenho mais fácil
  const direito = (c, r) => {
    const rect = canvas.getBoundingClientRect();
    canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 2, pointerId: 1, pointerType: 'mouse',
      clientX: rect.left + vista.ox + c * vista.zoom, clientY: rect.top + vista.oy + r * vista.zoom }));
  };
  teste('muro com o Retângulo ou o Círculo fica só com a borda (um quadrado de largura)', () => {
    vazio(); categoria('muro'); jeito('ret'); arrastar(5.5, 5.5, 25.5, 15.5);
    const ret = celulasDaZona(zonaAtiva).length;
    fecharAlturaRapida();
    jeito('circulo'); arrastar(5.5, 25.5, 25.5, 45.5);
    const circ = celulasDaZona(zonaAtiva).length, cheio = celsDoCirculo({ c0: 5, r0: 25, c1: 25, r1: 45 }).length;
    return (ret === 2 * 21 + 2 * 9 && circ < cheio / 2) || `retângulo ${ret}, círculo ${circ} de ${cheio}`;
  });
  teste('canteiro com o Retângulo continua cheio', () => {
    vazio(); categoria('canteiro'); jeito('ret'); arrastar(5.5, 5.5, 14.5, 14.5);
    return celulasDaZona(zonaAtiva).length === 100 || celulasDaZona(zonaAtiva).length;
  });
  teste('Linha do muro: clicar no primeiro ponto fecha a volta e termina', () => {
    vazio(); categoria('muro'); jeito('linha');
    clicar(5.5, 5.5); clicar(20.5, 5.5); clicar(20.5, 20.5); clicar(5.6, 5.4);
    const z = zonaPorId(zonaAtiva);
    // fechar a volta liga o último ponto ao primeiro (aqui, a diagonal que passa por 12, 12)
    return (!tracado && z?.tipo === 'muro' && celula(12, 12) === z.id) || `linha aberta ${!!tracado}, ${z?.tipo}, diagonal ${celula(12, 12)}`;
  });
  teste('Linha: o botão direito termina (sem mover o mapa)', () => {
    vazio(); categoria('canteiro'); jeito('linha');
    clicar(5, 5); clicar(15, 5); clicar(15, 15);
    const ox = vista.ox; direito(30, 30); ponto('pointerup', 30, 30);
    return (!tracado && zonaPorId(zonaAtiva)?.tipo === 'canteiro' && vista.ox === ox && ponteiro === null) || `linha ${!!tracado}, ponteiro ${ponteiro?.modo}`;
  });
  teste('clique sem arrastar no vazio com uma categoria: volta para Selecionar e não cria nada', () => {
    vazio(); categoria('canteiro'); jeito('ret');
    clicar(10.5, 10.5);
    return (ferramenta === 'selecionar' && estado.zonas.length === 0 && zonaAtiva === null) || `ferramenta ${ferramenta}, áreas ${estado.zonas.length}`;
  });
  teste('a ferramenta Preencher não existe mais', () =>
    (!FERRAMENTAS.some(x => x.id === 'balde') && !document.querySelector('#ferramentas [data-f="balde"]')) || 'ainda tem o balde');
  teste('Borracha "Área inteira": um clique apaga a área toda; Ctrl+Z traz de volta', () => {
    vazio(); categoria('canteiro'); jeito('ret'); arrastar(10.5, 10.5, 15.5, 15.5);
    document.querySelector('#ferramentas [data-f="borracha"]').click();
    const botao = document.querySelector('#tamPincel [data-t="area"]');
    if (!botao || botao.classList.contains('oculto')) return 'sem o botão Área inteira';
    botao.click(); clicar(12, 12);
    const apagou = estado.zonas.length === 0 && !estado.celulas.some(v => v > 0);
    desfazer();
    const voltou = estado.zonas.length === 1;
    document.querySelector('#tamPincel [data-t="1"]').click();
    return (apagou && voltou && !borrachaArea) || `apagou ${apagou}, voltou ${voltou}`;
  });
  teste('muro novo: aparece o campinho da altura; Enter grava e Ctrl+Z desfaz', () => {
    vazio(); categoria('muro'); jeito('ret'); arrastar(5.5, 5.5, 25.5, 15.5);
    const box = $('alturaRapida'), z = zonaPorId(zonaAtiva);
    if (box.classList.contains('oculto')) return 'campinho não apareceu';
    const inp = box.querySelector('input'); inp.value = '2,4';
    inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    const gravou = z.altura === 2.4 && box.classList.contains('oculto');
    desfazer();
    return (gravou && zonaPorId(z.id).altura === 1.5) || `altura ${z.altura}, depois ${zonaPorId(z.id)?.altura}`;
  });
  teste('construção nova: também abre o campinho da altura', () => {
    vazio(); document.querySelector('#ferramentas [data-f="construcao"]').click(); arrastar(-10, 5, -4, 12);
    const aberto = !$('alturaRapida').classList.contains('oculto');
    fecharAlturaRapida();
    return (aberto && estado.objetos.length === 1) || `aberto ${aberto}, objetos ${estado.objetos.length}`;
  });
  teste('muro de tela não faz sombra; sólido faz', () => {
    vazio(); categoria('muro'); jeito('linha'); clicar(0.5, 10.5); clicar(49.5, 10.5); tecla('Enter'); fecharAlturaRapida();
    const z = zonaPorId(zonaAtiva); z.altura = 2.5;
    estado.local.lat = -25.4; estado.norteGraus = 0;
    const media = () => { invalidarSol(); const s = calcularSol(5); let soma = 0; for (let c = 0; c < 50; c++) for (let r = 11; r < 20; r++) soma += s.horas[r * 50 + c]; return soma; };
    const solido = media(); z.material = 'tela'; const tela = media();
    return (tela > solido && !fazSombra(z)) || `sólido ${solido}, tela ${tela}`;
  });
  teste('árvore longe dos canteiros: "não afeta a horta"; perto: faz sombra; sem canteiros: não dá para saber', () => {
    vazio(); estado.norteDefinido = true;
    estado.objetos.push({ id: 900, tipo: 'arvore', nome: 'Longe', x: -40, y: -40, diametro: 2, altura: 3, folhas: 'perene' });
    invalidarSol();
    const semCanteiro = objetoSombreiaHorta(estado.objetos[0]);
    categoria('canteiro'); jeito('ret'); arrastar(20.5, 20.5, 30.5, 30.5);
    estado.objetos.push({ id: 901, tipo: 'arvore', nome: 'Perto', x: 4, y: 3.5, diametro: 4, altura: 8, folhas: 'perene' });
    invalidarSol();
    const [longe, perto] = estado.objetos.map(objetoSombreiaHorta);
    atualizarPaineis();
    const naLista = [...document.querySelectorAll('#listaZonas .item-objeto')].some(li => /Longe/.test(li.textContent) && li.querySelector('.nao-afeta'));
    return (semCanteiro === null && longe === false && perto === true && naLista) || `sem ${semCanteiro}, longe ${longe}, perto ${perto}, lista ${naLista}`;
  });
  teste('lista: grupos vazios numa linha só ("Vazios"), sem um cabeçalho para cada', () => {
    vazio(); categoria('canteiro'); jeito('ret'); arrastar(10.5, 10.5, 15.5, 15.5);
    atualizarPaineis();
    const cab = [...document.querySelectorAll('#listaZonas .grupo-zonas')].length;
    const chips = document.querySelectorAll('#listaZonas .grupos-vazios .chip-grupo').length;
    return (cab === 1 && chips === estado.grupos.length - 1) || `cabeçalhos ${cab}, chips ${chips}`;
  });
  teste('lista: árvore tem lixeira, e ela exclui', () => {
    vazio(); document.querySelector('#ferramentas [data-f="arvore"]').click(); clicar(-3, 5);
    atualizarPaineis();
    document.querySelector('#listaZonas .item-objeto .lixo')?.click();
    return estado.objetos.length === 0 || 'não excluiu';
  });
  teste('desenhando sem o norte: aparece "Falta dizer onde fica o norte"; com o norte, some', () => {
    vazio(); estado.norteDefinido = false; atualizarPaineis(); atualizarBotaoDesenho();
    const falta = !$('btnIrNorte').classList.contains('oculto');
    estado.norteDefinido = true; atualizarPaineis(); atualizarBotaoDesenho();
    const some = $('btnIrNorte').classList.contains('oculto');
    return (falta && some) || `falta ${falta}, some ${some}`;
  });
  teste('Ajustar à tela: a dica de baixo não cobre o terreno', () => {
    vazio(); ajustar();
    const rect = canvas.getBoundingClientRect(), d = $('dica').getBoundingClientRect();
    return rect.top + vista.oy + estado.rows * vista.zoom <= d.top || 'cobre';
  });

  // ---- correções da revisão da etapa 5
  teste('sem o norte definido, não diz "não afeta a horta" (pede o norte)', () => {
    vazio(); estado.norteDefinido = false;
    categoria('canteiro'); jeito('ret'); arrastar(20.5, 20.5, 30.5, 30.5);
    estado.objetos.push({ id: 900, tipo: 'arvore', nome: 'Longe', x: -40, y: -40, diametro: 2, altura: 3, folhas: 'perene' });
    invalidarSol();
    return objetoSombreiaHorta(estado.objetos[0]) === 'semNorte' || String(objetoSombreiaHorta(estado.objetos[0]));
  });
  teste('campinho da altura: sem digitar, fechar não desfaz a altura mudada no painel', () => {
    vazio(); categoria('muro'); jeito('ret'); arrastar(5.5, 5.5, 25.5, 15.5);
    const z = zonaPorId(zonaAtiva);
    z.altura = 2.8;   // como se tivesse mudado no painel da direita
    const n = historico.length;
    clicar(30, 40);   // clicar no mapa fecha o campinho
    return (z.altura === 2.8 && historico.length === n) || `altura ${z.altura}, desfazer ${historico.length - n}`;
  });
  teste('campinho da altura some (sem gravar) quando a horta é trocada', () => {
    vazio(); categoria('muro'); jeito('ret'); arrastar(5.5, 5.5, 25.5, 15.5);
    $('alturaRapida').querySelector('input').value = '9';
    estado = migrar(estadoVazio({ largura: 10, comprimento: 10 })); depoisDeTrocarEstado();
    return ($('alturaRapida').classList.contains('oculto') && alturaRapida === null) || 'continuou aberto';
  });
  teste('Borracha "Área inteira": só apaga ao soltar (um zoom de dois dedos não apaga)', () => {
    vazio(); categoria('canteiro'); jeito('ret'); arrastar(10.5, 10.5, 15.5, 15.5);
    document.querySelector('#ferramentas [data-f="borracha"]').click();
    document.querySelector('#tamPincel [data-t="area"]').click();
    ponto('pointerdown', 12, 12, 'touch', 1);
    const depoisDoToque = estado.zonas.length;
    ponto('pointerdown', 20, 20, 'touch', 2);   // segundo dedo: vira zoom
    ponto('pointerup', 20, 20, 'touch', 2); ponto('pointerup', 12, 12, 'touch', 1);
    document.querySelector('#tamPincel [data-t="1"]').click();
    return (depoisDoToque === 1 && estado.zonas.length === 1) || `apagou: ${depoisDoToque}, ${estado.zonas.length}`;
  });
  teste('clique fora do terreno com uma categoria: volta para Selecionar', () => {
    vazio(); categoria('canteiro'); jeito('ret');
    clicar(-5, 10);
    return (ferramenta === 'selecionar' && !estado.zonas.length) || `ferramenta ${ferramenta}`;
  });

  // ---- borracha em árvores e construções
  const borracha = () => document.querySelector('#ferramentas [data-f="borracha"]').click();
  teste('borracha: um clique numa árvore apaga a árvore (e não a área embaixo); Ctrl+Z traz de volta', () => {
    vazio(); categoria('canteiro'); jeito('ret'); arrastar(1.5, 1.5, 15.5, 15.5);
    document.querySelector('#ferramentas [data-f="arvore"]').click(); clicar(8, 8);
    borracha(); clicar(8, 8);
    const apagou = estado.objetos.length === 0 && estado.zonas.length === 1 && celula(8, 8) > 0;
    desfazer();
    return (apagou && estado.objetos.length === 1) || `apagou ${apagou}, objetos ${estado.objetos.length}`;
  });
  teste('borracha: um clique numa construção (fora do terreno) apaga a construção', () => {
    vazio(); document.querySelector('#ferramentas [data-f="construcao"]').click(); arrastar(-10, 5, -4, 12);
    fecharAlturaRapida();
    borracha(); clicar(-7, 8);
    return estado.objetos.length === 0 || 'não apagou';
  });
  teste('borracha: com "Área inteira", a árvore em cima da área é apagada antes da área', () => {
    vazio(); categoria('canteiro'); jeito('ret'); arrastar(1.5, 1.5, 15.5, 15.5);
    document.querySelector('#ferramentas [data-f="arvore"]').click(); clicar(8, 8);
    borracha(); document.querySelector('#tamPincel [data-t="area"]').click(); clicar(8, 8);
    document.querySelector('#tamPincel [data-t="1"]').click();
    return (estado.objetos.length === 0 && estado.zonas.length === 1) || `objetos ${estado.objetos.length}, áreas ${estado.zonas.length}`;
  });
  teste('borracha: embaixo da copa (longe do tronco) apaga os quadrados, não a árvore', () => {
    vazio(); categoria('canteiro'); jeito('ret'); arrastar(1.5, 1.5, 30.5, 30.5);
    estado.objetos.push({ id: 950, tipo: 'arvore', nome: 'Grande', x: 3, y: 3, diametro: 4, altura: 6, folhas: 'perene' });
    borracha(); clicar(20.5, 15.5);
    return (estado.objetos.length === 1 && celula(20, 15) === 0) || `objetos ${estado.objetos.length}, célula ${celula(20, 15)}`;
  });
  teste('borracha: apertar na árvore e soltar longe dela não apaga', () => {
    vazio(); document.querySelector('#ferramentas [data-f="arvore"]').click(); clicar(8, 8);
    borracha();
    ponto('pointerdown', 8, 8); ponto('pointermove', 30, 30); ponto('pointerup', 30, 30);
    return estado.objetos.length === 1 || 'apagou';
  });
  teste('borracha: zoom de dois dedos em cima de uma árvore não apaga', () => {
    vazio(); document.querySelector('#ferramentas [data-f="arvore"]').click(); clicar(8, 8);
    borracha();
    ponto('pointerdown', 8, 8, 'touch', 1); ponto('pointerdown', 20, 20, 'touch', 2);
    ponto('pointerup', 20, 20, 'touch', 2); ponto('pointerup', 8, 8, 'touch', 1);
    return estado.objetos.length === 1 || 'apagou';
  });

  teste('fora do desenho: árvore toda dentro do terreno mostra o nome; a que passa da borda, não', () => {
    vazio();
    const dentro = { tipo: 'arvore', x: 3, y: 3, diametro: 2 }, borda = { tipo: 'construcao', x: -1, y: 2, largura: 3, profundidade: 2 };
    return (objetoDentroDoTerreno(dentro) && !objetoDentroDoTerreno(borda)) || 'errou';
  });

  teste('nenhum erro no console durante os testes', () => !erros.length || erros.join(' | '));
  alternarDesenho(false);

  const falhas = resultados.filter(r => !r.ok);
  console.log(`desenho: ${resultados.length - falhas.length}/${resultados.length} ok`);
  for (const f of falhas) console.warn('FALHOU:', f.nome, '—', f.detalhe);
  window.resultadoTestes = { total: resultados.length, falhas: falhas.length, resultados };
})();
