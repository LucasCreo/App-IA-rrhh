'use client'

import { Printer, ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="print:break-before-page">
      <h2 className="text-xl font-bold text-green-800 dark:text-green-400 border-b border-green-200 dark:border-green-900 pb-2 mb-4 mt-8 first:mt-0">
        {title}
      </h2>
      <div className="space-y-3 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
        {children}
      </div>
    </section>
  )
}

function Sub({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">{title}</h3>
      <div className="pl-3 border-l-2 border-gray-200 dark:border-gray-700 space-y-1">{children}</div>
    </div>
  )
}

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="list-decimal list-inside space-y-1 pl-1">
      {items.map((s, i) => <li key={i}>{s}</li>)}
    </ol>
  )
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded px-3 py-2 text-xs text-yellow-800 dark:text-yellow-300">
      {children}
    </p>
  )
}

export default function ManualAdminPage() {
  const router = useRouter()
  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <button
        onClick={() => router.back()}
        className="print:hidden inline-flex items-center gap-2 px-4 py-2 rounded-md border border-input bg-background text-sm font-medium hover:bg-muted transition-colors mb-6"
      >
        <ArrowLeft size={15} /> Volver
      </button>
      {/* Header */}
      <div className="flex items-start justify-between mb-8 print:mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Manual de Administrador</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Sistema de Gestión de Recursos Humanos</p>
        </div>
        <button
          onClick={() => window.print()}
          className="print:hidden flex items-center gap-2 px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <Printer size={15} />
          Imprimir / Guardar PDF
        </button>
      </div>

      <Section title="1. Acceso al sistema">
        <p>Para ingresar al sistema, navegue a la página de inicio de sesión e introduzca su dirección de correo electrónico y contraseña. Las credenciales son asignadas por el administrador del sistema.</p>
        <Sub title="Cierre de sesión">
          <p>Haga clic en el ícono de cierre de sesión ubicado en la parte inferior del menú lateral.</p>
        </Sub>
        <Sub title="Cambio de contraseña">
          <p>Acceda a <strong>Mi perfil</strong> desde el menú lateral y actualice su contraseña en la sección correspondiente.</p>
        </Sub>
        <Sub title="Recuperar contraseña">
          <p>Si olvidó su contraseña, use la opción <strong>¿Olvidaste tu contraseña?</strong> debajo del campo de contraseña en el login. Ingresando su usuario o email recibirá un mail con un link válido por 1 hora para restablecerla.</p>
        </Sub>
      </Section>

      <Section title="2. Usuarios, legajos y organigrama">
        <p>Un <strong>usuario</strong> representa una cuenta de acceso al sistema; un <strong>legajo</strong> son los datos laborales y personales asociados a esa persona. Ambos van siempre acoplados: al crear un usuario se genera automáticamente su legajo, y al eliminarlo se elimina también el legajo (y viceversa).</p>
        <Note>Excepción: el usuario de soporte <code>admin@empresa.com</code> es el único que puede existir sin legajo. Ese usuario ve toda la información sin restricciones y no forma parte del organigrama.</Note>

        <Sub title="Crear un nuevo empleado">
          <Steps items={[
            'Acceda a Personal desde el menú lateral.',
            'Haga clic en Nuevo empleado.',
            'Complete el Paso 1: acceso (email y contraseña inicial).',
            'Complete el Paso 2: datos personales (nombre, apellido, CUIL, teléfono).',
            'Complete el Paso 3: datos laborales (legajo, fecha de ingreso, categoría).',
            'Al finalizar, el usuario ya puede ingresar al portal. Para personalizar sus permisos, diríjase a Configuración › Usuarios.',
          ]} />
        </Sub>

        <Sub title="Importar empleados">
          <p>Desde la lista de Personal, use <strong>Importar</strong> para cargar múltiples empleados desde un archivo Excel o CSV. Puede descargar una plantilla desde el mismo diálogo. Cada fila crea usuario + legajo en un solo paso.</p>
        </Sub>

        <Sub title="Editar y ver ficha de empleado">
          <p>Haga clic sobre el nombre del empleado en la lista. En la ficha podrá modificar sus datos, visualizar documentos, evaluaciones, formularios asignados y ausencias.</p>
        </Sub>

        <Sub title="Exportar nómina">
          <p>Utilice el botón <strong>Exportar</strong> en la lista para descargar la nómina completa en Excel.</p>
        </Sub>

        <Sub title="Eliminar un empleado">
          <p>Al intentar eliminar, si el empleado tiene información asociada (documentos, ausencias, evaluaciones, etc.), el sistema muestra el detalle de qué existe. Puede cancelar o forzar la eliminación en cascada escribiendo el texto de confirmación. La eliminación borra también el usuario y los archivos físicos del empleado.</p>
        </Sub>

        <Sub title="Organigrama">
          <p>Disponible como pestaña dentro de <strong>Personal › Organigrama</strong>. Muestra la jerarquía por usuario. Para configurar quiénes reportan a alguien, use el botón <strong>Subordinados</strong> desde Configuración › Usuarios: seleccione a los usuarios que están un orden jerárquico por debajo. El sistema previene ciclos.</p>
          <p>El organigrama determina el <strong>alcance de datos</strong>: cada usuario con legajo ve solo su propio legajo y el de sus descendientes, aprueba solicitudes solo de sus descendientes, y sus propias solicitudes se auto-aprueban si está en la cima del organigrama.</p>
        </Sub>

        <Sub title="Campos personalizados">
          <p>Puede definir campos adicionales para todos los legajos desde <strong>Configuración › Empleados</strong>.</p>
        </Sub>

        <Note>Solo los empleados con estado ACTIVO pueden iniciar sesión en el portal del empleado.</Note>
      </Section>

      <Section title="3. Documentos">
        <p>Permite cargar, organizar y gestionar todos los documentos de los empleados, incluidos los recibos de sueldo publicados desde el módulo de Recibos.</p>

        <Sub title="Cargar un documento individual">
          <Steps items={[
            'Acceda a Documentos.',
            'Haga clic en Cargar documento.',
            'Seleccione el empleado, el tipo de documento, el período y el archivo.',
            'Haga clic en Guardar.',
          ]} />
          <p className="text-xs text-gray-500 mt-1">El tipo &quot;Recibo de Sueldo&quot; no aparece en este diálogo: los recibos se cargan por lotes desde el módulo Recibos.</p>
        </Sub>

        <Sub title="Filtros">
          <p>La lista incluye un panel desplegable con filtros por tipo de documento, empleado, categoría, período y nombre de archivo. Un indicador muestra la cantidad de filtros activos y el botón <strong>Limpiar</strong> los resetea todos.</p>
        </Sub>

        <Sub title="Ver, reemplazar o eliminar">
          <p>Cada fila permite visualizar el PDF, reemplazarlo por una nueva versión (el documento vuelve a estado Borrador) o eliminarlo. Los recibos vinculados a un lote también pueden gestionarse individualmente desde el detalle del lote.</p>
        </Sub>

        <Sub title="Estados de documento">
          <p><strong>Borrador:</strong> visible solo para administradores. <strong>Enviado a firma:</strong> visible para el empleado, pendiente de firma. <strong>Firmado:</strong> el empleado confirmó recepción. <strong>Rechazado:</strong> el empleado rechazó el documento.</p>
        </Sub>

        <Sub title="Tipos de documento">
          <p>Se configuran en <strong>Configuración › Tipos de documento</strong>. Cada tipo puede requerir firma o solo descarga. Los tipos marcados como <em>protegidos</em> (ej. Recibo de Sueldo) no pueden ser eliminados.</p>
        </Sub>
      </Section>

      <Section title="4. Recibos de sueldo">
        <p>Módulo para cargar y distribuir recibos en forma masiva mediante lotes.</p>

        <Sub title="Crear un lote">
          <Steps items={[
            'Acceda a Recibos desde el menú lateral.',
            'Haga clic en Nuevo lote e indique nombre y período (mes/año).',
            'Marque los empleados que deben incluirse. Use la casilla superior para seleccionar/deseleccionar todos, o marque casillas individuales.',
            'Suba los PDFs. El sistema lee el contenido de cada archivo y detecta automáticamente el legajo del empleado.',
            'Revise las coincidencias (verde: matcheado, amarillo: sin detección). Ajuste manualmente los archivos sin asignar.',
            'Confirme la creación del lote.',
          ]} />
          <Note>La detección funciona con PDFs de texto seleccionable (no imágenes escaneadas) que contengan el campo &quot;Legajo&quot; seguido de un número.</Note>
        </Sub>

        <Sub title="Editar el roster de un lote">
          <p>Desde el detalle del lote, use <strong>Editar empleados</strong> para agregar o quitar personas del lote sin necesidad de recrearlo.</p>
        </Sub>

        <Sub title="Gestionar recibos individuales">
          <p>En el detalle del lote, cada recibo tiene acciones para <strong>ver</strong>, <strong>reemplazar</strong> el PDF (icono de lápiz) o <strong>eliminarlo</strong>. Reemplazar deja el recibo nuevamente en estado Borrador.</p>
        </Sub>

        <Sub title="Publicación">
          <p>Al publicar el lote, los recibos pasan a estado Enviado a firma y quedan disponibles para los empleados desde su portal. También aparecen listados en el módulo Documentos.</p>
        </Sub>
      </Section>

      <Section title="5. Calendario">
        <p>Permite gestionar eventos de la organización y visualizar el calendario de los empleados.</p>
        <Sub title="Crear un evento">
          <Steps items={[
            'Acceda a Calendario.',
            'Haga clic sobre un día en el calendario o en el botón Nuevo evento.',
            'Complete el título, fechas, tipo de evento y seleccione los empleados asignados.',
            'Haga clic en Guardar.',
          ]} />
        </Sub>
        <Sub title="Tipos de evento">
          <p>Se configuran en <strong>Configuración › Calendario</strong>. Cada tipo define si puede ser creado por administradores, por empleados, y qué color se muestra en el calendario.</p>
        </Sub>
        <Sub title="Sincronización con Google Calendar">
          <p>Al vincular una cuenta de Google desde el perfil, los eventos se sincronizan en ambas direcciones:</p>
          <ul className="list-disc list-inside space-y-0.5 mt-1">
            <li>Al crear un evento en la app, se pushea al Google Calendar del creador y de todos los empleados asignados que tengan Google conectado.</li>
            <li>Al aprobar una ausencia, se pushea al calendar del empleado y al del admin que aprueba.</li>
            <li>El botón <strong>Sincronizar Google</strong> del calendario también trae los eventos creados directamente en Google Calendar hacia la app.</li>
          </ul>
        </Sub>
      </Section>

      <Section title="6. Evaluaciones">
        <p>Permite diseñar plantillas de evaluación y gestionar rondas de evaluación para los empleados.</p>
        <Sub title="Crear una plantilla">
          <Steps items={[
            'Acceda a Configuración › Evaluaciones.',
            'Haga clic en Nueva plantilla.',
            'Defina el nombre y agregue los criterios (nombre, etiqueta, tipo de respuesta).',
            'Guarde la plantilla.',
          ]} />
        </Sub>
        <Sub title="Crear una ronda de evaluación">
          <Steps items={[
            'Acceda a Evaluaciones.',
            'Haga clic en Nueva ronda.',
            'Ingrese el nombre y una descripción opcional. La descripción es visible para el empleado cuando ve su evaluación, útil para dar contexto u objetivos de la ronda.',
            'Seleccione la plantilla y asigne los empleados a evaluar.',
            'La ronda quedará en estado ACTIVA hasta que se cierre manualmente.',
          ]} />
        </Sub>
        <Sub title="Cargar resultados">
          <p>En cada ronda, haga clic sobre un empleado para ingresar los valores de cada criterio y un comentario opcional. Marque la evaluación como completada cuando finalice.</p>
        </Sub>
      </Section>

      <Section title="7. Formularios">
        <p>Permite crear formularios personalizados y asignarlos a los empleados para que los completen desde su portal.</p>
        <Sub title="Crear una plantilla de formulario">
          <Steps items={[
            'Acceda a Configuración › Formularios.',
            'Haga clic en Nueva plantilla.',
            'Agregue los campos definiendo nombre, etiqueta, tipo (texto, número, fecha, select, etc.) y si es requerido.',
            'Indique para cada campo si lo completa el empleado o el administrador.',
          ]} />
        </Sub>
        <Sub title="Asignar un formulario">
          <Steps items={[
            'Acceda a Formularios.',
            'Haga clic en Nueva asignación.',
            'Seleccione la plantilla, asigne los empleados y establezca una fecha límite opcional.',
            'Complete los campos que corresponden al administrador antes de publicar.',
          ]} />
        </Sub>
        <Sub title="Revisar respuestas">
          <p>En la lista de asignaciones, haga clic en una asignación para ver el estado de las respuestas de cada empleado.</p>
        </Sub>
      </Section>

      <Section title="8. Ausencias y solicitudes">
        <p>Gestión de solicitudes de ausencia, solicitudes de modificación de datos y solicitudes generales de los empleados.</p>

        <Sub title="Aprobación jerárquica">
          <p>Solo el usuario que está por encima en el organigrama puede aprobar o rechazar las solicitudes de un empleado. Si abre una solicitud de un empleado que no está bajo su jerarquía, verá el mensaje <em>&quot;Fuera de tu jerarquía&quot;</em> y no podrá aprobar ni rechazar.</p>
          <p>Los usuarios que están en la cima del organigrama (sin superiores) auto-aprueban sus propias solicitudes en el momento de crearlas.</p>
        </Sub>

        <Sub title="Aprobar o rechazar una solicitud">
          <Steps items={[
            'Acceda a Ausencias (o al módulo de solicitudes correspondiente).',
            'Seleccione la solicitud pendiente.',
            'Revise la información (tipo, fechas, motivo, adjunto si corresponde).',
            'Haga clic en Aprobar o Rechazar e ingrese un comentario opcional.',
          ]} />
        </Sub>

        <Sub title="Gestionar saldos de vacaciones">
          <p>En la pestaña <strong>Saldos</strong> dentro de Ausencias, puede editar los días totales de cada empleado para el año en curso.</p>
        </Sub>

        <Sub title="Tipos de ausencia">
          <p>Se configuran en <strong>Configuración › Ausencias</strong>. Cada tipo define si requiere aprobación y si descuenta del saldo de vacaciones.</p>
        </Sub>
      </Section>

      <Section title="9. Portal interno (publicaciones)">
        <p>Sección donde los empleados pueden leer y comentar publicaciones internas de la organización. Desde el panel de admin puede crear posts, moderar comentarios y personalizar qué secciones del portal quedan visibles para los empleados.</p>
      </Section>

      <Section title="10. Auditoría">
        <p>Registra todas las acciones relevantes realizadas por los usuarios del sistema: creación, modificación y eliminación de registros. Acceda desde el menú lateral en <strong>Auditoría</strong>. Los registros no pueden ser eliminados.</p>
      </Section>

      <Section title="11. Gestión de usuarios y permisos">
        <p>Acceda a <strong>Configuración › Usuarios</strong> para gestionar las cuentas de acceso al sistema.</p>

        <Sub title="Permisos por usuario">
          <p>Los permisos se asignan directamente a cada usuario (no existen roles ni plantillas). Use el botón <strong>Permisos</strong> en la fila del usuario para marcar/desmarcar los permisos individuales (gestionar empleados, documentos, ausencias, calendario, etc.).</p>
          <p className="text-xs text-gray-500 mt-1">Un usuario sin ningún permiso marcado tiene acceso total (útil solo para el usuario de soporte). Para restringir, marque explícitamente qué puede hacer.</p>
        </Sub>

        <Sub title="Subordinados (organigrama)">
          <p>El botón <strong>Subordinados</strong> permite marcar qué usuarios reportan a esta persona. Esto arma el organigrama y define el alcance de datos y aprobación de solicitudes.</p>
        </Sub>

        <Sub title="Ir al legajo">
          <p>Cada fila incluye un enlace directo al legajo del usuario, ya que usuario y legajo están siempre asociados.</p>
        </Sub>

        <Sub title="Cambiar contraseña de un usuario">
          <p>Desde la fila del usuario, use <strong>Cambiar contraseña</strong> para asignar una nueva clave manualmente.</p>
        </Sub>

        <Sub title="Eliminar un usuario">
          <p>Al eliminar un usuario se elimina también su legajo. Si tiene información asociada (documentos cargados, posts, comentarios, ausencias, etc.), el sistema lista qué existe y pide confirmación explícita antes de forzar el borrado en cascada.</p>
        </Sub>
      </Section>

      <Section title="12. Configuración">
        <Sub title="General">
          <p>Nombre y logo de la aplicación, configuración SMTP para envío de emails. El botón <strong>Probar SMTP</strong> envía un email de prueba a su dirección para validar las credenciales.</p>
        </Sub>
        <Sub title="Empleados">
          <p>Define qué campos del legajo son visibles y cuáles son obligatorios. También permite crear campos personalizados adicionales.</p>
        </Sub>
        <Sub title="Categorías">
          <p>Administra las categorías laborales (nombre y descripción). Las categorías se asignan a cada empleado desde su legajo.</p>
        </Sub>
        <Sub title="Tipos de documento">
          <p>Administra los tipos de documento disponibles al cargar archivos. Los tipos protegidos (ej. Recibo de Sueldo) no pueden eliminarse.</p>
        </Sub>
        <Sub title="Solicitudes">
          <p>Define los tipos de solicitud que los empleados pueden enviar desde su portal.</p>
        </Sub>
        <Sub title="Calendario">
          <p>Configura los tipos de evento: nombre, color, y si pueden ser creados por administradores o empleados.</p>
        </Sub>
        <Sub title="Evaluaciones">
          <p>Gestión de plantillas de evaluación y sus criterios.</p>
        </Sub>
        <Sub title="Formularios">
          <p>Gestión de plantillas de formulario y sus campos.</p>
        </Sub>
        <Sub title="Ausencias">
          <p>Configura los tipos de ausencia disponibles para los empleados.</p>
        </Sub>
        <Sub title="Firma electrónica">
          <p>Configura el proveedor externo de firma electrónica (URL, API key y parámetros adicionales).</p>
        </Sub>
        <Sub title="Usuarios">
          <p>Gestión de cuentas, permisos por usuario y organigrama (subordinados). Ver sección 11.</p>
        </Sub>
      </Section>

      <Section title="13. Notificaciones por email">
        <p>El sistema envía notificaciones automáticas por correo electrónico en las siguientes acciones:</p>
        <ul className="list-disc list-inside space-y-0.5 mt-1">
          <li><strong>Nueva solicitud de ausencia:</strong> recibe mail el superior jerárquico del solicitante.</li>
          <li><strong>Aprobación/rechazo de ausencia:</strong> recibe mail el empleado con el comentario del administrador.</li>
          <li><strong>Solicitud de modificación de datos:</strong> recibe mail el superior jerárquico.</li>
          <li><strong>Solicitud de documento:</strong> recibe mail el superior jerárquico.</li>
          <li><strong>Recuperación de contraseña:</strong> el usuario recibe un link válido por 1 hora para restablecer su clave.</li>
        </ul>
        <Note>Los envíos son automáticos y no bloquean el uso de la aplicación. Si un mail no llega, verifique la carpeta de correo no deseado o pruebe la conexión SMTP desde Configuración › General.</Note>
      </Section>

      <div className="mt-10 pt-4 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-400 print:mt-6">
        Manual de Administrador — Sistema RRHH
      </div>
    </div>
  )
}
