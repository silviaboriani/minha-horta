'use strict';

// =====================================================================
//  Minha Horta — Limpar plantio: tira plantas dos canteiros (o desenho fica)
// =====================================================================

const opcoesLimpar = { escopo: 'horta', oque: 'tudo', flores: false, perenes: true };

// Quais plantios sairiam com as opções atuais: [{ z, entrada }]
function plantiosParaLimpar() {
  const zonas = opcoesLimpar.escopo === 'zona' && zonaPorId(zonaAtiva)
    ? [zonaPorId(zonaAtiva)]
    : estado.zonas.filter(z => TIPOS_PLANTAVEIS.includes(z.tipo));
  const res = [];
  for (const z of zonas) {
    for (const entrada of z.plantas || []) {
      const p = plantaPorId(idDaEntrada(entrada) || '');
      if (opcoesLimpar.perenes && p && p.perene) continue;
      if (opcoesLimpar.oque === 'sugeridas' && z.origem?.[entrada] !== 'plano') continue;
      res.push({ z, entrada });
    }
  }
  return res;
}

function abrirLimpar(escopo) {
  opcoesLimpar.escopo = escopo === 'zona' && zonaPorId(zonaAtiva) ? 'zona' : 'horta';
  $('modalGeral').classList.remove('oculto');
  renderLimpar();
}

function renderLimpar() {
  const z = zonaPorId(zonaAtiva);
  const lista = plantiosParaLimpar();
  const canteiros = new Set(lista.map(x => x.z.id)).size;
  const radio = (nome, valor, texto) =>
    `<label class="check"><input type="radio" name="${nome}" data-limpar-op="${nome}" value="${valor}" ${opcoesLimpar[nome] === valor ? 'checked' : ''}> ${texto}</label>`;
  $('modalGeralCaixa').innerHTML = `
    <button class="fechar" data-limpar="fechar" title="Fechar">×</button>
    <h3>🧹 Limpar plantio</h3>
    <p class="nota">Tira as plantas dos canteiros. O desenho, o catálogo e o diário ficam. Dá para desfazer (↶).</p>
    <div class="grupo-op"><div class="rotulo">Onde</div>
      ${radio('escopo', 'horta', 'Na horta toda')}
      ${z ? radio('escopo', 'zona', `Só em ${escapar(z.nome)}`) : ''}
    </div>
    <div class="grupo-op"><div class="rotulo">O quê</div>
      ${radio('oque', 'tudo', 'Todas as plantas')}
      ${radio('oque', 'sugeridas', 'Só as que vieram do ✨ Sugerir plano <span class="nota">(marcadas a partir de hoje)</span>')}
    </div>
    <div class="grupo-op">
      <label class="check"><input type="checkbox" data-limpar-check="perenes" ${opcoesLimpar.perenes ? 'checked' : ''}> Manter as perenes (alecrim, louro, hortelã…)</label>
    </div>
    <div class="resumo-limpar ${lista.length ? '' : 'vazio'}">${lista.length
      ? `Vai tirar <b>${lista.length} ${plural(lista.length, 'plantio', 'plantios')}</b> de <b>${canteiros} ${plural(canteiros, 'canteiro', 'canteiros')}</b>: ${[...new Set(lista.map(x => nomePlanta(x.entrada)))].slice(0, 12).join(', ')}${lista.length > 12 ? '…' : ''}.`
      : 'Nada para tirar com essas opções.'}</div>
    <div class="acoes-plano">
      <button class="perigo-cheio" data-limpar="ok" ${lista.length ? '' : 'disabled'}>🧹 Limpar ${lista.length || ''}</button>
      <button data-limpar="fechar">Cancelar</button>
    </div>`;
}

function executarLimpar() {
  const lista = plantiosParaLimpar();
  if (!lista.length) return;
  registrar();
  for (const { z, entrada } of lista) {
    z.plantas = z.plantas.filter(t => t !== entrada);
    for (const k of ['qtd', 'plantio', 'pos', 'origem']) if (z[k]) delete z[k][entrada];
  }
  posicionando = null;
  $('modalGeral').classList.add('oculto');
  mudou();
  avisar(`🧹 ${lista.length} ${plural(lista.length, 'plantio removido', 'plantios removidos')}. Ctrl+Z (↶ Desfazer) traz de volta.`);
}

function montarLimpar() {
  const modal = $('modalGeral');
  modal.addEventListener('click', ev => {
    const a = ev.target.closest('[data-limpar]')?.dataset.limpar;
    if (a === 'fechar') modal.classList.add('oculto');
    if (a === 'ok') executarLimpar();
  });
  modal.addEventListener('change', ev => {
    const op = ev.target.dataset.limparOp, ch = ev.target.dataset.limparCheck;
    if (op) { opcoesLimpar[op] = ev.target.value; renderLimpar(); }
    if (ch) { opcoesLimpar[ch] = ev.target.checked; renderLimpar(); }
  });
  document.addEventListener('click', ev => {
    const b = ev.target.closest('[data-abrir-limpar]');
    if (b) abrirLimpar(b.dataset.abrirLimpar);
  });
}
