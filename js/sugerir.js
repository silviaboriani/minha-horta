'use strict';

// =====================================================================
//  Minha Horta — "Sugerir plano": o app monta a ordem de plantio do ano
//
//  Para cada canteiro, percorre os meses escolhidos (em ordem, a partir do mês atual) e,
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
const FATIA_MAX_GRANDE = 0.8;   // plantas espaçosas (abóbora, melancia…) podem ocupar quase o canteiro todo
// Plantas que se esparramam ou precisam de muito chão (além das que ocupam ≥ 1,5 m² por pé)
const RAMAS = ['abobora', 'abobora-menina', 'abobora-moranga', 'abobora-cabotia', 'abobora-pescoco', 'melancia', 'melao',
  'batata-doce', 'abobrinha', 'maxixe', 'pepino-caipira', 'mandioca', 'yacon', 'cara', 'inhame', 'milho-verde', 'milho-pipoca'];
const precisaEspaco = p => RAMAS.includes(p.id) || areaDePe(p) >= 1.5;
// Espaçosas cujas ramas podem subir numa treliça ou cerca (em canteiro pequeno, economiza chão)
const SOBE_NA_TRELICA = ['abobora', 'abobora-menina', 'abobora-moranga', 'abobora-cabotia', 'abobora-pescoco', 'melancia', 'melao',
  'maxixe', 'pepino-caipira'];
const podeTrelica = p => SOBE_NA_TRELICA.includes(p.id) || !!p.tutor;
const marcaTrelica = x => x.trelica ? '<span class="trelica-pl" title="Canteiro pequeno: conduza as ramas numa treliça ou cerca">🪜</span>' : '';

// "Ano todo": marca os 12 meses guardando os de antes; desmarcar volta a eles
function alternarAnoTodo(sel, antes, inicio) {
  if (sel.size < 12) return { sel: new Set(Array.from({ length: 12 }, (_, i) => i + 1)), antes: new Set(sel) };
  return { sel: antes && antes.size && antes.size < 12 ? new Set(antes) : new Set([inicio]), antes: null };
}
const LIVRE_MIN = 0.2;      // só procura nova planta se sobrar 20% da área
const NOVAS_POR_MES = 2;
const MAX_NO_CANTEIRO = 2;  // a mesma cultura no máximo 2 vezes por ano no mesmo canteiro
const LIVRE_REPETIR = 0.5;  // só repete cultura de outro canteiro se este ficaria mais da metade vazio

let propostaPlano = null;   // { escopo, zonas: [{ zona, atuais, novas, aplicar }], opcoes }
const opcoesPlano = { manter: true, lista: true, repetir: true,
  mesesSel: new Set(),   // meses (1–12) em que se planta; ao abrir, só o mês atual
  mesesAntes: null,      // meses marcados antes de "Ano todo" (para voltar a eles)
  sobra: 'outras',       // espaço que sobra depois das quantidades da casa: outras | livre | adubo
  grupos: new Set(['vegetais', 'frutas', 'ervas', 'graos', 'flores']) };

// Plantas que a pessoa tirou do plano ("não quero plantar")
const semPlano = () => new Set(estado.semPlano || []);
function tirarDoPlano(id, tirar) {
  const s = semPlano();
  if (tirar) s.add(id); else s.delete(id);
  registrar();
  estado.semPlano = [...s];
  mudou();
  regerarPlano();
}
const botaoTirar = p => `<button class="tirar-pl" data-tirar-planta="${escapar(p.id)}" title="Não quero ${escapar(p.nome)} no plano">×</button>`;

// Plantas que podem entrar no plano com as opções atuais (sem olhar época, sol ou espaço)
function candidatasDoPlano() {
  const fora = semPlano();
  return todasPlantas().filter(p => !fora.has(p.id) && !p.perene && mesesDeIrProCanteiro(p).length && !(p.adubo && p.id !== 'aveia')
    && (!opcoesPlano.lista || !temFavoritos() || naLista(p.id))
    && opcoesPlano.grupos.has(grupoDaPlanta(p)));
}


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
// Sorte de 0 a 1 que depende só da semente e da chave (canteiro, planta, mês):
// a mesma escolha recebe sempre a mesma sorte, então mudar uma regra e voltar dá o mesmo plano
function sorte(chave) {
  let h = 2166136261 ^ (propostaPlano?.semente || 0);
  for (let i = 0; i < chave.length; i++) h = Math.imul(h ^ chave.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

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
      const pl = { id: e.id, p: e.p, inicio: e.inicio, ativos: e.ativos, area: qtd * areaDePe(e.p), atual: true, entrada: e.entrada, qtd: e.qtd };
      pl.janela = naJanela(pl);
      return pl;
    });
  }

  const candidatas = candidatasDoPlano();
  const casa = !semLimite();   // quantidades pelo perfil da horta (e não pelo espaço)
  const porMes = casa && opcoesPlano.sobra === 'outras' ? 8 : NOVAS_POR_MES;
  const adubos = todasPlantas().filter(p => ADUBOS_VERDES.includes(p.id) && !semPlano().has(p.id));


  // O maior canteiro da horta serve de régua; os maiores são planejados primeiro,
  // para as plantas espaçosas ficarem com eles
  const areaDe = z => (cont[z.id] || 0) * lado * lado;
  const maior = Math.max(...estado.zonas.filter(z => TIPOS_PLANO.includes(z.tipo)).map(areaDe), ...zonas.map(areaDe), 0.01);
  const resultado = [];
  for (const z of [...zonas].sort((a, b) => areaDe(b) - areaDe(a))) {
    const area = areaDe(z);
    const rel = Math.min(area / maior, area / 10);   // 1 = o maior canteiro, se tiver 10 m² ou mais
    const plantios = plantiosPorZona[z.id];
    const vizinhas = [...(an.viz[z.id] || [])];
    const novas = [];
    const usoNoMes = m => plantios.reduce((s, x) => s + (x.janela.has(m) ? x.area : 0), 0);

    for (let k = 0; k < 12; k++) {
      const m = mesMais(inicio, k);
      if (!opcoesPlano.mesesSel.has(m)) continue;   // só nos meses escolhidos
      for (let tentativa = 0; tentativa < porMes; tentativa++) {
        if (area - usoNoMes(m) < area * LIVRE_MIN) break;
        let melhor = null, melhorRepetida = null;
        for (const p of candidatas) {
          if (!mesesDeIrProCanteiro(p).includes(m)) continue;
          const ativos = mesesAtivos(p, m);
          if (p.geada && geada.some(g => ativos.has(g))) continue;
          if (sol(z.id, m) < p.sol - 0.5) continue;
          const janela = naJanela({ p, inicio: m, ativos });
          const junto = plantios.filter(x => seCruzam(janela, x.janela));
          if (junto.some(x => x.id === p.id || saoInimigas(p.id, x.id))) continue;
          const juntoViz = vizinhas.flatMap(v => plantiosPorZona[v] || []).filter(x => seCruzam(janela, x.janela));
          if (juntoViz.some(x => saoInimigas(p.id, x.id))) continue;
          // espaço livre em todos os meses em que ela fica no canteiro
          const livre = Math.min(...[...janela].map(mm => area - usoNoMes(mm)));
          const grande = precisaEspaco(p);
          let fatia = Math.min(livre, area * (grande ? FATIA_MAX_GRANDE : FATIA_MAX)), qtd;
          if (casa) {
            // o que a casa precisa, sem passar do que cabe
            const alvo = quantidadeAlvo(p);
            qtd = Math.min(alvo, Math.floor(fatia / areaDePe(p) + 1e-9));
            if (qtd < 1 || qtd < Math.min(alvo, minPes(p))) continue;
            fatia = qtd * areaDePe(p);
          } else {
            // nada de "sobrinhas": cada plantio precisa de pelo menos 15% da área (ou 1 pé, se for planta grande)
            if (fatia < Math.min(area * FATIA_MIN, areaDePe(p))) continue;
            if (fatia < area * FATIA_MIN && areaDePe(p) < area * FATIA_MIN) continue;
            qtd = Math.floor(fatia / areaDePe(p) + 1e-9);
            if (qtd < minPes(p)) continue;
          }

          const amigas = [...new Set(junto.filter(x => saoAmigas(p.id, x.id)).map(x => x.id))];
          const amigasViz = [...new Set(juntoViz.filter(x => saoAmigas(p.id, x.id)).map(x => x.id))];
          const vezesAqui = plantios.filter(x => x.id === p.id).length;
          if (vezesAqui >= MAX_NO_CANTEIRO) continue;
          const categoriaNova = !junto.some(x => x.p.cat === p.cat);   // variedade: folha + raiz + fruto…
          // rotação: mesma família logo depois, ou no histórico do diário
          const rotacao = conflitoRotacao(z.id, p, m, ativos, plantios.map(x => ({ ...x, entrada: x.entrada || '' })), null);
          // Mesma cultura em outro canteiro, nos mesmos meses: evitar ao máximo
          const emOutros = Object.entries(plantiosPorZona).filter(([zid, lista]) =>
            Number(zid) !== z.id && lista.some(x => x.id === p.id && seCruzam(janela, x.janela))).length;
          const pontos = 2 * amigas.length + 0.5 * Math.min(3, amigasViz.length) + (naLista(p.id) ? 1 : 0)
            + (categoriaNova ? 1.5 : 0) - 3 * vezesAqui - 2 * emOutros - (rotacao ? 4 : 0) + (mesesBons(p).includes(m) ? 2 : 0) + sorte(`${z.id}|${p.id}|${m}`) * 2
            + (grande ? 9 * rel - 5 : 0);   // espaçosa: prefere os canteiros grandes, evita os pequenos
          const noGrande = grande && 9 * rel - 5 > 0;
          const opcao = { p, ativos, janela, qtd, fatia, amigas, amigasViz, pontos, noGrande, trelica: grande && !noGrande && podeTrelica(p) };
          if (emOutros) { if (!melhorRepetida || pontos > melhorRepetida.pontos) melhorRepetida = opcao; }
          else if (!melhor || pontos > melhor.pontos) melhor = opcao;
        }
        // Cultura que já está em outro canteiro só entra se não houver alternativa e o canteiro ficaria muito vazio
        if (!casa && !melhor && melhorRepetida && opcoesPlano.repetir && area - usoNoMes(m) >= area * LIVRE_REPETIR) melhor = melhorRepetida;
        if (!melhor) break;
        const { p, ativos, janela, qtd, amigas, amigasViz, noGrande, trelica } = melhor;
        const motivos = [`época de plantar em ${MESES[m - 1].toLowerCase()}`, `${fmt(sol(z.id, m), 1)} h de sol`];
        if (noGrande) motivos.push('precisa de espaço: vai num canteiro grande');
        if (trelica) motivos.push('canteiro pequeno: conduza as ramas numa treliça ou cerca para economizar chão');
        if (amigas.length) motivos.push(`combina com ${amigas.map(nomePlanta).join(', ')}`);
        if (amigasViz.length) motivos.push(`vizinha de ${amigasViz.slice(0, 3).map(nomePlanta).join(', ')}`);
        const nova = { id: p.id, p, inicio: m, ativos, janela, area: qtd * areaDePe(p), qtd, motivos, trelica };
        plantios.push(nova);
        novas.push(nova);
        usadasNoPlano[p.id] = (usadasNoPlano[p.id] || 0) + 1;
      }
      if (casa && opcoesPlano.sobra === 'adubo' && area - usoNoMes(m) >= area * LIVRE_MIN) {
        for (const p of adubos) {
          if (!mesesDeIrProCanteiro(p).includes(m) || sol(z.id, m) < p.sol - 0.5) continue;
          const ativos = mesesAtivos(p, m);
          if (p.geada && geada.some(g => ativos.has(g))) continue;
          const janela = naJanela({ p, inicio: m, ativos });
          if (plantios.some(x => x.id === p.id && seCruzam(janela, x.janela))) continue;
          const livre = Math.min(...[...janela].map(mm => area - usoNoMes(mm)));
          const qtd = Math.floor(livre / areaDePe(p) + 1e-9);
          if (qtd < 1 || livre < area * LIVRE_MIN) continue;
          const nova = { id: p.id, p, inicio: m, ativos, janela, area: qtd * areaDePe(p), qtd, adubo: true,
            motivos: ['adubação verde no espaço que sobrou', 'corte na floração e deixe a palha sobre o solo'] };
          plantios.push(nova);
          novas.push(nova);
          break;
        }
      }
    }
    resultado.push({ zona: z, atuais: plantios.filter(x => x.atual), novas, aplicar: true });
  }
  return zonas.map(z => resultado.find(r => r.zona === z));   // de volta à ordem da lista
}

// ---------------------------------------------------------------------
//  Janela de pré-visualização
// ---------------------------------------------------------------------

function abrirSugestaoPlano(escopo) {
  const zonas = escopo === 'horta'
    ? estado.zonas.filter(z => TIPOS_PLANO.includes(z.tipo)).sort(ordemNome)
    : [zonaPorId(zonaAtiva)].filter(Boolean);
  if (!zonas.length) { avisar('Não há canteiros para planejar.'); return; }
  propostaPlano = { escopo, ids: zonas.map(z => z.id), inicio: mesSol + 1, semente: novaSemente(), editadas: {}, fora: new Set() };
  opcoesPlano.mesesSel = new Set([mesSol + 1]);
  opcoesPlano.mesesAntes = null;
  regerarPlano();
  $('modalPlano').classList.remove('oculto');
}

const novaSemente = () => Math.floor(Math.random() * 1e9);
const chaveEditada = (r, x) => `${r.zona.id}|${x.id}|${x.inicio}`;

function regerarPlano() {
  const zonas = propostaPlano.ids.map(zonaPorId).filter(Boolean);
  propostaPlano.ordem = ordemMeses(propostaPlano.inicio);
  propostaPlano.zonas = gerarPlano(zonas, propostaPlano.inicio);
  for (const r of propostaPlano.zonas) {
    r.novas.sort((a, b) => posNoPlano(a.inicio) - posNoPlano(b.inicio));
    r.aplicar = !propostaPlano.fora.has(r.zona.id);
    for (const x of r.novas) {
      const q = propostaPlano.editadas[chaveEditada(r, x)];
      if (q !== undefined) { x.qtd = q; x.area = q * areaDePe(x.p); }
    }
  }
  renderModalPlano();
}

let vistaPlano = 'canteiro';   // 'canteiro' (padrão) | 'mes' | 'planta'

// Caixinha de quantidade (0 = não plantar) — a mesma em todas as vistas
const caixaQtd = (x, chave) => `<input type="number" class="qtd-plano" min="0" step="1" value="${x.qtd}" data-qtd-plano="${chave}" title="Quantos pés (0 = não plantar)">`;
// Quando colhe (ou floresce), contando do mês de plantio
function colheitaDe(x) {
  const meses = [...x.ativos].filter(m => statusNoMes(x.p, x.inicio, m) === 'colher');
  return `${ehFlor(x.p) ? '🌸' : '🧺'} ${faixaMeses(meses)}`;
}
// Todas as novas, com a chave "zona:índice"
const todasNovas = pr => pr.zonas.flatMap((r, i) => r.novas.map((x, j) => ({ x, r, chave: `${i}:${j}` })));

// Vista por mês: lista do que fazer, mês a mês
function vistaPorMes(pr, escolhidos) {
  const novas = todasNovas(pr);
  return escolhidos.map(m => {
    const doMes = novas.filter(n => n.x.inicio === m);
    if (!doMes.length) return '';
    const porZona = pr.zonas.map(r => ({ r, itens: doMes.filter(n => n.r === r) })).filter(g => g.itens.length);
    return `<div class="mes-bloco"><h4>${MESES[m - 1]}</h4>
      ${porZona.map(({ r, itens }) => `<div class="mes-linha ${r.aplicar ? '' : 'fora'}"><span class="onde">${escapar(r.zona.nome)}</span>
        <span class="itens">${itens.map(({ x, chave }) => `<span class="item-plano ${x.qtd ? '' : 'zerada'}" title="${escapar(x.motivos.join(' · '))}">
          ${escapar(x.p.emoji)} ${escapar(x.p.nome)}${marcaTrelica(x)} ${caixaQtd(x, chave)} <small>→ ${colheitaDe(x)}</small>${botaoTirar(x.p)}</span>`).join('')}</span></div>`).join('')}
    </div>`;
  }).join('');
}

// Vista por planta: mostra quando uma planta volta (replantio) e onde
function vistaPorPlanta(pr) {
  const grupos = {};
  for (const n of todasNovas(pr)) (grupos[n.x.p.id] = grupos[n.x.p.id] || []).push(n);
  const ordem = posNoPlano;
  for (const l of Object.values(grupos)) l.sort((a, b) => ordem(a.x.inicio) - ordem(b.x.inicio) || a.r.zona.nome.localeCompare(b.r.zona.nome, 'pt', { numeric: true }));
  return Object.values(grupos)
    .sort((a, b) => (b.length - a.length) || a[0].x.p.nome.localeCompare(b[0].x.p.nome, 'pt'))
    .map(lista => `<div class="planta-linha"><span class="quem">${escapar(lista[0].x.p.emoji)} <b>${escapar(lista[0].x.p.nome)}</b>
        ${lista.length > 1 ? `<span class="vezes" title="Replantada ao longo do período">🔁 ${lista.length}×</span>` : ''}${botaoTirar(lista[0].x.p)}</span>
      <span class="itens">${lista.map(({ x, r, chave }) => `<span class="item-plano ${x.qtd ? '' : 'zerada'} ${r.aplicar ? '' : 'fora'}" title="${escapar(x.motivos.join(' · '))}">
        ${escapar(r.zona.nome)} · ${MESES_CURTOS[x.inicio - 1]}${marcaTrelica(x)} ${caixaQtd(x, chave)}</span>`).join('<span class="seta-pl">→</span>')}</span></div>`).join('');
}

// Barrinha de espaço ocupado por mês (prévia por canteiro)
function linhaEspaco(r) {
  const cont = contarCelulas();
  const lado = estado.tamanhoCelulaCm / 100;
  const area = (cont[r.zona.id] || 0) * lado * lado;
  if (!area) return '';
  const todos = [...r.atuais, ...r.novas.filter(x => x.qtd > 0)];
  const { ordem } = propostaPlano;
  return `<tr class="espaco"><th>espaço ocupado</th>${ordem.map(i => {
    const uso = todos.reduce((s, x) => s + (naJanela(x).has(i + 1) ? (x.area || 0) : 0), 0);
    const pct = Math.round(uso / area * 100);
    return `<td class="${i === 0 && ordem[0] !== 0 ? 'virada' : ''}" title="${MESES[i]}: ${pct}% do canteiro"><i class="${pct > 100 ? 'mal' : ''}" style="height:${Math.min(100, pct)}%"></i></td>`;
  }).join('')}</tr>`;
}

// Ano do primeiro mês do plano (um mês que já passou neste ano é do ano que vem)
function anoDoPlano(pr) {
  const hoje = new Date();
  return hoje.getFullYear() + (pr.inicio < hoje.getMonth() + 1 ? 1 : 0);
}

// Posição de um mês (1–12) na linha do tempo do plano (0 = primeiro mês)
const posNoPlano = m => (m - propostaPlano.inicio + 12) % 12;
// Meses (1–12) em que o plantio ocupa o canteiro dentro da linha do tempo do plano
const naJanela = x => new Set([...x.ativos].filter(m => mostrarMes(x, m - 1)));

// O calendário do plano é uma linha do tempo de 12 meses, não um ano que se repete:
// esconde os meses em que o ciclo "voltaria" (ex.: plantada em out → não reaparece em nov–dez do começo)
function mostrarMes(x, i) {
  if (x.p.perene) return true;
  const { ordem } = propostaPlano;
  const pos = ordem.indexOf(i), posInicio = ordem.indexOf(x.inicio - 1);
  // já no canteiro, plantada antes do começo do plano: vai até acabar o ciclo atual
  if (x.atual && x.ativos.has(ordem[0] + 1) && posInicio > 0) return pos < posInicio;
  return pos >= posInicio;
}

function linhaPreview(x, nova, chave) {
  const e = { p: x.p, inicio: x.inicio };
  const qtd = nova ? ` ${caixaQtd(x, chave)}` : (x.qtd ? ` <small>×${x.qtd}</small>` : '');
  return `<tr class="${nova ? 'nova' : 'atual'} ${nova && !x.qtd ? 'zerada' : ''}"><th title="${nova ? '' : 'já está no canteiro'}">
      <div class="linha-pl">${nova ? botaoTirar(x.p) : ''}<span class="nome-pl" title="${escapar(x.p.nome)}${nova ? `: ${escapar(x.motivos.join(' · '))}` : ''}">${escapar(x.p.emoji)} ${escapar(x.p.nome)}</span>${nova ? marcaTrelica(x) : ''}${qtd}
      <span class="quando">${nova ? MESES_CURTOS[x.inicio - 1] : 'atual'}</span></div></th>${celulasAno(e, propostaPlano.ordem, i => mostrarMes(x, i))}</tr>`;
}

function renderModalPlano() {
  const pr = propostaPlano;
  // meses escolhidos ficam marcados no cabeçalho
  const sel = opcoesPlano.mesesSel;
  // colunas a partir do mês atual; uma linha com o ano em cima (2026 | 2027)
  const { ordem } = pr;
  const foraDoPlano = todasPlantas().filter(p => semPlano().has(p.id));
  const ano = anoDoPlano(pr), virada = ordem[0] !== 0;
  const rotAno = (i, k) => k === 0 ? `<small class="ano">${ano}</small>` : virada && i === 0 ? `<small class="ano">${ano + 1}</small>` : '';
  const cab = `<tr><th></th>${ordem.map((i, k) => `<th class="${sel.has(i + 1) ? 'janela' : ''} ${virada && i === 0 ? 'virada' : ''}">${rotAno(i, k)}${MESES_CURTOS[i]}</th>`).join('')}</tr>`;
  // em ordem a partir do mês atual (novembro, dezembro, janeiro…)
  const escolhidos = [...sel].sort((a, b) => posNoPlano(a) - posNoPlano(b));
  const nomesMeses = l => l.map(m => MESES[m - 1].toLowerCase()).join(', ').replace(/, ([^,]*)$/, ' e $1');
  const comNovas = new Set(pr.zonas.flatMap(r => r.novas.map(x => x.inicio)));
  const vazios = escolhidos.filter(m => !comNovas.has(m));
  const blocos = pr.zonas.map((r, i) => `
    <div class="bloco-plano">
      <div class="bloco-topo">
        ${pr.zonas.length > 1 ? `<label class="check"><input type="checkbox" data-aplicar-zona="${i}" ${r.aplicar ? 'checked' : ''}> <b>${escapar(r.zona.nome)}</b></label>` : `<b>${escapar(r.zona.nome)}</b>`}
        <span class="nota">${r.novas.length ? `${r.novas.length} plantio(s) novo(s)` : 'nada a acrescentar — está cheio ou nada serve'}</span>
      </div>
      ${r.atuais.length || r.novas.length ? `<table class="gantt compacta preview">${cab}
        ${r.atuais.map(x => linhaPreview(x, false)).join('')}
        ${r.novas.map((x, j) => linhaPreview(x, true, `${i}:${j}`)).join('')}
        ${linhaEspaco(r)}
      </table>` : ''}
    </div>`).join('');
  const total = pr.zonas.reduce((s, r) => s + (r.aplicar ? r.novas.filter(x => x.qtd > 0).length : 0), 0);
  // resumo: plantios, plantas diferentes, meses com plantio
  const validas = pr.zonas.filter(r => r.aplicar).flatMap(r => r.novas.filter(x => x.qtd > 0));
  const resumo = validas.length
    ? `<b>${validas.length}</b> plantio(s) · <b>${new Set(validas.map(x => x.id)).size}</b> plantas diferentes · <b>${new Set(validas.map(x => x.inicio)).size}</b> mês(es) com plantio`
    : 'Nenhum plantio novo.';
  const corpo = vistaPlano === 'mes' ? vistaPorMes(pr, escolhidos) : vistaPlano === 'planta' ? vistaPorPlanta(pr) : blocos;
  const abas = [['canteiro', '🥬 Canteiro'], ['mes', '📅 Mês'], ['planta', '🌱 Planta']]
    .map(([v, t]) => `<button class="${vistaPlano === v ? 'on' : ''}" data-vista-plano="${v}">${t}</button>`).join('');

  $('modalPlanoCaixa').innerHTML = `
    <button class="fechar" data-plano="cancelar" title="Fechar">×</button>
    <h3>✨ Sugestão de plano ${pr.escopo === 'horta' ? 'para a horta toda' : `— ${escapar(pr.zonas[0].zona.nome)}`}</h3>
    <p class="nota">O que plantar ${escolhidos.length ? `em <b>${nomesMeses(escolhidos)}</b>` : 'nos meses escolhidos'}: plantas na época certa, com sol suficiente, protegidas da geada e com boas vizinhas. Cada uma fica no canteiro até a colheita. ${TXT.passe} sobre uma planta para ver o motivo. Mude a quantidade na caixinha (0 = não plantar).</p>
    <div class="opcoes-plano">
      <span class="rot-meses">Plantar em:</span>
      <div class="meses-plano">${ordem.map(i => `${virada && i === 0 ? `<span class="ano-sep" title="Ano que vem">${ano + 1}</span>` : ''}<button class="mes-plano ${sel.has(i + 1) ? 'on' : ''} ${i + 1 === pr.inicio ? 'agora' : ''}" data-mes-plano="${i + 1}" title="${MESES[i]}${i + 1 === pr.inicio ? ' (agora)' : ''}">${MESES_CURTOS[i]}</button>`).join('')}</div>
      <button class="mes-plano ano-todo ${sel.size === 12 ? 'on' : ''}" data-ano-todo title="${sel.size < 12 ? 'Marcar os 12 meses' : opcoesPlano.mesesAntes ? 'Voltar aos meses de antes' : 'Voltar a só este mês'}">${sel.size === 12 ? '✓ Ano todo' : 'Ano todo'}</button>
    </div>
    <div class="opcoes-plano perfil-plano">
      <span>Quantidades para</span>
      <input type="number" min="1" max="30" step="1" value="${perfilDaHorta().pessoas}" data-plano-pessoas title="Quantas pessoas comem da horta (perfil da horta)"> <span>${perfilDaHorta().pessoas === 1 ? 'pessoa' : 'pessoas'} ·</span>
      <select data-plano-objetivo title="Para que serve a horta (perfil da horta)">${Object.entries(OBJETIVOS).map(([k, o]) => `<option value="${k}" ${perfilDaHorta().objetivo === k ? 'selected' : ''}>${o.nome}</option>`).join('')}</select>
      ${semLimite() ? '' : `<label>Espaço que sobra: <select data-plano-sobra>${Object.entries(SOBRAS).map(([k, s]) => `<option value="${k}" ${opcoesPlano.sobra === k ? 'selected' : ''} title="${s.desc}">${s.nome}</option>`).join('')}</select></label>`}
    </div>
    <div class="tipos-plano">${GRUPOS_SUGESTAO.map(g => `<button class="chip-tipo ${opcoesPlano.grupos.has(g.id) ? 'on' : ''}" data-tipo-plano="${g.id}">${g.icone} ${g.nome.replace(' companheiras', '')}</button>`).join('')}</div>
    ${foraDoPlano.length ? `<div class="fora-plano">Fora do plano: ${foraDoPlano
        .map(p => `<button data-voltar-planta="${escapar(p.id)}" title="Voltar a sugerir ${escapar(p.nome)}">${escapar(p.emoji)} ${escapar(p.nome)} ↺</button>`).join('')}</div>` : ''}
    <div class="opcoes-plano">
      <label class="check"><input type="checkbox" data-op="manter" ${opcoesPlano.manter ? 'checked' : ''}> Manter as plantas que já estão</label>
      ${temFavoritos() ? `<label class="check"><input type="checkbox" data-op="lista" ${opcoesPlano.lista ? 'checked' : ''}> Só favoritos ★</label>` : ''}
      ${semLimite() ? `<label class="check" title="Só quando não há outra planta que sirva e o canteiro ficaria vazio. Com quantidades para a casa, a mesma planta nunca fica em dois canteiros ao mesmo tempo."><input type="checkbox" data-op="repetir" ${opcoesPlano.repetir ? 'checked' : ''}> Pode repetir a mesma planta em dois canteiros (para não sobrar espaço)</label>` : ''}
    </div>
    ${!sel.size ? '<p class="vazio">Escolha pelo menos um mês acima.</p>' : ''}
    ${!opcoesPlano.grupos.size ? '<p class="vazio">Escolha pelo menos um tipo de planta acima.</p>' : ''}
    ${sel.size && opcoesPlano.grupos.size && vazios.length ? `<p class="nota aviso-meses">Nada novo em ${nomesMeses(vazios)} — fora de época para os tipos escolhidos, ou os canteiros já estão cheios.</p>` : ''}
    <div class="topo-vista"><span class="resumo-plano">${resumo}</span><span class="abas-vista">Ver por ${abas}</span></div>
    ${vistaPlano !== 'canteiro' && pr.zonas.length > 1 && pr.zonas.some(r => !r.aplicar) ? '<p class="nota">Os canteiros desmarcados (na vista Canteiro) aparecem apagados e não entram no plano.</p>' : ''}
    <div class="blocos-plano vista-${vistaPlano}">${corpo || '<p class="vazio">Nada para mostrar.</p>'}</div>
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
      if (!(x.qtd > 0)) continue;   // a pessoa zerou: não planta
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
  // Digitou uma quantidade e clicou (ou tocou) noutro botão: a caixa perde o foco ("change") no meio do clique.
  // Redesenhar ali trocaria o botão por outro e o clique se perderia. Então:
  //  - o número é guardado a cada tecla (input), sem redesenhar;
  //  - se o "change" vem no meio de um clique/toque, redesenha só depois que o clique chega.
  let clicando = false, pendente = null;
  modal.addEventListener('pointerdown', ev => { if (!ev.target.matches?.('.qtd-plano')) clicando = true; }, true);
  document.addEventListener('pointercancel', () => { clicando = false; }, true);   // o toque virou rolagem
  const redesenharJa = () => { clearTimeout(pendente); pendente = null; if (propostaPlano) renderModalPlano(); };
  document.addEventListener('click', () => {
    clicando = false;
    if (pendente) setTimeout(redesenharJa, 0);   // depois que o clique fez o que tinha de fazer
  }, true);
  const redesenharQtd = () => {
    if (!clicando) { redesenharJa(); return; }   // saiu da caixa pelo teclado
    clearTimeout(pendente);
    pendente = setTimeout(redesenharJa, 1500);   // se o clique não vier
  };
  const guardarQtd = caixa => {
    const [zi, j] = caixa.dataset.qtdPlano.split(':').map(Number);
    const x = propostaPlano.zonas[zi].novas[j];
    x.qtd = Math.max(0, Math.floor(Number(caixa.value) || 0));
    x.area = x.qtd * areaDePe(x.p);
    propostaPlano.editadas[chaveEditada(propostaPlano.zonas[zi], x)] = x.qtd;
  };
  modal.addEventListener('input', ev => { if (ev.target.dataset.qtdPlano !== undefined && ev.target.value !== '') guardarQtd(ev.target); });
  modal.addEventListener('click', ev => {
    if (ev.target === modal) { fecharPlano(); return; }
    const acao = ev.target.closest('[data-plano]')?.dataset.plano;
    const tirar = ev.target.closest('[data-tirar-planta]');
    if (tirar) { tirarDoPlano(tirar.dataset.tirarPlanta, true); return; }
    const voltar = ev.target.closest('[data-voltar-planta]');
    if (voltar) { tirarDoPlano(voltar.dataset.voltarPlanta, false); return; }
    const vb = ev.target.closest('[data-vista-plano]');
    if (vb) { vistaPlano = vb.dataset.vistaPlano; renderModalPlano(); return; }
    if (ev.target.closest('[data-ano-todo]')) {
      const r = alternarAnoTodo(opcoesPlano.mesesSel, opcoesPlano.mesesAntes, propostaPlano.inicio);
      opcoesPlano.mesesSel = r.sel; opcoesPlano.mesesAntes = r.antes;
      regerarPlano(); return;
    }
    const mesB = ev.target.closest('[data-mes-plano]');
    if (mesB) {
      const m = Number(mesB.dataset.mesPlano);
      if (opcoesPlano.mesesSel.has(m)) opcoesPlano.mesesSel.delete(m); else opcoesPlano.mesesSel.add(m);
      opcoesPlano.mesesAntes = null;   // escolheu à mão: "Ano todo" recomeça daqui
      regerarPlano(); return;
    }
    const tipo = ev.target.closest('[data-tipo-plano]')?.dataset.tipoPlano;
    if (tipo) {
      if (opcoesPlano.grupos.has(tipo)) opcoesPlano.grupos.delete(tipo); else opcoesPlano.grupos.add(tipo);
      regerarPlano(); return;
    }
    if (acao === 'cancelar') fecharPlano();
    else if (acao === 'outra') { propostaPlano.semente = novaSemente(); propostaPlano.editadas = {}; regerarPlano(); }
    else if (acao === 'aplicar') aplicarPlano();
  });
  modal.addEventListener('change', ev => {
    const op = ev.target.dataset.op;
    if (op === 'manter' || op === 'lista' || op === 'repetir') { opcoesPlano[op] = ev.target.checked; regerarPlano(); }
    else if (ev.target.matches('[data-plano-pessoas]')) { definirPerfil({ pessoas: Math.max(1, Math.min(30, Math.round(Number(ev.target.value) || 1))) }); regerarPlano(); }
    else if (ev.target.matches('[data-plano-objetivo]')) { definirPerfil({ objetivo: ev.target.value }); regerarPlano(); }
    else if (ev.target.matches('[data-plano-sobra]')) { opcoesPlano.sobra = ev.target.value; regerarPlano(); }
    else if (ev.target.dataset.qtdPlano !== undefined) {
      // só muda a quantidade (não sorteia de novo)
      guardarQtd(ev.target);
      redesenharQtd();
    }
    else if (ev.target.dataset.aplicarZona !== undefined) {
      const r = propostaPlano.zonas[Number(ev.target.dataset.aplicarZona)];
      r.aplicar = ev.target.checked;
      if (r.aplicar) propostaPlano.fora.delete(r.zona.id); else propostaPlano.fora.add(r.zona.id);
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
