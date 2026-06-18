-- =============================================================
-- SPEC 13 (Migración B) — Seed de Sede Central
-- =============================================================
-- 1 sede (Sede Central), 17 áreas (orden 1–17) y 45 subáreas
-- (orden = segundo número del organigrama, p. ej. 6.2 -> 2).
-- Texto verbatim según el catálogo de referencia del spec, salvo
-- el ajuste "Y"->"y" en 15/15.1. Los textos "Omato", "Calastro" y
-- "Subgerencia," se dejan tal cual por decisión explícita.
--
-- Los UUID se generan en la base: las subáreas resuelven su area_id
-- por nombre con JOIN sobre VALUES (no se hardcodean IDs).

-- -------------------------------------------------------------
-- PASO 1: Sede
-- -------------------------------------------------------------

insert into sedes (nombre, orden) values ('Sede Central', 1);

-- -------------------------------------------------------------
-- PASO 2: Áreas (orden = número entero del organigrama)
-- -------------------------------------------------------------

insert into areas (sede_id, nombre, orden)
select s.id, v.nombre, v.orden
from sedes s
cross join (values
  ('Sala de Regidores', 1),
  ('Órgano de Control Institucional', 2),
  ('Procuraduría Pública Municipal', 3),
  ('Alcaldía', 4),
  ('Oficina de Secretaria General', 5),
  ('Gerencia Municipal', 6),
  ('Oficina de Gestión de Recursos Humanos', 7),
  ('Oficina de Administración', 8),
  ('Oficina de Asesoría Jurídica', 9),
  ('Oficina de Planeamiento Presupuesto y Racionalización', 10),
  ('Gerencia de Desarrollo Económico y Seguridad Ciudadana', 11),
  ('Gerencia de Gestión de Protección del Ambiente y Salubridad', 12),
  ('Gerencia de Desarrollo Social', 13),
  ('Gerencia de Transportes y Movilidad Urbana', 14),
  ('Gerencia de Desarrollo Urbano y Acondicionamiento Territorial', 15),
  ('Instituto Vial Provincial', 16),
  ('Agencia Municipal de Huacachina', 17)
) as v(nombre, orden)
where s.nombre = 'Sede Central';

-- -------------------------------------------------------------
-- PASO 3: Subáreas (orden = segundo número del organigrama)
-- -------------------------------------------------------------

insert into subareas (area_id, nombre, orden)
select a.id, v.subnombre, v.orden
from areas a
join sedes s on s.id = a.sede_id and s.nombre = 'Sede Central'
join (values
  -- 1. Sala de Regidores
  ('Sala de Regidores', 'Sala de Regidores', 1),
  -- 2. Órgano de Control Institucional
  ('Órgano de Control Institucional', 'Órgano de Control Institucional', 1),
  -- 3. Procuraduría Pública Municipal
  ('Procuraduría Pública Municipal', 'Procuraduría Pública Municipal', 1),
  -- 4. Alcaldía
  ('Alcaldía', 'Alcaldía', 1),
  -- 5. Oficina de Secretaria General
  ('Oficina de Secretaria General', 'Oficina de Secretaria General', 1),
  -- 6. Gerencia Municipal
  ('Gerencia Municipal', 'Gerencia Municipal', 1),
  ('Gerencia Municipal', 'Unidad de Ejecución Coactiva', 2),
  ('Gerencia Municipal', 'Unidad de Relaciones Públicas e Imagen Institucional', 3),
  ('Gerencia Municipal', 'Oficina de Integridad Institucional', 4),
  -- 7. Oficina de Gestión de Recursos Humanos
  ('Oficina de Gestión de Recursos Humanos', 'Oficina de Gestión de Recursos Humanos', 1),
  -- 8. Oficina de Administración
  ('Oficina de Administración', 'Oficina de Administración', 1),
  ('Oficina de Administración', 'Unidad de Tesorería', 2),
  ('Oficina de Administración', 'Unidad de Contabilidad', 3),
  ('Oficina de Administración', 'Unidad de Abastecimiento', 4),
  ('Oficina de Administración', 'Unidad de Control Patrimonial y Equipo Mecánico', 5),
  ('Oficina de Administración', 'Unidad de Tecnologías de Información', 6),
  -- 9. Oficina de Asesoría Jurídica
  ('Oficina de Asesoría Jurídica', 'Oficina de Asesoría Jurídica', 1),
  -- 10. Oficina de Planeamiento Presupuesto y Racionalización
  ('Oficina de Planeamiento Presupuesto y Racionalización', 'Oficina de Planeamiento Presupuesto y Racionalización', 1),
  ('Oficina de Planeamiento Presupuesto y Racionalización', 'Unidad de Presupuesto', 2),
  ('Oficina de Planeamiento Presupuesto y Racionalización', 'Unidad de Planeamiento, Programación e Inversiones', 3),
  ('Oficina de Planeamiento Presupuesto y Racionalización', 'Unidad de Racionalización y Modernización de la Gestión', 4),
  -- 11. Gerencia de Desarrollo Económico y Seguridad Ciudadana
  ('Gerencia de Desarrollo Económico y Seguridad Ciudadana', 'Gerencia de Desarrollo Económico y Seguridad Ciudadana', 1),
  ('Gerencia de Desarrollo Económico y Seguridad Ciudadana', 'Subgerencia de Turismo', 2),
  ('Gerencia de Desarrollo Económico y Seguridad Ciudadana', 'Subgerencia de Seguridad Ciudadana y Policía Municipal', 3),
  ('Gerencia de Desarrollo Económico y Seguridad Ciudadana', 'Subgerencia de Desarrollo Económico, Promoción Empresarial y Fiscalización', 4),
  ('Gerencia de Desarrollo Económico y Seguridad Ciudadana', 'Subgerencia de Gestión de Riesgo de Desastres', 5),
  -- 12. Gerencia de Gestión de Protección del Ambiente y Salubridad
  ('Gerencia de Gestión de Protección del Ambiente y Salubridad', 'Gerencia de Gestión de Protección del Ambiente y Salubridad', 1),
  ('Gerencia de Gestión de Protección del Ambiente y Salubridad', 'Subgerencia de Control Ambiental y Salubridad', 2),
  ('Gerencia de Gestión de Protección del Ambiente y Salubridad', 'Subgerencia, Parques y Jardines, Áreas Verdes y Omato', 3),
  ('Gerencia de Gestión de Protección del Ambiente y Salubridad', 'Subgerencia, Limpieza Pública', 4),
  -- 13. Gerencia de Desarrollo Social
  ('Gerencia de Desarrollo Social', 'Gerencia de Desarrollo Social', 1),
  ('Gerencia de Desarrollo Social', 'Subgerencia de Programas Sociales', 2),
  ('Gerencia de Desarrollo Social', 'Subgerencia de Promoción, Prevención de la Salud y Registro Civil', 3),
  ('Gerencia de Desarrollo Social', 'Subgerencia de Participación Ciudadana, Juventud, Educación Cultural y Deportes', 4),
  -- 14. Gerencia de Transportes y Movilidad Urbana
  ('Gerencia de Transportes y Movilidad Urbana', 'Gerencia de Transportes y Movilidad Urbana', 1),
  ('Gerencia de Transportes y Movilidad Urbana', 'Subgerencia de Transporte Movilidad Urbana y Seguridad Vial', 2),
  ('Gerencia de Transportes y Movilidad Urbana', 'Subgerencia de Fiscalización y Sanciones', 3),
  -- 15. Gerencia de Desarrollo Urbano y Acondicionamiento Territorial
  ('Gerencia de Desarrollo Urbano y Acondicionamiento Territorial', 'Gerencia de Desarrollo Urbano y Acondicionamiento Territorial', 1),
  ('Gerencia de Desarrollo Urbano y Acondicionamiento Territorial', 'Subgerencia de Obras Públicas', 2),
  ('Gerencia de Desarrollo Urbano y Acondicionamiento Territorial', 'Subgerencia de Supervisión y Liquidación de Obras', 3),
  ('Gerencia de Desarrollo Urbano y Acondicionamiento Territorial', 'Subgerencia de Asentamientos Humanos', 4),
  ('Gerencia de Desarrollo Urbano y Acondicionamiento Territorial', 'Subgerencia de Obras Privadas y Calastro', 5),
  ('Gerencia de Desarrollo Urbano y Acondicionamiento Territorial', 'Subgerencia de Estudios, Proyectos y Unidad de Formuladora', 6),
  -- 16. Instituto Vial Provincial
  ('Instituto Vial Provincial', 'Instituto Vial Provincial', 1),
  -- 17. Agencia Municipal de Huacachina
  ('Agencia Municipal de Huacachina', 'Agencia Municipal de Huacachina', 1)
) as v(area_nombre, subnombre, orden) on v.area_nombre = a.nombre;
