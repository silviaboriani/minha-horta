// Exemplo: a horta da planilha (janeiro). Cada quadrado = 20 cm.
// Terreno de 46 × 62 quadrados = 9,2 m × 12,4 m.
function criarExemploHorta() {
  const cols = 46;
  const rows = 62;
  const celulas = new Array(cols * rows).fill(0);

  // Pinta um retângulo (colunas c0..c1, linhas r0..r1, inclusive) com a área id
  function ret(id, c0, r0, c1, r1) {
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) celulas[r * cols + c] = id;
    }
  }

  const VERDE = '#d9ead3';
  const zonas = [
    { id: 1, nome: 'Muro', tipo: 'muro', cor: '#9e9e9e', plantas: [] },
    {
      id: 2, nome: 'Flores e Temperos', tipo: 'canteiro', cor: '#b4a7d6',
      plantas: ['Tagetes', 'Capuchinha', 'Alecrim', 'Zínia', 'Cosmos', 'Vinca', 'Gengibre', 'Cúrcuma',
        'Girassol', 'Dália', 'Hibisco', 'Gladíolo', 'Alamanda', 'Flor de cardeal', 'Sálvia']
    },
    { id: 3, nome: 'Batata-doce', tipo: 'canteiro', cor: '#d5a6bd', plantas: ['Batata-doce'] },
    { id: 4, nome: 'Melancia', tipo: 'canteiro', cor: '#cfe2f3', plantas: ['Melancia'] },
    { id: 5, nome: 'Abóbora', tipo: 'canteiro', cor: '#a4c2f4', plantas: ['Abóbora'] },
    { id: 6, nome: 'Canteiro 1', tipo: 'canteiro', cor: VERDE, plantas: ['Alface', 'Rabanete', 'Rúcula', 'Almeirão', 'Batata salsa'] },
    { id: 7, nome: 'Canteiro 2', tipo: 'canteiro', cor: VERDE, plantas: ['Tomate', 'Manjericão', 'Salsinha', 'Cebolinha', 'Tagete'] },
    { id: 8, nome: 'Canteiro 3', tipo: 'canteiro', cor: VERDE, plantas: ['Cenoura', 'Beterraba', 'Rabanete', 'Pimenta capsicum'] },
    { id: 9, nome: 'Canteiro 4', tipo: 'canteiro', cor: VERDE, plantas: ['Couve', 'Acelga', 'Mostarda'] },
    { id: 10, nome: 'Canteiro 5', tipo: 'canteiro', cor: VERDE, plantas: ['Pepino', 'Milho-verde', 'Capuchinha', 'Orégano'] },
    { id: 11, nome: 'Canteiro 6', tipo: 'canteiro', cor: VERDE, plantas: ['Abobrinha', 'Ervilha-torta (precisa de treliça)', 'Zínia'] },
    { id: 12, nome: 'Canteiro 7', tipo: 'canteiro', cor: VERDE, plantas: ['Berinjela', 'Cenoura', 'Coentro'] },
    { id: 13, nome: 'Canteiro 8', tipo: 'canteiro', cor: VERDE, plantas: ['Chicória', 'Espinafre da Nova Zelândia', 'Bok choy'] },
  ];

  // Muro em volta
  ret(1, 0, 0, cols - 1, 0);
  ret(1, 0, rows - 1, cols - 1, rows - 1);
  ret(1, 0, 0, 0, rows - 1);
  ret(1, cols - 1, 0, cols - 1, rows - 1);

  // Bordadura de flores (esquerda, direita e embaixo)
  ret(2, 1, 1, 2, 56);
  ret(2, 43, 16, 44, 60);
  ret(2, 7, 59, 42, 60);

  // Áreas grandes no topo
  ret(3, 3, 1, 21, 4);    // Batata-doce
  ret(4, 3, 5, 21, 15);   // Melancia
  ret(5, 22, 1, 44, 15);  // Abóbora

  // Canteiros 3 m × 1,2–1,4 m
  const linhas = [[19, 25], [30, 35], [40, 45], [49, 54]];
  linhas.forEach(([r0, r1], i) => {
    ret(6 + i * 2, 6, r0, 20, r1);   // canteiros ímpares (esquerda)
    ret(7 + i * 2, 25, r0, 39, r1);  // canteiros pares (direita)
  });

  return {
    versao: 1,
    nome: 'Minha Horta',
    tamanhoCelulaCm: 20,
    cols,
    rows,
    celulas,
    zonas,
    proximoId: 14,
  };
}
