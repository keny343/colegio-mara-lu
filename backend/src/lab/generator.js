'use strict';

/**
 * Gerador determinístico de transações sintéticas (espelha data-engineering/generator).
 * Seed local via Mulberry32 — reproduzível no Node; o CLI Python usa random.Random.
 */

const CATEGORIAS = [
  'Eletronicos', 'Vestuario', 'Alimentos', 'Casa', 'Esportes',
  'Livros', 'Beleza', 'Brinquedos', 'Automotivo', 'Saude',
];

const ESTADOS = [
  'SP', 'RJ', 'MG', 'RS', 'PR', 'BA', 'SC', 'GO', 'PE', 'CE',
  'DF', 'ES', 'PA', 'MT', 'MS', 'AM', 'MA', 'PB', 'RN', 'AL',
];

const CIDADES = {
  SP: ['São Paulo', -23.5505, -46.6333],
  RJ: ['Rio de Janeiro', -22.9068, -43.1729],
  MG: ['Belo Horizonte', -19.9167, -43.9345],
  RS: ['Porto Alegre', -30.0346, -51.2177],
  PR: ['Curitiba', -25.4284, -49.2733],
  BA: ['Salvador', -12.9714, -38.5014],
  SC: ['Florianópolis', -27.5954, -48.5480],
  GO: ['Goiânia', -16.6869, -49.2648],
  PE: ['Recife', -8.0476, -34.8770],
  CE: ['Fortaleza', -3.7172, -38.5433],
  DF: ['Brasília', -15.8267, -47.9218],
  ES: ['Vitória', -20.3155, -40.3128],
  PA: ['Belém', -1.4558, -48.4902],
  MT: ['Cuiabá', -15.6010, -56.0974],
  MS: ['Campo Grande', -20.4697, -54.6201],
  AM: ['Manaus', -3.1190, -60.0217],
  MA: ['São Luís', -2.5307, -44.3068],
  PB: ['João Pessoa', -7.1195, -34.8450],
  RN: ['Natal', -5.7945, -35.2110],
  AL: ['Maceió', -9.6658, -35.7350],
};

const CANAIS = ['online', 'loja', 'marketplace', 'telefone'];
const BASE_MS = Date.UTC(2023, 0, 1, 0, 0, 0);

function mulberry32(seed) {
  let t = seed >>> 0;
  return function next() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function money(n) {
  return (Math.round(n * 100) / 100).toFixed(2);
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function makeRecord(rng, txId) {
  const categoria = pick(rng, CATEGORIAS);
  const estado = pick(rng, ESTADOS);
  const [cidade, lat0, lon0] = CIDADES[estado];
  const lat = lat0 + (rng() * 0.1 - 0.05);
  const lon = lon0 + (rng() * 0.1 - 0.05);
  const quantidade = 1 + Math.floor(rng() * 20);
  const preco = 5 + rng() * 994.99;
  const precoStr = money(preco);
  const valorTotal = money(Number(precoStr) * quantidade);
  const seconds = Math.floor(rng() * 86400 * 700);
  const data = new Date(BASE_MS + seconds * 1000);
  const iso = data.toISOString().slice(0, 19);

  let metadados = null;
  if (rng() < 0.7) {
    metadados = {
      canal: pick(rng, CANAIS),
      promocao: rng() < 0.25,
      vendedor_id: rng() < 0.6 ? 1 + Math.floor(rng() * 500) : null,
    };
  }

  return {
    id: txId,
    cliente_id: 1 + Math.floor(rng() * 50000),
    produto_id: 1 + Math.floor(rng() * 5000),
    data_transacao: iso,
    categoria,
    quantidade,
    preco_unitario: precoStr,
    valor_total: valorTotal,
    estado,
    descricao: `${categoria} item #${1 + Math.floor(rng() * 9999)}`,
    localizacao: {
      cidade,
      latitude: Math.round(lat * 1e6) / 1e6,
      longitude: Math.round(lon * 1e6) / 1e6,
    },
    metadados,
  };
}

function* generateBatches(n, seed = 42, batchSize = 5000, startId = 1) {
  if (batchSize < 1) throw new Error('batch_size deve ser >= 1');
  const rng = mulberry32(seed >>> 0);
  let batch = [];
  for (let i = 0; i < n; i++) {
    batch.push(makeRecord(rng, startId + i));
    if (batch.length >= batchSize) {
      yield batch;
      batch = [];
    }
  }
  if (batch.length) yield batch;
}

module.exports = {
  CATEGORIAS,
  ESTADOS,
  generateBatches,
  SCHEMA_FIELDS: [
    'id', 'cliente_id', 'produto_id', 'data_transacao', 'categoria',
    'quantidade', 'preco_unitario', 'valor_total', 'estado', 'descricao',
    'localizacao', 'metadados',
  ],
};
