'use strict';

// =====================================================================
//  Minha Horta — Tempo: previsão de 7 dias, alertas de geada e de rega
//  Usa a API gratuita open-meteo.com. Só é ativada se você clicar em
//  "Ativar previsão": aí o navegador envia a localização APROXIMADA
//  (latitude/longitude com 2 casas, ~1 km) para o open-meteo.com.
// =====================================================================

const CHAVE_CLIMA = 'horta.clima.v1';
let previsao = null;        // { quando, dias: [{ data, min, max, chuva, prob }] }
let buscandoClima = false;

function carregarClimaGuardado() {
  try { previsao = JSON.parse(localStorage.getItem(CHAVE_CLIMA)) || null; } catch (_) { previsao = null; }
}

async function atualizarClima(forcar) {
  if (!estado.clima?.ativo || buscandoClima) return;
  if (!forcar && previsao && Date.now() - previsao.quando < 3 * 3600e3) return;   // guarda por 3 h
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
      quando: Date.now(),
      dias: d.time.map((t, i) => ({ data: t, min: d.temperature_2m_min[i], max: d.temperature_2m_max[i],
        chuva: d.precipitation_sum[i] || 0, prob: d.precipitation_probability_max?.[i] ?? null })),
    };
    try { localStorage.setItem(CHAVE_CLIMA, JSON.stringify(previsao)); } catch (_) { /* sem espaço */ }
  } catch (_) {
    avisar('Não consegui buscar a previsão do tempo agora (sem internet?).');
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
  if (!estado.clima?.ativo) {
    return `<section class="sec-clima"><h2>🌦️ Tempo</h2>
      <p class="nota">Previsão de 7 dias com alertas de <b>geada</b> e de <b>rega</b>. Para isso o app consulta o site open-meteo.com,
      enviando a localização aproximada da horta (~1 km: ${fmt(Number(estado.local.lat), 2)}, ${fmt(Number(estado.local.lon), 2)}).</p>
      <button data-clima="ativar">Ativar previsão do tempo</button></section>`;
  }
  if (!previsao) return `<section class="sec-clima"><h2>🌦️ Tempo</h2><p class="nota">${buscandoClima ? 'Buscando a previsão…' : 'Sem previsão ainda.'}</p>
    <button class="pequeno" data-clima="atualizar">↻ Atualizar</button> <button class="pequeno" data-clima="desativar">Desativar</button></section>`;
  const hoje = hojeISO();
  const dias = previsao.dias.filter(d => d.data >= hoje).slice(0, 7);
  const icone = d => d.min <= 3 ? '❄️' : d.chuva >= 10 ? '🌧️' : d.chuva >= 1 ? '🌦️' : d.max >= 30 ? '☀️' : '⛅';
  return `<section class="sec-clima"><h2>🌦️ Tempo <span class="nota">${new Date(previsao.quando).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span></h2>
    ${alertasClima().map(a => `<div class="alerta-clima ${a.nivel}">${escapar(a.texto)}</div>`).join('')}
    <div class="dias-clima">${dias.map(d => `<div class="dia" title="${fmt(d.chuva, 1)} mm${d.prob !== null ? ` · ${d.prob}% de chance` : ''}">
      <div class="nome">${d.data === hoje ? 'hoje' : new Date(d.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}</div>
      <div class="ic">${icone(d)}</div>
      <div class="max">${Math.round(d.max)}°</div><div class="min ${d.min <= 3 ? 'frio' : ''}">${Math.round(d.min)}°</div>
      ${d.chuva >= 1 ? `<div class="mm">${Math.round(d.chuva)} mm</div>` : ''}
    </div>`).join('')}</div>
    <div class="acoes-clima"><button class="pequeno" data-clima="atualizar">↻ Atualizar</button> <button class="pequeno" data-clima="desativar">Desativar</button></div>
  </section>`;
}

function montarClima() {
  carregarClimaGuardado();
  document.addEventListener('click', ev => {
    const a = ev.target.closest('[data-clima]')?.dataset.clima;
    if (!a) return;
    if (a === 'ativar') { registrar(); estado.clima = { ativo: true }; mudou(); atualizarClima(true); }
    else if (a === 'desativar') { registrar(); estado.clima = { ativo: false }; mudou(); }
    else if (a === 'atualizar') atualizarClima(true);
  });
  atualizarClima(false);
}
