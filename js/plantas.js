'use strict';

// =====================================================================
//  Minha Horta — Fase 3: banco de dados de plantas
//
//  Épocas pensadas para Piraquara / Curitiba (planalto, ~900 m, geadas de
//  maio a agosto). São estimativas: ajuste com a sua experiência na aba
//  Plantas → Editar dados.
//
//  Campos:
//    sol      horas mínimas de sol: 6 = sol pleno, 4 = aguenta meia-sombra, 3 = prefere meia-sombra
//    esp      espaçamento em cm: [entre plantas, entre linhas]
//    forma    como se planta (ver FORMAS)
//    sem      meses de semear / plantar (1 = janeiro … 12 = dezembro)
//    tr       meses de transplantar as mudas para o canteiro
//    col      dias da semeadura até a colheita [mín, máx]
//    geada    true = morre ou sofre com geada
//    tutor    true = precisa de tutor, cerca ou treliça
//    perene   true = dura vários anos
//    amigas   plantas que combinam (ids)
//    inimigas plantas para manter longe (ids)
// =====================================================================

const CATEGORIAS = {
  folhas:     { nome: 'Folhas e verduras',   emoji: '🥬' },
  ervas:      { nome: 'Ervas',               emoji: '🌿' },
  frutos:     { nome: 'Frutos',              emoji: '🍅' },
  tuberculos: { nome: 'Raízes e tubérculos', emoji: '🥕' },
  outras:     { nome: 'Grãos e vagens',      emoji: '🌽' },
  flores:     { nome: 'Flores',              emoji: '🌼' },
};

const FORMAS = {
  direto:     'Semeadura direta no canteiro',
  muda:       'Mudas (semear em bandeja e transplantar)',
  ambos:      'Direto no canteiro ou por mudas',
  rama:       'Ramas (pedaços do galho)',
  bulbo:      'Bulbos ou dentes',
  tuberculo:  'Tubérculos ou rizomas',
  rebento:    'Rebentos (brotos da planta-mãe)',
  estaca:     'Estacas ou mudas compradas',
  fruto:      'Fruto inteiro já brotado',
};

const NIVEIS_SOL = {
  6: { nome: 'Sol pleno',          desc: 'precisa de 6 h ou mais de sol', icone: '☀️' },
  4: { nome: 'Sol ou meia-sombra', desc: 'aguenta a partir de ~4 h de sol', icone: '🌤️' },
  3: { nome: 'Meia-sombra',        desc: 'prefere 3 a 5 h de sol', icone: '⛅' },
};

const MESES_LETRA = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

// Meses de a até b (dá a volta no ano: meses(9, 2) = set…fev)
function meses(a, b) {
  const l = [];
  for (let m = a; ; m = m % 12 + 1) {
    l.push(m);
    if (m === b || l.length > 12) break;
  }
  return l;
}

// Família botânica — usada na rotação de culturas (não repetir a mesma família no mesmo canteiro)
const FAMILIAS = {
  'Brássicas': ['couve', 'repolho', 'brocolis', 'couve-flor', 'mostarda', 'tatsoi', 'bok-choy', 'rucula', 'agriao', 'rabanete', 'nabo'],
  'Solanáceas': ['tomate', 'pimentao', 'pimentas', 'berinjela', 'jilo', 'batata', 'petunia'],
  'Cucurbitáceas': ['abobrinha', 'abobora', 'pepino', 'chuchu', 'melancia', 'melao'],
  'Apiáceas': ['cenoura', 'salsinha', 'coentro', 'batata-salsa'],
  'Aliáceas': ['cebolinha', 'alho', 'cebola'],
  'Leguminosas': ['feijao-vagem', 'ervilha-torta'],
  'Asteráceas': ['alface', 'almeirao', 'chicoria', 'girassol', 'zinia', 'cosmos', 'dalia', 'tagetes', 'estragao'],
  'Amarantáceas': ['acelga', 'beterraba'],
  'Lamiáceas': ['manjericao', 'hortela', 'oregano', 'tomilho', 'alecrim', 'segurelha', 'erva-cidreira', 'manjerona', 'salvia'],
  'Gramíneas': ['milho-verde'],
  'Convolvuláceas': ['batata-doce', 'flor-de-cardeal'],
  'Malváceas': ['quiabo', 'hibisco'],
  'Zingiberáceas': ['gengibre', 'curcuma'],
  'Outras': ['bertalha', 'espinafre-nz', 'morango', 'inhame', 'louro', 'gladiolo', 'vinca', 'alamanda', 'ixora', 'geranio', 'capuchinha'],
};
const FAMILIA_DE = {};
for (const [f, ids] of Object.entries(FAMILIAS)) for (const id of ids) FAMILIA_DE[id] = f;
// Famílias "exigentes", em que a rotação mais importa (pragas e doenças de solo)
const FAMILIAS_ROTACAO = ['Brássicas', 'Solanáceas', 'Cucurbitáceas', 'Aliáceas', 'Apiáceas', 'Amarantáceas'];

function P(id, nome, cat, emoji, d) {
  const p = {
    id, nome, cat, emoji, familia: FAMILIA_DE[id] || 'Outras',
    sol: 6, esp: [30, 30], forma: 'direto', sem: [], tr: [], col: [60, 90],
    geada: false, tutor: false, perene: false,
    amigas: [], inimigas: [], alias: [], dica: '',
    ...d,
  };
  // Mudas: se não informado, transplanta ~1 mês depois de semear
  if (p.forma === 'muda' && !d.tr) p.tr = [...new Set(p.sem.map(m => m % 12 + 1))];
  return p;
}

const BRASSICAS_INIMIGAS = ['morango', 'tomate'];
const BRASSICAS_AMIGAS = ['alecrim', 'salvia', 'beterraba', 'cebola', 'capuchinha', 'tagetes', 'tomilho', 'hortela'];

const PLANTAS_BASE = [
  // ---------------- Folhas e verduras ----------------
  P('alface', 'Alface', 'folhas', '🥬', {
    sol: 4, esp: [25, 25], forma: 'ambos', sem: meses(1, 12), col: [55, 80],
    amigas: ['cenoura', 'rabanete', 'beterraba', 'cebolinha', 'rucula', 'pepino', 'morango', 'cebola'],
    inimigas: ['salsinha', 'girassol'],
    dica: 'Pode plantar o ano todo. No verão, use variedades de verão (crespa, americana) e prefira um lugar com sombra à tarde.' }),
  P('rucula', 'Rúcula', 'folhas', '🥬', {
    sol: 4, esp: [10, 20], sem: meses(2, 11), col: [35, 55],
    amigas: ['alface', 'beterraba', 'cenoura', 'cebola'],
    dica: 'Cresce rápido. No calor forte floresce cedo e fica amarga — semeie um pouco a cada 15–20 dias.' }),
  P('agriao', 'Agrião', 'folhas', '🌿', {
    sol: 3, esp: [20, 20], forma: 'ambos', sem: meses(3, 9), col: [60, 80],
    amigas: ['alface'],
    dica: 'Gosta de muita água e meia-sombra. Ideal num canto úmido.' }),
  P('couve', 'Couve', 'folhas', '🥬', {
    alias: ['couve manteiga'], sol: 4, esp: [50, 80], forma: 'muda', sem: meses(1, 12), col: [80, 100],
    amigas: [...BRASSICAS_AMIGAS, 'acelga'], inimigas: BRASSICAS_INIMIGAS,
    dica: 'Colha as folhas de baixo: um pé produz por muitos meses. Capuchinha e tagetes por perto ajudam contra pulgão e lagarta.' }),
  P('repolho', 'Repolho', 'folhas', '🥬', {
    sol: 6, esp: [40, 80], forma: 'muda', sem: meses(2, 6), col: [90, 120],
    amigas: BRASSICAS_AMIGAS, inimigas: BRASSICAS_INIMIGAS,
    dica: 'Prefere o frio: em Piraquara, semeie do fim do verão ao começo do inverno.' }),
  P('brocolis', 'Brócolis', 'folhas', '🥦', {
    sol: 6, esp: [50, 80], forma: 'muda', sem: meses(2, 6), col: [90, 110],
    amigas: BRASSICAS_AMIGAS, inimigas: BRASSICAS_INIMIGAS,
    dica: 'Depois de colher a cabeça principal, os brotos laterais continuam produzindo.' }),
  P('couve-flor', 'Couve-flor', 'folhas', '🥦', {
    sol: 6, esp: [50, 80], forma: 'muda', sem: meses(2, 5), col: [100, 130],
    amigas: BRASSICAS_AMIGAS, inimigas: BRASSICAS_INIMIGAS,
    dica: 'Precisa de frio para formar a cabeça. Amarre as folhas por cima para a flor ficar branca.' }),
  P('acelga', 'Acelga', 'folhas', '🥬', {
    sol: 4, esp: [30, 50], forma: 'ambos', sem: meses(2, 10), col: [60, 80],
    amigas: ['alface', 'cebola', 'couve', 'feijao-vagem'],
    dica: 'Colha as folhas de fora e deixe o miolo continuar crescendo.' }),
  P('almeirao', 'Almeirão', 'folhas', '🥬', {
    sol: 4, esp: [20, 30], forma: 'ambos', sem: meses(2, 11), col: [60, 80],
    amigas: ['alface', 'cenoura'],
    dica: 'Resistente ao frio; rebrota depois do corte.' }),
  P('chicoria', 'Chicória', 'folhas', '🥬', {
    alias: ['escarola'], sol: 4, esp: [30, 30], forma: 'ambos', sem: meses(2, 9), col: [70, 90],
    amigas: ['alface', 'cenoura', 'rabanete'],
    dica: 'Prefere o tempo fresco; no calor fica mais amarga.' }),
  P('espinafre-nz', 'Espinafre da Nova Zelândia', 'folhas', '🥬', {
    alias: ['espinafre nova zel', 'espinafre nova zelandia', 'espinafre'],
    sol: 4, esp: [50, 60], forma: 'ambos', sem: meses(9, 2), col: [60, 75], geada: true,
    dica: 'Aguenta bem o calor e se espalha bastante. Deixe as sementes de molho uma noite antes de semear.' }),
  P('bertalha', 'Bertalha', 'folhas', '🌿', {
    sol: 4, esp: [40, 60], forma: 'ambos', sem: meses(9, 1), col: [70, 90], geada: true, tutor: true,
    dica: 'Trepadeira de calor: precisa de cerca ou treliça.' }),
  P('mostarda', 'Mostarda', 'folhas', '🥬', {
    sol: 4, esp: [30, 40], forma: 'ambos', sem: meses(2, 9), col: [45, 60],
    amigas: ['alface', 'beterraba'], inimigas: BRASSICAS_INIMIGAS,
    dica: 'Cresce rápido no tempo fresco.' }),
  P('tatsoi', 'Couve-chinesa Tatsoi', 'folhas', '🥬', {
    alias: ['tatsoi'], sol: 4, esp: [20, 30], forma: 'ambos', sem: meses(2, 9), col: [45, 60],
    amigas: ['alface', 'cebolinha'],
    dica: 'Pode colher folha a folha ou a planta inteira.' }),
  P('bok-choy', 'Bok choy', 'folhas', '🥬', {
    alias: ['pak choi', 'couve chinesa'], sol: 4, esp: [20, 30], forma: 'ambos', sem: meses(2, 9), col: [45, 60],
    amigas: ['alface', 'cebolinha', 'beterraba'],
    dica: 'No calor floresce cedo; melhor no outono e no inverno.' }),

  // ---------------- Ervas ----------------
  P('manjericao', 'Manjericão', 'ervas', '🌿', {
    sol: 6, esp: [30, 40], forma: 'ambos', sem: meses(9, 1), col: [60, 90], geada: true,
    amigas: ['tomate', 'pimentao', 'pimentas', 'oregano'],
    dica: 'Morre com geada: semeie a partir de setembro. Corte as flores para a planta produzir mais folhas.' }),
  P('cebolinha', 'Cebolinha', 'ervas', '🌱', {
    sol: 4, esp: [15, 25], forma: 'ambos', sem: meses(1, 12), col: [70, 90], perene: true,
    amigas: ['cenoura', 'tomate', 'morango', 'alface', 'couve'],
    inimigas: ['feijao-vagem', 'ervilha-torta'],
    dica: 'Corte rente e ela rebrota. Divida as touceiras para fazer mudas novas.' }),
  P('salsinha', 'Salsinha', 'ervas', '🌿', {
    alias: ['salsa'], sol: 4, esp: [15, 25], sem: meses(1, 12), col: [60, 90],
    amigas: ['tomate', 'milho-verde', 'cebolinha'], inimigas: ['alface'],
    dica: 'Demora até 30 dias para germinar: deixe as sementes de molho uma noite.' }),
  P('coentro', 'Coentro', 'ervas', '🌿', {
    sol: 4, esp: [10, 20], sem: [2, 3, 4, 8, 9, 10, 11], col: [40, 60], geada: true,
    amigas: ['tomate', 'feijao-vagem'],
    dica: 'Semeie direto no lugar — não gosta de transplante. No calor forte floresce rápido.' }),
  P('hortela', 'Hortelã', 'ervas', '🌿', {
    sol: 3, esp: [30, 40], forma: 'estaca', sem: meses(1, 12), col: [60, 90], perene: true,
    amigas: ['couve', 'repolho', 'tomate'],
    dica: 'Espalha muito pelas raízes: plante em vaso ou num canto separado.' }),
  P('oregano', 'Orégano', 'ervas', '🌿', {
    sol: 6, esp: [30, 40], forma: 'ambos', sem: meses(8, 11), col: [90, 120], perene: true,
    amigas: ['pepino', 'abobrinha', 'pimentao', 'pimentas', 'manjericao'],
    dica: 'Gosta de solo seco e bem drenado; o sabor fica mais forte com bastante sol.' }),
  P('tomilho', 'Tomilho', 'ervas', '🌿', {
    sol: 6, esp: [25, 30], forma: 'ambos', sem: meses(8, 11), col: [90, 120], perene: true,
    amigas: ['couve', 'repolho', 'tomate', 'berinjela'],
    dica: 'Não gosta de excesso de água.' }),
  P('alecrim', 'Alecrim', 'ervas', '🌿', {
    sol: 6, esp: [50, 60], forma: 'estaca', sem: meses(8, 11), col: [120, 180], perene: true,
    amigas: ['couve', 'repolho', 'brocolis', 'cenoura', 'feijao-vagem', 'salvia'],
    dica: 'Solo seco e bem drenado. Não regue demais.' }),
  P('estragao', 'Estragão', 'ervas', '🌿', {
    sol: 6, esp: [40, 50], forma: 'estaca', sem: meses(8, 11), col: [90, 120], perene: true,
    amigas: ['berinjela', 'pimentao'],
    dica: 'Prefira o estragão-francês (mais aromático), que se planta por mudas.' }),
  P('segurelha', 'Segurelha', 'ervas', '🌿', {
    sol: 6, esp: [25, 30], forma: 'ambos', sem: meses(8, 11), col: [60, 90],
    amigas: ['feijao-vagem', 'cebola'],
    dica: 'Boa companheira do feijão.' }),
  P('erva-cidreira', 'Erva-cidreira', 'ervas', '🌿', {
    alias: ['melissa'], sol: 4, esp: [40, 50], forma: 'ambos', sem: [3, 4, 8, 9, 10, 11], col: [90, 120], perene: true,
    dica: 'Atrai abelhas. Corte com frequência para a planta ficar cheia de folhas.' }),
  P('manjerona', 'Manjerona', 'ervas', '🌿', {
    sol: 6, esp: [25, 30], forma: 'ambos', sem: meses(8, 11), col: [90, 120], geada: true,
    amigas: ['abobrinha', 'pimentao'],
    dica: 'Parecida com o orégano, mas mais delicada ao frio.' }),
  P('salvia', 'Sálvia', 'ervas', '🌿', {
    sol: 6, esp: [40, 50], forma: 'ambos', sem: meses(8, 11), col: [90, 120], perene: true,
    amigas: ['couve', 'repolho', 'alecrim', 'cenoura', 'tomate'], inimigas: ['pepino'],
    dica: 'Gosta de sol e solo seco.' }),
  P('louro', 'Louro', 'ervas', '🌳', {
    sol: 6, esp: [200, 200], forma: 'estaca', sem: meses(8, 11), col: [365, 730], perene: true,
    dica: 'É uma árvore: pode passar de 5 m. Plante num canto ou em vaso grande — e lembre que vai fazer sombra.' }),

  // ---------------- Frutos ----------------
  P('tomate', 'Tomate', 'frutos', '🍅', {
    sol: 6, esp: [50, 100], forma: 'muda', sem: meses(8, 12), tr: meses(9, 1), col: [100, 130], geada: true, tutor: true,
    amigas: ['manjericao', 'salsinha', 'cebolinha', 'tagetes', 'alho', 'cenoura', 'capuchinha', 'cebola'],
    inimigas: ['batata', 'berinjela', 'jilo', 'milho-verde'],
    dica: 'Semeie em bandeja a partir de agosto (protegido do frio) e transplante quando passar o risco de geada. Precisa de tutor. Evite molhar as folhas.' }),
  P('pimentao', 'Pimentão', 'frutos', '🫑', {
    sol: 6, esp: [50, 80], forma: 'muda', sem: meses(8, 11), tr: meses(9, 12), col: [100, 130], geada: true, tutor: true,
    amigas: ['manjericao', 'cebola', 'oregano', 'cenoura', 'manjerona'], inimigas: ['berinjela'],
    dica: 'Gosta de calor. Um tutor curto evita que o pé tombe com o peso dos frutos.' }),
  P('pimentas', 'Pimentas', 'frutos', '🌶️', {
    alias: ['pimenta', 'pimenta capsicum', 'pimenta dedo de moca', 'pimenta malagueta'],
    sol: 6, esp: [50, 80], forma: 'muda', sem: meses(8, 11), tr: meses(9, 12), col: [90, 130], geada: true,
    amigas: ['manjericao', 'oregano', 'cenoura'],
    dica: 'Pode durar mais de um ano se ficar protegida da geada.' }),
  P('berinjela', 'Berinjela', 'frutos', '🍆', {
    sol: 6, esp: [60, 100], forma: 'muda', sem: meses(8, 11), tr: meses(9, 12), col: [100, 130], geada: true,
    amigas: ['feijao-vagem', 'tagetes', 'tomilho', 'estragao', 'coentro'],
    inimigas: ['tomate', 'batata', 'pimentao', 'jilo'],
    dica: 'Precisa de bastante calor. Mantenha longe de tomate, batata, pimentão e jiló (mesmas pragas e doenças).' }),
  P('jilo', 'Jiló', 'frutos', '🟢', {
    sol: 6, esp: [80, 100], forma: 'muda', sem: meses(8, 11), tr: meses(9, 12), col: [90, 120], geada: true,
    inimigas: ['berinjela', 'tomate'],
    dica: 'Planta de calor; produz por vários meses.' }),
  P('abobrinha', 'Abobrinha', 'frutos', '🥒', {
    alias: ['abobrinha italiana'], sol: 6, esp: [80, 100], forma: 'ambos', sem: meses(9, 1), col: [50, 70], geada: true,
    amigas: ['milho-verde', 'feijao-vagem', 'capuchinha', 'oregano', 'rabanete', 'manjerona'], inimigas: ['batata'],
    dica: 'Colha os frutos novos (15–20 cm) para a planta continuar produzindo.' }),
  P('abobora', 'Abóbora', 'frutos', '🎃', {
    alias: ['moranga', 'cabotia', 'cabotian'], sol: 6, esp: [200, 300], sem: meses(9, 12), col: [100, 150], geada: true,
    amigas: ['milho-verde', 'feijao-vagem', 'capuchinha', 'tagetes'], inimigas: ['batata'],
    dica: 'As ramas se espalham por vários metros. Combina com milho e feijão — as “três irmãs”.' }),
  P('pepino', 'Pepino', 'frutos', '🥒', {
    sol: 6, esp: [50, 100], forma: 'ambos', sem: meses(9, 1), col: [50, 70], geada: true, tutor: true,
    amigas: ['milho-verde', 'feijao-vagem', 'alface', 'rabanete', 'girassol', 'capuchinha', 'oregano', 'ervilha-torta'],
    inimigas: ['batata', 'salvia'],
    dica: 'Conduza numa treliça para ter frutos mais retos e menos doenças.' }),
  P('quiabo', 'Quiabo', 'frutos', '🟢', {
    sol: 6, esp: [40, 100], sem: meses(10, 1), col: [70, 90], geada: true,
    amigas: ['pimentao', 'pepino'],
    dica: 'Precisa de calor: em Piraquara, só no verão. Deixe as sementes de molho antes de plantar.' }),
  P('chuchu', 'Chuchu', 'frutos', '🥒', {
    sol: 6, esp: [500, 500], forma: 'fruto', sem: meses(8, 10), col: [120, 150], geada: true, tutor: true, perene: true,
    dica: 'Plante o fruto inteiro já brotado. Precisa de uma latada grande — e faz bastante sombra.' }),
  P('melancia', 'Melancia', 'frutos', '🍉', {
    sol: 6, esp: [200, 250], sem: meses(9, 12), col: [80, 110], geada: true,
    amigas: ['milho-verde', 'capuchinha'], inimigas: ['batata'],
    dica: 'Precisa de muito sol, calor e espaço para as ramas.' }),
  P('melao', 'Melão', 'frutos', '🍈', {
    sol: 6, esp: [100, 200], sem: meses(9, 12), col: [80, 110], geada: true,
    amigas: ['milho-verde', 'girassol', 'capuchinha'], inimigas: ['batata'],
    dica: 'Gosta de calor e de folhas secas — regue no pé.' }),
  P('morango', 'Morango', 'frutos', '🍓', {
    sol: 6, esp: [30, 40], forma: 'estaca', sem: meses(3, 5), col: [150, 210], perene: true,
    amigas: ['alface', 'cebolinha', 'feijao-vagem', 'alho', 'cebola'],
    dica: 'Plante as mudas no outono (março a maio) para colher na primavera. Cubra o solo com palha.' }),

  // ---------------- Raízes e tubérculos ----------------
  P('cenoura', 'Cenoura', 'tuberculos', '🥕', {
    sol: 4, esp: [5, 25], sem: meses(1, 12), col: [90, 110],
    amigas: ['alface', 'tomate', 'cebolinha', 'alecrim', 'salvia', 'ervilha-torta', 'rabanete', 'cebola'],
    dica: 'Semeie direto (não transplante), em solo fofo e sem pedras. Desbaste deixando 5 cm entre as plantas.' }),
  P('beterraba', 'Beterraba', 'tuberculos', '🔴', {
    sol: 4, esp: [10, 25], forma: 'ambos', sem: meses(2, 11), col: [60, 80],
    amigas: ['alface', 'cebola', 'couve', 'alho', 'rucula'],
    dica: 'Cada “semente” tem várias sementes dentro: desbaste deixando a muda mais forte.' }),
  P('rabanete', 'Rabanete', 'tuberculos', '🔴', {
    sol: 4, esp: [5, 15], sem: meses(1, 12), col: [25, 35],
    amigas: ['alface', 'cenoura', 'pepino', 'ervilha-torta', 'capuchinha', 'abobrinha'],
    dica: 'Fica pronto em cerca de 30 dias — ótimo para semear entre plantas mais lentas.' }),
  P('nabo', 'Nabo', 'tuberculos', '⚪', {
    sol: 4, esp: [10, 25], sem: meses(2, 8), col: [50, 70],
    amigas: ['ervilha-torta'],
    dica: 'Prefere o tempo fresco.' }),
  P('batata-doce', 'Batata-doce', 'tuberculos', '🍠', {
    sol: 6, esp: [30, 90], forma: 'rama', sem: meses(9, 12), col: [120, 150], geada: true,
    dica: 'Plante pedaços de rama (20–30 cm) em leiras altas. As folhas novas também são comestíveis.' }),
  P('batata-salsa', 'Batata-salsa', 'tuberculos', '🥕', {
    alias: ['mandioquinha', 'batata baroa'], sol: 4, esp: [40, 80], forma: 'rebento', sem: [3, 4, 5], col: [270, 360],
    dica: 'Ciclo longo (9 a 12 meses) — combina com o clima frio do Paraná. Plante os rebentos com a base cortada em bisel.' }),
  P('inhame', 'Inhame', 'tuberculos', '🟤', {
    alias: ['taro'], sol: 4, esp: [40, 80], forma: 'tuberculo', sem: meses(8, 11), col: [210, 270], geada: true,
    dica: 'Gosta de umidade; colha quando as folhas amarelarem.' }),
  P('gengibre', 'Gengibre', 'tuberculos', '🫚', {
    sol: 3, esp: [20, 40], forma: 'tuberculo', sem: meses(8, 10), col: [240, 300], geada: true,
    dica: 'Prefere meia-sombra, calor e umidade. Colha quando as folhas secarem, no inverno.' }),
  P('curcuma', 'Cúrcuma', 'tuberculos', '🟠', {
    alias: ['acafrao da terra', 'acafrao'], sol: 4, esp: [30, 40], forma: 'tuberculo', sem: meses(8, 10), col: [240, 300], geada: true,
    dica: 'Plante pedaços do rizoma com brotos. Colha no inverno, quando a parte de cima secar.' }),
  P('batata', 'Batata', 'tuberculos', '🥔', {
    alias: ['batata inglesa'], sol: 6, esp: [30, 80], forma: 'tuberculo', sem: [2, 3, 8, 9], col: [90, 120],
    amigas: ['feijao-vagem', 'milho-verde', 'tagetes'],
    inimigas: ['tomate', 'berinjela', 'abobora', 'abobrinha', 'pepino', 'melancia', 'melao', 'girassol'],
    dica: 'No Paraná: plantio de agosto–setembro ou de fevereiro–março. Amontoe terra no pé conforme cresce.' }),
  P('alho', 'Alho', 'tuberculos', '🧄', {
    sol: 6, esp: [10, 25], forma: 'bulbo', sem: [5, 6, 7], col: [150, 180],
    amigas: ['tomate', 'cenoura', 'beterraba', 'morango', 'alface'], inimigas: ['feijao-vagem', 'ervilha-torta'],
    dica: 'Plante os dentes de maio a julho — precisa de frio para formar a cabeça.' }),
  P('cebola', 'Cebola', 'tuberculos', '🧅', {
    sol: 6, esp: [10, 30], forma: 'muda', sem: meses(3, 5), tr: meses(5, 7), col: [150, 180],
    amigas: ['cenoura', 'beterraba', 'alface', 'tomate', 'morango', 'pimentao', 'couve', 'acelga', 'rucula', 'segurelha'],
    inimigas: ['feijao-vagem', 'ervilha-torta'],
    dica: 'Semeie em bandeja no outono e transplante no inverno.' }),

  // ---------------- Grãos e vagens ----------------
  P('milho-verde', 'Milho-verde', 'outras', '🌽', {
    alias: ['milho'], sol: 6, esp: [25, 90], sem: meses(9, 12), col: [90, 110], geada: true,
    amigas: ['feijao-vagem', 'abobora', 'pepino', 'melancia', 'melao', 'abobrinha', 'salsinha', 'girassol'],
    inimigas: ['tomate'],
    dica: 'Plante em bloco (várias fileiras lado a lado), não numa fila só — ajuda na polinização. É alto e faz sombra.' }),
  P('feijao-vagem', 'Feijão-vagem', 'outras', '🫛', {
    alias: ['vagem'], sol: 6, esp: [10, 50], sem: meses(9, 2), col: [60, 70], geada: true, tutor: true,
    amigas: ['milho-verde', 'cenoura', 'pepino', 'couve', 'berinjela', 'batata', 'alecrim', 'segurelha', 'morango', 'abobora', 'abobrinha'],
    inimigas: ['alho', 'cebola', 'cebolinha'],
    dica: 'A variedade trepadora precisa de tutor ou treliça; a rasteira não.' }),
  P('ervilha-torta', 'Ervilha-torta', 'outras', '🫛', {
    alias: ['ervilha'], sol: 4, esp: [10, 60], sem: meses(3, 8), col: [60, 80], tutor: true,
    amigas: ['cenoura', 'rabanete', 'nabo', 'pepino', 'milho-verde', 'alface'],
    inimigas: ['alho', 'cebola', 'cebolinha'],
    dica: 'Gosta do frio — semeie do outono ao fim do inverno. Precisa de treliça.' }),

  // ---------------- Flores ----------------
  P('girassol', 'Girassol', 'flores', '🌻', {
    sol: 6, esp: [40, 80], sem: meses(9, 1), col: [80, 100], geada: true,
    amigas: ['pepino', 'milho-verde', 'melao'], inimigas: ['batata'],
    dica: 'Atrai abelhas e pássaros. É alto e faz sombra — no hemisfério sul, prefira o lado sul da horta.' }),
  P('zinia', 'Zínia', 'flores', '🌸', {
    sol: 6, esp: [25, 30], forma: 'ambos', sem: meses(9, 1), col: [60, 75], geada: true,
    amigas: ['tomate', 'abobora', 'pepino'],
    dica: 'Atrai borboletas, abelhas e joaninhas.' }),
  P('cosmos', 'Cosmos', 'flores', '🌸', {
    sol: 6, esp: [30, 40], sem: meses(9, 12), col: [60, 90],
    amigas: ['tomate', 'milho-verde'],
    dica: 'Atrai insetos que comem pragas. Costuma se ressemear sozinho.' }),
  P('vinca', 'Vinca', 'flores', '🌸', {
    alias: ['boa noite'], sol: 4, esp: [30, 30], forma: 'ambos', sem: meses(9, 12), col: [90, 120], perene: true,
    dica: 'Só ornamental: é tóxica, não comer.' }),
  P('dalia', 'Dália', 'flores', '🌺', {
    sol: 6, esp: [50, 60], forma: 'tuberculo', sem: meses(8, 10), col: [90, 120], geada: true,
    dica: 'Plante os tubérculos depois das geadas. As variedades altas precisam de tutor.' }),
  P('gladiolo', 'Gladíolo', 'flores', '🌺', {
    sol: 6, esp: [15, 30], forma: 'bulbo', sem: meses(8, 12), col: [90, 110],
    dica: 'Plante bulbos a cada 15 dias para ter flores por mais tempo.' }),
  P('petunia', 'Petúnia', 'flores', '🌸', {
    sol: 6, esp: [25, 30], forma: 'muda', sem: [3, 4, 8, 9, 10], col: [80, 100],
    amigas: ['tomate', 'feijao-vagem'],
    dica: 'Boa para bordas e vasos.' }),
  P('hibisco', 'Hibisco', 'flores', '🌺', {
    sol: 6, esp: [150, 150], forma: 'estaca', sem: meses(9, 11), col: [365, 730], perene: true, geada: true,
    dica: 'É um arbusto grande e pode fazer sombra. Algumas espécies têm flores comestíveis.' }),
  P('alamanda', 'Alamanda', 'flores', '🌼', {
    sol: 6, esp: [150, 150], forma: 'estaca', sem: meses(9, 11), col: [365, 730], perene: true, geada: true, tutor: true,
    dica: 'Trepadeira grande e tóxica (não comer). Precisa de cerca ou pérgola.' }),
  P('ixora', 'Ixora', 'flores', '🌺', {
    sol: 4, esp: [80, 100], forma: 'estaca', sem: meses(9, 11), col: [365, 730], perene: true, geada: true,
    dica: 'Arbusto que gosta de solo ácido; sensível a geada.' }),
  P('tagetes', 'Tagetes', 'flores', '🌼', {
    alias: ['cravo de defunto', 'cravo'], sol: 6, esp: [25, 30], forma: 'ambos', sem: meses(8, 3), col: [60, 75],
    amigas: ['tomate', 'couve', 'repolho', 'batata', 'abobora', 'berinjela', 'pimentao', 'feijao-vagem'],
    dica: 'Ajuda a afastar nematoides e pulgões. Ótima nas bordas dos canteiros.' }),
  P('geranio', 'Gerânio', 'flores', '🌸', {
    sol: 6, esp: [30, 40], forma: 'estaca', sem: [3, 4, 9, 10, 11], col: [90, 120], perene: true,
    dica: 'Fácil de multiplicar por estacas.' }),
  P('flor-de-cardeal', 'Flor de cardeal', 'flores', '🌺', {
    alias: ['cardeal'], sol: 6, esp: [30, 30], sem: meses(9, 12), col: [60, 90], geada: true, tutor: true,
    dica: 'Há mais de uma planta com esse nome. Estes dados são da trepadeira cardeal (Ipomoea), que atrai beija-flores — ajuste se a sua for outra.' }),
  P('capuchinha', 'Capuchinha', 'flores', '🌼', {
    sol: 4, esp: [30, 40], sem: [3, 4, 8, 9, 10, 11, 12], col: [50, 70], geada: true,
    amigas: ['couve', 'repolho', 'brocolis', 'pepino', 'abobora', 'abobrinha', 'tomate', 'rabanete', 'melancia', 'melao'],
    dica: 'Folhas e flores comestíveis. Atrai os pulgões para ela, protegendo as vizinhas (planta-isca).' }),
];

// A lista marcada na planilha

// =====================================================================
//  Revisão com fontes (nov/2026)
//
//  E93  = Embrapa Hortaliças, "O cultivo de hortaliças" (Makishima, 1993) —
//         épocas de plantio, usando a janela indicada para "regiões de
//         inverno frio" / "verão ameno" (o caso de Piraquara, ~900 m).
//  ABC  = ABCSEM, "Manual técnico para cultivo de hortaliças", 4ª ed. (2020) —
//         espaçamento (entre linhas × entre plantas) e ciclo.
//  IDR  = IDR-Paraná / Simepar — geadas concentradas em jun–ago na região
//         metropolitana de Curitiba (Alerta Geada de maio a setembro).
//  Plantas sensíveis a geada só vão para o canteiro a partir de set/out.
//  Valores sem fonte oficial (ervas, flores, companheirismo) são estimativas.
//
//  Lembrete: aqui "esp" = [entre plantas, entre linhas] em cm.
// =====================================================================
const FONTES = {
  E93: { nome: 'Embrapa Hortaliças — O cultivo de hortaliças (1993)', url: 'https://www.infoteca.cnptia.embrapa.br/infoteca/bitstream/doc/112928/1/Ocultivodehortalicas.pdf' },
  ABC: { nome: 'ABCSEM — Manual técnico para cultivo de hortaliças, 4ª ed. (2020)', url: 'https://www.horticeres.com.br/drive/abcsem_%202020.pdf' },
  IDR: { nome: 'IDR-Paraná — Alerta Geada (maio a setembro)', url: 'https://www.idrparana.pr.gov.br/Pagina/Alerta-Geada' },
};
const TODO_ANO = meses(1, 12);
const REVISAO_FONTES = {
  // --- folhas ---
  alface:      { esp: [30, 30], col: [50, 80], fontes: ['E93', 'ABC'] },
  rucula:      { sem: TODO_ANO, esp: [8, 15], col: [30, 50], fontes: ['E93', 'ABC'], dica: 'Ciclo curto (30–50 dias). Em Piraquara dá o ano todo; no calor forte floresce cedo — semeie um pouco a cada 15–20 dias.' },
  agriao:      { esp: [20, 25], col: [50, 80], fontes: ['ABC'] },
  couve:       { esp: [60, 100], col: [80, 120], fontes: ['E93', 'ABC'] },
  repolho:     { sem: [3, 4, 5, 6, 9, 10, 11, 12, 1], esp: [40, 70], col: [80, 110], fontes: ['E93', 'ABC'],
                 dica: 'Duas épocas: plantio de inverno (mar–jun) ou de verão (set–jan) — escolha a cultivar certa para cada uma.' },
  brocolis:    { sem: [3, 4, 5, 6, 9, 10, 11, 12, 1], esp: [50, 100], col: [90, 120], fontes: ['E93', 'ABC'],
                 dica: 'Duas épocas: inverno (mar–jun) ou verão (set–jan), com cultivar adequada. Depois da cabeça principal, os brotos laterais continuam produzindo.' },
  'couve-flor':{ sem: [3, 4, 5, 6, 9, 10, 11, 12, 1], esp: [55, 100], col: [90, 140], fontes: ['E93', 'ABC'],
                 dica: 'Duas épocas: inverno (mar–jun) ou verão (set–jan) — a cultivar precisa combinar com a época. Amarre as folhas por cima para a flor ficar branca.' },
  acelga:      { sem: TODO_ANO, esp: [25, 40], col: [60, 80], fontes: ['E93', 'ABC'] },
  almeirao:    { col: [60, 80], fontes: ['ABC'] },
  chicoria:    { sem: TODO_ANO, esp: [30, 30], col: [70, 90], fontes: ['E93', 'ABC'], dica: 'Em regiões altas de clima ameno, como Piraquara, dá o ano todo; no calor fica mais amarga.' },
  'espinafre-nz': { sem: meses(9, 2), esp: [30, 40], col: [60, 90], fontes: ['ABC'] },
  mostarda:    { sem: TODO_ANO, esp: [30, 30], col: [60, 80], fontes: ['ABC'] },
  tatsoi:      { sem: meses(2, 10), fontes: ['E93'] },
  'bok-choy':  { sem: meses(2, 10), fontes: ['E93'] },
  // --- frutos ---
  tomate:      { sem: [8, 9, 10, 11], tr: [9, 10, 11, 12], col: [100, 130], fontes: ['E93', 'ABC', 'IDR'],
                 dica: 'Em regiões de inverno frio a época é de agosto a novembro: semeie na bandeja protegida e transplante depois das geadas. Precisa de tutor; evite molhar as folhas.' },
  pimentao:    { sem: [8, 9, 10], tr: [9, 10, 11], esp: [50, 120], col: [100, 130], fontes: ['E93', 'ABC', 'IDR'] },
  pimentas:    { sem: [8, 9, 10], tr: [9, 10, 11], esp: [70, 120], col: [100, 150], fontes: ['E93', 'ABC', 'IDR'] },
  berinjela:   { sem: [8, 9], tr: [9, 10], esp: [80, 130], col: [100, 130], fontes: ['E93', 'ABC', 'IDR'] },
  jilo:        { sem: [8, 9], tr: [9, 10], esp: [80, 130], col: [100, 120], fontes: ['E93', 'ABC', 'IDR'] },
  abobrinha:   { sem: meses(9, 2), esp: [60, 110], col: [45, 60], fontes: ['E93', 'ABC'] },
  abobora:     { sem: meses(9, 12), esp: [200, 250], col: [90, 120], fontes: ['E93', 'ABC'] },
  pepino:      { sem: meses(9, 2), esp: [40, 80], col: [50, 80], fontes: ['E93', 'ABC'] },
  quiabo:      { sem: [10, 11, 12, 1], esp: [35, 110], col: [60, 80], fontes: ['E93', 'ABC'] },
  chuchu:      { sem: [10, 11, 12], col: [90, 120], fontes: ['E93', 'ABC', 'IDR'], dica: 'Em regiões de inverno frio, plante depois das geadas (out–dez). Plante o fruto inteiro já brotado; precisa de latada grande e faz bastante sombra.' },
  melancia:    { sem: [9, 10, 11], esp: [100, 250], col: [70, 100], fontes: ['E93', 'ABC'] },
  melao:       { sem: [9, 10, 11], esp: [40, 200], col: [60, 90], fontes: ['E93', 'ABC'] },
  morango:     { fontes: ['ABC'] },
  // --- raízes e tubérculos ---
  cenoura:     { esp: [6, 20], col: [85, 120], fontes: ['ABC'] },
  beterraba:   { sem: TODO_ANO, esp: [10, 25], col: [60, 90], fontes: ['E93', 'ABC'] },
  rabanete:    { esp: [7, 18], col: [25, 40], fontes: ['E93', 'ABC'] },
  nabo:        { sem: meses(2, 9), esp: [12, 28], col: [60, 80], fontes: ['E93', 'ABC'] },
  'batata-doce': { sem: [10, 11, 12], esp: [35, 100], col: [100, 150], fontes: ['E93', 'ABC', 'IDR'],
                 dica: 'Não tolera geada: em Piraquara, plante ramas de outubro a dezembro, em leiras altas. As folhas novas também são comestíveis.' },
  'batata-salsa': { sem: [2, 3, 4, 5, 6, 9, 10], esp: [40, 75], col: [240, 390], fontes: ['E93', 'ABC'],
                 dica: 'Ciclo longo (8 a 13 meses), ótima para o clima de altitude. Plante os rebentos de fev–jun ou set–out, com a base cortada em bisel.' },
  batata:      { esp: [35, 80], col: [90, 110], fontes: ['E93', 'ABC'] },
  alho:        { sem: [5, 6, 7], esp: [10, 30], col: [150, 200], fontes: ['E93', 'ABC'],
                 dica: 'No Sul, plante os dentes de maio a julho (Embrapa indica jun–jul) — precisa de frio para formar a cabeça. Ciclo longo no Sul: até 200 dias.' },
  cebola:      { sem: [4, 5, 6], tr: [6, 7, 8], esp: [8, 20], col: [170, 210], fontes: ['E93', 'ABC'],
                 dica: 'No Sul, semeie em bandeja de abril a junho e transplante ~2 meses depois; colheita de outubro a dezembro.' },
  // --- grãos e vagens ---
  'milho-verde':  { sem: [10, 11, 12], esp: [25, 90], col: [80, 110], fontes: ['ABC', 'IDR'] },
  'feijao-vagem': { sem: meses(9, 1), esp: [35, 100], col: [60, 75], fontes: ['E93', 'ABC'] },
  'ervilha-torta':{ sem: [4, 5, 6, 7], col: [60, 90], fontes: ['E93'] },
  // --- ervas com fonte ---
  salsinha:    { esp: [8, 25], col: [50, 70], fontes: ['E93', 'ABC'] },
  cebolinha:   { col: [70, 100], fontes: ['E93', 'ABC'] },
  coentro:     { sem: meses(9, 3), fontes: ['E93'], dica: 'Gosta de calor: em regiões de inverno frio, semeie de setembro a março, direto no lugar (não gosta de transplante).' },
};

for (const [id, rev] of Object.entries(REVISAO_FONTES)) {
  const p = PLANTAS_BASE.find(x => x.id === id);
  if (!p) continue;
  Object.assign(p, rev);
  // mudas sem meses de transplante informados: ~1 mês depois de semear
  if (p.forma === 'muda' && rev.sem && !rev.tr) p.tr = [...new Set(p.sem.map(m => m % 12 + 1))];
}
for (const p of PLANTAS_BASE) if (!p.fontes) p.fontes = [];

// ---------------------------------------------------------------------
//  Revisão 2 — ervas, gengibre e capuchinha (nov/2026)
//  PEL  = Embrapa Clima Temperado (Pelotas, RS) — Coleção de plantas medicinais,
//         aromáticas e condimentares (Doc. 157): época de plantio no Sul, com geada.
//  C61  = Embrapa Clima Temperado — Circular Técnica 61 (2007): estacas herbáceas
//         e ervas vão para o canteiro em setembro, pois não toleram geada.
//  CON  = Embrapa Agroindústria Tropical — Plantas condimentares (Doc. 161, 2013):
//         usado SÓ para espaçamento e ciclo (é de Fortaleza, clima tropical).
//  GEN  = Lorenzetti — Cultivo de gengibre (compilação; regiões produtoras de SP e PR).
// ---------------------------------------------------------------------
Object.assign(FONTES, {
  PEL: { nome: 'Embrapa Clima Temperado (Pelotas) — Coleção de plantas medicinais, aromáticas e condimentares', url: 'https://www.infoteca.cnptia.embrapa.br/bitstream/doc/746066/1/documento157.pdf' },
  C61: { nome: 'Embrapa Clima Temperado — Circular Técnica 61 (2007)', url: 'https://www.infoteca.cnptia.embrapa.br/bitstream/doc/741835/1/Circular61.pdf' },
  CON: { nome: 'Embrapa Agroindústria Tropical — Plantas condimentares (2013) — só espaçamento e ciclo', url: 'https://www.infoteca.cnptia.embrapa.br/bitstream/doc/981610/1/DOC13004.pdf' },
  GEN: { nome: 'Lorenzetti — Cultivo de gengibre (regiões produtoras de SP e PR)', url: 'https://clonagri.com/wp-content/uploads/2015/09/Cultivogengibre.pdf' },
});
const REVISAO_ERVAS = {
  manjericao:   { sem: meses(9, 3), esp: [50, 70], col: [60, 90], fontes: ['PEL', 'C61', 'CON', 'IDR'],
                  dica: 'Em Pelotas planta-se o ano todo, mas morre com geada: em Piraquara, de setembro a março. Corte as flores para a planta produzir mais folhas.' },
  hortela:      { sem: TODO_ANO, esp: [30, 60], col: [90, 120], fontes: ['PEL', 'CON'] },
  oregano:      { sem: [3, 4, 9], esp: [40, 30], col: [80, 110], fontes: ['PEL', 'CON'],
                  dica: 'No Sul, plante em março–abril ou setembro (estacas, divisão de touceiras ou sementes). Gosta de solo seco e bem drenado.' },
  tomilho:      { sem: [3, 4, 5, 9, 10, 11], esp: [30, 50], col: [90, 120], fontes: ['PEL', 'CON'],
                  dica: 'Sementes no outono; estacas e divisão de touceiras na primavera. Não gosta de excesso de água.' },
  alecrim:      { sem: [3, 4, 10, 11], esp: [60, 100], fontes: ['PEL', 'C61', 'CON'],
                  dica: 'Estacas em outubro–novembro ou sementes em março–abril. Solo seco e bem drenado; não regue demais.' },
  estragao:     { sem: [3, 4, 5, 9, 10, 11], fontes: ['PEL'] },
  segurelha:    { sem: [9, 10, 11], esp: [30, 30], col: [60, 90], fontes: ['C61', 'CON'] },
  'erva-cidreira': { sem: [3, 4, 5, 9, 10, 11, 12], fontes: ['PEL'],
                  dica: 'Dois “cidreiras”: a melissa (sementes no outono, mudas em setembro) e a erva-cidreira-de-arbusto, Lippia alba (setembro a dezembro). Atrai abelhas.' },
  manjerona:    { sem: [3, 4, 9], esp: [30, 60], col: [60, 90], fontes: ['PEL', 'CON'] },
  salvia:       { sem: [3, 4, 5, 9, 10, 11], esp: [40, 60], col: [90, 120], fontes: ['PEL', 'CON'],
                  dica: 'Sementes no outono; estacas ou divisão de touceiras na primavera. Vive vários anos; gosta de sol e solo seco.' },
  louro:        { esp: [120, 120], fontes: ['CON'] },
  gengibre:     { sem: [8, 9, 10], esp: [20, 100], col: [210, 300], fontes: ['PEL', 'GEN', 'CON'],
                  dica: 'Em Pelotas planta-se em agosto–setembro (rizomas brotados); no Paraná, de agosto a dezembro. Colheita 7 a 10 meses depois, quando as folhas secam. Gosta de meia-sombra e umidade.' },
  curcuma:      { esp: [50, 70], col: [240, 300], fontes: ['CON'] },
  capuchinha:   { sem: [3, 9], fontes: ['PEL'],
                  dica: 'No Sul, semeie em março ou setembro. Folhas e flores comestíveis; atrai os pulgões para ela, protegendo as vizinhas (planta-isca).' },
};
for (const [id, rev] of Object.entries(REVISAO_ERVAS)) {
  const p = PLANTAS_BASE.find(x => x.id === id);
  if (!p) continue;
  Object.assign(p, rev);
  if (p.forma === 'muda' && rev.sem && !rev.tr) p.tr = [...new Set(p.sem.map(m => m % 12 + 1))];
}

// ---------------------------------------------------------------------
//  Revisão 3 — "melhores meses" (nov/2026)
//  Muitas plantas PODEM ir para o canteiro o ano todo (ou numa janela longa),
//  mas têm meses MELHORES. "sem" = meses possíveis; "melhor" = os melhores.
//  Embrapa (E93) costuma dizer: "época X; em regiões de verão ameno, o ano todo"
//  → X são os melhores meses e o resto do ano é possível.
//  CAT = Catálogo Brasileiro de Hortaliças (Embrapa/Sebrae) · BER = folder Embrapa Bertalha
//  YWG = Yes We Grow (blog, 2022) · WEB = sites de jardinagem (confiança menor)
// ---------------------------------------------------------------------
Object.assign(FONTES, {
  CAT: { nome: 'Catálogo Brasileiro de Hortaliças (Embrapa/Sebrae)', url: 'https://bibliotecas.sebrae.com.br/chronus/ARQUIVOS_CHRONUS/bds/bds.nsf/C22F9A4962A6E2E68325771C0065A2E4/$File/NT0004404E.pdf' },
  BER: { nome: 'Embrapa Hortaliças — folder Bertalha', url: 'https://www.infoteca.cnptia.embrapa.br/infoteca/bitstream/doc/1071183/1/folderbertalha.pdf' },
  YWG: { nome: 'Yes We Grow — Como plantar capuchinha (blog, 2022)', url: 'https://blog.yeswegrow.com.br/passo-a-passo-de-como-plantar-capuchinha/' },
  WEB: { nome: 'Sites de jardinagem (confiança menor)', url: 'https://ellasmagazine.com.br/natureza-eco/quando-plantar-zinia-para-nao-perder-a-florada-e-colher-o-maximo-da-temporada/' },
});
const REVISAO_MELHOR = {
  rucula:     { melhor: meses(3, 8) },
  beterraba:  { melhor: meses(4, 7) },
  acelga:     { melhor: meses(3, 5) },
  chicoria:   { melhor: meses(3, 7) },
  mostarda:   { melhor: meses(3, 7) },
  nabo:       { melhor: meses(3, 6) },
  couve:      { melhor: meses(3, 7) },
  tatsoi:     { melhor: meses(3, 6) },
  'bok-choy': { melhor: meses(3, 6) },
  rabanete:   { melhor: meses(3, 8) },
  cebolinha:  { melhor: meses(3, 6) },
  salsinha:   { melhor: meses(3, 7) },
  capuchinha: { sem: meses(8, 4), melhor: [3, 9, 10, 11], esp: [60, 60], col: [60, 90], fontes: ['PEL', 'YWG', 'IDR'],
                dica: 'Dá para semear quase o ano todo, mas floresce melhor na primavera (set–nov); em Pelotas indica-se março e setembro. Sensível a geada. Cada pé se espalha ~60 cm. Folhas e flores comestíveis; atrai pulgões para ela (planta-isca).' },
  inhame:     { sem: [9, 10, 11], melhor: [9, 10], esp: [30, 100], col: [150, 270], fontes: ['CAT', 'IDR'],
                dica: 'No Sul, plante em setembro–outubro (melhor época); colheita a partir de 150–180 dias. Não tolera geada. Gosta de umidade.' },
  bertalha:   { sem: [10, 11, 12, 1], melhor: [11], esp: [40, 80], col: [60, 90], fontes: ['BER'],
                dica: 'Planta de clima tropical: em Piraquara, só na época quente (out–jan). Colha os ramos de 30–40 cm a partir de 60–90 dias. Trepadeira: precisa de cerca ou treliça.' },
  girassol:   { sem: [9, 10, 11, 12, 1], melhor: [9, 10, 11], fontes: ['WEB', 'IDR'],
                dica: 'Semeie depois das geadas; a melhor época é a primavera. Atrai abelhas e pássaros. É alto e faz sombra — no hemisfério sul, prefira o lado sul da horta.' },
  zinia:      { sem: meses(9, 2), melhor: [9, 10, 11], fontes: ['WEB', 'IDR'],
                dica: 'Abaixo de 10 °C a zínia para de crescer: semeie a partir de setembro e repita a cada ~3 semanas até meados de fevereiro para ter flor o verão todo. Atrai borboletas, abelhas e joaninhas.' },
};
for (const [id, rev] of Object.entries(REVISAO_MELHOR)) {
  const p = PLANTAS_BASE.find(x => x.id === id);
  if (!p) continue;
  Object.assign(p, rev);
}

// ---------------------------------------------------------------------
//  Novas plantas (nov/2026) + origem de cada planta
//  MAPA = MAPA/Emater-MG/Embrapa — Hortaliças não-convencionais (2010): espaçamento e
//         colheita (é de Minas Gerais, sem geada: épocas ajustadas para depois das geadas)
//  ORA / TAI = folders Embrapa Hortaliças (ora-pro-nóbis, taioba)
//  IDRM = IDR-Paraná, Nota Técnica 13/2025 (mandioca no PR; noroeste — em região com
//         geada usa-se só a janela tardia, out–nov)
// ---------------------------------------------------------------------
Object.assign(FONTES, {
  MAPA: { nome: 'MAPA/Embrapa — Hortaliças não-convencionais (2010) — espaçamento e colheita', url: 'https://www.infoteca.cnptia.embrapa.br/infoteca/bitstream/doc/857646/1/Cartilha-Hortalicas-nao-convencionais.pdf' },
  ORA: { nome: 'Embrapa Hortaliças — folder Ora-pro-nóbis', url: 'https://www.infoteca.cnptia.embrapa.br/infoteca/bitstream/doc/1071168/1/forapronobis.pdf' },
  TAI: { nome: 'Embrapa Hortaliças — folder Taioba', url: 'https://www.infoteca.cnptia.embrapa.br/infoteca/bitstream/doc/1071385/1/ftaioba.pdf' },
  IDRM: { nome: 'IDR-Paraná — Nota Técnica 13/2025 (época de plantio da mandioca)', url: 'https://www.idrparana.pr.gov.br/system/files/publico/Publica%C3%A7%C3%B5es/Notas%20T%C3%A9cnicas/NotaTecnica13_2025_EpocaPlantioMandiocanoPR.pdf' },
});

// Evita confusão de nomes com as plantas novas
Object.assign(PLANTAS_BASE.find(p => p.id === 'pimentas'), { alias: ['pimenta', 'pimenta capsicum', 'pimenta malagueta'] });
Object.assign(PLANTAS_BASE.find(p => p.id === 'espinafre-nz'), { alias: ['espinafre nova zel', 'espinafre nova zelandia'] });

const tomateBase = PLANTAS_BASE.find(p => p.id === 'tomate');
const pimentasBase = PLANTAS_BASE.find(p => p.id === 'pimentas');
const BRASS_AMIGAS = ['alecrim', 'salvia', 'beterraba', 'cebola', 'capuchinha', 'tagetes', 'tomilho', 'hortela'];

const NOVAS_PLANTAS = [
  // --- variedades de tomate e pimenta (mesmas épocas do tomate/pimenta) ---
  P('tomate-cereja', 'Tomate-cereja', 'frutos', '🍅', { ...tomateBase, id: 'tomate-cereja', nome: 'Tomate-cereja', alias: ['tomate cereja', 'cereja'],
    esp: [40, 100], col: [85, 110], dica: 'Produz muito e por mais tempo; aguenta um pouco melhor o calor e as doenças. Conduza em tutor ou espaldeira. Mesmas épocas do tomate.' }),
  P('tomate-italiano', 'Tomate italiano', 'frutos', '🍅', { ...tomateBase, id: 'tomate-italiano', nome: 'Tomate italiano', alias: ['tomate saladete', 'tomate para molho'],
    esp: [50, 100], col: [100, 130], dica: 'Fruto alongado, ótimo para molho. Precisa de tutor. Mesmas épocas do tomate.' }),
  P('tomate-caqui', 'Tomate caqui', 'frutos', '🍅', { ...tomateBase, id: 'tomate-caqui', nome: 'Tomate caqui', alias: ['tomate salada', 'tomate grande'],
    esp: [50, 100], col: [110, 140], dica: 'Frutos grandes para salada; ciclo um pouco mais longo. Tutor firme e desbrota. Mesmas épocas do tomate.' }),
  P('dedo-de-moca', 'Pimenta dedo-de-moça', 'frutos', '🌶️', { ...pimentasBase, id: 'dedo-de-moca', nome: 'Pimenta dedo-de-moça', alias: ['pimenta dedo de moca', 'dedo de moca'],
    dica: 'Capsicum baccatum, espécie nativa do Brasil. Em Pelotas (RS) semeia-se em agosto e transplanta-se em setembro–outubro.' }),
  P('biquinho', 'Pimenta biquinho', 'frutos', '🌶️', { ...pimentasBase, id: 'biquinho', nome: 'Pimenta biquinho', alias: ['pimenta biquinho', 'biquinho'],
    dica: 'Capsicum chinense, de origem amazônica — quase não arde. Gosta de calor: plante depois das geadas.' }),
  // --- raízes e tubérculos ---
  P('mandioca', 'Mandioca (aipim)', 'tuberculos', '🥔', { alias: ['aipim', 'macaxeira', 'mandioca'], sol: 6, esp: [60, 100], forma: 'estaca',
    sem: [10, 11], col: [300, 540], geada: true, fontes: ['IDRM', 'IDR'], familia: 'Outras',
    dica: 'Plante manivas (pedaços do caule) de 15–20 cm. No noroeste do PR planta-se de maio a setembro; em região de geada, como Piraquara, só depois do frio (out–nov). Colheita de 10 a 18 meses.' }),
  P('cara', 'Cará', 'tuberculos', '🟤', { alias: ['inhame cara', 'inhame-cará'], sol: 6, esp: [60, 120], forma: 'tuberculo', sem: [9, 10, 11],
    col: [180, 210], geada: true, tutor: true, fontes: ['MAPA', 'IDR'], familia: 'Outras',
    dica: 'Trepadeira: plante as túberas em covas altas e dê tutor. Não tolera geada. Colheita em 6–7 meses, quando a rama seca.' }),
  P('yacon', 'Yacon', 'tuberculos', '🍠', { alias: ['batata yacon', 'batata-yacon'], sol: 6, esp: [60, 100], forma: 'rebento', sem: [8, 9, 10],
    col: [180, 240], geada: true, familia: 'Asteráceas', dica: 'Raiz doce e crocante, dos Andes. Plante os rebentos na primavera; colha quando a parte de cima secar com o frio.' }),
  P('rabano', 'Rábano (daikon)', 'tuberculos', '⚪', { alias: ['daikon', 'rabano'], sol: 4, esp: [10, 70], sem: meses(1, 12), melhor: meses(3, 8),
    col: [50, 90], fontes: ['ABC'], familia: 'Brássicas', amigas: ['alface', 'ervilha-torta'],
    dica: 'Rabanete grande japonês. Prefere clima ameno; com cultivares tolerantes ao calor dá o ano todo.' }),
  P('alho-poro', 'Alho-poró', 'tuberculos', '🧅', { alias: ['alho poro', 'alho porro', 'alho-porró'], sol: 6, esp: [15, 40], forma: 'muda',
    sem: meses(1, 12), melhor: [3, 4, 5], col: [110, 140], fontes: ['E93', 'ABC'], familia: 'Aliáceas',
    amigas: ['cenoura', 'morango', 'beterraba'], inimigas: ['feijao-vagem', 'ervilha-torta'],
    dica: 'Prefere temperaturas amenas: o melhor é semear de março a maio; em região de verão ameno dá o ano todo. Amontoe terra no pé para branquear o talo.' }),
  P('araruta', 'Araruta', 'tuberculos', '🌱', { sol: 4, esp: [40, 80], forma: 'tuberculo', sem: [9, 10, 11], col: [180, 210], geada: true,
    fontes: ['MAPA', 'IDR'], familia: 'Outras', dica: 'Planta nativa; dá um polvilho fino. Plante os rizomas em leiras depois das geadas.' }),
  P('mangarito', 'Mangarito', 'tuberculos', '🟤', { sol: 4, esp: [25, 50], forma: 'tuberculo', sem: [9, 10, 11], col: [180, 210], geada: true,
    fontes: ['MAPA', 'IDR'], familia: 'Outras', dica: 'Hortaliça tradicional nativa, parente da taioba; pequenos rizomas saborosos. Plante depois das geadas.' }),
  // --- outras hortaliças ---
  P('salsao', 'Salsão (aipo)', 'folhas', '🥬', { alias: ['aipo', 'salsao'], sol: 4, esp: [30, 60], forma: 'muda', sem: [2, 3, 4], col: [120, 160],
    fontes: ['ABC'], familia: 'Apiáceas', amigas: ['tomate', 'couve', 'feijao-vagem'],
    dica: 'Gosta de clima ameno e sofre com geada: semeie no outono para colher na primavera. Exige muita água.' }),
  P('funcho', 'Erva-doce (funcho)', 'folhas', '🌿', { alias: ['funcho', 'erva doce de bulbo', 'erva-doce'], sol: 6, esp: [20, 35],
    sem: meses(1, 12), melhor: [4, 5], col: [80, 120], fontes: ['PEL', 'ABC'], familia: 'Apiáceas', inimigas: ['tomate', 'feijao-vagem', 'coentro'],
    dica: 'Em Pelotas semeia-se em abril–maio; em regiões de altitude, o ano todo. Não semeie em época muito fria (atrasa). Costuma prejudicar as vizinhas — dê um canto só para ela.' }),
  P('endro', 'Endro (dill)', 'ervas', '🌿', { alias: ['dill', 'aneto'], sol: 6, esp: [20, 30], sem: [8, 9, 10], col: [60, 90], fontes: ['PEL'],
    familia: 'Apiáceas', amigas: ['couve', 'alface', 'pepino', 'cebola'], inimigas: ['cenoura', 'funcho'],
    dica: 'Semeie no início da primavera, direto no lugar. Não plante perto do funcho (cruzam entre si). Atrai joaninhas e vespinhas que comem pragas.' }),
  P('espinafre', 'Espinafre', 'folhas', '🥬', { alias: ['espinafre verdadeiro'], sol: 4, esp: [15, 30], sem: meses(1, 12), melhor: meses(3, 7),
    col: [60, 90], fontes: ['E93', 'ABC'], familia: 'Amarantáceas', amigas: ['morango', 'alface', 'rabanete'],
    dica: 'O espinafre verdadeiro prefere frio (16–20 °C): melhor de março a julho; onde o verão é ameno, o ano todo.' }),
  P('couve-de-bruxelas', 'Couve-de-bruxelas', 'folhas', '🥬', { alias: ['couve de bruxelas'], sol: 6, esp: [50, 90], forma: 'muda', sem: [2, 3, 4, 5],
    col: [100, 140], fontes: ['ABC'], familia: 'Brássicas', amigas: BRASS_AMIGAS, inimigas: ['morango', 'tomate'],
    dica: 'Precisa de frio para formar os “repolhinhos”: semeie no fim do verão e outono.' }),
  P('alcachofra', 'Alcachofra', 'folhas', '🌿', { sol: 6, esp: [100, 120], forma: 'rebento', sem: [2, 3], col: [140, 210], perene: true,
    fontes: ['ABC'], familia: 'Asteráceas', dica: 'No Sul e Sudeste, plante de fevereiro a março: precisa de frio para formar as cabeças. Planta grande e perene.' }),
  P('maxixe', 'Maxixe', 'frutos', '🥒', { sol: 6, esp: [30, 110], sem: meses(9, 2), col: [50, 70], geada: true, tutor: true,
    fontes: ['E93', 'ABC'], familia: 'Cucurbitáceas', amigas: ['milho-verde', 'feijao-vagem'], inimigas: ['batata'],
    dica: 'Planta de calor: em clima frio, de setembro a fevereiro. Pode subir em cerca ou treliça.' }),
  P('physalis', 'Physalis', 'frutos', '🟠', { alias: ['fisalis', 'camapu'], sol: 6, esp: [60, 120], forma: 'muda', sem: [8, 9, 10], tr: [9, 10, 11],
    col: [90, 130], geada: true, tutor: true, familia: 'Solanáceas', inimigas: ['berinjela', 'batata'],
    dica: 'Frutinha andina dentro de um “balão”. Semeie em bandeja no fim do inverno e transplante depois das geadas; precisa de apoio.' }),
  // --- PANCs nativas ---
  P('ora-pro-nobis', 'Ora-pro-nóbis', 'folhas', '🌵', { alias: ['ora pro nobis', 'orapronobis'], sol: 4, esp: [50, 100], forma: 'estaca',
    sem: meses(9, 1), col: [90, 120], perene: true, tutor: true, fontes: ['ORA', 'MAPA'], familia: 'Outras',
    dica: 'A “carne verde”: folhas ricas em proteína. Plante estacas no início das chuvas (set–jan). Arbusto com espinhos, ótimo como cerca viva.' }),
  P('taioba', 'Taioba', 'folhas', '🍃', { sol: 3, esp: [40, 70], forma: 'tuberculo', sem: [9, 10, 11], col: [90, 120], perene: true, geada: true,
    fontes: ['TAI', 'MAPA', 'IDR'], familia: 'Outras',
    dica: 'Cuidado: só coma a taioba verdadeira (folhas e talos verde-claros, sem ponto roxo onde o talo encontra a folha). Gosta de umidade e meia-sombra; não tolera geada.' }),
  P('jambu', 'Jambu', 'ervas', '🌼', { sol: 4, esp: [30, 30], forma: 'ambos', sem: meses(9, 2), col: [50, 70], geada: true, fontes: ['MAPA', 'IDR'],
    familia: 'Asteráceas', dica: 'Erva amazônica que “adormece” a boca (tacacá, pato no tucupi). Planta de calor: só na época quente.' }),
  P('azedinha', 'Azedinha', 'folhas', '🍃', { alias: ['azeda'], sol: 4, esp: [20, 25], forma: 'muda', sem: meses(1, 12), col: [50, 70], perene: true,
    fontes: ['MAPA'], familia: 'Outras', dica: 'Folhas de sabor ácido (de limão), em saladas e molhos. Perene e resistente ao frio.' }),
  // --- flores ---
  P('calendula', 'Calêndula', 'flores', '🌼', { sol: 6, esp: [25, 30], sem: meses(3, 9), melhor: [3, 4, 5], col: [50, 70], familia: 'Asteráceas',
    amigas: ['tomate', 'couve', 'repolho', 'batata', 'cenoura'],
    dica: 'Flor de clima fresco — boa para o outono e inverno de Piraquara. Pétalas comestíveis; atrai inimigos naturais das pragas.' }),
  P('amor-perfeito', 'Amor-perfeito', 'flores', '🌸', { sol: 4, esp: [20, 20], forma: 'muda', sem: [3, 4, 5, 6, 7], melhor: [3, 4], col: [70, 90],
    familia: 'Outras', dica: 'Flor de inverno, aguenta frio. Flores comestíveis (enfeite de pratos).' }),
  P('borragem', 'Borragem', 'flores', '💠', { sol: 6, esp: [40, 50], sem: meses(3, 10), melhor: [3, 4, 9], col: [50, 60], familia: 'Outras',
    amigas: ['tomate', 'morango', 'abobrinha', 'pepino'], dica: 'Flores azuis comestíveis; atrai muitas abelhas. Costuma se ressemear sozinha.' }),
  P('camomila', 'Camomila', 'ervas', '🌼', { alias: ['maçanilha'], sol: 6, esp: [20, 30], sem: [3, 4], col: [60, 90], fontes: ['PEL'], familia: 'Asteráceas',
    amigas: ['couve', 'cebola', 'repolho'], dica: 'Semeie em março–abril sem enterrar as sementes (precisam de luz para germinar). Colha as flores abertas para chá.' }),
  P('lavanda', 'Lavanda (alfazema)', 'ervas', '💜', { alias: ['alfazema'], sol: 6, esp: [40, 60], forma: 'estaca', sem: [3, 10, 11], col: [180, 365],
    perene: true, fontes: ['PEL'], familia: 'Lamiáceas', dica: 'Sementes em março ou estacas em outubro–novembro. Solo bem drenado, sem excesso de água. Atrai abelhas.' }),
  P('boca-de-leao', 'Boca-de-leão', 'flores', '🌺', { sol: 6, esp: [25, 30], forma: 'muda', sem: [3, 4, 8, 9], col: [90, 110], familia: 'Outras',
    dica: 'Flor de clima ameno, boa para outono e primavera. Atrai abelhas mamangavas.' }),
  P('salvia-vermelha', 'Sálvia-vermelha', 'flores', '🌺', { alias: ['salvia vermelha', 'salvia ornamental', 'salvia-ornamental'], sol: 6, esp: [30, 40],
    forma: 'muda', sem: meses(9, 12), col: [70, 90], geada: true, familia: 'Lamiáceas',
    dica: 'Salvia splendens, nativa do Brasil. Flores vermelhas que atraem beija-flores. Plante depois das geadas.' }),
];
for (const p of NOVAS_PLANTAS) {
  if (!p.fontes) p.fontes = [];
  PLANTAS_BASE.push(p);
}

// Origem de cada planta (região/país de onde vem) e se é nativa do Brasil
const ORIGENS = {
  alface: 'Mediterrâneo', rucula: 'Mediterrâneo', agriao: 'Europa e Ásia', couve: 'Mediterrâneo', repolho: 'Mediterrâneo',
  brocolis: 'Mediterrâneo (Itália)', 'couve-flor': 'Mediterrâneo', acelga: 'Mediterrâneo', almeirao: 'Europa', chicoria: 'Mediterrâneo',
  'espinafre-nz': 'Nova Zelândia e Austrália', bertalha: 'Ásia tropical (Índia)', mostarda: 'Ásia (Índia e China)', tatsoi: 'China',
  'bok-choy': 'China', manjericao: 'Índia', cebolinha: 'Ásia (China)', salsinha: 'Mediterrâneo', coentro: 'Mediterrâneo e Oriente Médio',
  hortela: 'Europa e Ásia', oregano: 'Mediterrâneo', tomilho: 'Mediterrâneo', alecrim: 'Mediterrâneo', estragao: 'Ásia Central',
  segurelha: 'Mediterrâneo', 'erva-cidreira': 'Mediterrâneo (melissa) · Brasil (Lippia)', manjerona: 'Mediterrâneo', salvia: 'Mediterrâneo',
  louro: 'Mediterrâneo', tomate: 'Andes (Peru e Equador)', 'tomate-cereja': 'Andes (Peru e Equador)', 'tomate-italiano': 'Andes (Peru e Equador)',
  'tomate-caqui': 'Andes (Peru e Equador)', pimentao: 'México e América Central', pimentas: 'Américas (várias espécies do Brasil)',
  'dedo-de-moca': 'Brasil e Bolívia', biquinho: 'Bacia Amazônica', berinjela: 'Índia', jilo: 'África', abobrinha: 'México',
  abobora: 'Américas', pepino: 'Índia', quiabo: 'África (Etiópia)', chuchu: 'México e América Central', melancia: 'África',
  melao: 'África e Ásia', morango: 'Europa (híbrido de espécies americanas)', cenoura: 'Ásia Central (Afeganistão)', beterraba: 'Mediterrâneo',
  rabanete: 'Ásia e Europa', nabo: 'Europa e Ásia', 'batata-doce': 'América Central e do Sul', 'batata-salsa': 'Andes',
  inhame: 'Sudeste Asiático', gengibre: 'Sudeste Asiático', curcuma: 'Índia', batata: 'Andes (Peru e Bolívia)', alho: 'Ásia Central',
  cebola: 'Ásia Central', 'milho-verde': 'México', 'feijao-vagem': 'Américas (México e Andes)', 'ervilha-torta': 'Mediterrâneo e Oriente Médio',
  girassol: 'América do Norte', zinia: 'México', cosmos: 'México', vinca: 'Madagascar', dalia: 'México', gladiolo: 'África do Sul',
  petunia: 'América do Sul (sul do Brasil)', hibisco: 'Ásia (China)', alamanda: 'Brasil', ixora: 'Índia e Sudeste Asiático',
  tagetes: 'México', geranio: 'África do Sul', 'flor-de-cardeal': 'América tropical (México)', capuchinha: 'Andes (Peru)',
  mandioca: 'Brasil (Amazônia)', cara: 'Sudeste Asiático', yacon: 'Andes', rabano: 'Ásia (China e Japão)', 'alho-poro': 'Mediterrâneo',
  araruta: 'América tropical (inclui o Brasil)', mangarito: 'Brasil', salsao: 'Mediterrâneo', funcho: 'Mediterrâneo', endro: 'Mediterrâneo e Ásia',
  espinafre: 'Ásia Central (Pérsia)', 'couve-de-bruxelas': 'Europa (Bélgica)', alcachofra: 'Mediterrâneo', maxixe: 'África',
  physalis: 'Andes', 'ora-pro-nobis': 'América tropical (inclui o Brasil)', taioba: 'América tropical (inclui o Brasil)',
  jambu: 'Brasil (Amazônia)', azedinha: 'Europa', calendula: 'Mediterrâneo', 'amor-perfeito': 'Europa', borragem: 'Mediterrâneo',
  camomila: 'Europa', lavanda: 'Mediterrâneo', 'boca-de-leao': 'Mediterrâneo', 'salvia-vermelha': 'Brasil',
};
const NATIVAS_BR = ['pimentas', 'dedo-de-moca', 'biquinho', 'petunia', 'alamanda', 'mandioca', 'araruta', 'mangarito',
  'ora-pro-nobis', 'taioba', 'jambu', 'salvia-vermelha'];
for (const p of PLANTAS_BASE) {
  p.origem = ORIGENS[p.id] || '';
  p.nativa = NATIVAS_BR.includes(p.id);
}

// ---------------------------------------------------------------------
//  Cuidados (nov/2026): flores não são "colhidas" — elas florescem.
//  Para flores e ervas perenes: quando podar, tirar flores murchas, arrancar e
//  guardar bulbos/tubérculos, e quando replantar ou renovar.
//  meses: lista de meses, ou 'floracao' (= durante a floração).
//  São orientações gerais de jardinagem (não vêm das fontes oficiais de época).
// ---------------------------------------------------------------------
const TIPOS_CUIDADO = {
  podar:     { nome: 'Podar', icone: '✂️' },
  murchas:   { nome: 'Tirar flores murchas', icone: '🥀' },
  arrancar:  { nome: 'Arrancar e guardar', icone: '⛏️' },
  replantar: { nome: 'Replantar / renovar', icone: '🔁' },
};
const ANUAL = 'Planta anual: depois da florada, semeie de novo na próxima época.';
const CUIDADOS_PLANTAS = {
  // flores
  girassol:   [{ tipo: 'replantar', meses: [9, 10, 11, 12], texto: 'Anual, uma flor por pé: semeie de novo a cada 2–3 semanas para ter flores seguidas.' }],
  zinia:      [{ tipo: 'murchas', meses: 'floracao', texto: 'Tire as flores murchas para a planta continuar florindo.' },
               { tipo: 'replantar', meses: [9, 10, 11, 12, 1, 2], texto: 'Anual: semeie de novo a cada ~3 semanas, de setembro a fevereiro.' }],
  cosmos:     [{ tipo: 'murchas', meses: 'floracao', texto: 'Tire as flores murchas — ou deixe algumas secarem para ela se ressemear.' },
               { tipo: 'replantar', meses: [9, 10, 11, 12], texto: ANUAL }],
  tagetes:    [{ tipo: 'murchas', meses: 'floracao', texto: 'Tire as flores murchas; guarde as secas como sementes.' },
               { tipo: 'replantar', meses: [8, 9, 10, 11], texto: ANUAL }],
  capuchinha: [{ tipo: 'podar', meses: 'floracao', texto: 'Corte as ramas que avançarem sobre as vizinhas.' },
               { tipo: 'replantar', meses: [3, 9], texto: 'Dura pouco mais de uma estação: semeie de novo em março ou setembro.' }],
  calendula:  [{ tipo: 'murchas', meses: 'floracao', texto: 'Tire as flores murchas (ou colha as pétalas) para estimular novas.' },
               { tipo: 'replantar', meses: [3, 4, 5], texto: ANUAL }],
  'amor-perfeito': [{ tipo: 'murchas', meses: 'floracao', texto: 'Tire as flores murchas.' }, { tipo: 'replantar', meses: [3, 4], texto: ANUAL }],
  borragem:   [{ tipo: 'replantar', meses: [3, 9], texto: 'Anual; costuma se ressemear sozinha.' }],
  'boca-de-leao': [{ tipo: 'podar', meses: 'floracao', texto: 'Depois da primeira florada, corte as hastes — ela rebrota e floresce de novo.' },
               { tipo: 'replantar', meses: [3, 8], texto: ANUAL }],
  petunia:    [{ tipo: 'podar', meses: 'floracao', texto: 'Encurte os ramos compridos e tire as flores murchas para ela continuar cheia.' },
               { tipo: 'replantar', meses: [8, 9, 3], texto: 'Geralmente tratada como anual; dá para renovar por estacas.' }],
  'salvia-vermelha': [{ tipo: 'murchas', meses: 'floracao', texto: 'Corte as espigas florais secas.' },
               { tipo: 'podar', meses: [8, 9], texto: 'Poda leve no fim do inverno, depois das geadas.' }],
  vinca:      [{ tipo: 'podar', meses: [8, 9], texto: 'Poda leve no fim do inverno para ramificar.' },
               { tipo: 'replantar', meses: [9, 10], texto: 'Perene de vida curta: renove a cada 2–3 anos.' }],
  dalia:      [{ tipo: 'murchas', meses: 'floracao', texto: 'Tire as flores murchas.' },
               { tipo: 'arrancar', meses: [5, 6], texto: 'Quando a parte de cima secar (ou depois da 1ª geada), corte os talos, arranque os tubérculos e guarde em lugar seco.' },
               { tipo: 'replantar', meses: [9, 10], texto: 'Replante os tubérculos depois das geadas.' }],
  gladiolo:   [{ tipo: 'arrancar', meses: [3, 4, 5], texto: 'Umas 6 semanas depois da florada, quando as folhas amarelarem, arranque os bulbos e guarde secos.' },
               { tipo: 'replantar', meses: [8, 9, 10, 11, 12], texto: 'Replante a cada 15 dias para ter flores por mais tempo.' }],
  hibisco:    [{ tipo: 'podar', meses: [8, 9], texto: 'Poda no fim do inverno, depois das geadas.' }],
  alamanda:   [{ tipo: 'podar', meses: [8], texto: 'Poda no fim do inverno; proteja de geada.' }],
  ixora:      [{ tipo: 'podar', meses: 'floracao', texto: 'Poda leve depois de cada florada.' }],
  geranio:    [{ tipo: 'podar', meses: [8, 9], texto: 'Poda no fim do inverno.' },
               { tipo: 'replantar', meses: [3, 4, 9, 10], texto: 'Faça estacas dos ramos podados para renovar as plantas.' }],
  'flor-de-cardeal': [{ tipo: 'replantar', meses: [9, 10, 11], texto: ANUAL }],
  // ervas perenes
  alecrim:    [{ tipo: 'podar', meses: [8, 9], texto: 'Poda leve no fim do inverno e depois da florada — nunca corte até a madeira velha.' },
               { tipo: 'replantar', meses: [10, 11], texto: 'Renove a cada 4–5 anos com estacas (outubro–novembro).' }],
  lavanda:    [{ tipo: 'podar', meses: [2, 3], texto: 'Depois da florada, corte as hastes florais e cerca de 1/3 da planta, sem chegar na madeira velha.' },
               { tipo: 'replantar', meses: [10, 11], texto: 'Renove a cada 4–5 anos com estacas.' }],
  salvia:     [{ tipo: 'podar', meses: [8, 9], texto: 'Poda no fim do inverno para rebrotar cheia.' },
               { tipo: 'replantar', meses: [9, 10], texto: 'Fica lenhosa: renove a cada 3–4 anos.' }],
  tomilho:    [{ tipo: 'podar', meses: 'floracao', texto: 'Apare depois da florada.' },
               { tipo: 'replantar', meses: [9, 10], texto: 'Renove a cada 3–4 anos (divisão ou estacas).' }],
  oregano:    [{ tipo: 'podar', meses: [8], texto: 'Corte rente no fim do inverno para rebrotar.' },
               { tipo: 'replantar', meses: [3, 9], texto: 'Divida as touceiras a cada 3 anos.' }],
  hortela:    [{ tipo: 'podar', meses: [8, 9], texto: 'Corte rente no fim do inverno.' },
               { tipo: 'replantar', meses: [3, 9], texto: 'Esgota o lugar: replante ou divida a cada 2 anos.' }],
  estragao:   [{ tipo: 'podar', meses: [5], texto: 'Corte rente no outono, quando a parte de cima secar.' },
               { tipo: 'replantar', meses: [9, 10], texto: 'Divida as touceiras a cada 3 anos.' }],
  louro:      [{ tipo: 'podar', meses: [8, 9], texto: 'Poda de formação no fim do inverno (controla o tamanho e a sombra).' }],
  'erva-cidreira': [{ tipo: 'podar', meses: [8, 9], texto: 'Poda no fim do inverno.' }],
  cebolinha:  [{ tipo: 'replantar', meses: [3, 4, 9], texto: 'Divida as touceiras a cada 1–2 anos.' }],
  manjericao: [{ tipo: 'murchas', meses: [12, 1, 2, 3], texto: 'Corte as flores assim que aparecerem, para a planta produzir mais folhas.' }],
};
for (const [id, lista] of Object.entries(CUIDADOS_PLANTAS)) {
  const p = PLANTAS_BASE.find(x => x.id === id);
  if (p) p.cuidados = lista;
}
// Flores florescem (não se colhe)
const ehFlor = p => !!p && p.cat === 'flores';
// Meses de um cuidado (resolve 'floracao' para os meses de flor)
function mesesDoCuidado(p, c, floracao) {
  return c.meses === 'floracao' ? floracao : c.meses;
}

// ---------------------------------------------------------------------
//  Revisão 4 — flores, physalis e yacon (nov/2026)
//  ISLA = fichas da Isla Sementes (Porto Alegre) — época para RS/SC/PR
//  GM   = Garden Mania — manuais de cultivo de flores (época "Região Sul" quando informada)
//  TOP  = fichas Topseed (via Clube Plantei)
//  GLA  = Embrapa/PAB — zoneamento do gladíolo no RS (geada danifica a haste floral)
//  PHY  = UDESC (Lages, SC) — physalis no planalto catarinense
//  EPG  = Epagri (SC) — yacon
// ---------------------------------------------------------------------
Object.assign(FONTES, {
  ISLA: { nome: 'Isla Sementes — fichas técnicas (época para RS/SC/PR)', url: 'https://www.plantei.com.br/sementes-de-petunia-hibrida-sortida-isla-multi/' },
  GM: { nome: 'Garden Mania — manuais de cultivo de flores', url: 'https://www.gardenmania.com.br/pagina/flores-manuais-de-cultivo.html' },
  TOP: { nome: 'Topseed — fichas técnicas de flores', url: 'https://www.clubeplantei.com.br/sementes-de-calendula-pacifica-sortida-topseed-linha-tradicional-flores' },
  GLA: { nome: 'Embrapa/PAB — zoneamento do gladíolo no Rio Grande do Sul', url: 'https://seer.sct.embrapa.br/index.php/pab/article/download/20891/13085' },
  PHY: { nome: 'UDESC (Lages, SC) — cultivo de physalis no planalto catarinense', url: 'https://revistas.udesc.br/index.php/agroveterinaria/article/download/5764/4230/17493' },
  EPG: { nome: 'Epagri (SC) — Revista Agropecuária Catarinense (yacon)', url: 'https://publicacoes.epagri.sc.gov.br/rac/issue/download/185/356' },
});
const REVISAO_FLORES = {
  petunia:   { forma: 'muda', sem: meses(8, 3), tr: meses(9, 4), esp: [30, 30], col: [90, 100], fontes: ['ISLA', 'GM'],
               dica: 'No Sul (RS/SC/PR), semeie de agosto a março em bandeja e transplante com ~8 cm. Floresce ~90 dias depois. Boa para bordas e vasos.' },
  cosmos:    { forma: 'muda', sem: meses(8, 2), tr: meses(9, 3), esp: [35, 40], col: [60, 75], fontes: ['GM', 'IDR'],
               dica: 'Na Região Sul, semeie de agosto a fevereiro; floresce em ~60 dias no verão. Atrai insetos que comem pragas e costuma se ressemear sozinho.' },
  dalia:     { forma: 'muda', sem: meses(7, 1), tr: meses(9, 2), melhor: [9, 10, 11], esp: [30, 40], col: [70, 90], geada: true, fontes: ['ISLA', 'GM', 'IDR'],
               dica: 'Não resiste à geada: no Sul, semeie no inverno só em lugar protegido e leve ao canteiro depois do frio forte. Floresce ~70 dias depois (90 no inverno). Forma tubérculos, que podem ser guardados e replantados.' },
  tagetes:   { forma: 'muda', sem: meses(8, 3), tr: meses(9, 4), esp: [20, 30], fontes: ['GM', 'IDR'],
               dica: 'Semeie em sementeira e transplante com 6–8 cm; sol pleno. Ajuda a afastar nematoides e pulgões — ótima nas bordas dos canteiros.' },
  zinia:     { esp: [30, 30], col: [60, 70], fontes: ['GM', 'WEB', 'IDR'] },
  girassol:  { esp: [40, 80], col: [70, 90], fontes: ['GM', 'WEB', 'IDR'] },
  'amor-perfeito': { sem: [3, 4, 5, 6, 7], melhor: [], esp: [20, 30], col: [90, 100], fontes: ['ISLA'],
               dica: 'No Sul (RS/SC/PR), semeie de março a julho: gosta de frio e não aguenta o calor do verão. Floresce ~90 dias depois. Flores comestíveis.' },
  calendula: { sem: meses(1, 12), esp: [25, 25], fontes: ['TOP', 'ISLA'],
               dica: 'Pode ser semeada o ano todo, mas prefere clima fresco — o outono é a melhor época em Piraquara. Pétalas comestíveis; atrai inimigos naturais das pragas.' },
  'salvia-vermelha': { sem: meses(1, 12), tr: meses(9, 3), esp: [30, 30], col: [90, 120], fontes: ['ISLA', 'IDR'],
               dica: 'Salvia splendens, nativa do Brasil — nas sementes Isla ela se chama “Flor-de-Cardeal”. Pode ser semeada o ano todo, mas no Sul proteja as mudas nos meses de geada. Floresce em ~90 dias (120 no inverno); atrai beija-flores.' },
  vinca:     { sem: meses(9, 2), esp: [25, 30], col: [60, 75], fontes: ['ISLA', 'TOP'],
               dica: 'No Sul (RS/SC/PR), semeie de setembro a fevereiro: gosta de calor. Floresce em ~60 dias. Só ornamental: é tóxica (inclusive para cães e gatos).' },
  'boca-de-leao': { esp: [20, 30], fontes: ['TOP'] },
  gladiolo:  { sem: meses(8, 2), esp: [20, 40], col: [80, 100], fontes: ['GLA', 'IDR'],
               dica: 'Nas regiões frias do Sul, evite plantar entre março e meados de maio: a geada estraga a haste floral. Plante bulbos a cada 15 dias para ter flores por mais tempo.' },
  physalis:  { esp: [80, 200], fontes: ['PHY'],
               dica: 'Se adapta bem ao planalto catarinense (Lages). Plantas tutoradas dão frutos maiores; a colheita é escalonada por mais de 3 meses. Semeie em bandeja no fim do inverno e transplante depois das geadas.' },
  yacon:     { esp: [90, 140], col: [300, 360], fontes: ['EPG'],
               dica: 'Raiz doce e crocante, dos Andes. Colheita 10 a 12 meses depois do plantio (Epagri). Plante os rebentos na primavera; colha quando a parte de cima secar com o frio.' },
  'flor-de-cardeal': { dica: 'Atenção: nas sementes vendidas no Brasil, “flor-de-cardeal” costuma ser a sálvia-vermelha (Salvia splendens) — veja essa planta no catálogo. Estes dados são da trepadeira cardeal (Ipomoea), que atrai beija-flores.' },
};
for (const [id, rev] of Object.entries(REVISAO_FLORES)) {
  const p = PLANTAS_BASE.find(x => x.id === id);
  if (!p) continue;
  Object.assign(p, rev);
}

// ---------------------------------------------------------------------
//  Variedades (nov/2026)
//  • Quando o tipo muda o plantio (ciclo, espaço), vira uma entrada própria
//    — ex.: abóboras (dados ABCSEM: Tetsukabuto, Brasileira/Menina, Moranga).
//  • Quando as regras são as mesmas, a planta ganha uma galeria "variedades"
//    (nome + foto), só para ajudar a reconhecer.
// ---------------------------------------------------------------------
const aboboraBase = PLANTAS_BASE.find(p => p.id === 'abobora');
const ABOBORAS_TIPOS = [
  P('abobora-moranga', 'Abóbora moranga', 'frutos', '🎃', { ...aboboraBase, id: 'abobora-moranga', nome: 'Abóbora moranga', alias: ['moranga'],
    col: [100, 120], esp: [200, 300], fontes: ['ABC', 'E93'],
    dica: 'Cucurbita maxima: casca laranja, gomos marcados. Tolera um pouco melhor o frio que outras abóboras, mas não a geada. Ramas longas — precisa de bastante espaço.' }),
  P('abobora-cabotia', 'Abóbora cabotiá (japonesa)', 'frutos', '🎃', { ...aboboraBase, id: 'abobora-cabotia', nome: 'Abóbora cabotiá (japonesa)',
    alias: ['cabotia', 'cabotiá', 'kabocha', 'tetsukabuto', 'abobora japonesa'], col: [85, 120], esp: [150, 250], fontes: ['ABC', 'E93'],
    dica: 'Híbrido japonês (Tetsukabuto), casca verde-escura. Das abóboras, é das mais tolerantes a temperaturas baixas. Precisa de abóbora-polinizadora (moranga) por perto para dar fruto.' }),
  P('abobora-menina', 'Abóbora-menina brasileira', 'frutos', '🎃', { ...aboboraBase, id: 'abobora-menina', nome: 'Abóbora-menina brasileira',
    alias: ['abobora menina', 'abóbora brasileira', 'abobora de leite'], col: [85, 120], esp: [200, 350], fontes: ['ABC', 'E93'],
    dica: 'Cucurbita moschata, fruto alongado e rajado. Menos tolerante ao frio que as japonesas: plante só no calor. Ramas muito longas.' }),
  P('abobora-pescoco', 'Abóbora-de-pescoço (butternut)', 'frutos', '🎃', { ...aboboraBase, id: 'abobora-pescoco', nome: 'Abóbora-de-pescoço (butternut)',
    alias: ['abobora pescoco', 'abóbora-de-pescoço', 'butternut', 'abobora paulista'], col: [90, 120], esp: [150, 250], fontes: ['ABC', 'E93'],
    dica: 'Cucurbita moschata de “pescoço” comprido, polpa laranja e doce. Plante depois das geadas; colha quando a casca ficar firme e bege.' }),
];
for (const p of ABOBORAS_TIPOS) PLANTAS_BASE.push(p);
Object.assign(aboboraBase, { nome: 'Abóbora (outros tipos)', alias: ['abobora'],
  dica: 'Entrada genérica. Para planejar, prefira o tipo: moranga, cabotiá (japonesa), menina brasileira ou de pescoço — cada um tem ciclo e espaço diferentes.' });
for (const [id, o] of [['abobora-moranga', 'Andes (Argentina/Uruguai)'], ['abobora-cabotia', 'Japão (híbrido de espécies americanas)'],
  ['abobora-menina', 'América Central e do Sul'], ['abobora-pescoco', 'América Central e do Sul']]) {
  const p = PLANTAS_BASE.find(x => x.id === id);
  p.origem = o; p.nativa = false;
}
PLANTAS_BASE.find(p => p.id === 'abobora').origem = 'Américas';

// Galerias de variedades (mesmas regras de plantio). "foto" é preenchida pelo arquivo de fotos.
const VARIEDADES = {
  cenoura: ['Laranja', 'Roxa', 'Amarela', 'Branca'],
  'batata-doce': ['Roxa', 'Branca', 'Laranja (Beauregard)'],
  alface: ['Crespa', 'Americana', 'Lisa (manteiga)', 'Romana', 'Roxa'],
  beterraba: ['Vermelha', 'Chioggia (listrada)', 'Dourada'],
  couve: ['Manteiga', 'Kale crespa', 'Toscana (lacinato)'],
  pimentas: ['Malagueta', 'Cumari', 'Habanero', 'De bode'],
  pimentao: ['Verde', 'Vermelho', 'Amarelo'],
  berinjela: ['Roxa comprida', 'Japonesa', 'Branca'],
  manjericao: ['Genovês', 'Roxo', 'Limão', 'Tailandês'],
  hortela: ['Hortelã-pimenta', 'Hortelã-comum'],
  rabanete: ['Vermelho', 'Branco (comprido)'],
  cebola: ['Amarela', 'Roxa', 'Branca'],
  alho: ['Branco', 'Roxo'],
  batata: ['Inglesa', 'Vermelha', 'Roxa'],
  melancia: ['Vermelha', 'Amarela'],
  'feijao-vagem': ['Verde (macarrão)', 'Amarela (manteiga)', 'Roxa'],
  pepino: ['Comum', 'Japonês', 'Conserva'],
  abobrinha: ['Italiana', 'Amarela', 'Redonda'],
  tagetes: ['Francês (anão)', 'Africano (grande)'],
  girassol: ['Gigante', 'Ornamental vermelho'],
  milho: [],
  abobora: ['Moranga', 'Cabotiá', 'Menina brasileira', 'Pescoço'],
};
for (const [id, nomes] of Object.entries(VARIEDADES)) {
  const p = PLANTAS_BASE.find(x => x.id === id);
  if (p && nomes.length) p.variedades = nomes.map(nome => ({ nome }));
}
// Abóboras: cada tipo tem entrada própria — a galeria leva até ela
const VARIEDADES_COM_ENTRADA = { abobora: [['Moranga', 'abobora-moranga'], ['Cabotiá', 'abobora-cabotia'], ['Menina brasileira', 'abobora-menina'], ['Pescoço (butternut)', 'abobora-pescoco']] };
for (const [id, lista] of Object.entries(VARIEDADES_COM_ENTRADA)) {
  PLANTAS_BASE.find(x => x.id === id).variedades = lista.map(([nome, entrada]) => ({ nome, id: entrada }));
}

// ---------------------------------------------------------------------
//  Tempo na bandeja (nov/2026): dias da semeadura até a muda ir ao canteiro
//  MUD = Embrapa — Produção de mudas: alface/pepino 18–25 dias, repolho e
//  tomate ~30, pimentão e cebola 35–40. Os demais são estimativas de
//  jardinagem (sem fonte = "estimativa" na ficha). No frio, conte 1–2
//  semanas a mais.
// ---------------------------------------------------------------------
FONTES.MUD = { nome: 'Embrapa — Produção de mudas (tempo de bandeja por hortaliça)', url: 'https://www.alice.cnptia.embrapa.br/alice/bitstream/doc/1029692/1/Producao-de-mudas.pdf' };
const DIAS_BANDEJA = {
  // [mín, máx] dias, fonte (null = estimativa)
  couve: [[25, 35], 'MUD'], repolho: [[25, 35], 'MUD'], brocolis: [[25, 35], 'MUD'], 'couve-flor': [[25, 35], 'MUD'],
  'couve-de-bruxelas': [[25, 35], 'MUD'],
  tomate: [[25, 35], 'MUD'], 'tomate-cereja': [[25, 35], 'MUD'], 'tomate-italiano': [[25, 35], 'MUD'], 'tomate-caqui': [[25, 35], 'MUD'],
  pimentao: [[35, 45], 'MUD'], pimentas: [[35, 45], 'MUD'], 'dedo-de-moca': [[35, 45], 'MUD'], biquinho: [[35, 45], 'MUD'],
  cebola: [[35, 45], 'MUD'],
  berinjela: [[35, 45], null], jilo: [[35, 45], null], physalis: [[45, 60], null],
  'alho-poro': [[60, 75], null], salsao: [[50, 60], null], azedinha: [[30, 40], null],
  cosmos: [[20, 30], null], tagetes: [[20, 30], null], petunia: [[35, 45], null], dalia: [[30, 40], null],
  'amor-perfeito': [[40, 50], null], 'boca-de-leao': [[40, 50], null], 'salvia-vermelha': [[40, 50], null],
};
for (const [id, [dias, fonte]] of Object.entries(DIAS_BANDEJA)) {
  const p = PLANTAS_BASE.find(x => x.id === id);
  if (p) { p.diasBandeja = dias; p.fonteBandeja = fonte; }
}

// ---------------------------------------------------------------------
//  Grãos, feijões, aspargo e tipos de pepino (nov/2026)
//  ABC  = manual ABCSEM (pepino: grupos caipira, aodai, japonês e conserva;
//         vagem trepadora; ervilha-grão; aspargo; melão)
//  ZAR  = MAPA — Zoneamento Agrícola de Risco Climático (ZARC), Paraná: o
//         feijão tem três safras no estado (águas, seca, outono-inverno)
//  TRI  = Embrapa/IDR-Paraná — catálogo de trigo e triticale (semeadura
//         escalonada para reduzir perdas por geada)
//  CEV  = Embrapa — zoneamento da cevada no Paraná (meados de maio a meados de julho)
//  ARZ  = Acta Scientiarum (UEM, PR) — arroz de sequeiro: outubro e novembro
//  FAG  = FAG Cascavel (PR) — trigo-sarraceno IPR 91 Baili (IDR), ciclo ~70 dias
//  GRB  = Embrapa — grão-de-bico e lentilha no inverno seco do Sul (com irrigação)
//  Sem fonte = estimativa (aparece na ficha).
// ---------------------------------------------------------------------
Object.assign(FONTES, {
  ZAR: { nome: 'MAPA — Zoneamento Agrícola de Risco Climático (ZARC), Paraná', url: 'https://www.gov.br/agricultura/pt-br/assuntos/riscos-seguro/programa-nacional-de-zoneamento-agricola-de-risco-climatico/portarias/safra-vigente/parana' },
  TRI: { nome: 'Embrapa/IDR-Paraná — Catálogo de trigo 2026', url: 'https://www.infoteca.cnptia.embrapa.br/infoteca/bitstream/doc/1187691/1/Catalogo-1-Trigo-2026-OL.pdf' },
  CEV: { nome: 'Embrapa — Zoneamento da cevada cervejeira no Paraná', url: 'https://www.alice.cnptia.embrapa.br/alice/bitstream/doc/825246/1/ID13450reuniaocevadadoc5p4650.pdf' },
  ARZ: { nome: 'Acta Scientiarum (UEM) — época de semeadura do arroz de sequeiro no Paraná', url: 'https://periodicos.uem.br/ojs/index.php/ActaSciAgron/article/download/2621/2079' },
  FAG: { nome: 'FAG (Cascavel, PR) — trigo mourisco IPR 91 Baili', url: 'https://cultivandosaber.fag.edu.br/index.php/cultivando/article/download/1078/984' },
  GRB: { nome: 'Embrapa — grão-de-bico e lentilha no inverno do Sul', url: 'https://www.canalrural.com.br/agricultura/embrapa-lentilha-inverno/' },
});
const LEG = { familia: 'Leguminosas', amigas: ['milho-verde', 'cenoura', 'pepino', 'couve', 'batata', 'abobora'], inimigas: ['alho', 'cebola', 'cebolinha'] };
const GRA = { familia: 'Gramíneas', amigas: ['feijao', 'ervilha-grao', 'girassol'], inimigas: [] };
const vagemBase = PLANTAS_BASE.find(p => p.id === 'feijao-vagem');
const pepinoBase = PLANTAS_BASE.find(p => p.id === 'pepino');
const CORES_VAGEM = [{ nome: 'Verde (macarrão)' }, { nome: 'Amarela (manteiga)' }, { nome: 'Roxa' }];
const GRAOS_E_FEIJOES = [
  // --- vagens ---
  P('feijao-vagem-trepador', 'Feijão-vagem trepador', 'outras', '🫛', { ...vagemBase, id: 'feijao-vagem-trepador', nome: 'Feijão-vagem trepador',
    alias: ['vagem trepadeira', 'vagem de vara', 'vagem macarrao'], esp: [35, 110], col: [60, 75], tutor: true, fontes: ['ABC', 'E93'],
    variedades: CORES_VAGEM, dica: 'Crescimento indeterminado: sobe 2 m ou mais e colhe por mais tempo. Precisa de tutor ou treliça. Não tolera geada: plante de setembro a janeiro.' }),
  P('feijao-vagem-rasteiro', 'Feijão-vagem rasteiro (de moita)', 'outras', '🫛', { ...vagemBase, id: 'feijao-vagem-rasteiro', nome: 'Feijão-vagem rasteiro (de moita)',
    alias: ['vagem rasteira', 'vagem de moita', 'vagem ana'], esp: [10, 50], col: [50, 60], tutor: false, fontes: ['E93'],
    variedades: CORES_VAGEM, dica: 'Planta baixa (~50 cm), sem tutor. Produz quase tudo de uma vez em 2–3 semanas — semeie um pouco a cada 3 semanas para ter vagem sempre.' }),
  // --- feijões e leguminosas de grão ---
  P('feijao', 'Feijão (grão)', 'outras', '🫘', { ...LEG, alias: ['feijao carioca', 'feijao preto', 'feijao comum'], sol: 6, esp: [10, 50], forma: 'direto',
    sem: [9, 10, 11, 12, 1], melhor: [9, 10, 11], col: [85, 100], geada: true, fontes: ['ZAR', 'IDR'],
    variedades: [{ nome: 'Carioca' }, { nome: 'Preto' }, { nome: 'Vermelho' }],
    dica: 'O Paraná tem três safras de feijão, mas em Piraquara (inverno frio) a melhor é a “das águas”: semeie de setembro a novembro e colha antes do frio. Semeaduras em dezembro–janeiro só com variedades precoces, para colher antes das geadas de maio. Colha quando as vagens secarem.' }),
  P('feijao-de-corda', 'Feijão-de-corda (caupi)', 'outras', '🫘', { ...LEG, alias: ['caupi', 'feijao fradinho', 'feijão-fradinho', 'feijao macassar'], esp: [20, 60],
    sem: [11, 12], col: [65, 90], geada: true, fontes: [],
    dica: 'Feijão do Nordeste, adora calor e tolera seca. Em Piraquara só no auge do verão (novembro–dezembro); vagens verdes também se comem.' }),
  P('fava', 'Fava (Vicia faba)', 'outras', '🫘', { ...LEG, alias: ['fava italiana', 'feijao fava'], sol: 6, esp: [20, 60], sem: [4, 5, 6], col: [120, 150], geada: false, fontes: [],
    dica: 'Leguminosa de clima frio: semeie no outono e colha na primavera. Aguenta geadas leves. Também é ótima adubação verde.' }),
  P('grao-de-bico', 'Grão-de-bico', 'outras', '🫘', { ...LEG, alias: ['grao de bico', 'grão de bico'], esp: [10, 40], sem: [4, 5, 6], melhor: [5], col: [100, 130], geada: false, fontes: ['GRB'],
    dica: 'Cultura de inverno seco: no Sul, semeie no outono e regue só se faltar chuva. Resiste a geadas, mas chuva na colheita estraga os grãos.' }),
  P('lentilha', 'Lentilha', 'outras', '🫘', { ...LEG, esp: [5, 30], sem: [4, 5, 6], col: [100, 130], geada: false, fontes: ['GRB'],
    dica: 'Como o grão-de-bico, vai no inverno seco do Sul. Planta pequena e delicada — mantenha o canteiro sem mato.' }),
  P('ervilha-grao', 'Ervilha (grão)', 'outras', '🫛', { ...LEG, alias: ['ervilha seca', 'ervilha de grao'], sol: 4, esp: [5, 40], sem: [4, 5, 6, 7], col: [85, 110], geada: false, fontes: ['ABC', 'E93'],
    dica: 'Exige clima ameno a frio: no Sul, outono e inverno. Colha verde (ervilha fresca) ou deixe secar. Variedades altas gostam de um apoio baixo.' }),
  P('edamame', 'Edamame (soja verde)', 'outras', '🫛', { ...LEG, alias: ['soja', 'soja verde'], esp: [10, 45], sem: [10, 11, 12], col: [80, 100], geada: true, fontes: [],
    dica: 'Soja colhida ainda verde, para comer cozida na vagem. Plante na primavera-verão; colha quando os grãos encherem a vagem e ela ainda estiver verde.' }),
  P('amendoim', 'Amendoim', 'outras', '🥜', { ...LEG, esp: [10, 60], sem: [9, 10, 11], col: [100, 130], geada: true, fontes: [],
    dica: 'Precisa de calor e de solo solto e arenoso: as vagens se formam embaixo da terra. Em Piraquara, plante de setembro a novembro.' }),
  // --- grãos ---
  P('arroz', 'Arroz (de sequeiro)', 'outras', '🌾', { ...GRA, alias: ['arroz sequeiro'], esp: [10, 30], sem: [10, 11], col: [110, 140], geada: true, fontes: ['ARZ'],
    dica: 'No Paraná, outubro e novembro são os melhores meses (menos risco de seca na floração). Em Piraquara o verão é curto para o arroz — vale como experiência num canteiro pequeno e bem regado.' }),
  P('trigo', 'Trigo', 'outras', '🌾', { ...GRA, esp: [3, 17], sem: [5, 6, 7], melhor: [6], col: [120, 150], geada: false, fontes: ['TRI', 'ZAR'],
    dica: 'Cultura de inverno no Paraná. Semeie em etapas dentro da época para diminuir o risco de geada na floração. Colha quando as espigas secarem (dourado).' }),
  P('aveia', 'Aveia', 'outras', '🌾', { ...GRA, alias: ['aveia branca', 'aveia preta'], esp: [3, 17], sem: [4, 5, 6], col: [120, 150], geada: false, fontes: ['ZAR'],
    dica: 'Aguenta bem o frio. Além do grão, a aveia-preta é a adubação verde mais usada no Sul: semeie no outono e corte na floração para cobrir o solo.' }),
  P('cevada', 'Cevada', 'outras', '🌾', { ...GRA, esp: [3, 17], sem: [5, 6, 7], col: [120, 140], geada: false, fontes: ['CEV'],
    dica: 'No Paraná, semeie de meados de maio a meados de julho. Gosta de frio e de tempo seco na colheita.' }),
  P('centeio', 'Centeio', 'outras', '🌾', { ...GRA, esp: [3, 17], sem: [4, 5, 6], col: [120, 150], geada: false, fontes: [],
    dica: 'O cereal mais resistente ao frio. Também serve como cobertura de inverno para proteger e melhorar o solo.' }),
  P('milho-pipoca', 'Milho-pipoca', 'outras', '🌽', { ...PLANTAS_BASE.find(p => p.id === 'milho-verde'), id: 'milho-pipoca', nome: 'Milho-pipoca',
    alias: ['pipoca'], col: [110, 130], fontes: ['ABC', 'IDR'],
    dica: 'Plante em bloco, como o milho-verde, mas longe dele (ou em outra época): se cruzarem, a pipoca não estoura bem. Colha com a palha seca.' }),
  P('trigo-sarraceno', 'Trigo-sarraceno (mourisco)', 'outras', '🌾', { familia: 'Outras', alias: ['trigo mourisco', 'mourisco', 'sarraceno'], esp: [5, 30],
    sem: [2, 9, 10, 11], melhor: [2], col: [70, 90], geada: true, fontes: ['FAG', 'IDR'], amigas: ['abobora', 'pepino'],
    dica: 'Ciclo curto (~70 dias, variedade IPR 91 Baili do IDR-Paraná). No Paraná a semeadura de fevereiro rendeu mais; em Piraquara colha antes das geadas de maio. Não é trigo — não tem glúten. As flores atraem abelhas.' }),
  P('quinoa', 'Quinoa', 'outras', '🌾', { familia: 'Amarantáceas', esp: [20, 50], sem: [8, 9], col: [100, 150], geada: false, fontes: [],
    dica: 'Vem dos Andes: aguenta geadas leves e não gosta de calor forte na floração. Em Piraquara, semeie no fim do inverno. Lave bem os grãos antes de cozinhar (amargor).' }),
  P('amaranto', 'Amaranto', 'outras', '🌾', { familia: 'Amarantáceas', alias: ['amaranto graos'], esp: [20, 60], sem: [9, 10, 11, 12], col: [90, 120], geada: true, fontes: [],
    dica: 'Gosta de calor: semeie na primavera-verão. As folhas novas também são comestíveis (como espinafre).' }),
  // --- aspargo ---
  P('aspargo', 'Aspargo', 'folhas', '🌱', { familia: 'Outras', alias: ['aspargos', 'espargo'], sol: 6, esp: [40, 150], forma: 'muda', sem: [8, 9, 10], tr: [8, 9, 10],
    col: [330, 360], perene: true, geada: false, fontes: ['ABC'],
    dica: 'Perene: dura 10 anos ou mais no mesmo lugar. Plante as “garras” (raízes) no fim do inverno, em sulcos. Só comece a colher no 2º–3º ano, na primavera, e por poucas semanas; depois deixe os ramos crescerem para fortalecer a planta.' }),
  // --- pepinos por grupo (ABCSEM) ---
  P('pepino-aodai', 'Pepino comum (aodai)', 'frutos', '🥒', { ...pepinoBase, id: 'pepino-aodai', nome: 'Pepino comum (aodai)', alias: ['pepino aodai', 'pepino comum'],
    esp: [40, 100], tutor: true, variedades: undefined, dica: 'O pepino de salada mais comum no mercado, verde-escuro e liso. Conduza no tutor para aumentar a produção e evitar a “barriga branca”.' }),
  P('pepino-japones', 'Pepino japonês', 'frutos', '🥒', { ...pepinoBase, id: 'pepino-japones', nome: 'Pepino japonês', alias: ['pepino japones'],
    esp: [40, 100], tutor: true, variedades: undefined, dica: 'Fino, comprido e com casca rugosa. Precisa de tutor; colha antes de engrossar.' }),
  P('pepino-caipira', 'Pepino caipira', 'frutos', '🥒', { ...pepinoBase, id: 'pepino-caipira', nome: 'Pepino caipira', alias: ['pepino caipira'],
    esp: [50, 120], tutor: false, variedades: undefined, dica: 'Verde-claro e rajado, mais rústico. Pode ficar rasteiro (precisa de mais espaço) ou ir no tutor.' }),
  P('pepino-conserva', 'Pepino para conserva', 'frutos', '🥒', { ...pepinoBase, id: 'pepino-conserva', nome: 'Pepino para conserva', alias: ['pepino de conserva', 'picles', 'gherkin'],
    esp: [35, 100], col: [45, 60], tutor: true, variedades: undefined, dica: 'Frutos pequenos para picles — colha com 5 a 10 cm, a cada 2 dias. Rende melhor no tutor.' }),
];
for (const p of GRAOS_E_FEIJOES) { delete p.variedades_; if (!p.variedades) delete p.variedades; PLANTAS_BASE.push(p); }
const ORIGENS_NOVAS = {
  'feijao-vagem-trepador': 'Américas (México e Andes)', 'feijao-vagem-rasteiro': 'Américas (México e Andes)', feijao: 'Américas (México e Andes)',
  'feijao-de-corda': 'África', fava: 'Oriente Médio', 'grao-de-bico': 'Oriente Médio (Turquia)', lentilha: 'Oriente Médio', 'ervilha-grao': 'Mediterrâneo e Oriente Médio',
  edamame: 'Ásia (China)', amendoim: 'América do Sul (Bolívia, Paraguai e Brasil)', arroz: 'Ásia', trigo: 'Oriente Médio', aveia: 'Europa e Oriente Médio',
  cevada: 'Oriente Médio', centeio: 'Ásia Central e Turquia', 'milho-pipoca': 'México', 'trigo-sarraceno': 'Ásia (China)', quinoa: 'Andes', amaranto: 'Américas',
  aspargo: 'Mediterrâneo', 'pepino-aodai': 'Índia', 'pepino-japones': 'Índia', 'pepino-caipira': 'Índia', 'pepino-conserva': 'Índia',
};
for (const [id, o] of Object.entries(ORIGENS_NOVAS)) { const p = PLANTAS_BASE.find(x => x.id === id); p.origem = o; p.nativa = id === 'amendoim'; }

// Entradas genéricas viram "(outros tipos)" e a galeria leva às entradas próprias
Object.assign(vagemBase, { nome: 'Feijão-vagem (outros tipos)', alias: ['vagem', 'feijao vagem'],
  dica: 'Entrada genérica. Para planejar, prefira o tipo: trepador (precisa de tutor, colhe por mais tempo) ou rasteiro/de moita (sem tutor, colhe tudo de uma vez).',
  variedades: [{ nome: 'Trepador', id: 'feijao-vagem-trepador' }, { nome: 'Rasteiro (de moita)', id: 'feijao-vagem-rasteiro' }] });
Object.assign(pepinoBase, { nome: 'Pepino (outros tipos)',
  dica: 'Entrada genérica. Para planejar, prefira o tipo: comum (aodai), japonês, caipira ou para conserva — mudam o tutor, o espaço e a colheita.',
  variedades: [{ nome: 'Comum (aodai)', id: 'pepino-aodai' }, { nome: 'Japonês', id: 'pepino-japones' }, { nome: 'Caipira', id: 'pepino-caipira' }, { nome: 'Conserva', id: 'pepino-conserva' }] });
Object.assign(PLANTAS_BASE.find(p => p.id === 'tomate'), { nome: 'Tomate (outros tipos)',
  variedades: [{ nome: 'Cereja', id: 'tomate-cereja' }, { nome: 'Italiano', id: 'tomate-italiano' }, { nome: 'Caqui', id: 'tomate-caqui' }] });
Object.assign(PLANTAS_BASE.find(p => p.id === 'pimentas'), { nome: 'Pimentas (outros tipos)',
  variedades: [{ nome: 'Dedo-de-moça', id: 'dedo-de-moca' }, { nome: 'Biquinho', id: 'biquinho' },
    { nome: 'Malagueta' }, { nome: 'Cumari' }, { nome: 'Habanero' }, { nome: 'De bode' }] });
// Melão: mesmas regras, só galeria
PLANTAS_BASE.find(p => p.id === 'melao').variedades = ['Amarelo', 'Cantaloupe (rendilhado)', 'Gália', 'Pele-de-sapo', 'Orange (honeydew)'].map(nome => ({ nome }));
// Grãos e feijões secos: grupo próprio nas sugestões
const GRAOS = ['feijao', 'feijao-de-corda', 'fava', 'grao-de-bico', 'lentilha', 'ervilha-grao', 'edamame', 'amendoim',
  'arroz', 'trigo', 'aveia', 'cevada', 'centeio', 'milho-pipoca', 'trigo-sarraceno', 'quinoa', 'amaranto'];

const LISTA_INICIAL = [
  'alface', 'rucula', 'couve', 'acelga', 'almeirao', 'chicoria', 'espinafre-nz', 'mostarda',
  'manjericao', 'cebolinha', 'salsinha', 'coentro', 'oregano', 'alecrim', 'salvia',
  'tomate', 'pimentao', 'pimentas', 'berinjela', 'abobrinha', 'abobora', 'pepino', 'melancia',
  'cenoura', 'beterraba', 'rabanete', 'batata-doce', 'batata-salsa', 'gengibre', 'curcuma',
  'ervilha-torta', 'milho-verde', 'girassol',
];

// ---------------------------------------------------------------------
//  Consultas
// ---------------------------------------------------------------------

// Junta as plantas do banco com as edições e plantas novas do usuário
// (o parâmetro "e" permite usar estas funções antes de "estado" existir, na migração)
// Plantas editadas pelo usuário herdam do catálogo os campos que não têm
// (ex.: origem, melhores meses e fontes, que entraram depois da edição)
const comBase = (ed, base) => (ed && base ? { ...base, ...ed } : ed || base);
function todasPlantas(e = estado) {
  const ed = e.plantasEditadas || {};
  const lista = PLANTAS_BASE.map(p => comBase(ed[p.id], p));
  for (const p of Object.values(ed)) if (p.custom) lista.push(p);
  return lista;
}
function plantaPorId(id, e = estado) {
  const ed = e.plantasEditadas || {};
  return comBase(ed[id], PLANTAS_BASE.find(p => p.id === id)) || null;
}
// Nas áreas do mapa, cada planta é o id do catálogo (ou um texto livre, se não estiver no catálogo).
// Plantios em sucessão da mesma planta levam um sufixo: "alface", "alface#2", "alface#3"…
const baseEntrada = t => String(t).split('#')[0];
const idDaEntrada = t => plantaPorId(baseEntrada(t)) ? baseEntrada(t) : encontrarPlanta(baseEntrada(t));
const nomePlanta = t => plantaPorId(idDaEntrada(t) || '')?.nome || baseEntrada(t);
// Qual plantio desta planta é (1º, 2º…) dentro da área
function numeroPlantio(z, entrada) {
  const id = idDaEntrada(entrada);
  const mesmas = (z.plantas || []).filter(t => idDaEntrada(t) === id);
  return mesmas.length > 1 ? mesmas.indexOf(entrada) + 1 : 0;
}
const rotuloEntrada = (z, t) => nomePlanta(t) + (numeroPlantio(z, t) ? ` (${numeroPlantio(z, t)}º)` : '');
function idsDaZona(z) {
  return [...new Set((z.plantas || []).map(idDaEntrada).filter(Boolean))];
}
const ehBase = id => PLANTAS_BASE.some(p => p.id === id);

function saoInimigas(a, b) {
  const pa = plantaPorId(a), pb = plantaPorId(b);
  return !!(pa && pb && (pa.inimigas.includes(b) || pb.inimigas.includes(a)));
}
function saoAmigas(a, b) {
  const pa = plantaPorId(a), pb = plantaPorId(b);
  return !!(pa && pb && !saoInimigas(a, b) && (pa.amigas.includes(b) || pb.amigas.includes(a)));
}
// Relações nos dois sentidos (se A diz que combina com B, B também combina com A)
function relacoes(id) {
  const amigas = new Set(), inimigas = new Set();
  for (const q of todasPlantas()) {
    if (q.id === id) continue;
    if (saoInimigas(id, q.id)) inimigas.add(q.id);
    else if (saoAmigas(id, q.id)) amigas.add(q.id);
  }
  return { amigas: [...amigas], inimigas: [...inimigas] };
}

function mesesColheita(p) {
  const set = new Set();
  const a = Math.max(0, Math.round(p.col[0] / 30)), b = Math.max(a, Math.round(p.col[1] / 30));
  if (b - a >= 11) return meses(1, 12);
  for (const m of p.sem) for (let k = a; k <= b; k++) set.add((m - 1 + k) % 12 + 1);
  return [...set].sort((x, y) => x - y);
}

function normalizar(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/\(.*?\)/g, '').replace(/[-_.,*]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Descobre qual planta do banco corresponde a um texto livre ("Pimenta capsicum", "Tagete"…)
function encontrarPlanta(texto, e = estado) {
  const n = normalizar(texto);
  if (!n) return null;
  const indice = new Map();
  for (const p of todasPlantas(e)) {
    for (const nome of [p.nome, p.id, ...(p.alias || [])]) {
      const k = normalizar(nome);
      if (!indice.has(k)) indice.set(k, p.id);
      if (k.endsWith('s') && !indice.has(k.slice(0, -1))) indice.set(k.slice(0, -1), p.id);
    }
  }
  if (indice.has(n)) return indice.get(n);
  if (n.endsWith('s') && indice.has(n.slice(0, -1))) return indice.get(n.slice(0, -1));
  // Começo do nome ("espinafre nova zel" → espinafre da nova zelândia)
  if (n.length >= 5) {
    for (const [k, id] of indice) if (k.startsWith(n) || (n.startsWith(k) && k.length >= 5)) return id;
  }
  return null;
}

// Para cada área do mapa: as plantas reconhecidas e os nomes não reconhecidos
function plantasNaHorta() {
  const res = [];
  for (const z of estado.zonas) {
    if (!(z.plantas || []).length) continue;
    const ids = [], desconhecidas = [];
    for (const t of z.plantas) {
      const id = idDaEntrada(t);
      if (id) { if (!ids.includes(id)) ids.push(id); } else desconhecidas.push(t);
    }
    res.push({ zona: z, ids, desconhecidas });
  }
  return res;
}
