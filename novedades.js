export class novedades{
    constructor(codigo,nombre,afecta){
        this.codigo = codigo;
        this.nombre = nombre;
        this.afecta = afecta;
    }
}
export function setReadline(readlineInterface) {
    rl = readlineInterface;
}
async function createNovedad(dbManager, codigo, nombre, afecta) {
    const novedad = new novedades(codigo, nombre, afecta);
    await dbManager.create('novedades', novedad);
    console.log("Novedad creada:", novedad);
}
async function listNovedades(dbManager) {
    const novedades = await dbManager.list('novedades');
    console.log("Lista de Novedades:", novedades);
}
async function showNovedad(dbManager, id) {
    const novedad = await dbManager.show('novedades', id);
    if (novedad) {
        console.log("Novedad encontrada:", novedad);
    } else {
        console.log("Novedad no encontrada");
    }
}
async function updateNovedad(dbManager, id, codigo, nombre, afecta) {
    const novedad = new novedades(codigo, nombre, afecta);
    const result = await dbManager.update('novedades', id, novedad);
    if (result.modifiedCount > 0) {
        console.log("Novedad actualizada:", result);
    } else {
        console.log("No se pudo actualizar la novedad o no se encontraron cambios");
    }
}
async function deleteNovedad(dbManager, id) {
    const result = await dbManager.delete('novedades', id);
    if (result.deletedCount > 0) {
        console.log("Novedad eliminada:", result);
    } else {
        console.log("No se pudo eliminar la novedad o no se encontró");
    }
}
export default {
    createNovedad,
    listNovedades,
    showNovedad,
    updateNovedad,
    deleteNovedad
};
