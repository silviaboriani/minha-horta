'use strict';

// =====================================================================
//  Minha Horta — horta compartilhada (várias pessoas, ao vivo, com login Google)
//
//  • A horta continua salva neste aparelho (localStorage). A nuvem guarda uma
//    cópia compartilhada: documento hortas/{id} no Firebase (Firestore):
//      { nome, dono, donoEmail, emails: [quem pode abrir], estado (JSON), versao, atualizadoEm, por }
//  • Mudou aqui → 1,5 s depois envia; se outra pessoa mudou nesse meio tempo,
//    junta as duas versões (mesclar.js) antes de gravar.
//  • Mudou lá → chega ao vivo e é juntado com o que se mudou aqui.
//  • Sem internet: fica guardado aqui e vai quando a conexão voltar.
//  • Convite por link: a dona cria um link (vale 7 dias); quem abre e entra com Google entra na horta.
//  • O código do Firebase só é baixado por quem usa a horta compartilhada.
//  • Quem pode ler e gravar cada horta é decidido pelas regras do banco (firestore.rules).
// =====================================================================

const NUVEM_SDK = 'https://www.gstatic.com/firebasejs/12.0.0';
const CHAVE_NUVEM = 'horta.nuvem.v1';   // neste aparelho: { entrou, hortas: { id: { base, versao } } }
const ESPERA_ENVIO = 1500;              // ms depois da última mudança
const DIAS_CONVITE = 7;                 // o link de convite vale 7 dias

const nuvem = {
  usuario: undefined, // { uid, email, nome } de quem entrou; null = não entrou; undefined = ainda não se sabe
  carregando: false,
  id: null,           // horta compartilhada ligada agora
  dados: null,        // último documento que chegou (emails, dono…)
  base: null,         // JSON da última versão que os dois lados viram
  versao: 0,
  parar: null,        // desliga o "ouvir ao vivo"
  timer: null,
  enviando: false,
  aplicando: false,   // aplicando o que chegou: não reenvia
  status: '',
  outras: [],         // hortas compartilhadas comigo
};
let backendNuvem = null;   // o Firebase (ou, nos testes, um de mentira)

// ---------------------------------------------------------------------
//  O que é guardado neste aparelho (os testes trocam estas duas funções)
// ---------------------------------------------------------------------
function lerNuvemLocal() {
  try { return { hortas: {}, ...JSON.parse(localStorage.getItem(CHAVE_NUVEM)) }; } catch (_) { return { hortas: {} }; }
}
function gravarNuvemLocal(mudar) {
  const d = lerNuvemLocal();
  mudar(d);
  try { localStorage.setItem(CHAVE_NUVEM, JSON.stringify(d)); } catch (_) { /* sem espaço: segue só na memória */ }
}
const guardarLigacao = () => gravarNuvemLocal(d => { if (nuvem.id) d.hortas[nuvem.id] = { base: nuvem.base, versao: nuvem.versao }; });

// ---------------------------------------------------------------------
//  Firebase (baixado só quando precisa)
// ---------------------------------------------------------------------
async function backendFirebase() {
  const [app, auth, fs] = await Promise.all(['app', 'auth', 'firestore'].map(m => import(`${NUVEM_SDK}/firebase-${m}.js`)));
  const a = app.initializeApp(FIREBASE_CONFIG);
  const au = auth.getAuth(a);
  const db = fs.getFirestore(a);
  const ref = id => fs.doc(db, 'hortas', id);
  return {
    aoMudarUsuario: cb => auth.onAuthStateChanged(au, u => cb(u ? { uid: u.uid, email: (u.email || '').toLowerCase(), nome: u.displayName || u.email } : null)),
    entrar: () => auth.signInWithPopup(au, new auth.GoogleAuthProvider()),
    sair: () => auth.signOut(au),
    criar: async dados => (await fs.addDoc(fs.collection(db, 'hortas'), dados)).id,
    ler: async id => { const s = await fs.getDoc(ref(id)); return s.exists() ? s.data() : null; },
    // lê e grava de uma vez: mudar(dadosAtuais) devolve o que mudar (ou null para não gravar)
    transacao: (id, mudar) => fs.runTransaction(db, async tx => {
      const s = await tx.get(ref(id));
      if (!s.exists()) throw Object.assign(new Error('A horta não existe mais.'), { code: 'not-found' });
      const m = mudar(s.data());
      if (m) tx.update(ref(id), m);
      return m;
    }),
    ouvir: (id, cb, erro) => fs.onSnapshot(ref(id), s => cb(s.exists() ? s.data() : null), erro),
    listar: async email => (await fs.getDocs(fs.query(fs.collection(db, 'hortas'), fs.where('emails', 'array-contains', email))))
      .docs.map(d => ({ id: d.id, ...d.data() })),
    apagar: id => fs.deleteDoc(ref(id)),
    // entrar na horta com o código do link (as regras conferem o código e a validade)
    entrarComConvite: (id, codigo, email) => fs.updateDoc(ref(id), { emails: fs.arrayUnion(email), ultimoCodigo: codigo }),
  };
}

// Liga o Firebase (uma vez). Quem chama enquanto ainda carrega espera o mesmo carregamento.
let carregandoNuvem = null;
function carregarNuvem() {
  if (backendNuvem) return Promise.resolve(backendNuvem);
  if (!carregandoNuvem) carregandoNuvem = (async () => {
    nuvem.carregando = true; renderNuvem();
    try { usarBackendNuvem(await backendFirebase()); }
    catch (_) { mostrarStatusNuvem('Sem internet: a horta compartilhada conecta quando a conexão voltar.', 'aviso'); }
    nuvem.carregando = false; carregandoNuvem = null; renderNuvem();
    return backendNuvem;
  })();
  return carregandoNuvem;
}
function usarBackendNuvem(b) {
  backendNuvem = b;
  b.aoMudarUsuario(u => {
    nuvem.usuario = u;
    gravarNuvemLocal(d => { d.entrou = !!u; });
    if (u) { ligarHorta(); listarOutras(); } else { desligarHorta(); nuvem.outras = []; }
    renderNuvem();
  });
}

// ---------------------------------------------------------------------
//  Ligar esta horta à cópia da nuvem e ouvir ao vivo
// ---------------------------------------------------------------------
function ligarHorta() {
  desligarHorta();
  const id = estado.nuvemId;
  if (!id || !nuvem.usuario || !backendNuvem) { renderNuvem(); return; }
  const local = lerNuvemLocal().hortas[id] || {};
  Object.assign(nuvem, { id, base: local.base || null, versao: local.versao || 0, dados: null });
  mostrarStatusNuvem('Conectando…');
  nuvem.parar = backendNuvem.ouvir(id, chegouDaNuvem, e => {
    if (e?.code === 'permission-denied') perdeuAcesso();   // foi tirada da horta
    else mostrarStatusNuvem(textoErroNuvem(e), 'aviso');
  });
  renderNuvem();
}
function desligarHorta() {
  if (nuvem.parar) nuvem.parar();
  clearTimeout(nuvem.timer);
  Object.assign(nuvem, { parar: null, id: null, dados: null, timer: null });
}

// Chegou uma versão da nuvem: junta com o que se mudou aqui
function chegouDaNuvem(d) {
  if (!nuvem.id) return;
  if (!d) { perdeuAcesso(); return; }
  nuvem.dados = d;
  // enviando, arrastando, com a janela do plano aberta ou digitando num campo: espera, para não mexer por baixo
  if (nuvem.enviando || ponteiro || propostaPlano || digitando()) { setTimeout(() => { if (nuvem.dados === d) chegouDaNuvem(d); }, 700); return; }
  if (d.versao > nuvem.versao || !nuvem.base) {
    const aqui = JSON.parse(JSON.stringify(estado));
    const aquiTxt = JSON.stringify(aqui);
    let novo;
    if (nuvem.base) novo = mesclar(JSON.parse(nuvem.base), aqui, JSON.parse(d.estado));
    else {
      // sem histórico neste aparelho (ex.: arquivo aberto noutro aparelho): vale a da nuvem,
      // e a daqui fica guardada nos projetos para não perder nada
      if (aquiTxt !== d.estado && (estado.zonas.length || estado.diario.length)) guardarProjetoAtual();
      novo = JSON.parse(d.estado);
    }
    novo.nuvemId = nuvem.id;
    nuvem.base = d.estado; nuvem.versao = d.versao;
    guardarLigacao();
    if (JSON.stringify(novo) !== aquiTxt) aplicarDaNuvem(novo);
  }
  // mudanças daqui que ainda não foram (ex.: feitas sem internet, antes de fechar o app)
  if (JSON.stringify(estado) !== nuvem.base && !nuvem.timer && !nuvem.enviando) agendarEnvio();
  else if (!nuvem.timer && !nuvem.enviando) mostrarStatusNuvem(textoSincronizado(d), 'ok');
  renderNuvem();
}

// Algum campo de texto com o cursor dentro (o que chega espera a pessoa sair dele)
const digitando = () => !!document.activeElement?.matches?.('input:not([type=checkbox]):not([type=radio]):not([type=range]), textarea, select');

// A horta foi apagada ou tiraram esta pessoa dela: deixa de ser compartilhada aqui; a cópia continua
function perdeuAcesso() {
  if (!nuvem.id) return;
  desligarDestaHorta();
  mostrarStatusNuvem('Esta horta não está mais compartilhada com você. A cópia deste aparelho continua aqui.', 'aviso');
  avisar('Esta horta não está mais compartilhada com você. A cópia deste aparelho continua aqui, como horta normal.');
}

// Troca a horta pela versão juntada (sem reenviar e sem "desfazer" voltar mudanças de outras pessoas)
function aplicarDaNuvem(novo) {
  const linha = tracado;
  estado = migrar(novo);
  historico = []; futuro = [];
  nuvem.aplicando = true;
  try { depoisDeTrocarEstado(); } finally { nuvem.aplicando = false; }
  tracado = linha;
  if (linha) desenhar();
}

// ---------------------------------------------------------------------
//  Enviar as mudanças daqui
// ---------------------------------------------------------------------
// Chamada por salvar() (app.js) a cada mudança
function nuvemMudou() {
  if (nuvem.aplicando || !nuvem.id || !backendNuvem) return;
  agendarEnvio();
}
function agendarEnvio(ms = ESPERA_ENVIO) {
  clearTimeout(nuvem.timer);
  nuvem.timer = setTimeout(() => { nuvem.timer = null; enviarParaNuvem(); }, ms);
  if (!nuvem.enviando) mostrarStatusNuvem('Mudanças a enviar…');
}

async function enviarParaNuvem() {
  if (!nuvem.id || !backendNuvem || !nuvem.usuario || !nuvem.base) return;   // sem base: espera a primeira versão chegar
  if (nuvem.enviando || ponteiro) { agendarEnvio(); return; }
  nuvem.enviando = true;
  mostrarStatusNuvem('Enviando…');
  const id = nuvem.id;
  const base = nuvem.base, versaoBase = nuvem.versao;   // o ponto de partida deste envio (não muda no meio)
  const aqui = JSON.parse(JSON.stringify(estado));
  const aquiTxt = JSON.stringify(aqui);
  let novoTxt = aquiTxt, versaoNova = versaoBase;
  try {
    await backendNuvem.transacao(id, d => {
      // ninguém mudou desde o ponto de partida: vai a versão daqui; senão, junta as duas
      const novo = d.versao === versaoBase ? aqui : mesclar(JSON.parse(base), aqui, JSON.parse(d.estado));
      novo.nuvemId = id;
      novoTxt = JSON.stringify(novo);
      if (novoTxt === d.estado) { versaoNova = d.versao; return null; }
      versaoNova = d.versao + 1;
      return { estado: novoTxt, versao: versaoNova, nome: novo.nome || 'Minha Horta', atualizadoEm: Date.now(), por: nuvem.usuario.email };
    });
    if (nuvem.id !== id) return;   // trocou de horta enquanto enviava
    nuvem.base = novoTxt; nuvem.versao = versaoNova;
    guardarLigacao();
    const mudouDepois = JSON.stringify(estado) !== aquiTxt;
    if (mudouDepois) agendarEnvio(300);                          // mexeram de novo enquanto enviava
    else if (novoTxt !== aquiTxt) aplicarDaNuvem(JSON.parse(novoTxt));   // juntou com mudanças de outras pessoas
    if (!mudouDepois) mostrarStatusNuvem(textoSincronizado(nuvem.dados), 'ok');
  } catch (e) {
    if (e.code === 'not-found') { perdeuAcesso(); return; }
    mostrarStatusNuvem(textoErroNuvem(e), 'aviso');
    if (e.code !== 'permission-denied') agendarEnvio(20000);   // tenta de novo daqui a pouco
  } finally {
    nuvem.enviando = false;
    renderNuvem();
  }
}
window.addEventListener('online', () => {
  if (!backendNuvem && (estado.nuvemId || lerNuvemLocal().entrou)) carregarNuvem();   // abriu o app sem internet
  else if (nuvem.id) agendarEnvio(500);
});

// ---------------------------------------------------------------------
//  Ações (botões do menu ☰ → Horta compartilhada)
// ---------------------------------------------------------------------
const appInstalado = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const AVISO_APP_INSTALADO = 'No app instalado (ícone na tela de início), a janela do Google às vezes não abre. Se não funcionar, use a horta compartilhada pelo navegador (Safari): silviaboriani.github.io/minha-horta';
async function entrarNuvem() {
  const b = await carregarNuvem();
  if (!b) return;
  const demorou = appInstalado() ? setTimeout(() => { if (!nuvem.usuario) avisar(AVISO_APP_INSTALADO); }, 45000) : null;
  try { await b.entrar(); }
  catch (e) {
    if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') avisar(textoErroNuvem(e));
    else if (appInstalado()) avisar(AVISO_APP_INSTALADO);
  } finally { clearTimeout(demorou); }
}
async function sairNuvem() {
  if (!backendNuvem) return;
  if (nuvem.timer) { clearTimeout(nuvem.timer); nuvem.timer = null; await enviarParaNuvem(); }
  desligarHorta();
  await backendNuvem.sair();
}

// Esta horta passa a ser compartilhada (quem compartilha é a dona)
async function compartilharHorta() {
  const u = nuvem.usuario;
  if (!u || !backendNuvem || estado.nuvemId) return;
  const txt = JSON.stringify(estado);
  try {
    const id = await backendNuvem.criar({ nome: estado.nome || 'Minha Horta', dono: u.uid, donoEmail: u.email, emails: [u.email],
      estado: txt, versao: 1, atualizadoEm: Date.now(), por: u.email });
    gravarNuvemLocal(d => { d.hortas[id] = { base: txt, versao: 1 }; });
    estado.nuvemId = id;
    historico = []; futuro = [];   // "desfazer" não volta para antes de compartilhar
    ligarHorta();
    mudou();                        // grava aqui e manda a versão com o nuvemId
    avisar('Horta compartilhada! Crie um link de convite para chamar outras pessoas.');
  } catch (e) { avisar(textoErroNuvem(e)); }
}

// ---- Convite por link ----
const codigoNovo = () => Array.from(crypto.getRandomValues(new Uint8Array(15)), b => b.toString(36).padStart(2, '0')).join('');
const conviteValido = d => !!(d?.convite && d.conviteAte > Date.now());
const linkConvite = (id, codigo) => `${location.origin}${location.pathname}?horta=${encodeURIComponent(id)}&convite=${encodeURIComponent(codigo)}`;

// A dona cria (ou renova) o link; ele vale DIAS_CONVITE dias
async function criarConvite() {
  try {
    await backendNuvem.transacao(nuvem.id, d => ({ convite: codigoNovo(), conviteAte: Date.now() + DIAS_CONVITE * 864e5, versao: d.versao + 1 }));
  } catch (e) { avisar(textoErroNuvem(e)); }
}
async function cancelarConvite() {
  try {
    await backendNuvem.transacao(nuvem.id, d => ({ convite: null, conviteAte: null, versao: d.versao + 1 }));
    avisar('Link cancelado: quem ainda não entrou não consegue mais entrar com ele.');
  } catch (e) { avisar(textoErroNuvem(e)); }
}
// Envia pelo menu de compartilhar do aparelho (WhatsApp, e-mail…) ou, no computador, pelo programa de e-mail
function enviarConvite() {
  const d = nuvem.dados;
  if (!conviteValido(d)) return;
  const link = linkConvite(nuvem.id, d.convite);
  const texto = `Te convidei para a horta “${d.nome || 'Minha Horta'}” no app Minha Horta. Abra o link e entre com a sua conta Google:`;
  if (navigator.share) navigator.share({ title: 'Convite — Minha Horta', text: texto, url: link }).catch(() => {});
  else location.href = `mailto:?subject=${encodeURIComponent('Convite — Minha Horta')}&body=${encodeURIComponent(texto + '\n\n' + link)}`;
}
async function copiarConvite() {
  const d = nuvem.dados;
  if (!conviteValido(d)) return;
  try { await navigator.clipboard.writeText(linkConvite(nuvem.id, d.convite)); avisar('Link copiado. Cole numa mensagem para quem você quer convidar.'); }
  catch (_) { avisar('Não deu para copiar aqui. Use “Enviar convite”.'); }
}

// Abriu um link de convite: entra com Google (se precisar), entra na horta e abre
async function aceitarConvite(id, codigo) {
  const b = await carregarNuvem();
  if (!b) { avisar('Sem internet para abrir o convite. Tente de novo quando a conexão voltar.'); return; }
  for (let i = 0; i < 30 && nuvem.usuario === undefined; i++) await new Promise(r => setTimeout(r, 100));
  if (!nuvem.usuario) {
    if (!(await perguntar({ titulo: 'Convite para uma horta', texto: 'Você recebeu um convite para uma horta compartilhada. Entre com a sua conta Google para abrir.', ok: 'Entrar com Google' }))) return;
    try { await b.entrar(); } catch (e) { if (e.code !== 'auth/popup-closed-by-user') avisar(textoErroNuvem(e)); return; }
    for (let i = 0; i < 50 && !nuvem.usuario; i++) await new Promise(r => setTimeout(r, 100));
    if (!nuvem.usuario) return;
  }
  try {
    let d = null;
    try { d = await b.ler(id); } catch (e) { if (e.code !== 'permission-denied') throw e; }   // ainda não está na horta
    if (!d) await b.entrarComConvite(id, codigo, nuvem.usuario.email);
  } catch (e) {
    avisar(e.code === 'permission-denied' || e.code === 'not-found'
      ? 'Este convite expirou ou foi cancelado. Peça um link novo para quem te convidou.' : textoErroNuvem(e));
    return;
  }
  await abrirCompartilhada(id);
  const ios = /iPad|iPhone/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios && !appInstalado()) setTimeout(() => avisar('Dica: se você usa o app pelo ícone da tela de início, abra-o e entre com Google lá também — a horta aparece em ☰ → Horta compartilhada.'), 4000);
}
// Link de convite na barra de endereço (?horta=…&convite=…): tira da barra e começa a aceitar
function conviteNaEntrada() {
  const p = new URLSearchParams(location.search);
  const id = p.get('horta'), codigo = p.get('convite');
  if (!id || !codigo) return;
  history.replaceState(null, '', location.pathname);
  nuvem.chegouPorConvite = true;              // app.js não abre as boas-vindas
  $('modalInicio').classList.add('oculto');
  aceitarConvite(id, codigo);
}

async function tirarPessoa(email) {
  const eu = email === nuvem.usuario?.email;
  const ok = await perguntar(eu
    ? { titulo: 'Sair desta horta?', texto: 'Você deixa de ver as mudanças das outras pessoas. A cópia deste aparelho continua aqui.', ok: 'Sair da horta' }
    : { titulo: `Tirar ${email}?`, texto: 'Essa pessoa não vai mais abrir nem mudar esta horta.', ok: 'Tirar', perigo: true });
  if (!ok) return;
  try {
    await backendNuvem.transacao(nuvem.id, d => ({ emails: d.emails.filter(x => x !== email), versao: d.versao + 1 }));
    if (eu) desligarDestaHorta();
    else if (conviteValido(nuvem.dados) && await perguntar({ titulo: 'Cancelar o link de convite também?',
      texto: `${escapar(email)} ainda poderia voltar pelo link de convite, que vale até ${new Date(nuvem.dados.conviteAte).toLocaleDateString('pt-BR')}. Cancelando, quem ainda não entrou precisa de um link novo.`,
      ok: 'Cancelar o link', cancelar: 'Manter o link' })) await cancelarConvite();
  } catch (e) {
    if (eu && (e.code === 'permission-denied' || e.code === 'not-found')) desligarDestaHorta();   // já estava fora
    else avisar(textoErroNuvem(e));
  }
}

async function pararDeCompartilhar() {
  if (!(await perguntar({ titulo: 'Parar de compartilhar?', texto: 'A cópia na nuvem é apagada e as outras pessoas deixam de ver esta horta (a cópia de cada aparelho continua lá). A sua continua aqui.', ok: 'Parar de compartilhar', perigo: true }))) return;
  const id = nuvem.id;
  try { await backendNuvem.apagar(id); desligarDestaHorta(); }
  catch (e) { avisar(textoErroNuvem(e)); }
}

// A horta deste aparelho deixa de ser ligada à nuvem (continua aqui como horta normal)
function desligarDestaHorta() {
  const id = nuvem.id;
  desligarHorta();
  gravarNuvemLocal(d => { delete d.hortas[id]; });
  delete estado.nuvemId;
  salvar();
  listarOutras();
  renderNuvem();
}

async function listarOutras() {
  if (!backendNuvem || !nuvem.usuario) return;
  try { nuvem.outras = await backendNuvem.listar(nuvem.usuario.email); }
  catch (_) { nuvem.outras = []; }
  renderNuvem();
}

// Abre uma horta compartilhada comigo (a horta atual fica nos projetos guardados)
async function abrirCompartilhada(id) {
  try {
    const d = await backendNuvem.ler(id);
    if (!d) { avisar('Essa horta não está mais compartilhada.'); listarOutras(); return; }
    if (estado.zonas.length || estado.diario.length) guardarProjetoAtual();
    gravarNuvemLocal(x => { x.hortas[id] = { base: d.estado, versao: d.versao }; });
    const e = migrar(JSON.parse(d.estado));
    e.nuvemId = id;
    $('modalInicio').classList.add('oculto');   // boas-vindas não ficam por cima da horta aberta
    trocarDeProjeto(e);   // liga de novo à nuvem (nuvemTrocouDeProjeto)
    document.querySelector('[data-menu="fechar"]')?.click();
    avisar(`“${d.nome}” aberta. A horta que estava aqui ficou em Projetos guardados.`);
  } catch (e) { avisar(textoErroNuvem(e)); }
}

// Chamada por trocarDeProjeto (inicio.js): outra horta, outra ligação
function nuvemTrocouDeProjeto() {
  if (backendNuvem) ligarHorta();
  else if (estado.nuvemId) carregarNuvem();
  renderNuvem();
}

// ---------------------------------------------------------------------
//  Textos e tela
// ---------------------------------------------------------------------
function textoSincronizado(d) {
  const n = d?.emails?.length || 1;
  return `✓ Sincronizado${n > 1 ? ` · ${n} pessoas` : ''}`;
}
function textoErroNuvem(e) {
  const c = e?.code || '';
  if (c === 'unavailable' || c === 'auth/network-request-failed' || !navigator.onLine) return 'Sem internet: as mudanças ficam guardadas aqui e vão quando a conexão voltar.';
  if (c === 'permission-denied') return `Sem permissão: esta horta não está compartilhada com ${nuvem.usuario?.email || 'esta conta'}.`;
  if (c === 'not-found') return 'Esta horta não existe mais na nuvem. A cópia deste aparelho continua aqui.';
  if (c === 'auth/popup-blocked') return 'O navegador bloqueou a janela do Google. Permita janelas para este site e tente de novo.';
  if (c === 'auth/operation-not-supported-in-this-environment' || c === 'auth/web-storage-unsupported')
    return 'Não deu para entrar por aqui. No iPad, abra o app pelo Safari (não pelo ícone da tela de início) para entrar.';
  return 'Horta compartilhada: ' + (e?.message || 'erro desconhecido');
}
function mostrarStatusNuvem(texto, tipo = '') {
  nuvem.status = texto;
  const st = $('stNuvem');
  if (st) { st.textContent = nuvem.id ? '☁️ ' + texto : ''; st.className = 'st-nuvem ' + tipo; }
  const caixa = document.querySelector('#nuvemCaixa .nuvem-status');
  if (caixa) { caixa.textContent = texto; caixa.className = 'nuvem-status ' + tipo; }
}

// Convite (só a dona): criar o link; com o link, enviar, copiar ou cancelar
function htmlConvite() {
  const d = nuvem.dados;
  if (!conviteValido(d)) return `<button data-nuvem="criar-convite" class="principal">🔗 Criar link de convite</button>
    <p class="nota">Quem abrir o link e entrar com uma conta Google entra na horta. O link vale ${DIAS_CONVITE} dias.</p>`;
  const ate = new Date(d.conviteAte).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  return `<div class="nuvem-convite"><button data-nuvem="enviar-convite" class="principal">📨 Enviar convite</button>
      <button data-nuvem="copiar-convite">🔗 Copiar link</button></div>
    <p class="nota">Quem abrir o link e entrar com uma conta Google entra na horta (vale até ${ate}). Você vê aqui quem entrou e pode tirar.
      <button class="link" data-nuvem="cancelar-convite">Cancelar o link</button></p>`;
}

function renderNuvem() {
  const box = $('nuvemCaixa');
  if (!box) return;
  const u = nuvem.usuario;
  const dono = nuvem.dados && u && nuvem.dados.dono === u.uid;
  let h = '';
  if (!u) {
    h = `<p class="nota">${estado.nuvemId ? 'Esta horta é compartilhada. Entre com Google para receber e enviar as mudanças.'
      : 'Trabalhe na mesma horta com outras pessoas, ao mesmo tempo. Cada uma entra com a própria conta Google.'}</p>
      <button data-nuvem="entrar" class="principal" ${nuvem.carregando ? 'disabled' : ''}>${nuvem.carregando ? 'Conectando…' : 'Entrar com Google'}</button>`;
  } else {
    h = `<p class="nota">Conectada como <b>${escapar(u.email)}</b> · <button class="link" data-nuvem="sair">sair</button></p>`;
    if (!estado.nuvemId) {
      h += `<button data-nuvem="compartilhar" class="principal">👥 Compartilhar esta horta</button>`;
    } else {
      const emails = nuvem.dados?.emails || [];
      h += `<p class="nuvem-status">${escapar(nuvem.status)}</p>
        <div class="rotulo">Pessoas nesta horta</div>
        <ul class="nuvem-pessoas">${emails.map(e => `<li><span>${escapar(e)}${e === nuvem.dados.donoEmail ? ' <small>(dona)</small>' : ''}${e === u.email ? ' <small>(você)</small>' : ''}</span>
          ${(dono && e !== u.email) ? `<button class="link perigo" data-nuvem="tirar" data-email="${escapar(e)}">tirar</button>` : ''}</li>`).join('')}</ul>
        ${dono ? htmlConvite() : '<p class="nota">Para chamar mais gente, peça um link de convite à dona.</p>'}
        ${dono ? '<button data-nuvem="parar" class="perigo">Parar de compartilhar</button>'
          : `<button data-nuvem="tirar" data-email="${escapar(u.email)}">Sair desta horta</button>`}`;
    }
    const outras = nuvem.outras.filter(o => o.id !== estado.nuvemId);
    if (outras.length) h += `<div class="rotulo" style="margin-top:12px">Compartilhadas com você</div>
      <ul class="lista-projetos">${outras.map(o => `<li><span><b>${escapar(o.nome)}</b><br><span class="nota">de ${escapar(o.donoEmail || '')}</span></span>
        <button class="pequeno" data-nuvem="abrir" data-id="${escapar(o.id)}">Abrir</button></li>`).join('')}</ul>`;
  }
  box.innerHTML = h;
  mostrarStatusNuvem(nuvem.status, $('stNuvem')?.classList.contains('aviso') ? 'aviso' : '');
}

function montarNuvem() {
  const box = $('nuvemCaixa');
  box.addEventListener('click', async ev => {
    const b = ev.target.closest('[data-nuvem]');
    if (!b || b.disabled) return;
    const a = b.dataset.nuvem;
    if (a === 'entrar') entrarNuvem();
    else if (a === 'sair') sairNuvem();
    else if (a === 'compartilhar') compartilharHorta();
    else if (a === 'criar-convite') criarConvite();
    else if (a === 'enviar-convite') enviarConvite();
    else if (a === 'copiar-convite') copiarConvite();
    else if (a === 'cancelar-convite') cancelarConvite();
    else if (a === 'tirar') tirarPessoa(b.dataset.email);
    else if (a === 'parar') pararDeCompartilhar();
    else if (a === 'abrir') abrirCompartilhada(b.dataset.id);
  });
  renderNuvem();
  // quem já usa a horta compartilhada conecta ao abrir o app
  if (estado.nuvemId || lerNuvemLocal().entrou) carregarNuvem();
  // abrir o menu já baixa o Firebase: assim "Entrar com Google" abre a janela na hora (o iPad bloqueia se demorar)
  $('btnMenu').addEventListener('click', () => { if (!backendNuvem) carregarNuvem(); });
  conviteNaEntrada();
}
