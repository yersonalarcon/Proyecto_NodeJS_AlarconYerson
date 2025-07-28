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

                    // 6. Parsear CSV
                    let documents = await parseCSV(filePath);
                    if (documents.length === 0) {
                        console.log('Archivo vacío o sin datos válidos');
                        continue;
                    }

                    // 7. Transformación de datos
                    documents = documents.map((doc, index) => {
                        try {
                            // Convertir _id a ObjectId si existe
                            if (doc._id) {
                                return { 
                                    ...doc, 
                                    _id: new ObjectId(doc._id) 
                                };
                            }
                            return doc;
                        } catch (error) {
                            results[collectionName].errors.push(`Línea ${index + 2}: ID inválido - ${error.message}`);
                            return null;
                        }
                    }).filter(Boolean);

                    if (documents.length === 0) {
                        throw new Error('Todos los documentos contenían errores');
                    }

                    // 8. Estrategia especial para nóminas
                    if (collectionName === 'nominas') {
                        const nominaResult = await this.handleNominas(documents);
                        results[collectionName] = { ...results[collectionName], ...nominaResult };
                    } else {
                        // 9. Estrategia normal para otras colecciones
                        const insertStrategy = await this.determineInsertStrategy(collectionName, documents[0]);
                        const insertResult = await this.executeInsert(collectionName, documents, insertStrategy);
                        
                        results[collectionName].processed = insertResult.insertedCount;
                        results[collectionName].duplicates = insertResult.duplicateCount;
                        results[collectionName].modified = insertResult.modifiedCount;

                        console.log([
                            `✅ Resultados:`,
                            `- Insertados: ${insertResult.insertedCount}`,
                            `- Duplicados: ${insertResult.duplicateCount}`,
                            `- Modificados: ${insertResult.modifiedCount}`
                        ].join('\n'));
                    }

                } catch (error) {
                    console.error(`Error procesando ${file}:`, error.message);
                    results[collectionName].error = error.message;
                    continue;
                }
            }

            // 10. Resumen final
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
            console.error('Error en el proceso ETL:', error.message);
            return { success: false, error: error.message };
        } finally {
            await dbManager.closeDb();
        }
    }

    static async handleNominas(documents) {
        const collection = dbManager.db.collection('nominas');
        const result = {
            processed: 0,
            duplicates: 0,
            modified: 0,
            errors: []
        };
    
        // Paso 1: Agrupar por _id
        const grupos = new Map();
    
        for (const doc of documents) {
            const id = doc._id.toHexString(); // Para usar como clave
    
            if (!grupos.has(id)) {
                grupos.set(id, []);
            }
    
            grupos.get(id).push(doc);
        }
    
        // Paso 2: Consolidar cada grupo
        const consolidados = [];
    
        for (const [id, grupo] of grupos.entries()) {
            const base = { ...grupo[0] }; // Tomamos la primera fila como base
    
            base.conceptos = grupo
                .filter(d => d['conceptos.codigo_concepto'])
                .map(d => ({
                    codigo_concepto: d['conceptos.codigo_concepto'],
                    valor: d['conceptos.valor'] ? Number(d['conceptos.valor']) : 0,
                    descripcion: d['conceptos.descripcion'] || ''
                }));
    
            base.novedades = grupo
                .filter(d => d['novedades.codigo_novedad'])
                .map(d => ({
                    codigo_novedad: d['novedades.codigo_novedad'],
                    dias: d['novedades.dias'] ? Number(d['novedades.dias']) : null,
                    descripcion: d['novedades.descripcion'] || '',
                    valor: d['novedades.valor'] ? Number(d['novedades.valor']) : null
                }));
    
            // Ajustes de formato
            base.total_devengado = Number(base.total_devengado);
            base.total_deducciones = Number(base.total_deducciones);
            base.neto_pagar = Number(base.neto_pagar);
            base.periodo = {
                mes: Number(base['periodo.mes']),
                año: Number(base['periodo.año'])
            };
    
            // Eliminar campos intermedios
            delete base['conceptos.codigo_concepto'];
            delete base['conceptos.valor'];
            delete base['conceptos.descripcion'];
            delete base['novedades.codigo_novedad'];
            delete base['novedades.dias'];
            delete base['novedades.descripcion'];
            delete base['novedades.valor'];
            delete base['periodo.mes'];
            delete base['periodo.año'];
    
            // Restaurar _id como ObjectId
            base._id = new ObjectId(id);
    
            consolidados.push(base);
        }
    
        // Paso 3: Insertar evitando duplicados
        const bulkOps = [];
    
        for (const doc of consolidados) {
            try {
                const exists = await collection.findOne({
                    $or: [
                        { _id: doc._id },
                        {
                            empleado_id: doc.empleado_id,
                            'periodo.mes': doc.periodo.mes,
                            'periodo.año': doc.periodo.año
                        }
                    ]
                });
    
                if (exists) {
                    result.duplicates++;
                    continue;
                }
    
                bulkOps.push({ insertOne: { document: doc } });
            } catch (error) {
                result.errors.push(`Error procesando nómina: ${error.message}`);
            }
        }
    
        // Paso 4: Ejecutar inserción en bloque
        if (bulkOps.length > 0) {
            try {
                const bulkResult = await collection.bulkWrite(bulkOps, { ordered: false });
                result.processed = bulkResult.insertedCount;
                console.log([
                    `✅ Resultados Nóminas:`,
                    `- Insertadas: ${bulkResult.insertedCount}`,
                    `- Duplicadas: ${result.duplicates}`
                ].join('\n'));
            } catch (error) {
                if (error.result) {
                    result.processed = error.result.insertedCount;
                    result.duplicates += error.writeErrors?.length || 0;
                    console.warn(`Algunos errores en nóminas: ${error.writeErrors?.length || 0}`);
                } else {
                    throw error;
                }
            }
        } else {
            console.log(`ℹ️ Todas las nóminas ya existen (${consolidados.length} registros)`);
        }
    
        return result;
    }
    
    static async determineInsertStrategy(collectionName, sampleDoc) {
        const collection = dbManager.db.collection(collectionName);
        const count = await collection.countDocuments();
        
        if (count === 0) return 'insert';
        if (sampleDoc._id) return 'upsert';
        return 'insert-ignore-duplicates';
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
                            filter: { _id: doc._id },
                            update: { $set: doc },
                            upsert: true
                        }
                    }));
                    
                    const bulkResult = await collection.bulkWrite(bulkOps, { ordered: false });
                    result.insertedCount = bulkResult.upsertedCount;
                    result.modifiedCount = bulkResult.modifiedCount;
                    result.duplicateCount = documents.length - (bulkResult.upsertedCount + bulkResult.modifiedCount);
                    break;

                case 'insert-ignore-duplicates':
                    try {
                        const insertResult = await collection.insertMany(documents, { ordered: false });
                        result.insertedCount = insertResult.insertedCount;
                    } catch (error) {
                        if (error.result) {
                            result.insertedCount = error.result.insertedCount;
                            result.duplicateCount = error.writeErrors?.length || 0;
                        } else {
                            throw error;
                        }
                    }
                    break;
            }
        } catch (error) {
            console.error(`Error en estrategia ${strategy}:`, error.message);
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