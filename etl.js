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
                .sort(); // Orden alfabético para consistencia

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
                    }).filter(Boolean); // Eliminar documentos con errores

                    if (documents.length === 0) {
                        throw new Error('Todos los documentos contenían errores');
                    }

                    // 8. Estrategia de inserción
                    const insertStrategy = await this.determineInsertStrategy(collectionName, documents[0]);

                    // 9. Ejecutar inserción
                    const insertResult = await this.executeInsert(
                        collectionName, 
                        documents, 
                        insertStrategy
                    );

                    // 10. Registrar resultados
                    results[collectionName].processed = insertResult.insertedCount;
                    results[collectionName].duplicates = insertResult.duplicateCount;
                    results[collectionName].modified = insertResult.modifiedCount;

                    console.log([
                        `✅ Resultados:`,
                        `- Insertados: ${insertResult.insertedCount}`,
                        `- Duplicados: ${insertResult.duplicateCount}`,
                        `- Modificados: ${insertResult.modifiedCount}`
                    ].join('\n'));

                } catch (error) {
                    console.error(`Error procesando ${file}:`, error.message);
                    results[collectionName].error = error.message;
                    continue; // Continuar con el siguiente archivo
                }
            }

            // 11. Resumen final
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

    static async determineInsertStrategy(collectionName, sampleDoc) {
        // Verificar si la colección existe y tiene documentos
        const collection = dbManager.db.collection(collectionName);
        const count = await collection.countDocuments();
        
        if (count === 0) {
            return 'insert'; // Insertar directamente si la colección está vacía
        }

        // Si los documentos tienen _id, usar upsert
        if (sampleDoc._id) {
            return 'upsert';
        }

        // Si no hay _id pero la colección existe, insertar ignorando duplicados
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
                    const insertResult = await collection.insertMany(documents, { 
                        ordered: false 
                    });
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
                    
                    const bulkResult = await collection.bulkWrite(bulkOps, { 
                        ordered: false 
                    });
                    
                    result.insertedCount = bulkResult.upsertedCount;
                    result.modifiedCount = bulkResult.modifiedCount;
                    result.duplicateCount = documents.length - (bulkResult.upsertedCount + bulkResult.modifiedCount);
                    break;

                case 'insert-ignore-duplicates':
                    try {
                        const insertResult = await collection.insertMany(documents, { 
                            ordered: false 
                        });
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
}

export default ETLProcessor;