import dbManager from './crud.js';
let rl; // Variable que se inicializará desde fuera

export class Empleado {
    constructor(informacion_personal, estado) {
        this.informacion_personal = informacion_personal;
        this.estado = estado;
    }
}

// Función para inicializar readline desde el módulo principal
export function setReadline(readlineInterface) {
    rl = readlineInterface;
}

async function getInput(prompt) {
    return new Promise((resolve) => {
        rl.question(prompt, (answer) => {
            resolve(answer.trim());
        });
    });
}

async function infoUser() {
    console.log("\n📝 Ingrese los datos del empleado:");
    
    const informacion_personal = {
        nombres: await getInput("Nombres: "),
        apellidos: await getInput("Apellidos: "),
        tipo_identificacion: await getInput("Tipo identificación: "),
        numero_identificacion: await getInput("Número identificación: "),
        genero: await getInput("Género: ")
    };
    
    const estado = await getInput("Estado (activo/inactivo/suspendido): ");
    
    if (!informacion_personal.nombres || !informacion_personal.apellidos) {
        throw new Error("Nombre y apellido son obligatorios");
    }
    
    return { informacion_personal, estado };
}

export async function createEmpleado(dbManager) {
    try {
        const { informacion_personal, estado } = await infoUser();
        const result = await dbManager.create('empleados', { 
            informacion_personal, 
            estado,
            fechaCreacion: new Date()
        });
        
        console.log("\n✅ Empleado creado exitosamente");
        console.log("- ID:", result.insertedId);
        console.log("- Nombre:", informacion_personal.nombres, informacion_personal.apellidos);
        console.log("- Estado:", estado);
        
        return result;
    } catch (error) {
        console.error("\n❌ Error al crear empleado:", error.message);
        throw error;
    }
}

export async function listEmpleados(dbManager) {
    try {
        const lista = await dbManager.list('empleados');
        console.log("\n📋 Lista de Empleados:");
        lista.forEach((emp, index) => {
            console.log(`${index + 1}. ${emp.informacion_personal.nombres} ${emp.informacion_personal.apellidos} - ${emp.estado}`);
        });
        return lista;
    } catch (error) {
        console.error("\n❌ Error al listar empleados:", error.message);
        throw error;
    }
}

export async function showEmpleado(dbManager) {
    try {
        const id = await getInput("Ingrese ID del empleado a buscar: ");
        const empleado = await dbManager.show('empleados', id);
        
        if (empleado) {
            console.log("\n🔍 Empleado encontrado:");
            console.log(empleado);
        } else {
            console.log("\n⚠️ Empleado no encontrado");
        }
        
        return empleado;
    } catch (error) {
        console.error("\n❌ Error al buscar empleado:", error.message);
        throw error;
    }
}

export async function updateEmpleado(dbManager) {
    try {
        const id = await getInput("Ingrese ID del empleado a actualizar: ");
        const { informacion_personal, estado } = await infoUser();
        
        const result = await dbManager.update('empleados', id, { 
            informacion_personal, 
            estado,
            fechaActualizacion: new Date()
        });
        
        if (result.modifiedCount > 0) {
            console.log("\n✅ Empleado actualizado correctamente");
        } else {
            console.log("\n⚠️ No se encontró el empleado para actualizar");
        }
        
        return result;
    } catch (error) {
        console.error("\n❌ Error al actualizar empleado:", error.message);
        throw error;
    }
}

export async function deleteEmpleado(dbManager) {
    try {
        const id = await getInput("Ingrese ID del empleado a eliminar: ");
        const result = await dbManager.delete('empleados', id);
        
        if (result.deletedCount > 0) {
            console.log("\n✅ Empleado eliminado correctamente");
        } else {
            console.log("\n⚠️ No se encontró el empleado para eliminar");
        }
        
        return result;
    } catch (error) {
        console.error("\n❌ Error al eliminar empleado:", error.message);
        throw error;
    }
}

export default {
    createEmpleado,
    listEmpleados,
    showEmpleado,
    updateEmpleado,
    deleteEmpleado,
    setReadline
};