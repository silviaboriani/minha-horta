'use strict';

// =====================================================================
//  Minha Horta — Fase 3: aba Plantas (catálogo, detalhes e edição)
// =====================================================================

let plantaAtiva = 'tomate';
let editandoPlanta = false;
const filtroPlantas = { texto: '', cat: '', lista: false, mes: '', sol: '', nativas: false };

const naLista = id => estado.minhaLista.includes(id);
// Favoritos (★): os filtros “Só favoritos” só aparecem/valem quando há algum
const temFavoritos = () => estado.minhaLista.length > 0;
const mesAtual = () => new Date().getMonth() + 1;

// ---------------------------------------------------------------------
//  Montagem
// ---------------------------------------------------------------------

function montarPlantas() {
  const selMes = $('pMes');
  MESES.forEach((m, i) => {
    const o = document.createElement('option');
    o.value = i + 1;
    o.textContent = m + (i + 1 === mesAtual() ? ' (agora)' : '');
    selMes.appendChild(o);
  });

  const cats = $('pCats');
  cats.innerHTML = `<button data-cat="" class="ativa">Todas</button>` +
    Object.entries(CATEGORIAS).map(([id, c]) => `<button data-cat="${id}">${c.emoji} ${c.nome}</button>`).join('');
  cats.onclick = ev => {
    const b = ev.target.closest('[data-cat]');
    if (!b) return;
    filtroPlantas.cat = b.dataset.cat;
    renderGrade();
  };

  $('pBusca').addEventListener('input', ev => { filtroPlantas.texto = ev.target.value; renderGrade(); });
  $('pSoLista').onchange = ev => { filtroPlantas.lista = ev.target.checked; renderGrade(); };
  $('pSoNativas').onchange = ev => { filtroPlantas.nativas = ev.target.checked; renderGrade(); };
  selMes.onchange = () => { filtroPlantas.mes = selMes.value; renderGrade(); };
  $('pSol').onchange = ev => { filtroPlantas.sol = ev.target.value; renderGrade(); };
  $('pAgora').onclick = () => { filtroPlantas.mes = String(mesAtual()); selMes.value = filtroPlantas.mes; renderGrade(); };
  $('pLimpar').onclick = () => {
    Object.assign(filtroPlantas, { texto: '', cat: '', lista: false, mes: '', sol: '', nativas: false });
    $('pSoNativas').checked = false;
    $('pBusca').value = ''; $('pSoLista').checked = false; selMes.value = ''; $('pSol').value = '';
    renderGrade();
  };
  $('pNova').onclick = novaPlanta;

  // Cliques na grade de cartões
  $('areaPlantas').onclick = ev => {
    const estrela = ev.target.closest('[data-estrela]');
    if (estrela) { alternarLista(estrela.dataset.estrela); return; }
    const card = ev.target.closest('[data-id]');
    if (card) { selecionarPlanta(card.dataset.id); abrirPainelDetalhe(); }
  };

  montarDetalhe();
}

function selecionarPlanta(id) {
  if (!plantaPorId(id)) return;
  if (id !== plantaAtiva) editandoPlanta = false;
  plantaAtiva = id;
  renderGrade();
  renderDetalhe();
  const card = document.querySelector(`.card-planta[data-id="${CSS.escape(id)}"]`);
  if (card) card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function alternarLista(id) {
  registrar();
  if (naLista(id)) estado.minhaLista = estado.minhaLista.filter(x => x !== id);
  else estado.minhaLista.push(id);
  mudou();
}

function atualizarPaineisPlantas() {
  if (modo !== 'plantas') return;
  renderGrade();
  // Não redesenha o detalhe enquanto a pessoa está digitando nele
  if (!$('detalhePlanta').contains(document.activeElement)) renderDetalhe();
}

// ---------------------------------------------------------------------
//  Grade de cartões
// ---------------------------------------------------------------------

function filtrar(lista) {
  const f = filtroPlantas;
  const t = normalizar(f.texto);
  return lista.filter(p => {
    if (f.cat && p.cat !== f.cat) return false;
    if (f.lista && temFavoritos() && !naLista(p.id)) return false;
    if (f.nativas && !p.nativa) return false;
    if (f.mes && !p.sem.includes(Number(f.mes)) && !p.tr.includes(Number(f.mes))) return false;
    if (f.sol === '6' && p.sol < 6) return false;
    if (f.sol === '4' && p.sol > 4) return false;
    if (t && ![p.nome, ...(p.alias || [])].some(n => normalizar(n).includes(t))) return false;
    return true;
  });
}

function miniCalendario(p) {
  const col = mesesColheita(p);
  const agora = mesAtual();
  return MESES_LETRA.map((l, i) => {
    const m = i + 1;
    const cls = [
      p.sem.includes(m) || p.tr.includes(m) ? 's' : '',
      temMelhor(p) && mesesBons(p).includes(m) ? 'melhor' : '',
      col.includes(m) ? (ehFlor(p) ? 'f' : 'c') : '',
      m === agora ? 'agora' : '',
    ].join(' ');
    return `<span class="${cls}" title="${MESES[i]}">${l}</span>`;
  }).join('');
}

function cardPlanta(p) {
  const sol = NIVEIS_SOL[p.sol] || NIVEIS_SOL[6];
  const selos = [
    p.geada ? '<span title="Sensível a geada">❄️</span>' : '',
    p.tutor ? '<span title="Precisa de tutor ou treliça">🪜</span>' : '',
    p.perene ? '<span title="Perene (dura vários anos)">♾️</span>' : '',
  ].join('');
  return `<div class="card-planta ${p.id === plantaAtiva ? 'ativa' : ''} ${naLista(p.id) ? 'na-lista' : ''}" data-id="${escapar(p.id)}">
    <div class="c-topo">
      <span class="c-emoji">${escapar(p.emoji)}</span>
      <span class="c-nome">${escapar(p.nome)}</span>
      <button class="c-estrela" data-estrela="${escapar(p.id)}" title="${naLista(p.id) ? 'Tirar dos favoritos' : 'Marcar como favorito'}">${naLista(p.id) ? '★' : '☆'}</button>
    </div>
    <div class="c-info"><span title="${sol.desc}">${sol.icone} ${sol.nome}</span>${selos ? `<span class="c-selos">${selos}</span>` : ''}</div>
    <div class="c-origem" title="Origem: ${escapar(p.origem || '?')}">${p.nativa ? '<span class="selo-nativa">nativa do Brasil</span>' : `🌎 ${escapar(p.origem || '—')}`}</div>
    <div class="c-cal">${miniCalendario(p)}</div>
  </div>`;
}

function renderGrade() {
  if (modo !== 'plantas') return;
  document.querySelectorAll('#pCats [data-cat]').forEach(b => b.classList.toggle('ativa', b.dataset.cat === filtroPlantas.cat));
  $('pQtdLista').textContent = estado.minhaLista.length;
  $('pFiltroFav').hidden = !temFavoritos();

  const todas = todasPlantas();
  const lista = filtrar(todas);
  let html = '';

  // Nomes do mapa que não correspondem a nenhuma planta
  const desconhecidas = [...new Set(plantasNaHorta().flatMap(r => r.desconhecidas))];
  if (desconhecidas.length) {
    html += `<div class="aviso-inline">⚠️ Não reconheci estes nomes nos canteiros do mapa: <b>${desconhecidas.map(escapar).join(', ')}</b>. ` +
      `Corrija o nome na aba Mapa ou crie a planta aqui com “+ Nova planta”.</div>`;
  }

  const legendaMes = filtroPlantas.mes ? ` para semear ou plantar em <b>${MESES[filtroPlantas.mes - 1].toLowerCase()}</b>` : '';
  html += `<div class="grade-topo"><span><b>${lista.length}</b> de ${todas.length} plantas${legendaMes}</span>
    <span class="legenda-cal"><span class="s">J</span> semear/plantar <span class="c">J</span> colher <span class="f">J</span> florir</span></div>`;

  for (const [cat, c] of Object.entries(CATEGORIAS)) {
    const doGrupo = lista.filter(p => p.cat === cat).sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
    if (!doGrupo.length) continue;
    html += `<h3 class="grupo">${c.emoji} ${c.nome} <span>${doGrupo.length}</span></h3><div class="cards">${doGrupo.map(cardPlanta).join('')}</div>`;
  }
  if (!lista.length) html += '<p class="vazio" style="padding:20px">Nenhuma planta com esses filtros.</p>';
  $('areaPlantas').innerHTML = html;
}

// ---------------------------------------------------------------------
//  Detalhe da planta
// ---------------------------------------------------------------------

function chipPlanta(id, extra = '', remover = '') {
  const q = plantaPorId(id);
  if (!q) return '';
  const x = remover ? `<button class="x" data-remover="${remover}" data-alvo="${escapar(id)}" title="Remover">×</button>` : '';
  return `<span class="chip ${extra}"><button class="chip-ir" data-ir="${escapar(id)}">${escapar(q.emoji)} ${escapar(q.nome)}</button>${x}</span>`;
}

function calendarioDetalhe(p) {
  const col = mesesColheita(p);
  const agora = mesAtual();
  const bons = temMelhor(p) ? mesesBons(p) : [];
  const linhaCanteiro = p.forma === 'muda' && p.tr.length ? 't' : 's';   // a linha em que a planta vai para o canteiro
  const linha = (nome, ms, cls) => `<tr><th>${nome}</th>${MESES_LETRA.map((_, i) => {
    const ok = ms.includes(i + 1), bom = ok && cls === linhaCanteiro && bons.includes(i + 1);
    return `<td class="${ok ? cls : ''} ${bom ? 'melhor' : ''} ${i + 1 === agora ? 'agora' : ''}" title="${MESES[i]}${bom ? ' — melhor época' : ok && bons.length && cls === linhaCanteiro ? ' — possível' : ''}"></td>`;
  }).join('')}</tr>`;
  return `<table class="cal-planta">
    <tr><th></th>${MESES_LETRA.map((l, i) => `<td class="mes ${i + 1 === agora ? 'agora' : ''}">${l}</td>`).join('')}</tr>
    ${linha(p.forma === 'muda' ? 'Semear' : 'Plantar', p.sem, 's')}
    ${p.tr.length ? linha('Transplantar', p.tr, 't') : ''}
    ${ehFlor(p) ? linha('Florir', col, 'f') : linha('Colher', col, 'c')}
    ${(p.cuidados || []).filter(c => Array.isArray(c.meses)).map(c => linha(TIPOS_CUIDADO[c.tipo].nome, c.meses, 'k')).join('')}
  </table>
  ${bons.length ? `<p class="nota legenda-melhor"><span class="q forte"></span> melhores meses: ${faixaMeses(bons)} · <span class="q fraco"></span> possível</p>` : ''}`;
}

function naSuaHorta(p) {
  const linhas = [];
  for (const r of plantasNaHorta()) {
    if (!r.ids.includes(p.id)) continue;
    const vizinhas = r.ids.filter(id => id !== p.id);
    const ruins = vizinhas.filter(id => saoInimigas(p.id, id));
    const boas = vizinhas.filter(id => saoAmigas(p.id, id));
    linhas.push(`<li><b>${escapar(r.zona.nome)}</b>
      ${ruins.length ? `<div class="mal">⚠️ junto com ${ruins.map(id => escapar(plantaPorId(id).nome)).join(', ')} — não combinam</div>` : ''}
      ${boas.length ? `<div class="bem">✓ combina com ${boas.map(id => escapar(plantaPorId(id).nome)).join(', ')}</div>` : ''}
    </li>`);
  }
  return linhas.length ? `<ul class="na-horta">${linhas.join('')}</ul>` : '<p class="nota">Ainda não está em nenhum canteiro do mapa.</p>';
}

// Cuidados (podar, flores murchas, arrancar, replantar)
function htmlCuidados(p) {
  if (!p.cuidados || !p.cuidados.length) return '';
  const flor = mesesColheita(p);
  return `<h4>Cuidados</h4><ul class="cuidados">${p.cuidados.map(c => {
    const ms = mesesDoCuidado(p, c, flor);
    return `<li><span class="e">${TIPOS_CUIDADO[c.tipo].icone}</span><span><b>${TIPOS_CUIDADO[c.tipo].nome}</b> · ${c.meses === 'floracao' ? 'durante a floração' : faixaMeses(ms)}<div class="sub">${escapar(c.texto)}</div></span></li>`;
  }).join('')}</ul><p class="fontes">Cuidados: orientação geral de jardinagem.</p>`;
}

// Foto da planta (Wikimedia Commons, licença livre) com crédito
const slugVariedade = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function fotoDe(chave) { return (typeof FOTOS !== 'undefined' && FOTOS[chave]) || null; }
function creditoFoto(f) {
  return `Foto: ${escapar(f.autor)} · ${escapar(f.licenca)} · <a href="${escapar(f.pagina)}" target="_blank" rel="noopener">Wikimedia Commons</a>`;
}
function htmlFoto(p) {
  const f = fotoDe(p.id);
  if (!f) return '';
  return `<figure class="d-foto"><img src="${escapar(f.arquivo)}" alt="${escapar(p.nome)}" loading="lazy"><figcaption>${creditoFoto(f)}</figcaption></figure>`;
}
// Galeria de variedades: mesmas regras de plantio, só para reconhecer qual é qual
function htmlVariedades(p) {
  if (!p.variedades || !p.variedades.length) return '';
  const comEntrada = p.variedades.some(v => v.id);
  const itens = p.variedades.map(v => {
    const f = fotoDe(v.id || `${p.id}--${slugVariedade(v.nome)}`);
    const img = f ? `<img src="${escapar(f.arquivo)}" alt="${escapar(v.nome)}" loading="lazy" title="${escapar(`Foto: ${f.autor} · ${f.licenca}`)}">` : '<span class="sem-foto">🌱</span>';
    const nome = escapar(v.nome);
    return v.id
      ? `<button class="variedade" data-ir="${escapar(v.id)}">${img}<span>${nome} →</span></button>`
      : `<figure class="variedade">${img}<figcaption>${nome}</figcaption></figure>`;
  }).join('');
  return `<h4>Variedades</h4>
    <p class="nota">${!comEntrada ? 'Mesmas regras de plantio; as fotos ajudam a reconhecer cada uma.'
      : p.variedades.every(v => v.id) ? 'Cada tipo tem ficha própria: toque para ver.'
      : 'Os tipos com → têm ficha própria; os outros seguem esta.'}</p>
    <div class="variedades">${itens}</div>`;
}

// De onde vêm os dados desta planta
function htmlFontes(p) {
  const fontes = (p.fontes || []).map(f => FONTES[f]).filter(Boolean);
  if (p.custom) return '<p class="fontes">✏️ Planta criada por você.</p>';
  if (!fontes.length) {
    return '<p class="fontes estimativa">⚠️ <b>Estimativa</b> — não achei fonte oficial para esta planta no clima de Piraquara. Ajuste com a sua experiência.</p>';
  }
  return `<p class="fontes">📚 Fontes: ${fontes.map(f => `<a href="${f.url}" target="_blank" rel="noopener">${escapar(f.nome)}</a>`).join(' · ')}
    ${estado.plantasEditadas[p.id] ? '<br><i>Você editou dados desta planta.</i>' : ''}</p>`;
}

// Dias reais até a colheita, a partir do diário
function htmlExperiencia(p) {
  const dias = diasReaisAteColheita(p.id);
  if (!dias.length) return '';
  const media = Math.round(dias.reduce((s, d) => s + d, 0) / dias.length);
  const fora = media < p.col[0] - 7 || media > p.col[1] + 7;
  return `<div class="experiencia">📔 Pelo seu diário, a colheita veio em <b>${media} dias</b> (${dias.length} ${dias.length === 1 ? 'vez' : 'vezes'}).
    Catálogo: ${p.col[0]}–${p.col[1]} dias.
    ${fora ? `<button class="pequeno" data-usar-dias="${media}">Usar ${media} dias no catálogo</button>` : ''}</div>`;
}

function renderDetalhe() {
  const box = $('detalhePlanta');
  const p = plantaPorId(plantaAtiva);
  if (!p) { box.innerHTML = '<p class="vazio">Escolha uma planta ao lado.</p>'; return; }
  const sol = NIVEIS_SOL[p.sol] || NIVEIS_SOL[6];
  const rel = relacoes(p.id);
  const editada = ehBase(p.id) && estado.plantasEditadas[p.id];
  const porM2 = 10000 / (p.esp[0] * p.esp[1]);

  box.innerHTML = `
    <div class="d-topo">
      <span class="d-emoji">${escapar(p.emoji)}</span>
      <div>
        <h3>${escapar(p.nome)}</h3>
        <div class="d-cat">${CATEGORIAS[p.cat]?.nome || ''}${editada ? ' · <i>editada por você</i>' : ''}${p.custom ? ' · <i>criada por você</i>' : ''}</div>
      </div>
    </div>
    ${htmlFoto(p)}
    <button class="d-lista ${naLista(p.id) ? 'on' : ''}" data-acao="lista">${naLista(p.id) ? '★ Favorito' : '☆ Marcar como favorito'}</button>

    ${calendarioDetalhe(p)}

    <dl class="fatos">
      <dt>Sol</dt><dd>${sol.icone} ${sol.nome} — ${sol.desc}</dd>
      <dt>Espaço</dt><dd>${p.esp[0]} cm entre plantas · ${p.esp[1]} cm entre fileiras
        <span class="nota">(${porM2 >= 1 ? `≈ ${fmt(porM2, porM2 < 10 ? 1 : 0)} por m²` : `1 planta a cada ${fmt(1 / porM2, 1)} m²`})</span></dd>
      <dt>Origem</dt><dd>${escapar(p.origem || '—')}${p.nativa ? ' <span class="selo-nativa">nativa do Brasil</span>' : ''}</dd>
      <dt>Família</dt><dd>${familiaDe(p)}${FAMILIAS_ROTACAO.includes(familiaDe(p)) ? ' <span class="nota">(importante na rotação)</span>' : ''}</dd>
      <dt>Plantio</dt><dd>${FORMAS[p.forma] || p.forma}</dd>
      ${p.forma === 'muda' ? `<dt>Bandeja</dt><dd>${diasBandeja(p).join('–')} dias até transplantar <span class="nota">(${p.fonteBandeja && FONTES[p.fonteBandeja] ? 'Embrapa' : 'estimativa'}; no frio, 1–2 semanas a mais)</span></dd>` : ''}
      <dt>Colheita</dt><dd>${p.col[0]}–${p.col[1]} dias depois de ${p.forma === 'muda' ? 'semear' : 'plantar'}</dd>
      ${p.geada || p.tutor || p.perene ? `<dt>Atenção</dt><dd>${[
        p.geada ? '❄️ sensível a geada' : '', p.tutor ? '🪜 precisa de tutor/treliça' : '', p.perene ? '♾️ perene' : '',
      ].filter(Boolean).join(' · ')}</dd>` : ''}
    </dl>

    ${p.dica ? `<p class="dica-planta">💡 ${escapar(p.dica)}</p>` : ''}
    ${htmlVariedades(p)}
    ${htmlCuidados(p)}
    ${htmlFontes(p)}

    <h4>Combina com</h4>
    <div class="chips">${rel.amigas.map(id => chipPlanta(id, 'bem', editandoPlanta ? 'amigas' : '')).join('') || '<span class="nota">—</span>'}</div>
    <h4>Manter longe de</h4>
    <div class="chips">${rel.inimigas.map(id => chipPlanta(id, 'mal', editandoPlanta ? 'inimigas' : '')).join('') || '<span class="nota">—</span>'}</div>

    <h4>Na sua horta</h4>
    ${naSuaHorta(p)}
    ${htmlExperiencia(p)}

    <div class="d-acoes">
      <button data-acao="editar">${editandoPlanta ? '✓ Terminar edição' : '✏️ Editar dados'}</button>
      ${editada ? '<button data-acao="restaurar">↺ Restaurar original</button>' : ''}
      ${p.custom ? '<button data-acao="excluir" class="perigo">Excluir planta</button>' : ''}
    </div>

    ${editandoPlanta ? formEdicao(p) : ''}
  `;
}

function formEdicao(p) {
  const opcoes = (obj, atual) => Object.entries(obj).map(([v, o]) =>
    `<option value="${v}" ${String(v) === String(atual) ? 'selected' : ''}>${typeof o === 'string' ? o : (o.icone ? o.icone + ' ' : o.emoji ? o.emoji + ' ' : '') + o.nome}</option>`).join('');
  const botoesMeses = campo => MESES_LETRA.map((l, i) =>
    `<button class="${(p[campo] || []).includes(i + 1) ? 'on' : ''}" data-mes="${i + 1}" data-campo-mes="${campo}" title="${MESES[i]}">${MESES_CURTOS[i]}</button>`).join('');
  const outras = todasPlantas().filter(q => q.id !== p.id).sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
  const selRel = (campo, rotulo) => `<select data-add="${campo}"><option value="">${rotulo}</option>${outras.map(q =>
    `<option value="${escapar(q.id)}">${escapar(q.nome)}</option>`).join('')}</select>`;

  return `<div class="d-form form">
    <h4>Editar dados</h4>
    <div class="grade2">
      <label>Nome <input data-campo="nome" value="${escapar(p.nome)}"></label>
      <label>Emoji <input data-campo="emoji" value="${escapar(p.emoji)}"></label>
    </div>
    <div class="grade2">
      <label>Origem <input data-campo="origem" value="${escapar(p.origem || '')}" placeholder="ex.: México"></label>
      <label class="check" style="margin-top:18px"><input type="checkbox" data-campo="nativa" ${p.nativa ? 'checked' : ''}> Nativa do Brasil</label>
    </div>
    <div class="grade2">
      <label>Categoria <select data-campo="cat">${opcoes(CATEGORIAS, p.cat)}</select></label>
      <label>Sol <select data-campo="sol">${opcoes(NIVEIS_SOL, p.sol)}</select></label>
    </div>
    <div class="grade2">
      <label>Entre plantas (cm) <input data-campo="esp0" inputmode="numeric" value="${p.esp[0]}"></label>
      <label>Entre fileiras (cm) <input data-campo="esp1" inputmode="numeric" value="${p.esp[1]}"></label>
    </div>
    <div class="grade2">
      <label>Forma de plantio <select data-campo="forma">${opcoes(FORMAS, p.forma)}</select></label>
      <label>Família <select data-campo="familia">${Object.keys(FAMILIAS).map(f => `<option ${f === familiaDe(p) ? 'selected' : ''}>${f}</option>`).join('')}</select></label>
    </div>
    <div class="grade2">
      <label>Colheita: mín. (dias) <input data-campo="col0" inputmode="numeric" value="${p.col[0]}"></label>
      <label>máx. (dias) <input data-campo="col1" inputmode="numeric" value="${p.col[1]}"></label>
    </div>
    <div class="rotulo">Meses de semear / plantar</div>
    <div class="meses-btn">${botoesMeses('sem')}</div>
    <div class="rotulo">Meses de transplantar mudas <small>(deixe vazio se não usa mudas)</small></div>
    <div class="meses-btn">${botoesMeses('tr')}</div>
    <div class="rotulo">Melhores meses <small>(opcional — se vazio, todos os meses acima são bons)</small></div>
    <div class="meses-btn melhores">${botoesMeses('melhor')}</div>
    <div class="checks">
      <label class="check"><input type="checkbox" data-campo="geada" ${p.geada ? 'checked' : ''}> Sensível a geada</label>
      <label class="check"><input type="checkbox" data-campo="tutor" ${p.tutor ? 'checked' : ''}> Precisa de tutor</label>
      <label class="check"><input type="checkbox" data-campo="perene" ${p.perene ? 'checked' : ''}> Perene</label>
    </div>
    <div class="grade2">
      ${selRel('amigas', '+ Combina com…')}
      ${selRel('inimigas', '+ Manter longe de…')}
    </div>
    <label>Dica <textarea data-campo="dica" rows="3">${escapar(p.dica || '')}</textarea></label>
    <p class="nota">As mudanças valem só para a sua horta. “Restaurar original” desfaz tudo.</p>
  </div>`;
}

// ---------------------------------------------------------------------
//  Edição
// ---------------------------------------------------------------------

// Garante que existe uma cópia editável da planta
function copiaEditavel(id) {
  if (!estado.plantasEditadas[id]) estado.plantasEditadas[id] = JSON.parse(JSON.stringify(plantaPorId(id)));
  return estado.plantasEditadas[id];
}

function aplicarCampo(p, campo, el) {
  const v = el.type === 'checkbox' ? el.checked : el.value;
  const inteiro = () => { const n = parseInt(v, 10); return Number.isFinite(n) && n > 0 ? n : null; };
  switch (campo) {
    case 'nome': if (v.trim()) p.nome = v.trim(); break;
    case 'emoji': if (v.trim()) p.emoji = v.trim(); break;
    case 'cat': case 'forma': case 'dica': case 'familia': case 'origem': p[campo] = v; break;
    case 'nativa': p.nativa = v; break;
    case 'sol': p.sol = Number(v); break;
    case 'esp0': if (inteiro()) p.esp[0] = inteiro(); break;
    case 'esp1': if (inteiro()) p.esp[1] = inteiro(); break;
    case 'col0': if (inteiro()) p.col[0] = inteiro(); break;
    case 'col1': if (inteiro()) p.col[1] = inteiro(); break;
    case 'geada': case 'tutor': case 'perene': p[campo] = v; break;
  }
  if (p.col[1] < p.col[0]) p.col[1] = p.col[0];
}

function montarDetalhe() {
  const box = $('detalhePlanta');
  let antes;

  box.addEventListener('focusin', () => { antes = JSON.stringify(estado); });

  box.addEventListener('input', ev => {
    const el = ev.target.closest('[data-campo]');
    if (!el || el.type === 'checkbox' || el.tagName === 'SELECT') return;
    if (antes === undefined) antes = JSON.stringify(estado);
    aplicarCampo(copiaEditavel(plantaAtiva), el.dataset.campo, el);
    salvar();
    renderGrade();
  });

  box.addEventListener('change', ev => {
    const el = ev.target;
    if (el.dataset.add) {
      if (!el.value) return;
      const a = JSON.stringify(estado);
      const p = copiaEditavel(plantaAtiva);
      const outro = el.dataset.add === 'amigas' ? 'inimigas' : 'amigas';
      // tira a relação contrária, também a que vem da cultura (tomate-cereja → tomate)
      const nomesDele = nomesNaLista(plantaPorId(el.value) || { id: el.value });
      p[outro] = p[outro].filter(x => !nomesDele.includes(x));
      if (!p[el.dataset.add].includes(el.value)) p[el.dataset.add].push(el.value);
      // e a que a outra planta possa ter declarado
      const q = plantaPorId(el.value), meus = nomesNaLista(plantaPorId(plantaAtiva) || { id: plantaAtiva });
      if (q && q[outro].some(x => meus.includes(x))) {
        const qq = copiaEditavel(el.value);
        qq[outro] = qq[outro].filter(x => !meus.includes(x));
      }
      registrar(a);
      mudou();
      return;
    }
    if (!el.dataset.campo) return;
    if (el.type === 'checkbox' || el.tagName === 'SELECT') {
      const a = JSON.stringify(estado);
      aplicarCampo(copiaEditavel(plantaAtiva), el.dataset.campo, el);
      registrar(a);
      mudou();
    } else if (antes !== undefined && antes !== JSON.stringify(estado)) {
      registrar(antes);
      antes = JSON.stringify(estado);
    }
  });

  box.addEventListener('click', async ev => {
    const ud = ev.target.closest('[data-usar-dias]');
    if (ud) {
      const a = JSON.stringify(estado);
      const d = Number(ud.dataset.usarDias);
      copiaEditavel(plantaAtiva).col = [Math.round(d * 0.9), Math.round(d * 1.1)];
      registrar(a);
      mudou();
      return;
    }
    const ir = ev.target.closest('[data-ir]');
    if (ir) { selecionarPlanta(ir.dataset.ir); return; }

    const mes = ev.target.closest('[data-mes]');
    if (mes) {
      const a = JSON.stringify(estado);
      const p = copiaEditavel(plantaAtiva);
      const campo = mes.dataset.campoMes, m = Number(mes.dataset.mes);
      const atual = p[campo] || [];
      p[campo] = atual.includes(m) ? atual.filter(x => x !== m) : [...atual, m].sort((x, y) => x - y);
      registrar(a);
      mudou();
      return;
    }

    const rem = ev.target.closest('[data-remover]');
    if (rem) {
      const a = JSON.stringify(estado);
      const campo = rem.dataset.remover, alvo = rem.dataset.alvo;
      // remove nos dois sentidos — também quando a relação vem da cultura (couve × tomate vale para o tomate-cereja)
      for (const [x, y] of [[plantaAtiva, alvo], [alvo, plantaAtiva]]) {
        const q = plantaPorId(x), nomes = nomesNaLista(plantaPorId(y) || { id: y });
        if (q && q[campo].some(z => nomes.includes(z))) { const c = copiaEditavel(x); c[campo] = c[campo].filter(z => !nomes.includes(z)); }
      }
      registrar(a);
      mudou();
      return;
    }

    const acao = ev.target.closest('[data-acao]')?.dataset.acao;
    if (acao === 'lista') alternarLista(plantaAtiva);
    else if (acao === 'editar') { editandoPlanta = !editandoPlanta; renderDetalhe(); }
    else if (acao === 'restaurar') {
      if (!(await perguntar({ titulo: 'Restaurar o original?', texto: 'Suas mudanças nesta planta serão perdidas (dá para desfazer com Ctrl+Z).', ok: 'Restaurar', perigo: true }))) return;
      registrar();
      delete estado.plantasEditadas[plantaAtiva];
      mudou();
    } else if (acao === 'excluir') {
      const p = plantaPorId(plantaAtiva);
      if (!(await perguntar({ titulo: `Excluir “${p.nome}”?`, texto: 'A planta sai do catálogo e dos favoritos.', ok: 'Excluir', perigo: true }))) return;
      registrar();
      delete estado.plantasEditadas[plantaAtiva];
      estado.minhaLista = estado.minhaLista.filter(x => x !== plantaAtiva);
      plantaAtiva = 'tomate';
      editandoPlanta = false;
      mudou();
    }
  });
}

function novaPlanta() {
  registrar();
  const id = 'minha-' + Date.now().toString(36);
  estado.plantasEditadas[id] = {
    id, nome: 'Nova planta', cat: filtroPlantas.cat || 'folhas', emoji: '🌱', custom: true,
    sol: 6, esp: [30, 30], forma: 'direto', sem: [], tr: [], col: [60, 90],
    geada: false, tutor: false, perene: false, amigas: [], inimigas: [], alias: [], dica: '',
  };
  estado.minhaLista.push(id);
  plantaAtiva = id;
  editandoPlanta = true;
  mudou();
  const campo = document.querySelector('#detalhePlanta [data-campo="nome"]');
  if (campo) { campo.focus(); campo.select(); }
}
