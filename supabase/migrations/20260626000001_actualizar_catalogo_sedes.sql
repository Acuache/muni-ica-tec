-- =============================================================
-- Actualización del catálogo de ubicación (Sede → Área → Subárea)
-- =============================================================
-- Reemplaza por completo el seed de SPEC 13 (que solo tenía "Sede Central")
-- por el organigrama vigente: 11 sedes con sus áreas y subáreas.
--
-- Seguro de hacer wipe-and-reseed: `profiles` guarda sede/area/subarea como
-- TEXTO (modelo snapshot, sin FK) y ninguna otra tabla referencia el catálogo
-- (solo el encadenamiento interno areas->sedes, subareas->areas). Por tanto
-- vaciar y recargar estas tablas no rompe integridad referencial; un perfil
-- cuyos nombres ya no existan en el catálogo simplemente re-elige al editar.
--
-- Texto verbatim del organigrama entregado, salvo la normalización heredada
-- de la conjunción suelta "Y" -> "y" (misma decisión que el seed de SPEC 13)
-- en las dos entradas de Sede Geranios. Se conservan tal cual otros textos del
-- original ("Omato", "Calastro", "Pública", "Subgerencia," con coma).
--
-- Los UUID se generan en la base: áreas y subáreas resuelven su padre por
-- nombre con JOIN sobre VALUES (no se hardcodean IDs).

-- -------------------------------------------------------------
-- PASO 1: Vaciar el catálogo (las 3 tablas a la vez; sin FKs externas)
-- -------------------------------------------------------------

truncate table sedes, areas, subareas;

-- -------------------------------------------------------------
-- PASO 2: Sedes (orden = posición en el organigrama)
-- -------------------------------------------------------------

insert into sedes (nombre, orden) values
  ('Sede Central', 1),
  ('Sede Exipai', 2),
  ('Sede Chiclayo', 3),
  ('Sede Geranios', 4),
  ('Sede Polideportivo', 5),
  ('Sede Campo Ferial', 6),
  ('Sede de Huacachina', 7),
  ('Sede Matías Manzanilla', 8),
  ('Sede Archivo Municipal', 9),
  ('Sede Calle Callao', 10),
  ('Sede Maurtua', 11);

-- -------------------------------------------------------------
-- PASO 3: Áreas (orden = número del organigrama dentro de su sede)
-- -------------------------------------------------------------

insert into areas (sede_id, nombre, orden)
select s.id, v.nombre, v.orden
from sedes s
join (values
  -- Sede Central
  ('Sede Central', 'Sala de Regidores', 1),
  ('Sede Central', 'Procuraduría Pública Municipal', 2),
  ('Sede Central', 'Alcaldía', 3),
  ('Sede Central', 'Oficina de Secretaria General', 4),
  ('Sede Central', 'Unidad de Relaciones Pública e Imagen Institucional', 5),
  ('Sede Central', 'Oficina de Integridad Institucional', 6),
  ('Sede Central', 'Gerencia Municipal', 7),
  ('Sede Central', 'Oficina de Gestión de Recursos Humanos', 8),
  ('Sede Central', 'Oficina de Administración', 9),
  ('Sede Central', 'Oficina de Asesoría Jurídica', 10),
  ('Sede Central', 'Oficina de Planeamiento Presupuesto y Racionalización', 11),
  -- Sede Exipai
  ('Sede Exipai', 'Gerencia de Transportes y Movilidad Urbana', 1),
  -- Sede Chiclayo
  ('Sede Chiclayo', 'Gerencia de Desarrollo Social', 1),
  ('Sede Chiclayo', 'Órgano de Control Institucional', 2),
  -- Sede Geranios
  ('Sede Geranios', 'Gerencia de Desarrollo Urbano y Acondicionamiento Territorial', 1),
  ('Sede Geranios', 'Subgerencia de Promoción, Prevención de la Salud y Registro Civil', 2),
  ('Sede Geranios', 'Unidad de Control Patrimonial y Equipo Mecánico', 3),
  ('Sede Geranios', 'Biblioteca Municipal', 4),
  -- Sede Polideportivo
  ('Sede Polideportivo', 'Subgerencia de Participación Ciudadana Juventud, Educación Cultura y Deporte', 1),
  -- Sede Campo Ferial
  ('Sede Campo Ferial', 'Subgerencia de Seguridad Ciudadana y Policía Municipal', 1),
  ('Sede Campo Ferial', 'Gerencia de Gestión de Protección del Ambiente y Salubridad', 2),
  -- Sede de Huacachina
  ('Sede de Huacachina', 'Área de Huacachina', 1),
  -- Sede Matías Manzanilla
  ('Sede Matías Manzanilla', 'Área Vaso de Leche', 1),
  -- Sede Archivo Municipal
  ('Sede Archivo Municipal', 'Área Archivo Municipal', 1),
  -- Sede Calle Callao
  ('Sede Calle Callao', 'Área de Limpieza Pública', 1),
  -- Sede Maurtua
  ('Sede Maurtua', 'Área de Matadero Municipal', 1)
) as v(sede_nombre, nombre, orden) on v.sede_nombre = s.nombre;

-- -------------------------------------------------------------
-- PASO 4: Subáreas (orden = segundo número del organigrama)
-- El JOIN acota por sede + área porque un nombre de área podría repetirse
-- entre sedes; así cada subárea cae bajo el área correcta.
-- -------------------------------------------------------------

insert into subareas (area_id, nombre, orden)
select a.id, v.subnombre, v.orden
from areas a
join sedes s on s.id = a.sede_id
join (values
  -- Sede Central
  ('Sede Central', 'Sala de Regidores', 'Sala de Regidores', 1),
  ('Sede Central', 'Procuraduría Pública Municipal', 'Procuraduría Pública Municipal', 1),
  ('Sede Central', 'Alcaldía', 'Alcaldía', 1),
  ('Sede Central', 'Oficina de Secretaria General', 'Oficina de Secretaria General', 1),
  ('Sede Central', 'Unidad de Relaciones Pública e Imagen Institucional', 'Unidad de Relaciones Pública e Imagen Institucional', 1),
  ('Sede Central', 'Oficina de Integridad Institucional', 'Oficina de Integridad Institucional', 1),
  ('Sede Central', 'Gerencia Municipal', 'Gerencia Municipal', 1),
  ('Sede Central', 'Oficina de Gestión de Recursos Humanos', 'Oficina de Gestión de Recursos Humanos', 1),
  ('Sede Central', 'Oficina de Gestión de Recursos Humanos', 'Área de remuneraciones', 2),
  ('Sede Central', 'Oficina de Gestión de Recursos Humanos', 'Área de Escalafón', 3),
  ('Sede Central', 'Oficina de Administración', 'Oficina de Administración', 1),
  ('Sede Central', 'Oficina de Administración', 'Unidad de Tesorería', 2),
  ('Sede Central', 'Oficina de Administración', 'Unidad de Contabilidad', 3),
  ('Sede Central', 'Oficina de Administración', 'Unidad de Abastecimiento', 4),
  ('Sede Central', 'Oficina de Administración', 'Unidad de Tecnologías de Información', 5),
  ('Sede Central', 'Oficina de Asesoría Jurídica', 'Oficina de Asesoría Jurídica', 1),
  ('Sede Central', 'Oficina de Planeamiento Presupuesto y Racionalización', 'Oficina de Planeamiento Presupuesto y Racionalización', 1),
  ('Sede Central', 'Oficina de Planeamiento Presupuesto y Racionalización', 'Unidad de Presupuesto', 2),
  ('Sede Central', 'Oficina de Planeamiento Presupuesto y Racionalización', 'Unidad de Planeamiento, Programación e Inversiones', 3),
  ('Sede Central', 'Oficina de Planeamiento Presupuesto y Racionalización', 'Unidad de Racionalización y Modernización de la Gestión', 4),
  -- Sede Exipai
  ('Sede Exipai', 'Gerencia de Transportes y Movilidad Urbana', 'Gerencia de Transportes y Movilidad Urbana', 1),
  ('Sede Exipai', 'Gerencia de Transportes y Movilidad Urbana', 'Subgerencia de Transporte Movilidad Urbana y Seguridad Vial', 2),
  ('Sede Exipai', 'Gerencia de Transportes y Movilidad Urbana', 'Subgerencia de Fiscalización y Sanciones', 3),
  ('Sede Exipai', 'Gerencia de Transportes y Movilidad Urbana', 'Subgerencia de Gestión de Riesgo de Desastres', 4),
  -- Sede Chiclayo
  ('Sede Chiclayo', 'Gerencia de Desarrollo Social', 'Gerencia de Desarrollo Social', 1),
  ('Sede Chiclayo', 'Gerencia de Desarrollo Social', 'Subgerencia de Programas Sociales', 2),
  ('Sede Chiclayo', 'Gerencia de Desarrollo Social', 'Área de OMAPED', 3),
  ('Sede Chiclayo', 'Gerencia de Desarrollo Social', 'Área de DEMUNA', 4),
  ('Sede Chiclayo', 'Órgano de Control Institucional', 'Órgano de Control Institucional', 1),
  -- Sede Geranios
  ('Sede Geranios', 'Gerencia de Desarrollo Urbano y Acondicionamiento Territorial', 'Gerencia de Desarrollo Urbano y Acondicionamiento Territorial', 1),
  ('Sede Geranios', 'Gerencia de Desarrollo Urbano y Acondicionamiento Territorial', 'Subgerencia de Obras Públicas', 2),
  ('Sede Geranios', 'Gerencia de Desarrollo Urbano y Acondicionamiento Territorial', 'Subgerencia de Supervisión y Liquidación de Obras', 3),
  ('Sede Geranios', 'Gerencia de Desarrollo Urbano y Acondicionamiento Territorial', 'Subgerencia de Asentamientos Humanos', 4),
  ('Sede Geranios', 'Gerencia de Desarrollo Urbano y Acondicionamiento Territorial', 'Subgerencia de Obras Privadas y Calastro', 5),
  ('Sede Geranios', 'Gerencia de Desarrollo Urbano y Acondicionamiento Territorial', 'Subgerencia de Estudios, Proyectos y Unidad de Formuladora', 6),
  ('Sede Geranios', 'Subgerencia de Promoción, Prevención de la Salud y Registro Civil', 'Subgerencia de Promoción, Prevención de la Salud y Registro Civil', 1),
  ('Sede Geranios', 'Subgerencia de Promoción, Prevención de la Salud y Registro Civil', 'Subgerencia de Desarrollo Económico, Promoción Empresarial y Fiscalización', 2),
  ('Sede Geranios', 'Unidad de Control Patrimonial y Equipo Mecánico', 'Unidad de Control Patrimonial y Equipo Mecánico', 1),
  ('Sede Geranios', 'Biblioteca Municipal', 'Biblioteca Municipal', 1),
  -- Sede Polideportivo
  ('Sede Polideportivo', 'Subgerencia de Participación Ciudadana Juventud, Educación Cultura y Deporte', 'Subgerencia de Participación Ciudadana Juventud, Educación Cultura y Deporte', 1),
  -- Sede Campo Ferial
  ('Sede Campo Ferial', 'Subgerencia de Seguridad Ciudadana y Policía Municipal', 'Subgerencia de Seguridad Ciudadana y Policía Municipal', 1),
  ('Sede Campo Ferial', 'Gerencia de Gestión de Protección del Ambiente y Salubridad', 'Gerencia de Gestión de Protección del Ambiente y Salubridad', 1),
  ('Sede Campo Ferial', 'Gerencia de Gestión de Protección del Ambiente y Salubridad', 'Subgerencia de Control Ambiental y Salubridad', 2),
  ('Sede Campo Ferial', 'Gerencia de Gestión de Protección del Ambiente y Salubridad', 'Subgerencia, Parques y Jardines, Áreas Verdes y Omato', 3),
  ('Sede Campo Ferial', 'Gerencia de Gestión de Protección del Ambiente y Salubridad', 'Subgerencia, Limpieza Pública', 4),
  -- Sede de Huacachina
  ('Sede de Huacachina', 'Área de Huacachina', 'Huacachina', 1),
  -- Sede Matías Manzanilla
  ('Sede Matías Manzanilla', 'Área Vaso de Leche', 'Vaso de Leche', 1),
  -- Sede Archivo Municipal
  ('Sede Archivo Municipal', 'Área Archivo Municipal', 'Archivo Municipal', 1),
  -- Sede Calle Callao
  ('Sede Calle Callao', 'Área de Limpieza Pública', 'Limpieza Pública', 1),
  -- Sede Maurtua
  ('Sede Maurtua', 'Área de Matadero Municipal', 'Matadero Municipal', 1)
) as v(sede_nombre, area_nombre, subnombre, orden)
  on v.sede_nombre = s.nombre and v.area_nombre = a.nombre;
