'use strict';

// =====================================================================
//  Minha Horta — Diário da horta: plantios, colheitas, notas, pragas e fotos
//  Os registros ficam em estado.diario; as fotos, no IndexedDB do navegador.
// =====================================================================

const TIPOS_REGISTRO = {
  semeadura: { nome: 'Semeadura na bandeja', icone: '🌰' },
  plantio:  { nome: 'Plantio',  icone: '🌱' },
  colheita: { nome: 'Colheita', icone: '🧺' },
  nota:     { nome: 'Nota',     icone: '📝' },
  praga:    { nome: 'Praga ou doença', icone: '🐛' },
  adubacao: { nome: 'Adubação', icone: '🧪' },
};
const UNIDADES = ['pés', 'kg', 'g', 'unidades', 'maços', 'células'];

const filtroDiario = { tipo: '', zona: '', planta: '', ano: '' };
let registroEditando = null;   // registro aberto no formulário (cópia)
const urlsFotos = {};          // id → object URL já carregada

const hojeISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const dataBR = iso => { const [a, m, d] = iso.split('-'); return `${d}/${m}/${a}`; };
const diasEntre = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

// ---------------------------------------------------------------------
//  Fotos (IndexedDB)
// ---------------------------------------------------------------------

function bancoFotos() {
  return new Promise((ok, erro) => {
    const r = indexedDB.open('horta-fotos', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('fotos');
    r.onsuccess = () => ok(r.result);
    r.onerror = () => erro(r.error);
  });
}
async function guardarFoto(id, blob) {
  const db = await bancoFotos();
  await new Promise((ok, erro) => {
    const tx = db.transaction('fotos', 'readwrite');
    tx.objectStore('fotos').put(blob, id);
    tx.oncomplete = ok; tx.onerror = () => erro(tx.error);
  });
}
async function lerFoto(id) {
  const db = await bancoFotos();
  return new Promise((ok, erro) => {
    const r = db.transaction('fotos').objectStore('fotos').get(id);
    r.onsuccess = () => ok(r.result || null); r.onerror = () => erro(r.error);
  });
}
// Reduz a foto (celular/iPad tiram fotos enormes) para ~1280 px em JPEG
function reduzirFoto(arquivo, max = 1280) {
  return new Promise((ok, erro) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      c.toBlob(b => (b ? ok(b) : erro(new Error('foto'))), 'image/jpeg', 0.82);
    };
    img.onerror = () => erro(new Error('foto'));
    img.src = URL.createObjectURL(arquivo);
  });
}
async function carregarFotosVisiveis() {
  for (const el of document.querySelectorAll('img[data-foto]:not([src])')) {
    const id = el.dataset.foto;
    try {
      if (!urlsFotos[id]) { const b = await lerFoto(id); if (b) urlsFotos[id] = URL.createObjectURL(b); }
      if (urlsFotos[id]) el.src = urlsFotos[id]; else el.remove();
    } catch (_) { el.remove(); }
  }
}

// ---------------------------------------------------------------------
//  Registros
// ---------------------------------------------------------------------

function novoRegistro(d) {
  return { id: 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), data: hojeISO(), tipo: 'nota',
    zona: null, planta: null, qtd: null, unidade: 'pés', texto: '', foto: false, ...d };
}

function salvarRegistro(r) {
  registrar();
  const i = estado.diario.findIndex(x => x.id === r.id);
  if (i >= 0) estado.diario[i] = r; else estado.diario.push(r);
  mudou();
}

// Registro rápido a partir das tarefas do mês
async function registrarRapido(tipo, zonaId, entrada) {
  const z = zonaPorId(zonaId);
  const id = idDaEntrada(entrada);
  if (!z || !id) return;
  let qtd = z.qtd?.[entrada] || null, unidade = 'pés';
  if (tipo === 'semeadura') {
    const an = analiseHorta();
    const e = (an.entradasPorZona[z.id] || []).find(x => x.entrada === entrada);
    qtd = e && e.p ? celulasPara(pesDaEntrada(an, z, e)) : null;
    unidade = 'células';
  }
  if (tipo === 'colheita') {
    const resp = await perguntar({ titulo: `Colheita de ${nomePlanta(id)}`, texto: 'Quanto você colheu? Ex.: 2 kg, 500 g, 15 unidades, 3 maços — ou deixe em branco.', ok: 'Registrar', campo: { placeholder: 'ex.: 2 kg' } });
    if (resp === null) return;
    const m = resp.trim().replace(',', '.').match(/^([\d.]+)\s*(kg|g|unidades?|un|maços?|pés?)?/i);
    qtd = m ? Number(m[1]) : null;
    const u = (m?.[2] || 'unidades').toLowerCase();
    unidade = u.startsWith('kg') ? 'kg' : u === 'g' ? 'g' : u.startsWith('ma') ? 'maços' : u.startsWith('p') ? 'pés' : 'unidades';
  }
  salvarRegistro(novoRegistro({ tipo, zona: z.id, planta: id, entrada, qtd, unidade }));
  avisar(`${TIPOS_REGISTRO[tipo].icone} Registrado no diário: ${nomePlanta(id)} — ${z.nome}. (Ctrl+Z desfaz)`);
}

// Já existe registro deste tipo para esta planta/área no mês m do ano atual?
function feitoNoMes(tipo, zonaId, id, m) {
  const ano = new Date().getFullYear();
  return estado.diario.some(r => r.tipo === tipo && r.zona === zonaId && r.planta === id &&
    Number(r.data.slice(0, 4)) === ano && Number(r.data.slice(5, 7)) === m);
}

// Quantos dias, na prática, do plantio até a primeira colheita (para corrigir o catálogo)
function diasReaisAteColheita(id) {
  const res = [];
  const plantios = estado.diario.filter(r => r.tipo === 'plantio' && r.planta === id);
  for (const pl of plantios) {
    const col = estado.diario.filter(r => r.tipo === 'colheita' && r.planta === id && r.zona === pl.zona && r.data > pl.data)
      .sort((a, b) => a.data.localeCompare(b.data))[0];
    if (col) { const d = diasEntre(pl.data, col.data); if (d > 5 && d < 500) res.push(d); }
  }
  return res;
}

// ---------------------------------------------------------------------
//  Tela do diário
// ---------------------------------------------------------------------

function registrosFiltrados() {
  const f = filtroDiario;
  return estado.diario.filter(r =>
    (!f.tipo || r.tipo === f.tipo) && (!f.zona || String(r.zona) === f.zona) &&
    (!f.planta || r.planta === f.planta) && (!f.ano || r.data.startsWith(f.ano)))
    .sort((a, b) => b.data.localeCompare(a.data) || b.id.localeCompare(a.id));
}

function resumoColheitas(lista) {
  const tot = {};
  for (const r of lista) {
    if (r.tipo !== 'colheita' || !r.planta || !r.qtd) continue;
    const k = r.planta + '|' + r.unidade;
    tot[k] = (tot[k] || 0) + r.qtd;
  }
  return Object.entries(tot).map(([k, v]) => {
    const [id, u] = k.split('|');
    const p = plantaPorId(id);
    return `<span class="chip-total">${p ? escapar(p.emoji) : ''} ${escapar(nomePlanta(id))}: <b>${fmt(v, 2)} ${u}</b></span>`;
  }).join('');
}

function cartaoRegistro(r) {
  const t = TIPOS_REGISTRO[r.tipo] || TIPOS_REGISTRO.nota;
  const z = zonaPorId(r.zona);
  const p = r.planta ? plantaPorId(r.planta) : null;
  return `<div class="registro ${r.tipo} ${registroEditando?.id === r.id ? 'ativo' : ''}" data-registro="${r.id}">
    <div class="r-icone">${t.icone}</div>
    <div class="r-corpo">
      <div class="r-topo"><b>${dataBR(r.data)}</b> · ${t.nome}${p ? ` · ${escapar(p.emoji)} ${escapar(p.nome)}` : ''}${z ? ` · <span class="onde">${escapar(z.nome)}</span>` : ''}
        ${r.qtd ? `<span class="r-qtd">${fmt(r.qtd, 2)} ${escapar(r.unidade)}</span>` : ''}</div>
      ${r.texto ? `<div class="r-texto">${escapar(r.texto)}</div>` : ''}
    </div>
    ${r.foto ? `<img class="r-foto" data-foto="${r.id}" alt="foto" title="Clique para ampliar">` : ''}
  </div>`;
}

function renderDiario() {
  if (modo !== 'diario') return;
  // Filtros
  const anos = [...new Set(estado.diario.map(r => r.data.slice(0, 4)))].sort().reverse();
  $('dFiltros').innerHTML = `
    <div class="cats">${[['', 'Tudo'], ...Object.entries(TIPOS_REGISTRO).map(([k, t]) => [k, `${t.icone} ${t.nome}`])].map(([k, n]) =>
      `<button data-filtro-tipo="${k}" class="${filtroDiario.tipo === k ? 'ativa' : ''}">${n}</button>`).join('')}</div>
    <label>Área <select data-filtro="zona"><option value="">Todas</option>${[...estado.zonas].sort(ordemNome).map(z =>
      `<option value="${z.id}" ${filtroDiario.zona === String(z.id) ? 'selected' : ''}>${escapar(z.nome)}</option>`).join('')}</select></label>
    <label>Planta <select data-filtro="planta"><option value="">Todas</option>${[...new Set(estado.diario.map(r => r.planta).filter(Boolean))].map(id =>
      `<option value="${escapar(id)}" ${filtroDiario.planta === id ? 'selected' : ''}>${escapar(nomePlanta(id))}</option>`).join('')}</select></label>
    <label>Ano <select data-filtro="ano"><option value="">Todos</option>${anos.map(a => `<option ${filtroDiario.ano === a ? 'selected' : ''}>${a}</option>`).join('')}</select></label>`;

  // Linha do tempo
  const lista = registrosFiltrados();
  let html = '';
  const totais = resumoColheitas(lista);
  if (totais) html += `<div class="totais"><span class="rotulo">🧺 Colhido${filtroDiario.ano ? ` em ${filtroDiario.ano}` : ''}:</span> ${totais}</div>`;
  let mesAtualGrupo = '';
  for (const r of lista) {
    const g = r.data.slice(0, 7);
    if (g !== mesAtualGrupo) {
      mesAtualGrupo = g;
      html += `<h3 class="grupo">${MESES[Number(g.slice(5, 7)) - 1]} de ${g.slice(0, 4)}</h3>`;
    }
    html += cartaoRegistro(r);
  }
  if (!lista.length) {
    html += `<div class="vazio-diario"><div style="font-size:40px">📔</div>
      <p><b>O diário está vazio.</b></p>
      <p class="nota">Anote o que plantou, colheu e observou, com fotos: pelos botões ✓ das tarefas ou em “+ Novo registro”. O app usa isso na rotação de culturas e para acertar os dias até a colheita.</p></div>`;
  }
  $('areaDiario').innerHTML = html;
  carregarFotosVisiveis();
  renderFormDiario();
}

function renderFormDiario() {
  const r = registroEditando;
  const box = $('formDiario');
  if (!r) {
    box.innerHTML = `<h2>Diário</h2>
      <button class="principal" data-diario="novo" style="width:100%">+ Novo registro</button>
      <p class="nota" style="margin-top:10px">Toque num registro para editar. As fotos ficam só neste aparelho (não vão no arquivo exportado).</p>`;
    return;
  }
  const z = zonaPorId(r.zona);
  const doCanteiro = z ? idsDaZona(z) : [];
  const outras = todasPlantas().filter(p => !doCanteiro.includes(p.id)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
  box.innerHTML = `<h2>${estado.diario.some(x => x.id === r.id) ? 'Editar registro' : 'Novo registro'}</h2>
    <div class="form">
      <div class="grade2">
        <label>Data <input type="date" data-rc="data" value="${r.data}"></label>
        <label>Tipo <select data-rc="tipo">${Object.entries(TIPOS_REGISTRO).map(([k, t]) => `<option value="${k}" ${k === r.tipo ? 'selected' : ''}>${t.icone} ${t.nome}</option>`).join('')}</select></label>
      </div>
      <label>Área <select data-rc="zona"><option value="">— nenhuma —</option>${[...estado.zonas].sort(ordemNome).map(zz =>
        `<option value="${zz.id}" ${zz.id === r.zona ? 'selected' : ''}>${escapar(zz.nome)}</option>`).join('')}</select></label>
      <label>Planta <select data-rc="planta"><option value="">— nenhuma —</option>
        ${doCanteiro.length ? `<optgroup label="Neste canteiro">${doCanteiro.map(id => `<option value="${escapar(id)}" ${id === r.planta ? 'selected' : ''}>${escapar(nomePlanta(id))}</option>`).join('')}</optgroup>` : ''}
        <optgroup label="Todas">${outras.map(p => `<option value="${escapar(p.id)}" ${p.id === r.planta ? 'selected' : ''}>${escapar(p.nome)}</option>`).join('')}</optgroup>
      </select></label>
      <div class="grade2">
        <label>Quantidade <input data-rc="qtd" inputmode="decimal" value="${r.qtd ?? ''}" placeholder="opcional"></label>
        <label>Unidade <select data-rc="unidade">${UNIDADES.map(u => `<option ${u === r.unidade ? 'selected' : ''}>${u}</option>`).join('')}</select></label>
      </div>
      <label>Anotação <textarea data-rc="texto" rows="4" placeholder="O que aconteceu? Ex.: pulgões nas couves, apliquei calda de fumo…">${escapar(r.texto || '')}</textarea></label>
      <label>Foto <input type="file" accept="image/*" capture="environment" data-rc-foto></label>
      ${r.foto ? `<img class="foto-form" data-foto="${r.id}" alt="foto">` : ''}
      <div class="botoes-form">
        <button class="principal" data-diario="salvar">✓ Salvar</button>
        <button data-diario="cancelar">Cancelar</button>
        ${estado.diario.some(x => x.id === r.id) ? '<button class="perigo" data-diario="apagar">Apagar</button>' : ''}
      </div>
    </div>`;
  carregarFotosVisiveis();
}

function montarDiario() {
  const left = $('dFiltros'), area = $('areaDiario'), form = $('formDiario');
  left.addEventListener('click', ev => {
    const b = ev.target.closest('[data-filtro-tipo]');
    if (b) { filtroDiario.tipo = b.dataset.filtroTipo; renderDiario(); }
  });
  left.addEventListener('change', ev => {
    const k = ev.target.dataset.filtro;
    if (k) { filtroDiario[k] = ev.target.value; renderDiario(); }
  });
  area.addEventListener('click', ev => {
    const img = ev.target.closest('img[data-foto]');
    if (img && img.src) { window.open(img.src, '_blank'); return; }
    const c = ev.target.closest('[data-registro]');
    if (c) { registroEditando = { ...estado.diario.find(r => r.id === c.dataset.registro) }; renderDiario(); }
  });
  form.addEventListener('change', async ev => {
    const r = registroEditando;
    if (!r) return;
    const k = ev.target.dataset.rc;
    if (k) {
      const v = ev.target.value;
      if (k === 'zona') r.zona = v ? Number(v) : null;
      else if (k === 'planta') r.planta = v || null;
      else if (k === 'qtd') { const n = Number(v.replace(',', '.')); r.qtd = v && Number.isFinite(n) ? n : null; }
      else r[k] = v;
      if (k === 'tipo' && r.tipo === 'colheita' && r.unidade === 'pés') r.unidade = 'kg';
      if (k === 'zona' || k === 'tipo') renderFormDiario();
    }
    if (ev.target.matches('[data-rc-foto]') && ev.target.files[0]) {
      try {
        const blob = await reduzirFoto(ev.target.files[0]);
        await guardarFoto(r.id, blob);
        if (urlsFotos[r.id]) URL.revokeObjectURL(urlsFotos[r.id]);
        urlsFotos[r.id] = URL.createObjectURL(blob);
        r.foto = true;
        renderFormDiario();
      } catch (_) { avisar('Não consegui guardar a foto neste navegador.'); }
    }
  });
  form.addEventListener('input', ev => {
    if (registroEditando && ev.target.dataset.rc === 'texto') registroEditando.texto = ev.target.value;
  });
  form.addEventListener('click', ev => {
    const acao = ev.target.closest('[data-diario]')?.dataset.diario;
    if (acao === 'novo') { registroEditando = novoRegistro({}); renderFormDiario(); }
    else if (acao === 'cancelar') { registroEditando = null; renderDiario(); }
    else if (acao === 'salvar') { const r = registroEditando; registroEditando = null; salvarRegistro(r); }
    else if (acao === 'apagar') {
      const r = registroEditando; registroEditando = null;
      registrar(); estado.diario = estado.diario.filter(x => x.id !== r.id); mudou();
      avisar('Registro apagado. Ctrl+Z desfaz.');
    }
  });
  // Botões ✓ nas tarefas do mês
  document.addEventListener('click', ev => {
    const b = ev.target.closest('[data-registrar]');
    if (!b) return;
    ev.stopPropagation();
    registrarRapido(b.dataset.registrar, Number(b.dataset.zona), b.dataset.entrada);
  }, true);
}
