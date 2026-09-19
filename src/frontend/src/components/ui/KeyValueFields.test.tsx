import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import KeyValueFields, { keyValueEntriesToRecord, recordToKeyValueEntries } from './KeyValueFields'

describe('KeyValueFields', () => {
  it('convierte datos técnicos sin exigir sintaxis técnica al usuario', () => {
    expect(recordToKeyValueEntries({ voltaje: '24 V', largoMm: 100 })).toEqual([
      { campo: 'voltaje', valor: '24 V' },
      { campo: 'largoMm', valor: '100' },
    ])
    expect(keyValueEntriesToRecord([{ campo: 'Voltaje', valor: '24 V' }])).toEqual({
      value: { Voltaje: '24 V' },
    })
  })

  it('advierte datos incompletos o repetidos', () => {
    expect(keyValueEntriesToRecord([{ campo: 'Voltaje', valor: '' }]).error).toMatch(/complete/i)
    expect(
      keyValueEntriesToRecord([
        { campo: 'Voltaje', valor: '24 V' },
        { campo: 'Voltaje', valor: '12 V' },
      ]).error,
    ).toMatch(/repetido/i)
  })

  it('permite agregar un dato con controles accesibles', async () => {
    const onChange = vi.fn()
    render(<KeyValueFields entries={[]} label="Especificaciones" onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: /agregar dato/i }))

    expect(onChange).toHaveBeenCalledWith([{ campo: '', valor: '' }])
  })
})
