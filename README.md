````md
# TaxiVis — Manhattan & Feriados

Este projeto é uma aplicação web de visualização de dados para analisar corridas de táxi amarelo em Manhattan durante feriados estadunidenses, com foco no período de julho de 2019 a dezembro de 2022. A aplicação utiliza dados da base **New York City Taxi and Limousine Commission (TLC) Trip Record Data**, processados diretamente no navegador com **DuckDB WASM** e visualizados com **D3.js**.

## Ideia geral

A aplicação foi organizada em torno de múltiplas visualizações independentes, chamadas de *views*. Cada view responde a uma pergunta analítica específica sobre os dados, como volume de corridas, formas de pagamento, gorjetas médias e perfil horário das viagens.

A lógica principal fica em `main.js`, que:

1. monta a estrutura HTML da aplicação;
2. inicializa a classe `Taxi`;
3. carrega e agrega os dados;
4. preenche o seletor de visualizações;
5. chama a função de renderização correspondente à view selecionada.

As views recebem os dados já agregados e ficam responsáveis apenas por desenhar os gráficos com D3.

## Estrutura do projeto

```txt
src/
├── main.js
├── taxi.js
├── config.js
├── views/
│   ├── index.js
│   ├── holidayHeatmap.js
│   ├── holidayTipsLineView.js
│   ├── holidayPaymentShareStackedBarsView.js
│   └── holidayHourlyHistogramView.js
├── utils/
│   ├── chart.js
│   └── date.js
├── constants/
│   ├── holidays.js
│   ├── zones.js
│   └── colors.js
└── data/
    └── parquet/
        ├── yellow_tripdata_2019-07.parquet
        ├── yellow_tripdata_2019-08.parquet
        └── ...
````

## Principais arquivos

### `main.js`

Arquivo de entrada da aplicação. Ele define o catálogo de visualizações disponíveis, monta o layout principal da página, carrega os dados e controla a troca de views pelo seletor.

Cada visualização é registrada no array `views`, com:

```js
{
  id: "heatmap",
  title: "Volume de Corridas em Feriados",
  question: "...",
  explanation: "...",
  render: renderHolidayHeatmap,
}
```

Isso permite adicionar ou remover visualizações alterando apenas esse catálogo.

### `taxi.js`

Contém a classe `Taxi`, responsável pela camada de dados. Essa classe inicializa o DuckDB WASM, carrega os arquivos Parquet e executa as queries de agregação necessárias para as visualizações.

As principais agregações produzidas são:

* `holidaySeries`: volume total de corridas por feriado e ano;
* `holidayTipsByYear`: média e soma de gorjetas por feriado e ano;
* `holidayPaymentShare`: contagem de corridas por tipo de pagamento;
* `holidayHourlyByYear`: contagem de corridas por hora do dia.

### `views/`

Contém as visualizações D3. Cada arquivo exporta uma função `render...`, que recebe os dados agregados e desenha um gráfico no container `#chart`.

As views implementadas são:

* `renderHolidayHeatmap`: heatmap de volume de corridas por feriado e ano;
* `renderHolidayTipsLineView`: pequenos múltiplos de linha para gorjetas médias;
* `renderHolidayPaymentShareStackedBarsView`: barras empilhadas percentuais para formas de pagamento;
* `renderHolidayHourlyHistogramView`: histogramas horários por feriado e ano.

### `utils/chart.js`

Contém funções auxiliares para criação do SVG base, legendas e elementos comuns das visualizações.

### `utils/date.js`

Contém funções de enriquecimento temporal dos dados, associando datas aos feriados, anos e rótulos usados nos gráficos.

### `constants/`

Contém constantes reutilizadas no projeto, como:

* lista de feriados analisados;
* zonas de Manhattan;
* paletas de cores.

## Dados

Os arquivos Parquet devem estar no diretório:

```txt
data/parquet/
```

com nomes no formato:

```txt
yellow_tripdata_YYYY-MM.parquet
```

Por exemplo:

```txt
yellow_tripdata_2020-05.parquet
```

A aplicação espera que os arquivos listados em `taxi.js` estejam disponíveis nesse caminho.

## Como rodar

Instale as dependências:

```bash
npm install
```

Execute a aplicação em modo de desenvolvimento:

```bash
npm run dev
```

Depois, abra no navegador o endereço indicado pelo terminal, geralmente:

```txt
http://localhost:5173
```

## Observações

A aplicação processa os arquivos Parquet diretamente no navegador usando DuckDB. Por isso, arquivos muito grandes podem impactar o tempo de carregamento e o consumo de memória. Para melhorar o desempenho, o carregamento dos arquivos é feito sequencialmente e as visualizações reutilizam os dados agregados em memória, evitando repetir consultas pesadas a cada troca de gráfico.

```
```
