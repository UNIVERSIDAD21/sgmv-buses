const functionalRequirements = [
  'RF-01 Gestion de la flota vehicular',
  'RF-02 Control de novedades operativas',
  'RF-03 Administracion del mantenimiento preventivo',
  'RF-04 Seguimiento de ordenes de trabajo',
  'RF-05 Central de Repuestos',
  'RF-06 Consulta de historial e informes',
]

function App() {
  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center gap-10 px-6 py-10">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-normal text-emerald-700">
            Fase 3 autorizada
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-normal text-zinc-950 md:text-5xl">
            Software de Gestion de Mantenimiento Vehicular
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-700">
            Bootstrap tecnico del prototipo web academico para flota de buses.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {functionalRequirements.map((requirement) => (
            <div
              className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-800 shadow-sm"
              key={requirement}
            >
              {requirement}
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}

export default App
