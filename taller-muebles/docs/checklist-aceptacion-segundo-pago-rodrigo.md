# Checklist de aceptación funcional — segundo pago

**Proyecto:** ARCADIA  
**Revisor:** Rodrigo  
**Fecha de revisión:** ____________________  
**Ambiente / URL:** ____________________  
**Versión o commit revisado:** ____________________

## Objetivo

Esta checklist sirve para confirmar que ARCADIA permite ejecutar el flujo operacional acordado de principio a fin y que está en condiciones de aprobar el segundo pago.

Una pantalla visible no basta para aprobar una prueba. Cada acción debe guardar los datos, mostrar un resultado entendible, mantenerse después de recargar la página y respetar el rol del usuario.

## Cómo registrar el resultado

Marcar una opción por prueba:

- `[ ] OK`: funciona completamente y conserva los datos.
- `[ ] FALLA`: no funciona, pierde información o entrega un resultado incorrecto.
- `[ ] N/A`: Rodrigo confirma que no aplica a esta etapa del proyecto.

En **Evidencia / observación**, anotar el código o cliente de prueba y, si falla, qué ocurrió. Adjuntar captura sólo cuando ayude a reproducir el problema; no usar datos reales de clientes.

## Criterio para aprobar el segundo pago

El segundo pago puede aprobarse cuando:

- Todas las pruebas marcadas como **BLOQUEANTE** están en `OK` o Rodrigo las acepta expresamente como `N/A`.
- Existe al menos un pedido ficticio probado de punta a punta: creación → producción → calidad → listo para entrega → agenda → entrega/historial.
- Los datos siguen presentes después de cerrar sesión, volver a ingresar y recargar la web.
- No hay errores que impidan trabajar, pérdida de datos, acceso indebido entre roles ni exposición de información sensible.
- Las fallas menores restantes están anotadas y acordadas con responsable y fecha.

---

## 0. Preparación de la revisión

Usar datos ficticios. No probar con información personal ni ventas reales.

- [ ] **BLOQUEANTE — Ambiente correcto:** la URL corresponde al ambiente que se entregará para uso y no a una copia local del desarrollador.
- [ ] **BLOQUEANTE — Usuarios disponibles:** existen cuentas de prueba para administrador, supervisor/manager y trabajador/operator.
- [ ] **BLOQUEANTE — Áreas disponibles:** existe al menos un trabajador asignado a cada área productiva que se probará.
- [ ] Hay un archivo JPG o PNG pequeño y un PDF de prueba para adjuntos.
- [ ] Se acuerda un pedido de prueba principal, por ejemplo cliente `PRUEBA RODRIGO`, con fecha de entrega cercana.
- [ ] Se acuerda un segundo pedido para probar cancelación y un tercer pedido para bloqueo.

**Evidencia / observación:**  
______________________________________________________________________________

## 1. Acceso, sesión y navegación

- [ ] **BLOQUEANTE — Inicio de sesión admin:** un administrador con credenciales válidas entra y llega al panel administrativo.
- [ ] **BLOQUEANTE — Rechazo de acceso:** credenciales inválidas no permiten entrar y muestran un mensaje claro.
- [ ] **BLOQUEANTE — Sesión persistente:** al recargar una página interna, el usuario continúa autenticado.
- [ ] **BLOQUEANTE — Cerrar sesión:** al salir, las rutas internas dejan de ser accesibles y vuelven al login.
- [ ] **BLOQUEANTE — Separación de experiencias:** un trabajador entra directamente al panel de taller y no puede abrir módulos administrativos.
- [ ] Un administrador puede navegar por Inicio, Comercial, Estructuras, Agenda, Listos para entrega, Stock, Proveedores, Reportes, Historial, Usuarios y Configuración.
- [ ] El botón Atrás del navegador y los enlaces internos no dejan la aplicación en una pantalla rota.
- [ ] Una URL inexistente o un registro que no existe muestra un mensaje comprensible y una salida segura.

**Evidencia / observación:**  
______________________________________________________________________________

## 2. Crear un pedido de Muebles La Reina (LR)

- [ ] **BLOQUEANTE — Abrir ingreso:** desde administración se puede abrir `Nueva orden`.
- [ ] **BLOQUEANTE — Cliente libre:** permite ingresar una persona o empresa como texto libre.
- [ ] **BLOQUEANTE — Datos comerciales:** permite completar contacto, RUT, dirección, comuna, teléfono y correo cuando correspondan.
- [ ] **BLOQUEANTE — Documento:** permite seleccionar el tipo correcto (nota de venta, cotización, orden de compra o garantía).
- [ ] **BLOQUEANTE — Más de un producto:** se pueden agregar dos o más productos al mismo pedido, cada uno con producto/modelo, material, color, cantidad y precio.
- [ ] **BLOQUEANTE — Código común:** los productos del mismo pedido quedan asociados al mismo código de pedido, pero conservan código y avance individual.
- [ ] **BLOQUEANTE — Código correlativo:** el sistema genera el número/código correspondiente sin duplicarlo.
- [ ] **BLOQUEANTE — Valores:** subtotal, descuento, total, abono y saldo quedan correctos.
- [ ] **BLOQUEANTE — Planificación:** permite definir fecha de ingreso, fecha de entrega y responsable según las reglas vigentes.
- [ ] Garantía exige la información u observación definida en Configuración.
- [ ] Se puede agregar una observación y luego se ve en el detalle y mediante el indicador correspondiente en las vistas operativas.
- [ ] Se puede adjuntar el archivo de prueba permitido.
- [ ] **BLOQUEANTE — Validaciones:** no deja guardar sin los campos obligatorios, con correo inválido, cantidad menor a 1, montos negativos o abono superior al total.
- [ ] **BLOQUEANTE — Guardado:** al confirmar, se crean todos los productos una sola vez y se abre un resultado entendible.
- [ ] **BLOQUEANTE — Persistencia:** al recargar y volver al panel, el pedido mantiene todos sus datos y productos.

**Pedido / códigos creados:** ____________________  
**Evidencia / observación:**  
______________________________________________________________________________

## 3. Crear un ingreso simple de Leather House (LH)

- [ ] **BLOQUEANTE — Flujo diferenciado:** al elegir LH aparece el ingreso productivo simple y no obliga a completar el documento comercial de LR.
- [ ] **BLOQUEANTE — Datos productivos:** permite guardar cliente, producto, material/color, fechas, responsable y observaciones aplicables.
- [ ] **BLOQUEANTE — Código LH:** el sistema genera un código válido y no repetido.
- [ ] **BLOQUEANTE — Visibilidad:** el ingreso guardado aparece en producción administrativa y en la cola del área que corresponda.
- [ ] Al recargar, los datos del ingreso LH siguen presentes.

**Pedido / código creado:** ____________________  
**Evidencia / observación:**  
______________________________________________________________________________

## 4. Panel administrativo y detalle del pedido

- [ ] **BLOQUEANTE — Producción activa:** el pedido nuevo aparece en el panel sin mezclar pedidos entregados o cancelados.
- [ ] **BLOQUEANTE — Búsqueda:** se puede encontrar por código, código común, cliente o producto.
- [ ] Los filtros disponibles entregan resultados coherentes y se pueden limpiar.
- [ ] Los productos de un mismo pedido se agrupan sin ocultar su avance individual.
- [ ] La prioridad visual se calcula desde la fecha de entrega y no compite con una prioridad manual.
- [ ] Un pedido con observaciones presenta un indicador discreto y visible.
- [ ] Los contadores/KPIs cambian de forma coherente al crear, bloquear, completar o cancelar pedidos.
- [ ] **BLOQUEANTE — Detalle:** al abrir el pedido se ven datos comerciales, fechas, valores, etapas, observaciones, adjuntos y actividad disponibles.
- [ ] **BLOQUEANTE — Edición:** se puede editar un dato permitido; al guardar, cambia en detalle, tabla y documento sin duplicar el pedido.
- [ ] Cancelar la edición no modifica la información existente.

**Evidencia / observación:**  
______________________________________________________________________________

## 5. Flujo del trabajador en taller

Repetir esta sección con al menos dos áreas distintas. Si el flujo definitivo incluye Estructura, En blanco, Corte, Costura, Tapicería, Calidad o Despacho, probar todas las áreas habilitadas.

- [ ] **BLOQUEANTE — Cola por área:** cada trabajador ve sólo los pedidos relacionados con sus áreas autorizadas.
- [ ] **BLOQUEANTE — Privacidad operacional:** el trabajador ve sólo la información necesaria para fabricar y no puede editar precios, pagos, cliente u otros datos administrativos.
- [ ] **BLOQUEANTE — Trabajo actual:** la cola diferencia claramente lo accionable ahora.
- [ ] **BLOQUEANTE — Trabajo futuro:** la cola muestra próximos trabajos para planificar carga y materiales, sin permitir adelantarse indebidamente.
- [ ] La búsqueda y los filtros del taller permiten encontrar el pedido correcto.
- [ ] El detalle de taller muestra código, producto, material/color, cantidad, entrega, indicaciones y estado de la etapa.
- [ ] **BLOQUEANTE — Iniciar:** el trabajador autorizado inicia su etapa y ésta queda `En proceso` con fecha/usuario registrados.
- [ ] **BLOQUEANTE — Terminar:** el trabajador autorizado termina su etapa y el siguiente paso queda disponible según la secuencia configurada.
- [ ] **BLOQUEANTE — Actualización admin:** administración ve el avance sin tener que recrear ni editar el pedido.
- [ ] Deshacer inicio devuelve la etapa al estado correcto sin corromper las etapas anteriores.
- [ ] Reabrir una etapa terminada funciona sólo cuando el rol y las reglas lo permiten.
- [ ] Un trabajador no puede operar una etapa que pertenece únicamente a otra área.
- [ ] Dos clics rápidos o una recarga no registran el mismo cambio dos veces ni dejan estados contradictorios.
- [ ] Los botones muestran confirmación o mensaje de éxito/error y no quedan cargando indefinidamente.

**Áreas probadas:** ____________________  
**Evidencia / observación:**  
______________________________________________________________________________

## 6. Bloqueo, desbloqueo y observaciones productivas

- [ ] **BLOQUEANTE — Motivo requerido:** cuando la regla está activa, no se puede bloquear sin un motivo válido.
- [ ] **BLOQUEANTE — Bloquear:** al ingresar un motivo, la etapa y el pedido muestran el bloqueo de forma clara.
- [ ] **BLOQUEANTE — Visibilidad admin:** administración ve la alerta y el motivo del bloqueo.
- [ ] **BLOQUEANTE — Persistencia:** el bloqueo continúa visible después de recargar y volver a iniciar sesión.
- [ ] **BLOQUEANTE — Resolver:** quitar el bloqueo devuelve la etapa a un estado operable y conserva trazabilidad del cambio.
- [ ] Admin/manager puede agregar o actualizar una nota de etapa cuando tiene permiso.
- [ ] Una observación general editada desde el detalle se refleja en las vistas correspondientes.

**Evidencia / observación:**  
______________________________________________________________________________

## 7. Comentarios, adjuntos y trazabilidad

- [ ] Se puede agregar un comentario válido al pedido y aparece con autor y fecha.
- [ ] Un comentario vacío o demasiado largo es rechazado con un mensaje claro.
- [ ] **BLOQUEANTE — Subir adjunto:** se puede cargar una imagen o PDF permitido y aparece en el pedido correcto.
- [ ] **BLOQUEANTE — Abrir adjunto:** el archivo se puede abrir o descargar estando autorizado.
- [ ] Un archivo no permitido o excesivo es rechazado sin romper la pantalla.
- [ ] Un trabajador sólo accede a adjuntos de pedidos que puede ver.
- [ ] **BLOQUEANTE — Auditoría:** creación, edición, cambios productivos, bloqueo y cierre generan actividad trazable con fecha y actor cuando corresponda.

**Evidencia / observación:**  
______________________________________________________________________________

## 8. Lista de estructuras

- [ ] El pedido activo aparece en la Lista de estructuras cuando corresponde.
- [ ] **BLOQUEANTE — Especificación:** se puede guardar una ficha/especificación libre vinculada al pedido.
- [ ] Se puede adjuntar un plano, foto o PDF y volver a abrirlo.
- [ ] **BLOQUEANTE — Estados:** la solicitud pasa por Pendiente/Solicitada → En confección → Completada.
- [ ] El panel principal refleja la señal de estructura solicitada y el check de estructura terminada.
- [ ] Los filtros de la lista muestran correctamente pendientes, en proceso y terminadas.
- [ ] El cambio se mantiene después de recargar y queda ligado al pedido correcto.

**Evidencia / observación:**  
______________________________________________________________________________

## 9. Calidad, pedido listo y agenda de entrega

- [ ] **BLOQUEANTE — Calidad:** la última etapa productiva llega a revisión de calidad según la configuración.
- [ ] **BLOQUEANTE — Regla de cierre:** no se puede cerrar el pedido antes de cumplir la revisión requerida.
- [ ] **BLOQUEANTE — Fin de producción:** al aprobar calidad/finalizar producción, el pedido sale de trabajo activo y aparece en `Listos para entrega`.
- [ ] **BLOQUEANTE — Agendar entrega:** desde Listos o Agenda se agenda el pedido en una fecha, bloque AM/PM y horario válido.
- [ ] Si el pedido contiene varios productos, la entrega común se identifica sin perder el detalle de cada producto.
- [ ] La agenda muestra la entrega en el día y bloque correctos.
- [ ] Se puede editar fecha, bloque, horario y notas de una entrega pendiente.
- [ ] No acepta horarios incoherentes ni datos obligatorios vacíos.
- [ ] Se puede crear una tarea interna independiente de una entrega.
- [ ] Se puede completar una tarea y se puede cancelar un elemento pendiente con confirmación.
- [ ] Los filtros por fecha, tipo y bloque horario muestran resultados coherentes.

**Evidencia / observación:**  
______________________________________________________________________________

## 10. Cierre, entrega, cancelación e historial

- [ ] **BLOQUEANTE — Cerrar:** al confirmar el cierre, el pedido queda completado/entregado una sola vez.
- [ ] **BLOQUEANTE — Sale de activos:** el pedido cerrado ya no aparece en producción activa.
- [ ] **BLOQUEANTE — Historial:** aparece en Historial con sus datos, etapas, comentarios y trazabilidad disponibles.
- [ ] El historial filtra correctamente por mes seleccionado y últimos 30 días.
- [ ] La búsqueda del historial encuentra por código, cliente o producto.
- [ ] **BLOQUEANTE — Cancelar:** el pedido secundario puede cancelarse sólo después de una confirmación explícita.
- [ ] El pedido cancelado sale de activos, permanece en historial y no se elimina físicamente.
- [ ] Un pedido completado o cancelado no ofrece edición operacional normal.

**Evidencia / observación:**  
______________________________________________________________________________

## 11. Documentos comerciales y pagos

- [ ] **BLOQUEANTE — Clasificación:** Comercial separa correctamente notas de venta, cotizaciones, órdenes de compra, garantías e ingresos productivos aplicables.
- [ ] **BLOQUEANTE — Documento agrupado:** un documento con varios productos muestra todos los productos del mismo código común.
- [ ] Datos de cliente, productos, fechas, valores, condiciones de entrega y observaciones coinciden con la orden.
- [ ] **BLOQUEANTE — Impresión:** la vista imprimible abre correctamente y no corta información esencial en la previsualización.
- [ ] **BLOQUEANTE — Nuevo abono:** se registra un abono con fecha, monto y medio de pago.
- [ ] **BLOQUEANTE — Cálculos:** total pagado, saldo y porcentaje se recalculan correctamente y no permiten exceder el total.
- [ ] Corregir un abono actualiza los cálculos y deja trazabilidad de la corrección.
- [ ] Anular/eliminar un abono exige confirmación y no hace desaparecer la historia financiera sin registro trazable.
- [ ] Una cotización no se comporta como una venta pagada cuando no corresponde.
- [ ] Al recargar, documento, pagos y saldo mantienen los mismos valores.

**Evidencia / observación:**  
______________________________________________________________________________

## 12. Seguimiento para el cliente

- [ ] **BLOQUEANTE — Crear enlace:** sólo un administrador puede crear el enlace público de seguimiento.
- [ ] El enlace se puede copiar y abrir en una ventana privada sin iniciar sesión.
- [ ] **BLOQUEANTE — Información mínima:** el cliente ve código/pedido, productos, avance y fecha de entrega, sin precios, pagos, notas internas, responsables ni datos sensibles.
- [ ] Los avances visibles cambian de forma coherente al completar etapas.
- [ ] Crear un enlace nuevo invalida el anterior.
- [ ] Revocar el enlace impide volver a consultar el pedido.
- [ ] Un enlace vencido, revocado o inventado muestra `Enlace no disponible` y no filtra información.

**Evidencia / observación:**  
______________________________________________________________________________

## 13. Stock y movimientos

- [ ] Se puede registrar un material con nombre, categoría, unidad, stock inicial, mínimo, tienda/general y ubicación física Bodega/Taller.
- [ ] **BLOQUEANTE — Entrada:** una entrada aumenta el disponible por la cantidad correcta.
- [ ] **BLOQUEANTE — Salida:** una salida disminuye el disponible por la cantidad correcta y no permite un resultado inválido.
- [ ] **BLOQUEANTE — Ajuste:** un ajuste deja el valor esperado y registra el motivo.
- [ ] Cada movimiento aparece en el historial con material, tipo, cantidad, nota y fecha.
- [ ] **BLOQUEANTE — Stock bajo:** al quedar bajo el mínimo, el material muestra una alerta roja clara.
- [ ] Los filtros o vistas distinguen Bodega y Taller correctamente.
- [ ] Desactivar un material requiere confirmación, lo retira de operación normal y conserva sus movimientos históricos.
- [ ] Al recargar, el stock y sus movimientos mantienen los valores.

**Evidencia / observación:**  
______________________________________________________________________________

## 14. Proveedores

- [ ] Se puede crear un proveedor con datos de contacto, productos y observaciones.
- [ ] Se puede editar un proveedor y ver el cambio después de recargar.
- [ ] Campos inválidos muestran un error sin crear duplicados accidentales.
- [ ] Desactivar un proveedor requiere confirmación y no borra su registro histórico.
- [ ] Un usuario sin permiso de gestión no puede crear, editar ni desactivar proveedores.

**Evidencia / observación:**  
______________________________________________________________________________

## 15. Usuarios, roles, áreas y permisos

- [ ] **BLOQUEANTE — Crear trabajador:** admin crea un usuario trabajador y le asigna una o más áreas habilitadas.
- [ ] **BLOQUEANTE — Acceso trabajador:** el usuario creado inicia sesión y recibe sólo sus colas y acciones permitidas.
- [ ] Editar nombre, rol o áreas cambia el acceso en la siguiente sesión/recarga según corresponda.
- [ ] **BLOQUEANTE — Admin:** puede gestionar órdenes, usuarios y configuración.
- [ ] **BLOQUEANTE — Manager:** puede ver administración y sólo editar órdenes/stock cuando las reglas lo autorizan.
- [ ] **BLOQUEANTE — Operator:** no puede entrar por URL directa a pantallas administrativas ni ejecutar acciones de otras áreas.
- [ ] **BLOQUEANTE — Viewer:** puede consultar panel, historial y reportes sin botones ni acciones de edición.
- [ ] Desactivar un usuario impide un nuevo acceso y no borra la trazabilidad de acciones anteriores.
- [ ] No se puede crear el mismo correo dos veces ni guardar un trabajador sin un área válida.

**Evidencia / observación:**  
______________________________________________________________________________

## 16. Configuración del sistema

- [ ] Sólo admin puede modificar Configuración; manager y viewer la ven sin edición.
- [ ] Se guardan identidad, zona horaria, jornada y días laborables.
- [ ] Se pueden habilitar/deshabilitar etapas y definir sus días objetivo sin romper pedidos existentes.
- [ ] Se guardan las reglas de pasos paralelos, aprobación de calidad y cierre automático.
- [ ] Se guardan las validaciones de órdenes y umbrales de alertas.
- [ ] **BLOQUEANTE — Permisos aplicados:** cambiar permisos de manager u operator modifica realmente las acciones disponibles y no sólo los botones visibles.
- [ ] La configuración persiste después de recargar y volver a iniciar sesión.
- [ ] Al terminar la prueba se restauran las reglas operacionales acordadas.

**Evidencia / observación:**  
______________________________________________________________________________

## 17. Reportes

- [ ] Reportes abre sin errores y usa los mismos pedidos que el panel operacional.
- [ ] Los totales de activas, urgentes, atrasadas, bloqueadas y próximas entregas coinciden con una comprobación manual simple.
- [ ] La carga por proceso coincide con las etapas actuales de los pedidos.
- [ ] Stock crítico coincide con los materiales bajo mínimo.
- [ ] Operarios por área y tiempos productivos no muestran usuarios inactivos como activos.
- [ ] Los estados vacíos se entienden y no muestran cifras inventadas.
- [ ] No se presentan recomendaciones de IA como hechos si aún no existen datos suficientes.

**Evidencia / observación:**  
______________________________________________________________________________

## 18. Móvil, tablet, estabilidad y seguridad visible

Probar al menos en un computador y en el teléfono o tablet que se usará en el taller.

- [ ] **BLOQUEANTE — Taller móvil:** cola, detalle y botones se leen y operan sin zoom, elementos cortados ni desplazamiento horizontal obligatorio.
- [ ] Los botones táctiles importantes son fáciles de pulsar y no están demasiado juntos.
- [ ] Administración sigue siendo utilizable en escritorio y las tablas tienen una alternativa legible en pantalla pequeña.
- [ ] **BLOQUEANTE — Sin pérdida de datos:** recargar después de cada flujo crítico conserva el último estado confirmado.
- [ ] **BLOQUEANTE — Error controlado:** al perder conexión o provocar un error, aparece un mensaje y no se muestra un éxito falso.
- [ ] Volver a enviar un formulario no duplica pedidos, pagos, tareas, movimientos ni comentarios.
- [ ] No aparecen claves, datos técnicos sensibles ni trazas internas en la pantalla o URL.
- [ ] Los adjuntos no se pueden abrir sin sesión o permiso, salvo el contenido mínimo expresamente publicado en Seguimiento.
- [ ] La navegación y acciones principales responden en un tiempo razonable para el uso diario de Rodrigo y el taller.

**Dispositivo/navegador probado:** ____________________  
**Evidencia / observación:**  
______________________________________________________________________________

---

## Recorrido mínimo obligatorio de punta a punta

Esta secuencia resume la demostración que no puede faltar:

- [ ] Admin inicia sesión.
- [ ] Crea un pedido LR con dos productos, valores, abono, fecha, observación y adjunto.
- [ ] Confirma códigos únicos, documento comercial y aparición en producción.
- [ ] Trabajador del área 1 inicia y termina su etapa.
- [ ] Trabajador del área 2 bloquea con motivo, admin ve el bloqueo y luego se resuelve.
- [ ] Las demás áreas completan la secuencia y calidad aprueba.
- [ ] El pedido aparece en Listos para entrega.
- [ ] Admin agenda la entrega.
- [ ] Admin registra/corrige un abono y confirma el saldo.
- [ ] Admin genera el enlace de seguimiento y verifica la vista pública mínima.
- [ ] Admin cierra el pedido.
- [ ] El pedido sale de activos, permanece en Historial y conserva toda la trazabilidad.
- [ ] Se cierra sesión, se vuelve a entrar y el resultado continúa guardado.

**Código del pedido usado:** ____________________

## Fallas encontradas y acuerdo

| Nº | Código de prueba / módulo | Descripción de la falla | Severidad (bloqueante/menor) | Responsable | Fecha acordada | Estado |
|---:|---|---|---|---|---|---|
| 1 | | | | | | |
| 2 | | | | | | |
| 3 | | | | | | |
| 4 | | | | | | |
| 5 | | | | | | |

## Aceptación de Rodrigo

Marcar una alternativa:

- [ ] **APROBADO:** los flujos bloqueantes funcionan y apruebo el segundo pago.
- [ ] **APROBADO CON OBSERVACIONES:** apruebo el segundo pago y las fallas menores quedan registradas arriba.
- [ ] **NO APROBADO:** existen fallas bloqueantes; se requiere una nueva revisión después de corregirlas.

**Observaciones finales:**  
______________________________________________________________________________  
______________________________________________________________________________

**Nombre:** ____________________  
**Firma o confirmación:** ____________________  
**Fecha:** ____________________
