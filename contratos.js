export class contratos{
    constructor(empleado_id, tipo_contrato,fecha_inicio,salario_base,area,cargo,estado){
        this.empleado_id = empleado_id; // ID del empleado
        this.tipo_contrato = tipo_contrato; // indefinido, fijo, temporal
        this.fecha_inicio = fecha_inicio; // Fecha de inicio del contrato
        this.salario_base = salario_base; // Salario base del contrato
        this.area = area; // Área del contrato
        this.cargo = cargo; // Cargo del contrato
        this.estado = estado; // activo, inactivo
    }
}
export function setReadline(readlineInterface) {
    rl = readlineInterface;
}

async function createContrato(dbManager, empleado_id, tipo_contrato, fecha_inicio, salario_base, area, cargo, estado) {
    const contrato = new contratos(empleado_id, tipo_contrato, fecha_inicio, salario_base, area, cargo, estado);
    await dbManager.create('contratos', contrato);
    console.log("Contrato creado:", contrato);
}

async function listContratos(dbManager) {
    const contratos = await dbManager.list('contratos');
    console.log("Lista de Contratos:", contratos);
}
async function showContrato(dbManager, id) {
    const contrato = await dbManager.show('contratos', id);
    if (contrato) {
        console.log("Contrato encontrado:", contrato);
    } else {
        console.log("Contrato no encontrado");
    }
}
async function updateContrato(dbManager, id, empleado_id, tipo_contrato, fecha_inicio, salario_base, area, cargo, estado) {
    const contrato = new contratos(empleado_id, tipo_contrato, fecha_inicio, salario_base, area, cargo, estado);
    const result = await dbManager.update('contratos', id, contrato);
    if (result.modifiedCount > 0) {
        console.log("Contrato actualizado:", result);
    } else {
        console.log("No se pudo actualizar el contrato o no se encontraron cambios");
    }
}
async function deleteContrato(dbManager, id) {
    const result = await dbManager.delete('contratos', id);
    if (result.deletedCount > 0) {
        console.log("Contrato eliminado:", result);
    } else {
        console.log("No se pudo eliminar el contrato o no se encontró");
    }
}
export default {
    createContrato,
    listContratos,
    showContrato,
    updateContrato,
    deleteContrato
};
