import { readFile } from 'fs/promises';
import { ObjectId } from 'mongodb';

/**
 * Parsea un archivo CSV y transforma los datos según las necesidades de MongoDB
 * @param {string} filePath - Ruta del archivo CSV
 * @param {Object} options - Opciones de parseo
 * @param {boolean} [options.strictMode=true] - Si true, rechaza documentos con errores
 * @param {Array} [options.requiredFields=[]] - Campos obligatorios
 * @param {Object} [options.fieldTypes={}] - Tipos de datos por campo (ej: { precio: 'number' })
 * @returns {Promise<Array<Object>>} - Array de documentos listos para MongoDB
 */
export async function parseCSV(filePath, options = {}) {
    const {
        strictMode = true,
        requiredFields = [],
        fieldTypes = {}
    } = options;

    try {
        // 1. Leer y preparar el contenido
        const content = await readFile(filePath, 'utf-8');
        const lines = normalizeContent(content);
        
        if (lines.length <= 1) {
            console.warn(`Archivo CSV vacío o solo con encabezados: ${filePath}`);
            return [];
        }

        // 2. Procesar encabezados
        const headers = parseLine(lines[0]).map(header => header.trim());
        validateHeaders(headers, requiredFields);

        // 3. Procesar cada línea
        const documents = [];
        const errors = [];

        for (let i = 1; i < lines.length; i++) {
            try {
                const doc = processLine(lines[i], headers, fieldTypes);
                if (doc) documents.push(doc);
            } catch (error) {
                errors.push(`Línea ${i + 1}: ${error.message}`);
                if (strictMode) throw error;
            }
        }

        // 4. Reportar errores
        if (errors.length > 0) {
            console.warn(`Errores en ${filePath}:\n${errors.slice(0, 5).join('\n')}`);
            if (errors.length > 5) console.warn(`... y ${errors.length - 5} más`);
        }

        return documents;
    } catch (error) {
        console.error(`Error procesando ${filePath}:`, error.message);
        if (strictMode) throw error;
        return [];
    }
}

// ==================== FUNCIONES AUXILIARES ====================

/**
 * Normaliza el contenido del CSV
 */
function normalizeContent(content) {
    return content
        .replace(/\r\n/g, '\n')  // Normalizar saltos de línea
        .split('\n')
        .map(line => line.trim())
        .filter(line => line !== '');
}

/**
 * Valida los encabezados del CSV
 */
function validateHeaders(headers, requiredFields) {
    const missingFields = requiredFields.filter(f => !headers.includes(f));
    if (missingFields.length > 0) {
        throw new Error(`Faltan campos obligatorios: ${missingFields.join(', ')}`);
    }
}

/**
 * Parsea una línea CSV manejando comas dentro de comillas
 */
function parseLine(line) {
    const values = [];
    let currentValue = '';
    let inQuotes = false;
    let quoteChar = '"';

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === quoteChar) {
            if (inQuotes && line[i + 1] === quoteChar) {
                // Comilla escapada (ej: "")
                currentValue += quoteChar;
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            values.push(currentValue);
            currentValue = '';
        } else {
            currentValue += char;
        }
    }

    values.push(currentValue);
    return values;
}

/**
 * Procesa una línea individual del CSV, construyendo objetos anidados.
 */
function processLine(line, headers, fieldTypes) {
    const values = parseLine(line);
    const doc = {};

    headers.forEach((header, index) => {
        const rawValue = index < values.length ? values[index] : '';
        // Usa setNestedValue para manejar la notación de punto en los encabezados
        setNestedValue(doc, header, transformValue(header, rawValue, fieldTypes));
    });
    
    // No se necesita conversión especial para _id aquí, ya que transformValue lo maneja a través de fieldTypes
    // y setNestedValue ya ha colocado el valor transformado en doc._id
    
    return doc;
}

/**
 * Función auxiliar para establecer valores en un objeto anidado a partir de una ruta con puntos.
 */
function setNestedValue(obj, path, value) {
    const parts = path.split('.');
    let current = obj;
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (i === parts.length - 1) {
            current[part] = value;
        } else {
            // Si el valor actual no es un objeto o es un array (lo que indicaría una estructura incorrecta para anidación),
            // lo inicializamos como un objeto vacío.
            if (!current[part] || typeof current[part] !== 'object' || Array.isArray(current[part])) {
                current[part] = {};
            }
            current = current[part];
        }
    }
}

/**
 * Transforma un valor según su tipo esperado
 */
function transformValue(header, rawValue, fieldTypes) {
    // Si la cadena está vacía, devuelve null. Esto es crucial para ObjectId, Date, Number.
    if (rawValue === '') return null; 

    const value = rawValue.trim();
    const fieldType = fieldTypes[header.toLowerCase()] || 'auto';

    try {
        switch (fieldType.toLowerCase()) {
            case 'objectid':
                // Si el valor es null, new ObjectId(null) lanzaría un error. Ya lo manejamos arriba.
                return new ObjectId(value);

            case 'date':
                const date = new Date(value);
                if (isNaN(date.getTime())) throw new Error(`No es una fecha válida: ${value}`);
                return date;

            case 'number':
                const num = Number(value);
                if (isNaN(num)) throw new Error(`No es un número válido: ${value}`);
                return num;

            case 'boolean':
                if (['true', '1', 'si'].includes(value.toLowerCase())) return true;
                if (['false', '0', 'no'].includes(value.toLowerCase())) return false;
                throw new Error(`Valor booleano inválido: ${value}`);

            case 'string':
                return removeWrappingQuotes(value);

            case 'auto':
            default:
                return autoDetectType(value);
        }
    } catch (error) {
        // Captura errores específicos de tipo y lanza un error más descriptivo
        throw new Error(`Campo '${header}' con valor '${rawValue}': ${error.message}`);
    }
}

/**
 * Detecta automáticamente el tipo de dato
 */
function autoDetectType(value) {
    // Si está envuelto en comillas, es string
    const unquoted = removeWrappingQuotes(value);
    if (unquoted !== value) return unquoted;

    // Prueba con número
    if (/^-?\d+\.?\d*$/.test(value)) {
        const num = Number(value);
        if (!isNaN(num)) return num;
    }

    // Prueba con boolean
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;

    // Prueba con fecha (formato ISO o común)
    const date = new Date(value);
    if (!isNaN(date.getTime())) return date;

    // Por defecto, string
    return value;
}

/**
 * Remueve comillas circundantes
 */
function removeWrappingQuotes(value) {
    if (value.startsWith('"') && value.endsWith('"')) {
        return value.slice(1, -1).replace(/""/g, '"');
    }
    if (value.startsWith("'") && value.endsWith("'")) {
        return value.slice(1, -1).replace(/''/g, "'");
    }
    return value;
}

// ==================== FUNCIONES ADICIONALES ====================

/**
 * Valida documentos contra un esquema
 */
export function validateDocuments(documents, schema) {
    return documents.filter(doc => {
        return Object.entries(schema).every(([field, type]) => {
            if (!(field in doc)) return false;
            
            switch (type.toLowerCase()) {
                case 'objectid':
                    return doc[field] instanceof ObjectId;
                case 'date':
                    return doc[field] instanceof Date;
                case 'number':
                    return typeof doc[field] === 'number';
                case 'boolean':
                    return typeof doc[field] === 'boolean';
                default:
                    return typeof doc[field] === 'string';
            }
        });
    });
}

/**
 * Genera un esquema a partir de documentos
 */
export function inferSchema(documents) {
    if (documents.length === 0) return {};
    
    const schema = {};
    const sampleDoc = documents[0];
    
    Object.keys(sampleDoc).forEach(key => {
        const value = sampleDoc[key];
        
        if (value instanceof ObjectId) {
            schema[key] = 'ObjectId';
        } else if (value instanceof Date) {
            schema[key] = 'Date';
        } else if (typeof value === 'number') {
            schema[key] = 'Number';
        } else if (typeof value === 'boolean') {
            schema[key] = 'Boolean';
        } else {
            schema[key] = 'String';
        }
    });
    
    return schema;
}