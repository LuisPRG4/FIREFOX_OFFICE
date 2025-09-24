// Variable global para la base de datos
let db;
const DB_NAME = 'sfpDB';
const DB_VERSION = 1;

// Nombres de los almacenes de objetos
const STORES = {

    MOVIMIENTOS: 'movimientos',
    CATEGORIAS: 'categorias',
    BANCOS: 'bancos',
    REGLAS: 'reglas',
    SALDO_INICIAL: 'saldo_inicial'
};

// ✅ FUNCIONES PARA FORMATO VENEZOLANO (punto mil, coma decimal)
function formatNumberVE(num) {
    if (typeof num !== 'number' || isNaN(num)) return '0,00';
    const parts = num.toFixed(2).split('.');
    const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${integerPart},${parts[1]}`;
}

function parseNumberVE(str) {
    if (!str || typeof str !== 'string') return 0;
    // Eliminar puntos (separadores de miles) y reemplazar coma por punto
    const cleaned = str.replace(/\./g, '').replace(',', '.');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
}

// Configuración de paginación
const MOVIMIENTOS_POR_PAGINA = 10;
let paginaActual = 1;

// ✅ Variable global para guardar el ID del movimiento que se está editando
let idMovimientoEditando = null; 

/**
 * ## 1. Inicialización de la base de datos
 * Esta es la primera y más importante función. Se encarga de abrir la base de datos
 * y crear los almacenes de objetos si no existen.
 * */
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            db = event.target.result;
            console.log('Creando o actualizando almacenes de objetos...');

            // Almacén para movimientos
            if (!db.objectStoreNames.contains(STORES.MOVIMIENTOS)) {
                const movimientosStore = db.createObjectStore(STORES.MOVIMIENTOS, { keyPath: 'id', autoIncrement: true });
                movimientosStore.createIndex('fechaIndex', 'fecha', { unique: false });
                movimientosStore.createIndex('tipoIndex', 'tipo', { unique: false });
                movimientosStore.createIndex('bancoIndex', 'banco', { unique: false }); // Nuevo índice
            }

            // Almacén para categorías (usamos el nombre como clave)
            if (!db.objectStoreNames.contains(STORES.CATEGORIAS)) {
                db.createObjectStore(STORES.CATEGORIAS, { keyPath: 'nombre' });
            }

            // Almacén para bancos (usamos el nombre como clave)
            if (!db.objectStoreNames.contains(STORES.BANCOS)) {
                db.createObjectStore(STORES.BANCOS, { keyPath: 'nombre' });
            }

            // Almacén para reglas (con id autoincremental)
            if (!db.objectStoreNames.contains(STORES.REGLAS)) {
                const reglasStore = db.createObjectStore(STORES.REGLAS, { keyPath: 'id', autoIncrement: true });
                reglasStore.createIndex('palabraIndex', 'palabra', { unique: false });
            }

            // Almacén para el saldo inicial (un solo registro)
            if (!db.objectStoreNames.contains(STORES.SALDO_INICIAL)) {
                db.createObjectStore(STORES.SALDO_INICIAL, { keyPath: 'id' });
            }
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            console.log('IndexedDB abierta y lista.');
            resolve(db);
        };

        request.onerror = (event) => {
            console.error('Error al abrir IndexedDB:', event.target.error);
            reject(event.target.error);
        };
    });
}

// Funciones genéricas para interactuar con la DB
async function addEntry(storeName, entry) {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    return new Promise((resolve, reject) => {
        const request = store.add(entry);
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

async function getAllEntries(storeName) {
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

// ✅ Función para obtener un solo registro por ID
function getEntry(storeName, id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(id);

        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.errorCode);
    });
}

// ✅ Función para actualizar un registro existente
function updateEntry(storeName, entry) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(entry);

        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.errorCode);
    });
}

// ✅ Función para eliminar un registro
function deleteEntry(storeName, id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event.target.errorCode);
    });
}

async function updateEntry(storeName, entry) {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    return new Promise((resolve, reject) => {
        const request = store.put(entry);
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

async function deleteEntry(storeName, key) {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    return new Promise((resolve, reject) => {
        const request = store.delete(key);
        request.onsuccess = () => resolve(true);
        request.onerror = (event) => reject(event.target.error);
    });
}

// ✅ Función para cargar un movimiento en el formulario para editar
async function cargarMovimientoParaEditar(id) {
    if (confirm("¿Deseas editar este movimiento?")) {
        try {
            // Asegurarse de que estamos en la pestaña correcta
            mostrarSideTab('movimientos');

            const movimiento = await getEntry(STORES.MOVIMIENTOS, id);
            if (movimiento) {
                document.getElementById('concepto').value = movimiento.concepto;
                document.getElementById('cantidad').value = movimiento.cantidad;
                document.getElementById('tipo').value = movimiento.tipo;
                document.getElementById('categoria').value = movimiento.categoria;
                document.getElementById('fechaMov').value = new Date(movimiento.fecha).toISOString().split('T')[0];
                document.getElementById('banco').value = movimiento.banco;

                document.getElementById('btnAgregar').style.display = 'none';
                document.getElementById('btnActualizar').style.display = 'block';
                document.getElementById('btnCancelarEdicion').style.display = 'block';
                
                idMovimientoEditando = id;

                // ✅ Buscar la sección del formulario dentro del contenedor de la pestaña
                const formSection = document.querySelector('#side-movimientos section:first-of-type');
                if (formSection) {
                    formSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
        } catch (error) {
            console.error("Error al cargar movimiento para editar:", error);
        }
    }
}

// ✅ Función para actualizar el movimiento en la base de datos
async function actualizarMovimiento() {
    if (!idMovimientoEditando) {
        alert("No hay un movimiento seleccionado para editar.");
        return;
    }

    const concepto = document.getElementById('concepto').value.trim();
    const cantidad = parseNumberVE(document.getElementById('cantidad').value); // ✅ CAMBIO CLAVE
    const tipo = document.getElementById('tipo').value;
    const categoria = document.getElementById('categoria').value;
    const fecha = new Date(document.getElementById('fechaMov').value + 'T12:00:00');
    const banco = document.getElementById('banco').value;

    // ✅ AÑADE ESTA VALIDACIÓN JUSTO ABAJO
    if (isNaN(cantidad) || cantidad <= 0) {
    alert('Ingresa una cantidad válida mayor a 0.');
    return;
    }

    const movimientoActualizado = {
    id: idMovimientoEditando,
    concepto: concepto,
    cantidad: cantidad,
    tipo: tipo,
    categoria: categoria,
    fecha: fecha.toISOString(),
    banco: banco,
    // ✅ Recalcular comisión si es gasto, o poner 0 si no lo es
    comision: tipo === 'gasto' ? (cantidad * 0.003) : 0
};

    try {
        await updateEntry(STORES.MOVIMIENTOS, movimientoActualizado);
        await renderizar();
        limpiarForm();
        alert("Movimiento actualizado con éxito.");
    } catch (error) {
        console.error("Error al actualizar movimiento:", error);
        alert("Error al actualizar el movimiento. Intenta de nuevo.");
    }
}

// ✅ Función para cancelar la edición con confirmación
function cancelarEdicion() {
    if (confirm("¿Estás seguro de que quieres cancelar la edición? Los cambios no se guardarán.")) {
        limpiarForm();
        idMovimientoEditando = null;
    }
}

// ✅ Función para eliminar un movimiento con confirmación
async function eliminarMovimiento(id) {
    if (confirm("¿Estás seguro de que quieres eliminar este movimiento?")) {
        try {
            await deleteEntry(STORES.MOVIMIENTOS, id);
            await renderizar();
            await actualizarSaldo();
            alert("Movimiento eliminado con éxito.");
        } catch (error) {
            console.error("Error al eliminar el movimiento:", error);
            alert("Error al eliminar el movimiento. Intenta de nuevo.");
        }
    }
}

// ------------------------------------------------------------------------------------------------------------------------------------
//                                 Funciones de tu app, adaptadas a IndexedDB
// ------------------------------------------------------------------------------------------------------------------------------------

// Modificaciones en las funciones de tu app
async function agregarMovimiento() {
  if (idMovimientoEditando) {
    await actualizarMovimiento();
    return;
  }

  const concepto = document.getElementById('concepto').value.trim();
  const tipo = document.getElementById('tipo').value; // puede ser 'ingreso', 'gasto', 'saldo_inicial'
  const categoria = document.getElementById('categoria').value;
  const banco = document.getElementById('banco').value;
  const fechaInput = document.getElementById('fechaMov').value;

  // Validación básica
  if (!concepto || !banco || !fechaInput) {
    alert('Por favor, completa el concepto, el banco y la fecha.');
    return;
  }

  let monto;
if (tipo === 'saldo_inicial') {
    const saldoInicial = parseNumberVE(document.getElementById('saldoInicial').value); // ✅ CAMBIO CLAVE
    if (isNaN(saldoInicial) || saldoInicial <= 0) {
        alert('Ingresa un saldo inicial válido mayor a 0.');
        return;
    }
    monto = saldoInicial;
} else {
    const cantidad = parseNumberVE(document.getElementById('cantidad').value);
    if (isNaN(cantidad) || cantidad <= 0) {
        alert('Ingresa una cantidad válida mayor a 0.');
        return;
    }
    monto = cantidad;
}

  // Crear movimiento
  const movimiento = {
    concepto: tipo === 'saldo_inicial'
      ? `${concepto} (Saldo inicial: ${banco})`
      : concepto,
    cantidad: monto,
    tipo: tipo === 'saldo_inicial' ? 'ingreso' : tipo,
    categoria: categoria || 'Sin categoría',
    fecha: new Date(fechaInput + 'T12:00:00').toISOString(),
    banco: banco,
    // ✅ NUEVO: Calcular y guardar la comisión solo una vez
    comision: tipo === 'gasto' ? (monto * 0.003) : 0
};

  try {
    await addEntry(STORES.MOVIMIENTOS, movimiento);
    await renderizar();
    await actualizarSaldo();
    limpiarForm();
    alert("✅ Movimiento agregado con éxito.");
  } catch (error) {
    console.error("Error al agregar movimiento:", error);
    alert("Error al guardar el movimiento.");
  }
}

async function calcularSaldo() {
    const movimientos = await getAllEntries(STORES.MOVIMIENTOS);
    // ✅ Sumar solo las comisiones ya guardadas
    const totalComisiones = movimientos
        .filter(m => m.tipo === 'gasto')
        .reduce((sum, m) => sum + m.comision, 0);

    // ✅ Calcular saldo base: ingresos - gastos (sin volver a calcular comisión)
    const saldoBase = movimientos.reduce((acc, m) => {
        if (m.tipo === 'gasto') {
            return acc - m.cantidad; // Solo el gasto real
        } else {
            return acc + m.cantidad; // Ingresos y saldos iniciales
        }
    }, 0);

    // ✅ Restar solo las comisiones ya guardadas
    return saldoBase - totalComisiones;
}

async function actualizarSaldo() {
    const saldoBs = await calcularSaldo();
    document.getElementById('saldo').textContent = 'Bs. ' + formatNumberVE(saldoBs);

    // ✅ NUEVO: DETECTAR INCONSISTENCIA — Si hay movimientos pero saldo = 0, ¡reparar!
    const movimientos = await getAllEntries(STORES.MOVIMIENTOS);
    const tieneMovimientos = movimientos.length > 0;
    const saldoCero = Math.abs(saldoBs) < 0.01; // Consideramos 0 si es menor a 1 céntimo

    if (tieneMovimientos && saldoCero) {
        console.warn('⚠️ Inconsistencia detectada: Hay movimientos pero saldo = 0. Ejecutando reparación...');
        repararApp(); // ¡Llama a la reparación automática!
    }

    // ✅ NUEVO: Mostrar o ocultar aviso de comisión
    const aviso = document.getElementById('saldoAviso');
    if (aviso) {
        aviso.style.display = Math.abs(saldoBs) > 0.01 ? 'block' : 'none';
    }

    const umbral = 500;
    const alerta = document.getElementById('alertaSaldo');
    document.getElementById('umbralAlerta').textContent = umbral;
    if (saldoBs < umbral) {
        alerta.style.display = 'block';
    } else {
        alerta.style.display = 'none';
    }

    actualizarEquivalente();
}

async function renderizar() {
    const movimientos = await getAllEntries(STORES.MOVIMIENTOS);

    const ul = document.getElementById('listaMovimientos');
    ul.innerHTML = '';

    const filtro = document.getElementById('filtroBanco').value;
    const texto = document.getElementById('txtBuscar').value.trim().toLowerCase();

    // Filtrar movimientos reales
    let listaFiltrada = movimientos.filter(m =>
        (filtro ? (m.banco || '(Sin banco)') === filtro : true) &&
        (texto ? (m.concepto + (m.categoria || '') + (m.banco || '')).toLowerCase().includes(texto) : true)
    );

    // Ordenar por fecha descendente (los más recientes primero)
    listaFiltrada.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    // Paginación
    const totalMovimientos = listaFiltrada.length;
    const totalPaginas = Math.ceil(totalMovimientos / MOVIMIENTOS_POR_PAGINA);
    paginaActual = Math.min(paginaActual, totalPaginas || 1);
    paginaActual = Math.max(paginaActual, 1);

    const inicio = (paginaActual - 1) * MOVIMIENTOS_POR_PAGINA;
    const fin = inicio + MOVIMIENTOS_POR_PAGINA;
    const movimientosPagina = listaFiltrada.slice(inicio, fin);

    // Renderizar movimientos de la página actual
    movimientosPagina.forEach(m => {
        if (m.oculto) return;

        const li = document.createElement('li');

        const esSaldoInicial = m.concepto.includes('Saldo inicial');
        const conceptoBase = esSaldoInicial ? m.concepto.split(' (')[0] : m.concepto;
        const saldoInicialTexto = esSaldoInicial ? m.concepto.split(' (')[1]?.replace(')', '') : '';

        // Calcular comisión si es gasto
        const esGasto = m.tipo === 'gasto';
        const comision = esGasto ? m.comision.toFixed(2) : null; // ✅ Usar la comisión guardada

        li.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:.25rem; flex:1; margin-bottom: .5rem; min-width:0;">
        <input type="text" value="${conceptoBase}" 
                onblur="guardarCambio(${m.id}, 'concepto', this.value)"
                onkeypress="if(event.key==='Enter') this.blur();"
                style="width:100%; border:none; background:transparent; font:inherit; font-weight:600; color:var(--text);"
                readonly>
        ${saldoInicialTexto ? `<div style="font-size:.8rem; color:var(--text-light); margin-top:-.25rem; padding-left: 0.25rem;">(${saldoInicialTexto})</div>` : ''}
        <div style="font-size:.75rem; color:var(--text-light); display:flex; gap:.5rem; flex-wrap:wrap; align-items:center;">
            <span>${m.categoria || 'Sin categoría'}</span>
            <span>·</span>
            <span>${m.banco || '(Sin banco)'}</span>
            <span>·</span>
            <span>${new Date(m.fecha).toLocaleDateString()}</span>
        </div>
        ${comision ? `<div style="font-size:.8rem; color:#b00020; margin-top:0.25rem;">Comisión: ${comision} Bs</div>` : ''}
    </div>
    <div style="display:flex; justify-content:space-between; align-items:center; gap:1rem;">
        <span style="font-weight:500; color:var(--text); font-size:1rem;">${formatNumberVE(m.cantidad)} Bs</span>
        <button class="btn-editar" data-id="${m.id}" style="padding:.25rem; font-size:.8rem; background:#0b57d0; color:white; border-radius:50%; border:none; cursor:pointer; width:auto;">✏️</button>
        <button class="btn-eliminar" data-id="${m.id}" style="padding:.25rem; font-size:.8rem; background:#b00020; color:white; border-radius:50%; border:none; cursor:pointer; width:auto;">🗑️</button>
    </div>
`;
        ul.appendChild(li);
    });

    // ✅ Añadir Event Listeners para los botones de editar y eliminar
 document.querySelectorAll('.btn-editar').forEach(button => {
    button.addEventListener('click', e => {
        const id = parseInt(e.target.dataset.id);
        cargarMovimientoParaEditar(id);
    });
 });

 document.querySelectorAll('.btn-eliminar').forEach(button => {
    button.addEventListener('click', e => {
        const id = parseInt(e.target.dataset.id);
        eliminarMovimiento(id);
    });
 });

    // Renderizar controles de paginación
    renderizarControlesPaginacion(totalPaginas);

    // Verificar si hay movimientos para mostrar el botón de reporte
    const controlesReporte = document.getElementById('botonReporte');
    if (controlesReporte) {
        controlesReporte.style.display = totalMovimientos > 0 ? 'block' : 'none';
    }

    // Actualizar saldo y demás
    actualizarSaldo();
    actualizarGrafico();
    actualizarBarChart();
    actualizarResumenBancosCompleto();
}

function renderizarControlesPaginacion(totalPaginas) {
    const controles = document.getElementById('controlesPaginacion');
    if (!controles) return;

    // Solo mostrar controles si hay más de una página
    if (totalPaginas <= 1) {
        controles.innerHTML = '';
        return;
    }

    controles.innerHTML = `
        <div style="display:flex; gap:0.5rem; align-items:center; justify-content:center; margin-top:1rem; font-size:0.875rem;">
            <button onclick="cambiarPagina(${Math.max(1, paginaActual - 1)})" ${paginaActual <= 1 ? 'disabled' : ''} 
                    style="padding:0.3rem 0.6rem; font-size:0.875rem; background:#0b57d0; color:white; border:none; border-radius:4px; cursor:pointer;">
                ◀ Anterior
            </button>
            <span style="color:var(--text-light);">Página ${paginaActual} de ${totalPaginas}</span>
            <button onclick="cambiarPagina(${Math.min(totalPaginas, paginaActual + 1)})" ${paginaActual >= totalPaginas ? 'disabled' : ''} 
                    style="padding:0.3rem 0.6rem; font-size:0.875rem; background:#0b57d0; color:white; border:none; border-radius:4px; cursor:pointer;">
                Siguiente ▶
            </button>
        </div>
    `;
}

async function cambiarPagina(nuevaPagina) {
    paginaActual = nuevaPagina;
    await renderizar();
}

async function borrar(id) {
    try {
        await deleteEntry(STORES.MOVIMIENTOS, id);
        await renderizar();     // ← Renderiza la lista
        await actualizarSaldo(); // ← ¡Asegura que el saldo se actualice!
    } catch (error) {
        console.error("Error al borrar el movimiento:", error);
    }
}

async function guardarCambio(id, campo, valor) {
    if (isNaN(valor) && campo === 'cantidad') return;
    try {
        const movimientos = await getAllEntries(STORES.MOVIMIENTOS);
        const mov = movimientos.find(m => m.id === id);
        if (mov) {
            mov[campo] = valor;
            await updateEntry(STORES.MOVIMIENTOS, mov);
            renderizar();
        }
    } catch (error) {
        console.error("Error al guardar el cambio:", error);
    }
}

async function cargarSelectBancos() {
    const bancos = (await getAllEntries(STORES.BANCOS)).map(b => b.nombre);
    const select = document.getElementById('banco');
    // Conservamos "(Sin banco)" y "+ Nuevo..." si existen
    const sinBancoOpt = select.querySelector('option[value=""]');
    const nuevoOpt = select.querySelector('option[value="Otro"]');
    select.innerHTML = '';
    if (sinBancoOpt) select.appendChild(sinBancoOpt);
    bancos.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b;
        opt.textContent = b;
        select.appendChild(opt);
    });
    if (nuevoOpt) select.appendChild(nuevoOpt);

    cargarSelectBancoRegla();
    cargarSelectEliminarBancos();
}

async function renderizarResumenBancos() {
    const movimientos = await getAllEntries(STORES.MOVIMIENTOS);
    const bancos = [...new Set(movimientos.map(m => (m.banco && typeof m.banco === 'string' ? m.banco : '(Sin banco)')))];

    const selectFiltro = document.getElementById('filtroBanco');
    const actual = selectFiltro.value;
    selectFiltro.innerHTML = '<option value="">Todos los bancos</option>';
    bancos.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b;
        opt.textContent = b;
        selectFiltro.appendChild(opt);
    });
    selectFiltro.value = actual;

    const ul = document.getElementById('listaBancos');
    ul.innerHTML = '';
    bancos.forEach(b => {
        const ingresos = movimientos
            .filter(m => (m.banco || '(Sin banco)') === b && m.tipo === 'ingreso')
            .reduce((s, m) => s + m.cantidad, 0);
        const gastos = movimientos
            .filter(m => (m.banco || '(Sin banco)') === b && m.tipo === 'gasto')
            .reduce((s, m) => s + m.cantidad, 0);
        const saldo = ingresos - gastos;

        const nombreBanco = (b === '(Sin banco)' || !b || typeof b !== 'string') ? '(Sin banco)' : b;
        const li = document.createElement('li');
        li.innerHTML = `<span>${nombreBanco}</span><span>Bs. ${saldo.toFixed(2)}</span>`;
        ul.appendChild(li);
    });
}

async function actualizarGrafico() {
    if (typeof Chart === 'undefined') return;
    const movimientos = await getAllEntries(STORES.MOVIMIENTOS);
    const gastos = movimientos.filter(m => m.tipo === 'gasto');
    const totales = {};
    gastos.forEach(m => {
        const cat = m.categoria || 'Sin categoría';
        totales[cat] = (totales[cat] || 0) + m.cantidad;
    });
    const labels = Object.keys(totales);
    const data = Object.values(totales).map(n => n); // No cambiamos el array, solo lo usamos para el gráfico
    if (window.miGrafico) window.miGrafico.destroy();
    window.miGrafico = new Chart(document.getElementById('torta'), {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: ['#0b57d0', '#018642', '#b00020', '#ff9800', '#9c27b0']
            }]
        },
        options: { plugins: { legend: { position: 'bottom' } } }
    });
}

async function actualizarBarChart() {
    if (typeof Chart === 'undefined') return;
    const movimientos = await getAllEntries(STORES.MOVIMIENTOS);
    const ingresos = {};
    const gastos = {};
    movimientos.forEach(m => {
        const fecha = new Date(m.fecha);
        const clave = fecha.getFullYear() + '-' + String(fecha.getMonth() + 1).padStart(2, '0');
        if (m.tipo === 'ingreso') {
            ingresos[clave] = (ingresos[clave] || 0) + m.cantidad;
        } else {
            gastos[clave] = (gastos[clave] || 0) + m.cantidad;
        }
    });
    const meses = [...new Set([...Object.keys(ingresos), ...Object.keys(gastos)])].sort();
    const dataIng = meses.map(m => ingresos[m] || 0);
    const dataGas = meses.map(m => gastos[m] || 0);
    if (window.miBarChart) window.miBarChart.destroy();
    window.miBarChart = new Chart(document.getElementById('barChart'), {
        type: 'bar',
        data: {
            labels: meses,
            datasets: [{
                label: 'Ingresos',
                data: dataIng,
                backgroundColor: '#018642'
            }, {
                label: 'Gastos',
                data: dataGas,
                backgroundColor: '#b00020'
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { position: 'bottom' } },
            scales: { y: { beginAtZero: true } }
        }
    });
}

async function actualizarResumenBancosCompleto() {
    try {
        const movimientos = await getAllEntries(STORES.MOVIMIENTOS);
        const tbody = document.getElementById('tablaBancos').querySelector('tbody');
        tbody.innerHTML = '';

        // ✅ PASO 1: Agrupar movimientos por banco
        const bancos = [...new Set(movimientos.map(m => m.banco || '(Sin banco)'))];
        const resumenBancos = {};

        bancos.forEach(banco => {
            // Filtrar movimientos de este banco
            const movimientosBanco = movimientos.filter(m => m.banco === banco);

            // ✅ Calcular saldo inicial: suma de movimientos con concepto que contiene "(Saldo inicial:"
            const saldoInicial = movimientosBanco
                .filter(m => m.concepto.includes('(Saldo inicial:'))
                .reduce((sum, m) => sum + m.cantidad, 0);

            // ✅ Calcular ingresos: todos los movimientos de tipo "ingreso" que NO sean saldo inicial
            const ingresos = movimientosBanco
                .filter(m => m.tipo === 'ingreso' && !m.concepto.includes('(Saldo inicial:'))
                .reduce((sum, m) => sum + m.cantidad, 0);

            // ✅ Calcular gastos: todos los movimientos de tipo "gasto"
            const gastos = movimientosBanco
                .filter(m => m.tipo === 'gasto')
                .reduce((sum, m) => sum + m.cantidad, 0);

            // ✅ Calcular saldo final
            const saldoFinal = saldoInicial + ingresos - gastos;

            resumenBancos[banco] = { saldoInicial, ingresos, gastos, saldoFinal };
        });

        // ✅ PASO 2: Calcular el saldo general total
        const saldoGeneralTotal = Object.values(resumenBancos).reduce((sum, banco) => sum + banco.saldoFinal, 0);

        // ✅ PASO 3: Renderizar la tabla
        for (const banco in resumenBancos) {
            const data = resumenBancos[banco];
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${banco}</td>
                <td style="text-align:right; font-weight: 500;">
                    ${formatNumberVE(data.saldoInicial)} Bs
                </td>
                <td style="text-align:right; font-weight: 500; color: var(--success);">
                    +${formatNumberVE(data.ingresos)} Bs
                </td>
                <td style="text-align:right; font-weight: 500; color: var(--danger);">
                    -${formatNumberVE(data.gastos)} Bs
                </td>
                <td style="text-align:right; font-weight: 700;">
                    ${formatNumberVE(data.saldoFinal)} Bs
                </td>
            `;
            tbody.appendChild(tr);
        }

        // ✅ PASO 4: Actualizar el saldo global
        document.getElementById('saldo').textContent = `Bs. ${formatNumberVE(saldoGeneralTotal)}`;
        document.getElementById('totalGeneral').textContent = formatNumberVE(saldoGeneralTotal);

        // Actualizar el equivalente en otra moneda
        const tasaCambio = parseFloat(document.getElementById('tasaCambio').value);
        if (!isNaN(tasaCambio) && tasaCambio > 0) {
            const equivalente = saldoGeneralTotal / tasaCambio;
            document.getElementById('equivalente').textContent = formatNumberVE(equivalente);
        }
    } catch (error) {
        console.error("Error al actualizar el resumen por banco:", error);
    }
}

async function exportarExcel() {
    const movimientos = await getAllEntries(STORES.MOVIMIENTOS);
    if (!movimientos.length) return alert('No hay movimientos para exportar');
    const wb = XLSX.utils.book_new();
    const wsData = [
        ['Concepto', 'Cantidad', 'Tipo', 'Categoría', 'Banco', 'Fecha'],
    ];
    movimientos.forEach(m => {
        wsData.push([
            m.concepto,
            m.cantidad,
            m.tipo,
            m.categoria || '',
            m.banco || '',
            new Date(m.fecha).toLocaleDateString()
        ]);
    });
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [
        { wch: 25 }, { wch: 12 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 12 }
    ];
    const headerRange = XLSX.utils.decode_range(ws['!ref']);
    for (let c = headerRange.s.c; c <= headerRange.e.c; c++) {
        const cell = ws[XLSX.utils.encode_cell({ r: 0, c })];
        if (cell) {
            cell.s = {
                font: { bold: true, color: { rgb: 'FFFFFF' } },
                fill: { fgColor: { rgb: '0B57D0' } },
                alignment: { horizontal: 'center' }
            };
        }
    }
    XLSX.utils.book_append_sheet(wb, ws, 'Movimientos');
    XLSX.writeFile(wb, 'Agenda_Bancaria.xlsx');
}

// Funciones de UI/UX del código original
function limpiarForm() {
    document.getElementById('saldoInicial').value = '';
    document.getElementById('concepto').value = '';
    document.getElementById('cantidad').value = '';
    document.getElementById('tipo').value = 'ingreso';
    document.getElementById('categoria').value = '';
    document.getElementById('nuevaCategoria').value = '';
    document.getElementById('nuevaCategoria').style.display = 'none';
    document.getElementById('banco').value = '';
    document.getElementById('nuevoBanco').value = '';
    document.getElementById('nuevoBanco').style.display = 'none';
    document.getElementById('fechaMov').value = '';
    document.getElementById('concepto').focus();

    // ✅ Restaurar los botones del formulario y la variable global
    document.getElementById('btnAgregar').style.display = 'block';
    document.getElementById('btnActualizar').style.display = 'none';
    document.getElementById('btnCancelarEdicion').style.display = 'none';
    idMovimientoEditando = null;
}

function mostrarSideTab(id) {
    document.querySelectorAll('.side-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.side-tab').forEach(btn => btn.classList.remove('active'));
    document.getElementById('side-' + id).classList.add('active');
    document.querySelector(`[onclick="mostrarSideTab('${id}')"]`).classList.add('active');
    localStorage.setItem('agendaPestañaActiva', id);
}

function actualizarEquivalente() {
    const saldoBsText = document.getElementById('saldo').textContent.replace('Bs. ', '').replace(',', '');
    const saldoBs = parseFloat(saldoBsText);
    const tasa = parseNumberVE(document.getElementById('tasaCambio').value);
    const monedaDestino = document.getElementById('monedaDestino').value;

    if (isNaN(tasa) || tasa <= 0) {
        document.getElementById('equivalente').textContent = 'Tasa inválida';
        return;
    }

    // ✅ Convertir Bs a moneda destino: dividir por la tasa
    const equivalente = saldoBs / tasa;

    let simbolo = '$';
    let nombreMoneda = 'USD';
    if (monedaDestino === 'EUR') { simbolo = '€'; nombreMoneda = 'EUR'; }
    if (monedaDestino === 'COP') { simbolo = 'COL$'; nombreMoneda = 'COP'; }
    if (monedaDestino === 'ARS') { simbolo = 'ARS$'; nombreMoneda = 'ARS'; }
    if (monedaDestino === 'MXN') { simbolo = 'MX$'; nombreMoneda = 'MXN'; }

    const tieneDecimales = equivalente % 1 !== 0;
    const formato = formatNumberVE(equivalente);

    document.getElementById('equivalente').textContent = `${simbolo} ${formato}`;
    localStorage.setItem('tasaCambio', tasa.toString());

    // ✅ Actualizar texto de tasa actual
    document.getElementById('tasaActual').textContent = `Tasa actual: 1 ${nombreMoneda} = ${formatNumberVE(tasa)} Bs`;
}

function aplicarTemaInicial() {
    const guardado = localStorage.getItem('agendaTema');
    if (guardado === 'claro') document.body.classList.add('modo-claro');
    else if (guardado === 'oscuro') document.body.classList.add('modo-oscuro');
}

// ---- Funciones para categorías (adaptadas) ----
async function agregarCategoria() {
    const input = document.getElementById('nuevaCategoria');
    const nombre = input.value.trim();

    if (!nombre) {
        alert('Por favor, ingresa un nombre para la categoría.');
        return;
    }

    try {
        await addEntry(STORES.CATEGORIAS, { nombre });
        await actualizarSelectCategorias();
        input.value = ''; // Limpiar campo
        input.style.display = 'none'; // Ocultar nuevamente
        document.getElementById('categoria').value = nombre; // Seleccionar la nueva categoría
        alert(`✅ Categoría "${nombre}" agregada.`);
    } catch (error) {
        console.error("Error al agregar categoría:", error);
        alert("Error al agregar la categoría.");
    }
}

async function actualizarSelectCategorias() {
    const cats = (await getAllEntries(STORES.CATEGORIAS)).map(c => c.nombre);
    const select = document.getElementById('categoria');
    const optOtro = select.options[select.options.length - 1];
    while (select.options.length > 2) select.remove(1);
    cats.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        select.insertBefore(opt, optOtro);
    });
    cargarSelectEliminarCategorias();
}

async function eliminarCategoria() {
    const select = document.getElementById('selectEliminarCategoria');
    const categoria = select.value;
    if (!categoria) {
        alert('Selecciona una categoría para eliminar.');
        return;
    }
    if (!confirm(`¿Seguro que quieres eliminar la categoría "${categoria}"? Los movimientos que la usan quedarán sin categoría.`)) {
        return;
    }
    try {
        await deleteEntry(STORES.CATEGORIAS, categoria);
        const movimientos = await getAllEntries(STORES.MOVIMIENTOS);
        const movimientosActualizados = movimientos.map(m => {
            if (m.categoria === categoria) {
                m.categoria = 'Sin categoría';
            }
            return m;
        });
        const transaction = db.transaction([STORES.MOVIMIENTOS], 'readwrite');
        const store = transaction.objectStore(STORES.MOVIMIENTOS);
        movimientosActualizados.forEach(m => store.put(m));

        await actualizarSelectCategorias();
        await cargarSelectEliminarCategorias();
        await renderizar();
        alert(`Categoría "${categoria}" eliminada.`);
    } catch (error) {
        console.error("Error al eliminar categoría:", error);
    }
}

async function cargarSelectEliminarCategorias() {
    const select = document.getElementById('selectEliminarCategoria');
    const categorias = (await getAllEntries(STORES.CATEGORIAS)).map(c => c.nombre);
    while (select.options.length > 1) {
        select.remove(1);
    }
    categorias.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        select.appendChild(opt);
    });
    const botonEliminar = document.querySelector('[onclick="eliminarCategoria()"]');
    if (categorias.length === 0) {
        botonEliminar.disabled = true;
        botonEliminar.textContent = "No hay categorías para eliminar";
    } else {
        botonEliminar.disabled = false;
        botonEliminar.textContent = "Eliminar";
    }
}

// ---- Funciones para bancos (adaptadas) ----
async function agregarBanco() {
    const input = document.getElementById('nuevoBanco');
    const nombre = input.value.trim();

    if (!nombre) {
        alert('Por favor, ingresa un nombre para el banco.');
        return;
    }

    try {
        await addEntry(STORES.BANCOS, { nombre });
        await cargarSelectBancos();
        input.value = ''; // Limpiar campo
        input.style.display = 'none'; // Ocultar nuevamente
        document.getElementById('banco').value = nombre; // Seleccionar el nuevo banco
        alert(`✅ Banco "${nombre}" agregado.`);
    } catch (error) {
        console.error("Error al agregar banco:", error);
        alert("Error al agregar el banco.");
    }
}

async function eliminarBanco() {
    const select = document.getElementById('selectEliminarBanco');
    const banco = select.value;
    if (!banco) {
        alert('Selecciona un banco para eliminar.');
        return;
    }
    const movimientos = await getAllEntries(STORES.MOVIMIENTOS);
    const afectados = movimientos.filter(m => m.banco === banco).length;
    if (!confirm(`¿Seguro que quieres eliminar el banco "${banco}"? \n\nSe quitará de ${afectados} movimiento${afectados !== 1 ? 's' : ''}.`)) {
        return;
    }
    try {
        await deleteEntry(STORES.BANCOS, banco);
        const transaction = db.transaction([STORES.MOVIMIENTOS], 'readwrite');
        const store = transaction.objectStore(STORES.MOVIMIENTOS);
        movimientos.forEach(m => {
            if (m.banco === banco) {
                m.banco = '(Sin banco)';
                store.put(m);
            }
        });
        await cargarSelectBancos();
        await cargarSelectBancoRegla();
        await cargarSelectEliminarBancos();
        await renderizar();
        alert(`✅ Banco "${banco}" eliminado.\nSe actualizó${afectados !== 1 ? 'ron' : ''} ${afectados} movimiento${afectados !== 1 ? 's' : ''}.`);
    } catch (error) {
        console.error("Error al eliminar el banco:", error);
    }
}

async function cargarSelectEliminarBancos() {
    const select = document.getElementById('selectEliminarBanco');
    const bancos = (await getAllEntries(STORES.BANCOS)).map(b => b.nombre);
    while (select.options.length > 1) {
        select.remove(1);
    }
    bancos.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b;
        opt.textContent = b;
        select.appendChild(opt);
    });
}

async function cargarSelectBancoRegla() {
    const select = document.getElementById('txtBancoRegla');
    const bancos = (await getAllEntries(STORES.BANCOS)).map(b => b.nombre);
    const cualquierBanco = select.options[0];
    const nuevoOpt = select.options[select.options.length - 1];
    select.innerHTML = '';
    select.appendChild(cualquierBanco);
    bancos.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b;
        opt.textContent = b;
        select.appendChild(opt);
    });
    select.appendChild(nuevoOpt);
}

// ---- Funciones para reglas (adaptadas) ----
async function agregarRegla() {
    const palabra = document.getElementById('txtPalabra').value.trim();
    const categoria = document.getElementById('txtCat').value.trim();
    const banco = document.getElementById('txtBancoRegla').value;
    if (!palabra || !categoria) {
        alert('Debes ingresar una palabra clave y una categoría.');
        return;
    }
    const nuevaRegla = { palabra, categoria, banco: banco === 'Otro' ? document.getElementById('nuevoBancoRegla').value.trim() : banco };
    try {
        await addEntry(STORES.REGLAS, nuevaRegla);
        alert('Regla guardada con éxito.');
        document.getElementById('txtPalabra').value = '';
        document.getElementById('txtCat').value = '';
        document.getElementById('txtBancoRegla').value = '';
        renderizarReglas();
    } catch (error) {
        console.error("Error al agregar la regla:", error);
    }
}

async function renderizarReglas() {
    const reglas = await getAllEntries(STORES.REGLAS);
    const ul = document.getElementById('listaReglas');
    ul.innerHTML = '';
    reglas.forEach(r => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>"${r.palabra}" &rarr; ${r.categoria} (${r.banco || 'cualquier banco'})</span>
            <button onclick="eliminarRegla(${r.id})">❌</button>
        `;
        ul.appendChild(li);
    });
}

async function eliminarRegla(id) {
    if (!confirm('¿Seguro que quieres eliminar esta regla?')) return;
    try {
        await deleteEntry(STORES.REGLAS, id);
        renderizarReglas();
    } catch (error) {
        console.error("Error al eliminar la regla:", error);
    }
}

async function eliminarSaldoInicial() {
    if (!confirm('¿Seguro que quieres eliminar el saldo inicial? Esto borrará la base contable.')) {
        return;
    }
    try {
        await deleteEntry(STORES.SALDO_INICIAL, 'saldo');
        alert('Saldo inicial eliminado.');
        await renderizar();
        await actualizarSaldo();
    } catch (error) {
        console.error("Error al eliminar saldo inicial:", error);
    }
}

async function generarReporteImprimible() {
    const movimientos = await getAllEntries(STORES.MOVIMIENTOS);
    const tasaCambio = parseFloat(document.getElementById('tasaCambio').value) || 0;

    // Calcular total de comisiones (solo gastos reales)
    const totalComisiones = movimientos
        .filter(m => m.tipo === 'gasto')
        .reduce((sum, m) => sum + (m.cantidad * 0.003), 0);

    // Agrupar movimientos por banco
    const bancos = [...new Set(movimientos.map(m => m.banco || '(Sin banco)'))];
    const resumenBancos = {};
    bancos.forEach(b => {
        const movimientosBanco = movimientos.filter(m => m.banco === b);
        // Saldo inicial: suma de movimientos con concepto que contiene "(Saldo inicial:"
        const saldoInicial = movimientosBanco
            .filter(m => m.concepto.includes('(Saldo inicial:'))
            .reduce((sum, m) => sum + m.cantidad, 0);
        // Ingresos: suma de movimientos de tipo "ingreso" que NO sean saldo inicial
        const ingresos = movimientosBanco
            .filter(m => m.tipo === 'ingreso' && !m.concepto.includes('(Saldo inicial:'))
            .reduce((sum, m) => sum + m.cantidad, 0);
        // Gastos: suma de movimientos de tipo "gasto"
        const gastos = movimientosBanco
            .filter(m => m.tipo === 'gasto')
            .reduce((sum, m) => sum + m.cantidad, 0);
        // Saldo final
        const saldoFinal = saldoInicial + ingresos - gastos;
        resumenBancos[b] = { saldoInicial, ingresos, gastos, saldoFinal };
    });

    // Calcular la disponibilidad total (suma de todos los saldos finales)
    const disponibilidadTotal = Object.values(resumenBancos).reduce((sum, banco) => sum + banco.saldoFinal, 0);

    // Calcular equivalente en dólares
    const equivalenteDolares = tasaCambio > 0 ? disponibilidadTotal / tasaCambio : 0;

    // Crear contenido HTML para impresión
    const contenido = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Reporte Financiero - SFP</title>
            <style>
                body { font-family: 'Roboto', sans-serif; padding: 2rem; color: var(--text); }
                h1 { text-align: center; color: #0b57d0; margin-bottom: 2rem; }
                .resumen-general { background: #f5f7fa; padding: 1.5rem; border-radius: 8px; margin-bottom: 2rem; }
                .resumen-bancos { margin-bottom: 2rem; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 2rem; }
                th, td { padding: 0.8rem; text-align: right; border-bottom: 1px solid #ddd; }
                th { 
                    background: #0b57d0; 
                    color: white; 
                    font-weight: 600;
                    text-align: center;
                }
                tr:nth-child(even) { background-color: #f9f9f9; }
                .total { 
                    font-weight: bold; 
                    font-size: 1.4rem; 
                    color: #0b57d0; 
                    text-align: right; 
                    margin-top: 1.5rem; 
                    padding-top: 1rem;
                    border-top: 2px solid #0b57d0;
                }
                .equivalente { 
                    font-weight: bold; 
                    font-size: 1.2rem; 
                    color: #0b57d0; 
                    text-align: right; 
                    margin-top: 0.5rem;
                }
                .movimiento { 
                    margin-bottom: 1rem; 
                    padding: 1rem; 
                    border-left: 4px solid #0b57d0; 
                    background: #f9f9f9; 
                    border-radius: 0 8px 8px 0;
                }
                .fecha { color: #666; font-size: 0.9rem; }
                .concepto { font-weight: 500; }
                .cantidad { font-weight: 600; }
                @media print {
                    body { padding: 0; }
                    button { display: none; }
                }
            </style>
        </head>
        <body>
            <h1>Reporte Financiero - Sistema Financiero Personal</h1>
            
            <!-- Resumen General -->
            <div class="resumen-general">
                <h3>Resumen General</h3>
                <p><strong>Total Comisiones (0.3%):</strong> Bs. ${formatNumberVE(totalComisiones)}</p>
                <p><strong>Disponibilidad Total:</strong> Bs. ${formatNumberVE(disponibilidadTotal)}</p>
            </div>

            <!-- Resumen por Banco -->
            <div class="resumen-bancos">
                <h3>Resumen por Banco</h3>
                <table>
                    <thead>
                        <tr>
                            <th style="text-align: left;">Banco</th>
                            <th>Saldo Inicial</th>
                            <th>Ingresos</th>
                            <th>Gastos</th>
                            <th>Saldo Final</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${Object.entries(resumenBancos).map(([banco, datos]) => `
                            <tr>
                                <td style="text-align: left;">${banco}</td>
                                <td>Bs. ${formatNumberVE(datos.saldoInicial)}</td>
                                <td>Bs. ${formatNumberVE(datos.ingresos)}</td>
                                <td>Bs. ${formatNumberVE(datos.gastos)}</td>
                                <td><strong>Bs. ${formatNumberVE(datos.saldoFinal)}</strong></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>

            <!-- Disponibilidad Total -->
            <div class="total">
                <strong>Disponibilidad Total (Suma de todos los bancos):</strong> Bs. ${disponibilidadTotal.toFixed(2)}
            </div>

            <!-- Equivalente en Dólares -->
            <div class="equivalente">
                <strong>Equivalente en USD (Tasa: 1 USD = ${tasaCambio.toLocaleString('es-VE')} Bs):</strong> $ ${equivalenteDolares.toFixed(2)}
            </div>

            <!-- Detalle de Movimientos -->
            <h3>Movimientos Registrados</h3>
            ${movimientos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).map(m => `
                <div class="movimiento">
                    <div class="concepto"><strong>${m.concepto}</strong></div>
                    <div class="fecha">${m.categoria || 'Sin categoría'} · ${m.banco || '(Sin banco)'} · ${new Date(m.fecha).toLocaleDateString()}</div>
                    <div class="cantidad"><strong>${m.tipo === 'ingreso' ? '+' : '-'} Bs. ${formatNumberVE(m.cantidad)}</strong></div>
                </div>
            `).join('')}
            
            <script>
                window.print();
            </script>
        </body>
        </html>
    `;

    // Abrir en nueva ventana para imprimir
    const ventana = window.open('', '_blank');
    ventana.document.write(contenido);
    ventana.document.close();
}

function toggleLista() {
    const contenedor = document.getElementById('listaContenedor');
    const icono = document.getElementById('iconoFlecha');

    if (contenedor.style.display === 'none') {
        contenedor.style.display = 'block';
        icono.textContent = '▲'; // Flecha hacia arriba
    } else {
        contenedor.style.display = 'none';
        icono.textContent = '▼'; // Flecha hacia abajo
    }
}

// ------------------------------------------------------------------------------------------------------------------------------------
//                                 Funciones de Presupuesto
// ------------------------------------------------------------------------------------------------------------------------------------

async function actualizarPresupuesto() {
    const movimientos = await getAllEntries(STORES.MOVIMIENTOS);
    const fechaHoy = new Date();
    const fechaHace30Dias = new Date(fechaHoy.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Filtrar gastos de los últimos 30 días
    const gastosUltimos30Dias = movimientos.filter(m =>
        m.tipo === 'gasto' &&
        new Date(m.fecha) >= fechaHace30Dias &&
        new Date(m.fecha) <= fechaHoy
    );

    const totalGastado = gastosUltimos30Dias.reduce((sum, m) => sum + m.cantidad, 0);
    const meta = parseFloat(localStorage.getItem('metaPresupuesto')) || 0;

    // Actualizar elementos de la UI
    document.getElementById('presupuestoActual').value = formatNumberVE(totalGastado);
    document.getElementById('gastadoTexto').textContent = `Bs. ${formatNumberVE(totalGastado)}`;
    document.getElementById('metaTexto').textContent = `Bs. ${formatNumberVE(meta)}`;

    // Calcular porcentaje
    const porcentaje = meta > 0 ? Math.min(100, Math.max(0, (totalGastado / meta) * 100)) : 0;
    const porcentajeTexto = Math.round(porcentaje);
    document.getElementById('progresoTexto').textContent = `${porcentajeTexto}%`;
    document.getElementById('barraProgreso').style.width = `${porcentaje}%`;

    // Cambiar color de la barra según progreso
    const barra = document.getElementById('barraProgreso');
    if (porcentaje >= 90) {
        barra.style.background = 'linear-gradient(90deg, #b00020, #d93025)'; // Rojo
    } else if (porcentaje >= 70) {
        barra.style.background = 'linear-gradient(90deg, #ff9800, #ff6b00)'; // Naranja
    } else {
        barra.style.background = 'linear-gradient(90deg, #018642, #0b57d0)'; // Verde/Azul
    }

    // Renderizar detalles
    renderizarDetallesPresupuesto(gastosUltimos30Dias);
}

function renderizarDetallesPresupuesto(gastos) {
    const ul = document.getElementById('listaPresupuestoDetalles');
    ul.innerHTML = '';

    if (gastos.length === 0) {
        ul.innerHTML = '<li style="text-align:center; color:var(--text-light); padding:1rem;">No hay gastos en los últimos 30 días.</li>';
        return;
    }

    // Agrupar por categoría
    const resumenCategorias = {};
    gastos.forEach(m => {
        const cat = m.categoria || 'Sin categoría';
        resumenCategorias[cat] = (resumenCategorias[cat] || 0) + m.cantidad;
    });

    // Ordenar por monto (de mayor a menor)
    const categoriasOrdenadas = Object.entries(resumenCategorias).sort((a, b) => b[1] - a[1]);

    categoriasOrdenadas.forEach(([categoria, monto]) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                <span style="font-weight:500;">${categoria}</span>
                <span style="font-weight:600; color:var(--danger);">Bs. ${formatNumberVE(monto)}</span>
            </div>
        `;
        ul.appendChild(li);
    });
}

async function guardarMetaPresupuesto() {
    const metaInput = document.getElementById('metaPresupuesto').value;
    const meta = parseFloat(metaInput);

    if (isNaN(meta) || meta < 0) {
        alert('Por favor, ingresa una meta válida (mayor o igual a 0).');
        return;
    }

    localStorage.setItem('metaPresupuesto', meta.toString());
    alert('✅ Meta de presupuesto guardada con éxito.');
    await actualizarPresupuesto(); // Actualizar inmediatamente
}

// Cargar la meta guardada al iniciar
async function cargarMetaPresupuesto() {
    const metaGuardada = localStorage.getItem('metaPresupuesto');
    const metaInput = document.getElementById('metaPresupuesto');
    const metaTexto = document.getElementById('metaTexto');
    const leyenda = document.getElementById('leyendaPresupuesto'); // ✅ Nueva referencia

    if (metaGuardada) {
        metaInput.value = parseFloat(metaGuardada).toFixed(2);
        metaTexto.textContent = `Bs. ${parseFloat(metaGuardada).toFixed(2)}`;
        if (leyenda) leyenda.style.display = 'none'; // Ocultar leyenda si hay meta
    } else {
        metaInput.value = '';
        metaTexto.textContent = 'Bs. 0';
        if (leyenda) leyenda.style.display = 'block'; // Mostrar leyenda si no hay meta
    }

    await actualizarPresupuesto(); // Inicializar el gráfico siempre
}

// ------------------------------------------------------------------------------------------------------------------------------------
//                                 Funciones de Presupuesto (continuación)
// ------------------------------------------------------------------------------------------------------------------------------------

async function eliminarMetaPresupuesto() {
    if (!confirm('¿Estás seguro de que quieres eliminar tu meta de presupuesto? Esto borrará tu objetivo mensual y la barra volverá a 0%.')) {
        return;
    }
    localStorage.removeItem('metaPresupuesto');
    document.getElementById('metaPresupuesto').value = '';
    document.getElementById('metaTexto').textContent = 'Bs. 0';
    document.getElementById('progresoTexto').textContent = '0%';
    document.getElementById('barraProgreso').style.width = '0%';
    document.getElementById('barraProgreso').style.background = 'linear-gradient(90deg, #018642, #0b57d0)'; // Volver a verde
    alert('✅ Meta de presupuesto eliminada con éxito.');
    await actualizarPresupuesto(); // Actualiza el gasto actual y el desglose
}

function mostrarModalReporte() {
    document.getElementById('modalReporte').style.display = 'flex';
}

function cerrarModalReporte() {
    document.getElementById('modalReporte').style.display = 'none';
    document.getElementById('formCategoria').style.display = 'none';
    document.getElementById('formFecha').style.display = 'none';
}

async function mostrarSeleccionCategoria() {
    const categorias = await getAllEntries(STORES.CATEGORIAS);
    const select = document.getElementById('selectCategoriaReporte');
    select.innerHTML = '<option value="">Selecciona una categoría</option>';
    categorias.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.nombre;
        opt.textContent = c.nombre;
        select.appendChild(opt);
    });
    document.getElementById('formCategoria').style.display = 'block';
    document.getElementById('modalReporte').style.display = 'none';
}

function cerrarFormCategoria() {
    document.getElementById('formCategoria').style.display = 'none';
    document.getElementById('modalReporte').style.display = 'flex';
}

function mostrarSeleccionFecha() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const fechaActual = `${yyyy}-${mm}-${dd}`;
    
    document.getElementById('fechaDesde').value = '';
    document.getElementById('fechaHasta').value = fechaActual;
    
    document.getElementById('formFecha').style.display = 'block';
    document.getElementById('modalReporte').style.display = 'none';
}

function cerrarFormFecha() {
    document.getElementById('formFecha').style.display = 'none';
    document.getElementById('modalReporte').style.display = 'flex';
}

async function generarReportePorCategoria() {
    const categoria = document.getElementById('selectCategoriaReporte').value;
    if (!categoria) {
        alert('Selecciona una categoría.');
        return;
    }
    const movimientos = await getAllEntries(STORES.MOVIMIENTOS);
    const movimientosFiltrados = movimientos.filter(m => m.categoria === categoria);
    // Adaptar la función existente para usar solo estos movimientos
    const saldoInicialArray = await getAllEntries(STORES.SALDO_INICIAL);
    const saldoInicial = saldoInicialArray.length > 0 ? saldoInicialArray[0].monto : 0;
    const totalComisiones = movimientosFiltrados
        .filter(m => m.tipo === 'gasto')
        .reduce((sum, m) => sum + (m.cantidad * 0.003), 0);
    const saldoTotal = saldoInicial + movimientosFiltrados.reduce((sum, m) => sum + (m.tipo === 'ingreso' ? m.cantidad : -m.cantidad), 0) - totalComisiones;

    // Crear contenido HTML para impresión
    const contenido = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Reporte Financiero - SFP</title>
            <style>
                body { font-family: 'Roboto', sans-serif; padding: 2rem; }
                h1 { text-align: center; color: #0b57d0; margin-bottom: 2rem; }
                .resumen { background: #f5f7fa; padding: 1rem; border-radius: 8px; margin-bottom: 2rem; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 2rem; }
                th, td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #ddd; }
                th { background: #0b57d0; color: white; }
                .movimiento { margin-bottom: 1rem; padding: 1rem; border-left: 4px solid #0b57d0; background: #f9f9f9; }
                .fecha { color: #666; font-size: 0.9rem; }
                .total { font-weight: bold; font-size: 1.2rem; color: #0b57d0; text-align: right; margin-top: 1rem; }
                @media print {
                    body { padding: 0; }
                    button { display: none; }
                }
            </style>
        </head>
        <body>
            <h1>Reporte Financiero - Sistema Financiero Personal</h1>
            <div class="resumen">
                <h3>Resumen General</h3>
                <p><strong>Saldo Inicial:</strong> Bs. ${formatNumberVE(saldoInicial)}</p>
                <p><strong>Total Comisiones:</strong> Bs. ${formatNumberVE(totalComisiones)}</p>
                <p><strong>Saldo Actual:</strong> Bs. ${formatNumberVE(saldoTotal)}</p>
            </div>
            <h3>Movimientos por Categoría: "${categoria}"</h3>
            ${movimientosFiltrados.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).map(m => `
                <div class="movimiento">
                    <div><strong>${m.concepto}</strong></div>
                    <div class="fecha">${m.banco || '(Sin banco)'} · ${new Date(m.fecha).toLocaleDateString()}</div>
                    <div><strong>${m.tipo === 'ingreso' ? '+' : '-'} Bs. ${formatNumberVE(m.cantidad)}</strong></div>
                </div>
            `).join('')}
            <div class="total">Saldo Final: Bs. ${formatNumberVE(saldoTotal)}</div>
            <script>
                window.print();
            </script>
        </body>
        </html>
    `;
    const ventana = window.open('', '_blank');
    ventana.document.write(contenido);
    ventana.document.close();
    cerrarFormCategoria();
}

async function generarReportePorFecha() {
    const desde = document.getElementById('fechaDesde').value;
    const hasta = document.getElementById('fechaHasta').value;
    if (!desde || !hasta) {
        alert('Selecciona las fechas.');
        return;
    }
    const movimientos = await getAllEntries(STORES.MOVIMIENTOS);
    const movimientosFiltrados = movimientos.filter(m => {
        const fechaMov = new Date(m.fecha);
        const fechaDesde = new Date(desde);
        const fechaHasta = new Date(hasta);
        return fechaMov >= fechaDesde && fechaMov <= fechaHasta;
    });
    const saldoInicialArray = await getAllEntries(STORES.SALDO_INICIAL);
    const saldoInicial = saldoInicialArray.length > 0 ? saldoInicialArray[0].monto : 0;
    const totalComisiones = movimientosFiltrados
        .filter(m => m.tipo === 'gasto')
        .reduce((sum, m) => sum + (m.cantidad * 0.003), 0);
    const saldoTotal = saldoInicial + movimientosFiltrados.reduce((sum, m) => sum + (m.tipo === 'ingreso' ? m.cantidad : -m.cantidad), 0) - totalComisiones;

    // Crear contenido HTML para impresión
    const contenido = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Reporte Financiero - SFP</title>
            <style>
                body { font-family: 'Roboto', sans-serif; padding: 2rem; }
                h1 { text-align: center; color: #0b57d0; margin-bottom: 2rem; }
                .resumen { background: #f5f7fa; padding: 1rem; border-radius: 8px; margin-bottom: 2rem; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 2rem; }
                th, td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #ddd; }
                th { background: #0b57d0; color: white; }
                .movimiento { margin-bottom: 1rem; padding: 1rem; border-left: 4px solid #0b57d0; background: #f9f9f9; }
                .fecha { color: #666; font-size: 0.9rem; }
                .total { font-weight: bold; font-size: 1.2rem; color: #0b57d0; text-align: right; margin-top: 1rem; }
                @media print {
                    body { padding: 0; }
                    button { display: none; }
                }
            </style>
        </head>
        <body>
            <h1>Reporte Financiero - Sistema Financiero Personal</h1>
            <div class="resumen">
                <h3>Resumen General</h3>
                <p><strong>Periodo:</strong> ${new Date(desde).toLocaleDateString()} a ${new Date(hasta).toLocaleDateString()}</p>
                <p><strong>Saldo Inicial:</strong> Bs. ${formatNumberVE(saldoInicial)}</p>
                <p><strong>Total Comisiones:</strong> Bs. ${formatNumberVE(totalComisiones)}</p>
                <p><strong>Saldo Actual:</strong> Bs. ${formatNumberVE(saldoTotal)}</p>
            </div>
            <h3>Movimientos del Periodo</h3>
            ${movimientosFiltrados.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).map(m => `
                <div class="movimiento">
                    <div><strong>${m.concepto}</strong></div>
                    <div class="fecha">${m.categoria || 'Sin categoría'} · ${m.banco || '(Sin banco)'} · ${new Date(m.fecha).toLocaleDateString()}</div>
                    <div><strong>${m.tipo === 'ingreso' ? '+' : '-'} Bs. ${formatNumberVE(m.cantidad)}</strong></div>
                </div>
            `).join('')}
            <div class="total">Saldo Final: Bs. ${formatNumberVE(saldoTotal)}</div>
            <script>
                window.print();
            </script>
        </body>
        </html>
    `;
    const ventana = window.open('', '_blank');
    ventana.document.write(contenido);
    ventana.document.close();
    cerrarFormFecha();
}

// ------------------------------------------------------------------------------------------------------------------------------------
//                                 Bloqueo de App (PIN Local)
// ------------------------------------------------------------------------------------------------------------------------------------

// Cargar configuración de bloqueo al iniciar
async function cargarConfigBloqueo() {
    const activado = localStorage.getItem('bloqueoActivo') === 'true';
    const pinGuardado = localStorage.getItem('bloqueoPIN');
    document.getElementById('bloqueoActivo').checked = activado;
    document.getElementById('bloqueoPINContainer').style.display = activado ? 'block' : 'none';

    // Si está activado, mostrar modal de bloqueo si no se ha desbloqueado aún
    if (activado && !localStorage.getItem('bloqueoDesbloqueado')) {
        mostrarModalBloqueo();
    }
}

// Mostrar el modal de bloqueo
function mostrarModalBloqueo() {
    document.getElementById('modalBloqueo').style.display = 'flex';
    document.getElementById('pinInput').value = '';
}

// Cerrar el modal de bloqueo
function cerrarModalBloqueo() {
    document.getElementById('modalBloqueo').style.display = 'none';
    document.getElementById('pinInput').value = '';
    document.getElementById('avisoPinOlvidado').style.display = 'none'; // ✅ REINICIAR AVISO
    localStorage.setItem('intentosFallidos', '0'); // ✅ REINICIAR CONTADOR
}

// Desbloquear la app con el PIN
async function desbloquearApp() {
    const pinIngresado = document.getElementById('pinInput').value.trim().toLowerCase();
    const pinGuardado = localStorage.getItem('bloqueoPIN');
    const aviso = document.getElementById('avisoPinOlvidado');

    // ✅ Reiniciar contador si se ingresa algo válido
    if (pinIngresado === 'reset' || (pinIngresado.length === 4 && pinIngresado === pinGuardado)) {
        localStorage.setItem('intentosFallidos', '0'); // Reiniciar contador
        aviso.style.display = 'none';
    }

    // ✅ MODO DE EMERGENCIA: Si se ingresa "reset", desactiva el bloqueo
    if (pinIngresado === 'reset') {
        if (confirm('⚠️ ¿Estás seguro de que quieres desactivar el bloqueo de la app? \n\nEsto eliminará tu PIN y permitirá el acceso sin restricciones. \n\nSolo haz esto si olvidaste tu PIN y no tienes otra copia de seguridad.')) {
            localStorage.removeItem('bloqueoPIN');
            localStorage.removeItem('bloqueoActivo');
            localStorage.removeItem('bloqueoDesbloqueado');
            alert('🔒 Bloqueo desactivado con éxito. Ahora puedes acceder sin PIN.');
            cerrarModalBloqueo();
        }
        return;
    }

    // Validación normal de PIN
    if (!pinIngresado || pinIngresado.length !== 4) {
        alert('Ingresa un PIN de 4 dígitos o escribe "reset" para desactivar el bloqueo.');
        return;
    }

    if (pinIngresado === pinGuardado) {
        localStorage.setItem('bloqueoDesbloqueado', 'true');
        localStorage.setItem('intentosFallidos', '0'); // Reiniciar contador
        aviso.style.display = 'none';
        cerrarModalBloqueo();
        const pestaña = localStorage.getItem('agendaPestañaActiva');
        if (pestaña) mostrarSideTab(pestaña);
    } else {
        // Contar intentos fallidos
        let intentos = parseInt(localStorage.getItem('intentosFallidos')) || 0;
        intentos++;
        localStorage.setItem('intentosFallidos', intentos.toString());

        // Mostrar aviso después de 2 intentos fallidos
        if (intentos >= 2) {
            aviso.style.display = 'block';
        }

        alert('PIN incorrecto. Intenta de nuevo.\n\n¿Olvidaste tu PIN? Escribe "reset" para desactivar el bloqueo.');
        document.getElementById('pinInput').value = '';
    }
}

// Guardar PIN
async function guardarPIN() {
    const pin = document.getElementById('bloqueoPIN').value.trim();
    const pinConfirm = document.getElementById('bloqueoPINConfirmar').value.trim();

    if (!pin || pin.length !== 4 || !pinConfirm || pinConfirm.length !== 4) {
        alert('El PIN debe tener exactamente 4 dígitos.');
        return;
    }

    if (pin !== pinConfirm) {
        alert('Los PINs no coinciden. Vuelve a intentarlo.');
        document.getElementById('bloqueoPIN').value = '';
        document.getElementById('bloqueoPINConfirmar').value = '';
        return;
    }

    localStorage.setItem('bloqueoPIN', pin);
    alert('✅ PIN guardado con éxito.');
    document.getElementById('bloqueoPIN').value = '';
    document.getElementById('bloqueoPINConfirmar').value = '';
}

// Eliminar PIN
async function eliminarPIN() {
    if (!confirm('¿Estás seguro de que quieres eliminar tu PIN? Ya no podrás bloquear la app.')) return;
    localStorage.removeItem('bloqueoPIN');
    localStorage.removeItem('bloqueoDesbloqueado');
    document.getElementById('bloqueoPIN').value = '';
    document.getElementById('bloqueoPINConfirmar').value = '';
    alert('PIN eliminado.');
}

// Controlar el checkbox de activación
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('bloqueoActivo').addEventListener('change', function() {
        const container = document.getElementById('bloqueoPINContainer');
        if (this.checked) {
            container.style.display = 'block';
            localStorage.setItem('bloqueoActivo', 'true');
            // Si ya hay un PIN guardado, no pedirlo hasta que se cierre y vuelva a abrir
            if (localStorage.getItem('bloqueoPIN')) {
                localStorage.removeItem('bloqueoDesbloqueado'); // Forzar bloqueo en próxima apertura
            }
        } else {
            container.style.display = 'none';
            localStorage.setItem('bloqueoActivo', 'false');
            localStorage.removeItem('bloqueoDesbloqueado'); // Limpiar estado
        }
    });
});

// ✅ Renderiza la lista de categorías editables (con clic para editar)
async function renderizarCategoriasEditables() {
    const ul = document.getElementById('listaCategoriasEditables');
    ul.innerHTML = '';
    const categorias = await getAllEntries(STORES.CATEGORIAS);
    if (categorias.length === 0) {
        ul.innerHTML = '<li style="color: var(--text-light); padding: 0.75rem;">No hay categorías aún.</li>';
        return;
    }
    categorias.forEach(cat => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span class="categoria-nombre" style="font-weight:500; cursor:pointer; padding:0.5rem; border-radius:6px; display:inline-block; margin-right:0.5rem;"
                  data-nombre="${cat.nombre}" 
                  ondblclick="editarCategoria('${cat.nombre}')">
                ${cat.nombre}
            </span>
            <button onclick="eliminarCategoriaPorNombre('${cat.nombre}')" style="padding:0.3rem 0.6rem; font-size:0.8rem; background:#b00020; color:white; border:none; border-radius:4px; cursor:pointer;">
                ❌
            </button>
        `;
        ul.appendChild(li);
    });
}

// ✅ Renderiza la lista de bancos editables (con clic para editar)
async function renderizarBancosEditables() {
    const ul = document.getElementById('listaBancosEditables');
    ul.innerHTML = '';
    const bancos = await getAllEntries(STORES.BANCOS);
    if (bancos.length === 0) {
        ul.innerHTML = '<li style="color: var(--text-light); padding: 0.75rem;">No hay bancos aún.</li>';
        return;
    }
    bancos.forEach(banco => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span class="banco-nombre" style="font-weight:500; cursor:pointer; padding:0.5rem; border-radius:6px; display:inline-block; margin-right:0.5rem;"
                  data-nombre="${banco.nombre}" 
                  ondblclick="editarBanco('${banco.nombre}')">
                ${banco.nombre}
            </span>
            <button onclick="eliminarBancoPorNombre('${banco.nombre}')" style="padding:0.3rem 0.6rem; font-size:0.8rem; background:#b00020; color:white; border:none; border-radius:4px; cursor:pointer;">
                ❌
            </button>
        `;
        ul.appendChild(li);
    });
}

// ✅ Función para editar una categoría (doble clic → transforma en input)
function editarCategoria(nombreActual) {
    const spans = document.querySelectorAll('.categoria-nombre');
    const span = Array.from(spans).find(s => s.getAttribute('data-nombre') === nombreActual);
    if (!span) return;

    // ✅ OCULTAR EL SPAN ORIGINAL (esto es clave para que guardarBanco lo encuentre)
    span.style.display = 'none';

    // Crear input
    const input = document.createElement('input');
    input.type = 'text';
    input.value = nombreActual;
    input.style.width = '100%';
    input.style.padding = '0.5rem';
    input.style.border = '1px solid #ccc';
    input.style.borderRadius = '6px';
    input.style.marginRight = '0.5rem';
    input.style.fontWeight = '500';
    input.style.backgroundColor = 'var(--card-bg)';
    input.style.color = 'var(--text)';

    // Reemplazar span por input
    span.parentNode.replaceChild(input, span);

    // Enfocar y seleccionar texto
    input.focus();
    input.select();

    // Guardar al presionar Enter o al perder foco
    input.addEventListener('blur', guardarCategoria);
    input.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            guardarCategoria();
        }
    });
}

// ✅ Función para guardar la categoría editada
// ✅ Función para guardar la categoría editada
async function guardarCategoria() {
    const input = event.target;
    const nuevoNombre = input.value.trim();
    
    // Buscar el span original que fue reemplazado
    // ✅ Guardamos el nombre anterior ANTES de que se reemplace
    const spanOriginal = document.querySelector('.categoria-nombre[style*="display: none"]');
    if (!spanOriginal) {
        // Si no se encuentra el span oculto, buscar por el atributo data-nombre que estaba antes
        const spans = document.querySelectorAll('.categoria-nombre');
        const spanAnterior = Array.from(spans).find(s => s.style.display === 'none');
        if (spanAnterior) {
            const nombreAnterior = spanAnterior.getAttribute('data-nombre');
            if (nombreAnterior === nuevoNombre) {
                input.parentNode.replaceChild(spanAnterior, input);
                return;
            }
            // Si el nombre anterior es diferente, lo usamos
            if (nombreAnterior) {
                // Verificar duplicados
                const categorias = await getAllEntries(STORES.CATEGORIAS);
                if (categorias.some(c => c.nombre === nuevoNombre && c.nombre !== nombreAnterior)) {
                    alert(`Ya existe una categoría llamada "${nuevoNombre}".`);
                    input.parentNode.replaceChild(spanAnterior, input);
                    return;
                }
                // Actualizar en DB
                await deleteEntry(STORES.CATEGORIAS, nombreAnterior);
                await addEntry(STORES.CATEGORIAS, { nombre: nuevoNombre });
                // Actualizar movimientos
                const movimientos = await getAllEntries(STORES.MOVIMIENTOS);
                const transaction = db.transaction([STORES.MOVIMIENTOS], 'readwrite');
                const store = transaction.objectStore(STORES.MOVIMIENTOS);
                movimientos.forEach(m => {
                    if (m.categoria === nombreAnterior) {
                        m.categoria = nuevoNombre;
                        store.put(m);
                    }
                });
                // Refrescar
                renderizarCategoriasEditables();
                actualizarSelectCategorias();
                cargarSelectEliminarCategorias();
                alert(`✅ Categoría "${nombreAnterior}" renombrada como "${nuevoNombre}".`);
                return;
            }
        }
        // Si no encontramos el span anterior, es un error
        alert("Error al identificar la categoría original.");
        input.parentNode.replaceChild(input.previousElementSibling, input);
        return;
    }

    const nombreAnterior = spanOriginal.getAttribute('data-nombre');

    // Validar
    if (!nuevoNombre) {
        alert('El nombre de la categoría no puede estar vacío.');
        input.parentNode.replaceChild(spanOriginal, input);
        return;
    }

    if (nuevoNombre === nombreAnterior) {
        input.parentNode.replaceChild(spanOriginal, input);
        return;
    }

    // Verificar duplicados
    const categorias = await getAllEntries(STORES.CATEGORIAS);
    if (categorias.some(c => c.nombre === nuevoNombre && c.nombre !== nombreAnterior)) {
        alert(`Ya existe una categoría llamada "${nuevoNombre}".`);
        input.parentNode.replaceChild(spanOriginal, input);
        return;
    }

    // Actualizar en la base de datos
    try {
        await deleteEntry(STORES.CATEGORIAS, nombreAnterior);
        await addEntry(STORES.CATEGORIAS, { nombre: nuevoNombre });

        // Actualizar todos los movimientos con esta categoría
        const movimientos = await getAllEntries(STORES.MOVIMIENTOS);
        const transaction = db.transaction([STORES.MOVIMIENTOS], 'readwrite');
        const store = transaction.objectStore(STORES.MOVIMIENTOS);
        movimientos.forEach(m => {
            if (m.categoria === nombreAnterior) {
                m.categoria = nuevoNombre;
                store.put(m);
            }
        });

        // Refrescar interfaces
        renderizarCategoriasEditables();
        actualizarSelectCategorias();
        cargarSelectEliminarCategorias();
        alert(`✅ Categoría "${nombreAnterior}" renombrada como "${nuevoNombre}".`);
    } catch (error) {
        console.error("Error al actualizar categoría:", error);
        alert("Error al renombrar la categoría.");
    }
}

// ✅ Función para editar un banco (doble clic → transforma en input)
function editarBanco(nombreActual) {
    const spans = document.querySelectorAll('.banco-nombre');
    const span = Array.from(spans).find(s => s.getAttribute('data-nombre') === nombreActual);
    if (!span) return;

    // ✅ OCULTAR EL SPAN ORIGINAL (esto es clave para que guardarBanco lo encuentre)
    span.style.display = 'none';

    const input = document.createElement('input');
    input.type = 'text';
    input.value = nombreActual;
    input.style.width = '100%';
    input.style.padding = '0.5rem';
    input.style.border = '1px solid #ccc';
    input.style.borderRadius = '6px';
    input.style.marginRight = '0.5rem';
    input.style.fontWeight = '500';
    input.style.backgroundColor = 'var(--card-bg)';
    input.style.color = 'var(--text)';

    span.parentNode.replaceChild(input, span);

    input.focus();
    input.select();

    input.addEventListener('blur', guardarBanco);
    input.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            guardarBanco();
        }
    });
}

// ✅ Función para guardar el banco editado
async function guardarBanco() {
    const input = event.target;
    const nuevoNombre = input.value.trim();
    
    // Buscar el span original que fue reemplazado
    const spanOriginal = document.querySelector('.banco-nombre[style*="display: none"]');
    if (!spanOriginal) {
        const spans = document.querySelectorAll('.banco-nombre');
        const spanAnterior = Array.from(spans).find(s => s.style.display === 'none');
        if (spanAnterior) {
            const nombreAnterior = spanAnterior.getAttribute('data-nombre');
            if (nombreAnterior === nuevoNombre) {
                input.parentNode.replaceChild(spanAnterior, input);
                return;
            }
            if (nombreAnterior) {
                const bancos = await getAllEntries(STORES.BANCOS);
                if (bancos.some(b => b.nombre === nuevoNombre && b.nombre !== nombreAnterior)) {
                    alert(`Ya existe un banco llamado "${nuevoNombre}".`);
                    input.parentNode.replaceChild(spanAnterior, input);
                    return;
                }
                await deleteEntry(STORES.BANCOS, nombreAnterior);
                await addEntry(STORES.BANCOS, { nombre: nuevoNombre });
                const movimientos = await getAllEntries(STORES.MOVIMIENTOS);
                const transaction = db.transaction([STORES.MOVIMIENTOS], 'readwrite');
                const store = transaction.objectStore(STORES.MOVIMIENTOS);
                movimientos.forEach(m => {
                    if (m.banco === nombreAnterior) {
                        m.banco = nuevoNombre;
                        store.put(m);
                    }
                });
                renderizarBancosEditables();
                cargarSelectBancos();
                cargarSelectBancoRegla();
                cargarSelectEliminarBancos();
                alert(`✅ Banco "${nombreAnterior}" renombrado como "${nuevoNombre}".`);
                return;
            }
        }
        alert("Error al identificar el banco original.");
        input.parentNode.replaceChild(input.previousElementSibling, input);
        return;
    }

    const nombreAnterior = spanOriginal.getAttribute('data-nombre');

    if (!nuevoNombre) {
        alert('El nombre del banco no puede estar vacío.');
        input.parentNode.replaceChild(spanOriginal, input);
        return;
    }

    if (nuevoNombre === nombreAnterior) {
        input.parentNode.replaceChild(spanOriginal, input);
        return;
    }

    const bancos = await getAllEntries(STORES.BANCOS);
    if (bancos.some(b => b.nombre === nuevoNombre && b.nombre !== nombreAnterior)) {
        alert(`Ya existe un banco llamado "${nuevoNombre}".`);
        input.parentNode.replaceChild(spanOriginal, input);
        return;
    }

    try {
        await deleteEntry(STORES.BANCOS, nombreAnterior);
        await addEntry(STORES.BANCOS, { nombre: nuevoNombre });

        const movimientos = await getAllEntries(STORES.MOVIMIENTOS);
        const transaction = db.transaction([STORES.MOVIMIENTOS], 'readwrite');
        const store = transaction.objectStore(STORES.MOVIMIENTOS);
        movimientos.forEach(m => {
            if (m.banco === nombreAnterior) {
                m.banco = nuevoNombre;
                store.put(m);
            }
        });

        renderizarBancosEditables();
        cargarSelectBancos();
        cargarSelectBancoRegla();
        cargarSelectEliminarBancos();
        alert(`✅ Banco "${nombreAnterior}" renombrado como "${nuevoNombre}".`);
    } catch (error) {
        console.error("Error al actualizar banco:", error);
        alert("Error al renombrar el banco.");
    }
}

// ✅ Funciones auxiliares para eliminar por nombre (para los botones de eliminar en las listas editables)
async function eliminarCategoriaPorNombre(nombre) {
    if (!confirm(`¿Estás seguro de que quieres eliminar la categoría "${nombre}"? Los movimientos quedarán sin categoría.`)) return;
    try {
        await deleteEntry(STORES.CATEGORIAS, nombre);
        const movimientos = await getAllEntries(STORES.MOVIMIENTOS);
        const transaction = db.transaction([STORES.MOVIMIENTOS], 'readwrite');
        const store = transaction.objectStore(STORES.MOVIMIENTOS);
        movimientos.forEach(m => {
            if (m.categoria === nombre) {
                m.categoria = 'Sin categoría';
                store.put(m);
            }
        });
        renderizarCategoriasEditables();
        actualizarSelectCategorias();
        cargarSelectEliminarCategorias();
        alert(`Categoría "${nombre}" eliminada.`);
    } catch (error) {
        console.error("Error al eliminar categoría:", error);
    }
}

async function eliminarBancoPorNombre(nombre) {
    const movimientos = await getAllEntries(STORES.MOVIMIENTOS);
    const afectados = movimientos.filter(m => m.banco === nombre).length;
    if (!confirm(`¿Seguro que quieres eliminar el banco "${nombre}"? 
Se quitará de ${afectados} movimiento${afectados !== 1 ? 's' : ''}.`)) return;

    try {
        await deleteEntry(STORES.BANCOS, nombre);
        const transaction = db.transaction([STORES.MOVIMIENTOS], 'readwrite');
        const store = transaction.objectStore(STORES.MOVIMIENTOS);
        movimientos.forEach(m => {
            if (m.banco === nombre) {
                m.banco = '(Sin banco)';
                store.put(m);
            }
        });
        renderizarBancosEditables();
        cargarSelectBancos();
        cargarSelectBancoRegla();
        cargarSelectEliminarBancos();
        alert(`✅ Banco "${nombre}" eliminado.
Se actualizó${afectados !== 1 ? 'ron' : ''} ${afectados} movimiento${afectados !== 1 ? 's' : ''}.`);
    } catch (error) {
        console.error("Error al eliminar banco:", error);
    }
}

// ✅ EXPORTAR BACKUP COMPLETO (todo el estado de la app)
async function exportarBackup() {
    try {
        // Recopilar todos los datos
        const movimientos = await getAllEntries(STORES.MOVIMIENTOS);
        const categorias = await getAllEntries(STORES.CATEGORIAS);
        const bancos = await getAllEntries(STORES.BANCOS);
        const reglas = await getAllEntries(STORES.REGLAS);
        const saldoInicial = await getAllEntries(STORES.SALDO_INICIAL);
        const metaPresupuesto = localStorage.getItem('metaPresupuesto');
        const tasaCambio = localStorage.getItem('tasaCambio');
        const bloqueoActivo = localStorage.getItem('bloqueoActivo') === 'true';
        const bloqueoPIN = localStorage.getItem('bloqueoPIN');
        const tema = localStorage.getItem('agendaTema');

        // Crear objeto de backup
        const backup = {
            version: '1.0',
            fecha: new Date().toISOString(),
            movimientos: movimientos,
            categorias: categorias,
            bancos: bancos,
            reglas: reglas,
            saldoInicial: saldoInicial.length > 0 ? saldoInicial[0] : null,
            metaPresupuesto: metaPresupuesto,
            tasaCambio: tasaCambio,
            bloqueoActivo: bloqueoActivo,
            bloqueoPIN: bloqueoPIN,
            tema: tema
        };

        // Convertir a JSON y descargar
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backup, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `SFP_Backup_${new Date().toISOString().split('T')[0]}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();

        alert("✅ Backup exportado con éxito. Archivo guardado como 'SFP_Backup_YYYY-MM-DD.json'");
    } catch (error) {
        console.error("Error al exportar backup:", error);
        alert("❌ Error al exportar el backup. Revisa la consola.");
    }
}

// ✅ IMPORTAR BACKUP COMPLETO (restaura todo)
async function importarBackup() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.style.display = 'none';
    document.body.appendChild(input);

    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const backup = JSON.parse(event.target.result);

                // Validar versión
                if (backup.version !== '1.0') {
                    alert("⚠️ Este archivo de backup no es compatible con esta versión de la app.");
                    return;
                }

                // Confirmar antes de sobrescribir
                if (!confirm("⚠️ ¡ADVERTENCIA! Esto borrará todos tus datos actuales y los reemplazará con los del backup. ¿Continuar?")) {
                    return;
                }

                // 1. Borrar todo lo existente
                const transaction = db.transaction([STORES.MOVIMIENTOS, STORES.CATEGORIAS, STORES.BANCOS, STORES.REGLAS, STORES.SALDO_INICIAL], 'readwrite');
                const movStore = transaction.objectStore(STORES.MOVIMIENTOS);
                const catStore = transaction.objectStore(STORES.CATEGORIAS);
                const banStore = transaction.objectStore(STORES.BANCOS);
                const regStore = transaction.objectStore(STORES.REGLAS);
                const salStore = transaction.objectStore(STORES.SALDO_INICIAL);

                // Limpiar almacenes
                movStore.clear();
                catStore.clear();
                banStore.clear();
                regStore.clear();
                salStore.clear();

                // 2. Restaurar categorías
                if (backup.categorias && backup.categorias.length > 0) {
                    for (const cat of backup.categorias) {
                        await addEntry(STORES.CATEGORIAS, cat);
                    }
                }

                // 3. Restaurar bancos
                if (backup.bancos && backup.bancos.length > 0) {
                    for (const ban of backup.bancos) {
                        await addEntry(STORES.BANCOS, ban);
                    }
                }

                // 4. Restaurar reglas
                if (backup.reglas && backup.reglas.length > 0) {
                    for (const reg of backup.reglas) {
                        await addEntry(STORES.REGLAS, reg);
                    }
                }

                // 5. Restaurar saldo inicial
                if (backup.saldoInicial) {
                    await addEntry(STORES.SALDO_INICIAL, backup.saldoInicial);
                }

                // 6. Restaurar movimientos
                if (backup.movimientos && backup.movimientos.length > 0) {
                    for (const mov of backup.movimientos) {
                        await addEntry(STORES.MOVIMIENTOS, mov);
                    }
                }

                // 7. Restaurar localStorage
                localStorage.setItem('metaPresupuesto', backup.metaPresupuesto || '');
                localStorage.setItem('tasaCambio', backup.tasaCambio || '');
                localStorage.setItem('bloqueoActivo', backup.bloqueoActivo ? 'true' : 'false');
                localStorage.setItem('bloqueoPIN', backup.bloqueoPIN || '');
                localStorage.setItem('agendaTema', backup.tema || '');

                // 8. Limpiar input y refrescar app
                input.remove();
                alert("✅ Backup importado con éxito. Recargando la app...");

                // Recargar la app para reflejar cambios
                location.reload();

            } catch (error) {
                console.error("Error al importar backup:", error);
                alert("❌ Error al importar el backup. El archivo puede estar corrupto o no compatible.");
                input.remove();
            }
        };
        reader.readAsText(file);
    };

    input.click();
}

// Cargar configuración de bloqueo al inicio
document.addEventListener('DOMContentLoaded', async function () {
    try {
        // ... (todo lo que ya tenías)

        // ✅ AÑADIR ESTA LÍNEA AL FINAL DE LA FUNCIÓN, JUSTO ANTES DEL CIERRE DEL TRY
        await cargarConfigBloqueo();

        let inactividadTimer;

function reiniciarTimer() {
    clearTimeout(inactividadTimer);
    inactividadTimer = setTimeout(() => {
        if (localStorage.getItem('bloqueoActivo') === 'true') {
            localStorage.removeItem('bloqueoDesbloqueado');
            mostrarModalBloqueo();
        }
    }, 5 * 60 * 1000); // 5 minutos
}

// Iniciar el timer
reiniciarTimer();

// Reiniciar al interactuar
document.addEventListener('mousemove', reiniciarTimer);
document.addEventListener('keypress', reiniciarTimer);
document.addEventListener('click', reiniciarTimer);

    } catch (error) {
        console.error("Error en la inicialización de la app:", error);
    }
});

// ✅ OCULTAR/MOSTRAR CAMPOS DINÁMICAMENTE SEGÚN EL TIPO DE MOVIMIENTO
document.addEventListener('DOMContentLoaded', function () {
  const tipoSelect = document.getElementById('tipo');
  const saldoInicialInput = document.getElementById('saldoInicial');
  const cantidadInput = document.getElementById('cantidad');
  const conceptoInput = document.getElementById('concepto');

  function actualizarCampos() {
    const tipo = tipoSelect.value;

    if (tipo === 'saldo_inicial') {
      // Mostrar solo saldoInicial, ocultar cantidad
      cantidadInput.style.display = 'none';
      cantidadInput.value = ''; // Limpiar para evitar errores
      saldoInicialInput.style.display = 'block';
      saldoInicialInput.setAttribute('placeholder', 'Saldo inicial del banco');
    } else {
      // Mostrar solo cantidad, ocultar saldoInicial
      saldoInicialInput.style.display = 'none';
      saldoInicialInput.value = '';
      cantidadInput.style.display = 'block';
      cantidadInput.setAttribute('placeholder', 'Cantidad');
      conceptoInput.setAttribute('placeholder', 'Concepto');
    }
  }

  // Escuchar cambios en el tipo
  tipoSelect.addEventListener('change', actualizarCampos);

  // Ejecutar al cargar para aplicar estado inicial
  actualizarCampos();
});

// ✅ FUNCION DE REPARACIÓN INTELIGENTE: Limpia y reinicia la app sin perder datos
async function repararApp() {
    alert('🔍 Se detectó una inconsistencia en la visualización. Reinitializando la app...');

    // 1. Forzar recarga de todos los datos
    await renderizar();           // Recarga la lista de movimientos
    await actualizarSaldo();      // Recalcula saldo con formato correcto
    await actualizarResumenBancosCompleto(); // Recalcula tabla de bancos
    await actualizarGrafico();    // Refresca gráfico de gastos
    await actualizarBarChart();   // Refresca gráfico mensual
    await renderizarResumenBancos(); // Refresca resumen de bancos en pestaña análisis
    await cargarMetaPresupuesto(); // Recarga meta de presupuesto
    await actualizarPresupuesto(); // Refresca barra de progreso

    // 2. Forzar renderizado de elementos que pueden quedar rotos
    document.getElementById('saldoAviso')?.style.display === 'none' && 
        document.getElementById('saldoAviso')?.style.display === 'block'; // Forzar display

    // 3. Limpiar posibles eventos colgantes (solo si hay error)
    const btnTema = document.getElementById('btnTema');
    if (btnTema) {
        btnTema.style.display = 'block'; // Asegurar que el botón de tema esté visible
    }

    // 4. Mostrar mensaje de éxito
    setTimeout(() => {
        alert('✅ App reparada con éxito. Todo debería verse correctamente ahora.');
    }, 500);

    // 5. (Opcional) Forzar un scroll para que el usuario vea el cambio
    window.scrollTo(0, 0);
}

// ------------------------------------------------------------------------------------------------------------------------------------
//                                 Inicialización y Event Listeners
// ------------------------------------------------------------------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', async function () {
    try {
        // ✅ Establecer la fecha actual en el campo de fecha del formulario
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const fechaFormateada = `${yyyy}-${mm}-${dd}`;
        document.getElementById('fechaMov').value = fechaFormateada;

        // Inicializar la base de datos
        await openDB();

        // Cargar los selectores de la UI con datos de la DB
        await actualizarSelectCategorias();
        await cargarSelectBancos();
        await cargarSelectEliminarCategorias();
        await cargarSelectEliminarBancos();
        await cargarSelectBancoRegla();

        // Renderizar la información inicial en la interfaz
        await renderizar();
        await renderizarResumenBancos();
        await renderizarReglas();

         // Cargar meta de presupuesto y actualizar
        await cargarMetaPresupuesto();

        // Aplicar el tema guardado
        aplicarTemaInicial();

        // Asignar Event Listeners
        document.getElementById('tasaCambio').addEventListener('input', actualizarEquivalente);
        document.getElementById('monedaDestino').addEventListener('change', actualizarEquivalente);
        document.getElementById('filtroBanco').addEventListener('change', renderizar);
        document.getElementById('btnTema').addEventListener('click', () => {
            const body = document.body;
            if (body.classList.contains('modo-claro')) {
                body.classList.remove('modo-claro');
                body.classList.add('modo-oscuro');
                localStorage.setItem('agendaTema', 'oscuro');
            } else if (body.classList.contains('modo-oscuro')) {
                body.classList.remove('modo-oscuro');
                localStorage.removeItem('agendaTema');
            } else {
                body.classList.add('modo-claro');
                localStorage.setItem('agendaTema', 'claro');
            }
        });

        // Eventos para mostrar/ocultar campos de texto
        document.getElementById('categoria').addEventListener('change', e => {
            const input = document.getElementById('nuevaCategoria');
            input.style.display = e.target.value === 'Otro' ? 'block' : 'none';
            if (input.style.display === 'block') input.focus();
        });

        document.getElementById('banco').addEventListener('change', e => {
            const input = document.getElementById('nuevoBanco');
            input.style.display = e.target.value === 'Otro' ? 'block' : 'none';
            if (input.style.display === 'block') input.focus();
        });

        document.getElementById('txtBancoRegla').addEventListener('change', e => {
            const input = document.getElementById('nuevoBancoRegla');
            input.style.display = e.target.value === 'Otro' ? 'block' : 'none';
            if (input.style.display === 'block') input.focus();
        });

        // ✅ Renderizar listas editables al cargar
        await renderizarCategoriasEditables();
        await renderizarBancosEditables();

        // Cargar la pestaña guardada, si existe
        const pestañaGuardada = localStorage.getItem('agendaPestañaActiva');
        if (pestañaGuardada) {
            mostrarSideTab(pestañaGuardada);
        } else {
            mostrarSideTab('dashboard'); // ← Cambia esto por:
            // mostrarSideTab('dashboard');
            // Añadimos la nueva pestaña como predeterminada si no hay guardada
            mostrarSideTab('dashboard');
        }
    } catch (error) {
        console.error("Error en la inicialización de la app:", error);
    }
});
