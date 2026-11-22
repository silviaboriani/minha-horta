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
- [ ] Ferramentas com o nome das categorias: Canteiro, Muro, Composteira, etc.
- [ ] Três jeitos de desenhar: **retângulo**, **círculo** e **linha**.
- [ ] Linha como no Illustrator: a área vai se fechando e já sai preenchida com a categoria escolhida.
- [ ] **Juntar tudo num desenho só:** enquanto desenha os canteiros, poder também pôr as árvores (e construções) e escolher a direção do sol/norte. Hoje isso fica separado, na aba Sol e sombra.
- [ ] Deixar claro que dá para desenhar **fora do terreno** definido (ex.: árvores do vizinho que fazem sombra).
- [ ] Explicar que as primeiras medidas (nas boas-vindas) são do **terreno todo**, não de um canteiro. Hoje só há uma nota pequena no passo "Tamanho".

**Decidir:** a linha que fecha a área vale para todas as categorias ou só para canteiros?

## Etapa 4 — Horta compartilhada (várias pessoas, ao vivo, com login)
Pode andar em paralelo com as etapas 1–3, assim que o Firebase estiver criado.
- [ ] **Silvia:** criar o projeto no Firebase e colar o `firebaseConfig` (passo a passo na conversa de 22/11/2026).
- [ ] "Entrar com Google" e guardar a horta na nuvem.
- [ ] Convidar pessoas por e-mail.
- [ ] Atualizações ao vivo, funcionando também sem internet.
- [ ] Depois, se quiser: fotos do diário na nuvem (precisa do plano pago do Firebase; por enquanto ficam no aparelho).

## Etapa 5 — Tutorial
Fica por último de propósito: explica as telas, então é melhor fazer depois que o menu, o painel e as ferramentas mudarem.
- [ ] Tutorial inicial explicando cada seção e a sequência de uso.
- [ ] Junto: boas-vindas com um passo para escolher tipos de planta e um caminho curto ("só me mostre o app").

## Etapa 6 — Pendências menores (quando sobrar tempo)
- [ ] Adubos verdes e grãos aparecem com muitas plantas no plano.
- [ ] Calendários do painel da direita começarem no mês atual, como o do plano.
- [ ] Repensar "Marcar no canteiro".
- [ ] Revisar as fotos das plantas (Silvia).

## Mais para frente
- Versão nativa para Android (Material Design) e iPad, com teste no emulador.
