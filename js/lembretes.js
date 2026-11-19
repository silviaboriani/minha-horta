'use strict';

// =====================================================================
//  Minha Horta — Lembretes: exporta o plano como calendário (.ics)
//  Abra o arquivo no iPad/celular (ou importe no Google Agenda) e as
//  tarefas aparecem no calendário, com alerta às 9h do dia.
// =====================================================================

function textoIcs(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}
const dataIcs = (ano, mes, dia) => `${ano}${String(mes).padStart(2, '0')}${String(dia).padStart(2, '0')}`;

// Eventos dos próximos 12 meses a partir do mês atual
function eventosDoPlano() {
  const hoje = new Date();
  const mesHoje = hoje.getMonth() + 1, anoHoje = hoje.getFullYear();
  const anoDe = m => (m >= mesHoje ? anoHoje : anoHoje + 1);
  const an = analiseHorta();
  const eventos = [];
  for (const z of estado.zonas) {
    for (const e of an.entradasPorZona[z.id] || []) {
      if (!e.p) continue;
      const nome = rotuloEntrada(z, e.entrada);
      const qtd = e.qtd ? ` (${e.qtd} pés)` : '';
      if (cicloDe(e.p).bandeja) {
        const m = mesSemear(e.p, e.inicio);
        eventos.push({ tipo: 'bandeja', m, ano: anoDe(m), titulo: `🌰 Semear ${nome} na bandeja`, desc: `Mudas para plantar em ${MESES[e.inicio - 1].toLowerCase()} no ${z.nome} (${diasBandeja(e.p).join('–')} dias na bandeja). Semeie ~${Math.ceil((e.qtd || minPes(e.p)) * 1.5)} células.`, z, e });
        eventos.push({ tipo: 'aclimatar', m: mesMais(e.inicio, -1), ano: anoDe(mesMais(e.inicio, -1)), titulo: `🌤️ Aclimatar as mudas de ${nome}`, desc: `Uma semana antes de transplantar, deixe a bandeja algumas horas por dia ao sol e ao vento.`, z, e });
      }
      eventos.push({ tipo: 'plantar', m: e.inicio, ano: anoDe(e.inicio), titulo: `🌱 Plantar ${nome} — ${z.nome}${qtd}`,
        desc: `${e.p.forma === 'muda' ? 'Transplantar as mudas' : FORMAS[e.p.forma] || ''}. ${e.p.dica || ''}`, z, e });
      const colheita = [...e.ativos].filter(m => statusNoMes(e.p, e.inicio, m) === 'colher');
      if (colheita.length && !e.p.perene) {
        // primeiro mês de colheita depois do plantio
        const primeiro = colheita.sort((a, b) => ((a - e.inicio + 12) % 12) - ((b - e.inicio + 12) % 12))[0];
        const anoP = anoDe(e.inicio) + (primeiro < e.inicio ? 1 : 0);
        eventos.push({ tipo: 'colher', m: primeiro, ano: anoP, titulo: ehFlor(e.p) ? `🌸 ${nome} começa a florir — ${z.nome}` : `🧺 Começar a colher ${nome} — ${z.nome}`, desc: `${ehFlor(e.p) ? 'Flores' : 'Colheita'} até ${MESES[colheita.sort((a, b) => ((a - e.inicio + 12) % 12) - ((b - e.inicio + 12) % 12)).slice(-1)[0] - 1].toLowerCase()}.`, z, e });
      }
    }
  }
  return eventos.sort((a, b) => (a.ano - b.ano) || (a.m - b.m));
}

function gerarIcs() {
  const agora = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const linhas = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Minha Horta//PT-BR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${textoIcs(estado.nome || 'Minha Horta')}`];
  for (const ev of eventosDoPlano()) {
    // dia 1 do mês (dia 5 para colher, para dar tempo)
    const dia = ev.tipo === 'colher' ? 5 : ev.tipo === 'aclimatar' ? 22 : 1;   // aclimatar: ~1 semana antes do plantio (dia 1)
    const fim = new Date(ev.ano, ev.m - 1, dia + 1);
    linhas.push('BEGIN:VEVENT',
      `UID:${textoIcs(`${ev.z.id}-${ev.e.entrada}-${ev.tipo}-${ev.ano}${ev.m}`)}@minha-horta`,
      `DTSTAMP:${agora}`,
      `DTSTART;VALUE=DATE:${dataIcs(ev.ano, ev.m, dia)}`,
      `DTEND;VALUE=DATE:${dataIcs(fim.getFullYear(), fim.getMonth() + 1, fim.getDate())}`,
      `SUMMARY:${textoIcs(ev.titulo)}`,
      `DESCRIPTION:${textoIcs(ev.desc)}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${textoIcs(ev.titulo)}`, 'TRIGGER:PT9H', 'END:VALARM',
      'END:VEVENT');
  }
  linhas.push('END:VCALENDAR');
  return linhas.join('\r\n');
}

function exportarLembretes() {
  const n = eventosDoPlano().length;
  if (!n) { avisar('Ainda não há plantios planejados para virar lembrete.'); return; }
  baixar(new Blob([gerarIcs()], { type: 'text/calendar' }), nomeArquivo('ics'));
  avisar(`📅 ${n} lembretes exportados. Abra o arquivo no iPad/celular (ou importe no Google Agenda) para adicionar ao calendário.`);
}

function montarLembretes() {
  document.addEventListener('click', ev => { if (ev.target.closest('[data-exportar-lembretes]')) exportarLembretes(); });
}
