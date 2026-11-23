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
    abrirBoasVindas(); novo.passo = 3; renderBoasVindas();
    const txt = $('inicioCaixa').textContent;
    $('modalInicio').classList.add('oculto');
    return (/terreno todo/.test(txt) && /não o tamanho de um canteiro/.test(txt)) || 'texto sem a explicação';
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

  teste('nenhum erro no console durante os testes', () => !erros.length || erros.join(' | '));
  alternarDesenho(false);

  const falhas = resultados.filter(r => !r.ok);
  console.log(`desenho: ${resultados.length - falhas.length}/${resultados.length} ok`);
  for (const f of falhas) console.warn('FALHOU:', f.nome, '—', f.detalhe);
  window.resultadoTestes = { total: resultados.length, falhas: falhas.length, resultados };
})();
