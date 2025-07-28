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
    let dbOpened = false;
    try {
        if (!dbManager.db) {
            await dbManager.openDb();
            dbOpened = true;
        }

        const [empleados, contratosActivos] = await Promise.all([
            dbManager.list('empleados'),
            dbManager.db.collection('contratos').find({ estado: 'activo' }).toArray()
        ]);

        if (!empleados || empleados.length === 0) {
            throw new Error("No se encontraron empleados en la base de datos");
        }

        if (!contratosActivos || contratosActivos.length === 0) {
            throw new Error("No se encontraron contratos activos en la base de datos");
        }

        const empleadosMap = {};
        empleados.forEach(emp => {
            empleadosMap[emp._id.toString()] = emp;
        });

        const contratosMap = {};
        const contratosValidos = [];
        
        contratosActivos.forEach(contrato => {
            const empleadoIdStr = contrato.empleado_id?.toString();
            if (empleadoIdStr && empleadosMap[empleadoIdStr]) {
                contratosMap[empleadoIdStr] = contrato;
                contratosValidos.push(contrato);
            }
        });

        if (contratosValidos.length !== contratosActivos.length) {
            const contratosInvalidos = contratosActivos.filter(c => {
                const empleadoIdStr = c.empleado_id?.toString();
                return !empleadoIdStr || !empleadosMap[empleadoIdStr];
            });

            console.log("Diagnóstico de inconsistencias:");
            console.log("- Total contratos activos:", contratosActivos.length);
            console.log("- Contratos con relación válida:", contratosValidos.length);
            console.log("- Contratos problemáticos:", contratosInvalidos.map(c => ({
                contrato_id: c._id.toString(),
                empleado_id: c.empleado_id?.toString(),
                problema: !c.empleado_id ? "Falta empleado_id" : "Empleado no encontrado"
            })));
        }

        const empleadosConContrato = empleados
            .filter(emp => contratosMap[emp._id.toString()])
            .map(emp => {
                const contrato = contratosMap[emp._id.toString()];
                return {
                    ...emp,
                    contrato: {
                        ...contrato,
                        _id: contrato._id.toString(),
                        empleado_id: contrato.empleado_id.toString()
                    }
                };
            });

        if (empleadosConContrato.length === 0) {
            throw new Error("No se encontraron empleados con contratos activos válidos");
        }

        const datosReporte = empleadosConContrato.map(emp => {
            const infoPersonal = emp.informacion_personal || {};
            const contrato = emp.contrato || {};
            const area = contrato.area || {};
            const cargo = contrato.cargo || {};

            return {
                nombres: infoPersonal.nombres || 'N/A',
                apellidos: infoPersonal.apellidos || 'N/A',
                tipo_identificacion: infoPersonal.tipo_identificacion || 'N/A',
                numero_identificacion: infoPersonal.numero_identificacion || 'N/A',
                genero: infoPersonal.genero || 'N/A',
                telefono: infoPersonal.telefono || 'N/A',
                email: infoPersonal.email || 'N/A',
                tipo_contrato: contrato.tipo_contrato || 'N/A',
                fecha_inicio: contrato.fecha_inicio || 'N/A',
                salario_base: contrato.salario_base || 0,
                area_codigo: area.id || 'N/A',
                area_nombre: area.nombre || 'N/A',
                cargo_codigo: cargo.id || 'N/A',
                cargo_nombre: cargo.nombre || 'N/A'
            };
        });

        await generateAndShowReport('empleados', datosReporte);

    } catch (error) {
        console.error('Error generando reporte:', error);
        await generateAndShowReport('error', {
            titulo: "Error en reporte",
            mensaje: error.message,
            detalles: error.stack || "No hay detalles adicionales disponibles"
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
        console.log("Iniciando generación de reporte de nómina detallada...");
        await dbManager.openDb();
        dbOpened = true;

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

        // Diagnóstico 1: Verificar si el empleado existe
        console.log(`Buscando empleado con ID: ${empleadoId}`);
        const empleado = await dbManager.show('empleados', empleadoId);
        if (!empleado) {
            throw new Error(`El empleado con ID ${empleadoId} no existe en la base de datos.`);
        }
        console.log(`Empleado encontrado: ${empleado.informacion_personal?.nombres || ''} ${empleado.informacion_personal?.apellidos || ''}`);

        // Diagnóstico 2: Buscar nómina utilizando fecha_pago si 'periodo' es inconsistente
        // Agregamos una condición robusta para buscar por mes/año del campo 'fecha_pago'
        // Esto es crucial si 'periodo.mes' y 'periodo.año' no están siempre presentes/correctos.
        console.log(`Buscando nómina para el período ${mesInput}/${añoInput} para el empleado ${empleadoId} (buscando por 'periodo' o 'fecha_pago')...`);
        const nominasQuery = {
            $or: [
                { empleado_id: new ObjectId(empleadoId) }, 
                { empleado_id: empleadoId }
            ],
            $or: [ // Nueva condición OR para buscar por 'periodo' o 'fecha_pago'
                {
                    'periodo.mes': mesInput,
                    'periodo.año': añoInput
                },
                {
                    fecha_pago: { $ne: null }, // Aseguramos que fecha_pago exista
                    $expr: {
                        $and: [
                            { $eq: [ { $month: "$fecha_pago" }, mesInput ] },
                            { $eq: [ { $year: "$fecha_pago" }, añoInput ] }
                        ]
                    }
                }
            ]
        };

        const nominas = await dbManager.db.collection('nominas').find(nominasQuery).toArray();

        let nomina = null;
        if (nominas.length > 0) {
            nomina = nominas[0]; // Tomamos la primera nómina encontrada si hay varias
            console.log(`Nómina para ${mesInput}/${añoInput} encontrada.`);
        } else {
            console.log(`Nómina para ${mesInput}/${añoInput} NO encontrada. Buscando todas las nóminas existentes para diagnóstico (por empleado)...`);
            const allNominasForEmployee = await dbManager.db.collection('nominas').find({
                $or: [
                    { empleado_id: new ObjectId(empleadoId) },
                    { empleado_id: empleadoId }
                ]
            }).sort({ 'fecha_pago': -1, 'periodo.año': -1, 'periodo.mes': -1 }).toArray(); // Ordenamos para mejor diagnóstico

            // Diagnóstico 4: Verificar contrato activo
            console.log(`Buscando contrato activo para el empleado ${empleadoId}`);
            const contratoActivo = await dbManager.db.collection('contratos').findOne({
                $or: [
                    { empleado_id: new ObjectId(empleadoId) },
                    { empleado_id: empleadoId }
                ],
                estado: 'activo'
            });

            // Diagnóstico 5: Preparar mensaje de error detallado
            let mensajeError = `No se encontró nómina para ${mesInput}/${añoInput} para ${empleado.informacion_personal?.nombres || ''} ${empleado.informacion_personal?.apellidos || ''}.\n\n`;
            
            if (contratoActivo) {
                mensajeError += `Contrato activo desde: ${contratoActivo.fecha_inicio ? new Date(contratoActivo.fecha_inicio).toLocaleDateString() : 'N/A'}\n`;
                mensajeError += `Salario base: ${contratoActivo.salario_base || 'N/A'}\n\n`;
            } else {
                mensajeError += `No tiene contrato activo actualmente.\n\n`;
            }

            if (allNominasForEmployee.length > 0) {
                mensajeError += `Últimas nóminas registradas para este empleado:\n`;
                allNominasForEmployee.slice(0, 5).forEach(n => { // Muestra las últimas 5
                    // Priorizamos periodo si existe, si no, usamos fecha_pago
                    let mesNominaDisplay = '??';
                    let añoNominaDisplay = '????';

                    if (n.periodo?.mes && n.periodo?.año) {
                        mesNominaDisplay = n.periodo.mes?.toString().padStart(2, '0');
                        añoNominaDisplay = n.periodo.año?.toString();
                    } else if (n.fecha_pago) {
                        const pagoDate = new Date(n.fecha_pago);
                        if (!isNaN(pagoDate)) {
                            mesNominaDisplay = (pagoDate.getMonth() + 1).toString().padStart(2, '0');
                            añoNominaDisplay = pagoDate.getFullYear().toString();
                        }
                    }

                    const estadoNomina = n.estado || 'sin estado';
                    const fechaPagoNomina = n.fecha_pago ? new Date(n.fecha_pago).toLocaleDateString() : 'no pagada';
                    
                    mensajeError += `- ${mesNominaDisplay}/${añoNominaDisplay} (Estado: ${estadoNomina}, Pago: ${fechaPagoNomina})\n`;
                });
            } else {
                mensajeError += `No hay nóminas registradas para este empleado.\n`;
            }

            throw new Error(mensajeError);
        }

        // Obtener el contrato activo para enriquecer los datos de la nómina
        const contratoActivoParaReporte = await dbManager.db.collection('contratos').findOne({
            $or: [
                { empleado_id: new ObjectId(empleadoId) },
                { empleado_id: empleadoId }
            ],
            estado: 'activo'
        });

        // Preparar datos para el reporte HTML
        const nombreMeses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                             'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        
        // Determinar el mes y año para el reporte, priorizando el campo 'periodo' si existe,
        // sino extrayéndolo de 'fecha_pago' o usando el input original.
        let reporteMes = mesInput;
        let reporteAño = añoInput;

        if (nomina.periodo?.mes && nomina.periodo?.año) {
            reporteMes = nomina.periodo.mes;
            reporteAño = nomina.periodo.año;
        } else if (nomina.fecha_pago) {
            const pagoDate = new Date(nomina.fecha_pago);
            if (!isNaN(pagoDate)) {
                reporteMes = pagoDate.getMonth() + 1;
                reporteAño = pagoDate.getFullYear();
            }
        }

        const datosReporte = {
            empleado: {
                id: empleado._id.toString(),
                nombreCompleto: `${empleado.informacion_personal?.nombres || ''} ${empleado.informacion_personal?.apellidos || ''}`.trim(),
                identificacion: empleado.informacion_personal?.numero_identificacion || 'N/A',
                // Cargo y área deben venir del contrato
                cargo: contratoActivoParaReporte?.cargo?.nombre || 'No especificado',
                area: contratoActivoParaReporte?.area?.nombre || 'No especificado'
            },
            periodo: {
                mes: reporteMes,
                año: reporteAño,
                nombreMes: nombreMeses[reporteMes - 1] || `Mes ${reporteMes}`
            },
            nomina: {
                fecha_generacion: nomina.fecha_generation ? new Date(nomina.fecha_generation).toLocaleDateString() : 'No especificada',
                fecha_pago: nomina.fecha_pago ? new Date(nomina.fecha_pago).toLocaleDateString() : 'Pendiente',
                estado: nomina.estado || 'Desconocido',
                total_devengado: nomina.total_devengado || 0, // Typo corregido
                total_deducciones: nomina.total_deducciones || 0,
                neto_pagar: nomina.neto_pagar || 0,
                conceptos: Array.isArray(nomina.conceptos) ? nomina.conceptos : [nomina.conceptos].filter(Boolean),
                novedades: Array.isArray(nomina.novedades) ? nomina.novedades : [nomina.novedades].filter(Boolean)
            }
        };

        console.log("Datos para el reporte preparados. Generando HTML...");
        await generateAndShowReport('nomina-detalle', datosReporte);
        console.log("Reporte de nómina detallada generado exitosamente.");

    } catch (error) {
        console.error('Error al generar reporte:', error);
        // Siempre intenta mostrar un reporte de error en el navegador
        await generateAndShowReport('error', {
            titulo: "Error en Reporte de Nómina",
            mensaje: error.message.split('\n')[0] || "Error al generar reporte",
            detalles: error.message || "Verifique los datos e intente nuevamente"
        });
    } finally {
        if (dbOpened) {
            await dbManager.closeDb();
            console.log("Conexión a la base de datos cerrada.");
        }
    }
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
const generatePayrollSummaryReport = async () => {
    let dbOpened = false;
    try {
        await dbManager.openDb();
        dbOpened = true;

        const mes = parseInt(await getInput("Mes a reportar (1-12): "));
        const año = parseInt(await getInput("Año a reportar: "));
        
        if (isNaN(mes) || mes < 1 || mes > 12) {
            throw new Error("El mes debe ser un número entre 1 y 12");
        }
        
        if (isNaN(año)) {
            throw new Error("El año debe ser un número válido");
        }

        const resumen = await reportQueries.getPayrollSummaryByConcept({ mes, año });
        
        if (!resumen || resumen.length === 0) {
            throw new Error(`No hay datos para ${mes}/${año}`);
        }

        await generateAndShowReport('nomina-resumen', {
            periodo: `${mes}/${año}`,
            conceptos: resumen,
            totalGeneral: resumen.reduce((sum, item) => sum + (item.total_valor || 0), 0)
        });
    } catch (error) {
        console.error('Error en resumen de nómina:', error);
        await generateAndShowReport('error', {
            titulo: "Error en resumen",
            mensaje: error.message,
            detalles: "Verifique el periodo ingresado"
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
        '3': generateTransportSubsidyReport,
        '4': generatePayrollSummaryReport,
        '5': showMainMenu
    };
    
    await (actions[opt] || (() => {
        console.log("Opción inválida");
        return manageReports();
    }))();
    
    if (opt !== '5') await manageReports();
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