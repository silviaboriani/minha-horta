# Plano — Minha Horta

O que falta fazer, em ordem. Cada etapa vira uma versão publicada (com testes, revisão cega e o seu ok antes de publicar).
Marcar [x] o que for feito.

## Etapa 0 — Fechar o que está aberto (agora)
- [x] Publicar a **v12**: clique perdido depois de digitar quantidade (mouse, toque e teclado) + fundo desfocado nas boas-vindas. Pronta e testada.
- [x] Juntar as mudanças de duas pessoas (`js/mesclar.js`, 14 testes). Ainda desligado: entra no app na etapa 4.

## Etapa 1 — Arrumações rápidas (uma versão)
Pequenas, sem risco, mudam a cara do app logo.
- [x] Menu de cima sem números ("Horta", "Sol e sombra", "Plantas", "Diário"): com cara de menu, não de passos.
- [x] Tirar do menu da esquerda as informações sobre instalar no iPad.

## Etapa 2 — Painel do canteiro (painel da direita)
Tudo no mesmo lugar, então vale fazer junto.
- [x] Informações do canteiro (sol, quanto está ocupado) **fixas no topo** ao rolar.
- [x] Edição da área (nome, tipo, cor, grupo) com botão **Salvar** que fecha a edição. ([print](a-fazer/area-selecionada.png))
- [x] Depois de pôr uma planta, já mostrar as que combinam com ela / a opção de adicionar mais, sem clique extra. ([print](a-fazer/plantas-da-area.png))
- [x] A edição (nome, tipo, cor, grupo) vai para baixo, fechada (decidido: é ela que se usa pouco).
- [x] Plantas sugeridas que **não cabem** no espaço livre ficam vermelhas (decidido: só a cor, com a explicação ao passar o mouse).
- [x] Tirar o botão **"＋ Adicionar planta ▾"**: a parte de adicionar (companheiras, busca, sugestões) fica sempre à mostra.
- [x] **"Só favoritos ★"** começa desmarcado.


## Etapa 3 — Ferramentas de desenho
- [x] Ferramentas com o nome das categorias: Canteiro, Muro, Composteira, etc.
- [x] Três jeitos de desenhar: **retângulo**, **círculo** e **linha**.
- [x] Linha como no Illustrator: a área vai se fechando e já sai preenchida com a categoria escolhida (decidido: muro/cerca fica como linha aberta, de um quadrado de largura).
- [x] **Juntar tudo num desenho só:** enquanto desenha os canteiros, poder também pôr as árvores (e construções) e escolher a direção do sol/norte. (decidido: saíram da aba Sol e sombra, que ficou com local, sol por área e sombra pintada).
- [x] Deixar claro que dá para desenhar **fora do terreno** definido (ex.: árvores do vizinho que fazem sombra).
- [x] Explicar nas boas-vindas que as primeiras medidas são do **terreno todo**, não de um canteiro.


## Etapa 4 — Horta compartilhada (várias pessoas, ao vivo, com login)
Projeto Firebase `minha-horta-89936` (plano gratuito, banco em São Paulo). Regras em `firestore.rules` (publicadas).
- [x] Criar o projeto no Firebase, login com Google, banco e regras.
- [x] "Entrar com Google" e guardar a horta na nuvem.
- [x] Convidar pessoas por link (vale 7 dias; e tirar; sair da horta; parar de compartilhar).
- [x] Atualizações ao vivo, funcionando também sem internet.
- [x] Testado com uma 2ª conta Google de verdade (Chrome, dois perfis): convite por link, entrar, ver as duas pessoas. Publicado na v13.
- [ ] Depois, se quiser: fotos do diário na nuvem (precisa do plano pago do Firebase; por enquanto ficam no aparelho).
- Limitações conhecidas (por enquanto): quando chega mudança de outra pessoa, o "desfazer" é zerado;
  se as duas mudarem **a mesma coisa**, vale a de quem enviou por último; duas abas abertas no mesmo aparelho podem se atrapalhar.

## Etapa 5 — Tablets: iPad e Android (em breve)
- [ ] Ajustar o app para iPad e tablets Android (toque, tamanhos de tela, app instalado pelo ícone).
- [ ] **Testar no iPad de verdade**, pelo ícone da tela de início: o login do Google pode não abrir no app instalado (aí o app avisa para usar pelo Safari).
- [ ] Testar num tablet Android (Chrome e app instalado), incluindo o login com Google e a horta compartilhada.
- Obs.: no navegador embutido de outros apps, o Google pode recusar adicionar outra conta; convites funcionam melhor no Chrome ou Safari.

## Etapa 6 — Tutorial
Fica por último de propósito: explica as telas, então é melhor fazer depois que o menu, o painel e as ferramentas mudarem.
- [ ] Tutorial inicial explicando cada seção e a sequência de uso.
- [ ] Junto: boas-vindas com um passo para escolher tipos de planta e um caminho curto ("só me mostre o app").

## Etapa 7 — Pendências menores (quando sobrar tempo)
- [ ] Adubos verdes e grãos aparecem com muitas plantas no plano.
- [ ] Calendários do painel da direita começarem no mês atual, como o do plano.
- [ ] Repensar "Marcar no canteiro".
- [ ] Revisar as fotos das plantas (Silvia).

## Mais para frente
- Versão nativa para Android (Material Design) e iPad, com teste no emulador.
