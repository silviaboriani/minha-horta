'use strict';

// =====================================================================
//  Minha Horta — Bandeja de mudas
//  • Na bandeja agora: semeaduras registradas (✓), semanas contadas,
//    quando aclimatar e quando a muda fica pronta.
//  • Preparar: sementes/substrato/células, aclimatar, frio, preparar canteiro.
//  • Próximos meses: o que semear no mês que vem e no seguinte.
//  • Bom para semear agora: mudas na época cuja muda fica pronta quando
//    um canteiro tem espaço — um clique põe no plano.
// =====================================================================
const CELULAS_POR_BANDEJA = 128;
const SOBRA_SEMENTES = 1.5;   // semeie ~50% a mais (nem toda semente vinga)

// Meses de frio em que a bandeja precisa de proteção (geada de maio a setembro no Paraná)
const mesesFrioBandeja = () => (estado.local.lat < 0 ? [5, 6, 7, 8, 9] : [11, 12, 1, 2, 3]);

const somarDias = (iso, d) => {
  const x = new Date(iso + 'T12:00:00');
  x.setDate(x.getDate() + d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
const diaMes = iso => { const [, m, d] = iso.split('-'); return `${Number(d)}/${MESES_CURTOS[Number(m) - 1].toLowerCase()}`; };

// Quantas plantas a entrada terá (definida, sugerida ou o mínimo)
function pesDaEntrada(an, z, e) {
  const x = an.porZona[z.id]?.plantas.find(q => q.entrada === e.entrada);
  return e.qtd || x?.sugestao || minPes(e.p);
}
const celulasPara = pes => Math.ceil(pes * SOBRA_SEMENTES);
const textoCelulas = n => `≈ ${n} células (${Math.max(1, Math.ceil(n / CELULAS_POR_BANDEJA))} bandeja${n > CELULAS_POR_BANDEJA ? 's' : ''} de ${CELULAS_POR_BANDEJA})`;

// ---------------------------------------------------------------------
//  Na bandeja agora (a partir do diário)
// ---------------------------------------------------------------------
function mudasNaBandeja() {
  const hoje = hojeISO();
  return estado.diario
    .filter(r => r.tipo === 'semeadura' && r.planta && diasEntre(r.data, hoje) >= 0 && diasEntre(r.data, hoje) <= 150)
    .filter(r => !estado.diario.some(q => q.tipo === 'plantio' && q.planta === r.planta && q.zona === r.zona && q.data >= r.data))
    .map(r => {
      const p = plantaPorId(r.planta);
      const z = zonaPorId(r.zona);
      if (!p || !z) return null;
      const [d0, d1] = diasBandeja(p);
      const dias = diasEntre(r.data, hoje);
      return { r, p, z, dias, d0, d1, pronta0: somarDias(r.data, d0), pronta1: somarDias(r.data, d1) };
    })
    .filter(Boolean)
    .sort((a, b) => a.pronta0.localeCompare(b.pronta0));
}

function itensNaBandeja() {
  return mudasNaBandeja().map(x => {
    const { r, p, z, dias, d0, d1 } = x;
    const e = { id: p.id, entrada: r.entrada || p.id, p, qtd: z.qtd?.[r.entrada] || null };
    let texto, acao = '';
    if (dias >= d0) { texto = `✅ <b>pronta para transplantar</b> (semeada em ${diaMes(r.data)}, há ${dias} dias)`; acao = 'plantio'; }
    else if (dias >= d0 - 7) texto = `🌤️ <b>aclimatar</b>: algumas horas por dia ao sol e ao vento — pronta em ~${d0 - dias} dias (${diaMes(x.pronta0)})`;
    else texto = `semana ${Math.max(1, Math.ceil(dias / 7))} de ~${Math.ceil(d1 / 7)} · pronta entre ${diaMes(x.pronta0)} e ${diaMes(x.pronta1)}`;
    return itemTarefa(z, e, texto + (r.qtd ? ` · ${r.qtd} ${r.unidade}` : ''), acao);
  });
}

// ---------------------------------------------------------------------
//  Preparar e próximos meses
// ---------------------------------------------------------------------
function tarefasDeBandeja(m, an) {
  const semearAgora = [], proximos = [], preparar = [], aclimatar = [], canteiros = {};
  let celulasAgora = 0, celulasProx = 0;
  const frio = mesesFrioBandeja();
  let bandejaNoFrio = false;
  for (const z of zonasPlantaveis().sort(ordemNome)) {
    for (const e of an.entradasPorZona[z.id] || []) {
      if (!e.p) continue;
      const ci = cicloDe(e.p);
      if (ci.bandeja) {
        const ms = mesSemear(e.p, e.inicio);
        const pes = pesDaEntrada(an, z, e);
        if (ms === m) {
          celulasAgora += celulasPara(pes);
          semearAgora.push(itemTarefa(z, e, `para plantar em ${MESES[e.inicio - 1].toLowerCase()} · ${diasBandeja(e.p).join('–')} dias na bandeja · ~${celulasPara(pes)} células`, 'semeadura'));
        }
        for (const k of [1, 2]) {
          if (ms === mesMais(m, k)) {
            if (k === 1) celulasProx += celulasPara(pes);
            proximos.push(itemTarefa(z, e, `semear em <b>${MESES[ms - 1].toLowerCase()}</b> para plantar em ${MESES[e.inicio - 1].toLowerCase()}`));
          }
        }
        if (emBandeja(e.p, e.inicio, m) && frio.includes(m)) bandejaNoFrio = true;
        // aclimatar: no mês anterior ao transplante (última semana)
        if (mesMais(e.inicio, -1) === m) aclimatar.push(escapar(rotuloEntrada(z, e.entrada)));
      }
      // preparar o canteiro: plantios do mês que vem
      if (!e.p.perene && e.inicio === mesMais(m, 1)) (canteiros[z.id] ||= { z, nomes: [] }).nomes.push(escapar(rotuloEntrada(z, e.entrada)));
    }
  }
  const li = (icone, html) => `<li><span class="e">${icone}</span><span>${html}</span></li>`;
  if (celulasAgora) preparar.push(li('🧰', `<b>Semear este mês:</b> sementes, substrato e ${textoCelulas(celulasAgora)}`));
  if (celulasProx) preparar.push(li('🛒', `<b>Para ${MESES[mesMais(m, 1) - 1].toLowerCase()}:</b> garanta sementes e substrato — ${textoCelulas(celulasProx)}`));
  if (aclimatar.length) preparar.push(li('🌤️', `<b>Aclimatar</b> na última semana do mês: ${[...new Set(aclimatar)].join(', ')}<div class="sub">deixe as bandejas algumas horas por dia ao sol e ao vento, aumentando aos poucos</div>`));
  if (bandejaNoFrio) preparar.push(li('❄️', '<b>Bandejas no frio:</b> guarde em lugar protegido nas noites frias (dentro de casa ou numa estufinha) — no frio as mudas podem levar 1–2 semanas a mais'));
  const listaCant = Object.values(canteiros);
  const proxMes = MESES[mesMais(m, 1) - 1].toLowerCase();
  // muitos canteiros: uma linha só (clicar no nome abre o canteiro)
  if (listaCant.length > 3) {
    preparar.push(li('🪏', `<b>Preparar ${listaCant.length} canteiros</b> para os plantios de ${proxMes}: ${listaCant.map(({ z }) =>
      `<span class="link-zona" data-zona-sel="${z.id}">${escapar(z.nome)}</span>`).join(', ')}<div class="sub">afofe a terra e misture composto 2–3 semanas antes de plantar</div>`));
    listaCant.length = 0;
  }
  for (const { z, nomes } of listaCant) {
    preparar.push(`<li data-zona-sel="${z.id}"><span class="e">🪏</span><span><b>Preparar ${escapar(z.nome)}</b><div class="sub">afofe a terra e misture composto 2–3 semanas antes de plantar ${nomes.join(', ')} (${MESES[mesMais(m, 1) - 1].toLowerCase()})</div></span></li>`);
  }
  return { semearAgora, proximos, preparar };
}

// ---------------------------------------------------------------------
//  Bom para semear agora (ainda não planejado)
// ---------------------------------------------------------------------
function sugestoesBandeja(m) {
  const planejadas = new Set();
  const an = analiseHorta();
  for (const z of estado.zonas) for (const e of an.entradasPorZona[z.id] || []) if (e.p) planejadas.add(`${e.id}|${e.inicio}`);
  const candidatas = todasPlantas().filter(p => p.forma === 'muda' && !p.perene && p.sem.includes(m))
    .map(p => ({ p, t: mesMais(m, mesesBandeja(p)) }))
    .filter(({ p, t }) => mesesDeIrProCanteiro(p).includes(t) && !planejadas.has(`${p.id}|${t}`));
  if (!candidatas.length) return [];
  // avalia cada canteiro no mês em que a muda fica pronta
  const porMes = {};
  const res = [];
  for (const { p, t } of candidatas) {
    if (!porMes[t]) {
      porMes[t] = {};
      for (const z of zonasPlantaveis()) {
        for (const r of sugestoesPara(z, '', { mes: t, todas: true })) (porMes[t][r.p.id] ||= []).push({ z, r });
      }
    }
    const opcoes = (porMes[t][p.id] || []).filter(o => o.r.ok && !o.r.etiquetas.some(x => x.tipo === 'ruim' || x.tipo === 'repetida'))
      .sort((a, b) => b.r.pontos - a.r.pontos);
    if (opcoes.length) res.push({ p, t, z: opcoes[0].z, pontos: opcoes[0].r.pontos + (naLista(p.id) ? 5 : 0) });
  }
  return res.sort((a, b) => (naLista(b.p.id) - naLista(a.p.id)) || (b.pontos - a.pontos)).slice(0, 6);
}

// grupo = 'vegetais', 'ervas', 'flores'… (o mesmo das sugestões do canteiro); sem grupo = todas
function itensSugestaoBandeja(m, grupo) {
  return sugestoesBandeja(m).filter(s => !grupo || grupoDaPlanta(s.p) === grupo).map(({ p, t, z }) =>
    `<li><span class="e">${escapar(p.emoji)}</span><span><b>${escapar(p.nome)}</b>${naLista(p.id) ? ' <span class="estrela">★</span>' : ''}
      <div class="sub">semeie agora → muda pronta em ${MESES[t - 1].toLowerCase()} para o <b>${escapar(z.nome)}</b> (${diasBandeja(p).join('–')} dias)</div></span>
      <button class="btn-feito" data-planejar-bandeja="${escapar(p.id)}" data-zona="${z.id}" data-mes="${t}" title="Pôr no plano do ${escapar(z.nome)}">+</button></li>`);
}

function planejarDaBandeja(id, zonaId, mes) {
  const z = zonaPorId(zonaId);
  const p = plantaPorId(id);
  if (!z || !p) return;
  let entrada = id, n = 2;
  while ((z.plantas || []).includes(entrada)) entrada = `${id}#${n++}`;
  registrar();
  z.plantas = [...(z.plantas || []), entrada];
  z.plantio[entrada] = mes;
  mudou();
  avisar(`${p.emoji} ${p.nome} no plano do ${z.nome}: semear na bandeja agora, plantar em ${MESES[mes - 1].toLowerCase()}. (Ctrl+Z desfaz)`);
}

function montarBandeja() {
  document.addEventListener('click', ev => {
    const b = ev.target.closest('[data-planejar-bandeja]');
    if (!b) return;
    ev.stopPropagation();
    planejarDaBandeja(b.dataset.planejarBandeja, Number(b.dataset.zona), Number(b.dataset.mes));
  }, true);
}
