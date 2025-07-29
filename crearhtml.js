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
 * Ahora también maneja objetos y arrays.
 * @param {*} value El valor a formatear.
 * @returns {string} El valor formateado como string.
 */
function formatValueForHtml(value) {
    if (value === null || value === undefined || value === '') {
        return 'N/A';
    }
    // Verifica si es un ObjectId de MongoDB y lo convierte a string hexadecimal
    if (typeof value === 'object' && value instanceof ObjectId) {
        return value.toHexString();
    }
    // Si es una fecha, formatearla
    if (value instanceof Date) {
        return value.toLocaleDateString(); // O value.toLocaleString() para fecha y hora
    }
    // Si es un array, unirlos con coma (o un formato más específico si se requiere)
    if (Array.isArray(value)) {
        if (value.length === 0) return 'N/A';
        // Esto es útil para arrays de strings/números. Para arrays de objetos, necesitarías un mapeo más complejo.
        return value.map(item => formatValueForHtml(item)).join(', ');
    }
    // Si es un objeto, intentar serializarlo a string (ej. para debugging) o acceder a propiedades específicas
    if (typeof value === 'object') {
        // Podrías intentar mostrar una propiedad específica si sabes cuál es relevante
        // Ejemplo: if (value.nombre) return value.nombre;
        // O simplemente convertirlo a una representación JSON para ver su contenido
        try {
            // Evita stringify si es un ObjectId ya que ya se manejó
            if (value instanceof ObjectId) return value.toHexString();
            return JSON.stringify(value);
        } catch (e) {
            return '[Objeto Ilegible]';
        }
    }
    // Para otros tipos (números, strings, booleans), simplemente convertirlos a string
    return value.toString();
}

function generateReportContent(tipoReporte, datos) {
    switch(tipoReporte) {
        case 'empleados':
            return generateEmployeeList(datos);
        case 'nomina-detalle':
            return generatePayrollDetail(datos); // Aquí se pasa el objeto completo 'datos'
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
        <h2>${formatValueForHtml(errorData.titulo)}</h2>
        <p class="error-message">${formatValueForHtml(errorData.mensaje)}</p>
        ${errorData.detalles ? `<div class="error-details">${formatValueForHtml(errorData.detalles)}</div>` : ''}
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
            <td>${emp.salario_base ? '$' + emp.salario_base.toLocaleString('es-CO') : 'N/A'}</td>
            <td>${emp.auxilio_transporte ? '$' + emp.auxilio_transporte.toLocaleString('es-CO') : 'N/A'}</td>
        </tr>`;
    });
    
    html += '</tbody></table>';
    html += `<div class="summary">Total empleados: ${empleados.length}</div>`;
    
    return html;
}

function generatePayrollDetail(datosReporte) {
    const empleado = datosReporte.empleado;
    const nomina = datosReporte.nomina;
    const periodo = datosReporte.periodo;

    let html = `
        <h2>Detalle de Nómina para ${formatValueForHtml(empleado.nombreCompleto)} (${formatValueForHtml(periodo?.mes)} / ${formatValueForHtml(periodo?.año)})</h2>
        <div class="employee-details">
            <div class="detail-row"><span class="detail-label">Nombre Completo:</span> <span>${formatValueForHtml(empleado.nombreCompleto)}</span></div>
            <div class="detail-row">
                <span class="detail-label">Tipo y No. Identificación:</span>
                <span>${empleado.tipoIdentificacion || 'N/A'} - ${empleado.identificacion || 'N/A'}</span>
            </div>
            <div class="detail-row"><span class="detail-label">Cargo:</span> <span>${formatValueForHtml(empleado.cargo)}</span></div>
            <div class="detail-row"><span class="detail-label">Área:</span> <span>${formatValueForHtml(empleado.area)}</span></div>
        </div>

        <h3>Detalles de la Nómina</h3>
        <div class="payroll-summary-details">
            <div class="detail-row"><span class="detail-label">Fecha de Generación:</span> <span> ${formatValueForHtml(nomina.fecha_generacion)}</span></div>
            <div class="detail-row"><span class="detail-label">Fecha de Pago:</span> <span>${formatValueForHtml(nomina.fecha_pago)}</span></div>
            <div class="detail-row"><span class="detail-label">Estado:</span> <span>${formatValueForHtml(nomina.estado)}</span></div>
            <div class="detail-row"><span class="detail-label">Salario Base:</span> <span>$${(nomina.salario_base || 0).toLocaleString('es-CO')}</span></div>
            <div class="detail-row"><span class="detail-label">Total Devengado:</span> <span>$${(nomina.total_devengado || 0).toLocaleString('es-CO')}</span></div>
            <div class="detail-row"><span class="detail-label">Total Deducciones:</span> <span>$${(nomina.total_deducciones || 0).toLocaleString('es-CO')}</span></div>
            <div class="detail-row"><span class="detail-label">Neto a Pagar:</span> <span>$${(nomina.neto_pagar || 0).toLocaleString('es-CO')}</span></div>
        </div>
        <h3>Novedades</h3>
        ${nomina.novedades && nomina.novedades.length > 0 ? `
        <div class="novelties">
            <table>
                <thead>
                    <tr>
                        <th>Descripción</th>
                        <th>Valor</th>
                    </tr>
                </thead>
                <tbody>
                    ${nomina.novedades.map(n => `
                        <tr>
                            <td>${formatValueForHtml(n?.descripcion)}</td>
                            <td>$${(n?.valor || 0).toLocaleString('es-CO')}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>` : '<p>No hay novedades registradas para esta nómina.</p>'}
    `;

    return html;
}

function generatePayrollSummary(datosReporte) {
    const resumenConceptos = datosReporte.conceptos; 
    const periodo = datosReporte.periodo;
    const totalGeneral = datosReporte.totalGeneral;

    if (!resumenConceptos || !Array.isArray(resumenConceptos) || resumenConceptos.length === 0) {
        return `<p>No hay conceptos de nómina para el período ${formatValueForHtml(periodo?.mes)} / ${formatValueForHtml(periodo?.año)}.</p>`;
    }

    let html = `
        <h2>Resumen de Nómina por Concepto para ${formatValueForHtml(periodo?.mes)} / ${formatValueForHtml(periodo?.año)}</h2>
        <table>
            <thead>
                <tr>
                    <th>Código</th>
                    <th>Nombre Concepto</th>
                    <th>Tipo</th>
                    <th>Descripción</th>
                    <th>Total Valor</th>
                    <th>Cant. Empleados</th>
                    <th>Valor Promedio</th>
                </tr>
            </thead>
            <tbody>
    `;

    resumenConceptos.forEach(item => { 
        html += `
            <tr>
                <td>${formatValueForHtml(item.codigo)}</td>
                <td>${formatValueForHtml(item.nombre)}</td>
                <td>${formatValueForHtml(item.tipo)}</td>
                <td>${formatValueForHtml(item.descripcion)}</td>
                <td>$${(item.total_valor || 0).toLocaleString('es-CO')}</td>
                <td>${formatValueForHtml(item.cantidad_empleados)}</td>
                <td>$${(item.valor_promedio || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
        `;
    });

    html += `
            </tbody>
            <tfoot>
                <tr>
                    <td colspan="4" style="text-align: right; font-weight: bold;">TOTAL GENERAL:</td>
                    <td colspan="3" style="font-weight: bold;">$${(totalGeneral || 0).toLocaleString('es-CO')}</td>
                </tr>
            </tfoot>
        </table>
    `;

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
    generateReportContent,
    generateEmployeeList,
    generateTransportSubsidyList,
    generatePayrollDetail,
    generatePayrollSummary,
};