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
}

function atualizarArquivo() {
  const box = $('projetosGuardados');
  if (box) box.innerHTML = htmlProjetos();
}

// ---------------------------------------------------------------------
//  Boas-vindas (passo a passo)
// ---------------------------------------------------------------------

const novo = { passo: 0, nome: 'Minha Horta', largura: 8, comprimento: 10, local: null, busca: '', resultados: [], buscando: false, pessoas: 2, objetivo: 'fresco' };

function abrirBoasVindas() {
  Object.assign(novo, { passo: 0, nome: 'Minha Horta', largura: 8, comprimento: 10, local: null, busca: '', resultados: [], pessoas: 2, objetivo: 'fresco' });
  $('modalInicio').classList.remove('oculto');
  renderBoasVindas();
}

function renderBoasVindas() {
  const passos = ['Boas-vindas', 'Nome', 'Lugar', 'Tamanho', 'Quem come'];
  const barra = novo.passo ? `<div class="passos-barra">${passos.slice(1).map((p, i) =>
    `<span class="${i + 1 === novo.passo ? 'atual' : i + 1 < novo.passo ? 'feito' : ''}">${i + 1}. ${p}</span>`).join('')}</div>` : '';
  let corpo = '';
  if (novo.passo === 0) {
    corpo = `<div class="bv-logo">🌱</div>
      <h2>Boas-vindas à Minha Horta</h2>
      <p>Um app para desenhar a sua horta, descobrir quanto sol cada canteiro recebe, escolher o que plantar e quando — mês a mês.</p>
      <div class="bv-escolhas">
        <button class="principal grande" data-bv="comecar">🌱 Começar uma horta nova</button>
        <button class="grande" data-bv="exemplo">👀 Ver um exemplo pronto</button>
      </div>
      ${lerProjetos().length ? '<p class="nota">Você tem projetos guardados — abra pelo menu ☰, no canto de cima.</p>' : ''}`;
  } else if (novo.passo === 1) {
    corpo = `<h2>Como vamos chamar a sua horta?</h2>
      <input class="bv-campo" data-bv-campo="nome" value="${escapar(novo.nome)}" placeholder="Ex.: Horta do quintal">`;
  } else if (novo.passo === 2) {
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
  } else if (novo.passo === 3) {
    corpo = `<h2>Qual o tamanho do terreno?</h2>
      <p class="nota">O espaço todo onde a horta vai ficar (dá para mudar depois). Cada quadradinho do mapa vale 20 cm.</p>
      <div class="bv-linha grande-txt">
        <label>Largura <input class="bv-campo curto" data-bv-campo="largura" value="${fmt(novo.largura, 1)}"> m</label>
        <span>×</span>
        <label>Comprimento <input class="bv-campo curto" data-bv-campo="comprimento" value="${fmt(novo.comprimento, 1)}"> m</label>
      </div>
      <div class="bv-ok">= ${fmt(novo.largura * novo.comprimento, 1)} m²</div>`;
  } else if (novo.passo === 4) {
    corpo = `<h2>Quem vai comer da horta?</h2>
      <p class="nota">Com isso o app sugere quantas plantas de cada tipo — e não quantas cabem. Dá para mudar depois no menu ☰ → Perfil da horta.</p>
      <div class="perfil-horta form">${htmlCamposPerfil({ pessoas: novo.pessoas, objetivo: novo.objetivo }, 'bv')}</div>`;
  }
  const navegacao = novo.passo ? `<div class="bv-nav">
      <button data-bv="voltar">‹ Voltar</button>
      ${novo.passo === 2 && !novo.local ? '<button data-bv="pular" class="link">Pular por enquanto</button>' : ''}
      <button class="principal" data-bv="${novo.passo === 4 ? 'criar' : 'avancar'}" ${novo.passo === 2 && !novo.local ? 'disabled' : ''}>${novo.passo === 4 ? '✓ Criar minha horta' : 'Continuar ›'}</button>
    </div>` : '';
  $('inicioCaixa').innerHTML = barra + corpo + navegacao;
  const campo = $('inicioCaixa').querySelector('.bv-campo');
  if (campo && novo.passo !== 2) setTimeout(() => campo.focus(), 30);
}

async function buscarCidade() {
  if (!novo.busca.trim()) return;
  novo.buscando = true; renderBoasVindas();
  try {
    const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(novo.busca.trim())}&count=6&language=pt&format=json`);
    const j = await r.json();
    novo.resultados = j.results || [];
    if (!novo.resultados.length) avisar('Não achei essa cidade. Tente outro nome ou use a localização.');
  } catch (_) { avisar('Sem conexão para buscar a cidade. Use a localização ou digite as coordenadas.'); }
  novo.buscando = false; renderBoasVindas();
}

function criarHortaNova() {
  if (estado.zonas.length || estado.diario.length) guardarProjetoAtual();
  const e = estadoVazio({ nome: novo.nome.trim() || 'Minha Horta', largura: novo.largura, comprimento: novo.comprimento, local: novo.local });
  e.perfil = { pessoas: novo.pessoas, objetivo: novo.objetivo };
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
    if (ev.key !== 'Enter') return;
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
    { id: 'canteiros', feito: plantaveis.length > 0, texto: '✏️ Desenhe os canteiros', ir: 'desenho' },
    { id: 'norte', feito: estado.norteDefinido, texto: '🧭 Mostre onde fica o norte', ir: 'sol' },
    { id: 'sombra', feito: estado.objetos.length > 0 || estado.inicio?.semArvores, texto: '🌳 Marque árvores e construções que fazem sombra', ir: 'sol', semArvores: true },
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
