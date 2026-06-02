# NetIQ Assessment Platform

Aplicacion web para sistematizar assessments tecnicos de infraestructura Cisco, enfocada inicialmente en Enterprise Networking y Datacenter Networking.

## MVP incluido

- Dashboard central para ver, crear, editar, abrir y borrar multiples assessments.
- Crear cliente y assessment en la experiencia principal.
- Definir alcance de evaluacion mediante formulario.
- Cargar inventario objetivo del cliente con hostname, IP de gestion, serial, modelo, plataforma, rol, sitio y prioridad.
- Generar SOW preliminar en base al alcance seleccionado.
- Generar scripts de levantamiento con marcadores por dispositivo.
- Subir data obtenida `.txt`, `.log` o `.zip`.
- Parsear salidas Cisco iniciales:
  - `show version`
  - `show inventory`
  - `show cdp neighbors detail`
  - `show lldp neighbors detail`
  - `show interfaces status`
  - `show running-config`
- Extraer inventario, interfaces, vecinos y rol sugerido.
- Generar hallazgos preliminares siempre con evidencia y confianza.
- Ejecutar evaluaciones por ambito: topologia, configuracion, seguridad, lifecycle, operaciones y logs.
- Mostrar progreso de evaluacion por ambito y evaluacion completa.
- Agrupar hallazgos por ambito y mostrar matriz de riesgo/impacto.
- Revisar vigencia tecnologica alternando vistas HW/SW.
- Validar, editar o descartar hallazgos por un arquitecto.
- Exportar matriz de hallazgos en Excel.
- Generar documento editable de hallazgos en Word.
- Persistencia PostgreSQL/Prisma por snapshot JSON de assessment completo.
- Worker Python inicial para procesamiento separado.

## Stack

- Frontend: Next.js, React, TypeScript
- UI: Tailwind CSS con componentes locales estilo shadcn/ui
- Backend: API routes de Next.js
- Base de datos: PostgreSQL via Prisma
- Worker: Python CLI en `worker/python/parse_cisco.py`
- Export: Excel y Word mediante documentos OpenXML generados localmente

## Primer arranque

```bash
npm install
npm run dev
```

Abrir `http://localhost:3000`.

Para probar la evaluacion AI con OpenAI:

```bash
cp .env.example .env.local
```

Luego completa:

```bash
OPENAI_API_KEY="tu_api_key"
OPENAI_MODEL="gpt-4o-mini"
```

Reinicia `npm run dev` despues de cambiar variables de entorno. El tab `Evaluacion AI` llama a `/api/ai/evaluate` y genera hallazgos `ai-draft` por ambito usando solo el contexto, inventario y evidencia cargada.

Para conectar PostgreSQL:

```bash
cp .env.example .env
docker compose up -d postgres
npm run db:push
npm run db:generate
```

La aplicacion guarda cada assessment completo en PostgreSQL en la tabla `AssessmentSnapshot`. Esto preserva todo el estado actual del MVP: cliente, alcance, inventario, evidencia cargada, parsing, hallazgos, lifecycle, operaciones, roadmap y resumen. Si PostgreSQL no esta disponible, la UI cae temporalmente al cache local del navegador y muestra el estado en `Ajustes > Persistencia`.

El PostgreSQL local del `docker-compose.yml` publica el puerto `5433` para evitar conflictos con otros servicios locales que ya usen `5432`.

Para inspeccionar los datos:

```bash
npm run db:studio
```

## Worker Python

```bash
python3 worker/python/parse_cisco.py evidencia/
```

El worker emite JSON con dispositivos, interfaces, relaciones y hallazgos. La idea es moverlo despues a una cola de jobs para procesar evidencias grandes sin bloquear la UI.

## Principios implementados

- Un hallazgo preliminar se crea solo si hay evidencia textual.
- La app muestra confianza para hallazgos generados automaticamente.
- Los hallazgos inician como `ai-draft`.
- El arquitecto puede validar, editar o descartar antes de usar entregables.
- Las remediaciones se clasifican como servicio, inversion, mixtas o validacion pendiente.

## Siguientes incrementos recomendados

1. Normalizar snapshots hacia tablas relacionales por modulo cuando el modelo funcional se estabilice.
2. Agregar almacenamiento de archivos con hash SHA-256 y trazabilidad de fuente.
3. Ejecutar el parser Python desde una cola de trabajos.
4. Expandir reglas por dominio y version de software soportada.
5. Agregar exportacion PDF y presentacion ejecutiva.
