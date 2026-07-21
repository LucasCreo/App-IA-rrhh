import { toast } from 'sonner'

interface ApiErrorPayload {
  error?: string
  code?: string
  field?: string
}

/**
 * Parsea una response fallida (json o texto) y devuelve el mensaje + code opcional.
 */
export async function parseApiError(res: Response): Promise<ApiErrorPayload> {
  try {
    const data = await res.json()
    return {
      error: typeof data?.error === 'string' ? data.error : `Error ${res.status}`,
      code: typeof data?.code === 'string' ? data.code : undefined,
      field: typeof data?.field === 'string' ? data.field : undefined,
    }
  } catch {
    return { error: `Error ${res.status}` }
  }
}

/**
 * Muestra el error con un toast contextual. Si el `code` es conocido,
 * agrega una acción con CTA para resolverlo.
 */
export function showApiError(payload: ApiErrorPayload, navigate?: (href: string) => void) {
  const msg = payload.error ?? 'Error inesperado'

  if (payload.code === 'SIGNATURE_NOT_CONFIGURED' || payload.code === 'SIGNATURE_INCOMPLETE') {
    toast.error(msg, {
      description: 'Ingresá al panel de configuración para completar los datos del proveedor.',
      duration: 8000,
      action: navigate
        ? { label: 'Configurar firma', onClick: () => navigate('/admin/configuracion?tab=firma') }
        : undefined,
    })
    return
  }

  if (payload.code === 'GOOGLE_NOT_CONNECTED') {
    toast.error(msg, {
      description: 'Conectá tu cuenta de Google desde tu perfil para habilitar la sincronización.',
      duration: 8000,
      action: navigate
        ? { label: 'Ir a mi perfil', onClick: () => navigate('/empleado/perfil') }
        : undefined,
    })
    return
  }

  toast.error(msg)
}

/** Atajo: parsea + muestra en una sola llamada. */
export async function handleApiError(res: Response, navigate?: (href: string) => void): Promise<ApiErrorPayload> {
  const payload = await parseApiError(res)
  showApiError(payload, navigate)
  return payload
}
