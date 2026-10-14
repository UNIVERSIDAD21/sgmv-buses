import { describe, expect, it } from 'vitest'

import { normalizeDecimalInput, parseMileageInput } from './numeric-input'

describe('Entrada numérica es-CO sin pérdida de magnitud', () => {
  it.each([
    ['120.000', '120000'],
    ['120.000,50', '120000.50'],
    ['$ 1.234.567,89', '1234567.89'],
    ['120000.50', '120000.50'],
    ['12,50', '12.50'],
    ['0', '0'],
    ['0.50', '0.50'],
  ])('normaliza %s al decimal de la API %s', (input, expected) => {
    expect(normalizeDecimalInput(input)).toBe(expected)
  })
  it.each(['12.34.567', '1.000.00', '1,234.56', '0.125', '-120.000', '1e5', '', 'Infinity'])(
    'rechaza el costo ambiguo o inválido %s',
    (input) => {
      expect(normalizeDecimalInput(input)).toBeNull()
    },
  )
  it.each([
    ['120.000', 120000],
    ['120000', 120000],
    ['1.234.567', 1234567],
  ])('interpreta %s como %s km, no como decimal', (input, expected) => {
    expect(parseMileageInput(String(input))).toBe(expected)
  })
  it.each(['120.50', '120,50', '0', '-10', '2147483648', '1e5', '12.34.567', ''])(
    'rechaza el odómetro no entero o fuera de rango %s',
    (input) => {
      expect(parseMileageInput(input)).toBeNull()
    },
  )
})
