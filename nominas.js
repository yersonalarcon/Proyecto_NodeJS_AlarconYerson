export class nominas{
    constructor(empleado_id,periodo,fecha_generacion,estado,total_devengado,total_deducciones,neto_pagar){
        this.empleado_id = empleado_id; // ID del empleado
        this.periodo = periodo; // Periodo de la nómina (ej. "2023-09")
        this.fecha_generacion = fecha_generacion; // Fecha de generación de la nómina
        this.estado = estado; // Generada, pagada, anulada
        this.total_devengado = total_devengado; // Total devengado en el periodo
        this.total_deducciones = total_deducciones; // Total de deducciones en el periodo
        this.neto_pagar = neto_pagar; // Neto a pagar al empleado
    }
}
export function setReadline(readlineInterface) {
    rl = readlineInterface;
}

async function createNomina(dbManager, empleado_id, periodo, fecha_generacion, estado, total_devengado, total_deducciones, neto_pagar) {
    const nomina = new nominas(empleado_id, periodo, fecha_generacion, estado, total_devengado, total_deducciones, neto_pagar);
    await dbManager.create('nominas', nomina);
    console.log("Nómina creada:", nomina);
}
async function listNominas(dbManager) {
    const nominas = await dbManager.list('nominas');
    console.log("Lista de Nóminas:", nominas);
}
async function showNomina(dbManager, id) {
    const nomina = await dbManager.show('nominas', id);
    if (nomina) {
        console.log("Nómina encontrada:", nomina);
    } else {
        console.log("Nómina no encontrada");
    }
}
async function updateNomina(dbManager, id, empleado_id, periodo, fecha_generacion, estado, total_devengado, total_deducciones, neto_pagar) {
    const nomina = new nominas(empleado_id, periodo, fecha_generacion, estado, total_devengado, total_deducciones, neto_pagar);
    const result = await dbManager.update('nominas', id, nomina);
    if (result.modifiedCount > 0) {
        console.log("Nómina actualizada:", result);
    } else {
        console.log("No se pudo actualizar la nómina o no se encontraron cambios");
    }
}
async function deleteNomina(dbManager, id) {
    const result = await dbManager.delete('nominas', id);
    if (result.deletedCount > 0) {
        console.log("Nómina eliminada:", result);
    } else {
        console.log("No se pudo eliminar la nómina o no se encontró");
    }
}
export default {
    createNomina,
    listNominas,
    showNomina,
    updateNomina,
    deleteNomina
};