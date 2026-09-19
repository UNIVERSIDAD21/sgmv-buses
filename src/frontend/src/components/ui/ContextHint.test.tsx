import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import ContextHint from './ContextHint'

describe('ContextHint', () => {
  it('explica una acción con una región semántica identificable', () => {
    render(
      <ContextHint title="¿Para qué sirve este cambio?">
        Mantiene el historial de la jornada original y registra el nuevo tramo.
      </ContextHint>,
    )

    expect(
      screen.getByRole('complementary', { name: /para qué sirve este cambio/i }),
    ).toHaveTextContent(/mantiene el historial/i)
  })
})
