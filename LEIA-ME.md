# Minha Horta

App para planejar a horta. **Fase 1: mapa da horta** (cada quadrado = 20 cm).

## Como abrir

1. Abra o PowerShell nesta pasta (`Documentos\Horta`).
2. Rode: `node servidor.js`
3. Abra no navegador: http://localhost:8080

O mapa é salvo automaticamente no navegador. Use **Exportar arquivo** para guardar uma cópia.

Na primeira vez, o app pergunta o nome da horta, onde fica (busca pela cidade, localização do aparelho ou coordenadas), o tamanho do terreno e o que você quer plantar. Depois, o quadro **Primeiros passos** (painel da direita) guia o resto. **🌱 Novo projeto** (painel Arquivo) começa outra horta — a atual fica em **Projetos guardados**, com o botão **Abrir**.

## Atalhos

| Tecla | Ação |
|---|---|
| V | Selecionar |
| B | Pincel |
| R | Retângulo (segure Alt para apagar) |
| G | Preencher |
| E | Borracha |
| H | Mover mapa (ou segure Espaço e arraste) |
| Roda do mouse | Zoom |
| 0 | Ajustar à tela |
| Ctrl+Z / Ctrl+Y | Desfazer / refazer |

## Aba "2 · Sol e sombra"

1. **Onde fica a horta** — cidade e latitude (já vem Piraquara).
2. **Onde fica o norte** — arraste a agulha da bússola ou use os botões.
3. **Árvores e construções** — 🌳 clique para pôr uma árvore, 🏠 arraste para desenhar uma casa/galpão. Podem ficar fora do terreno. Ajuste altura e copa no painel.
4. **Sombra observada** — pinte meia-sombra ou sombra onde você já sabe que fica sombreado.

O app calcula as horas de sol direto em cada quadrado, mês a mês (☀️ sol pleno ≥ 6 h · ⛅ meia-sombra 3–6 h · ☁️ sombra < 3 h). Muros desenhados no mapa também fazem sombra — a altura deles é definida na aba Mapa.

Atalhos da aba Sol: V selecionar · A árvore · C construção · M meia-sombra · S sombra · E apagar sombra · Delete exclui o objeto selecionado.

## Aba "3 · Plantas"

Catálogo com 71 plantas (todas as da planilha e mais algumas, como alho, cebola, batata, brássicas e morango), com dados pensados para Piraquara/Curitiba:

- sol necessário (☀️ sol pleno · 🌤️ sol ou meia-sombra · ⛅ meia-sombra)
- espaçamento, forma de plantio e dias até a colheita
- meses de semear, transplantar e colher (calendário)
- ❄️ sensível a geada · 🪜 precisa de tutor · ♾️ perene
- com quem combina e de quem manter longe
- em quais canteiros do seu mapa ela já está — e se há vizinhas ruins

★ marca as suas plantas **favoritas** (já vem com as marcadas na planilha). **Editar dados** muda qualquer informação só para a sua horta; **Restaurar original** desfaz. **+ Nova planta** cria uma planta que não está no catálogo.

**Fontes (revisão de nov/2026):** épocas de plantio da Embrapa Hortaliças (*O cultivo de hortaliças*, 1993 — janela para regiões de inverno frio/verão ameno), espaçamento e ciclo do *Manual técnico para cultivo de hortaliças* da ABCSEM (4ª ed., 2020) e período de geadas do IDR-Paraná (Alerta Geada, maio a setembro; geadas concentradas em jun–ago). Ervas, gengibre e capuchinha: épocas da Embrapa Clima Temperado (Pelotas, RS — coleção de plantas medicinais, aromáticas e condimentares, e Circular 61), espaçamento e ciclo da Embrapa Agroindústria Tropical (só esses dados, pois é de clima tropical). **Melhores meses × possíveis:** muitas plantas podem ir para o canteiro o ano todo (ou numa janela longa), mas têm meses melhores — ex.: rúcula o ano todo, melhor de março a agosto; capuchinha quase o ano todo, melhor em março e setembro–novembro. No calendário da planta, verde-escuro = melhores meses, verde-claro = possível. As sugestões e o “Sugerir plano” preferem os melhores meses e avisam quando um mês é só possível. Dá para editar em “Editar dados → Melhores meses”. **60 plantas têm fonte**; 11 (flores ornamentais/companheiras, como tagetes, cosmos e dália) aparecem como **estimativa** no detalhe da planta. Ervas e flores não têm quantidade mínima: qualquer número de pés vale.

## Lista de áreas

- Em ordem alfabética (Canteiro 2 vem antes de Canteiro 10).
- **+ Categoria** cria um grupo (ex.: Canteiros, Estrutura). Para pôr uma área num grupo, arraste-a até o nome do grupo ou escolha a Categoria no painel da direita. Clique no nome do grupo para abrir/fechar; ✏️ renomeia e 🗑 apaga o grupo (as áreas continuam).
- Para **deletar uma área**: selecione e aperte **Del**, ou use 🗑 na lista ou o botão “Deletar esta área”. Ctrl+Z desfaz.

## Plantar em cada área (aba Mapa)

Clique num canteiro e veja **Plantas desta área** no painel à direita:

- escolha o **mês** que você está planejando (o mesmo da aba Sol)
- digite **quantos pés** de cada planta você quer; a barra mostra quanto da área está ocupado. Para as plantas sem número, o app sugere quantas cabem (💡, dividindo o espaço livre entre elas) — clique em “usar” para aceitar
- cada planta mostra os avisos: ☁️ pouco sol, ⚠️ não combina com outra da mesma área ou de uma área vizinha (até 1 m), 📏 não cabe, 📅 fora de época
- **Sugestões**: plantas que estão na época, recebem sol suficiente e combinam com o que já está ali e nos vizinhos (marque/desmarque “Só favoritos” — só aparece quando há favoritos)
- ao adicionar uma planta, aparecem as **boas companheiras** dela para pôr junto
- no mapa, as áreas vizinhas da selecionada ficam tracejadas e canteiros com problema ganham ⚠️

## Aba "1 · Horta": planejar e desenhar

A aba Horta junta o mapa e o calendário:

- **Planejar** (normal): clique num canteiro para escolher plantas, quantidades e mês de plantio; clique fora para ver as **tarefas do mês**. Os meses ficam no topo do mapa.
- **✏️ Editar desenho**: a ferramenta principal é **⬚ Canteiros** — arraste no vazio (ou em cima do caminho) para criar um canteiro; arraste um canteiro para **mover** (as plantas marcadas vão junto); puxe os **quadradinhos laranja** para mudar o tamanho (a medida aparece enquanto arrasta); **Ctrl+D** ou “⧉ Duplicar” faz uma cópia ao lado. **▦ Fileira** coloca vários canteiros iguais de uma vez (quantos, tamanho, corredor, direção). No painel da área dá para digitar **posição e tamanho exatos** em metros. **👣 Preencher caminhos** transforma todo o espaço vazio em caminho. Um canteiro não pode ficar por cima de outro (só por cima do caminho). Continuam disponíveis o pincel, o retângulo, o preencher e a borracha para formas irregulares, e o tamanho do terreno. Clique em **✓ Terminar desenho** para voltar a planejar. Criar uma área nova (“+ Nova”) entra no modo desenho automaticamente.

### Calendário

Cada planta de um canteiro tem um **mês de plantio** (📅 “plantar em” no painel do canteiro, ou na visão Ano). A partir dele e dos dias até a colheita, o app calcula o ano:

- 🌰 **semear na bandeja** (mudas: o tempo de bandeja de cada planta — ~1 mês para couves e tomate, 1,5 para pimentão e cebola, 2 para alho-poró) · 🌱 **plantar** · 🪴 **crescendo** · 🧺 **colher**
- **🗺 Mês**: o mapa no mês escolhido (meses no topo, ou ← → no teclado). Canteiros vazios ficam esmaecidos (“livre”).
- **Tarefas do mês** (painel da direita): o que semear, plantar e colher, avisos de geada e de plantio fora de época, e as áreas livres (clique para ver o que plantar).
- **Bandeja de mudas** (nas tarefas do mês):
  - 🪴 **Na bandeja agora**: toque ✓ em “Semear na bandeja” quando semear — o app registra no diário (com o nº de células), conta as semanas, avisa quando **aclimatar** (1 semana antes) e quando a muda está **pronta para transplantar**.
  - 🧰 **Preparar**: quantas células/bandejas usar (semeie ~50% a mais), o que comprar para o mês que vem, quais mudas aclimatar, proteção das bandejas no frio (maio–setembro) e quais canteiros adubar 2–3 semanas antes do plantio.
  - 🗓️ **Bandeja nos próximos meses**: o que semear no mês que vem e no seguinte.
  - 💡 **Bom para semear na bandeja**: mudas na época cuja muda fica pronta quando algum canteiro tem espaço (favoritos ★ primeiro); o **+** põe no plano daquele canteiro.
  - Tempo de bandeja: Embrapa (Produção de mudas) para couves, tomates, pimentões e cebola; as demais são estimativas (aparece na ficha da planta). No frio, conte 1–2 semanas a mais.
- **📅 Ano**: linha do tempo de todos os canteiros, com o espaço ocupado (%) em cada mês.

**🔁 Plantar de novo (sucessão):** no painel do canteiro, cada planta tem o botão “plantar de novo”. Ele adiciona outro plantio da mesma planta no primeiro mês da época dela depois da última colheita, sem sobrepor os outros plantios — ex.: Alface (1º) em novembro, (2º) em março, (3º) em julho. Dá para mudar o mês de cada plantio depois.

**✨ Sugerir plano:** no painel de um canteiro (“para este canteiro”) ou nas tarefas do mês (“para a horta toda”). O app monta a ordem de plantio dos próximos 12 meses: plantas na época, com sol suficiente naquele mês, sem as sensíveis no período de geada, sem vizinhas que não combinam e com variedade (folha + raiz + fruto), ocupando o espaço livre com quantidades. Antes de aplicar você vê tudo numa prévia e pode: manter ou substituir as plantas atuais, usar só os favoritos ★ ou o catálogo todo, escolher o mês de início, pedir **↻ outra sugestão** e desmarcar canteiros. Ctrl+Z desfaz.

O plano prefere **mais de cada planta e menos repetição**: cada plantio ocupa até metade do canteiro, com uma quantidade mínima que vale a pena (10 pés para plantas miúdas como cebola e cenoura, 3 para médias, 1 para grandes); a mesma cultura aparece no máximo 2 vezes por ano no mesmo canteiro; e uma cultura que já está em **outro canteiro na mesma época** só entra se não houver alternativa — ou nunca, marcando “Nunca repetir cultura entre canteiros”. O painel do canteiro também avisa (🔢) quando uma planta tem poucos pés e (🔁) quando a sugestão já está em outro canteiro.

Os avisos de espaço e de vizinhas ruins agora consideram o tempo: duas plantas só “disputam” o canteiro se ficarem nele nos mesmos meses (ex.: abobrinha no verão e ervilha no inverno podem dividir o mesmo canteiro).

## Mais ferramentas

- **📍 Marcar no canteiro**: no painel do canteiro, cada planta tem “📍 marcar no canteiro”. Pinte no mapa onde ela fica (Alt apaga, Esc termina). O mapa mostra a área de cada planta com o emoji no espaçamento dela; os pés que cabem passam a ser calculados pela área marcada; e os avisos de vizinhas ruins usam a **distância real** (só contam a menos de 1 m). Ótimo para a faixa “Flores e Temperos”.
- **🔄 Rotação de culturas**: cada planta tem uma família (Solanáceas, Brássicas, Cucurbitáceas…). O app avisa quando a mesma família vem logo depois no mesmo canteiro — no plano do ano ou pelo histórico do diário — e o “Sugerir plano” evita isso.
- **🛒 Lista de compras** (nas tarefas do mês): sementes, mudas, ramas e bulbos para 1, 3, 6 ou 12 meses, somando todos os canteiros. Dá para copiar ou imprimir.
- **📅 Lembretes**: baixa um arquivo `.ics` com todas as tarefas do ano (semear, plantar, colher) com alerta às 9h. Abra no iPad/celular ou importe no Google Agenda.
- **🌦️ Tempo** (opcional): previsão de 7 dias com alertas de geada (lista as plantas sensíveis para cobrir) e de rega. Ao ativar, o app consulta o open-meteo.com com a localização aproximada da horta (latitude/longitude com 2 casas).

- **🧹 Limpar plantio**: nas tarefas do mês (horta toda) ou no painel do canteiro. Tira as plantas dos canteiros sem mexer no desenho. Opções: tudo ou só o que veio do ✨ Sugerir plano, manter as perenes, incluir ou não a faixa Flores e Temperos. Ctrl+Z desfaz.

## Aba "4 · Diário"

Registre plantios 🌱, colheitas 🧺 (com kg/unidades), notas 📝, pragas 🐛 e adubações 🧪 — com foto (no iPad, dá para tirar na hora). As tarefas do mês têm um botão **✓** para registrar com um clique. O diário mostra o total colhido, alimenta a rotação de culturas e, na aba Plantas, mostra quantos dias a colheita levou **de verdade** na sua horta (com um botão para corrigir o catálogo). As fotos ficam só neste navegador (não vão no arquivo exportado).

## Próximas fases

4. ~~Sugestões do que plantar e alertas de vizinhos ruins~~ ✓
5. ~~Calendário mês a mês (semear, transplantar, colher)~~ ✓

“Sugerir plano” ✓. Depois: repensar a área “Flores e Temperos” (avisos de vizinhança mais precisos).

## Mais plantas, origem e cuidados (nov/2026)

- **102 plantas.** Novas: variedades de tomate (cereja, italiano, caqui), pimentas dedo-de-moça e biquinho, mandioca, cará, yacon, rábano (daikon), alho-poró, araruta, mangarito, salsão, erva-doce (funcho), endro, espinafre verdadeiro, couve-de-bruxelas, alcachofra, maxixe, physalis, PANCs (ora-pro-nóbis, taioba, jambu, azedinha) e flores (calêndula, amor-perfeito, borragem, camomila, lavanda, boca-de-leão, sálvia-vermelha).
- **Origem** de cada planta (região/país) e selo **“nativa do Brasil”** (12 plantas), com o filtro “Só nativas do Brasil” na aba Plantas.
- **Flores florescem, não são colhidas:** no lugar de 🧺 Colher aparece 🌸 Florir/Florindo.
- **Cuidados** para flores e ervas perenes: ✂️ podar, 🥀 tirar flores murchas, ⛏️ arrancar e guardar (dália, gladíolo), 🔁 replantar/renovar — no detalhe da planta (com os meses no calendário) e nas tarefas do mês (“✂️ Cuidados”). São orientações gerais de jardinagem.

**Flores com fonte (nov/2026):** épocas para o Sul das fichas da Isla Sementes (RS/SC/PR: petúnia ago–mar, amor-perfeito mar–jul, vinca set–fev, dália e sálvia-vermelha o ano todo protegendo das geadas), dos manuais Garden Mania (cosmos ago–fev na Região Sul; tagetes, zínia, girassol) e das fichas Topseed (calêndula, boca-de-leão); gladíolo pelo zoneamento da Embrapa no RS; physalis (UDESC, Lages) e yacon (Epagri). **96 de 102 plantas têm fonte**; continuam como estimativa: hibisco, alamanda, ixora, gerânio, borragem e a trepadeira flor-de-cardeal. Atenção: nas sementes vendidas no Brasil, “flor-de-cardeal” costuma ser a sálvia-vermelha (Salvia splendens).

## Grãos, feijões, aspargo e tipos (nov/2026)
- **Feijões e leguminosas de grão:** feijão (carioca, preto, vermelho), feijão-de-corda, fava, grão-de-bico, lentilha, ervilha (grão), edamame e amendoim.
- **Grãos:** arroz de sequeiro, trigo, aveia, cevada, centeio, milho-pipoca, trigo-sarraceno, quinoa e amaranto. Nas sugestões ficam no grupo 🌾 **Grãos e feijões**.
- **Aspargo** (perene: só colhe a partir do 2º–3º ano).
- **Tipos com ficha própria** (mudam tutor, espaço ou ciclo): feijão-vagem **trepador** e **rasteiro**; pepino **comum (aodai)**, **japonês**, **caipira** e **para conserva**. As entradas antigas viraram “(outros tipos)” — Feijão-vagem, Pepino, Tomate, Pimentas, Abóbora — e a galeria delas leva às fichas de cada tipo. Plantas já colocadas nos canteiros continuam funcionando.
- **Melão:** galeria de tipos (amarelo, cantaloupe, gália, pele-de-sapo, orange) — mesmas regras de plantio.
- Fontes: ABCSEM (pepinos, vagem, ervilha, aspargo), ZARC/MAPA (três safras de feijão no Paraná), Embrapa/IDR (trigo, cevada, grão-de-bico, lentilha), UEM (arroz), FAG/IDR (trigo-sarraceno). Fava, centeio, quinoa, amaranto, amendoim, edamame e feijão-de-corda são **estimativas** — ajuste com a sua experiência.

## No iPad (toque)
- **Mapa:** um dedo arrasta (mover mapa, desenhar, pintar); **dois dedos** movem o mapa e **afastar/aproximar** dá zoom. Se o segundo dedo entrar no meio de um desenho, o desenho é cancelado (nada muda).
- **Dicas:** o que no computador aparece ao passar o mouse aparece ao **tocar e segurar** um botão ou ícone.
- **Sem teclado:** Desfazer/Refazer, Excluir área, ⧉ Duplicar, mês (barra de meses) e zoom (− + ⤢) têm botões. Ao marcar a posição de uma planta, o botão **🧽 apagar** faz o que o Alt faz no computador.
- **Alças** das formas e botões ficam maiores no toque; campos usam letra de 16 px (o iPad não dá zoom ao digitar).
- **iPad em pé** (tela estreita): o mapa ocupa a largura toda e os painéis abrem **por cima**, um de cada vez, pelas abas ‹ › nas bordas. Tocar num canteiro ou numa planta abre o painel com os detalhes. A barra do topo mostra só ícones.
