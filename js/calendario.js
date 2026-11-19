'use strict';

// =====================================================================
//  Minha Horta — Fase 5: aba Calendário (mapa do mês, tarefas e ano inteiro)
// =====================================================================

const FERRAMENTAS_CAL = [
  { id: 'selecionar', icone: '👆', nome: 'Selecionar', tecla: 'V',
    dica: 'Clique num canteiro para planejar. Clique fora para ver as tarefas do mês.' },
  { id: 'mao', icone: '✋', nome: 'Mover mapa', tecla: 'H',
    dica: TXT.moverMapa },
];

let vistaCal = 'mes';   // 'mes' (mapa do mês) ou 'ano' (linha do tempo)

const zonasPlantaveis = () => estado.zonas.filter(z => TIPOS_PLANTAVEIS.includes(z.tipo));

// Situação de cada área no mês m: entradas ativas, e se está livre
function situacaoNoMes(m) {
  const an = analiseHorta();
  const res = {};
  for (const z of zonasPlantaveis()) {
    const ents = an.entradasPorZona[z.id] || [];
    const ativas = ents.filter(e => e.p && statusNoMes(e.p, e.inicio, m)).map(e => ({ ...e, status: statusNoMes(e.p, e.inicio, m) }));
    res[z.id] = { ents, ativas, livre: !ativas.length && !ents.some(e => !e.p) };
  }
  return res;
}

// ---------------------------------------------------------------------
//  Desenho no mapa (modo calendário)
// ---------------------------------------------------------------------

// Esmaece as áreas que estão livres no mês
function desenharCamadaCalendario(g, X, Y, c0, c1, r0, r1) {
  const sit = situacaoNoMes(mesSol + 1);
  const livres = new Set(Object.keys(sit).filter(id => sit[id].livre).map(Number));
  if (!livres.size) return;
  g.fillStyle = 'rgba(255,253,248,.65)';
  for (let r = r0; r < r1; r++) {
    for (let c = c0; c < c1; c++) {
      if (livres.has(estado.celulas[idx(c, r)])) g.fillRect(X(c), Y(r), X(c + 1) - X(c), Y(r + 1) - Y(r));
    }
  }
}

// Linhas do rótulo de uma área no mapa do mês
function linhasCalendario(z, analise) {
  if (!TIPOS_PLANTAVEIS.includes(z.tipo)) return [];
  const s = situacaoNoMes(mesSol + 1)[z.id];
  if (!s) return [];
  if (s.livre) return ['— livre —'];
  return [
    ...s.ativas.map(e => {
      const ruim = analise?.plantas.find(x => x.entrada === e.entrada)?.problemas.some(q => q.nivel === 'mal');
      return `${ruim ? '⚠️' : STATUS[statusVisto(e.p, e.status)].icone} ${rotuloEntrada(z, e.entrada)}${e.qtd ? ` ×${e.qtd}` : ''}`;
    }),
    ...s.ents.filter(e => !e.p).map(e => `• ${e.entrada}`),
  ];
}

// ---------------------------------------------------------------------
//  Faixa de meses (topo do mapa)
// ---------------------------------------------------------------------

function renderFaixaMeses() {
  const hoje = new Date().getMonth();
  $('faixaMeses').innerHTML = `
    <button data-mes-passo="-1" title="Mês anterior">‹</button>
    ${MESES_CURTOS.map((m, i) => `<button class="mes ${i === mesSol ? 'ativo' : ''} ${i === hoje ? 'hoje' : ''}" data-mes-cal="${i}" title="${MESES[i]}${i === hoje ? ' (agora)' : ''}">${m}</button>`).join('')}
    <button data-mes-passo="1" title="Próximo mês">›</button>
    <span class="sep"></span>
    <button class="vista ${vistaCal === 'mes' ? 'ativo' : ''}" data-vista="mes" title="Ver o mapa no mês escolhido">🗺 Mês</button>
    <button class="vista ${vistaCal === 'ano' ? 'ativo' : ''}" data-vista="ano" title="Ver o ano inteiro de todos os canteiros">📅 Ano</button>`;
}

function escolherMes(i) {
  mesSol = (i + 12) % 12;
  atualizarPaineis();
  desenhar();
}

// ---------------------------------------------------------------------
//  Linha do tempo (ano inteiro)
// ---------------------------------------------------------------------

function celulasAno(e) {
  return MESES_CURTOS.map((_, i) => {
    const m = i + 1;
    const st = e.p ? statusNoMes(e.p, e.inicio, m) : 'crescendo';
    const band = e.p && emBandeja(e.p, e.inicio, m);
    const cls = (e.p ? statusVisto(e.p, st) : st) || (band ? 'bandeja' : '');
    const vis = e.p ? statusVisto(e.p, st) : st;
    const icone = st === 'plantar' ? '🌱' : vis === 'florindo' ? '🌸' : st === 'colher' ? '🧺' : band && mesSemear(e.p, e.inicio) === m ? '🌰' : '';
    const titulo = st ? STATUS[e.p ? statusVisto(e.p, st) : st].nome : band ? STATUS.bandeja.nome : 'fora do canteiro';
    return `<td class="${cls} ${i === mesSol ? 'sel' : ''}" title="${MESES[i]}: ${titulo}">${icone}</td>`;
  }).join('');
}

function selectPlantio(z, e) {
  if (!e.p) return '';
  return `<select data-plantio-cal="${escapar(e.entrada)}" data-zona="${z.id}" title="Mês de plantio">${MESES_CURTOS.map((m, i) =>
    `<option value="${i + 1}" ${i + 1 === e.inicio ? 'selected' : ''}>${m}${mesesDeIrProCanteiro(e.p).includes(i + 1) ? '' : ' ·'}</option>`).join('')}</select>`;
}

function tabelaAno(zonas, compacta) {
  const an = analiseHorta();
  const cab = `<tr><th>${compacta ? '' : 'Área / planta'}</th>${MESES_LETRA.map((l, i) =>
    `<th class="${i === mesSol ? 'sel' : ''}" data-mes-cal="${i}" title="${MESES[i]}">${compacta ? l : MESES_CURTOS[i]}</th>`).join('')}</tr>`;
  let corpo = '';
  for (const z of zonas) {
    const ents = an.entradasPorZona[z.id] || [];
    const info = an.porZona[z.id];
    if (!compacta) {
      corpo += `<tr class="zona-linha" data-zona-sel="${z.id}"><th><span class="amostra" style="background:${escapar(z.cor)}"></span>${escapar(z.nome)}</th>${MESES_CURTOS.map((_, i) => {
        const m = i + 1;
        const nAtivas = ents.filter(e => e.ativos.has(m)).length;
        const pct = info && info.area ? Math.round(info.usoMes[m] / info.area * 100) : 0;
        const txt = pct ? `${pct}%` : nAtivas ? '' : '·';
        return `<td class="${i === mesSol ? 'sel' : ''} ${pct > 100 ? 'excesso' : ''}" title="${MESES[i]}: ${nAtivas} planta(s) no canteiro${pct ? `, ${pct}% do espaço` : ''}">${txt}</td>`;
      }).join('')}</tr>`;
    }
    for (const e of ents) {
      corpo += `<tr><th><span class="nome-pl">${e.p ? escapar(e.p.emoji) + ' ' : ''}${escapar(rotuloEntrada(z, e.entrada))}${e.qtd ? ` <small>×${e.qtd}</small>` : ''}</span>${selectPlantio(z, e)}</th>${celulasAno(e)}</tr>`;
    }
  }
  return `<table class="gantt ${compacta ? 'compacta' : ''}">${cab}${corpo}</table>`;
}

function renderAno() {
  const zonas = zonasPlantaveis().filter(z => (z.plantas || []).length).sort(ordemNome);
  $('areaAno').innerHTML = `
    <div class="ano-topo">
      <h3>O ano inteiro da horta <button class="pequeno" data-vista="mes" style="margin-left:8px">🗺 Voltar ao mapa do mês</button></h3>
      <div class="legenda-st">${Object.entries(STATUS).map(([k, s]) => `<span><i class="${k}"></i>${s.icone} ${s.nome}</span>`).join('')}
        <span class="nota">% = espaço ocupado no canteiro (plantas com quantidade definida)</span></div>
    </div>
    ${zonas.length ? tabelaAno(zonas, false) : '<p class="vazio">Nenhum canteiro com plantas ainda. Adicione plantas na aba Mapa.</p>'}
    <p class="nota" style="margin-top:12px">Mude o mês de plantio de cada planta no seletor ao lado do nome (meses com “·” estão fora da época recomendada).
    Para plantar a mesma planta várias vezes no ano (sucessão), clique em “🔁 plantar de novo” no painel do canteiro.</p>`;
}

// ---------------------------------------------------------------------
//  Painel de tarefas do mês
// ---------------------------------------------------------------------

function itemTarefa(z, e, texto, acao) {
  const m = mesSol + 1;
  const feito = acao && feitoNoMes(acao, z.id, e.id, m);
  const botao = acao ? (feito
    ? `<span class="feito" title="Registrado no diário">✓ feito</span>`
    : `<button class="btn-feito" data-registrar="${acao}" data-zona="${z.id}" data-entrada="${escapar(e.entrada)}" title="Registrar no diário">✓</button>`) : '';
  return `<li data-zona-sel="${z.id}" class="${feito ? 'feito' : ''}"><span class="e">${e.p ? escapar(e.p.emoji) : '•'}</span><span><b>${escapar(rotuloEntrada(z, e.entrada))}</b>${e.qtd ? ` ×${e.qtd}` : ''} <span class="onde">· ${escapar(z.nome)}</span>${texto ? `<div class="sub">${texto}</div>` : ''}</span>${botao}</li>`;
}

function renderPainelCalendario() {
  const m = mesSol + 1;
  const an = analiseHorta();
  const plantar = [], colher = [], crescendo = [], atencao = [], livres = [], florindo = [], cuidados = [];
  for (const z of zonasPlantaveis().sort(ordemNome)) {
    const ents = an.entradasPorZona[z.id] || [];
    let ativas = 0;
    for (const e of ents) {
      if (!e.p) continue;
      const st = statusNoMes(e.p, e.inicio, m);
      if (st) ativas++;
      if (st === 'plantar') {
        plantar.push(itemTarefa(z, e, e.p.forma === 'muda' ? 'transplantar as mudas' : FORMAS[e.p.forma]?.toLowerCase(), 'plantio'));
        if (!e.p.perene && !mesesDeIrProCanteiro(e.p).includes(m)) {
          atencao.push(itemTarefa(z, e, `📅 fora da época de plantio (época: ${faixaMeses(mesesDeIrProCanteiro(e.p))})`));
        }
      }
      if (st === 'colher' && ehFlor(e.p)) florindo.push(itemTarefa(z, e, '', ''));
      else if (st === 'colher') colher.push(itemTarefa(z, e, '', 'colheita'));
      // Cuidados do mês (podar, flores murchas, arrancar, replantar)
      if (st && e.p.cuidados) {
        const flor = [...e.ativos].filter(mm => statusNoMes(e.p, e.inicio, mm) === 'colher');
        for (const c of e.p.cuidados) {
          if (c.tipo === 'replantar' && ((!e.p.perene && !ehFlor(e.p)) || st === 'plantar')) continue;
          if (mesesDoCuidado(e.p, c, flor).includes(m)) cuidados.push(itemTarefa(z, e, `${TIPOS_CUIDADO[c.tipo].icone} ${c.texto}`, ''));
        }
      }
      if (st === 'crescendo') crescendo.push(itemTarefa(z, e, ''));
      if (st && e.p.geada && mesesGeada().includes(m)) atencao.push(itemTarefa(z, e, '❄️ risco de geada — cubra nas noites frias'));
    }
    if (ents.some(e => !e.p)) ativas++;
    if (!ativas) livres.push(`<li data-zona-sel="${z.id}" data-ir-mapa><span class="e">🔵</span><span><b>${escapar(z.nome)}</b> está livre<div class="sub">clique para ver o que plantar</div></span></li>`);
  }
  const grupo = (titulo, itens, vazio, aberto = true) => itens.length
    ? `<details class="tarefas" ${aberto ? 'open' : ''}><summary>${titulo} <span class="qtd">${itens.length}</span></summary><ul>${itens.join('')}</ul></details>`
    : (vazio ? `<div class="tarefas vazio-t">${titulo}: <span class="nota">${vazio}</span></div>` : '');


  const tb = tarefasDeBandeja(m, an);
  const mesAtual = new Date().getMonth() === mesSol;
  $('painelCal').innerHTML = htmlPrimeirosPassos() + htmlClima() + `
    <section>
      <button class="btn-sugerir" data-sugerir-plano="horta">✨ Sugerir plano para a horta toda</button>
      <div class="grade2"><button class="btn-compras" data-abrir-compras>🛒 Lista de compras</button>
      <button class="btn-compras" data-exportar-lembretes title="Baixa um arquivo .ics para o calendário do iPad, celular ou Google Agenda">📅 Lembretes</button></div>
      <button class="btn-limpar" data-abrir-limpar="horta">🧹 Limpar plantio…</button>
      <h2>Tarefas de ${MESES[mesSol].toLowerCase()}</h2>
      ${mesAtual ? grupo('🪴 Na bandeja agora', itensNaBandeja(), '') : ''}
      ${grupo(`${STATUS.bandeja.icone} Semear na bandeja`, tb.semearAgora, 'nada')}
      ${grupo('🧰 Preparar', tb.preparar, '')}
      ${grupo(`${STATUS.plantar.icone} Plantar no canteiro`, plantar, 'nada')}
      ${grupo(`${STATUS.colher.icone} Colher`, colher, 'nada')}
      ${grupo('✂️ Cuidados', cuidados, '')}
      ${grupo(`${STATUS.florindo.icone} Florindo`, florindo, '', false)}
      ${grupo('⚠️ Atenção', atencao, '')}
      ${grupo(`${STATUS.crescendo.icone} Crescendo`, crescendo, '', false)}
      ${grupo('🔵 Áreas livres', livres, '')}
      ${grupo('🗓️ Bandeja nos próximos meses', tb.proximos, '', false)}
      ${grupo(`💡 Bom para semear na bandeja em ${MESES[mesSol].toLowerCase()}`, itensSugestaoBandeja(m), '', false)}
    </section>
    <section><p class="nota">Clique num canteiro do mapa (ou numa tarefa) para planejar o que plantar nele.</p></section>`;
}

function renderCalendario() {
  if (modo !== 'mapa') return;
  renderFaixaMeses();
  $('areaAno').classList.toggle('oculto', vistaCal !== 'ano');
  $('areaMapa').classList.toggle('oculto', vistaCal === 'ano');
  if (vistaCal === 'ano') renderAno();
  // Sem área selecionada: tarefas do mês. Com área: o painel da área (em app.js).
  const semZona = !zonaPorId(zonaAtiva);
  $('painelCal').classList.toggle('oculto', !semZona);
  if (semZona) renderPainelCalendario();
}

// Linha do tempo de um canteiro, dentro do painel da área
function renderAnoZona(z) {
  const box = $('zAno');
  if (!z || !TIPOS_PLANTAVEIS.includes(z.tipo) || !(z.plantas || []).length) { box.innerHTML = ''; return; }
  box.innerHTML = `<h4>Ano deste canteiro</h4>${tabelaAno([z], true)}`;
}

// ---------------------------------------------------------------------
//  Eventos
// ---------------------------------------------------------------------

function montarCalendario() {
  const clique = ev => {
    const mes = ev.target.closest('[data-mes-cal]');
    if (mes) { escolherMes(Number(mes.dataset.mesCal)); return; }
    const passo = ev.target.closest('[data-mes-passo]');
    if (passo) { escolherMes(mesSol + Number(passo.dataset.mesPasso)); return; }
    const vista = ev.target.closest('[data-vista]');
    if (vista) {
      vistaCal = vista.dataset.vista;
      renderCalendario();
      if (vistaCal === 'mes') requestAnimationFrame(() => { redimensionarCanvas(); ajustar(); });
      return;
    }
    if (ev.target.closest('select')) return;
    const zs = ev.target.closest('[data-zona-sel]');
    if (zs) {
      zonaAtiva = Number(zs.dataset.zonaSel);
      atualizarPaineis();
      desenhar();
    }
  };
  const mudanca = ev => {
    const s = ev.target.closest('[data-plantio-cal]');
    if (s) definirPlantio(Number(s.dataset.zona), s.dataset.plantioCal, s.value);
  };
  for (const id of ['faixaMeses', 'areaAno', 'painelCal', 'zAno']) {
    $(id).addEventListener('click', clique);
    $(id).addEventListener('change', mudanca);
  }
}
