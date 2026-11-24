'use strict';
// =====================================================================
//  Testes da horta compartilhada (nuvem.js), com um Firebase "de mentira"
//  que guarda tudo na memória — não usa a internet nem o banco de verdade.
//
//  Como rodar: abra o app numa aba SEPARADA (http://localhost:8080/) e, no console:
//    const s = document.createElement('script'); s.src = 'testes/nuvem.test.js'; document.body.append(s);
//  O resultado aparece no console e em window.resultadoTestes.
//  Nada é gravado no navegador: salvar, projetos guardados e a ligação com a nuvem ficam só na memória.
// =====================================================================
(async () => {
  const erros = [];
  window.addEventListener('error', ev => erros.push(ev.message));
  const espera = ms => new Promise(r => setTimeout(r, ms));
  const copia = v => JSON.parse(JSON.stringify(v));

  // nunca gravar nada de verdade: nem a horta, nem a ligação com a nuvem, nem o que trocarDeProjeto apaga
  const setOrig = Storage.prototype.setItem, removeOrig = Storage.prototype.removeItem;
  Storage.prototype.setItem = function () {}; Storage.prototype.removeItem = function () {};
  let memNuvem = { hortas: {} }, guardados = 0;
  window.salvar = () => nuvemMudou();
  window.lerNuvemLocal = () => copia(memNuvem);
  const carregarNuvemOrig = carregarNuvem;
  window.gravarNuvemLocal = mudar => { const d = copia(memNuvem); mudar(d); memNuvem = d; };
  window.guardarProjetoAtual = () => { guardados++; return true; };
  window.perguntar = async () => true;
  const avisos = []; const avisarOrig = avisar; window.avisar = m => { avisos.push(m); };

  const EU = { uid: 'u-silvia', email: 'silvia@exemplo.com', nome: 'Silvia' };
  // Firebase de mentira: documentos na memória, avisa quem está ouvindo, pode "ficar sem internet"
  function backendFalso() {
    const docs = {}, ouvintes = {}, erros = {};
    let n = 0, cbUsuario = null;
    const semRede = () => Object.assign(new Error('sem rede'), { code: 'unavailable' });
    const avisarOuvintes = id => (ouvintes[id] || []).forEach(cb => setTimeout(() => cb(docs[id] ? copia(docs[id]) : null), 0));
    const b = {
      docs, offline: false,
      aoMudarUsuario: cb => { cbUsuario = cb; },
      entrar: async () => cbUsuario(EU),
      sair: async () => cbUsuario(null),
      criar: async dados => { if (b.offline) throw semRede(); const id = 'h' + (++n); docs[id] = copia(dados); avisarOuvintes(id); return id; },
      ler: async id => {
        if (docs[id] && !docs[id].emails.includes(EU.email)) throw Object.assign(new Error('negado'), { code: 'permission-denied' });
        return docs[id] ? copia(docs[id]) : null;
      },
      entrarComConvite: async (id, codigo, email) => {
        const d = docs[id];
        if (!d || !d.convite || d.convite !== codigo || !(d.conviteAte > Date.now()) || d.emails.includes(email))
          throw Object.assign(new Error('negado'), { code: 'permission-denied' });
        d.emails.push(email); d.ultimoCodigo = codigo; avisarOuvintes(id);
      },
      entraPessoa: (id, email) => { docs[id].emails.push(email); avisarOuvintes(id); },
      noMeio: null,
      gravados: [],   // cada versão que o app gravou (para ver se alguma "apagou" a de outra pessoa)   // função que roda entre a transação começar e ler o documento (outra pessoa gravando)
      transacao: async (id, mudar) => {
        await espera(1);
        if (b.noMeio) { const f = b.noMeio; b.noMeio = null; await f(); }
        if (b.offline) throw semRede();
        if (!docs[id]) throw Object.assign(new Error('sumiu'), { code: 'not-found' });
        const m = mudar(copia(docs[id]));
        if (m) { Object.assign(docs[id], copia(m)); b.gravados.push(docs[id].estado); avisarOuvintes(id); }
        return m;
      },
      ouvir: (id, cb, erro) => {
        (ouvintes[id] = ouvintes[id] || []).push(cb);
        (erros[id] = erros[id] || []).push(erro);
        setTimeout(() => cb(docs[id] ? copia(docs[id]) : null), 0);
        return () => { ouvintes[id] = ouvintes[id].filter(x => x !== cb); };
      },
      listar: async email => Object.entries(docs).filter(([, d]) => d.emails.includes(email)).map(([id, d]) => ({ id, ...copia(d) })),
      apagar: async id => { delete docs[id]; avisarOuvintes(id); },
      // tiraram esta pessoa da horta: quem está ouvindo recebe "sem permissão"
      negar: id => (erros[id] || []).forEach(e => setTimeout(() => e(Object.assign(new Error('negado'), { code: 'permission-denied' })), 0)),
      // outra pessoa grava pelo app dela
      outraPessoaMuda: (id, mudar) => { const e = JSON.parse(docs[id].estado); mudar(e); docs[id].estado = JSON.stringify(e); docs[id].versao++; avisarOuvintes(id); },
      criarDeOutraPessoa: (nome, estadoObj, extra = {}) => { const id = 'h' + (++n); docs[id] = { nome, dono: 'u-outra', donoEmail: 'ana@exemplo.com', emails: ['ana@exemplo.com', EU.email], estado: JSON.stringify(estadoObj), versao: 3, ...extra }; return id; },
    };
    return b;
  }

  const resultados = [];
  const teste = async (nome, fn) => {
    try { const ok = await fn(); resultados.push({ nome, ok: ok === true, detalhe: ok === true ? '' : String(ok) }); }
    catch (e) { resultados.push({ nome, ok: false, detalhe: 'erro: ' + e.message }); }
    desligarHorta();   // nenhum envio atrasado vaza para o próximo teste
    ponteiro = null;
  };
  const zona = nome => estado.zonas.find(z => z.nome === nome);

  // horta de exemplo, entrou com Google, nada compartilhado ainda
  async function comecar() {
    desligarHorta();
    memNuvem = { hortas: {} }; guardados = 0;
    estado = migrar(criarExemploHorta()); invalidarSol();
    document.querySelectorAll('.modal').forEach(m => m.classList.add('oculto'));
    nuvem.status = ''; nuvem.outras = []; nuvem.usuario = null;
    const b = backendFalso();
    usarBackendNuvem(b);
    await b.entrar();
    await espera(10);
    return b;
  }
  async function compartilhada() {
    const b = await comecar();
    await compartilharHorta();
    await espera(10);
    clearTimeout(nuvem.timer); nuvem.timer = null;
    await enviarParaNuvem();   // manda a versão com o nuvemId
    await espera(10);
    return b;
  }

  // ---------------------------------------------------------------- compartilhar
  await teste('compartilhar: cria a horta na nuvem só com você, e liga esta horta a ela', async () => {
    const b = await compartilhada();
    const id = estado.nuvemId, d = b.docs[id];
    if (!d) return 'não criou';
    return (d.dono === EU.uid && JSON.stringify(d.emails) === JSON.stringify([EU.email]) && nuvem.id === id
      && JSON.parse(d.estado).nuvemId === id && d.versao === 2 && !historico.length) || JSON.stringify({ emails: d.emails, versao: d.versao });
  });

  await teste('mudança aqui vai para a nuvem', async () => {
    const b = await compartilhada();
    zona('Canteiro 1').nome = 'Alfaces';
    salvar();
    clearTimeout(nuvem.timer); nuvem.timer = null;
    await enviarParaNuvem();
    const nuvemEstado = JSON.parse(b.docs[estado.nuvemId].estado);
    return nuvemEstado.zonas.some(z => z.nome === 'Alfaces') || 'não chegou';
  });

  await teste('mudança de outra pessoa chega ao vivo (e "desfazer" não a desfaz)', async () => {
    const b = await compartilhada();
    registrar(); zona('Canteiro 2').nome = 'Ervas'; salvar();   // algo no histórico daqui
    clearTimeout(nuvem.timer); nuvem.timer = null; await enviarParaNuvem();
    b.outraPessoaMuda(estado.nuvemId, e => { e.zonas.find(z => z.nome === 'Canteiro 3').nome = 'Tomates da Ana'; });
    await espera(20);
    return (!!zona('Tomates da Ana') && !!zona('Ervas') && historico.length === 0) || `tomates ${!!zona('Tomates da Ana')}, histórico ${historico.length}`;
  });

  await teste('as duas mudando ao mesmo tempo: as duas mudanças ficam (aqui e na nuvem)', async () => {
    const b = await compartilhada();
    zona('Canteiro 1').nome = 'Minha mudança'; salvar();   // ainda não enviada
    b.outraPessoaMuda(estado.nuvemId, e => { e.zonas.find(z => z.nome === 'Canteiro 4').nome = 'Mudança da Ana'; });
    await espera(20);
    clearTimeout(nuvem.timer); nuvem.timer = null;
    await enviarParaNuvem();
    const n = JSON.parse(b.docs[estado.nuvemId].estado);
    const naNuvem = ['Minha mudança', 'Mudança da Ana'].every(x => n.zonas.some(z => z.nome === x));
    const aqui = !!zona('Minha mudança') && !!zona('Mudança da Ana');
    return (naNuvem && aqui) || `nuvem ${naNuvem}, aqui ${aqui}`;
  });

  await teste('as duas mudando o mesmo canteiro no mesmo instante: vale a mais nova (a de quem envia por último)', async () => {
    const b = await compartilhada();
    b.outraPessoaMuda(estado.nuvemId, e => { e.zonas.find(z => z.nome === 'Canteiro 5').nome = 'Nome da Ana'; });
    zona('Canteiro 5').nome = 'Meu nome';   // mudou aqui antes de receber a dela
    clearTimeout(nuvem.timer); nuvem.timer = null;
    await enviarParaNuvem();
    await espera(20);
    const n = JSON.parse(b.docs[estado.nuvemId].estado);
    return (n.zonas.some(z => z.nome === 'Meu nome') && !!zona('Meu nome')) || 'não ficou a mais nova';
  });

  await teste('sem internet: a mudança fica aqui e vai quando a conexão volta', async () => {
    const b = await compartilhada();
    b.offline = true;
    zona('Canteiro 1').nome = 'Feito sem internet'; salvar();
    clearTimeout(nuvem.timer); nuvem.timer = null;
    await enviarParaNuvem();
    const avisou = /Sem internet/.test(nuvem.status) && !!zona('Feito sem internet');
    b.offline = false;
    clearTimeout(nuvem.timer); nuvem.timer = null;
    await enviarParaNuvem();
    const n = JSON.parse(b.docs[estado.nuvemId].estado);
    return (avisou && n.zonas.some(z => z.nome === 'Feito sem internet')) || `avisou ${avisou}, status "${nuvem.status}"`;
  });

  await teste('mudanças feitas antes de fechar o app vão ao conectar de novo', async () => {
    const b = await compartilhada();
    const id = estado.nuvemId;
    desligarHorta();   // "fechou o app"
    zona('Canteiro 2').nome = 'Mudei com o app fechado';
    ligarHorta(); await espera(20);
    clearTimeout(nuvem.timer); nuvem.timer = null;
    await enviarParaNuvem();
    return JSON.parse(b.docs[id].estado).zonas.some(z => z.nome === 'Mudei com o app fechado') || 'não foi';
  });

  await teste('arquivo aberto num aparelho sem histórico: vale a da nuvem, e a daqui vai para os projetos', async () => {
    const b = await compartilhada();
    const id = estado.nuvemId;
    desligarHorta(); memNuvem = { hortas: {} };   // outro aparelho
    zona('Canteiro 1').nome = 'Versão do arquivo';
    ligarHorta(); await espera(20);
    const n = JSON.parse(b.docs[id].estado);
    return (!zona('Versão do arquivo') && guardados === 1 && !n.zonas.some(z => z.nome === 'Versão do arquivo')) || `aqui ${!!zona('Versão do arquivo')}, guardados ${guardados}`;
  });

  await teste('no meio de um arrasto, o que chega espera o arrasto acabar', async () => {
    const b = await compartilhada();
    ponteiro = { modo: 'moverZona' };
    b.outraPessoaMuda(estado.nuvemId, e => { e.zonas.find(z => z.nome === 'Canteiro 3').nome = 'Chegou depois'; });
    await espera(30);
    const antes = !!zona('Chegou depois');
    ponteiro = null;
    await espera(800);
    return (!antes && !!zona('Chegou depois')) || `aplicou durante o arrasto: ${antes}`;
  });

  await teste('outra pessoa grava bem no meio do meu envio: as duas mudanças ficam', async () => {
    const b = await compartilhada();
    zona('Canteiro 1').nome = 'Minha no meio';
    b.noMeio = async () => {
      b.outraPessoaMuda(estado.nuvemId, e => { e.zonas.find(z => z.nome === 'Canteiro 2').nome = 'Da Ana no meio'; });
      await espera(10);   // a versão dela chega aqui enquanto o meu envio está em andamento
    };
    clearTimeout(nuvem.timer); nuvem.timer = null;
    await enviarParaNuvem();
    await espera(800);    // o que ficou esperando o envio acabar é aplicado
    const n = JSON.parse(b.docs[estado.nuvemId].estado);
    const naNuvem = n.zonas.some(z => z.nome === 'Minha no meio') && n.zonas.some(z => z.nome === 'Da Ana no meio');
    const aqui = !!zona('Minha no meio') && !!zona('Da Ana no meio');
    // nenhuma gravação depois da dela pode ter apagado a mudança dela, nem por um instante
    const apagou = b.gravados.filter(g => g.includes('Minha no meio')).some(g => !g.includes('Da Ana no meio'));
    return (naNuvem && aqui && !apagou) || `nuvem ${naNuvem}, aqui ${aqui}, apagou por um instante ${apagou}`;
  });

  await teste('digitando num campo: o que chega espera a pessoa sair do campo', async () => {
    const b = await compartilhada();
    const campo = document.createElement('input'); document.body.append(campo); campo.focus();
    b.outraPessoaMuda(estado.nuvemId, e => { e.zonas.find(z => z.nome === 'Canteiro 3').nome = 'Chegou depois do campo'; });
    await espera(30);
    const antes = !!zona('Chegou depois do campo');
    campo.blur(); campo.remove();
    await espera(800);
    return (!antes && !!zona('Chegou depois do campo')) || `aplicou enquanto digitava: ${antes}`;
  });

  await teste('tiraram você da horta: desliga aqui, a cópia continua (e não fica presa)', async () => {
    const b = await compartilhada();
    b.negar(estado.nuvemId);
    await espera(20);
    renderNuvem();
    return (!estado.nuvemId && !nuvem.id && estado.zonas.length > 0 && !!document.querySelector('#nuvemCaixa [data-nuvem="compartilhar"]')) || `ainda ligada: ${estado.nuvemId}`;
  });

  await teste('abriu o app sem internet: quando a conexão volta, conecta', async () => {
    await compartilhada();
    const id = estado.nuvemId;
    desligarHorta(); backendNuvem = null;
    let chamou = 0;
    window.carregarNuvem = async () => { chamou++; return null; };
    window.dispatchEvent(new Event('online'));
    window.carregarNuvem = carregarNuvemOrig;
    return (chamou === 1 && estado.nuvemId === id) || `chamou ${chamou}`;
  });

  // ---------------------------------------------------------------- pessoas
  await teste('convite: a dona cria o link (vale 7 dias) e aparecem "Enviar convite" e "Copiar link"', async () => {
    const b = await compartilhada();
    renderNuvem();
    if (!document.querySelector('#nuvemCaixa [data-nuvem="criar-convite"]')) return 'sem o botão de criar link';
    await criarConvite(); await espera(20);
    const d = b.docs[estado.nuvemId];
    const dias = (d.conviteAte - Date.now()) / 864e5;
    const link = linkConvite(estado.nuvemId, d.convite);
    renderNuvem();
    const botoes = ['enviar-convite', 'copiar-convite', 'cancelar-convite'].every(a => document.querySelector(`#nuvemCaixa [data-nuvem="${a}"]`));
    return (d.convite.length >= 20 && dias > 6.9 && dias <= 7 && link.includes('?horta=' + estado.nuvemId + '&convite=' + d.convite) && botoes)
      || JSON.stringify({ codigo: d.convite, dias, link, botoes });
  });

  await teste('quem entrou pelo link aparece na lista; a dona pode tirar', async () => {
    const b = await compartilhada();
    b.entraPessoa(estado.nuvemId, 'ana@exemplo.com'); await espera(20);
    renderNuvem();
    const botao = document.querySelector('#nuvemCaixa [data-nuvem="tirar"][data-email="ana@exemplo.com"]');
    if (!$('nuvemCaixa').textContent.includes('ana@exemplo.com') || !botao) return 'lista sem a Ana ou sem o botão';
    await tirarPessoa('ana@exemplo.com');
    return !b.docs[estado.nuvemId].emails.includes('ana@exemplo.com') || 'não tirou';
  });

  await teste('abrir o link de convite: entra na horta e ela abre', async () => {
    const b = await comecar();
    const outra = migrar(criarExemploHorta()); outra.zonas[0].nome = 'Canteiro do convite';
    const id = b.criarDeOutraPessoa('Horta da Ana', outra, { emails: ['ana@exemplo.com'], convite: 'codigo-certo-123', conviteAte: Date.now() + 864e5 });
    await aceitarConvite(id, 'codigo-certo-123'); await espera(20);
    return (b.docs[id].emails.includes(EU.email) && estado.nuvemId === id && !!zona('Canteiro do convite')) || `emails ${b.docs[id].emails}, aberta ${estado.nuvemId}`;
  });

  await teste('link vencido, cancelado ou com código errado: não entra e explica', async () => {
    const b = await comecar();
    const vencido = b.criarDeOutraPessoa('Vencida', migrar(criarExemploHorta()), { emails: ['ana@exemplo.com'], convite: 'abc', conviteAte: Date.now() - 1000 });
    const cancelado = b.criarDeOutraPessoa('Cancelada', migrar(criarExemploHorta()), { emails: ['ana@exemplo.com'], convite: null, conviteAte: null });
    const errado = b.criarDeOutraPessoa('Errada', migrar(criarExemploHorta()), { emails: ['ana@exemplo.com'], convite: 'certo', conviteAte: Date.now() + 864e5 });
    avisos.length = 0;
    await aceitarConvite(vencido, 'abc'); await aceitarConvite(cancelado, 'abc'); await aceitarConvite(errado, 'errado');
    const entrou = [vencido, cancelado, errado].some(id => b.docs[id].emails.includes(EU.email));
    return (!entrou && !estado.nuvemId && avisos.filter(m => /expirou ou foi cancelado/.test(m)).length === 3) || `entrou ${entrou}, avisos ${avisos}`;
  });

  await teste('abrir o link sem estar logada: pede para entrar com Google e depois entra', async () => {
    const b = await comecar();
    await b.sair(); await espera(10);
    const id = b.criarDeOutraPessoa('Horta da Ana', migrar(criarExemploHorta()), { emails: ['ana@exemplo.com'], convite: 'xyz', conviteAte: Date.now() + 864e5 });
    await aceitarConvite(id, 'xyz'); await espera(20);
    return (!!nuvem.usuario && b.docs[id].emails.includes(EU.email) && estado.nuvemId === id) || 'não entrou';
  });

  await teste('já está na horta e abre o link de novo: só abre', async () => {
    const b = await comecar();
    const id = b.criarDeOutraPessoa('Horta da Ana', migrar(criarExemploHorta()), { convite: 'xyz', conviteAte: Date.now() + 864e5 });
    await aceitarConvite(id, 'xyz'); await espera(20);
    return (estado.nuvemId === id && b.docs[id].emails.filter(e => e === EU.email).length === 1) || 'duplicou ou não abriu';
  });

  await teste('cancelar o link: quem tentar com ele não entra', async () => {
    const b = await compartilhada();
    await criarConvite(); await espera(20);
    const id = estado.nuvemId, codigo = b.docs[id].convite;
    await cancelarConvite(); await espera(20);
    b.docs[id].emails = ['outra@exemplo.com'];   // finge ser outra pessoa tentando (EU fora da lista)
    let entrou = true;
    try { await b.entrarComConvite(id, codigo, EU.email); } catch (_) { entrou = false; }
    return (!entrou && b.docs[id].convite === null) || 'entrou com link cancelado';
  });

  await teste('quem não é a dona não cria link (pede à dona)', async () => {
    const b = await comecar();
    const id = b.criarDeOutraPessoa('Horta da Ana', migrar(criarExemploHorta()));
    await abrirCompartilhada(id); await espera(20);
    renderNuvem();
    return (!document.querySelector('#nuvemCaixa [data-nuvem="criar-convite"]') && /peça um link/.test($('nuvemCaixa').textContent)) || 'convidada pode criar link';
  });

  await teste('o Firebase ainda carregando: quem chama de novo espera o mesmo carregamento (não dá "sem internet")', async () => {
    desligarHorta(); backendNuvem = null; nuvem.usuario = null;
    let vezes = 0;
    const orig = backendFirebase;
    window.backendFirebase = async () => { vezes++; await espera(50); return backendFalso(); };
    const [a, b] = await Promise.all([carregarNuvem(), carregarNuvem()]);
    window.backendFirebase = orig;
    return (!!a && a === b && vezes === 1 && !nuvem.carregando) || `a ${!!a}, igual ${a === b}, vezes ${vezes}`;
  });

  await teste('abrir pelo convite: as boas-vindas não ficam por cima da horta', async () => {
    const b = await comecar();
    const id = b.criarDeOutraPessoa('Horta da Ana', migrar(criarExemploHorta()), { emails: ['ana@exemplo.com'], convite: 'abc', conviteAte: Date.now() + 864e5 });
    $('modalInicio').classList.remove('oculto');
    await aceitarConvite(id, 'abc'); await espera(20);
    return ($('modalInicio').classList.contains('oculto') && estado.nuvemId === id) || 'boas-vindas por cima';
  });

  await teste('tirar alguém com o link valendo: oferece cancelar o link (senão a pessoa volta por ele)', async () => {
    const b = await compartilhada();
    await criarConvite(); await espera(20);
    b.entraPessoa(estado.nuvemId, 'ana@exemplo.com'); await espera(20);
    const perguntas = [];
    const orig = perguntar; window.perguntar = async p => { perguntas.push(p.titulo); return true; };
    await tirarPessoa('ana@exemplo.com'); await espera(20);
    window.perguntar = orig;
    return (perguntas.some(p => /link de convite/.test(p)) && !conviteValido(b.docs[estado.nuvemId])) || `perguntas ${perguntas}`;
  });

  await teste('link na barra de endereço: começa o convite e some da barra', async () => {
    const antes = location.href;
    history.replaceState(null, '', location.pathname + '?horta=h99&convite=abc');
    let args = null;
    const orig = aceitarConvite; window.aceitarConvite = (...a) => { args = a; };
    conviteNaEntrada();
    window.aceitarConvite = orig;
    const limpou = !location.search;
    history.replaceState(null, '', antes);
    return (JSON.stringify(args) === '["h99","abc"]' && limpou) || `args ${JSON.stringify(args)}, limpou ${limpou}`;
  });

  await teste('horta compartilhada com você: aparece na lista e abre (a de antes vai para os projetos)', async () => {
    const b = await comecar();
    const outra = migrar(criarExemploHorta()); outra.nome = 'Horta da Ana'; outra.zonas[0].nome = 'Canteiro da Ana';
    const id = b.criarDeOutraPessoa('Horta da Ana', outra);
    await listarOutras();
    renderNuvem();
    if (!$('nuvemCaixa').textContent.includes('Horta da Ana')) return 'não aparece na lista';
    await abrirCompartilhada(id);
    await espera(20);
    return (estado.nuvemId === id && nuvem.id === id && !!zona('Canteiro da Ana') && guardados === 1) || `id ${estado.nuvemId}, guardados ${guardados}`;
  });

  await teste('quem foi convidada pode sair da horta (a cópia dela continua)', async () => {
    const b = await comecar();
    const id = b.criarDeOutraPessoa('Horta da Ana', migrar(criarExemploHorta()));
    await abrirCompartilhada(id); await espera(20);
    renderNuvem();
    if (document.querySelector('#nuvemCaixa [data-nuvem="parar"]')) return 'convidada vê "Parar de compartilhar"';
    await tirarPessoa(EU.email);
    return (!b.docs[id].emails.includes(EU.email) && !estado.nuvemId && !nuvem.id && estado.zonas.length > 0) || 'não saiu';
  });

  await teste('a dona para de compartilhar: some da nuvem, continua aqui', async () => {
    const b = await compartilhada();
    const id = estado.nuvemId;
    await pararDeCompartilhar();
    return (!b.docs[id] && !estado.nuvemId && !nuvem.id && estado.zonas.length > 0) || 'não parou';
  });

  await teste('a horta foi apagada por outra pessoa: avisa, desliga e a cópia daqui continua', async () => {
    const b = await compartilhada();
    await b.apagar(estado.nuvemId);
    await espera(20);
    return (/não está mais compartilhada/.test(nuvem.status) && !estado.nuvemId && estado.zonas.length > 0) || nuvem.status;
  });

  // ---------------------------------------------------------------- tela e o resto do app
  await teste('menu: "Entrar com Google" sem login; "Compartilhar" logada; status no rodapé quando compartilhada', async () => {
    const b = await comecar();
    renderNuvem();
    const compartilhar = !!document.querySelector('#nuvemCaixa [data-nuvem="compartilhar"]');
    await b.sair(); await espera(10);
    const entrar = !!document.querySelector('#nuvemCaixa [data-nuvem="entrar"]');
    await b.entrar(); await compartilharHorta(); await espera(20);
    const rodape = $('stNuvem').textContent.startsWith('☁️');
    return (compartilhar && entrar && rodape) || JSON.stringify({ compartilhar, entrar, rodape });
  });

  await teste('"Começar do zero" e "Restaurar exemplo" continuam ligados à horta compartilhada', async () => {
    await compartilhada();
    const id = estado.nuvemId;
    $('btnZerar').click(); await espera(20);
    const zero = estado.nuvemId === id;
    $('btnExemplo').click(); await espera(20);
    return (zero && estado.nuvemId === id) || `zero ${zero}, exemplo ${estado.nuvemId}`;
  });

  await teste('trocar de projeto desliga a horta compartilhada', async () => {
    await compartilhada();
    trocarDeProjeto(migrar(criarExemploHorta()));
    await espera(10);
    return (!nuvem.id && !estado.nuvemId) || 'continuou ligada';
  });

  await teste('sair da conta desliga a horta (e ela continua aqui)', async () => {
    await compartilhada();
    await sairNuvem(); await espera(10);
    return (!nuvem.usuario && !nuvem.id && !!estado.nuvemId) || 'não desligou';
  });

  await teste('nenhum erro no console durante os testes', () => !erros.length || erros.join(' | '));

  // volta ao normal: sem nuvem nesta aba, localStorage como antes
  desligarHorta(); backendNuvem = null; nuvem.usuario = null;
  Storage.prototype.setItem = setOrig; Storage.prototype.removeItem = removeOrig;
  window.avisar = avisarOrig;
  estado = migrar(criarExemploHorta()); invalidarSol(); renderNuvem();

  const falhas = resultados.filter(r => !r.ok);
  console.log(`nuvem: ${resultados.length - falhas.length}/${resultados.length} ok`);
  for (const f of falhas) console.warn('FALHOU:', f.nome, '—', f.detalhe);
  window.resultadoTestes = { total: resultados.length, falhas: falhas.length, resultados };
})();
