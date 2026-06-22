# Reunion Rodrigo - 2026-06-22

## Contexto

Reunion de avance para revisar la plataforma de produccion Arcadia con Rodrigo. La decision general fue priorizar eficiencia operativa, flujos simples y configuracion flexible por sobre estetica o automatizaciones prematuras.

## Decisiones De Producto

- El panel principal no debe acumular historiales de despacho. Debe mostrar produccion activa y productos listos para coordinar despacho; el historial vive en una vista separada con filtros.
- La prioridad de una orden depende exclusivamente de la fecha de entrega. No debe existir una prioridad manual que compita con esa regla.
- Los pedidos con varios productos se agrupan por un codigo comun de pedido, por ejemplo `LH2101`, manteniendo el avance individual de cada articulo.
- Las observaciones deben ser visibles sin ser invasivas. En tarjetas o filas principales debe aparecer un icono de alerta cuando una orden tenga notas relevantes.
- El stock debe distinguir ubicacion fisica: bodega y taller. La clasificacion por tienda no reemplaza esta ubicacion.
- Las alertas de stock bajo deben destacarse en rojo para reposicion inmediata.
- El ingreso de ordenes debe aceptar clientes particulares y empresas como texto libre. La tienda sigue siendo dato operativo, pero no debe sentirse como una seleccion rigida de cliente.
- Los codigos de venta, notas y presupuestos deben generarse de forma automatica y correlativa por serie, por ejemplo `LH01`, `LH02`.
- Se mantiene flexibilidad para medidas, materiales y productos personalizados.
- El boton de garantia se conserva para diferenciar reingresos por falla de ventas nuevas.
- La vista de trabajadores debe mostrar trabajos futuros para planificar carga semanal y abastecimiento, no solo el trabajo accionable inmediato.
- La IA en reportes debe esperar datos operativos confiables y enfocarse primero en cuellos de botella recurrentes.

## Acciones A Implementar

- Agregar filtros de tiempo al historial: mes seleccionado y ultimos 30 dias.
- Permitir agrupar y filtrar ordenes/productos por codigo comun de pedido en el panel principal.
- Agregar indicador visual de observaciones en tarjetas y tablas operativas.
- Ampliar inventario con ubicacion `bodega` / `taller`.
- Cambiar alertas de stock bajo a tratamiento rojo.
- Esperar ejemplo real de etiquetas enviado por Rodrigo.
- Crear boton y flujo de impresion de etiquetas personalizadas cuando exista el modelo.
- Ajustar formulario de orden para cliente libre y codigos correlativos automaticos.
- Eliminar prioridad manual de la interfaz y calcular urgencia desde fecha de entrega.
- Agregar vista de trabajos futuros al panel de trabajadores.
- Diseñar conversion automatica de medidas para estructuras internas complejas, partiendo por casos como sofa Chesterfield.
- Preparar analisis de cuellos de botella con IA despues de validar persistencia y calidad de datos.

## Notas De Implementacion

- La agrupacion por pedido no debe ocultar el estado individual de cada producto. Una misma referencia puede contener varios articulos en distintas etapas.
- La etiqueta debe replicar el formato operativo real que Rodrigo enviara; no inventar layout definitivo antes de recibir el ejemplo.
- Para medidas internas, conviene modelar reglas por producto/modelo antes de agregar IA. La conversion debe ser explicable y editable por el administrador.
- Mantener separados los modelos mentales de admin y taller. El trabajador necesita planificacion futura, pero no informacion comercial innecesaria.
