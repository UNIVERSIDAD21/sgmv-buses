import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import App from './App'

describe('App', () => {
  it('renders the project bootstrap screen', () => {
    render(<App />)

    expect(screen.getByText('Software de Gestion de Mantenimiento Vehicular')).toBeInTheDocument()
    expect(screen.getByText('RF-02 Control de novedades operativas')).toBeInTheDocument()
  })
})
