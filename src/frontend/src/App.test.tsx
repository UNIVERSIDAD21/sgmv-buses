import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import App from './App'

describe('App', () => {
  it('renders the project bootstrap screen', () => {
    render(<App />)

    const officialTexts = [
      'Software de Gestión de Mantenimiento Vehicular',
      'RF-01 Gestión de la flota vehicular',
      'RF-02 Control de novedades operativas',
      'RF-03 Administración del mantenimiento preventivo',
      'RF-04 Seguimiento de órdenes de trabajo',
      'RF-05 Central de Repuestos',
      'RF-06 Consulta de historial y generación de informes',
    ]

    for (const text of officialTexts) {
      expect(screen.getByText(text)).toBeInTheDocument()
    }
  })
})
