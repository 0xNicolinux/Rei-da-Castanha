# Rei da Castanha: site

Site único com o jogo **Pânico na Floresta** embutido, a saga em quatro atos, a faixa original e o Mercado das Duas Irmãs.

## Estrutura
- `index.html`: a página inteira (herói, jogo, saga, música, mercado).
- `css/site.css`, `js/site.js` (jogo embutido, player, animações), `js/mercado.js` (loja).
- `jogo/`: cópia do jogo. **Não edite aqui**: o jogo é desenvolvido em `~/Downloads/game`.
- `assets/saga`, `assets/marca`, `assets/musica`: imagens, logotipos e a faixa.
- `fonts/`: as mesmas fontes do jogo (Lilita One, Pixelify Sans, Nunito), servidas localmente.

## Atualizar o jogo
Depois de mudar o jogo em `~/Downloads/game`, rode:

    tools/atualizar-jogo.sh            # ou: tools/atualizar-jogo.sh /outra/pasta/do/jogo

## Testar localmente
    python3 -m http.server 8000        # e abra http://localhost:8000

## Mercado
Preços e produtos ficam na lista `PRODUTOS` no topo de `js/mercado.js` (`v` = valor em folhas).
Câmbio: 1 brilho = 6 folhas, 1 pedra = 15 folhas. A bolsa fica salva no navegador.
