import { REQUIREMENT_NAV_ITEMS, type AppRouteId } from '../../domain/labels'
import StatePanel from '../../components/ui/StatePanel'

interface PendingModulePageProps {
  moduleId: AppRouteId
}

export default function PendingModulePage({ moduleId }: PendingModulePageProps) {
  const module = REQUIREMENT_NAV_ITEMS.find((item) => item.id === moduleId)

  return (
    <div className="p-4 md:p-6">
      <StatePanel
        description={`${module?.label ?? 'RF pendiente'}: ${module?.description ?? 'Módulo pendiente.'} Esta pantalla conserva la navegación y el marco visual oficial, pero no simula datos ni operaciones hasta que se autorice el RF correspondiente.`}
        title="Módulo pendiente de implementación"
        tone="empty"
      />
    </div>
  )
}
