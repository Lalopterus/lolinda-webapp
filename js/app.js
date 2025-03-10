/*****************************************
 app.js
 ******************************************/

let itemsData = [];
let cuentasData = [];
let currentUsername = "Usuario";
let modoEdicionCuenta = null;
let isAdding = true; // switch: sumar/restar

// Al cargar la página
document.addEventListener("DOMContentLoaded", async () => {
  loadFromLocalStorage();

  // Carga CSV la primera vez si no hay data
  if (!itemsData || itemsData.length === 0) {
    await fetchAndParseCSV();
  }

  document.getElementById("user-label").textContent = currentUsername;
  renderCuentasList();
  setupEventHandlers();
});

/*****************************************
 1. FETCH Y PARSE DE CSV
 ******************************************/
async function fetchAndParseCSV() {
  try {
    let resp = await fetch("assets/items.csv");
    if (!resp.ok) {
      console.error("No se pudo cargar items.csv");
      return;
    }
    let csvText = await resp.text();
    parseCSV(csvText);
    saveToLocalStorage();
  } catch (err) {
    console.error("Error al obtener CSV:", err);
  }
}

function parseCSV(csvText) {
  let lines = csvText.trim().split("\n");
  lines.shift(); // quitar encabezado

  itemsData = lines.map(line => {
    let [size, articulo, etiqueta, precio, visible, imagen] = line.split(",");
    return {
      size: parseInt(size.trim()),
      articulo: articulo.trim(),
      etiqueta: etiqueta.trim(),
      precio: parseFloat(precio.trim()),
      visible: (visible.trim() === "1"),
      imagen: imagen.trim()
    };
  });
}

/*****************************************
 2. LOCALSTORAGE
 ******************************************/
function saveToLocalStorage() {
  let data = { currentUsername, itemsData, cuentasData };
  localStorage.setItem("lolindaAppData", JSON.stringify(data));
}

function loadFromLocalStorage() {
  let dataStr = localStorage.getItem("lolindaAppData");
  if (dataStr) {
    try {
      let data = JSON.parse(dataStr);
      currentUsername = data.currentUsername || "Usuario";
      itemsData = data.itemsData || [];
      cuentasData = data.cuentasData || [];
    } catch (e) {
      console.warn("Error parseando localStorage, usando valores por defecto");
    }
  }
}

/*****************************************
 3. LISTA DE CUENTAS EN VENTANA PRINCIPAL
 ******************************************/
function renderCuentasList() {
  let container = document.getElementById("cuentas-list");
  container.innerHTML = "";

  let pagadas = cuentasData.filter(c => c.estado === "Pagada").reverse();
  let pendientes = cuentasData.filter(c => c.estado === "No Pagada").reverse();
  let listToShow = pendientes.concat(pagadas);

  let indexCount = 1;
  listToShow.forEach(cuenta => {
    let row = document.createElement("div");
    row.classList.add("cuenta-item");

    let numeroLabel = document.createElement("div");
    numeroLabel.textContent = indexCount;
    numeroLabel.style.width = "30px";
    numeroLabel.style.textAlign = "center";
    indexCount++;

    let btn = document.createElement("button");
    btn.classList.add("cuenta-btn");
    if (cuenta.estado === "No Pagada") {
      btn.style.backgroundColor = "var(--color-pendiente)";
    } else {
      btn.style.backgroundColor = "var(--color-pagado)";
    }
    btn.addEventListener("click", () => {
      if (cuenta.estado === "No Pagada") {
        abrirPedidoConCuenta(cuenta);
      } else {
        mostrarDetalleConsumo(cuenta);
      }
    });

    let leftDiv = document.createElement("div");
    leftDiv.classList.add("info-left");
    leftDiv.innerHTML = `
      <span>${cuenta.fecha}</span>
      <span>${cuenta.hora}</span>
    `;
    let rightDiv = document.createElement("div");
    rightDiv.classList.add("info-right");
    rightDiv.innerHTML = `
      <span>${cuenta.nombreCuenta}</span>
      <span>$${cuenta.montoTotal.toFixed(2)}</span>
    `;

    btn.appendChild(leftDiv);
    btn.appendChild(rightDiv);

    let btnDelete = document.createElement("button");
    btnDelete.classList.add("cuenta-delete-btn");
    btnDelete.innerHTML = `<img src="assets/icons/sBasura.svg" alt="Borrar"/>`;
    btnDelete.addEventListener("click", (e) => {
      e.stopPropagation();
      if (cuenta.estado === "Pagada") {
        borrarCuenta(cuenta);
      } else {
        abrirModalConfirmDelete(() => {
          borrarCuenta(cuenta);
        }, "¿Estás seguro de borrar una cuenta pendiente?");
      }
    });

    row.appendChild(numeroLabel);
    row.appendChild(btn);
    row.appendChild(btnDelete);
    container.appendChild(row);
  });
}

/*****************************************
 4. ABRIR VENTANA DE PEDIDOS
 ******************************************/
function abrirPedidoNuevo() {
  modoEdicionCuenta = null;
  showModal("modal-pedido");

  let nombrePropuesto = "c_" + (cuentasData.length + 1);
  document.getElementById("pedido-nombre-cuenta").value = nombrePropuesto;

  document.getElementById("ajuste-select").value = "Extra";
  document.getElementById("ajuste-valor").value = 0;

  isAdding = true;
  updateAddRemoveModeUI();

  // Slider de propina => 0
  let pr = document.getElementById("propina-range");
  pr.value = 0;
  actualizarPropinaLabels();

  renderArticlesContainer();
  updatePedidoTotalLabel();
}

function abrirPedidoConCuenta(cuenta) {
  modoEdicionCuenta = cuenta;
  showModal("modal-pedido");

  document.getElementById("pedido-nombre-cuenta").value = cuenta.nombreCuenta;
  document.getElementById("ajuste-select").value = cuenta.ajusteConcepto;
  document.getElementById("ajuste-valor").value = cuenta.ajusteValor;

  isAdding = true;
  updateAddRemoveModeUI();

  let pr = document.getElementById("propina-range");
  pr.value = cuenta.propinaPorcentaje;
  actualizarPropinaLabels();

  renderArticlesContainer(cuenta.listaArticulos);
  updatePedidoTotalLabel();
}

/*****************************************
 5. RENDER ARTÍCULOS
 ******************************************/
function renderArticlesContainer(listaArticulos = []) {
  let contenedor = document.getElementById("articles-container");
  contenedor.innerHTML = "";

  let mapCant = {};
  listaArticulos.forEach(a => {
    mapCant[a.etiqueta] = a.cantidad;
  });

  let grandes = itemsData.filter(i => i.size === 3 && i.visible);
  let medios = itemsData.filter(i => i.size === 2 && i.visible);
  let chicos = itemsData.filter(i => i.size === 1 && i.visible);

  function makeButtons(array, sizeVal) {
    array.forEach(item => {
      let div = document.createElement("div");
      div.classList.add("article-item");
      if (sizeVal === 3) div.classList.add("large");
      if (sizeVal === 2) div.classList.add("medium");

      let img = document.createElement("img");
      img.src = "assets/icons/" + item.imagen;
      img.alt = item.articulo;

      let label = document.createElement("div");
      label.classList.add("article-label");
      label.textContent = item.etiqueta;

      let cDiv = document.createElement("div");
      cDiv.classList.add("article-count");
      let curr = mapCant[item.etiqueta] || 0;
      cDiv.textContent = curr;
      if (curr === 0) cDiv.classList.add("hidden");

      div.addEventListener("click", () => {
        if (isAdding) {
          curr++;
        } else {
          curr--;
          if (curr < 0) curr = 0;
        }
        cDiv.textContent = curr;
        if (curr === 0) {
          cDiv.classList.add("hidden");
        } else {
          cDiv.classList.remove("hidden");
        }
        updatePedidoTotalLabel();
      });

      div.appendChild(img);
      div.appendChild(label);
      div.appendChild(cDiv);
      contenedor.appendChild(div);
    });
  }

  makeButtons(grandes, 3);
  makeButtons(medios, 2);
  makeButtons(chicos, 1);
}

/*****************************************
 6. CÁLCULOS EN VENTANA DE PEDIDOS
 ******************************************/

/**
 * Dada la posición del slider (0..100),
 * retornar el porcentaje real de propina:
 * - 0..60% => map a 0..25 lineal
 * - 61..100% => map a 30..100, en pasos de 5
 */
function getPropinaFromSlider(sliderValue) {
  let val = parseInt(sliderValue);
  if (val <= 60) {
    // Map lineal 0..60 => 0..25
    let ratio = val / 60; // 0..1
    let mapped = ratio * 25; // 0..25
    return Math.round(mapped); // redondeo normal
  } else {
    // 61..100 => map a 30..100 en múltiplos de 5
    let remainder = val - 60; // 0..40
    let fraction = remainder / 40; // 0..1
    let base = 30 + fraction * 70; // 30..100
    // Redondear a múltiplos de 5
    let round5 = 5 * Math.round(base / 5);
    // Clampea a 100 max
    if (round5 > 100) round5 = 100;
    return round5;
  }
}

function updatePedidoTotalLabel() {
  // Reevaluar la propina en base al slider
  let propinaSliderVal = document.getElementById("propina-range").value;
  let realProp = getPropinaFromSlider(propinaSliderVal);

  // Sumar artículos
  let cont = document.getElementById("articles-container");
  let articleDivs = cont.querySelectorAll(".article-item");
  let subtotal = 0;

  articleDivs.forEach(div => {
    let etiqueta = div.querySelector(".article-label").textContent;
    let count = parseInt(div.querySelector(".article-count").textContent) || 0;
    if (count > 0) {
      let itemData = itemsData.find(i => i.etiqueta === etiqueta);
      subtotal += (itemData.precio * count);
    }
  });

  let ajusteVal = parseFloat(document.getElementById("ajuste-valor").value) || 0;
  subtotal += ajusteVal;

  let propinaMonto = (subtotal * realProp) / 100;
  let total = subtotal + propinaMonto;

  // Mostrar
  document.getElementById("total-label").textContent = `$${total.toFixed(2)}`;

  // Habilitar/deshabilitar botones "Pendiente" y "Pagado"
  let btnPend = document.getElementById("pedido-pendiente-btn");
  let btnPag = document.getElementById("pedido-pagado-btn");
  if (total > 0) {
    btnPend.disabled = false;
    btnPag.disabled = false;
  } else {
    btnPend.disabled = true;
    btnPag.disabled = true;
  }
}

function actualizarPropinaLabels() {
  let sliderVal = document.getElementById("propina-range").value;
  let realProp = getPropinaFromSlider(sliderVal);

  // Label de propina
  document.getElementById("propina-porcentaje-label").textContent = `Propina: ${realProp}%`;

  // Reevaluar subtotal
  let cont = document.getElementById("articles-container");
  let articleDivs = cont.querySelectorAll(".article-item");
  let subtotal = 0;
  articleDivs.forEach(div => {
    let etiqueta = div.querySelector(".article-label").textContent;
    let count = parseInt(div.querySelector(".article-count").textContent) || 0;
    if (count > 0) {
      let itemData = itemsData.find(i => i.etiqueta === etiqueta);
      subtotal += (itemData.precio * count);
    }
  });
  let ajusteVal = parseFloat(document.getElementById("ajuste-valor").value) || 0;
  subtotal += ajusteVal;

  let propinaMonto = (subtotal * realProp) / 100;
  document.getElementById("propina-monto-label").textContent = `$${propinaMonto.toFixed(2)}`;
}

/*****************************************
 7. GUARDAR / BORRAR CUENTAS
 ******************************************/
function guardarCuenta(estado) {
  let cuenta = gatherPedidoData(estado);

  if (modoEdicionCuenta) {
    let idx = cuentasData.indexOf(modoEdicionCuenta);
    if (idx >= 0) {
      cuentasData[idx] = cuenta;
    }
  } else {
    cuentasData.push(cuenta);
  }

  saveToLocalStorage();
  renderCuentasList();
  hideModal("modal-pedido");
  modoEdicionCuenta = null;
}

function gatherPedidoData(estado) {
  let nombreCuenta = document.getElementById("pedido-nombre-cuenta").value.trim() || 
                     "c_" + (cuentasData.length + 1);

  let ajusteConcepto = document.getElementById("ajuste-select").value;
  let ajusteValor = parseFloat(document.getElementById("ajuste-valor").value) || 0;

  let sliderVal = document.getElementById("propina-range").value;
  let propinaPorcentaje = getPropinaFromSlider(sliderVal);

  // Recoger artículos
  let cont = document.getElementById("articles-container");
  let articleDivs = cont.querySelectorAll(".article-item");
  let listaArticulos = [];
  articleDivs.forEach(div => {
    let etiqueta = div.querySelector(".article-label").textContent;
    let count = parseInt(div.querySelector(".article-count").textContent) || 0;
    if (count > 0) {
      let dataItem = itemsData.find(i => i.etiqueta === etiqueta);
      listaArticulos.push({
        etiqueta: dataItem.etiqueta,
        articulo: dataItem.articulo,
        precio: dataItem.precio,
        cantidad: count
      });
    }
  });

  // Subtotal
  let subtotal = 0;
  listaArticulos.forEach(a => {
    subtotal += a.precio * a.cantidad;
  });
  subtotal += ajusteValor;

  let propinaMonto = (subtotal * propinaPorcentaje) / 100;
  let montoTotal = subtotal + propinaMonto;

  let pagoCliente = montoTotal;
  let cambioCliente = 0;

  let fechaCreacion = modoEdicionCuenta ? modoEdicionCuenta.fecha : formatearFecha();
  let horaCreacion = modoEdicionCuenta ? modoEdicionCuenta.hora : formatearHora();

  // Si ya existía la cuenta, conservamos su pago/cambio
  if (modoEdicionCuenta) {
    pagoCliente = modoEdicionCuenta.pagoCliente;
    cambioCliente = modoEdicionCuenta.cambioCliente;
  }

  return {
    fecha: fechaCreacion,
    hora: horaCreacion,
    nombreCuenta,
    usuario: currentUsername,
    listaArticulos,
    ajusteConcepto,
    ajusteValor,
    propinaPorcentaje,
    propinaMonto,
    montoTotal,
    pagoCliente,
    cambioCliente,
    estado
  };
}

function borrarCuenta(cuenta) {
  let idx = cuentasData.indexOf(cuenta);
  if (idx >= 0) {
    cuentasData.splice(idx, 1);
    saveToLocalStorage();
    renderCuentasList();
  }
}

/*****************************************
 8. DETALLE DE CONSUMO (HTML)
 ******************************************/
function mostrarDetalleConsumo(cuenta) {
  showModal("modal-detalle-consumo");

  // Datos generales
  let infoDiv = document.getElementById("detalle-info");
  infoDiv.innerHTML = `
    <div>Cuenta: ${cuenta.nombreCuenta}</div>
    <div>Atendió: ${cuenta.usuario}</div>
    <div>Estado: ${cuenta.estado}</div>
    <div>Fecha: ${cuenta.fecha}</div>
    <div>Hora: ${cuenta.hora}</div>
  `;

  let tbody = document.querySelector("#detalle-tabla tbody");
  tbody.innerHTML = "";
  let subtotal = 0;
  cuenta.listaArticulos.forEach((item, i) => {
    let row = document.createElement("tr");
    let n = i + 1;
    let itemTotal = item.precio * item.cantidad;
    subtotal += itemTotal;

    row.innerHTML = `
      <td>${n}</td>
      <td>${item.articulo}</td>
      <td>$${item.precio.toFixed(2)}</td>
      <td>${item.cantidad}</td>
      <td>$${itemTotal.toFixed(2)}</td>
    `;
    tbody.appendChild(row);
  });

  // Sumar ajuste
  subtotal += cuenta.ajusteValor;

  let totalesDiv = document.getElementById("detalle-totales");
  totalesDiv.innerHTML = "";

  // Extra/Descuento si != 0
  if (cuenta.ajusteValor !== 0) {
    let d = document.createElement("div");
    d.textContent = `${cuenta.ajusteConcepto}: $${cuenta.ajusteValor.toFixed(2)} MXN`;
    totalesDiv.appendChild(d);
  }

  // Subtotal (artículos + ajuste) sin restar propina
  let dSub = document.createElement("div");
  dSub.textContent = `Subtotal: $${(subtotal).toFixed(2)} MXN`;
  totalesDiv.appendChild(dSub);

  // Propina
  if (cuenta.propinaPorcentaje > 0) {
    let dP = document.createElement("div");
    dP.textContent = `Propina ${cuenta.propinaPorcentaje}%: $${cuenta.propinaMonto.toFixed(2)} MXN`;
    totalesDiv.appendChild(dP);
  }

  // Total
  let dT = document.createElement("div");
  dT.classList.add("total-final");
  dT.textContent = `TOTAL: $${cuenta.montoTotal.toFixed(2)} MXN`;
  totalesDiv.appendChild(dT);

  // Pago / Cambio
  if (cuenta.pagoCliente !== cuenta.montoTotal || cuenta.cambioCliente > 0) {
    let dPC = document.createElement("div");
    dPC.textContent = `Pago: $${cuenta.pagoCliente.toFixed(2)} MXN,  Cambio: $${cuenta.cambioCliente.toFixed(2)} MXN`;
    totalesDiv.appendChild(dPC);
  }

  // Enviar WhatsApp
  let btnEnviar = document.getElementById("detalle-enviar-btn");
  btnEnviar.onclick = () => {
    let textToSend = generarTextoWhatsApp(cuenta);
    let url = `https://api.whatsapp.com/send?text=${encodeURIComponent(textToSend)}`;
    window.open(url, "_blank");
  };
}

function generarTextoWhatsApp(cuenta) {
  let lines = [];
  lines.push(`LOLINDA - LISTA DE CONSUMO`);
  lines.push(`Cuenta: ${cuenta.nombreCuenta}`);
  lines.push(`Atendió: ${cuenta.usuario}`);
  lines.push(`Estado: ${cuenta.estado}`);
  lines.push(`Fecha: ${cuenta.fecha}`);
  lines.push(`Hora: ${cuenta.hora}`);
  lines.push("");
  lines.push("Artículos consumidos:");

  let subtotal = 0;
  cuenta.listaArticulos.forEach((item, i) => {
    let n = i + 1;
    let itotal = item.precio * item.cantidad;
    subtotal += itotal;
    lines.push(`${n} | ${item.articulo} | ${item.precio} x ${item.cantidad} = $${itotal.toFixed(2)}`);
  });

  // Ajuste
  subtotal += cuenta.ajusteValor;
  if (cuenta.ajusteValor !== 0) {
    lines.push(`${cuenta.ajusteConcepto}: $${cuenta.ajusteValor.toFixed(2)}`);
  }

  // Subtotal (artículos + ajuste)
  lines.push(`Subtotal: $${subtotal.toFixed(2)}`);

  // Propina
  if (cuenta.propinaPorcentaje > 0) {
    lines.push(`Propina ${cuenta.propinaPorcentaje}%: $${cuenta.propinaMonto.toFixed(2)}`);
  }

  // Total
  lines.push(`TOTAL = $${cuenta.montoTotal.toFixed(2)} MXN`);

  // Pago/Cambio
  if (cuenta.pagoCliente !== cuenta.montoTotal || cuenta.cambioCliente > 0) {
    lines.push(`Pago: $${cuenta.pagoCliente.toFixed(2)} MXN, Cambio: $${cuenta.cambioCliente.toFixed(2)} MXN`);
  }

  return lines.join("\n");
}

/*****************************************
 9. CAMBIO
 ******************************************/
function abrirVentanaCambio() {
  let tLabel = document.getElementById("total-label").textContent;
  let total = parseFloat(tLabel.replace("$","")) || 0;

  document.getElementById("cambio-total").textContent = `TOTAL: $${total.toFixed(2)} MXN`;
  let inpPago = document.getElementById("cambio-pago");
  inpPago.value = total.toFixed(2);

  document.getElementById("cambio-resultado").textContent = "Cambio: $0.00 MXN";
  showModal("modal-cambio");

  inpPago.oninput = () => {
    let pago = parseFloat(inpPago.value) || 0;
    let cambio = pago - total;
    if (cambio < 0) {
      document.getElementById("cambio-resultado").textContent = "Pago insuficiente";
    } else if (cambio === 0) {
      document.getElementById("cambio-resultado").textContent = "Pago exacto, sin cambio";
    } else {
      document.getElementById("cambio-resultado").textContent = `Cambio: $${cambio.toFixed(2)} MXN`;
    }
  };
}

/*****************************************
 10. FECHA/HORA
 ******************************************/
function formatearFecha() {
  let d = new Date();
  let day = d.getDate();
  let month = d.getMonth();
  let year = d.getFullYear();
  let meses = ["Ene","Feb","Mar","Abr","May","Jun",
               "Jul","Ago","Sep","Oct","Nov","Dic"];
  return `${day < 10 ? "0"+day : day} - ${meses[month]} - ${year}`;
}
function formatearHora() {
  let d = new Date();
  let hh = d.getHours();
  let mm = d.getMinutes();
  return `${hh < 10 ? "0"+hh : hh}:${mm < 10 ? "0"+mm : mm}`;
}

/*****************************************
 11. MOSTRAR/OCULTAR MODALES
 ******************************************/
function showModal(id) {
  document.getElementById(id).classList.add("show");
}
function hideModal(id) {
  document.getElementById(id).classList.remove("show");
}

function abrirModalConfirmDelete(onAccept, texto="¿Estás seguro?") {
  showModal("modal-confirm-delete");
  document.getElementById("confirm-delete-text").textContent = texto;

  document.getElementById("confirm-delete-cancel").onclick = () => {
    hideModal("modal-confirm-delete");
  };
  document.getElementById("confirm-delete-accept").onclick = () => {
    hideModal("modal-confirm-delete");
    onAccept();
  };
}

/*****************************************
 12. EDITAR LISTA DE ARTÍCULOS
 ******************************************/
function abrirModalItemsList() {
  let tbody = document.querySelector("#items-table tbody");
  tbody.innerHTML = "";

  itemsData.forEach(item => {
    let tr = document.createElement("tr");

    let tdVis = document.createElement("td");
    let chk = document.createElement("input");
    chk.type = "checkbox";
    chk.checked = item.visible;
    tdVis.appendChild(chk);

    let tdArt = document.createElement("td");
    tdArt.textContent = item.articulo;

    let tdPrecio = document.createElement("td");
    let inp = document.createElement("input");
    inp.type = "number";
    inp.min = "0";
    inp.value = item.precio;
    tdPrecio.appendChild(inp);

    tr.appendChild(tdVis);
    tr.appendChild(tdArt);
    tr.appendChild(tdPrecio);

    tbody.appendChild(tr);

    chk.addEventListener("change", () => {
      item.visible = chk.checked;
    });
    inp.addEventListener("input", () => {
      item.precio = parseFloat(inp.value) || 0;
    });
  });

  showModal("modal-items-list");
}

/*****************************************
 13. EVENT HANDLERS
 ******************************************/
function setupEventHandlers() {
  // Botón usuario
  document.getElementById("btn-user").addEventListener("click", () => {
    showModal("modal-user-config");
    document.getElementById("select-usuario").value = "Otro";
    document.getElementById("custom-username").value = currentUsername;
  });
  // Aceptar/Cancelar user config
  document.getElementById("cancel-user-btn").addEventListener("click", () => {
    hideModal("modal-user-config");
  });
  document.getElementById("accept-user-btn").addEventListener("click", () => {
    let sel = document.getElementById("select-usuario").value;
    let custom = document.getElementById("custom-username").value.trim();
    let regex = /^[a-zA-Z0-9\s]+$/;
    if (sel === "Otro") {
      if (!custom.match(regex) || !custom) {
        alert("Nombre inválido. Usa solo caracteres alfanuméricos o espacios.");
        return;
      }
      currentUsername = custom;
    } else {
      currentUsername = sel;
    }
    document.getElementById("user-label").textContent = currentUsername;
    hideModal("modal-user-config");
    saveToLocalStorage();
  });

  // Botón engrane (config)
  document.getElementById("btn-settings").addEventListener("click", () => {
    showModal("modal-config");
  });
  // Cerrar config
  document.getElementById("btn-close-config").addEventListener("click", () => {
    hideModal("modal-config");
  });

  // Editar artículos
  document.getElementById("btn-edit-items").addEventListener("click", () => {
    hideModal("modal-config");
    abrirModalItemsList();
  });
  document.getElementById("items-cancel-btn").addEventListener("click", () => {
    hideModal("modal-items-list");
  });
  document.getElementById("items-accept-btn").addEventListener("click", () => {
    hideModal("modal-items-list");
    saveToLocalStorage();
  });

  // Borrar pagadas
  document.getElementById("btn-delete-paid").addEventListener("click", () => {
    abrirModalConfirmDelete(() => {
      cuentasData = cuentasData.filter(c => c.estado !== "Pagada");
      saveToLocalStorage();
      renderCuentasList();
      hideModal("modal-config");
    }, "¿Estás seguro de borrar TODAS las cuentas pagadas?");
  });
  // Borrar todas
  document.getElementById("btn-delete-all").addEventListener("click", () => {
    abrirModalConfirmDelete(() => {
      cuentasData = [];
      saveToLocalStorage();
      renderCuentasList();
      hideModal("modal-config");
    }, "¿Estás seguro de borrar TODAS las cuentas?");
  });

  // Reiniciar app
  document.getElementById("btn-restart-app").addEventListener("click", () => {
    abrirModalConfirmDelete(() => {
      localStorage.removeItem("lolindaAppData");
      location.reload();
    }, "¿Estás seguro de REINICIAR la app? Perderás todos los datos.");
  });

  // Botón Agregar Cuenta
  document.getElementById("btn-agregar-cuenta").addEventListener("click", () => {
    abrirPedidoNuevo();
  });

  // Pedido: Cancelar
  document.getElementById("pedido-cancelar-btn").addEventListener("click", () => {
    hideModal("modal-pedido");
    modoEdicionCuenta = null;
  });

  // Pedido: Pendiente
  document.getElementById("pedido-pendiente-btn").addEventListener("click", () => {
    guardarCuenta("No Pagada");
  });
  // Pedido: Pagado
  document.getElementById("pedido-pagado-btn").addEventListener("click", () => {
    guardarCuenta("Pagada");
  });

  // Botón Detalle Consumo
  document.getElementById("btn-detalle-consumo").addEventListener("click", () => {
    let tempCuenta = gatherPedidoData("No Pagada"); 
    mostrarDetalleConsumo(tempCuenta);
  });

  // Botón Calcular Cambio
  document.getElementById("btn-cambio").addEventListener("click", () => {
    abrirVentanaCambio();
  });

  // Cerrar cambio
  document.getElementById("cambio-cerrar-btn").addEventListener("click", () => {
    let tLabel = document.getElementById("total-label").textContent;
    let total = parseFloat(tLabel.replace("$","")) || 0;
    let pago = parseFloat(document.getElementById("cambio-pago").value) || 0;
    let cambio = pago - total;
    if (cambio < 0) {
      cambio = 0;
      pago = total;
    }
    if (modoEdicionCuenta) {
      modoEdicionCuenta.pagoCliente = pago;
      modoEdicionCuenta.cambioCliente = cambio;
    }
    hideModal("modal-cambio");
  });

  // Cerrar detalle consumo
  document.getElementById("detalle-cerrar-btn").addEventListener("click", () => {
    hideModal("modal-detalle-consumo");
  });

  // Ajuste => recalcular
  document.getElementById("ajuste-valor").addEventListener("input", () => {
    actualizarPropinaLabels();
    updatePedidoTotalLabel();
  });
  // Propina => recalcular
  document.getElementById("propina-range").addEventListener("input", () => {
    actualizarPropinaLabels();
    updatePedidoTotalLabel();
  });

  // Switch sumar/restar
  document.getElementById("switch-sumar").addEventListener("click", () => {
    isAdding = true;
    updateAddRemoveModeUI();
  });
  document.getElementById("switch-restar").addEventListener("click", () => {
    isAdding = false;
    updateAddRemoveModeUI();
  });
}

function updateAddRemoveModeUI() {
  let sumBtn = document.getElementById("switch-sumar");
  let resBtn = document.getElementById("switch-restar");
  let articlesContainer = document.getElementById("articles-container");

  if (isAdding) {
    sumBtn.style.backgroundColor = "var(--color-sumar)";
    resBtn.style.backgroundColor = "#eee";
    articlesContainer.classList.remove("remove-mode");
    articlesContainer.classList.add("add-mode");
  } else {
    resBtn.style.backgroundColor = "var(--color-restar)";
    sumBtn.style.backgroundColor = "#eee";
    articlesContainer.classList.remove("add-mode");
    articlesContainer.classList.add("remove-mode");
  }
}
