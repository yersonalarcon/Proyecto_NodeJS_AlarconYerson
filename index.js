import readline from 'readline';
import { MongoClient, ObjectId } from 'mongodb';
import dbManager from './crud.js';
import factory from './factory.js';
import { createEmpleado, listEmpleados, showEmpleado, updateEmpleado, deleteEmpleado } from './empleados.js';
import empleados from './empleados.js';
import conceptos from './conceptos.js';
import contratos from './contratos.js';
import nominas from './nominas.js';
import { setReadline } from './empleados.js';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

setReadline(rl);


async function createMenu() {
    console.log("\nMenu Principal:");
    console.log("1. Cargar archivos");
    console.log("2. Gestor de empleados");
    console.log("3. Gestor de contratos");
    console.log("4. Gestor de nominas");
    console.log("5. Salir");
    
    rl.question("Seleccione una opción: ", async (opt) => {
        switch(opt) {
            case '1':
                await loadFiles();
                break;
            case '2':
                await manageEmployes();
                break;
            case '3':
                await manageContracts();
                break;
            case '4':
                await manageNomina();
                break;
            case '5':
                await dbManager.closeDb();
                rl.close();
                break;
            default:
                console.log("Opción no válida. Intente de nuevo.");
                createMenu();
        }
    });
}

async function loadFiles() {
    console.log("Función para cargar archivos");
    createMenu();
}

async function manageEmployes() {
    console.log("\nGestión de Empleados:");
    console.log("1. Crear Empleado");
    console.log("2. Listar Empleados");
    console.log("3. Ver Empleado");
    console.log("4. Actualizar Empleado");
    console.log("5. Eliminar Empleado");
    console.log("6. Volver al Menú Principal");
    
    rl.question("Seleccione una opción: ", async (opt) => {
        switch(opt) {
            case '1':
                await createEmpleado(dbManager);
                await manageEmployes(); // Volver al menú después de completar
                break;
            case '2':
                await listEmpleados(dbManager);
                await manageEmployes();
                break;
            case '3':
                await showEmpleado(dbManager);
                await manageEmployes();
                break;
            case '4':
                await updateEmpleado(dbManager);
                await manageEmployes();
                break;
            case '5':
                await deleteEmpleado(dbManager);
                await manageEmployes();
                break;
            case '6':
                createMenu();
                break;
            default:
                console.log("Opción no válida. Intente de nuevo.");
                manageEmployes();
        }
    });
}


async function manageContracts() {
    console.log("\nGestión de Contratos:");
    console.log("1. Crear Contrato");
    console.log("2. Listar Contratos");
    console.log("3. Ver Contrato");
    console.log("4. Actualizar Contrato");
    console.log("5. Eliminar Contrato");
    console.log("6. Volver al Menú Principal");
    
    rl.question("Seleccione una opción: ", async (opt) => {
        switch(opt) {
            case '1':
                await contratos.createContrato(dbManager);
                break;
            case '2':
                await contratos.listContratos(dbManager);
                break;
            case '3':
                await contratos.showContrato(dbManager);
                break;
            case '4':
                await contratos.updateContrato(dbManager);
                break;
            case '5':
                await contratos.deleteContrato(dbManager);
                break;
            case '6':
                createMenu();
                break;
            default:
                console.log("Opción no válida. Intente de nuevo.");
                manageContracts();
        }
    });
}

async function manageNomina() {
    console.log("\nGestión de Nóminas:");
    console.log("1. Crear Nómina");
    console.log("2. Listar Nóminas");
    console.log("3. Ver Nómina");
    console.log("4. Actualizar Nómina");
    console.log("5. Eliminar Nómina");
    console.log("6. Volver al Menú Principal");
    
    rl.question("Seleccione una opción: ", async (opt) => {
        switch(opt) {
            case '1':
                await nominas.createNomina(dbManager);
                break;
            case '2':
                await nominas.listNominas(dbManager);
                break;
            case '3':
                await nominas.showNomina(dbManager);
                break;
            case '4':
                await nominas.updateNomina(dbManager);
                break;
            case '5':
                await nominas.deleteNomina(dbManager);
                break;
            case '6':
                createMenu();
                break;
            default:
                console.log("Opción no válida. Intente de nuevo.");
                manageNomina();
        }
    });
}


async function main() {
    try {
        await dbManager.openDb();
        console.log("Conexión a la base de datos establecida.");
        createMenu();
    } catch (error) {
        console.error("Error al conectar a la base de datos:", error);
        rl.close();
    }
}

main().catch(error => {
    console.error("Error en la ejecución del programa:", error);
    rl.close();
});

