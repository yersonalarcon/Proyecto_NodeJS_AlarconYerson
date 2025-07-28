// crearhtml.js
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

// Asegúrate de que esta función esté definida y exportada
function getLogoBase64() {
    // Logo simple de Acme en SVG convertido a base64
    return 'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMDAgMTAwIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2U3NGMzYyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSJ3aGl0ZSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXdlaWdodD0iYm9sZCIgZm9udC1zaXplPSIyMCI+QUNNRTwvdGV4dD48L3N2Zz4=';
}
function getReportTitle(tipoReporte) {
    const titles = {
        'empleados': 'Listado de Empleados por Área y Cargo',
        'nomina-detalle': 'Detalle de Nómina',
        'empleados-transporte': 'Empleados con Derecho a Auxilio de Transporte',
        'nomina-resumen': 'Resumen de Nómina por Código',
        'error': 'Error en el reporte'
    };
    return titles[tipoReporte] || 'Reporte de Acme Corporate';
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

    let html = '<table><thead><tr><th>Área</th><th>Cargo</th><th>Tipo ID</th><th>Número ID</th><th>Nombres</th><th>Apellidos</th><th>Teléfono</th><th>Email</th><th>Género</th><th>Salario Base</th></tr></thead><tbody>';
    
    empleados.forEach(emp => {
        const areaNombre = emp.area?.nombre || 'N/A';
        const cargoNombre = emp.cargo?.nombre || 'N/A';
        const infoPersonal = emp.informacion_personal || {};
        const contrato = emp.contrato || {};
        
        html += `
        <tr>
            <td>${areaNombre}</td>
            <td>${cargoNombre}</td>
            <td>${infoPersonal.tipo_identificacion || 'N/A'}</td>
            <td>${infoPersonal.numero_identificacion || 'N/A'}</td>
            <td>${infoPersonal.nombres || 'N/A'}</td>
            <td>${infoPersonal.apellidos || 'N/A'}</td>
            <td>${infoPersonal.telefono || 'N/A'}</td>
            <td>${infoPersonal.email || 'N/A'}</td>
            <td>${infoPersonal.genero || 'N/A'}</td>
            <td>${contrato.salario_base ? '$' + contrato.salario_base.toLocaleString() : 'N/A'}</td>
        </tr>`;
    });
    
    html += '</tbody></table>';
    html += `<div class="summary">Total empleados: ${empleados.length}</div>`;
    
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

// Exporta todas las funciones necesarias
export {
    getLogoBase64,
    getCSS,
    getReportTitle,
    generateReportContent
};