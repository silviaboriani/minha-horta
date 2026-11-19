'use strict';

// =====================================================================
//  Minha Horta — Lista de compras: sementes, mudas, ramas, bulbos…
//  Junta tudo o que os canteiros vão precisar num período.
// =====================================================================

const familiaDe = p => p.familia || FAMILIA_DE[p.id] || 'Outras';

let periodoCompras = 3;   // meses a partir do mês escolhido

// Como comprar/produzir cada forma de plantio
const COMPRA = {
  muda:      { grupo: 'Mudas',                    unidade: n => `${n} mudas`, extra: (n, p, e) => `ou semeie ~${Math.ceil(n * 1.5)} sementes na bandeja em ${MESES[mesSemear(p, e.inicio) - 1].toLowerCase()} (${diasBandeja(p).join('–')} dias até a muda)` },
  direto:    { grupo: 'Sementes',                 unidade: n => `~${n * 2} sementes`, extra: n => `para ${n} pés (2 por cova, depois desbaste)` },
  ambos:     { grupo: 'Sementes',                 unidade: n => `~${n * 2} sementes`, extra: n => `para ${n} pés — ou ${n} mudas` },
  rama:      { grupo: 'Ramas, bulbos e rizomas',  unidade: n => `${n} ramas`, extra: () => 'pedaços de 20–30 cm' },
  bulbo:     { grupo: 'Ramas, bulbos e rizomas',  unidade: n => `${n} dentes/bulbos`, extra: () => '' },
  tuberculo: { grupo: 'Ramas, bulbos e rizomas',  unidade: n => `${n} pedaços`, extra: () => 'com brotos' },
  rebento:   { grupo: 'Ramas, bulbos e rizomas',  unidade: n => `${n} rebentos`, extra: () => '' },
  estaca:    { grupo: 'Mudas',                    unidade: n => `${n} mudas ou estacas`, extra: () => '' },
  fruto:     { grupo: 'Ramas, bulbos e rizomas',  unidade: n => `${n} frutos brotados`, extra: () => '' },
};

function itensDeCompra(inicio, meses) {
  const an = analiseHorta();
  const periodo = new Set(Array.from({ length: meses }, (_, k) => mesMais(inicio, k)));
  const porPlanta = {};
  for (const z of estado.zonas) {
    for (const e of an.entradasPorZona[z.id] || []) {
      if (!e.p) continue;
      // mudas: a compra/semeadura é no mês da bandeja; o resto, no mês de plantio
      const mesCompra = cicloDe(e.p).bandeja ? mesSemear(e.p, e.inicio) : e.inicio;
      if (!periodo.has(e.inicio) && !periodo.has(mesCompra)) continue;
      const x = an.porZona[z.id]?.plantas.find(q => q.entrada === e.entrada);
      const n = e.qtd || x?.sugestao || 0;
      const k = `${e.id}|${e.p.forma}`;
      const item = porPlanta[k] || (porPlanta[k] = { p: e.p, forma: e.p.forma, total: 0, estimado: false, usos: [] });
      item.total += n;
      if (!e.qtd) item.estimado = true;
      item.usos.push({ zona: z.nome, n, inicio: e.inicio, e });
    }
  }
  const grupos = {};
  for (const item of Object.values(porPlanta)) {
    const c = COMPRA[item.forma] || COMPRA.direto;
    (grupos[c.grupo] || (grupos[c.grupo] = [])).push(item);
  }
  for (const g of Object.values(grupos)) g.sort((a, b) => a.p.nome.localeCompare(b.p.nome, 'pt'));
  return grupos;
}

function textoCompras(grupos, inicio, meses) {
  const linhas = [`Lista de compras — ${estado.nome || 'Minha Horta'}`, `${MESES[inicio - 1]} a ${MESES[mesMais(inicio, meses - 1) - 1]}`, ''];
  for (const [g, itens] of Object.entries(grupos)) {
    linhas.push(g.toUpperCase());
    for (const it of itens) {
      const c = COMPRA[it.forma] || COMPRA.direto;
      linhas.push(`☐ ${it.p.nome}: ${c.unidade(it.total)}${it.estimado ? ' (estimado)' : ''} — ${it.usos.map(u => `${u.zona} (${MESES_CURTOS[u.inicio - 1]})`).join(', ')}`);
    }
    linhas.push('');
  }
  return linhas.join('\n');
}

function abrirCompras() {
  $('modalGeral').classList.remove('oculto');
  renderCompras();
}

function renderCompras() {
  const inicio = mesSol + 1;
  const grupos = itensDeCompra(inicio, periodoCompras);
  const vazio = !Object.keys(grupos).length;
  const html = Object.entries(grupos).map(([g, itens]) => `
    <h4>${g === 'Mudas' ? '🌱' : g === 'Sementes' ? '🌰' : '🧄'} ${g}</h4>
    <ul class="lista-compras">${itens.map(it => {
      const c = COMPRA[it.forma] || COMPRA.direto;
      const extra = c.extra(it.total, it.p, it.usos[0].e);
      return `<li><label class="check"><input type="checkbox"> <span class="e">${escapar(it.p.emoji)}</span>
        <span><b>${escapar(it.p.nome)}</b>: ${c.unidade(it.total)}${it.estimado ? ' <span class="estimado" title="Quantidade sugerida pelo app — defina os pés no canteiro para ficar exato">(estimado)</span>' : ''}
        ${extra ? `<div class="sub">${extra}</div>` : ''}
        <div class="sub">${it.usos.map(u => `${escapar(u.zona)}: ${u.n} ${u.n === 1 ? 'pé' : 'pés'} em ${MESES_CURTOS[u.inicio - 1]}`).join(' · ')}</div></span></label></li>`;
    }).join('')}</ul>`).join('');

  $('modalGeralCaixa').innerHTML = `
    <button class="fechar" data-geral="fechar" title="Fechar">×</button>
    <h3>🛒 Lista de compras</h3>
    <div class="opcoes-plano">
      <label>Período: <select data-compras-periodo>
        ${[[1, 'só ' + MESES[inicio - 1].toLowerCase()], [3, 'próximos 3 meses'], [6, 'próximos 6 meses'], [12, 'o ano todo']].map(([n, t]) =>
          `<option value="${n}" ${n === periodoCompras ? 'selected' : ''}>${t}</option>`).join('')}
      </select></label>
      <span class="nota">a partir de ${MESES[inicio - 1].toLowerCase()} (mude o mês na barra do mapa)</span>
    </div>
    ${vazio ? '<p class="vazio">Nada para plantar neste período. Escolha plantas e meses de plantio nos canteiros.</p>' : html}
    <p class="nota">Sementes diretas: conta 2 por cova (depois desbaste). Mudas: compre prontas ou semeie ~50% a mais na bandeja (o tempo de bandeja varia: ~1 mês para couves e tomate, 1,5 mês para pimentão e cebola, 2 meses para alho-poró).</p>
    <div class="acoes-plano">
      <button class="principal" data-geral="copiar" ${vazio ? 'disabled' : ''}>📋 Copiar lista</button>
      <button data-geral="imprimir" ${vazio ? 'disabled' : ''}>🖨 Imprimir</button>
      <button data-geral="fechar">Fechar</button>
    </div>`;
}

function montarCompras() {
  const modal = $('modalGeral');
  modal.addEventListener('click', async ev => {
    if (ev.target === modal) { modal.classList.add('oculto'); return; }
    const acao = ev.target.closest('[data-geral]')?.dataset.geral;
    if (acao === 'fechar') modal.classList.add('oculto');
    if (acao === 'copiar' || acao === 'imprimir') {
      const inicio = mesSol + 1;
      const txt = textoCompras(itensDeCompra(inicio, periodoCompras), inicio, periodoCompras);
      if (acao === 'copiar') {
        try { await navigator.clipboard.writeText(txt); avisar('Lista copiada — cole no WhatsApp, e-mail ou notas.'); }
        catch (_) { avisar('Não consegui copiar automaticamente. Use Imprimir.'); }
      } else {
        const w = window.open('', '_blank');
        if (!w) { avisar('O navegador bloqueou a janela de impressão.'); return; }
        w.document.write(`<pre style="font:14px/1.5 system-ui;white-space:pre-wrap">${escapar(txt)}</pre>`);
        w.document.close();
        w.print();
      }
    }
  });
  modal.addEventListener('change', ev => {
    if (ev.target.matches('[data-compras-periodo]')) { periodoCompras = Number(ev.target.value); renderCompras(); }
  });
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape') modal.classList.add('oculto'); });
  document.addEventListener('click', ev => { if (ev.target.closest('[data-abrir-compras]')) abrirCompras(); });
}
