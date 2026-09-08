import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'

import Button from './Button'
import Drawer from './Drawer'
import Modal from './Modal'
import StatePanel from './StatePanel'

function ModalHarness() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button onClick={() => setOpen(true)} type="button">
        Abrir confirmación
      </button>
      {open && (
        <Modal onClose={() => setOpen(false)} title="Confirmar operación">
          <div className="p-5">
            <button type="button">Primera acción</button>
            <button type="button">Última acción</button>
          </div>
        </Modal>
      )}
    </>
  )
}

function DrawerHarness() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button onClick={() => setOpen(true)} type="button">
        Abrir detalle
      </button>
      <Drawer onClose={() => setOpen(false)} open={open} title="Detalle del bus">
        <button type="button">Acción del detalle</button>
      </Drawer>
    </>
  )
}

describe('primitivas accesibles P11', () => {
  it('expone el estado busy del botón y bloquea un segundo envío', () => {
    render(<Button loading>Guardar</Button>)

    const button = screen.getByRole('button', { name: 'Guardar' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
  })

  it('anuncia estados de carga y error con la prioridad correcta', () => {
    const { rerender } = render(<StatePanel title="Cargando buses" tone="loading" />)

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')

    rerender(<StatePanel title="No fue posible cargar" tone="error" />)
    expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive')
  })

  it('atrapa el foco en el modal, cierra con Escape y lo restaura', async () => {
    render(<ModalHarness />)
    const trigger = screen.getByRole('button', { name: 'Abrir confirmación' })
    trigger.focus()
    fireEvent.click(trigger)

    const dialog = screen.getByRole('dialog', { name: 'Confirmar operación' })
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Confirmar operación' })).toHaveFocus(),
    )

    const last = screen.getByRole('button', { name: 'Última acción' })
    last.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(screen.getByRole('button', { name: 'Cerrar diálogo' })).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(dialog).not.toBeInTheDocument()
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it('enfoca y cierra el drawer con restauración al disparador', async () => {
    render(<DrawerHarness />)
    const trigger = screen.getByRole('button', { name: 'Abrir detalle' })
    trigger.focus()
    fireEvent.click(trigger)

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Detalle del bus' })).toHaveFocus(),
    )
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('dialog', { name: 'Detalle del bus' })).not.toBeInTheDocument()
    await waitFor(() => expect(trigger).toHaveFocus())
  })
})
