export class conceptos{
    constructor(codigo, nombre , tipo){
        this.codigo = codigo;
        this.nombre = nombre;
        this.tipo = tipo;
    }
}
export function setReadline(readlineInterface) {
    rl = readlineInterface;
}
async function createConcepto(dbManager, codigo, nombre, tipo) {
    const concepto = new conceptos(codigo, nombre, tipo);
    await dbManager.create('conceptos', concepto);
    console.log("Concepto creado:", concepto);
}
async function listConceptos(dbManager) {
    const conceptos = await dbManager.list('conceptos');
    console.log("Lista de Conceptos:", conceptos);
}
async function showConcepto(dbManager, id) {
    const concepto = await dbManager.show('conceptos', id);
    if (concepto) {
        console.log("Concepto encontrado:", concepto);
    } else {
        console.log("Concepto no encontrado");
    }
}
async function updateConcepto(dbManager, id, codigo, nombre, tipo) {
    const concepto = new conceptos(codigo, nombre, tipo);
    const result = await dbManager.update('conceptos', id, concepto);
    if (result.modifiedCount > 0) {
        console.log("Concepto actualizado:", result);
    } else {
        console.log("No se pudo actualizar el concepto o no se encontraron cambios");
    }
}
async function deleteConcepto(dbManager, id) {
    const result = await dbManager.delete('conceptos', id);
    if (result.deletedCount > 0) {
        console.log("Concepto eliminado:", result);
    } else {
        console.log("No se pudo eliminar el concepto o no se encontró");
    }
}
export default {
    createConcepto,
    listConceptos,
    showConcepto,
    updateConcepto,
    deleteConcepto
};
