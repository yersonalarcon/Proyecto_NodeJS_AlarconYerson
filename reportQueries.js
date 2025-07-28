// reportQueries.js
import { ObjectId } from 'mongodb';
import dbManager from './crud.js'; // Asumo que crud.js es dbManager

export async function getEmployeesByAreaAndPosition() {
    let dbOpenedHere = false; // Renombrado para mayor claridad
    try {
        await dbManager.openDb();
        dbOpenedHere = true;

        const collection = dbManager.db.collection('contratos');
        const empleadosCollection = dbManager.db.collection('empleados');

        // Verificación de colecciones
        if (!collection || !empleadosCollection) {
            console.error("Error: No se encontraron las colecciones 'contratos' o 'empleados'.");
            throw new Error("No se encontraron las colecciones necesarias");
        }

        console.log("Iniciando generación de reporte de empleados por área y posición...");

        const result = await collection.aggregate([
            { $match: { estado: "activo" } }, // Filtra solo contratos activos
            {
                $lookup: {
                    from: "empleados",
                    localField: "empleado_id", // Campo en 'contratos' que referencia a 'empleados'
                    foreignField: "_id",      // Campo en 'empleados' al que se referencia
                    as: "empleado"            // Nombre del nuevo campo con el documento del empleado
                }
            },
            // Asegurarse de que el empleado existe después del lookup
            // Si preserveNullAndEmptyArrays es false, se eliminan los documentos donde 'empleado' no se encontró
            { $unwind: { path: "$empleado", preserveNullAndEmptyArrays: false } },
            {
                   $project: {
                    _id: 0,
                    area_codigo: { $ifNull: ["$area.id", "N/A"] },
                    area_nombre: { $ifNull: ["$area.nombre", "N/A"] },
                    cargo_codigo: { $ifNull: ["$cargo.id", "N/A"] },
                    cargo_nombre: { $ifNull: ["$cargo.nombre", "N/A"] },
                    tipo_identificacion: { $ifNull: ["$empleado.informacion_personal.tipo_identificacion", "N/A"] },
                    numero_identificacion: { $ifNull: ["$empleado.informacion_personal.numero_identificacion", "N/A"] },
                    nombres: { $ifNull: ["$empleado.informacion_personal.nombres", "N/A"] },
                    apellidos: { $ifNull: ["$empleado.informacion_personal.apellidos", "N/A"] },
                    telefono: { $ifNull: ["$empleado.informacion_personal.telefono", "N/A"] },
                    email: { $ifNull: ["$empleado.informacion_personal.email", "N/A"] },
                    genero: { $ifNull: ["$empleado.informacion_personal.genero", "N/A"] },
        // Si hay algún ID que quieras mostrar directamente en el reporte:
        // empleado_id_string: { $toString: "$empleado._id" }, // O $toString: "$empleado_id" si fuera del contrato
        // contrato_id_string: { $toString: "$_id" } // Si quieres el _id del contrato
    }
            }
        ]).toArray();

        if (!result || result.length === 0) {
            // Diagnóstico mejorado si no hay resultados
            const [totalContratos, totalEmpleados] = await Promise.all([
                dbManager.db.collection('contratos').countDocuments({ estado: "activo" }),
                dbManager.db.collection('empleados').countDocuments()
            ]);
            
            throw new Error(`No se encontraron resultados para empleados por área y posición. Diagnóstico:
                - Contratos activos: ${totalContratos}
                - Empleados registrados: ${totalEmpleados}
                - Posibles causas:
                    1. No hay contratos activos con empleado_id válidos que coincidan con un _id de empleado.
                    2. Los campos 'area', 'cargo' o 'informacion_personal' no están anidados como se espera en los documentos de MongoDB.
                    3. Los IDs (empleado_id en contratos, _id en empleados) no son del tipo ObjectId.
                - Verifique los datos en sus colecciones 'contratos' y 'empleados'.`);
        }
        console.log(`Reporte de empleados por área y posición generado. Total de empleados: ${result.length}`);
        return result;
    } catch (error) {
        console.error("Error en getEmployeesByAreaAndPosition:", error);
        throw error; // Re-lanza el error para que pueda ser manejado por la función que llama
    } finally {
        if (dbOpenedHere) {
            await dbManager.closeDb(); // Asegura que la conexión a la base de datos se cierre
        }
    }
}

export async function findProblematicContracts() {
    let dbOpenedHere = false;
    try {
        if (!dbManager.db) {
            await dbManager.openDb();
            dbOpenedHere = true;
        }

        console.log("Iniciando búsqueda de contratos problemáticos (activos sin empleado relacionado)...");

        const problematicContracts = await dbManager.db.collection('contratos').aggregate([
            { $match: { estado: "activo" } },
            {
                $lookup: {
                    from: "empleados",
                    localField: "empleado_id",
                    foreignField: "_id",
                    as: "empleado"
                }
            },
            { $match: { empleado: { $size: 0 } } }, // Filtra donde el array 'empleado' (del lookup) está vacío
            { $project: { _id: 1, empleado_id: 1, estado: 1, 'area.nombre': 1, 'cargo.nombre': 1 } } // Añadimos más campos para el diagnóstico
        ]).toArray();

        console.log("Contratos problemáticos encontrados:", JSON.stringify(problematicContracts, null, 2));

        if (problematicContracts.length > 0) {
            const empleadoIds = problematicContracts.map(c => c.empleado_id);
            // Intentamos buscar esos IDs directamente en la colección de empleados
            const empleadosFoundByIds = await dbManager.db.collection('empleados')
                .find({ _id: { $in: empleadoIds.map(id => {
                    try { return new ObjectId(id); } catch (e) { return id; } // Intenta convertir, sino usa string
                }) } })
                .toArray();

            console.log(`Empleados encontrados usando los IDs de los contratos problemáticos: ${empleadosFoundByIds.length}`);
            if (empleadosFoundByIds.length > 0) {
                console.log("Detalle de empleados encontrados:", JSON.stringify(empleadosFoundByIds.map(e => ({ _id: e._id, nombres: e.informacion_personal?.nombres, apellidos: e.informacion_personal?.apellidos })), null, 2));
            } else {
                console.log("No se encontraron empleados en la colección 'empleados' con los IDs de los contratos problemáticos.");
            }
        } else {
            console.log("No se encontraron contratos problemáticos (todos los contratos activos tienen un empleado asociado).");
        }

        return problematicContracts;
    } catch (error) {
        console.error("Error en findProblematicContracts:", error);
        throw error;
    } finally {
        if (dbOpenedHere) {
            await dbManager.closeDb();
        }
    }
}


export async function getDetailedPayrollReport(empleadoId, periodo) {
    let dbOpenedHere = false;
    try {
        if (!dbManager.db) {
            await dbManager.openDb();
            dbOpenedHere = true;
        }

        // Validar y convertir empleadoId a ObjectId si es posible, o manejar como string
        let empleadoObjectId;
        try {
            empleadoObjectId = new ObjectId(empleadoId);
        } catch (e) {
            console.warn(`[getDetailedPayrollReport] ID de empleado "${empleadoId}" no es un ObjectId válido. Intentando buscar también como string.`);
            // Si no es un ObjectId válido, la búsqueda fallará si el campo es ObjectId.
            // Para robustez, usaremos $or para buscar por ObjectId y por string.
            empleadoObjectId = empleadoId; // Usar el ID original como fallback si falla la conversión a ObjectId
        }

        console.log(`[getDetailedPayrollReport] Buscando nómina detallada para Empleado ID: ${empleadoId}, Mes: ${periodo.mes}, Año: ${periodo.año}`);

        const [nomina, empleado, contrato] = await Promise.all([
            dbManager.db.collection('nominas').findOne({
                $or: [
                    { empleado_id: empleadoObjectId },
                    // Si empleado_id en la DB puede ser string, esta línea ayuda
                    { empleado_id: empleadoId } 
                ],
                'periodo.mes': periodo.mes,
                'periodo.año': periodo.año
            }),
            dbManager.show('empleados', empleadoId), // Asumo que dbManager.show ya maneja ObjectId
            dbManager.db.collection('contratos').findOne({
                $or: [
                    { empleado_id: empleadoObjectId },
                    // Si empleado_id en la DB puede ser string, esta línea ayuda
                    { empleado_id: empleadoId }
                ],
                estado: 'activo'
            })
        ]);

        console.log(`[getDetailedPayrollReport] Nómina encontrada: ${nomina ? 'Sí' : 'No'}`);
        console.log(`[getDetailedPayrollReport] Empleado encontrado: ${empleado ? 'Sí' : 'No'}`);
        console.log(`[getDetailedPayrollReport] Contrato encontrado: ${contrato ? 'Sí' : 'No'}`);

        if (!nomina || !empleado) {
            // Si la nómina o el empleado no se encuentran, retornamos null
            // para que la función llamadora (generatePayrollDetailReport) active su diagnóstico detallado.
            return null;
        }

        return {
            empleado: {
                nombreCompleto: `${empleado.informacion_personal?.nombres || ''} ${empleado.informacion_personal?.apellidos || ''}`.trim(),
                identificacion: empleado.informacion_personal?.numero_identificacion || 'N/A',
                cargo: contrato?.cargo?.nombre || 'N/A',
                area: contrato?.area?.nombre || 'N/A'
            },
            nomina: {
                ...nomina,
                salario_base: contrato?.salario_base || 0 // Asegurarse de que el salario base se tome del contrato
            }
        };
    } catch (error) {
        console.error("Error en getDetailedPayrollReport:", error);
        throw error;
    } finally {
        if (dbOpenedHere) {
            await dbManager.closeDb();
        }
    }
}

export async function getEmployeesWithTransportSubsidy() {
    let dbOpened = false;
    try {
        await dbManager.openDb();
        dbOpened = true;

        const collection = dbManager.db.collection('contratos');
        const empleadosCollection = dbManager.db.collection('empleados');

        if (!collection || !empleadosCollection) {
            throw new Error("No se encontraron las colecciones necesarias");
        }

        console.log("[getEmployeesWithTransportSubsidy] Buscando empleados con subsidio de transporte (Salario Base <= 2600000)...");

        // Contar contratos activos y aquellos que deberían calificar para el diagnóstico
        const totalActiveContracts = await collection.countDocuments({ estado: "activo" });
        const allActiveContracts = await collection.find({ estado: "activo" }).toArray();
        let activeAndQualifyingCount = 0;
        for (const contract of allActiveContracts) {
            let s_base = contract.salario_base;
            if (typeof s_base === 'string') {
                s_base = parseFloat(s_base);
            }
            if (typeof s_base === 'number' && !isNaN(s_base) && s_base <= 2600000) {
                activeAndQualifyingCount++;
            }
        }

        const result = await collection.aggregate([
            // Paso 1: Convertir salario_base a tipo numérico (si no lo está)
            {
                $addFields: {
                    salario_base_numeric: {
                        $cond: {
                            if: { $isNumber: "$salario_base" },
                            then: "$salario_base",
                            else: {
                                $convert: {
                                    input: "$salario_base",
                                    to: "double",
                                    onError: 0,
                                    onNull: 0
                                }
                            }
                        }
                    }
                }
            },
            // Paso 2: Filtrar contratos activos y por salario numérico
            {
                $match: {
                    estado: "activo",
                    salario_base_numeric: { $lte: 2600000 }
                }
            },
            // **NUEVO PASO 3:** Asegurar que empleado_id es un ObjectId para el lookup
            {
                $addFields: {
                    empleado_id_converted: {
                        $cond: {
                            if: { $eq: [{ $type: "$empleado_id" }, "objectId"] }, // Si ya es ObjectId
                            then: "$empleado_id",
                            else: { // Intenta convertir a ObjectId si es un string (o cualquier otro tipo)
                                $convert: {
                                    input: "$empleado_id",
                                    to: "objectId",
                                    onError: null, // Si la conversión falla, establece a null (para que $unwind lo filtre)
                                    onNull: null   // Si el campo es null, establece a null
                                }
                            }
                        }
                    }
                }
            },
            // **Paso 4 (anterior 3):** Unir con la información del empleado usando el campo convertido
            {
                $lookup: {
                    from: "empleados",
                    localField: "empleado_id_converted", // Usar el campo convertido para el lookup
                    foreignField: "_id",
                    as: "empleado_info"
                }
            },
            // Paso 5 (anterior 4): Desplegar el array de empleado_info (elimina documentos si no hay match)
            { $unwind: "$empleado_info" },
            // Paso 6 (anterior 5): Proyectar los campos deseados
            {
                $project: {
                    _id: 0,
                    nombres: "$empleado_info.informacion_personal.nombres",
                    apellidos: "$empleado_info.informacion_personal.apellidos",
                    identificacion: "$empleado_info.informacion_personal.numero_identificacion",
                    salario_base: "$salario_base_numeric", // Usar el campo numérico convertido
                    auxilio_transporte: { $literal: 162000 } // Valor fijo del auxilio
                }
            },
            // Paso 7 (anterior 6): Ordenar los resultados
            {
                $sort: {
                    nombres: 1,
                    apellidos: 1
                }
            }
        ]).toArray();

        console.log(`[getEmployeesWithTransportSubsidy] Empleados con subsidio de transporte encontrados: ${result.length}`);
        console.log(`[getEmployeesWithTransportSubsidy] Diagnóstico: Total contratos activos: ${totalActiveContracts}, Contratos activos con salario <= 2600000: ${activeAndQualifyingCount}. Verifique tipo de dato de 'salario_base' (debe ser numérico) y valores.`);

        return result;
    } finally {
        if (dbOpened) {
            await dbManager.closeDb();
        }
    }
}

export async function getPayrollSummaryByConcept(periodo) {
    let dbOpenedHere = false;
    try {
        if (!dbManager.db) {
            await dbManager.openDb();
            dbOpenedHere = true;
        }

        console.log(`[getPayrollSummaryByConcept] Generando resumen de nómina por concepto para Mes: ${periodo.mes}, Año: ${periodo.año}...`);

        // Contar nóminas para el diagnóstico si no se encuentran conceptos
        // // Modificación para que el diagnóstico cuente tanto si los campos son numéricos como strings
        const totalNominasForPeriod = await dbManager.db.collection('nominas').countDocuments({
            $and: [
                {
                    $or: [
                        { 'periodo.mes': periodo.mes },          // Coincidir si ya es número
                        { 'periodo.mes': String(periodo.mes) }   // Coincidir si es string (ej: "2")
                    ]
                },
                {
                    $or: [
                        { 'periodo.año': periodo.año },          // Coincidir si ya es número
                        { 'periodo.año': String(periodo.año) }   // Coincidir si es string (ej: "2025")
                    ]
                }
            ]
        });


        const result = await dbManager.db.collection('nominas').aggregate([
            // Paso 1: Convertir periodo.mes y periodo.año a numérico para el match
            {
                $addFields: {
                    'periodo.mes_numeric': {
                        $convert: { input: '$periodo.mes', to: 'int', onError: null, onNull: null }
                    },
                    'periodo.año_numeric': {
                        $convert: { input: '$periodo.año', to: 'int', onError: null, onNull: null }
                    }
                }
            },
            // Paso 2: Filtrar nóminas por período usando los campos numéricos
            {
                $match: {
                    'periodo.mes_numeric': periodo.mes,
                    'periodo.año_numeric': periodo.año
                }
            },
            // Paso 3: Asegurar que 'conceptos' es un array antes de unwinding
            {
                $addFields: {
                    conceptos: {
                        $cond: {
                            if: { $isArray: "$conceptos" },
                            then: "$conceptos",
                            else: []
                        }
                    }
                }
            },
            // Paso 4: Descomponer el array de conceptos
            { $unwind: '$conceptos' },
            // Paso 5: Convertir 'valor' a numérico y 'codigo_concepto' a string para consistencia con 'conceptos.codigo'
            {
                $addFields: {
                    'conceptos.valor_numeric': {
                        $convert: { input: '$conceptos.valor', to: 'double', onError: 0, onNull: 0 }
                    },
                    'conceptos.codigo_concepto_string': { // Convertir a string para el $group y $lookup
                        $convert: { input: '$conceptos.codigo_concepto', to: 'string', onError: null, onNull: null }
                    }
                }
            },
            // Paso 6: Agrupar por el código del concepto (ahora string) y sumar el valor numérico
            {
                $group: {
                    _id: '$conceptos.codigo_concepto_string', // Usar el código_concepto como string
                    total_valor: { $sum: '$conceptos.valor_numeric' }, // Suma el valor numérico
                    cantidad_empleados: { $sum: 1 }, // Cuenta las ocurrencias de este concepto
                    concepto_muestra: { $first: '$conceptos' } // Guarda una muestra para obtener la descripción original
                }
            },
            // Paso 7: Unir con la información de la colección 'conceptos' (maestros)
            {
                $lookup: {
                    from: 'conceptos',
                    localField: '_id', // El _id de la agrupación (que es codigo_concepto_string)
                    foreignField: 'codigo', // Campo 'codigo' en la colección 'conceptos' (asumimos string)
                    as: 'concepto_info'
                }
            },
            // Paso 8: Desplegar el array de concepto_info (preserva documentos si no hay coincidencia)
            { $unwind: { path: '$concepto_info', preserveNullAndEmptyArrays: true } },
            // Paso 9: Proyectar los campos finales para el reporte
            {
                $project: {
                    _id: 0,
                    codigo: '$_id',
                    nombre: { $ifNull: ['$concepto_info.nombre', '$concepto_muestra.descripcion'] }, // Nombre del maestro o descripción de la nómina
                    tipo: { $ifNull: ['$concepto_info.tipo', 'Desconocido'] }, // Tipo del maestro o 'Desconocido'
                    descripcion: { $ifNull: ['$concepto_muestra.descripcion', 'N/A'] }, // Descripción de la nómina
                    total_valor: 1,
                    cantidad_empleados: 1,
                    valor_promedio: {
                        $cond: {
                            if: { $gt: ['$cantidad_empleados', 0] }, // Evitar división por cero
                            then: { $divide: ['$total_valor', '$cantidad_empleados'] },
                            else: 0
                        }
                    }
                }
            },
            // Paso 10: Ordenar los resultados
            { $sort: { tipo: 1, total_valor: -1 } }
        ]).toArray();

        console.log(`[getPayrollSummaryByConcept] Resumen de nómina por concepto encontrado: ${result.length} conceptos agrupados.`);
        // El mensaje de diagnóstico actualizado será más preciso
        console.log(`[getPayrollSummaryByConcept] Diagnóstico: Total nóminas (numéricas o strings) para ${periodo.mes}/${periodo.año}: ${totalNominasForPeriod}. Si el conteo es correcto, el problema puede estar en 'conceptos', 'conceptos.codigo_concepto' o 'conceptos.valor' dentro de la agregación.`);

        return result;
    } catch (error) {
        console.error("Error en getPayrollSummaryByConcept:", error);
        throw error;
    } finally {
        if (dbOpenedHere) {
            await dbManager.closeDb();
        }
    }
}

export default {
    getEmployeesByAreaAndPosition,
    getEmployeesWithTransportSubsidy,
    getDetailedPayrollReport,
    getPayrollSummaryByConcept
};