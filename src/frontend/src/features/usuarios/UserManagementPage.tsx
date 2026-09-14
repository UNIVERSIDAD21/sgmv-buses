import { useCallback, useEffect, useState } from 'react'

import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import { PlusCircle, Search, User } from '../../components/ui/Icons'
import Modal from '../../components/ui/Modal'
import PageHeader from '../../components/ui/PageHeader'
import StatePanel from '../../components/ui/StatePanel'
import { ROLE_LABELS, type RoleCode } from '../../domain/labels'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { ApiError } from '../../lib/api'
import { useSession } from '../auth/session.context'
import {
  changeUserRole,
  changeUserState,
  createUser,
  listUsers,
  reissueActivation,
  updateUser,
} from './user.api'
import type { ActivationDelivery, UserRecord, UserState } from './user.types'

const roles = ['ADMINISTRADOR', 'DESPACHADOR', 'MECANICO', 'CONDUCTOR'] as const
const states = ['PENDIENTE_ACTIVACION', 'ACTIVO', 'BLOQUEADO', 'INACTIVO'] as const

const stateLabels: Record<UserState, string> = {
  ACTIVO: 'Activo',
  BLOQUEADO: 'Bloqueado',
  INACTIVO: 'Inactivo',
  PENDIENTE_ACTIVACION: 'Pendiente de activación',
}

const stateTones: Record<UserState, 'amber' | 'emerald' | 'red' | 'slate'> = {
  ACTIVO: 'emerald',
  BLOQUEADO: 'red',
  INACTIVO: 'slate',
  PENDIENTE_ACTIVACION: 'amber',
}

function shortDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(
        new Date(value),
      )
    : 'Sin acceso'
}

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : 'No fue posible completar la operación.'
}

function ActivationDeliveryDialog({
  delivery,
  onClose,
}: {
  delivery: ActivationDelivery
  onClose: () => void
}) {
  const [status, setStatus] = useState<string | null>(null)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(delivery.activacion.token)
      setStatus('Código copiado. Entréguelo al usuario por un canal controlado.')
    } catch {
      setStatus('El navegador no permitió copiar. Genere un nuevo código desde el detalle.')
    }
  }

  return (
    <Modal
      onClose={onClose}
      subtitle="Entrega local controlada; en producción este paso se sustituye por correo transaccional."
      title="Cuenta pendiente de activación"
    >
      <div className="space-y-4 p-5">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          <p className="font-semibold">{delivery.usuario.nombre}</p>
          <p>{delivery.usuario.email}</p>
          <p className="mt-2">
            El código no se muestra ni se guarda en el navegador. Solo puede copiarse durante esta
            entrega y vence el {shortDate(delivery.activacion.expiraAt)}.
          </p>
        </div>
        {status && (
          <p className="text-sm text-slate-700" role="status">
            {status}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button onClick={onClose} variant="outline">
            Cerrar
          </Button>
          <Button onClick={copy}>Copiar código una vez</Button>
        </div>
      </div>
    </Modal>
  )
}

function CreateUserDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (delivery: ActivationDelivery) => void
}) {
  const [form, setForm] = useState({
    email: '',
    nombre: '',
    rol: 'CONDUCTOR' as RoleCode,
    telefono: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!form.nombre.trim() || !form.email.trim()) {
      setError('Nombre y correo son obligatorios.')
      return
    }

    setSubmitting(true)
    try {
      onCreated(
        await createUser({
          email: form.email,
          nombre: form.nombre,
          rol: form.rol,
          ...(form.telefono.trim() ? { telefono: form.telefono } : {}),
        }),
      )
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      onClose={onClose}
      subtitle="La cuenta se creará sin contraseña y quedará pendiente de activación."
      title="Nuevo usuario"
    >
      <form className="space-y-4 p-5" noValidate onSubmit={submit}>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="nuevo-nombre">
            Nombre
          </label>
          <input
            className="field-control"
            id="nuevo-nombre"
            maxLength={120}
            onChange={(event) => setForm((value) => ({ ...value, nombre: event.target.value }))}
            required
            value={form.nombre}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="nuevo-email">
            Correo de acceso
          </label>
          <input
            autoComplete="email"
            className="field-control"
            id="nuevo-email"
            maxLength={120}
            onChange={(event) => setForm((value) => ({ ...value, email: event.target.value }))}
            required
            type="email"
            value={form.email}
          />
        </div>
        <div>
          <label
            className="mb-1.5 block text-sm font-medium text-slate-700"
            htmlFor="nuevo-telefono"
          >
            Teléfono (opcional)
          </label>
          <input
            className="field-control"
            id="nuevo-telefono"
            maxLength={20}
            onChange={(event) => setForm((value) => ({ ...value, telefono: event.target.value }))}
            value={form.telefono}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="nuevo-rol">
            Rol inicial
          </label>
          <select
            className="field-control"
            id="nuevo-rol"
            onChange={(event) =>
              setForm((value) => ({ ...value, rol: event.target.value as RoleCode }))
            }
            value={form.rol}
          >
            {roles.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </div>
        {error && (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Button onClick={onClose} variant="outline">
            Cancelar
          </Button>
          <Button loading={submitting} type="submit">
            Crear cuenta
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function ManageUserDialog({
  actorId,
  onClose,
  onDelivery,
  onUpdated,
  user,
}: {
  actorId: number
  onClose: () => void
  onDelivery: (delivery: ActivationDelivery) => void
  onUpdated: (user: UserRecord) => void
  user: UserRecord
}) {
  const [nombre, setNombre] = useState(user.nombre)
  const [email, setEmail] = useState(user.email)
  const [telefono, setTelefono] = useState(user.telefono ?? '')
  const [role, setRole] = useState<RoleCode>(user.rol.codigo)
  const [state, setState] = useState<Exclude<UserState, 'PENDIENTE_ACTIVACION'>>(
    user.estado === 'PENDIENTE_ACTIVACION' ? 'INACTIVO' : user.estado,
  )
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const isSelf = actorId === user.id

  const run = async (operation: () => Promise<UserRecord>) => {
    setError(null)
    setSubmitting(true)
    try {
      onUpdated(await operation())
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setSubmitting(false)
    }
  }

  const renew = async () => {
    setError(null)
    setSubmitting(true)
    try {
      onDelivery(await reissueActivation(user.id))
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal onClose={onClose} subtitle={`Cuenta #${user.id}`} title="Gestionar usuario">
      <div className="space-y-5 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label
              className="mb-1.5 block text-sm font-medium text-slate-700"
              htmlFor="editar-nombre"
            >
              Nombre
            </label>
            <input
              className="field-control"
              id="editar-nombre"
              onChange={(event) => setNombre(event.target.value)}
              value={nombre}
            />
          </div>
          <div>
            <label
              className="mb-1.5 block text-sm font-medium text-slate-700"
              htmlFor="editar-email"
            >
              Correo
            </label>
            <input
              className="field-control"
              id="editar-email"
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              value={email}
            />
          </div>
          <div>
            <label
              className="mb-1.5 block text-sm font-medium text-slate-700"
              htmlFor="editar-telefono"
            >
              Teléfono
            </label>
            <input
              className="field-control"
              id="editar-telefono"
              onChange={(event) => setTelefono(event.target.value)}
              value={telefono}
            />
          </div>
        </div>
        <Button
          loading={submitting}
          onClick={() =>
            run(() => updateUser(user.id, { email, nombre, telefono: telefono.trim() || null }))
          }
        >
          Guardar datos
        </Button>

        <div className="grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="editar-rol">
              Rol
            </label>
            <select
              className="field-control"
              disabled={isSelf}
              id="editar-rol"
              onChange={(event) => setRole(event.target.value as RoleCode)}
              value={role}
            >
              {roles.map((item) => (
                <option key={item} value={item}>
                  {ROLE_LABELS[item]}
                </option>
              ))}
            </select>
            <Button
              className="mt-2 w-full"
              disabled={isSelf || role === user.rol.codigo}
              loading={submitting}
              onClick={() => run(() => changeUserRole(user.id, role))}
              variant="outline"
            >
              Cambiar rol
            </Button>
          </div>
          <div>
            <label
              className="mb-1.5 block text-sm font-medium text-slate-700"
              htmlFor="editar-estado"
            >
              Estado
            </label>
            <select
              className="field-control"
              disabled={isSelf}
              id="editar-estado"
              onChange={(event) =>
                setState(event.target.value as Exclude<UserState, 'PENDIENTE_ACTIVACION'>)
              }
              value={state}
            >
              <option value="ACTIVO">Activo</option>
              <option value="BLOQUEADO">Bloqueado</option>
              <option value="INACTIVO">Inactivo</option>
            </select>
            <Button
              className="mt-2 w-full"
              disabled={isSelf || state === user.estado}
              loading={submitting}
              onClick={() => run(() => changeUserState(user.id, state))}
              variant="outline"
            >
              Cambiar estado
            </Button>
          </div>
        </div>

        {user.estado === 'PENDIENTE_ACTIVACION' && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm leading-6 text-amber-900">
              La cuenta aún no tiene contraseña. Renovar invalida cualquier código anterior.
            </p>
            <Button className="mt-3" loading={submitting} onClick={renew} variant="outline">
              Renovar activación
            </Button>
          </div>
        )}
        {isSelf && (
          <p className="text-sm text-slate-600">
            Por seguridad no puede cambiar su propio rol ni estado.
          </p>
        )}
        {error && (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}

export default function UserManagementPage() {
  const { user: actor } = useSession()
  const [items, setItems] = useState<UserRecord[]>([])
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 250)
  const [role, setRole] = useState<RoleCode | ''>('')
  const [state, setState] = useState<UserState | ''>('')
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [selected, setSelected] = useState<UserRecord | null>(null)
  const [delivery, setDelivery] = useState<ActivationDelivery | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await listUsers({
        busqueda: debouncedSearch,
        estado: state,
        pagina: page,
        rol: role,
      })
      setItems(result.items)
      setPages(result.paginas)
      setTotal(result.total)
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, page, role, state])

  useEffect(() => {
    const request = window.setTimeout(() => void load(), 0)

    return () => window.clearTimeout(request)
  }, [load])

  const updated = (next: UserRecord) => {
    setSelected(next)
    setItems((current) => current.map((item) => (item.id === next.id ? next : item)))
  }

  return (
    <div className="space-y-5 p-4 md:p-6">
      <PageHeader
        actions={
          <Button icon={<PlusCircle size={16} />} onClick={() => setCreateOpen(true)}>
            Nuevo usuario
          </Button>
        }
        description="Alta controlada, roles oficiales, estados de cuenta y activación segura."
        eyebrow="Administración"
        title="Usuarios"
      />

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_220px]">
          <label className="relative block">
            <span className="sr-only">Buscar usuarios</span>
            <Search
              className="pointer-events-none absolute left-3 top-3 text-slate-400"
              size={17}
            />
            <input
              className="field-control pl-10"
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
              placeholder="Buscar por nombre o correo"
              value={search}
            />
          </label>
          <label>
            <span className="sr-only">Filtrar por rol</span>
            <select
              className="field-control"
              onChange={(event) => {
                setRole(event.target.value as RoleCode | '')
                setPage(1)
              }}
              value={role}
            >
              <option value="">Todos los roles</option>
              {roles.map((item) => (
                <option key={item} value={item}>
                  {ROLE_LABELS[item]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Filtrar por estado</span>
            <select
              className="field-control"
              onChange={(event) => {
                setState(event.target.value as UserState | '')
                setPage(1)
              }}
              value={state}
            >
              <option value="">Todos los estados</option>
              {states.map((item) => (
                <option key={item} value={item}>
                  {stateLabels[item]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="mt-3 text-xs text-slate-600">
          {total} cuenta{total === 1 ? '' : 's'} encontrada{total === 1 ? '' : 's'}
        </p>
      </section>

      {loading ? (
        <StatePanel
          description="Consultando cuentas y permisos vigentes."
          title="Cargando usuarios"
          tone="loading"
        />
      ) : error ? (
        <StatePanel
          action={
            <Button onClick={() => void load()} variant="outline">
              Reintentar
            </Button>
          }
          description={error}
          title="No fue posible cargar usuarios"
          tone="error"
        />
      ) : items.length === 0 ? (
        <StatePanel
          description="Ajuste los filtros o cree una cuenta administrada."
          title="No hay usuarios para mostrar"
        />
      ) : (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-4 py-3">Usuario</th>
                  <th className="px-4 py-3">Rol</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Último acceso</th>
                  <th className="px-4 py-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-50 text-cyan-700">
                          <User size={17} />
                        </span>
                        <div>
                          <p className="font-semibold text-slate-900">{item.nombre}</p>
                          <p className="text-xs text-slate-600">{item.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">{ROLE_LABELS[item.rol.codigo]}</td>
                    <td className="px-4 py-3">
                      <Badge tone={stateTones[item.estado]}>{stateLabels[item.estado]}</Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{shortDate(item.ultimoAccesoAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button onClick={() => setSelected(item)} size="sm" variant="outline">
                        Gestionar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
            <span>
              Página {page} de {pages}
            </span>
            <div className="flex gap-2">
              <Button
                disabled={page <= 1}
                onClick={() => setPage((value) => value - 1)}
                size="sm"
                variant="outline"
              >
                Anterior
              </Button>
              <Button
                disabled={page >= pages}
                onClick={() => setPage((value) => value + 1)}
                size="sm"
                variant="outline"
              >
                Siguiente
              </Button>
            </div>
          </div>
        </section>
      )}

      {createOpen && (
        <CreateUserDialog
          onClose={() => setCreateOpen(false)}
          onCreated={(result) => {
            setCreateOpen(false)
            setDelivery(result)
            void load()
          }}
        />
      )}
      {selected && actor && (
        <ManageUserDialog
          actorId={actor.id}
          onClose={() => setSelected(null)}
          onDelivery={(result) => {
            setSelected(null)
            setDelivery(result)
            void load()
          }}
          onUpdated={updated}
          user={selected}
        />
      )}
      {delivery && (
        <ActivationDeliveryDialog delivery={delivery} onClose={() => setDelivery(null)} />
      )}
    </div>
  )
}
