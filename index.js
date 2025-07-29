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
import reportQueries from './reportQueries.js';

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
3. Empleados con auxilio de transporte
4. Resumen de nómina por concepto
5. Volver al Menú Principal`);
};

// Funciones de generación de reportes
const generateEmployeeAreaReport = async () => {
    console.log("Generando reporte de empleados por área y cargo...");
    try {
        // Las funciones de reportQueries asumen que la DB ya está conectada.
        // Asegúrate de que dbManager.openDb() se llama una vez al inicio de tu aplicación
        // y dbManager.closeDb() se llama al final.

        // Llamar a la función de reporte centralizada de reportQueries.js
        const datosReporte = await reportQueries.getEmployeesByAreaAndPosition();

        // Verificar si se obtuvieron datos
        if (!datosReporte || datosReporte.length === 0) {
            throw new Error("No se encontraron datos para el reporte de empleados por área y cargo. Verifica si hay contratos activos y empleados relacionados.");
        }
        
        // Generar y mostrar el HTML con los datos obtenidos
        await generateAndShowReport('empleados', datosReporte);
        console.log("✅ Reporte de Empleados por Área y Cargo generado.");

    } catch (error) {
        console.error("Error en reporte de empleados:", error);
        await generateAndShowReport('error', {
            titulo: "Error en Reporte de Empleados",
            mensaje: error.message,
            detalles: error.stack
        });
    }
};
const generatePayrollDetailReport = async () => {
    console.log("Iniciando generación de reporte de nómina detallada...");
    try {
        // Validación de entrada
        const empleadoId = await getInput("ID del empleado: ");
        if (!ObjectId.isValid(empleadoId)) {
            throw new Error("El ID de empleado no es válido (debe ser 24 caracteres hexadecimales)");
        }

        const mesInput = parseInt(await getInput("Mes (1-12): "));
        const añoInput = parseInt(await getInput("Año: "));
        
        if (isNaN(mesInput) || mesInput < 1 || mesInput > 12) {
            throw new Error("El mes debe ser un número entre 1 y 12");
        }
        
        if (isNaN(añoInput) || añoInput < 2000 || añoInput > new Date().getFullYear() + 1) {
            throw new Error(`El año debe estar entre 2000 y ${new Date().getFullYear() + 1}`);
        }

        // Llamar a la función de reporte centralizada en reportQueries.js
        const datosReporte = await reportQueries.getDetailedPayrollReport(empleadoId, {
            mes: mesInput,
            año: añoInput
        });

        // La función de reportQueries.js ya lanza un error si no encuentra la nómina o el empleado.
        // Si llegamos aquí, datosReporte es válido.
        console.log("Datos para el reporte preparados. Generando HTML...");
        await generateAndShowReport('nomina-detalle', datosReporte);
        console.log("Reporte de nómina detallada generado exitosamente.");

    } catch (error) {
        console.error('Error al generar reporte:', error);
        // Siempre intenta mostrar un reporte de error en el navegador
        await generateAndShowReport('error', {
            titulo: "Error en Reporte de Nómina",
            mensaje: error.message.split('\n')[0] || "Error al generar reporte", // Muestra solo la primera línea del error
            detalles: error.message || "Verifique los datos e intente nuevamente" // Muestra el mensaje completo en detalles
        });
    }
    // NOTA: Se ha eliminado el manejo de dbOpened y dbManager.closeDb() aquí.
    // Asegúrate de que dbManager.openDb() se llama una vez al inicio de tu aplicación
    // (por ejemplo, en una función `main` o al arrancar el servidor)
    // y dbManager.closeDb() al finalizar la aplicación.
};
const generateTransportSubsidyReport = async () => {
    let dbOpened = false;
    try {
        console.log("Iniciando generación de reporte de auxilio de transporte...");
        await dbManager.openDb();
        dbOpened = true;
        console.log("Conexión a la base de datos abierta.");

        const empleadosConSubsidio = await reportQueries.getEmployeesWithTransportSubsidy();
        
        console.log(`Número de empleados encontrados con auxilio de transporte: ${empleadosConSubsidio.length}`);
        if (empleadosConSubsidio.length > 0) {
            console.log("Primeros 5 empleados encontrados (para depuración):");
            empleadosConSubsidio.slice(0, 5).forEach((emp, index) => {
                console.log(`  ${index + 1}. ${emp.nombres} ${emp.apellidos}, Salario: ${emp.salario_base}`);
            });
        }

        if (!empleadosConSubsidio || empleadosConSubsidio.length === 0) {
            throw new Error("No se encontraron empleados con auxilio de transporte que cumplan los criterios (salario <= 2.600.000 y contrato activo).");
        }

        await generateAndShowReport('empleados-transporte', empleadosConSubsidio);
        console.log("Reporte de auxilio de transporte generado exitosamente.");

    } catch (error) {
        console.error('Error en reporte de transporte:', error);
        await generateAndShowReport('error', {
            titulo: "Error en reporte de Auxilio de Transporte",
            mensaje: error.message,
            detalles: "Verifique que existan empleados con contratos activos y salario base menor o igual a 2.600.000 en la base de datos, y que la conexión sea correcta."
        });
    } finally {
        if (dbOpened) {
            await dbManager.closeDb();
            console.log("Conexión a la base de datos cerrada.");
        }
    }
};

const generateDetailedPayrollReport = async () => {
    console.log("Iniciando generación de reporte de detalle de nómina...");
    try {
        const nominaId = await getInput("Ingrese el ID de la nómina (ej: 707f1f77bcf86cd799439601): ");

        if (!nominaId || !/^[0-9a-fA-F]{24}$/.test(nominaId)) {
            throw new Error("ID de nómina inválido. Debe ser una cadena hexadecimal de 24 caracteres.");
        }

        const datosReporte = await reportQueries.getDetailedPayrollReport(nominaId);
        
        if (!datosReporte) {
            throw new Error(`No se encontró el detalle de nómina para el ID: ${nominaId}. Verifique si el ID es correcto y si la nómina existe.`);
        }

        await generateAndShowReport('nomina-detalle', datosReporte);
        console.log("✅ Reporte de detalle de nómina generado.");

    } catch (error) {
        console.error('Error en detalle de nómina:', error);
        await generateAndShowReport('error', {
            titulo: "Error en Detalle de Nómina",
            mensaje: error.message.split('\n')[0] || "Error al generar detalle de nómina",
            detalles: error.message || "Verifique el ID de la nómina e intente nuevamente."
        });
    }
}
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
    console.log(`
Gestión de Reportes:
1. Listado de Empleados por Área y Cargo
2. Detalle de Nómina (por empleado y período)
3. Empleados con Derecho a Auxilio de Transporte
4. Detalle de Nómina (por ID de Nómina)
5. Volver`);

    const opt = await getInput("Seleccione: ");
    let reportType;
    let dataForReport = null; // Inicializar en null

    try {
        switch (opt) {
            case '1':
                reportType = 'empleados';
                dataForReport = await reportQueries.getEmployeesByAreaAndPosition();
                break;
            case '2':
                reportType = 'nomina-detalle';
                const empleadoId = await getInput('Ingrese el ID del empleado (ej: 654c602a8b9e1d8d9b07c2a1): ');
                const mes = parseInt(await getInput('Ingrese el mes (1-12): '));
                const año = parseInt(await getInput('Ingrese el año: '));
                
                // Validar que mes y año sean números válidos
                if (isNaN(mes) || mes < 1 || mes > 12) {
                    throw new Error("Mes inválido. Debe ser un número entre 1 y 12.");
                }
                if (isNaN(año) || año < 1900 || año > new Date().getFullYear() + 1) { // Ajusta el rango del año según necesites
                    throw new Error("Año inválido. Debe ser un número válido.");
                }

                dataForReport = await reportQueries.getDetailedPayrollReportByEmployeeAndPeriod(empleadoId, { mes, año });
                break;
            case '3':
                reportType = 'empleados-transporte';
                dataForReport = await reportQueries.getEmployeesWithTransportSubsidy();
                break;
      
            case '4': // Nueva opción para detalle de nómina por ID
                reportType = 'nomina-detalle'; // Sigue siendo el mismo tipo de reporte 'nomina-detalle'
                const nominaId = await getInput('Ingrese el ID de la nómina (ej: 707f1f77bcf86cd799439601): ');
                dataForReport = await reportQueries.getDetailedPayrollReportByNominaId(nominaId);
                break;
            case '5':
                return;  // Volver al menú principal
            default:
                console.log("Opción inválida.");
                await manageReports(); // Permitir reintentar
                return;
        }
        
        // Solo genera y muestra el reporte si se obtuvo dataForReport
        if (dataForReport !== null) { // Usar !== null para diferenciar de arrays vacíos
            await generateAndShowReport(reportType, dataForReport);
        } else {
             console.log("No se encontraron datos para generar el reporte solicitado.");
             await generateAndShowReport('error', {
                titulo: 'Datos no encontrados',
                mensaje: 'La consulta no arrojó resultados para el reporte.',
                detalles: `Tipo de reporte: ${reportType}. Revise los IDs o el período ingresado.`
             });
        }

    } catch (error) {
        console.error("Error al generar reporte:", error.message); // Muestra solo el mensaje del error para mayor claridad
        await generateAndShowReport('error', {
            titulo: 'Error en la Generación del Reporte',
            mensaje: `Ocurrió un error al intentar generar el reporte: ${reportType}.`,
            detalles: error.message || 'Error desconocido. Verifique los logs.'
        });
    } finally {
        // Solo volver a llamar a manageReports si no es la opción 5
        if (opt !== '5') {
            await manageReports();
        }
    }
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

const manageContracts = async () => {
    console.log(`
Gestión de Contratos:
1. Crear
2. Listar
3. Ver
4. Actualizar
5. Eliminar
6. Volver`);
    
    const opt = await getInput("Seleccione: ");
    const actions = {
        '1': contratos.createContrato,
        '2': contratos.listContratos,
        '3': contratos.showContrato,
        '4': contratos.updateContrato,
        '5': contratos.deleteContrato,
        '6': showMainMenu
    };
    
    await (actions[opt] || (() => {
        console.log("Opción inválida");
        return manageContracts();
    }))(dbManager);
    
    if (opt !== '6') await manageContracts();
};

const manageNomina = async () => {
    console.log(`
Gestión de Nóminas:
1. Crear
2. Listar
3. Ver
4. Actualizar
5. Eliminar
6. Volver`);
    
    const opt = await getInput("Seleccione: ");
    const actions = {
        '1': nominas.createNomina,
        '2': nominas.listNominas,
        '3': nominas.showNomina,
        '4': nominas.updateNomina,
        '5': nominas.deleteNomina,
        '6': showMainMenu
    };
    
    await (actions[opt] || (() => {
        console.log("Opción inválida");
        return manageNomina();
    }))(dbManager);
    
    if (opt !== '6') await manageNomina();
};

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