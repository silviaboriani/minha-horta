'use strict';

// =====================================================================
//  Minha Horta — "Sugerir plano": o app monta a ordem de plantio do ano
//
//  Para cada canteiro, a partir do mês escolhido, percorre os 12 meses e,
//  sempre que sobra espaço, escolhe plantas que:
//    • estão na época de ir para o canteiro naquele mês
//    • recebem sol suficiente naquele mês
//    • não ficam no canteiro durante as geadas (se forem sensíveis)
//    • não "brigam" com o que está no canteiro ou nos vizinhos ao mesmo tempo
//  e dá preferência às que combinam com as vizinhas, às favoritas e à variedade.
// =====================================================================

const TIPOS_PLANO = ['canteiro'];
const FATIA_MAX = 0.5;      // cada plantio ocupa no máximo metade da área (mais de cada, menos variedade por canteiro)
const FATIA_MIN = 0.15;     // e pelo menos 15% (para não sobrar plantios minúsculos)
const LIVRE_MIN = 0.2;      // só procura nova planta se sobrar 20% da área
const NOVAS_POR_MES = 2;
const MAX_NO_CANTEIRO = 2;  // a mesma cultura no máximo 2 vezes por ano no mesmo canteiro
const LIVRE_REPETIR = 0.5;  // só repete cultura de outro canteiro se este ficaria mais da metade vazio

let propostaPlano = null;   // { escopo, zonas: [{ zona, atuais, novas, aplicar }], opcoes }
const opcoesPlano = { manter: true, lista: true, nuncaRepetir: false };

// Média de horas de sol de cada área, por mês (calculado sob demanda)
function solMedioPorMes() {
  const cache = {};
  return (zonaId, m) => {
    if (!cache[m]) {
      const s = calcularSol(m - 1);
      const soma = {}, n = {};
      estado.celulas.forEach((id, i) => {
        if (!id || Number.isNaN(s.horas[i])) return;
        soma[id] = (soma[id] || 0) + s.horas[i];
        n[id] = (n[id] || 0) + 1;
      });
      cache[m] = Object.fromEntries(Object.keys(soma).map(id => [id, soma[id] / n[id]]));
    }
    return cache[m][zonaId] ?? 12;
  };
}

// Gera a proposta. zonas = áreas a planejar; inicio = mês (1–12) de partida
function gerarPlano(zonas, inicio) {
  const an = analiseHorta();
  const sol = solMedioPorMes();
  const geada = mesesGeada();
  const lado = estado.tamanhoCelulaCm / 100;
  const cont = contarCelulas();
  const usadasNoPlano = {};   // id → quantas vezes já apareceu na proposta (variedade na horta)

  // Plantios que já existem em cada área (ou só nas que não serão replanejadas)
  const plantiosPorZona = {};
  for (const z of estado.zonas) {
    const replanejar = zonas.includes(z) && !opcoesPlano.manter;
    plantiosPorZona[z.id] = replanejar ? [] : (an.entradasPorZona[z.id] || []).filter(e => e.p).map(e => {
      const x = an.porZona[z.id]?.plantas.find(q => q.entrada === e.entrada);
      const qtd = e.qtd || x?.sugestao || 0;
      return { id: e.id, p: e.p, inicio: e.inicio, ativos: e.ativos, area: qtd * areaDePe(e.p), atual: true, entrada: e.entrada, qtd: e.qtd };
    });
  }

  const candidatas = todasPlantas().filter(p =>
    !p.perene && (!opcoesPlano.lista || !temFavoritos() || naLista(p.id)) && mesesDeIrProCanteiro(p).length);

  const resultado = [];
  for (const z of zonas) {
    const area = (cont[z.id] || 0) * lado * lado;
    const plantios = plantiosPorZona[z.id];
    const vizinhas = [...(an.viz[z.id] || [])];
    const novas = [];
    const usoNoMes = m => plantios.reduce((s, x) => s + (x.ativos.has(m) ? x.area : 0), 0);

    for (let k = 0; k < 12; k++) {
      const m = mesMais(inicio, k);
      for (let tentativa = 0; tentativa < NOVAS_POR_MES; tentativa++) {
        if (area - usoNoMes(m) < area * LIVRE_MIN) break;
        let melhor = null, melhorRepetida = null;
        for (const p of candidatas) {
          if (!mesesDeIrProCanteiro(p).includes(m)) continue;
          const ativos = mesesAtivos(p, m);
          if (p.geada && geada.some(g => ativos.has(g))) continue;
          if (sol(z.id, m) < p.sol - 0.5) continue;
          const junto = plantios.filter(x => seCruzam(ativos, x.ativos));
          if (junto.some(x => x.id === p.id || saoInimigas(p.id, x.id))) continue;
          const juntoViz = vizinhas.flatMap(v => plantiosPorZona[v] || []).filter(x => seCruzam(ativos, x.ativos));
          if (juntoViz.some(x => saoInimigas(p.id, x.id))) continue;
          // espaço livre em todos os meses em que ela fica no canteiro
          const livre = Math.min(...[...ativos].map(mm => area - usoNoMes(mm)));
          const fatia = Math.min(livre, area * FATIA_MAX);
          // nada de "sobrinhas": cada plantio precisa de pelo menos 15% da área (ou 1 pé, se for planta grande)
          if (fatia < Math.min(area * FATIA_MIN, areaDePe(p))) continue;
          if (fatia < area * FATIA_MIN && areaDePe(p) < area * FATIA_MIN) continue;
          const qtd = Math.floor(fatia / areaDePe(p) + 1e-9);
          if (qtd < minPes(p)) continue;

          const amigas = [...new Set(junto.filter(x => saoAmigas(p.id, x.id)).map(x => x.id))];
          const amigasViz = [...new Set(juntoViz.filter(x => saoAmigas(p.id, x.id)).map(x => x.id))];
          const vezesAqui = plantios.filter(x => x.id === p.id).length;
          if (vezesAqui >= MAX_NO_CANTEIRO) continue;
          const categoriaNova = !junto.some(x => x.p.cat === p.cat);   // variedade: folha + raiz + fruto…
          // rotação: mesma família logo depois, ou no histórico do diário
          const rotacao = conflitoRotacao(z.id, p, m, ativos, plantios.map(x => ({ ...x, entrada: x.entrada || '' })), null);
          // Mesma cultura em outro canteiro, nos mesmos meses: evitar ao máximo
          const emOutros = Object.entries(plantiosPorZona).filter(([zid, lista]) =>
            Number(zid) !== z.id && lista.some(x => x.id === p.id && seCruzam(ativos, x.ativos))).length;
          const pontos = 2 * amigas.length + 0.5 * Math.min(3, amigasViz.length) + (naLista(p.id) ? 1 : 0)
            + (categoriaNova ? 1.5 : 0) - 3 * vezesAqui - 2 * emOutros - (rotacao ? 4 : 0) + (mesesBons(p).includes(m) ? 2 : 0) + Math.random() * 2;
          const opcao = { p, ativos, qtd, fatia, amigas, amigasViz, pontos };
          if (emOutros) { if (!melhorRepetida || pontos > melhorRepetida.pontos) melhorRepetida = opcao; }
          else if (!melhor || pontos > melhor.pontos) melhor = opcao;
        }
        // Cultura que já está em outro canteiro só entra se não houver alternativa e o canteiro ficaria muito vazio
        if (!melhor && melhorRepetida && !opcoesPlano.nuncaRepetir && area - usoNoMes(m) >= area * LIVRE_REPETIR) melhor = melhorRepetida;
        if (!melhor) break;
        const { p, ativos, qtd, amigas, amigasViz } = melhor;
        const motivos = [`época de plantar em ${MESES[m - 1].toLowerCase()}`, `${fmt(sol(z.id, m), 1)} h de sol`];
        if (amigas.length) motivos.push(`combina com ${amigas.map(nomePlanta).join(', ')}`);
        if (amigasViz.length) motivos.push(`vizinha de ${amigasViz.slice(0, 3).map(nomePlanta).join(', ')}`);
        const nova = { id: p.id, p, inicio: m, ativos, area: qtd * areaDePe(p), qtd, motivos };
        plantios.push(nova);
        novas.push(nova);
        usadasNoPlano[p.id] = (usadasNoPlano[p.id] || 0) + 1;
      }
    }
    resultado.push({ zona: z, atuais: plantios.filter(x => x.atual), novas, aplicar: true });
  }
  return resultado;
}

// ---------------------------------------------------------------------
//  Janela de pré-visualização
// ---------------------------------------------------------------------

function abrirSugestaoPlano(escopo) {
  const zonas = escopo === 'horta'
    ? estado.zonas.filter(z => TIPOS_PLANO.includes(z.tipo)).sort(ordemNome)
    : [zonaPorId(zonaAtiva)].filter(Boolean);
  if (!zonas.length) { avisar('Não há canteiros para planejar.'); return; }
  propostaPlano = { escopo, ids: zonas.map(z => z.id), inicio: mesSol + 1 };
  regerarPlano();
  $('modalPlano').classList.remove('oculto');
}

function regerarPlano() {
  const zonas = propostaPlano.ids.map(zonaPorId).filter(Boolean);
  propostaPlano.zonas = gerarPlano(zonas, propostaPlano.inicio);
  renderModalPlano();
}

function linhaPreview(x, nova) {
  const e = { p: x.p, inicio: x.inicio };
  return `<tr class="${nova ? 'nova' : 'atual'}"><th title="${nova ? escapar(x.motivos.join(' · ')) : 'já está no canteiro'}">
      <span class="nome-pl">${escapar(x.p.emoji)} ${escapar(x.p.nome)}${x.qtd ? ` <small>×${x.qtd}</small>` : ''}</span>
      <span class="quando">${nova ? `✨ ${MESES_CURTOS[x.inicio - 1]}` : 'atual'}</span></th>${celulasAno(e)}</tr>`;
}

function renderModalPlano() {
  const pr = propostaPlano;
  const cab = `<tr><th></th>${MESES_CURTOS.map((m, i) => `<th class="${i === pr.inicio - 1 ? 'sel' : ''}">${m}</th>`).join('')}</tr>`;
  const blocos = pr.zonas.map((r, i) => `
    <div class="bloco-plano">
      <div class="bloco-topo">
        ${pr.zonas.length > 1 ? `<label class="check"><input type="checkbox" data-aplicar-zona="${i}" ${r.aplicar ? 'checked' : ''}> <b>${escapar(r.zona.nome)}</b></label>` : `<b>${escapar(r.zona.nome)}</b>`}
        <span class="nota">${r.novas.length ? `${r.novas.length} plantio(s) novo(s)` : 'nada a acrescentar — está cheio ou nada serve'}</span>
      </div>
      ${r.atuais.length || r.novas.length ? `<table class="gantt compacta preview">${cab}
        ${r.atuais.map(x => linhaPreview(x, false)).join('')}
        ${r.novas.sort((a, b) => ((a.inicio - pr.inicio + 12) % 12) - ((b.inicio - pr.inicio + 12) % 12)).map(x => linhaPreview(x, true)).join('')}
      </table>` : ''}
    </div>`).join('');
  const total = pr.zonas.reduce((s, r) => s + (r.aplicar ? r.novas.length : 0), 0);

  $('modalPlanoCaixa').innerHTML = `
    <button class="fechar" data-plano="cancelar" title="Fechar">×</button>
    <h3>✨ Sugestão de plano ${pr.escopo === 'horta' ? 'para a horta toda' : `— ${escapar(pr.zonas[0].zona.nome)}`}</h3>
    <p class="nota">Ordem de plantio para 12 meses a partir de <b>${MESES[pr.inicio - 1].toLowerCase()}</b>: plantas na época certa, com sol suficiente,
      longe das geadas (as sensíveis), sem vizinhas que não combinam e ocupando o espaço livre ao longo do ano.
      ${TXT.passe} sobre uma planta ✨ para ver por que ela foi escolhida.</p>
    <div class="opcoes-plano">
      <label class="check"><input type="checkbox" data-op="manter" ${opcoesPlano.manter ? 'checked' : ''}> Manter as plantas que já estão</label>
      ${temFavoritos() ? `<label class="check"><input type="checkbox" data-op="lista" ${opcoesPlano.lista ? 'checked' : ''}> Só favoritos ★</label>` : ''}
      <label class="check" title="Sem esta opção, uma cultura que já está em outro canteiro só é usada quando não há alternativa e o canteiro ficaria mais da metade vazio"><input type="checkbox" data-op="nuncaRepetir" ${opcoesPlano.nuncaRepetir ? 'checked' : ''}> Nunca repetir cultura entre canteiros (pode sobrar espaço)</label>
      <label>Começar em <select data-op="inicio">${MESES.map((m, i) => `<option value="${i + 1}" ${i + 1 === pr.inicio ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
    </div>
    <div class="blocos-plano">${blocos}</div>
    <div class="acoes-plano">
      <button class="principal" data-plano="aplicar" ${total ? '' : 'disabled'}>✓ Aplicar ${total} plantio(s)</button>
      <button data-plano="outra">↻ Outra sugestão</button>
      <button data-plano="cancelar">Cancelar</button>
    </div>`;
}

function aplicarPlano() {
  const pr = propostaPlano;
  registrar();
  let n = 0;
  for (const r of pr.zonas) {
    if (!r.aplicar) continue;
    const z = r.zona;
    if (!opcoesPlano.manter) { z.plantas = []; z.qtd = {}; z.plantio = {}; z.pos = {}; z.origem = {}; }
    for (const x of r.novas) {
      let chave = x.id, k = 2;
      while (z.plantas.includes(chave)) chave = `${x.id}#${k++}`;
      z.plantas.push(chave);
      z.plantio[chave] = x.inicio;
      z.qtd[chave] = x.qtd;
      z.origem = z.origem || {};
      z.origem[chave] = 'plano';
      n++;
    }
  }
  fecharPlano();
  mudou();
  avisar(`${n} plantio(s) adicionados. Veja a ordem em 📅 Ano — e Ctrl+Z desfaz, se quiser.`);
}

function fecharPlano() {
  propostaPlano = null;
  $('modalPlano').classList.add('oculto');
}

function montarSugerir() {
  const modal = $('modalPlano');
  modal.addEventListener('click', ev => {
    if (ev.target === modal) { fecharPlano(); return; }
    const acao = ev.target.closest('[data-plano]')?.dataset.plano;
    if (acao === 'cancelar') fecharPlano();
    else if (acao === 'outra') regerarPlano();
    else if (acao === 'aplicar') aplicarPlano();
  });
  modal.addEventListener('change', ev => {
    const op = ev.target.dataset.op;
    if (op === 'manter' || op === 'lista' || op === 'nuncaRepetir') { opcoesPlano[op] = ev.target.checked; regerarPlano(); }
    else if (op === 'inicio') { propostaPlano.inicio = Number(ev.target.value); regerarPlano(); }
    else if (ev.target.dataset.aplicarZona !== undefined) {
      propostaPlano.zonas[Number(ev.target.dataset.aplicarZona)].aplicar = ev.target.checked;
      renderModalPlano();
    }
  });
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && propostaPlano) fecharPlano(); });
  // Botões nos painéis (delegação: os painéis são redesenhados)
  document.addEventListener('click', ev => {
    const b = ev.target.closest('[data-sugerir-plano]');
    if (b) abrirSugestaoPlano(b.dataset.sugerirPlano);
  });
}
