import empleados from './empleados.js';
import conceptos from './conceptos.js';
import contratos from './contratos.js';
import nominas from './nominas.js';

class Factory {
    static createEmpleado(informacion_personal, estado) {
        return new empleados(informacion_personal, estado);
    }
    
    static createConcepto(nombre, tipo, valor) {
        return new conceptos(nombre, tipo, valor);
    }
    
    static createContrato(empleado_id, tipo_contrato, fecha_inicio, salario_base, area, cargo, estado) {
        return new contratos(empleado_id, tipo_contrato, fecha_inicio, salario_base, area, cargo, estado);
    }
    
    static createNomina(empleado_id, periodo, fecha_generacion, estado, total_devengado, total_deducciones, neto_pagar) {
        return new nominas(empleado_id, periodo, fecha_generacion, estado, total_devengado, total_deducciones, neto_pagar);
    }
}

export default Factory;
