'use strict';

// =====================================================================
//  Minha Horta — Começo: boas-vindas para quem está começando,
//  "Primeiros passos" e projetos guardados.
//  (estadoVazio é usado por app.js na primeira vez que o app abre)
// =====================================================================

const CHAVE_PROJETOS = 'horta.projetos.v1';

// Uma horta nova, vazia
function estadoVazio({ nome = 'Minha Horta', largura = 10, comprimento = 10, local = null } = {}) {
  const cols = Math.max(5, Math.round(largura * 5)), rows = Math.max(5, Math.round(comprimento * 5));
  return {
    versao: 4, nome, tamanhoCelulaCm: 20, cols, rows,
    celulas: new Array(cols * rows).fill(0), sombra: new Array(cols * rows).fill(0),
    zonas: [], proximoId: 1, objetos: [], proximoObjId: 1,
    local: local || { nome: '', lat: -23.55, lon: -46.63, definido: false },
    norteGraus: 0, norteDefinido: false,
    plantasEditadas: {}, minhaLista: [], grupos: [], proximoGrupoId: 1, diario: [],
    clima: { ativo: false },
    inicio: { passos: true, semArvores: false },
    perfil: { pessoas: 2, objetivo: 'fresco' },
  };
}

// ---------------------------------------------------------------------
//  Projetos guardados (ficam neste navegador)
// ---------------------------------------------------------------------

function lerProjetos() {
  try { return JSON.parse(localStorage.getItem(CHAVE_PROJETOS)) || []; } catch (_) { return []; }
}
function gravarProjetos(lista) {
  try { localStorage.setItem(CHAVE_PROJETOS, JSON.stringify(lista)); return true; } catch (_) { return false; }
}
function guardarProjetoAtual() {
  const lista = lerProjetos();
  lista.unshift({ id: 'p' + Date.now().toString(36), nome: estado.nome || 'Minha Horta', data: hojeISO(), areas: estado.zonas.length, estado });
  return gravarProjetos(lista.slice(0, 10));
}

function htmlProjetos() {
  const lista = lerProjetos();
  if (!lista.length) return '';
  return `<div class="rotulo" style="margin-top:12px">Projetos guardados</div>
    <ul class="lista-projetos">${lista.map(p => `<li>
      <span><b>${escapar(p.nome)}</b><br><span class="nota">guardado em ${dataBR(p.data)} · ${p.areas} áreas</span></span>
      <button class="pequeno" data-projeto="abrir" data-id="${p.id}">Abrir</button>
      <button class="pequeno perigo" data-projeto="apagar" data-id="${p.id}" title="Apagar este projeto guardado">×</button>
    </li>`).join('')}</ul>`;
}

async function abrirProjetoGuardado(id) {
  const lista = lerProjetos();
  const p = lista.find(x => x.id === id);
  if (!p) return;
  if (!(await perguntar({ titulo: `Abrir “${p.nome}”?`, texto: 'A horta atual será guardada na lista de projetos antes, para não perder nada.', ok: 'Abrir' }))) return;
  guardarProjetoAtual();
  gravarProjetos(lerProjetos().filter(x => x.id !== id));
  trocarDeProjeto(migrar(p.estado));
  avisar(`“${p.nome}” aberto.`);
}

async function apagarProjetoGuardado(id) {
  const p = lerProjetos().find(x => x.id === id);
  if (!p) return;
  if (!(await perguntar({ titulo: `Apagar “${p.nome}”?`, texto: 'Este projeto guardado será apagado de vez (não dá para desfazer). Se quiser, exporte o arquivo antes.', ok: 'Apagar de vez', perigo: true }))) return;
  gravarProjetos(lerProjetos().filter(x => x.id !== id));
  atualizarArquivo();
}

function trocarDeProjeto(novo) {
  descartarAlturaRapida();
  estado = novo;
  historico = []; futuro = [];
  zonaAtiva = null; objetoAtivo = null; posicionando = null;
  editandoDesenho = false;
  try { localStorage.removeItem(CHAVE_CLIMA); } catch (_) { /* nada */ }
  previsao = null;
  trocarModo('mapa');
  aplicarVisibilidadeModo();
  montarFerramentas();
  mudou();
  ajustar();
  nuvemTrocouDeProjeto();   // outra horta: liga (ou desliga) a horta compartilhada
}

function atualizarArquivo() {
  const box = $('projetosGuardados');
  if (box) box.innerHTML = htmlProjetos();
}

// ---------------------------------------------------------------------
//  Boas-vindas (passo a passo)
// ---------------------------------------------------------------------

// Os passos, na ordem (o primeiro é a tela de boas-vindas, sem número)
const PASSOS_BV = [
  { id: 'inicio', nome: 'Boas-vindas' }, { id: 'nome', nome: 'Nome' }, { id: 'lugar', nome: 'Lugar' },
  { id: 'norte', nome: 'Norte' }, { id: 'tamanho', nome: 'Tamanho' }, { id: 'perfil', nome: 'Quem come' },
];
const RUMOS = [
  { g: 0, nome: 'Norte' }, { g: 45, nome: 'Nordeste' }, { g: 90, nome: 'Leste' }, { g: 135, nome: 'Sudeste' },
  { g: 180, nome: 'Sul' }, { g: 225, nome: 'Sudoeste' }, { g: 270, nome: 'Oeste' }, { g: 315, nome: 'Noroeste' },
];
// onde o norte aparece no mapa, para cada ângulo de estado.norteGraus
const LADO_DO_MAPA = { 0: 'em cima', 45: 'em cima, à direita', 90: 'à direita', 135: 'embaixo, à direita', 180: 'embaixo', 225: 'embaixo, à esquerda', 270: 'à esquerda', 315: 'em cima, à esquerda' };

// Quem olha para o "topo" do mapa e está virado para o rumo g (graus a partir do norte, no sentido do relógio)
// tem o norte girado (360 − g) no mapa — o mesmo ângulo de estado.norteGraus (90 = norte à direita).
const norteDoMapa = g => (360 - g) % 360;

// A busca de cidades às vezes devolve o mesmo nome duas vezes (a cidade e um bairro ou distrito): fica só o primeiro
function semCidadesRepetidas(lista) {
  const vistas = new Set();
  return (lista || []).filter(r => {
    const k = [r.name, r.admin1, r.country].map(s => String(s || '').toLowerCase()).join('|');
    if (vistas.has(k)) return false;
    vistas.add(k); return true;
  });
}

const novo = { passo: 0 };
function abrirBoasVindas() {
  Object.assign(novo, { passo: 0, nome: 'Minha Horta', largura: 8, comprimento: 10, local: null, busca: '', resultados: [], buscando: false, rumo: null, pessoas: 2, objetivo: 'fresco' });
  $('modalInicio').classList.remove('oculto');
  renderBoasVindas();
}

// Um terreno visto de cima, com a seta do norte já girada
function htmlTerrenoComNorte(norte) {
  return `<svg class="bv-terreno" viewBox="0 0 120 120" aria-hidden="true">
    <rect x="20" y="20" width="80" height="80" rx="4" fill="#e9f5db" stroke="#8aa36b" stroke-width="2"/>
    <text x="60" y="14" text-anchor="middle" font-size="9" fill="#6b6b6b">topo da tela</text>
    ${norte == null ? '<text x="60" y="64" text-anchor="middle" font-size="22" fill="#b5b5a8">?</text>' :
      `<g transform="rotate(${norte} 60 60)"><path d="M60 34 L68 66 L60 60 L52 66 Z" fill="#e03131"/>
        <text x="60" y="28" text-anchor="middle" font-size="13" font-weight="700" fill="#e03131" transform="rotate(${-norte} 60 24)">N</text></g>`}
  </svg>`;
}

function renderBoasVindas() {
  const passo = PASSOS_BV[novo.passo].id, ultimo = novo.passo === PASSOS_BV.length - 1;
  const barra = novo.passo ? `<div class="passos-barra">${PASSOS_BV.slice(1).map((p, i) =>
    `<span class="${i + 1 === novo.passo ? 'atual' : i + 1 < novo.passo ? 'feito' : ''}">${i + 1}. ${p.nome}</span>`).join('')}</div>` : '';
  // passos que pedem uma resposta (ou "Pular por enquanto")
  const falta = (passo === 'lugar' && !novo.local) || (passo === 'norte' && novo.rumo == null);
  let corpo = '';
  if (passo === 'inicio') {
    corpo = `<div class="bv-logo">🌱</div>
      <h2>Boas-vindas à Minha Horta</h2>
      <p>Um app para desenhar a sua horta, descobrir quanto sol cada canteiro recebe, escolher o que plantar e quando — mês a mês.</p>
      <div class="bv-escolhas">
        <button class="principal grande" data-bv="comecar">🌱 Começar uma horta nova</button>
        <button class="grande" data-bv="exemplo">👀 Ver um exemplo pronto</button>
      </div>
      ${lerProjetos().length ? '<p class="nota">Você tem projetos guardados — abra pelo menu ☰, no canto de cima.</p>' : ''}`;
  } else if (passo === 'nome') {
    corpo = `<h2>Como vamos chamar a sua horta?</h2>
      <input class="bv-campo" data-bv-campo="nome" value="${escapar(novo.nome)}" placeholder="Ex.: Horta do quintal">`;
  } else if (passo === 'lugar') {
    const l = novo.local;
    corpo = `<h2>Onde fica a horta?</h2>
      <p class="nota">Com isso o app sabe o clima, a época de plantar e por onde o sol passa.</p>
      <div class="bv-linha">
        <input class="bv-campo" data-bv-campo="busca" value="${escapar(novo.busca)}" placeholder="Cidade (ex.: Piraquara)">
        <button data-bv="buscar" ${novo.buscando ? 'disabled' : ''}>${novo.buscando ? 'Buscando…' : '🔍 Buscar'}</button>
      </div>
      <p class="nota">A busca envia só o nome da cidade para o open-meteo.com.</p>
      ${novo.resultados.length ? `<ul class="bv-resultados">${novo.resultados.map((r, i) => `<li><button data-bv="escolher" data-i="${i}">
        📍 <b>${escapar(r.name)}</b>${r.admin1 ? `, ${escapar(r.admin1)}` : ''} — ${escapar(r.country || '')}</button></li>`).join('')}</ul>` : ''}
      <div class="bv-linha"><button data-bv="gps">📍 Usar minha localização</button>
        <span class="nota">ou digite:</span>
        <input class="bv-campo curto" data-bv-campo="lat" placeholder="latitude" value="${l ? l.lat : ''}">
        <input class="bv-campo curto" data-bv-campo="lon" placeholder="longitude" value="${l ? l.lon : ''}">
      </div>
      ${l ? `<div class="bv-ok">✓ ${escapar(l.nome || 'Local definido')} (${fmt(l.lat, 2)}, ${fmt(l.lon, 2)}) — hemisfério ${l.lat < 0 ? 'sul' : 'norte'}</div>` : ''}`;
  } else if (passo === 'norte') {
    const sul = !novo.local || novo.local.lat < 0;
    const r = RUMOS.find(x => x.g === novo.rumo);
    corpo = `<h2>Para que lado fica a horta?</h2>
      <p class="nota">No app você vê a horta <b>de cima</b>, como num mapa. Sabendo onde fica o norte, o app calcula por onde o sol passa e onde cai a sombra.</p>
      <div class="bv-norte">
        ${htmlTerrenoComNorte(r ? norteDoMapa(r.g) : null)}
        <ol class="bv-norte-passos">
          <li>Escolha um lado do terreno para ficar no <b>topo da tela</b> (por exemplo, o muro do fundo).</li>
          <li>Fique de frente para esse lado e abra a <b>bússola</b> do celular.</li>
          <li>Toque abaixo no lado para onde você está olhando:</li>
        </ol>
      </div>
      <div class="bv-rumos">${RUMOS.map(x => `<button data-bv="rumo" data-g="${x.g}" class="${x.g === novo.rumo ? 'escolhido' : ''}">${x.nome}</button>`).join('')}</div>
      <p class="nota">Sem bússola? O sol nasce do lado <b>leste</b> e, ao meio-dia, fica mais para o lado <b>${sul ? 'norte' : 'sul'}</b>. Dá para acertar depois, no desenho.</p>
      ${r ? `<div class="bv-ok">✓ O topo da tela fica para o <b>${r.nome.toLowerCase()}</b> — no mapa, o norte vai ficar <b>${LADO_DO_MAPA[norteDoMapa(r.g)]}</b>.</div>` : ''}`;
  } else if (passo === 'tamanho') {
    corpo = `<h2>Qual o tamanho do terreno todo?</h2>
      <p class="bv-destaque">📐 É o <b>espaço todo</b> onde a horta vai ficar — <b>não</b> o tamanho de um canteiro.
        Os canteiros, caminhos e muros você desenha depois, dentro dele. Árvores e construções podem ficar até fora.</p>
      <p class="nota">Dá para mudar depois. Cada quadradinho do mapa vale 20 cm.</p>
      <div class="bv-linha grande-txt">
        <label>Largura <input class="bv-campo curto" data-bv-campo="largura" value="${fmt(novo.largura, 1)}"> m</label>
        <span>×</span>
        <label>Comprimento <input class="bv-campo curto" data-bv-campo="comprimento" value="${fmt(novo.comprimento, 1)}"> m</label>
      </div>
      <div class="bv-ok">= ${fmt(novo.largura * novo.comprimento, 1)} m²</div>`;
  } else if (passo === 'perfil') {
    corpo = `<h2>Quem vai comer da horta?</h2>
      <p class="nota">Com isso o app sugere quantas plantas de cada tipo — e não quantas cabem. Dá para mudar depois no menu ☰ → Perfil da horta.</p>
      <div class="perfil-horta form">${htmlCamposPerfil({ pessoas: novo.pessoas, objetivo: novo.objetivo }, 'bv')}</div>`;
  }
  const navegacao = novo.passo ? `<div class="bv-nav">
      <button data-bv="voltar">‹ Voltar</button>
      ${falta ? '<button data-bv="pular" class="link">Pular por enquanto</button>' : ''}
      <button class="principal" data-bv="${ultimo ? 'criar' : 'avancar'}" ${falta ? 'disabled' : ''}>${ultimo ? '✓ Criar minha horta' : 'Continuar ›'}</button>
    </div>` : '';
  $('inicioCaixa').innerHTML = barra + corpo + navegacao;
  const campo = $('inicioCaixa').querySelector('.bv-campo');
  if (campo && passo !== 'lugar') setTimeout(() => campo.focus(), 30);
}

async function buscarCidade() {
  if (!novo.busca.trim()) return;
  novo.buscando = true; renderBoasVindas();
  try {
    const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(novo.busca.trim())}&count=10&language=pt&format=json`);
    const j = await r.json();
    novo.resultados = semCidadesRepetidas(j.results).slice(0, 6);
    if (!novo.resultados.length) avisar('Não achei essa cidade. Tente outro nome ou use a localização.');
  } catch (_) { avisar('Sem conexão para buscar a cidade. Use a localização ou digite as coordenadas.'); }
  novo.buscando = false; renderBoasVindas();
}

// A horta nova a partir das respostas das boas-vindas
function hortaDasRespostas(r) {
  const e = estadoVazio({ nome: r.nome.trim() || 'Minha Horta', largura: r.largura, comprimento: r.comprimento, local: r.local });
  e.perfil = { pessoas: r.pessoas, objetivo: r.objetivo };
  if (r.rumo != null) { e.norteGraus = norteDoMapa(r.rumo); e.norteDefinido = true; }
  return e;
}

function criarHortaNova() {
  if (estado.zonas.length || estado.diario.length) guardarProjetoAtual();
  const e = hortaDasRespostas(novo);
  $('modalInicio').classList.add('oculto');
  trocarDeProjeto(migrar(e));
  alternarDesenho(true);
  avisar('Horta criada! Comece desenhando os canteiros: arraste no terreno.');
}

function montarBoasVindas() {
  const caixa = $('inicioCaixa');
  caixa.addEventListener('change', ev => {
    if (ev.target.matches('[data-bv-pessoas]')) novo.pessoas = Math.max(1, Math.min(30, Math.round(Number(ev.target.value) || 1)));
    if (ev.target.matches('[data-bv-objetivo]')) { novo.objetivo = ev.target.value; renderBoasVindas(); }
  });
  caixa.addEventListener('input', ev => {
    const k = ev.target.dataset.bvCampo;
    if (!k) return;
    const v = ev.target.value;
    if (k === 'nome' || k === 'busca') novo[k] = v;
    else {
      const n = Number(v.replace(',', '.'));
      if (!Number.isFinite(n)) return;
      if (k === 'largura' || k === 'comprimento') { novo[k] = Math.min(100, Math.max(1, n)); caixa.querySelector('.bv-ok').textContent = `= ${fmt(novo.largura * novo.comprimento, 1)} m²`; }
      if (k === 'lat' || k === 'lon') {
        const lat = Number((caixa.querySelector('[data-bv-campo="lat"]').value || '').replace(',', '.'));
        const lon = Number((caixa.querySelector('[data-bv-campo="lon"]').value || '').replace(',', '.'));
        if (Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 66 && Math.abs(lon) <= 180 && caixa.querySelector('[data-bv-campo="lon"]').value) {
          const tinha = !!novo.local;
          novo.local = { nome: '', lat, lon, definido: true };
          if (!tinha) renderBoasVindas();
        }
      }
    }
  });
  caixa.addEventListener('keydown', ev => {
    if (ev.key !== 'Enter' || ev.target.matches('button')) return;   // num botão, o Enter já é o clique dele
    if (ev.target.dataset.bvCampo === 'busca') buscarCidade();
    else caixa.querySelector('[data-bv="avancar"], [data-bv="criar"]')?.click();
  });
  caixa.addEventListener('click', ev => {
    const b = ev.target.closest('[data-bv]');
    if (!b || b.disabled) return;
    const a = b.dataset.bv;
    if (a === 'comecar') { novo.passo = 1; renderBoasVindas(); }
    else if (a === 'exemplo') {
      if (estado.zonas.length || estado.diario.length) guardarProjetoAtual();
      $('modalInicio').classList.add('oculto');
      const ex = migrar(criarExemploHorta());
      ex.local = { nome: 'Piraquara, PR', lat: -25.44, lon: -49.06, definido: true };
      ex.nome = 'Horta de exemplo';
      trocarDeProjeto(ex);
      avisar('Este é um exemplo. Para começar a sua, use “Novo projeto” no menu ☰.');
    }
    else if (a === 'voltar') { novo.passo = Math.max(0, novo.passo - 1); renderBoasVindas(); }
    else if (a === 'avancar' || a === 'pular') { novo.passo++; renderBoasVindas(); }
    else if (a === 'buscar') buscarCidade();
    else if (a === 'rumo') { novo.rumo = Number(b.dataset.g); renderBoasVindas(); caixa.querySelector('[data-bv="avancar"]')?.focus(); }
    else if (a === 'escolher') {
      const r = novo.resultados[Number(b.dataset.i)];
      novo.local = { nome: [r.name, r.admin1].filter(Boolean).join(', '), lat: Number(r.latitude.toFixed(3)), lon: Number(r.longitude.toFixed(3)), definido: true };
      novo.resultados = [];
      renderBoasVindas();
    }
    else if (a === 'gps') {
      if (!navigator.geolocation) { avisar('Este navegador não informa a localização.'); return; }
      navigator.geolocation.getCurrentPosition(pos => {
        novo.local = { nome: '', lat: Number(pos.coords.latitude.toFixed(3)), lon: Number(pos.coords.longitude.toFixed(3)), definido: true };
        renderBoasVindas();
      }, () => avisar('Não foi possível obter a localização. Busque pela cidade ou digite as coordenadas.'));
    }
    else if (a === 'criar') criarHortaNova();
  });

  // Painel Arquivo: novo projeto e projetos guardados
  $('btnNovoProjeto').onclick = async () => {
    if (!(await perguntar({ titulo: 'Começar um projeto novo?', texto: 'A horta atual fica guardada em “Projetos guardados” (dá para abrir de novo quando quiser). Depois você responde algumas perguntas para criar a nova.', ok: 'Começar projeto novo' }))) return;
    abrirBoasVindas();
  };
  document.addEventListener('click', ev => {
    const b = ev.target.closest('[data-projeto]');
    if (!b) return;
    if (b.dataset.projeto === 'abrir') abrirProjetoGuardado(b.dataset.id);
    if (b.dataset.projeto === 'apagar') apagarProjetoGuardado(b.dataset.id);
  });
  atualizarArquivo();
}

// ---------------------------------------------------------------------
//  Primeiros passos
// ---------------------------------------------------------------------

function passosIniciais() {
  const plantaveis = estado.zonas.filter(z => TIPOS_PLANTAVEIS.includes(z.tipo));
  return [
    { id: 'local', feito: estado.local.definido !== false, texto: '📍 Diga onde fica a horta', ir: 'sol' },
    { id: 'norte', feito: estado.norteDefinido, texto: '🧭 Mostre onde fica o norte', ir: 'desenho' },
    { id: 'canteiros', feito: plantaveis.length > 0, texto: '✏️ Desenhe os canteiros', ir: 'desenho' },
    { id: 'sombra', feito: estado.objetos.length > 0 || estado.inicio?.semArvores, texto: '🌳 Marque árvores e construções que fazem sombra', ir: 'desenho', semArvores: true },
    { id: 'plano', feito: plantaveis.some(z => (z.plantas || []).length), texto: '🌱 Planeje os canteiros (ou use ✨ Sugerir plano)', ir: 'plano' },
    { id: 'diario', feito: estado.diario.length > 0, texto: '📔 Faça o primeiro registro no diário', ir: 'diario' },
  ];
}

function htmlPrimeirosPassos() {
  const passos = passosIniciais();
  const feitos = passos.filter(p => p.feito).length;
  // no menu ☰, "Mostrar primeiros passos" aparece só quando estão escondidos (e faltam passos)
  const btn = $('btnMostrarPassos');
  if (btn) btn.classList.toggle('oculto', !!estado.inicio?.passos || feitos === passos.length);
  if (!estado.inicio?.passos) return '';
  if (feitos === passos.length) return '';
  const proximo = passos.find(p => !p.feito);
  return `<section class="primeiros-passos">
    <h2><span>Primeiros passos <span class="qtd">${feitos} de ${passos.length}</span></span>
      <button class="fechar-passos" data-passo="fechar" title="Esconder os primeiros passos (dá para ver de novo no menu ☰)">Esconder ×</button></h2>
    <div class="barra-passos"><span style="width:${Math.round(feitos / passos.length * 100)}%"></span></div>
    <ul>${passos.map(p => `<li class="${p.feito ? 'feito' : ''} ${p === proximo ? 'proximo' : ''}">
      <span>${p.feito ? '✅' : p === proximo ? '👉' : '⬜'}</span>
      <span>${p.texto}${p === proximo && p.semArvores ? ' <button class="link" data-passo="semArvores">não tenho</button>' : ''}</span>
      ${!p.feito ? `<button class="pequeno" data-passo="ir" data-ir="${p.ir}">Ir</button>` : ''}
    </li>`).join('')}</ul>
  </section>`;
}

function montarPrimeirosPassos() {
  document.addEventListener('click', ev => {
    const b = ev.target.closest('[data-passo]');
    if (!b) return;
    const a = b.dataset.passo;
    if (a === 'fechar') {
      estado.inicio = { ...(estado.inicio || {}), passos: false }; salvar(); renderCalendario();
      avisar('Primeiros passos escondidos. Para ver de novo: menu ☰ → “Mostrar primeiros passos”.');
    }
    if (a === 'mostrar') {
      estado.inicio = { ...(estado.inicio || {}), passos: true }; salvar();
      document.querySelector('[data-menu="fechar"]')?.click();
      if (modo !== 'mapa') { trocarModo('mapa'); ajustar(); }
      zonaAtiva = null; atualizarPaineis(); desenhar();
    }
    if (a === 'semArvores') { estado.inicio = { ...(estado.inicio || {}), semArvores: true }; salvar(); renderCalendario(); }
    if (a === 'ir') {
      const ir = b.dataset.ir;
      if (ir === 'desenho') { alternarDesenho(true); return; }
      if (ir === 'plano') {
        const z = estado.zonas.find(x => TIPOS_PLANTAVEIS.includes(x.tipo));
        if (z) { zonaAtiva = z.id; atualizarPaineis(); desenhar(); avisar('Escolha plantas para este canteiro no painel à direita — ou use ✨ Sugerir plano.'); }
        return;
      }
      const antes = modo;
      trocarModo(ir);
      if (antes !== modo) ajustar();
    }
  });
}
