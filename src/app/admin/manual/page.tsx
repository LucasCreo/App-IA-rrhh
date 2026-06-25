'use client'

import { Printer } from 'lucide-react'

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
  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
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
      </Section>

      <Section title="2. Legajos de empleados">
        <p>El módulo de Legajos centraliza la información de todos los empleados de la organización.</p>
        <Sub title="Crear un nuevo empleado">
          <Steps items={[
            'Acceda a Legajos desde el menú lateral.',
            'Haga clic en Nuevo empleado.',
            'Complete el Paso 1: datos personales (nombre, apellido, CUIL, correo, teléfono).',
            'Complete el Paso 2: datos laborales (legajo, fecha de ingreso, categoría).',
            'Haga clic en Guardar.',
          ]} />
        </Sub>
        <Sub title="Editar un empleado">
          <p>Haga clic sobre el nombre del empleado en la lista. En la ficha del empleado podrá modificar sus datos, visualizar sus documentos, evaluaciones y formularios asignados.</p>
        </Sub>
        <Sub title="Exportar nómina">
          <p>En la lista de empleados, utilice el botón <strong>Exportar</strong> para descargar la nómina completa en formato Excel.</p>
        </Sub>
        <Sub title="Campos personalizados">
          <p>Puede definir campos adicionales para todos los empleados desde <strong>Configuración › Empleados</strong>.</p>
        </Sub>
        <Note>Solo los empleados con estado ACTIVO pueden iniciar sesión en el portal del empleado.</Note>
      </Section>

      <Section title="3. Documentos">
        <p>Permite cargar, organizar y gestionar los documentos asociados a cada empleado.</p>
        <Sub title="Cargar un documento individual">
          <Steps items={[
            'Acceda a Documentos.',
            'Haga clic en Cargar documento.',
            'Seleccione el empleado, el tipo de documento, el período y el archivo.',
            'Haga clic en Guardar.',
          ]} />
        </Sub>
        <Sub title="Carga masiva por lotes">
          <Steps items={[
            'Acceda a Documentos › Lotes.',
            'Cree un nuevo lote indicando nombre, período y tipo de documento.',
            'Arrastre o seleccione los archivos. El sistema intentará asociar cada archivo al empleado según el nombre del archivo.',
            'Revise las asignaciones y confirme.',
          ]} />
        </Sub>
        <Sub title="Estados de documento">
          <p><strong>Borrador:</strong> visible solo para administradores. <strong>Publicado:</strong> visible para el empleado. <strong>Firmado:</strong> el empleado ha confirmado la recepción.</p>
        </Sub>
        <Sub title="Tipos de documento">
          <p>Los tipos de documento se configuran en <strong>Configuración › Tipos de documento</strong>. Cada tipo puede requerir firma o solo descarga. Los tipos marcados como <em>protegidos</em> (ej. Recibo de Sueldo) no pueden ser eliminados.</p>
        </Sub>
      </Section>

      <Section title="4. Recibos de sueldo">
        <p>El módulo de Recibos permite cargar y distribuir recibos de haberes en forma masiva.</p>
        <Steps items={[
          'Acceda a Recibos desde el menú lateral.',
          'Cree un nuevo lote indicando el período (mes/año).',
          'Cargue los archivos PDF. Cada archivo debe corresponder a un empleado.',
          'El sistema publicará los recibos y los empleados podrán visualizarlos desde su portal.',
        ]} />
        <Note>Los recibos de sueldo son de tipo protegido: no pueden modificarse ni eliminarse una vez publicados.</Note>
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
          <p>Si el usuario vincula su cuenta de Google desde el portal del empleado, los eventos creados en la aplicación se reflejarán automáticamente en Google Calendar y viceversa (al recargar la página).</p>
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

      <Section title="8. Ausencias">
        <p>Gestión de solicitudes de ausencia y saldos de vacaciones de los empleados.</p>
        <Sub title="Aprobar o rechazar una solicitud">
          <Steps items={[
            'Acceda a Ausencias.',
            'Seleccione la solicitud pendiente.',
            'Revise la información (tipo, fechas, motivo, adjunto si corresponde).',
            'Haga clic en Aprobar o Rechazar e ingrese un comentario opcional.',
          ]} />
        </Sub>
        <Sub title="Gestionar saldos de vacaciones">
          <p>Acceda a la pestaña <strong>Saldos</strong> dentro de Ausencias. Puede editar los días totales de cada empleado para el año en curso.</p>
        </Sub>
        <Sub title="Tipos de ausencia">
          <p>Se configuran en <strong>Configuración › Ausencias</strong>. Cada tipo define si requiere aprobación y si descuenta del saldo de vacaciones.</p>
        </Sub>
      </Section>

      <Section title="9. Auditoría">
        <p>Registra todas las acciones relevantes realizadas por los usuarios del sistema: creación, modificación y eliminación de registros. Acceda desde el menú lateral en <strong>Auditoría</strong>. Los registros no pueden ser eliminados.</p>
      </Section>

      <Section title="10. Configuración">
        <Sub title="General">
          <p>Nombre y logo de la aplicación. Los cambios se reflejan en el sidebar de todos los usuarios.</p>
        </Sub>
        <Sub title="Empleados">
          <p>Define qué campos del legajo son visibles y cuáles son obligatorios. También permite crear campos personalizados adicionales.</p>
        </Sub>
        <Sub title="Tipos de documento">
          <p>Administra los tipos de documento disponibles al cargar archivos. Los tipos protegidos no pueden eliminarse.</p>
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
        <Sub title="Roles y permisos">
          <p>Define roles personalizados y asigna permisos granulares a cada rol.</p>
        </Sub>
      </Section>

      <Section title="11. Gestión de usuarios">
        <p>Acceda a <strong>Configuración › Usuarios</strong> para crear cuentas de acceso al sistema, asignar roles y vincular cada usuario con un empleado de la nómina.</p>
        <Note>Solo los usuarios con rol de administrador completo pueden gestionar otros usuarios y sus permisos.</Note>
      </Section>

      <div className="mt-10 pt-4 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-400 print:mt-6">
        Manual de Administrador — Sistema RRHH
      </div>
    </div>
  )
}
