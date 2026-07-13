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

export default function ManualEmpleadoPage() {
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Manual de Empleado</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Portal del Empleado — Sistema de Gestión de Recursos Humanos</p>
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
        <p>Para ingresar al portal, navegue a la dirección del sistema en su navegador e introduzca su correo electrónico y contraseña. Sus credenciales son proporcionadas por el área de Recursos Humanos.</p>
        <Sub title="Cierre de sesión">
          <p>Haga clic en el ícono de cierre de sesión ubicado en la parte inferior del menú lateral, a la derecha de su nombre.</p>
        </Sub>
        <Sub title="Recuperar contraseña">
          <p>Si olvidó su contraseña, haga clic en <strong>¿Olvidaste tu contraseña?</strong> debajo del campo de contraseña en la pantalla de inicio de sesión. Ingrese su usuario o email registrado y recibirá un mail con un link válido por 1 hora para elegir una nueva contraseña.</p>
        </Sub>
        <Note>Si sigue sin poder ingresar después de recuperar su contraseña, comuníquese con el área de Recursos Humanos.</Note>
      </Section>

      <Section title="2. Inicio — Panel principal">
        <p>Al ingresar al sistema, verá su panel de inicio con un resumen de su situación actual:</p>
        <ul className="list-disc list-inside space-y-1 pl-1">
          <li><strong>Documentos pendientes de firma:</strong> documentos que requieren su confirmación.</li>
          <li><strong>Formularios pendientes:</strong> formularios asignados que aún no ha completado.</li>
          <li><strong>Solicitudes pendientes:</strong> solicitudes enviadas que están en proceso de revisión.</li>
          <li><strong>Próximas ausencias:</strong> ausencias aprobadas en los próximos días.</li>
        </ul>
        <p>Haga clic en cualquier indicador para ir directamente al módulo correspondiente.</p>
      </Section>

      <Section title="3. Recibos de sueldo">
        <p>En esta sección puede visualizar y descargar sus recibos de haberes.</p>
        <Steps items={[
          'Acceda a Recibos desde el menú lateral.',
          'Verá la lista de recibos disponibles ordenados por período.',
          'Haga clic en el ícono de descarga para guardar el recibo en su dispositivo.',
          'Si el recibo requiere confirmación de recepción, haga clic en Confirmar recepción.',
        ]} />
        <Note>Los recibos son publicados por el área de Recursos Humanos. Si no visualiza un recibo esperado, consulte con su área.</Note>
      </Section>

      <Section title="4. Documentos">
        <p>Permite visualizar los documentos que el área de Recursos Humanos ha puesto a su disposición, como constancias, certificaciones y comunicaciones.</p>
        <Sub title="Ver y descargar un documento">
          <Steps items={[
            'Acceda a Documentos desde el menú lateral.',
            'Utilice los filtros de tipo y período para encontrar el documento deseado.',
            'Haga clic en el documento para descargarlo.',
          ]} />
        </Sub>
        <Sub title="Solicitar un documento">
          <Steps items={[
            'Haga clic en Solicitar documento.',
            'Seleccione el tipo de solicitud y complete los campos requeridos.',
            'Haga clic en Enviar. Recibirá el documento una vez que sea procesado.',
          ]} />
        </Sub>
        <Sub title="Firmar un documento">
          <p>Si un documento requiere su firma, aparecerá con el estado <strong>Pendiente de firma</strong>. Ábralo y haga clic en <strong>Firmar</strong> para confirmar su recepción electrónica.</p>
        </Sub>
      </Section>

      <Section title="5. Calendario">
        <p>Visualice los eventos de la organización y gestione sus eventos personales.</p>
        <Sub title="Ver el calendario">
          <p>Acceda a Calendario desde el menú lateral. Puede navegar entre meses con las flechas de navegación y cambiar entre vista mensual y lista.</p>
        </Sub>
        <Sub title="Crear un evento personal">
          <Steps items={[
            'Haga clic sobre un día en el calendario o en el botón Nuevo evento.',
            'Complete el título, las fechas y seleccione el tipo de evento.',
            'Haga clic en Guardar.',
          ]} />
          <p className="text-xs text-gray-500 mt-1">Solo puede crear eventos de los tipos habilitados para empleados por el administrador.</p>
        </Sub>
        <Sub title="Sincronización con Google Calendar">
          <Steps items={[
            'Acceda a Mi perfil desde el menú lateral.',
            'En la sección Google Calendar, haga clic en Conectar con Google.',
            'Autorice el acceso cuando el navegador lo solicite.',
            'A partir de ese momento, los eventos se sincronizarán automáticamente.',
          ]} />
        </Sub>
        <Note>Los eventos creados por el área de Recursos Humanos que le hayan sido asignados aparecerán automáticamente en su calendario.</Note>
      </Section>

      <Section title="6. Ausencias">
        <p>Permite solicitar ausencias (vacaciones, licencias, etc.) y consultar su saldo de días disponibles.</p>
        <Sub title="Solicitar una ausencia">
          <Steps items={[
            'Acceda a Ausencias desde el menú lateral.',
            'Haga clic en Nueva solicitud.',
            'Seleccione el tipo de ausencia, las fechas de inicio y fin, e ingrese el motivo (opcional).',
            'Si el tipo de ausencia lo requiere, adjunte el comprobante correspondiente (certificado médico, etc.).',
            'Haga clic en Enviar solicitud.',
          ]} />
        </Sub>
        <Sub title="Seguimiento de solicitudes">
          <p>En la lista de ausencias verá el estado de cada solicitud:</p>
          <ul className="list-disc list-inside space-y-0.5 mt-1">
            <li><strong>Pendiente:</strong> en espera de revisión por Recursos Humanos.</li>
            <li><strong>Aprobada:</strong> la solicitud fue aceptada.</li>
            <li><strong>Rechazada:</strong> la solicitud fue denegada. Puede ver el motivo haciendo clic en la solicitud.</li>
          </ul>
          <p className="mt-2">Cuando Recursos Humanos apruebe o rechace su solicitud, recibirá un mail automático con el resultado y el comentario del administrador (si lo hubo).</p>
        </Sub>
        <Sub title="Saldo de vacaciones">
          <p>En la parte superior de la pantalla de Ausencias se muestra su saldo de días de vacaciones disponibles para el año en curso.</p>
        </Sub>
        <Note>Las ausencias aprobadas que afectan el saldo de vacaciones descuentan días hábiles (lunes a viernes) automáticamente.</Note>
      </Section>

      <Section title="7. Formularios">
        <p>El área de Recursos Humanos puede asignarle formularios para que los complete. Recibirá una notificación en su panel de inicio cuando haya formularios pendientes.</p>
        <Steps items={[
          'Acceda a Formularios desde el menú lateral (si está habilitado) o desde el panel de inicio.',
          'Haga clic en el formulario pendiente.',
          'Complete todos los campos requeridos.',
          'Haga clic en Enviar. Una vez enviado, no podrá modificar las respuestas.',
        ]} />
      </Section>

      <Section title="8. Mi perfil">
        <p>Acceda a su perfil haciendo clic en su nombre o avatar en la parte inferior del menú lateral.</p>
        <Sub title="Actualizar foto de perfil">
          <Steps items={[
            'En Mi perfil, haga clic sobre su foto o iniciales.',
            'Seleccione una imagen desde su dispositivo.',
            'La foto se actualizará automáticamente.',
          ]} />
        </Sub>
        <Sub title="Cambiar contraseña">
          <Steps items={[
            'En Mi perfil, localice la sección Cambiar contraseña.',
            'Ingrese su contraseña actual y la nueva contraseña.',
            'Confirme la nueva contraseña y haga clic en Guardar.',
          ]} />
        </Sub>
        <Sub title="Solicitar modificación de datos">
          <p>Si alguno de sus datos personales o laborales es incorrecto, puede enviar una solicitud de modificación desde Mi perfil. El área de Recursos Humanos revisará y actualizará la información.</p>
        </Sub>
        <Sub title="Modo claro / oscuro">
          <p>Utilice el ícono de sol/luna en la parte inferior del menú lateral para alternar entre el tema claro y oscuro según su preferencia.</p>
        </Sub>
      </Section>

      <div className="mt-10 pt-4 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-400 print:mt-6">
        Manual de Empleado — Sistema RRHH
      </div>
    </div>
  )
}
