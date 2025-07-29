import { ObjectId } from 'mongodb';
import dbManager from './crud.js';

export async function getEmployeesByAreaAndPosition() {
    let dbOpened = false;
    try {
        await dbManager.openDb();
        dbOpened = true;

        const collection = dbManager.db.collection('contratos');
        const empleadosCollection = dbManager.db.collection('empleados');

        // Verificación de colecciones
        if (!collection || !empleadosCollection) {
            throw new Error("No se encontraron las colecciones necesarias");
        }

        const result = await collection.aggregate([
            { $match: { estado: "activo" } },
            {
                $lookup: {
                    from: "empleados",
                    localField: "empleado_id",
                    foreignField: "_id",
                    as: "empleado"
                }
            },
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
                    genero: { $ifNull: ["$empleado.informacion_personal.genero", "N/A"] }
                }
            }
        ]).toArray();

        if (!result || result.length === 0) {
            // Diagnóstico avanzado
            const [totalContratos, totalEmpleados] = await Promise.all([
                dbManager.db.collection('contratos').countDocuments({ estado: "activo" }),
                dbManager.db.collection('empleados').countDocuments()
            ]);
            
            throw new Error(`No se encontraron resultados. Diagnóstico:
                - Contratos activos: ${totalContratos}
                - Empleados registrados: ${totalEmpleados}`);
        }

        return result;
    } catch (error) {
        console.error("Error en getEmployeesByAreaAndPosition:", error);
        throw error;
    } finally {
        if (dbOpened) {
            await dbManager.closeDb();
        }
    }
}


export async function findProblematicContracts() {
    let dbOpened = false;
    try {
        if (!dbManager.db) {
            await dbManager.openDb();
            dbOpened = true;
        }

        // Encontrar contratos activos sin empleado relacionado
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
            { $match: { empleado: { $size: 0 } } },
            { $project: { _id: 1, empleado_id: 1 } }
        ]).toArray();

        console.log("Contratos problemáticos:", JSON.stringify(problematicContracts, null, 2));

        // Verificar si los empleados existen con esos IDs
        if (problematicContracts.length > 0) {
            const empleadoIds = problematicContracts.map(c => c.empleado_id);
            const empleados = await dbManager.db.collection('empleados')
                .find({ _id: { $in: empleadoIds } })
                .toArray();

            console.log(`Empleados encontrados con esos IDs: ${empleados.length}`);
        }

        return problematicContracts;
    } finally {
        if (dbOpened) {
            await dbManager.closeDb();
        }
    }
}

export async function getDetailedPayrollReportByEmployeeAndPeriod(empleadoId, periodo) {
    let dbOpened = false;
    try {
        if (!dbManager.db) {
            await dbManager.openDb();
            dbOpened = true;
        }

        // Validate inputs
        if (!empleadoId || !ObjectId.isValid(empleadoId)) {
            throw new Error("ID de empleado inválido.");
        }
        if (!periodo || typeof periodo.mes !== 'number' || typeof periodo.año !== 'number') {
            throw new Error("Período (mes y año) inválido.");
        }

        const [nominaRaw, empleadoRaw] = await Promise.all([
            dbManager.db.collection('nominas').findOne({
                empleado_id: new ObjectId(empleadoId),
                'periodo.mes': periodo.mes,
                'periodo.año': periodo.año
            }),
            dbManager.show('empleados', empleadoId)
        ]);

        if (!nominaRaw || !empleadoRaw) {
            return null; // Or throw a specific error indicating no data found
        }

        const contratoRaw = await dbManager.db.collection('contratos').findOne({
            empleado_id: empleadoRaw._id,
            estado: 'activo'
        });

        // Enrich concepts with name and type by performing lookups
        const enrichedConceptos = await Promise.all(
            (nominaRaw.conceptos || []).map(async (concepto) => {
                const conceptoInfo = await dbManager.db.collection('conceptos').findOne(
                    { codigo: concepto.codigo_concepto },
                    { projection: { nombre: 1, tipo: 1, _id: 0 } }
                );
                return {
                    ...concepto,
                    nombre: conceptoInfo?.nombre || 'N/A',
                    tipo: conceptoInfo?.tipo || 'N/A',
                    descripcion: concepto.descripcion || 'N/A' // Ensure description is present
                };
            })
        );

        const enrichedNovedades = (nominaRaw.novedades || []).map(novedad => ({
            ...novedad,
            descripcion: novedad.descripcion || 'N/A',
            valor: novedad.valor || 0,
            fecha: novedad.fecha || null
        }));

        return {
            empleado: {
                nombreCompleto: `${empleadoRaw.informacion_personal?.nombres || ''} ${empleadoRaw.informacion_personal?.apellidos || ''}`.trim(),
                nombres: empleadoRaw.informacion_personal?.nombres || 'N/A',
                apellidos: empleadoRaw.informacion_personal?.apellidos || 'N/A',
                identificacion: empleadoRaw.informacion_personal?.numero_identificacion || 'N/A',
                tipoIdentificacion: { descripcion: empleadoRaw.informacion_personal?.tipo_identificacion || 'N/A' },
                cargo: contratoRaw?.cargo?.nombre || 'N/A',
                area: contratoRaw?.area?.nombre || 'N/A'
            },
            nomina: {
                ...nominaRaw,
                conceptos: enrichedConceptos,
                novedades: enrichedNovedades,
                salario_base: contratoRaw?.salario_base || 0
            },
            periodo: {
                mes: nominaRaw.periodo?.mes || 'N/A',
                año: nominaRaw.periodo?.año || 'N/A'
            }
        };
    } finally {
        if (dbOpened) {
            await dbManager.closeDb();
        }
    }
}

export async function getDetailedPayrollReportByNominaId(nominaId) {
    let dbOpened = false;
    try {
        if (!dbManager.db) {
            await dbManager.openDb();
            dbOpened = true;
        }

        // Validate input
        if (!nominaId || !ObjectId.isValid(nominaId)) {
            throw new Error("ID de nómina inválido.");
        }

        const nominaRaw = await dbManager.show('nominas', nominaId);

        if (!nominaRaw) {
            return null; // No nomina found with that ID
        }

        const empleadoRaw = await dbManager.show('empleados', nominaRaw.empleado_id);

        if (!empleadoRaw) {
            return null; // No employee found for this nomina
        }

        const contratoRaw = await dbManager.db.collection('contratos').findOne({
            empleado_id: empleadoRaw._id,
            estado: 'activo'
        });

        // Enrich concepts and novedades (same logic as before)
        const enrichedConceptos = await Promise.all(
            (nominaRaw.conceptos || []).map(async (concepto) => {
                const conceptoInfo = await dbManager.db.collection('conceptos').findOne(
                    { codigo: concepto.codigo_concepto },
                    { projection: { nombre: 1, tipo: 1, _id: 0 } }
                );
                return {
                    ...concepto,
                    nombre: conceptoInfo?.nombre || 'N/A',
                    tipo: conceptoInfo?.tipo || 'N/A',
                    descripcion: concepto.descripcion || 'N/A'
                };
            })
        );

        const enrichedNovedades = (nominaRaw.novedades || []).map(novedad => ({
            ...novedad,
            descripcion: novedad.descripcion || 'N/A',
            valor: novedad.valor || 0,
            fecha: novedad.fecha || null
        }));

        return {
            empleado: {
                nombreCompleto: `${empleadoRaw.informacion_personal?.nombres || ''} ${empleadoRaw.informacion_personal?.apellidos || ''}`.trim(),
                identificacion: empleadoRaw.informacion_personal?.numero_identificacion || 'N/A',
                tipoIdentificacion: empleadoRaw.informacion_personal?.tipo_identificacion?.descripcion || 'N/A', 
                cargo: contratoRaw?.cargo?.nombre || 'N/A',
                area: contratoRaw?.area?.nombre || 'N/A'
            },
            nomina: {
                ...nominaRaw,
                conceptos: enrichedConceptos,
                novedades: enrichedNovedades,
                salario_base: contratoRaw?.salario_base || 0
            },
            periodo: {
                mes: nominaRaw.periodo?.mes || 'N/A',
                año: nominaRaw.periodo?.año || 'N/A'
            }
        };
    } finally {
        if (dbOpened) {
            await dbManager.closeDb();
        }
    }
}

export async function getEmployeesWithTransportSubsidy() {
    let dbOpened = false;
    try {
        if (!dbManager.db) {
            await dbManager.openDb();
            dbOpened = true;
        }

        const SMMLV = 1300000;
        const maxSalario = 2 * SMMLV;

        return await dbManager.db.collection('contratos').aggregate([
            { 
                $match: { 
                    estado: 'activo',
                    salario_base: { $lte: maxSalario }
                } 
            },
            {
                $lookup: {
                    from: 'empleados',
                    localField: 'empleado_id',
                    foreignField: '_id',
                    as: 'empleado'
                }
            },
            { $unwind: '$empleado' },
            {
                $project: {
                    nombres: '$empleado.informacion_personal.nombres',
                    apellidos: '$empleado.informacion_personal.apellidos',
                    identificacion: '$empleado.informacion_personal.numero_identificacion',
                    salario_base: 1,
                    auxilio_transporte: { $literal: 200000 }, // Valor fijo del auxilio
                    cargo: '$cargo.nombre',
                    area: '$area.nombre',
                    porcentaje_smmlv: {
                        $multiply: [
                            { $divide: ['$salario_base', SMMLV] },
                            100
                        ]
                    }
                }
            },
            { $sort: { area: 1, nombres: 1 } }
        ]).toArray();
    } finally {
        if (dbOpened) {
            await dbManager.closeDb();
        }
    }
}

export async function getPayrollSummaryByConcept(periodo) {
    let dbOpened = false;
    try {
        if (!dbManager.db) {
            await dbManager.openDb();
            dbOpened = true;
        }

        // Validate input
        if (!periodo || typeof periodo.mes !== 'number' || typeof periodo.año !== 'number') {
            throw new Error("Período (mes y año) inválido para el resumen.");
        }

        const resumen = await dbManager.db.collection('nominas').aggregate([
            { 
                $match: { 
                    'periodo.mes': periodo.mes,
                    'periodo.año': periodo.año
                } 
            },
            { $unwind: '$conceptos' },
            {
                $group: {
                    _id: '$conceptos.codigo_concepto',
                    total_valor: { $sum: '$conceptos.valor' },
                    cantidad_empleados: { $sum: 1 },
                    // Keeping an example of original concept for potential fields not in 'conceptos' collection
                    original_concepto: { $first: '$conceptos' } 
                }
            },
            {
                $lookup: {
                    from: 'conceptos',
                    localField: '_id',
                    foreignField: 'codigo',
                    as: 'concepto_info'
                }
            },
            { $unwind: { path: '$concepto_info', preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    codigo: '$_id',
                    nombre: '$concepto_info.nombre',
                    tipo: '$concepto_info.tipo',
                    // Use description from the original concept if available, otherwise from concept_info
                    descripcion: { $ifNull: ['$original_concepto.descripcion', '$concepto_info.descripcion'] }, 
                    total_valor: 1,
                    cantidad_empleados: 1,
                    valor_promedio: {
                        $divide: ['$total_valor', '$cantidad_empleados']
                    }
                }
            },
            { $sort: { tipo: 1, total_valor: -1 } }
        ]).toArray();
        
        const totalGeneral = resumen.reduce((sum, item) => sum + (item.total_valor || 0), 0);

        return {
            conceptos: resumen,
            periodo: periodo, // Pass the period back for context
            totalGeneral: totalGeneral
        };

    } finally {
        if (dbOpened) {
            await dbManager.closeDb();
        }
    }
}

export default {
    getEmployeesByAreaAndPosition,
    getEmployeesWithTransportSubsidy,
    getDetailedPayrollReportByEmployeeAndPeriod, // Updated name
    getDetailedPayrollReportByNominaId, // New export
    getPayrollSummaryByConcept
};