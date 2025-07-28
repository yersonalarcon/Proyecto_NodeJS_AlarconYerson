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

function getCSS() {
    return `
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

function getLogoBase64() {
    // Logo simple de Acme en SVG convertido a base64
    return 'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMDAgMTAwIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2U3NGMzYyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSJ3aGl0ZSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXdlaWdodD0iYm9sZCIgZm9udC1zaXplPSIyMCI+QUNNRTwvdGV4dD48L3N2Zz4=';
}

function getReportTitle(tipoReporte) {
    const titles = {
        'empleados': 'Listado de Empleados por Área y Cargo',
        'nomina-detalle': 'Detalle de Nómina',
        'empleados-transporte': 'Empleados con Derecho a Auxilio de Transporte',
        'nomina-resumen': 'Resumen de Nómina por Código'
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
        default:
            return '<p>Reporte no especificado</p>';
    }
}

function generateEmployeeList(empleados) {
    let html = '<table><thead><tr><th>Área</th><th>Cargo</th><th>Tipo ID</th><th>Número ID</th><th>Nombres</th><th>Apellidos</th><th>Teléfono</th><th>Email</th><th>Género</th></tr></thead><tbody>';
    
    empleados.forEach(emp => {
        html += `
        <tr>
            <td>${emp.area.codigo} - ${emp.area.nombre}</td>
            <td>${emp.cargo.codigo} - ${emp.cargo.nombre}</td>
            <td>${emp.informacion_personal.tipo_identificacion}</td>
            <td>${emp.informacion_personal.numero_identificacion}</td>
            <td>${emp.informacion_personal.nombres}</td>
            <td>${emp.informacion_personal.apellidos}</td>
            <td>${emp.informacion_personal.telefono || 'N/A'}</td>
            <td>${emp.informacion_personal.email || 'N/A'}</td>
            <td>${emp.informacion_personal.genero}</td>
        </tr>`;
    });
    
    html += '</tbody></table>';
    html += `<div class="summary">Total empleados: ${empleados.length}</div>`;
    
    return html;
}

function generatePayrollDetail(data) {
    const { empleado, nomina } = data;
    
    let html = `
    <div class="employee-details">
        <div class="detail-row">
            <span class="detail-label">Empleado:</span>
            <span>${empleado.informacion_personal.nombres} ${empleado.informacion_personal.apellidos}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Identificación:</span>
            <span>${empleado.informacion_personal.tipo_identificacion} ${empleado.informacion_personal.numero_identificacion}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Salario Base:</span>
            <span>$${nomina.salario_base.toLocaleString()}</span>
        </div>
    </div>
    
    <div class="deductions">
        <h3 class="section-title">Deducciones</h3>
        <table>
            <thead>
                <tr>
                    <th>Código</th>
                    <th>Nombre</th>
                    <th>Valor</th>
                </tr>
            </thead>
            <tbody>`;
    
    nomina.deducciones.forEach(ded => {
        html += `
                <tr>
                    <td>${ded.codigo}</td>
                    <td>${ded.nombre}</td>
                    <td>$${ded.valor.toLocaleString()}</td>
                </tr>`;
    });
    
    html += `
            </tbody>
        </table>
        <div class="detail-row">
            <span class="detail-label">Total Deducciones:</span>
            <span>$${nomina.total_deducciones.toLocaleString()}</span>
        </div>
    </div>
    
    <div class="earnings">
        <h3 class="section-title">Devengos</h3>
        <table>
            <thead>
                <tr>
                    <th>Código</th>
                    <th>Nombre</th>
                    <th>Valor</th>
                </tr>
            </thead>
            <tbody>`;
    
    nomina.devengos.forEach(dev => {
        html += `
                <tr>
                    <td>${dev.codigo}</td>
                    <td>${dev.nombre}</td>
                    <td>$${dev.valor.toLocaleString()}</td>
                </tr>`;
    });
    
    html += `
            </tbody>
        </table>
        <div class="detail-row">
            <span class="detail-label">Total Devengos:</span>
            <span>$${nomina.total_devengado.toLocaleString()}</span>
        </div>
    </div>
    
    <div class="summary">
        <div class="detail-row">
            <span class="detail-label">Neto a Pagar:</span>
            <span>$${nomina.neto_pagar.toLocaleString()}</span>
        </div>
    </div>`;
    
    return html;
}

function generateTransportSubsidyList(empleados) {
    let html = '<table><thead><tr><th>Área</th><th>Cargo</th><th>Tipo ID</th><th>Número ID</th><th>Nombres</th><th>Apellidos</th><th>Salario Base</th></tr></thead><tbody>';
    
    empleados.forEach(emp => {
        html += `
        <tr>
            <td>${emp.area.codigo} - ${emp.area.nombre}</td>
            <td>${emp.cargo.codigo} - ${emp.cargo.nombre}</td>
            <td>${emp.informacion_personal.tipo_identificacion}</td>
            <td>${emp.informacion_personal.numero_identificacion}</td>
            <td>${emp.informacion_personal.nombres}</td>
            <td>${emp.informacion_personal.apellidos}</td>
            <td>$${emp.contrato.salario_base.toLocaleString()}</td>
        </tr>`;
    });
    
    html += '</tbody></table>';
    html += `<div class="summary">Total empleados con auxilio de transporte: ${empleados.length}</div>`;
    
    return html;
}

function generatePayrollSummary(nomina) {
    return `
    <div class="employee-details">
        <div class="detail-row">
            <span class="detail-label">Código Nómina:</span>
            <span>${nomina.codigo}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Periodo:</span>
            <span>${nomina.periodo}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Fecha Generación:</span>
            <span>${new Date(nomina.fecha_generacion).toLocaleDateString()}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Estado:</span>
            <span>${nomina.estado}</span>
        </div>
    </div>
    
    <table>
        <thead>
            <tr>
                <th>Tipo ID</th>
                <th>Número ID</th>
                <th>Nombres</th>
                <th>Apellidos</th>
                <th>Salario Base</th>
                <th>Total Deducciones</th>
                <th>Total Devengos</th>
                <th>Neto a Pagar</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>${nomina.empleado.informacion_personal.tipo_identificacion}</td>
                <td>${nomina.empleado.informacion_personal.numero_identificacion}</td>
                <td>${nomina.empleado.informacion_personal.nombres}</td>
                <td>${nomina.empleado.informacion_personal.apellidos}</td>
                <td>$${nomina.salario_base.toLocaleString()}</td>
                <td>$${nomina.total_deducciones.toLocaleString()}</td>
                <td>$${nomina.total_devengado.toLocaleString()}</td>
                <td>$${nomina.neto_pagar.toLocaleString()}</td>
            </tr>
        </tbody>
    </table>`;
}