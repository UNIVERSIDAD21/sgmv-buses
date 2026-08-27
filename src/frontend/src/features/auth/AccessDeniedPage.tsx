import StatePanel from '../../components/ui/StatePanel'

export default function AccessDeniedPage() {
  return (
    <div className="p-4 md:p-6">
      <StatePanel
        description="Su rol autenticado no tiene acceso visual a este módulo. La autorización definitiva también se valida en el backend."
        title="Acceso denegado"
        tone="error"
      />
    </div>
  )
}
