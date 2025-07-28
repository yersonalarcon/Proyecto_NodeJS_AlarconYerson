// crearhtml.js
import { ObjectId } from 'mongodb'; // Importa ObjectId para poder verificar su tipo

export function crearHtml(tipoReporte, datos) {
    let html = `<!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reporte ${tipoReporte} - Acme Corporate</title>
        <style>
            ${getCSS()}
        </style>
    </head>
    <body>
        <header>
            <div class="logo-container">
                <img src="data:image/svg+xml;base64,${getLogoBase64()}" alt="Logo Acme Corporate" class="logo">
                <h1>Acme Corporate</h1>
            </div>
            <p class="report-title">${getReportTitle(tipoReporte)}</p>
            <p class="report-date">Generado el: ${new Date().toLocaleDateString()}</p>
        </header>
        
        <main>
            ${generateReportContent(tipoReporte, datos)}
        </main>
        
        <footer>
            <p>Sistema de Gestión de Nómina - Acme Corporate</p>
        </footer>
    </body>
    </html>`;
    
    return html;
}

function getLogoBase64() {
    return 'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMDAgMTAwIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2U3NGMzYyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSJ3aGl0ZSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXdlaWdodD0iYm9sZCIgZm9udC1zaXplPSIyMCI+QUNNRTwvdGV4dD48L3N2Zz4=';
}

function getReportTitle(tipoReporte) {
    const titles = {
        'empleados': 'Listado de Empleados por Área y Cargo',
        'nomina-detalle': 'Detalle de Nómina',
        'empleados-transporte': 'Empleados con Derecho a Auxilio de Transporte',
        'nomina-resumen': 'Resumen de Nómina por Concepto',
        'error': 'Error en el reporte'
    };
    return titles[tipoReporte] || 'Reporte de Acme Corporate';
}

/**
 * Función auxiliar para formatear valores antes de mostrarlos en HTML.
 * Convierte ObjectIds a strings y maneja valores nulos/indefinidos.
 * @param {*} value El valor a formatear.
 * @returns {string} El valor formateado como string.
 */
function formatValueForHtml(value) {
    if (value === null || value === undefined) {
        return 'N/A';
    }
    // Verifica si es un ObjectId de MongoDB y lo convierte a string hexadecimal
    if (typeof value === 'object' && value instanceof ObjectId) {
        return value.toHexString();
    }
    // Si es una fecha, puedes formatearla si es necesario
    if (value instanceof Date) {
        return value.toLocaleDateString(); // O value.toLocaleString() para fecha y hora
    }
    // Para otros tipos, simplemente conviértelo a string
    return value.toString();
}

function generateReportContent(tipoReporte, datos) {
    switch(tipoReporte) {
        case 'empleados':
            return generateEmployeeList(datos);
        case 'nomina-detalle':
            return generatePayrollDetail(datos);
        case 'empleados-transporte':
            return generateTransportSubsidyList(datos);
        case 'nomina-resumen':
            return generatePayrollSummary(datos);
        case 'error':
            return generateErrorReport(datos);
        default:
            return '<p>Reporte no especificado</p>';
    }
}

function generateErrorReport(errorData) {
    return `
    <div class="error-container">
        <h2>${errorData.titulo || 'Error al generar el reporte'}</h2>
        <p class="error-message">${errorData.mensaje || 'Ocurrió un error desconocido'}</p>
        ${errorData.detalles ? `<div class="error-details">${errorData.detalles}</div>` : ''}
    </div>
    `;
}

function generateEmployeeList(empleados) {
    if (!empleados || empleados.length === 0) {
        return `
        <div class="no-data">
            <p>No se encontraron empleados con contratos activos</p>
        </div>
        `;
    }

    let html = '<table><thead><tr><th>Área</th><th>Cargo</th><th>Tipo ID</th><th>Número ID</th><th>Nombres</th><th>Apellidos</th><th>Teléfono</th><th>Email</th><th>Género</th></tr></thead><tbody>';
    
    empleados.forEach(emp => {
        html += `
        <tr>
            <td>${formatValueForHtml(emp.area_nombre)}</td>
            <td>${formatValueForHtml(emp.cargo_nombre)}</td>
            <td>${formatValueForHtml(emp.tipo_identificacion)}</td>
            <td>${formatValueForHtml(emp.numero_identificacion)}</td>
            <td>${formatValueForHtml(emp.nombres)}</td>
            <td>${formatValueForHtml(emp.apellidos)}</td>
            <td>${formatValueForHtml(emp.telefono)}</td>
            <td>${formatValueForHtml(emp.email)}</td>
            <td>${formatValueForHtml(emp.genero)}</td>
        </tr>`;
    });
    
    html += '</tbody></table>';
    html += `<div class="summary">Total empleados: ${empleados.length}</div>`;
    
    return html;
}

function generatePayrollDetail(datos) { // Cambiamos el nombre del parámetro a 'datos' para ser más claro
    // El objeto 'datos' aquí es el 'datosReporte' que se genera en index.js
    // Contiene 'empleado', 'periodo', y 'nomina' como sub-objetos.

    // Desestructuramos para facilitar el acceso
    const { empleado, periodo, nomina } = datos;

    if (!nomina || !empleado || !periodo) {
        return `
        <div class="no-data">
            <p>No se encontraron datos completos de nómina para generar el reporte.</p>
        </div>
        `;
    }

    let html = `
    <div class="employee-details">
        <div class="detail-row">
            <span class="detail-label">Empleado:</span>
            <span>${formatValueForHtml(empleado.nombreCompleto)}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Identificación:</span>
            <span>${formatValueForHtml(empleado.identificacion)}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Cargo:</span>
            <span>${formatValueForHtml(empleado.cargo)}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Área:</span>
            <span>${formatValueForHtml(empleado.area)}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Periodo:</span>
            <span>${formatValueForHtml(periodo.nombreMes)} / ${formatValueForHtml(periodo.año)}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Fecha de Generación:</span>
            <span>${formatValueForHtml(nomina.fecha_generacion)}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Fecha de Pago:</span>
            <span>${formatValueForHtml(nomina.fecha_pago)}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Estado:</span>
            <span>${formatValueForHtml(nomina.estado)}</span>
        </div>
    </div>
    `;

    // Sección de devengados
    if (nomina.conceptos && nomina.conceptos.length > 0) {
        html += `
        <div class="earnings">
            <h3 class="section-title">Conceptos Devengados</h3>
            <table>
                <thead>
                    <tr>
                        <th>Código</th>
                        <th>Descripción</th>
                        <th>Valor</th>
                    </tr>
                </thead>
                <tbody>`;
        
        nomina.conceptos.forEach(concepto => {
            html += `
                    <tr>
                        <td>${formatValueForHtml(concepto.codigo_concepto)}</td>
                        <td>${formatValueForHtml(concepto.descripcion)}</td>
                        <td>${concepto.valor !== undefined && concepto.valor !== null ? '$' + concepto.valor.toLocaleString('es-CO') : 'N/A'}</td>
                    </tr>`;
        });
        
        html += `
                </tbody>
            </table>
            <div class="detail-row total">
                <span class="detail-label">Total Devengado:</span>
                <span>${nomina.total_devengado !== undefined && nomina.total_devengado !== null ? '$' + nomina.total_devengado.toLocaleString('es-CO') : 'N/A'}</span>
            </div>
        </div>`;
    } else {
        html += `
        <div class="earnings">
            <h3 class="section-title">Conceptos Devengados</h3>
            <p>No hay conceptos devengados registrados para esta nómina.</p>
        </div>`;
    }

    // Sección de deducciones (si hay novedades)
    if (nomina.novedades && nomina.novedades.length > 0) {
        html += `
        <div class="deductions">
            <h3 class="section-title">Novedades y Deducciones</h3>
            <table>
                <thead>
                    <tr>
                        <th>Código</th>
                        <th>Descripción</th>
                        <th>Días</th>
                        <th>Valor</th>
                    </tr>
                </thead>
                <tbody>`;
        
        nomina.novedades.forEach(novedad => {
            html += `
                    <tr>
                        <td>${formatValueForHtml(novedad.codigo_novedad)}</td>
                        <td>${formatValueForHtml(novedad.descripcion)}</td>
                        <td>${formatValueForHtml(novedad.dias)}</td>
                        <td>${novedad.valor !== undefined && novedad.valor !== null ? '$' + novedad.valor.toLocaleString('es-CO') : 'N/A'}</td>
                    </tr>`;
        });
        
        html += `
                </tbody>
            </table>
            <div class="detail-row total">
                <span class="detail-label">Total Deducciones:</span>
                <span>${nomina.total_deducciones !== undefined && nomina.total_deducciones !== null ? '$' + nomina.total_deducciones.toLocaleString('es-CO') : 'N/A'}</span>
            </div>
        </div>`;
    } else {
        html += `
        <div class="deductions">
            <h3 class="section-title">Novedades y Deducciones</h3>
            <p>No hay novedades o deducciones registradas para esta nómina.</p>
        </div>`;
    }

    html += `
        <div class="detail-row grand-total">
            <span class="detail-label">Neto a Pagar:</span>
            <span>${nomina.neto_pagar !== undefined && nomina.neto_pagar !== null ? '$' + nomina.neto_pagar.toLocaleString('es-CO') : 'N/A'}</span>
        </div>
    </div>`;

    return html;
}

function generateTransportSubsidyList(empleados) {
    if (!empleados || empleados.length === 0) {
        return `
        <div class="no-data">
            <p>No se encontraron empleados con derecho a auxilio de transporte</p>
        </div>
        `;
    }

    let html = '<table><thead><tr><th>Nombres</th><th>Apellidos</th><th>Identificación</th><th>Salario Base</th><th>Auxilio Transporte</th></tr></thead><tbody>';
    
    empleados.forEach(emp => {
        html += `
        <tr>
            <td>${formatValueForHtml(emp.nombres)}</td>
            <td>${formatValueForHtml(emp.apellidos)}</td>
            <td>${formatValueForHtml(emp.identificacion)}</td>
            <td>${emp.salario_base ? '$' + emp.salario_base.toLocaleString() : 'N/A'}</td>
            <td>${emp.auxilio_transporte ? '$' + emp.auxilio_transporte.toLocaleString() : 'N/A'}</td>
        </tr>`;
    });
    
    html += '</tbody></table>';
    html += `<div class="summary">Total empleados: ${empleados.length}</div>`;
    
    return html;
}

function generatePayrollSummary(resumen) {
    if (!resumen || resumen.length === 0) {
        return `
        <div class="no-data">
            <p>No se encontraron datos de nómina para el periodo especificado</p>
        </div>
        `;
    }

    let html = '<table><thead><tr><th>Código</th><th>Concepto</th><th>Tipo</th><th>Total Valor</th><th>Cantidad Empleados</th></tr></thead><tbody>';
    
    resumen.forEach(item => {
        html += `
        <tr>
            <td>${formatValueForHtml(item.codigo_concepto)}</td>
            <td>${formatValueForHtml(item.nombre_concepto)}</td>
            <td>${formatValueForHtml(item.tipo_concepto)}</td>
            <td>${item.total_valor ? '$' + item.total_valor.toLocaleString() : 'N/A'}</td>
            <td>${formatValueForHtml(item.cantidad_empleados)}</td>
        </tr>`;
    });
    
    html += '</tbody></table>';
    html += `<div class="summary">Total conceptos: ${resumen.length}</div>`;
    
    return html;
}

function getCSS() {
    return `
    /* Estilos anteriores... */
    
    .error-container {
        background-color: #ffeeee;
        border: 1px solid #ffcccc;
        padding: 20px;
        margin: 20px 0;
        border-radius: 5px;
    }
    
    .error-message {
        color: #d9534f;
        font-weight: bold;
        margin: 10px 0;
    }
    
    .error-details {
        margin-top: 15px;
        padding: 10px;
        background-color: #fff;
        border: 1px solid #ddd;
        border-radius: 3px;
        font-family: monospace;
        white-space: pre-wrap;
    }
    ` + /* Resto del CSS original */ `
    * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    }
    
    body {
        color: #333;
        line-height: 1.6;
    }
    
    header {
        background-color: #2c3e50;
        color: white;
        padding: 20px;
        text-align: center;
        border-bottom: 5px solid #e74c3c;
    }
    
    .logo-container {
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 15px;
    }
    
    .logo {
        height: 50px;
        margin-right: 15px;
    }
    
    .report-title {
        font-size: 1.5em;
        font-weight: bold;
        margin: 10px 0;
    }
    
    .report-date {
        font-size: 0.9em;
        opacity: 0.8;
    }
    
    main {
        padding: 20px;
    }
    
    table {
        width: 100%;
        border-collapse: collapse;
        margin: 20px 0;
    }
    
    th, td {
        padding: 12px 15px;
        text-align: left;
        border-bottom: 1px solid #ddd;
    }
    
    th {
        background-color: #f2f2f2;
        font-weight: bold;
    }
    
    tr:hover {
        background-color: #f5f5f5;
    }
    
    .employee-details {
        margin: 20px 0;
        padding: 15px;
        background-color: #f9f9f9;
        border-left: 4px solid #e74c3c;
    }
    
    .detail-row {
        display: flex;
        margin-bottom: 10px;
    }
    
    .detail-label {
        font-weight: bold;
        min-width: 150px;
    }
    
    .deductions, .earnings {
        margin-top: 20px;
    }
    
    .section-title {
        font-size: 1.2em;
        color: #2c3e50;
        margin: 15px 0 10px 0;
        padding-bottom: 5px;
        border-bottom: 2px solid #e74c3c;
    }
    
    .summary {
        background-color: #2c3e50;
        color: white;
        padding: 15px;
        margin-top: 20px;
        border-radius: 5px;
    }
    
    footer {
        text-align: center;
        padding: 15px;
        background-color: #f2f2f2;
        margin-top: 20px;
        font-size: 0.9em;
    }
    `;
}

export {
    getLogoBase64,
    getCSS,
    getReportTitle,
    generateReportContent
};