export interface ClientEnvironmentInfo {
  description: string
  label: string
  name: 'local' | 'pruebas'
}

function currentEnvironment(): ClientEnvironmentInfo | null {
  if (import.meta.env.MODE === 'test') {
    return {
      description:
        'Esta ejecución usa datos de prueba aislados. No modifica la base local ni producción.',
      label: 'Pruebas',
      name: 'pruebas',
    }
  }

  if (import.meta.env.DEV) {
    return {
      description:
        'Esta aplicación usa datos locales aislados. No se sincronizan automáticamente con producción.',
      label: 'Local',
      name: 'local',
    }
  }

  return null
}

export const clientEnvironment = currentEnvironment()
