'use strict';

const fs = require('fs');
const { once } = require('events');

/**
 * Escrita em ficheiro com backpressure: espera pelo 'drain' quando o buffer interno enche,
 * por isso a memória não cresce com o volume e o event loop nunca fica bloqueado
 * (o /health do Render continua a responder durante gerações longas).
 */
class FileSink {
  constructor(filePath) {
    this.filePath = filePath;
    this.bytes = 0;
    this.error = null;
    this.stream = fs.createWriteStream(filePath, { flags: 'w', highWaterMark: 1 << 20 });
    this.stream.on('error', (err) => { this.error = err; });
  }

  async write(chunk) {
    if (this.error) throw this.error;
    if (!chunk || !chunk.length) return;
    this.bytes += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk);
    if (!this.stream.write(chunk)) await once(this.stream, 'drain');
    if (this.error) throw this.error;
  }

  async close() {
    if (this.error) throw this.error;
    this.stream.end();
    await once(this.stream, 'finish');
    if (this.error) throw this.error;
    return this.bytes;
  }

  abort() {
    try { this.stream.destroy(); } catch { /* ignorar */ }
  }
}

/** Acumula linhas e só escreve quando passa de ~1 MB, para não criar milhões de writes pequenos. */
class LineBuffer {
  constructor(sink, flushAt = 1 << 20) {
    this.sink = sink;
    this.flushAt = flushAt;
    this.parts = [];
    this.size = 0;
  }

  push(text) {
    this.parts.push(text);
    this.size += text.length;
    return this.size >= this.flushAt ? this.flush() : null;
  }

  async flush() {
    if (!this.parts.length) return;
    const text = this.parts.join('');
    this.parts = [];
    this.size = 0;
    await this.sink.write(text);
  }
}

/** Cede o controlo ao event loop (HTTP, health checks, polling do progresso). */
const yieldLoop = () => new Promise((resolve) => setImmediate(resolve));

module.exports = { FileSink, LineBuffer, yieldLoop };