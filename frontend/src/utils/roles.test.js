import {
  temEscopoCoordenacao,
  podeAcederNotas,
  podeEditarNotas,
  isProfessor,
  isCoordenador,
  podeAcederInformacaoGeral,
  podeDesignarCoordenador,
} from './roles';

const admin = { role: 'admin' };
const coordenador = { role: 'coordenador', curso_coordenado: 'Ciências' };
const professor = { role: 'professor' };
const professorCoordenador = { role: 'professor', nivel_coordenado: '10ª' };
const aluno = { role: 'aluno' };

describe('roles', () => {
  test('temEscopoCoordenacao', () => {
    expect(temEscopoCoordenacao(admin)).toBe(false);
    expect(temEscopoCoordenacao(coordenador)).toBe(true);
    expect(temEscopoCoordenacao(professorCoordenador)).toBe(true);
    expect(temEscopoCoordenacao(null)).toBe(false);
  });

  test('podeAcederNotas', () => {
    expect(podeAcederNotas(admin)).toBe(true);
    expect(podeAcederNotas(coordenador)).toBe(true);
    expect(podeAcederNotas(professor)).toBe(true);
    expect(podeAcederNotas(aluno)).toBe(false);
    expect(podeAcederNotas({ role: 'coordenador' })).toBe(false);
    expect(podeAcederNotas(null)).toBe(false);
  });

  test('podeEditarNotas', () => {
    expect(podeEditarNotas(admin)).toBe(true);
    expect(podeEditarNotas(coordenador)).toBe(true);
    expect(podeEditarNotas(professorCoordenador)).toBe(true);
    expect(podeEditarNotas(professor)).toBe(false);
    expect(podeEditarNotas(aluno)).toBe(false);
  });

  test('isProfessor / isCoordenador', () => {
    expect(isProfessor(professor)).toBe(true);
    expect(isProfessor(admin)).toBe(false);
    expect(isCoordenador(coordenador)).toBe(true);
    expect(isCoordenador(professorCoordenador)).toBe(true);
    expect(isCoordenador(professor)).toBe(false);
  });

  test('podeAcederInformacaoGeral', () => {
    expect(podeAcederInformacaoGeral(admin)).toBe(true);
    expect(podeAcederInformacaoGeral(coordenador)).toBe(true);
    expect(podeAcederInformacaoGeral(professorCoordenador)).toBe(true);
    expect(podeAcederInformacaoGeral(professor)).toBe(false);
    expect(podeAcederInformacaoGeral(aluno)).toBe(false);
  });

  test('podeDesignarCoordenador', () => {
    expect(podeDesignarCoordenador(admin)).toBe(true);
    expect(podeDesignarCoordenador(coordenador)).toBe(true);
    expect(podeDesignarCoordenador(professor)).toBe(false);
    expect(podeDesignarCoordenador(aluno)).toBe(false);
  });
});
