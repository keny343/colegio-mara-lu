/**
 * Paradigma orientado a objetos — entidade Aluno (cadastro e dados pessoais).
 */
class Aluno {
  constructor(dados = {}) {
    this.id = dados.id ?? null;
    this.usuario_id = dados.usuario_id ?? null;
    this.nome = dados.nome ?? '';
    this.data_nascimento = dados.data_nascimento ?? null;
    this.cpf = dados.cpf ?? null;
    this.sexo = dados.sexo ?? null;
    this.nacionalidade = dados.nacionalidade ?? null;
    this.nome_mae = dados.nome_mae ?? null;
    this.nome_pai = dados.nome_pai ?? null;
    this.responsavel = dados.responsavel ?? null;
    this.telefone_emergencia = dados.telefone_emergencia ?? null;
  }

  static fromRow(row) {
    return row ? new Aluno(row) : null;
  }

  toJSON() {
    return {
      id: this.id,
      usuario_id: this.usuario_id,
      nome: this.nome,
      data_nascimento: this.data_nascimento,
      cpf: this.cpf,
      sexo: this.sexo,
      nacionalidade: this.nacionalidade,
      nome_mae: this.nome_mae,
      nome_pai: this.nome_pai,
      responsavel: this.responsavel,
      telefone_emergencia: this.telefone_emergencia,
    };
  }

  /** Campos permitidos na actualização (imperativo — validação na instância). */
  dadosParaAtualizacao() {
    const campos = {};
    const permitidos = [
      'nome', 'data_nascimento', 'sexo', 'nacionalidade',
      'nome_mae', 'nome_pai', 'responsavel', 'telefone_emergencia',
    ];
    for (const k of permitidos) {
      if (this[k] !== undefined && this[k] !== null) campos[k] = this[k];
    }
    return campos;
  }
}

module.exports = Aluno;
