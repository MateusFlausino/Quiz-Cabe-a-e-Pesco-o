# Quiz Cabeça e Pescoço

Aplicativo web local para transformar as lâminas extraídas do PDF em um quiz interativo de anatomia.

O app já carrega automaticamente os pinos, máscaras e respostas cadastrados em `data/quiz-cabeca-pescoco.json`.

## Como usar

Abra `index.html` no navegador.

- `Editar`: clique na imagem para criar pinos, arraste pinos para reposicionar, use máscaras para cobrir nomes ou setas e use `Mover` para arrastar a lâmina com zoom.
- `Quiz`: selecione um pino, digite a estrutura física e confira a resposta.
- `Estudo`: veja os nomes cadastrados sobre a lâmina.
- `Zoom`: aumente a imagem pelo controle ou rolando o mouse sobre a lâmina; depois arraste a lâmina para navegar nos detalhes.
- As respostas aceitam caixa alta/baixa, acentos e variações simples de singular/plural.
- `Exportar` e `Importar`: salva ou carrega os pinos e máscaras em JSON.

Os dados ficam salvos no `localStorage` do navegador e também podem ser exportados.
