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
    try {
        const empleados = await dbManager.list('empleados');
        const empleadosConContrato = await Promise.all(
            empleados.map(async emp => ({
                ...emp,
                contrato: await dbManager.db.collection('contratos')
                    .findOne({ 
                        empleado_id: new ObjectId(emp._id),
                        estado: 'activo' 
                    })
            }))
        );
        
        await generateAndShowReport('empleados', empleadosConContrato.filter(e => e.contrato));
    } catch (error) {
        console.error('Error:', error);
    }
};

const generatePayrollDetailReport = async () => {
    try {
        const [empleadoId, nominaId] = await Promise.all([
            getInput("ID del empleado: "),
            getInput("ID de la nómina: ")
        ]);
        
        const [empleado, nomina, contrato] = await Promise.all([
            dbManager.show('empleados', empleadoId),
            dbManager.show('nominas', nominaId),
            dbManager.db.collection('contratos')
                .findOne({ empleado_id: new ObjectId(empleadoId) })
        ]);
        
        if (!empleado || !nomina) {
            throw new Error("Empleado o nómina no encontrados");
        }
        
        await generateAndShowReport('nomina-detalle', { 
            empleado, 
            nomina: { ...nomina, salario_base: contrato?.salario_base || 0 } 
        });
    } catch (error) {
        console.error('Error:', error.message);
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