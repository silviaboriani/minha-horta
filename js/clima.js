'use strict';

// =====================================================================
//  Minha Horta — Tempo: previsão de 7 dias, alertas de geada e de rega
//  Usa a API gratuita open-meteo.com. Fica sempre ligada depois que a horta
//  tem um lugar: o navegador envia só a localização APROXIMADA
//  (latitude/longitude com 2 casas, ~1 km) para o open-meteo.com.
// =====================================================================

const CHAVE_CLIMA = 'horta.clima.v1';
let previsao = null;        // { quando, dias: [{ data, min, max, chuva, prob }] }
let buscandoClima = false;
let tentouClimaEm = 0;      // sem internet: não tenta de novo a cada tela, só depois de 10 min

function carregarClimaGuardado() {
  try { previsao = JSON.parse(localStorage.getItem(CHAVE_CLIMA)) || null; } catch (_) { previsao = null; }
}

// Precisa buscar a previsão? (pura: só olha os dados) — sem lugar definido, não busca
function climaPrecisaBuscar(local, prev, agora, tentouEm) {
  if (local?.definido === false) return false;
  const lat = Number(local.lat).toFixed(2), lon = Number(local.lon).toFixed(2);
  const daqui = prev && prev.lat === lat && prev.lon === lon;
  if (daqui && agora - prev.quando < 3 * 3600e3) return false;   // guarda por 3 h
  return agora - tentouEm > 10 * 60e3;
}

async function atualizarClima(forcar) {
  if (buscandoClima || estado.local?.definido === false) return;
  if (!forcar && !climaPrecisaBuscar(estado.local, previsao, Date.now(), tentouClimaEm)) return;
  tentouClimaEm = Date.now();
  const lat = Number(estado.local.lat).toFixed(2), lon = Number(estado.local.lon).toFixed(2);
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    '&daily=temperature_2m_min,temperature_2m_max,precipitation_sum,precipitation_probability_max' +
    '&past_days=2&forecast_days=7&timezone=America%2FSao_Paulo';
  buscandoClima = true;
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(r.status);
    const j = await r.json();
    const d = j.daily;
    previsao = {
      quando: Date.now(), lat, lon,
      dias: d.time.map((t, i) => ({ data: t, min: d.temperature_2m_min[i], max: d.temperature_2m_max[i],
        chuva: d.precipitation_sum[i] || 0, prob: d.precipitation_probability_max?.[i] ?? null })),
    };
    try { localStorage.setItem(CHAVE_CLIMA, JSON.stringify(previsao)); } catch (_) { /* sem espaço */ }
  } catch (_) {
    if (forcar) avisar('Não consegui buscar a previsão do tempo agora (sem internet?).');
  } finally {
    buscandoClima = false;
    if (modo === 'mapa') renderCalendario();
  }
}

// Plantas sensíveis a geada que estão no canteiro no mês de hoje
function sensiveisAgora() {
  const m = new Date().getMonth() + 1;
  const an = analiseHorta();
  const res = [];
  for (const z of estado.zonas) {
    for (const e of an.entradasPorZona[z.id] || []) {
      if (e.p && e.p.geada && statusNoMes(e.p, e.inicio, m)) res.push(`${e.p.nome} (${z.nome})`);
    }
  }
  return [...new Set(res)];
}

function alertasClima() {
  if (!previsao) return [];
  const hoje = hojeISO();
  const futuros = previsao.dias.filter(d => d.data >= hoje);
  const passados = previsao.dias.filter(d => d.data < hoje);
  const alertas = [];
  const diaNome = iso => { const d = new Date(iso + 'T12:00:00'); return iso === hoje ? 'hoje' : d.toLocaleDateString('pt-BR', { weekday: 'long' }); };

  const frio = futuros.find(d => d.min <= 3);
  if (frio) {
    const sens = sensiveisAgora();
    alertas.push({ nivel: 'mal', texto: `❄️ ${frio.min <= 0 ? 'Geada forte' : 'Risco de geada'} ${diaNome(frio.data)} (mínima ${fmt(frio.min, 1)} °C).` +
      (sens.length ? ` Cubra: ${sens.slice(0, 6).join(', ')}${sens.length > 6 ? '…' : ''}.` : ' Proteja as mudas e plantas sensíveis.') });
  }
  const hojeD = futuros[0];
  if (hojeD) {
    const chuvaRecente = passados.reduce((s, d) => s + d.chuva, 0) + hojeD.chuva;
    const chuvaAmanha = futuros[1]?.chuva || 0;
    if (chuvaRecente + chuvaAmanha >= 10) alertas.push({ nivel: 'bem', texto: `🌧️ Não precisa regar: ${fmt(chuvaRecente + chuvaAmanha, 0)} mm de chuva entre ontem e amanhã.` });
    else if (hojeD.max >= 25 && chuvaRecente < 5) alertas.push({ nivel: 'atencao', texto: `💧 Regue hoje: pouca chuva (${fmt(chuvaRecente, 0)} mm) e máxima de ${fmt(hojeD.max, 0)} °C. Prefira o começo da manhã.` });
    if (hojeD.max >= 32) alertas.push({ nivel: 'atencao', texto: '🔥 Calor forte: regue cedo e dê sombra para alfaces e mudas novas.' });
  }
  return alertas;
}

function htmlClima() {
  if (estado.local?.definido === false) return '';   // sem lugar, não há previsão (o "Primeiros passos" pede o lugar)
  queueMicrotask(() => atualizarClima(false));        // busca se ainda não tem a previsão deste lugar
  if (!previsao) return `<section class="sec-clima"><div class="linha-clima">🌦️ <span class="nota">${buscandoClima ? 'Buscando a previsão…' : 'Sem previsão ainda.'}</span>
    <button class="pequeno" data-clima="atualizar">↻</button></div></section>`;
  const hoje = hojeISO();
  const dias = previsao.dias.filter(d => d.data >= hoje).slice(0, 7);
  const icone = d => d.min <= 3 ? '❄️' : d.chuva >= 10 ? '🌧️' : d.chuva >= 1 ? '🌦️' : d.max >= 30 ? '☀️' : '⛅';
  const d0 = dias[0];
  // Uma linha com o dia de hoje; os 7 dias abrem ao tocar. Os alertas ficam sempre à mostra.
  return `<section class="sec-clima"><details class="clima-det" data-chave="clima" ${estaAberto('clima', false) ? 'open' : ''}>
    <summary>🌦️ <b>Tempo</b>${d0 ? ` · hoje ${icone(d0)} ${Math.round(d0.max)}° / ${Math.round(d0.min)}°${d0.chuva >= 1 ? ` · ${Math.round(d0.chuva)} mm` : ''}` : ''}
      <span class="nota">· 7 dias</span></summary>
    <div class="dias-clima">${dias.map(d => `<div class="dia" title="${fmt(d.chuva, 1)} mm${d.prob !== null ? ` · ${d.prob}% de chance` : ''}">
      <div class="nome">${d.data === hoje ? 'hoje' : new Date(d.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}</div>
      <div class="ic">${icone(d)}</div>
      <div class="max">${Math.round(d.max)}°</div><div class="min ${d.min <= 3 ? 'frio' : ''}">${Math.round(d.min)}°</div>
      ${d.chuva >= 1 ? `<div class="mm">${Math.round(d.chuva)} mm</div>` : ''}
    </div>`).join('')}</div>
    <div class="acoes-clima"><span class="nota">atualizado às ${new Date(previsao.quando).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
      <button class="pequeno" data-clima="atualizar">↻ Atualizar</button></div>
    <p class="nota">Do open-meteo.com, com a localização aproximada da horta (~1 km).</p>
    </details>
    ${alertasClima().map(a => `<div class="alerta-clima ${a.nivel}">${escapar(a.texto)}</div>`).join('')}
  </section>`;
}

function montarClima() {
  carregarClimaGuardado();
  document.addEventListener('click', ev => {
    const a = ev.target.closest('[data-clima]')?.dataset.clima;
    if (!a) return;
    if (a === 'atualizar') atualizarClima(true);
  });
  atualizarClima(false);
}
