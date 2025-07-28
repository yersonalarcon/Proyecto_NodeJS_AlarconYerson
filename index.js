import readline from 'readline';
import { ObjectId } from 'mongodb';
import dbManager from './crud.js';
import { 
    createEmpleado, 
    listEmpleados, 
    showEmpleado, 
    updateEmpleado, 
    deleteEmpleado,
    setReadline
} from './empleados.js';
import contratos from './contratos.js';
import nominas from './nominas.js';
import ETLProcessor from './etl.js';
import { promises as fs } from 'fs';
import { crearHtml } from './crearhtml.js';
import { exec } from 'child_process';

// Configuración de readline
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

setReadline(rl);

// Funciones auxiliares
const getInput = (prompt) => new Promise(resolve => {
    rl.question(prompt, answer => resolve(answer.trim()));
});

const openReportInBrowser = (filePath) => {
    const opener = process.platform === 'win32' ? 'start' : 
                process.platform === 'darwin' ? 'open' : 'xdg-open';
    exec(`${opener} ${filePath}`, (error) => {
        if (error) console.error(`Abre manualmente: ${filePath}`);
    });
};

const generateAndShowReport = async (tipoReporte, datos) => {
    try {
        const reportFileName = `reporte-${tipoReporte}.html`;
        await fs.writeFile(reportFileName, crearHtml(tipoReporte, datos));
        console.log(`✅ Reporte generado: ${reportFileName}`);
        openReportInBrowser(reportFileName);
    } catch (error) {
        console.error('Error generando reporte:', error);
        throw error;
    }
};

// Menús
const showMainMenu = () => {
    console.log(`
Menu Principal:
1. Cargar archivos
2. Gestor de empleados
3. Gestor de contratos
4. Gestor de nóminas
5. Generar reportes
6. Salir`);
};

const showReportsMenu = () => {
    console.log(`
Generación de Reportes:
1. Reporte de empleados por área
2. Reporte detallado de nómina
3. Volver al Menú Principal`);
};

// Funciones de generación de reportes
const generateEmployeeAreaReport = async () => {
    let dbOpened = false;
    try {
        if (!dbManager.db) {
            await dbManager.openDb();
            dbOpened = true;
        }

        // 1. Obtener todos los empleados
        const empleados = await dbManager.list('empleados');
        if (!empleados || empleados.length === 0) {
            throw new Error("No se encontraron empleados en la base de datos");
        }

        // 2. Obtener todos los contratos activos de una sola vez
        const contratosActivos = await dbManager.db.collection('contratos')
            .find({ estado: 'activo' })
            .toArray();

        // 3. Crear un mapa rápido de contratos por empleado_id
        const contratoPorEmpleadoId = {};
        contratosActivos.forEach(contrato => {
            // IMPORTANTE: Convertir a string para comparación directa
            const empleadoIdStr = contrato.empleado_id.toString();
            contratoPorEmpleadoId[empleadoIdStr] = contrato;
        });

        // 4. Enriquecer empleados con sus contratos
        const empleadosConContrato = empleados.map(emp => {
            const empleadoIdStr = emp._id.toString();
            return {
                ...emp,
                contrato: contratoPorEmpleadoId[empleadoIdStr] || null
            };
        });

        // 5. Filtrar y formatear datos
        const datosValidos = empleadosConContrato
            .filter(e => e.contrato !== null)
            .map(e => ({
                ...e,
                _id: e._id.toString(),
                contrato: {
                    ...e.contrato,
                    _id: e.contrato._id.toString()
                }
            }));

        if (datosValidos.length === 0) {
            // Diagnóstico detallado
            const empleadosSinContrato = empleadosConContrato
                .filter(e => e.contrato === null)
                .map(e => ({
                    id: e._id.toString(),
                    nombre: `${e.informacion_personal?.nombres} ${e.informacion_personal?.apellidos}`,
                    contratosEnDB: contratosActivos.map(c => c.empleado_id.toString())
                }));

            console.log("Diagnóstico completo:");
            console.log("- Total empleados:", empleados.length);
            console.log("- Total contratos activos en DB:", contratosActivos.length);
            console.log("- Empleados sin contrato detectado:", empleadosSinContrato);
            
            throw new Error(`Problema de relación empleados-contratos. Ver consola para detalles.`);
        }

        await generateAndShowReport('empleados', datosValidos);

    } catch (error) {
        console.error('Error generando reporte:', error.message);
        await generateAndShowReport('error', {
            titulo: "Error en reporte",
            mensaje: error.message,
            detalles: error.stack
        });
    } finally {
        if (dbOpened) {
            await dbManager.closeDb();
        }
    }
};

const generatePayrollDetailReport = async () => {
    let dbOpened = false;
    try {
        // 1. Manejo de conexión
        if (!dbManager.db) {
            await dbManager.openDb();
            dbOpened = true;
        }

        // 2. Obtener inputs
        const empleadoId = await getInput("ID del empleado: ");
        const nominaId = await getInput("ID de la nómina: ");

        if (!empleadoId || !nominaId) {
            throw new Error("Debes proporcionar ambos IDs");
        }

        // 3. Obtener datos
        const [empleado, nomina, contrato] = await Promise.all([
            dbManager.show('empleados', empleadoId),
            dbManager.show('nominas', nominaId),
            dbManager.db.collection('contratos')
                .findOne({ empleado_id: new ObjectId(empleadoId) })
        ]);

        // 4. Validaciones
        if (!empleado) throw new Error("Empleado no encontrado");
        if (!nomina) throw new Error("Nómina no encontrada");

        // 5. Preparar datos para HTML
        const datos = {
            empleado: {
                ...empleado,
                _id: empleado._id.toString()
            },
            nomina: {
                ...nomina,
                _id: nomina._id.toString(),
                salario_base: contrato?.salario_base || 0
            }
        };

        // 6. Generar reporte
        await generateAndShowReport('nomina-detalle', datos);

    } catch (error) {
        console.error('Error generando reporte de nómina:', error.message);
        // Mostrar error en HTML
        await generateAndShowReport('error', {
            titulo: "Error en reporte de nómina",
            mensaje: error.message
        });
    } finally {
        if (dbOpened) {
            await dbManager.closeDb();
        }
    }
};

// Controladores de menú
const handleMainMenu = async (opt) => {
    const actions = {
        '1': () => loadFiles().then(showMainMenu),
        '2': () => manageEmployes(),
        '3': () => manageContracts(),
        '4': () => manageNomina(),
        '5': () => manageReports(),
        '6': () => dbManager.closeDb().then(() => rl.close())
    };
    
    await (actions[opt] || (() => {
        console.log("Opción inválida");
        return showMainMenu();
    }))();
};

const manageReports = async () => {
    showReportsMenu();
    const opt = await getInput("Seleccione: ");
    
    const actions = {
        '1': generateEmployeeAreaReport,
        '2': generatePayrollDetailReport,
        '3': showMainMenu
    };
    
    await (actions[opt] || (() => {
        console.log("Opción inválida");
        return manageReports();
    }))();
    
    if (opt !== '3') await manageReports();
};

// Funciones principales
const loadFiles = async () => {
    console.log("Cargando archivos...");
    await ETLProcessor.processFiles();
};

const manageEmployes = async () => {
    console.log(`
Gestión de Empleados:
1. Crear
2. Listar
3. Ver
4. Actualizar
5. Eliminar
6. Volver`);
    
    const opt = await getInput("Seleccione: ");
    const actions = {
        '1': createEmpleado,
        '2': listEmpleados,
        '3': showEmpleado,
        '4': updateEmpleado,
        '5': deleteEmpleado,
        '6': showMainMenu
    };
    
    await (actions[opt] || (() => {
        console.log("Opción inválida");
        return manageEmployes();
    }))(dbManager);
    
    if (opt !== '6') await manageEmployes();
};

// (Similar para manageContracts y manageNomina)

// Inicio
const main = async () => {
    try {
        await dbManager.openDb();
        console.log("Conexión establecida");
        showMainMenu();
        rl.on('line', async (line) => {
            await handleMainMenu(line.trim());
        });
    } catch (error) {
        console.error("Error inicial:", error);
        process.exit(1);
    }
};

main();