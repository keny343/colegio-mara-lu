const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CATEGORY_OPTIONS = [
  'Tecnologia',
  'Eletrónica',
  'Casa',
  'Desporto',
  'Moda',
  'Saúde',
  'Educação',
  'Acessórios',
  'Automóvel',
  'Alimentação',
  'Escritório',
  'Jardim'
];

const ESTADO_OPTIONS = ['pendente', 'concluida', 'cancelada', 'devolvida'];
const PROVINCIAS = [
  'Luanda',
  'Benguela',
  'Huíla',
  'Cabinda',
  'Malanje',
  'Kwanza Sul',
  'Namibe'
];

const MUNICIPIOS = {
  Luanda: ['Ingombota', 'Maianga', 'Viana', 'Talatona', 'Kilamba'],
  Benguela: ['Benguela', 'Lobito', 'Baía Farta'],
  'Huíla': ['Lubango', 'Matala', 'Chibia'],
  Cabinda: ['Cabinda', 'Cacongo'],
  Malanje: ['Malanje', 'Cacuso'],
  'Kwanza Sul': ['Sumbe', 'Porto Amboim'],
  Namibe: ['Namibe', 'Tômbwa']
};

const CANAIS = ['web', 'mobile', 'loja', 'tablet', 'api'];
const ORIGENS = ['proprio', 'partner', 'campanha', 'revenda'];
const PRODUCT_PREFIXES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const DESCRICOES = [
  'Entrega urgente',
  'Produto premium',
  'Pedido recorrente',
  'Compra em lote',
  'Pedido promocional',
  'Cliente preferencial',
  'Envio na mesma semana',
  'Pedido em revisão'
];

const DATASET_SCHEMA = [
  { name: 'id', type: 'bigint', description: 'Identificador único crescente' },
  { name: 'cliente_id', type: 'bigint', description: 'Cliente sintético' },
  { name: 'produto_id', type: 'bigint', description: 'Produto sintético' },
  { name: 'data_transacao', type: 'timestamp', description: 'Data em ISO 8601 UTC' },
  { name: 'categoria', type: 'string', description: 'Categoria baixa cardinalidade' },
  { name: 'quantidade', type: 'int', description: 'Quantidade positiva' },
  { name: 'preco_unitario', type: 'decimal', description: 'Preço unitário em moeda' },
  { name: 'valor_total', type: 'decimal', description: 'Quantidade × preço unitário' },
  { name: 'estado', type: 'string', description: 'Estado da transação' },
  { name: 'descricao', type: 'string', description: 'Texto sintético curto' },
  { name: 'localizacao', type: 'json', description: 'Localização aninhada' },
  { name: 'metadados', type: 'json', description: 'Metadados aninhados opicionais' }
];

function createSeededRng(seed) {
  let state = seed >>> 0;
  return function next() {
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function decimalToString(value) {
  return Number(value).toFixed(2);
}

function roundMoney(value) {
  return Number(value.toFixed(2));
}

function buildLocation(rng) {
  const provincia = PROVINCIAS[Math.floor(rng() * PROVINCIAS.length)];
  const municipios = MUNICIPIOS[provincia] || ['Centro'];
  const municipio = municipios[Math.floor(rng() * municipios.length)];
  const zona = `Zona ${Math.floor(rng() * 12) + 1}`;
  return { provincia, municipio, zona };
}

function buildMetadata(rng) {
  const canal = CANAIS[Math.floor(rng() * CANAIS.length)];
  const origem = ORIGENS[Math.floor(rng() * ORIGENS.length)];
  const terminal = `TERM-${Math.floor(rng() * 9999) + 1000}`;
  const tags = Array.from({ length: 2 + Math.floor(rng() * 3) }, (_, i) => `tag-${i + 1}`);
  return { canal, origem, terminal, tags };
}

function generateRecord(id, seed) {
  const rng = createSeededRng((seed ^ (id * 1664525 + 1013904223)) >>> 0);
  const clienteId = 1000 + (id % 100000);
  const produtoId = 3000 + (id * 17 % 50000);
  const data = new Date(Date.UTC(2025, 0, 1) + ((id * 97) % 31557600000));
  const categoria = CATEGORY_OPTIONS[id % CATEGORY_OPTIONS.length];
  const quantidade = 1 + (id % 9);
  const precoUnitario = roundMoney(5 + rng() * 299.99);
  const valorTotal = roundMoney(precoUnitario * quantidade);
  const estado = ESTADO_OPTIONS[id % ESTADO_OPTIONS.length];
  const descricao = `${DESCRICOES[id % DESCRICOES.length]} - ${PRODUCT_PREFIXES[id % PRODUCT_PREFIXES.length]}${id}`;
  const localizacao = buildLocation(rng);
  const metadados = buildMetadata(rng);

  return {
    id: Number(id),
    cliente_id: Number(clienteId),
    produto_id: Number(produtoId),
    data_transacao: data.toISOString(),
    categoria,
    quantidade: Number(quantidade),
    preco_unitario: decimalToString(precoUnitario),
    valor_total: decimalToString(valorTotal),
    estado,
    descricao,
    localizacao,
    metadados
  };
}

function* generateRecordsBatches({ count, batchSize, seed }) {
  const safeCount = Number(count) || 1000;
  const safeBatch = Number(batchSize) || 10000;
  const totalBatches = Math.ceil(safeCount / safeBatch);

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex += 1) {
    const currentStart = batchIndex * safeBatch;
    const currentEnd = Math.min(currentStart + safeBatch, safeCount);
    const batch = [];

    for (let recordId = currentStart; recordId < currentEnd; recordId += 1) {
      batch.push(generateRecord(recordId + 1, seed));
    }

    yield batch;
  }
}

function computeHash(record) {
  const payload = {
    id: record.id,
    cliente_id: record.cliente_id,
    produto_id: record.produto_id,
    data_transacao: record.data_transacao,
    categoria: record.categoria,
    quantidade: record.quantidade,
    preco_unitario: record.preco_unitario,
    valor_total: record.valor_total,
    estado: record.estado,
    descricao: record.descricao,
    localizacao: record.localizacao,
    metadados: record.metadados
  };

  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function computeStats(records) {
  const total = records.reduce((sum, record) => sum + Number(record.valor_total), 0);
  const categoryMap = {};

  for (const record of records) {
    categoryMap[record.categoria] = (categoryMap[record.categoria] || 0) + 1;
  }

  return {
    count: records.length,
    total: Number(total.toFixed(2)),
    categories: categoryMap,
    sampleHashes: records.slice(0, 5).map((record) => computeHash(record))
  };
}

module.exports = {
  CATEGORY_OPTIONS,
  ESTADO_OPTIONS,
  DATASET_SCHEMA,
  generateRecordsBatches,
  computeHash,
  computeStats,
  generateRecord,
  decimalToString
};

module.exports.PROVINCIAS = PROVINCIAS;
module.exports.MUNICIPIOS = MUNICIPIOS;
module.exports.CANAIS = CANAIS;
module.exports.ORIGENS = ORIGENS;
module.exports.DESTINATION_OPTIONS = ['jsonl', 'csv', 'avro', 'parquet', 'sql'];
module.exports.OUTPUT_ROOT = path.join(__dirname, '..', '..', 'data-lab-output');
module.exports.DEFAULT_OUTPUT_DIR = path.join(__dirname, '..', '..', 'data-lab-output');
