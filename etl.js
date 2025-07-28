import { promises as fs } from 'fs';
import path from 'path';
import { ObjectId } from 'mongodb';
import { parseCSV } from './csvParser.js';
import dbManager from './crud.js';

export class ETLProcessor {
    static async processFiles() {
        try {
            // 1. Configuración inicial
            const rawDataPath = path.resolve(process.cwd(), 'raw-data');
            console.log(`Buscando archivos en: ${rawDataPath}`);

            // 2. Verificar existencia del directorio
            try {
                await fs.access(rawDataPath);
            } catch (error) {
                throw new Error(`El directorio 'raw-data' no existe. Crea la carpeta y coloca tus archivos CSV allí.`);
            }

            // 3. Buscar archivos CSV
            const files = (await fs.readdir(rawDataPath))
                .filter(file => file.endsWith('.csv'))
                .sort();

            if (files.length === 0) {
                console.log('No se encontraron archivos CSV en /raw-data');
                return { success: false, message: 'No hay archivos CSV' };
            }

            console.log(`Archivos a procesar: ${files.join(', ')}`);

            // 4. Conexión a la base de datos
            await dbManager.openDb();
            const results = {};

            // 5. Procesar cada archivo
            for (const file of files) {
                const filePath = path.join(rawDataPath, file);
                const collectionName = path.basename(file, '.csv');
                results[collectionName] = { processed: 0, errors: [] };

                try {
                    console.log(`\n--- Procesando ${file} ---`);

                    // Definir fieldTypes específicos para cada colección
                    const commonFieldTypes = {
                        fecha_generacion: 'Date',
                        fecha_pago: 'Date',
                    };

                    let specificFieldTypes = {};
                    switch(collectionName) {
                        case 'nominas':
                            specificFieldTypes = {
                                _id: 'ObjectId',
                                empleado_id: 'ObjectId',
                                contrato_id: 'ObjectId',
                                'periodo.mes': 'Number', // Asegurar que sea Number
                                'periodo.año': 'Number', // Asegurar que sea Number
                                'total_devengado': 'Number',
                                'total_deducciones': 'Number',
                                'neto_pagar': 'Number',
                                'conceptos.valor': 'Number',
                                'novedades.dias': 'Number',
                                'novedades.valor': 'Number'
                            };
                            break;
                        case 'empleados':
                             specificFieldTypes = {
                                _id: 'ObjectId',
                                // Añade más tipos específicos de empleados aquí
                             };
                             break;
                        case 'contratos':
                             specificFieldTypes = {
                                _id: 'ObjectId',
                                empleado_id: 'ObjectId',
                                // Añade más tipos específicos de contratos aquí
                             };
                             break;
                        case 'conceptos':
                             specificFieldTypes = {
                                _id: 'ObjectId', // Si tus conceptos tienen _id como ObjectId
                                // Añade más tipos específicos de conceptos aquí
                             };
                             break;
                        // Puedes añadir más casos según tus colecciones
                    }

                    const allFieldTypes = { ...commonFieldTypes, ...specificFieldTypes };

                    // 6. Parsear CSV con los tipos de campo definidos y manejo de anidados
                    // El parseCSV ahora maneja la conversión de _id y la anidación
                    let parsedDocuments = await parseCSV(filePath, {
                        strictMode: false, // Puedes cambiar a true una vez que tu CSV sea perfecto
                        fieldTypes: allFieldTypes
                    });

                    if (parsedDocuments.length === 0) {
                        console.log('Archivo vacío o sin datos válidos después del parseo.');
                        continue;
                    }

                    let documentsToInsert = [];

                    // 7. Estrategia especial para nóminas: Agrupar conceptos y novedades
                    if (collectionName === 'nominas') {
                        documentsToInsert = ETLProcessor.groupAndConsolidateNominas(parsedDocuments);
                        console.log(`✅ ${documentsToInsert.length} nóminas consolidadas para insertar.`);
                    } else {
                        // Para otras colecciones, los documentos parseados ya están listos
                        documentsToInsert = parsedDocuments;
                    }

                    if (documentsToInsert.length === 0) {
                        console.warn(`No hay documentos válidos para insertar en ${collectionName} desde ${file} después de la consolidación.`);
                        results[collectionName] = { success: false, message: 'No hay documentos válidos', file: file };
                        continue; // Pasa al siguiente archivo
                    }

                    // 8. Cargar datos en la base de datos
                    const collection = dbManager.db.collection(collectionName);
                    const strategy = 'upsert'; // O la estrategia que prefieras (insert, upsert, insert-ignore-duplicates)

                    console.log(`Cargando ${documentsToInsert.length} documentos en ${collectionName} con estrategia '${strategy}'...`);

                    const loadResult = await ETLProcessor.executeInsert(collectionName, documentsToInsert, strategy);
                    
                    results[collectionName].processed = loadResult.insertedCount + loadResult.modifiedCount;
                    results[collectionName].duplicates = loadResult.duplicateCount;
                    results[collectionName].modified = loadResult.modifiedCount;

                    console.log([
                        `✅ Resultados:`,
                        `- Insertados/Upserted: ${loadResult.insertedCount}`,
                        `- Duplicados/Ignorados: ${loadResult.duplicateCount}`,
                        `- Modificados: ${loadResult.modifiedCount}`
                    ].join('\n'));

                } catch (error) {
                    console.error(`Error procesando ${file}:`, error.message);
                    results[collectionName].error = error.message;
                    continue;
                }
            }

            // 9. Resumen final
            console.log('\n--- Resumen del ETL ---');
            for (const [collection, result] of Object.entries(results)) {
                console.log([
                    `Colección: ${collection}`,
                    `- Documentos procesados: ${result.processed}`,
                    `- Errores: ${result.errors.length}`,
                    ...(result.error ? [`- Error general: ${result.error}`] : [])
                ].join('\n'));
            }

            return { success: true, results };

        } catch (error) {
            console.error('Error general en el proceso ETL:', error.message);
            return { success: false, error: error.message };
        } finally {
            await dbManager.closeDb();
        }
    }

    /**
     * Consolida documentos de nómina planos (una fila por concepto/novedad)
     * en documentos de nómina únicos con arrays de conceptos y novedades.
     * Los documentos de entrada ya deben tener los campos anidados por parseCSV.
     * @param {Array<Object>} flatNominaDocs - Array de documentos de nómina parseados y "planos".
     * @returns {Array<Object>} Array de documentos de nómina consolidados.
     */
    static groupAndConsolidateNominas(flatNominaDocs) {
        const groupedData = new Map();

        for (const doc of flatNominaDocs) {
            // Usa el _id como clave de agrupación. Asegúrate de que sea un string para el Map.
            const idKey = doc._id ? doc._id.toHexString() : `temp_id_${Math.random()}`; // Generar un ID temporal si _id es nulo

            if (!groupedData.has(idKey)) {
                // Inicializa el documento principal de nómina con arrays vacíos para conceptos y novedades
                groupedData.set(idKey, {
                    _id: doc._id,
                    empleado_id: doc.empleado_id,
                    contrato_id: doc.contrato_id,
                    periodo: doc.periodo, // Ya es {mes: N, año: N} por csvParser
                    fecha_generacion: doc.fecha_generacion,
                    fecha_pago: doc.fecha_pago,
                    estado: doc.estado,
                    total_devengado: doc.total_devengado,
                    total_deducciones: doc.total_deducciones,
                    neto_pagar: doc.neto_pagar,
                    conceptos: [], // Se inicializa como array vacío
                    novedades: []  // Se inicializa como array vacío
                });
            }

            const currentPayrollDoc = groupedData.get(idKey);

            // Añadir concepto si existe en esta fila
            if (doc.conceptos && doc.conceptos.codigo_concepto !== null && doc.conceptos.codigo_concepto !== undefined && doc.conceptos.codigo_concepto !== '') {
                currentPayrollDoc.conceptos.push({
                    codigo_concepto: doc.conceptos.codigo_concepto,
                    valor: doc.conceptos.valor, // Ya es Number por csvParser
                    descripcion: doc.conceptos.descripcion
                });
            }

            // Añadir novedad si existe en esta fila
            if (doc.novedades && doc.novedades.codigo_novedad !== null && doc.novedades.codigo_novedad !== undefined && doc.novedades.codigo_novedad !== '') {
                currentPayrollDoc.novedades.push({
                    codigo_novedad: doc.novedades.codigo_novedad,
                    dias: doc.novedades.dias, // Ya es Number o null por csvParser
                    descripcion: doc.novedades.descripcion,
                    valor: doc.novedades.valor // Ya es Number o null por csvParser
                });
            }
        }

        const consolidatedDocs = Array.from(groupedData.values());

        // Opcional: Eliminar duplicados dentro de los arrays de conceptos y novedades
        // Esto es útil si el CSV tiene líneas idénticas para el mismo concepto/novedad en una misma nómina.
        consolidatedDocs.forEach(payrollDoc => {
            if (payrollDoc.conceptos) {
                payrollDoc.conceptos = Array.from(new Map(payrollDoc.conceptos.map(item => [JSON.stringify(item), item])).values());
            }
            if (payrollDoc.novedades) {
                payrollDoc.novedades = Array.from(new Map(payrollDoc.novedades.map(item => [JSON.stringify(item), item])).values());
            }
        });

        return consolidatedDocs;
    }
    
    // El método handleNominas original se reemplaza por groupAndConsolidateNominas
    // y la lógica de inserción se mueve a executeInsert general.

    static async determineInsertStrategy(collectionName, sampleDoc) {
        const collection = dbManager.db.collection(collectionName);
        const count = await collection.countDocuments();
        
        if (count === 0) return 'insert';
        // Si el documento de muestra tiene un _id, podemos usar upsert (actualizar o insertar)
        if (sampleDoc && sampleDoc._id instanceof ObjectId) return 'upsert'; 
        return 'insert-ignore-duplicates'; // Si no hay _id y la colección no está vacía, ignorar duplicados
    }

    static async executeInsert(collectionName, documents, strategy) {
        const collection = dbManager.db.collection(collectionName);
        const result = { 
            insertedCount: 0, 
            duplicateCount: 0, 
            modifiedCount: 0 
        };

        try {
            switch (strategy) {
                case 'insert':
                    const insertResult = await collection.insertMany(documents, { ordered: false });
                    result.insertedCount = insertResult.insertedCount;
                    break;

                case 'upsert':
                    const bulkOps = documents.map(doc => ({
                        updateOne: {
                            filter: { _id: doc._id }, // Asume que _id es un ObjectId válido
                            update: { $set: doc },
                            upsert: true
                        }
                    }));
                    
                    const bulkResult = await collection.bulkWrite(bulkOps, { ordered: false });
                    result.insertedCount = bulkResult.upsertedCount;
                    result.modifiedCount = bulkResult.modifiedCount;
                    // Los duplicados en upsert se refieren a documentos que ya existían y no fueron modificados (si filter no es _id)
                    // o errores de inserción de _id duplicado en bulkWrite con upsert:true (raro si se usa _id como filtro)
                    // Para simplificar, aquí se considera el count de upserted + modified
                    result.duplicateCount = documents.length - (bulkResult.upsertedCount + bulkResult.modifiedCount);
                    break;

                case 'insert-ignore-duplicates':
                    try {
                        const insertResult = await collection.insertMany(documents, { ordered: false });
                        result.insertedCount = insertResult.insertedCount;
                    } catch (error) {
                        if (error.result && error.code === 11000) { // E11000 es código de error de duplicado
                            result.insertedCount = error.result.insertedCount;
                            result.duplicateCount = error.writeErrors?.length || 0;
                            // console.warn(`Insert-ignore-duplicates: se encontraron ${result.duplicateCount} duplicados.`);
                        } else {
                            throw error;
                        }
                    }
                    break;
                default:
                    throw new Error(`Estrategia de inserción desconocida: ${strategy}`);
            }
        } catch (error) {
            console.error(`Error en estrategia ${strategy} para ${collectionName}:`, error.message);
            throw error;
        }

        return result;
    }

    // Opcional: Método para limpiar colecciones
    static async cleanCollection(collectionName) {
        await dbManager.db.collection(collectionName).deleteMany({});
        console.log(`♻️ Colección ${collectionName} limpiada`);
    }
}

export default ETLProcessor;