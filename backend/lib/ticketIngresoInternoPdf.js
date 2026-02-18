import { jsPDF } from "jspdf";

/**
 * Genera el PDF del Ticket de Ingreso Interno según formato requerido por el SAG.
 * Listo para visualización e impresión inmediata.
 * @param {{ recepcion: object, pesajes: Array, empresa?: object, logoBase64?: string }} data
 * @returns {Buffer} PDF en buffer
 */
export function generateTicketIngresoInternoPdf(data) {
  const { recepcion: r, pesajes, empresa, logoBase64 } = data;
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const margin = 14;
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 18;
  const lineHeight = 6;
  const labelW = 50;
  const valueX = margin + labelW + 2;
  const lineAltura = 5;

  // ----- Bloque izquierdo: Logo + Datos de la compañía -----
  const xDatosEmpresa = margin;
  const logoAncho = 22;
  const logoAlto = 22;

  if (logoBase64) {
    try {
      const format = logoBase64.indexOf("image/png") >= 0 ? "PNG" : "JPEG";
      doc.addImage(logoBase64, format, xDatosEmpresa, y - 2, logoAncho, logoAlto);
    } catch (err) {
      console.warn("Error al dibujar logo en PDF ticket ingreso interno:", err);
    }
  }

  const xTextoEmpresa = xDatosEmpresa + logoAncho + 4;
  let yEmpresa = y;

  if (empresa) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30);
    doc.text(empresa.razon_social || "Empresa", xTextoEmpresa, yEmpresa);
    yEmpresa += lineAltura;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(60);
    if (empresa.nombre_fantasia) {
      doc.text(empresa.nombre_fantasia, xTextoEmpresa, yEmpresa);
      yEmpresa += lineAltura;
    }
    doc.text(`RUT: ${empresa.rut || "—"}`, xTextoEmpresa, yEmpresa);
    yEmpresa += lineAltura;
    if (empresa.direccion) {
      doc.text(`Dirección: ${empresa.direccion}`, xTextoEmpresa, yEmpresa);
      yEmpresa += lineAltura;
    }
    if (empresa.telefono) {
      doc.text(`Tel: ${empresa.telefono}`, xTextoEmpresa, yEmpresa);
      yEmpresa += lineAltura;
    }
    if (empresa.email_contacto) {
      doc.text(`Email: ${empresa.email_contacto}`, xTextoEmpresa, yEmpresa);
      yEmpresa += lineAltura;
    }
  } else {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30);
    doc.text(r.empresa_razon_social || "—", xTextoEmpresa, yEmpresa);
    yEmpresa += lineAltura;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(60);
    doc.text(`RUT: ${(r.empresa_rut || "—").toString().trim()}`, xTextoEmpresa, yEmpresa);
    yEmpresa += lineAltura;
    const dir = (r.empresa_direccion || "—").toString().trim();
    if (dir) {
      doc.text(dir, xTextoEmpresa, yEmpresa);
      yEmpresa += lineAltura;
    }
  }

  y = Math.max(y + logoAlto - 2, yEmpresa + 2);

  // ----- Título del documento -----
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  doc.text("TICKET DE INGRESO INTERNO", pageWidth / 2, y, { align: "center" });
  y += lineHeight + 6;

  doc.setDrawColor(200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // ----- Campos principales -----
  const clienteNombre =
    (r.tipo_recepcion === "maquila" ? r.cliente_nombre : r.proveedor_nombre) || "—";
  const clienteRut =
    (r.tipo_recepcion === "maquila" ? r.cliente_rut : r.proveedor_rut) || "—";
  const fechaIngreso = r.fecha_entrada
    ? new Date(r.fecha_entrada).toLocaleDateString("es-CL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      })
    : "—";
  const producto = (r.producto_nombre || "—").toString().trim();
  const servicio =
    (r.tipo_recepcion === "maquila" ? "Maquila" : "Cambio/Compra").toString();

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("CLIENTE", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(clienteNombre, valueX, y);
  y += lineHeight;

  doc.setFont("helvetica", "bold");
  doc.text("RUT", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text((clienteRut || "—").toString(), valueX, y);
  y += lineHeight;

  doc.setFont("helvetica", "bold");
  doc.text("FECHA DE INGRESO", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(fechaIngreso, valueX, y);
  y += lineHeight;

  doc.setFont("helvetica", "bold");
  doc.text("PRODUCTO INGRESADO", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(producto, valueX, y);
  y += lineHeight;

  doc.setFont("helvetica", "bold");
  doc.text("SERVICIO", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(servicio, valueX, y);
  y += lineHeight + 6;

  // ----- Tabla MAQUILA | CAMBIO con PESAJES -----
  const colW = (doc.internal.pageSize.getWidth() - 2 * margin) / 2;
  const headerH = 8;
  const rowH = 7;
  const maxRows = 12;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.rect(margin, y, colW, headerH);
  doc.rect(margin + colW, y, colW, headerH);
  doc.text("MAQUILA", margin + colW / 2, y + 5.5, { align: "center" });
  doc.text("CAMBIO", margin + colW + colW / 2, y + 5.5, { align: "center" });
  y += headerH;

  const subHeaderH = 6;
  doc.rect(margin, y, colW, subHeaderH);
  doc.rect(margin + colW, y, colW, subHeaderH);
  doc.setFont("helvetica", "normal");
  doc.text("PESAJES", margin + colW / 2, y + 4, { align: "center" });
  doc.text("PESAJES", margin + colW + colW / 2, y + 4, { align: "center" });
  y += subHeaderH;

  const esMaquila = (r.tipo_recepcion || "").toLowerCase() === "maquila";
  const pesajesMaquila = esMaquila ? pesajes : [];
  const pesajesCambio = !esMaquila ? pesajes : [];

  for (let i = 0; i < maxRows; i++) {
    doc.rect(margin, y, colW, rowH);
    doc.rect(margin + colW, y, colW, rowH);
    const pM = pesajesMaquila[i];
    const pC = pesajesCambio[i];
    if (pM)
      doc.text(
        `${(pM.tipo || "").substring(0, 5)}: ${Number(pM.peso_kg) || 0} kg`,
        margin + 3,
        y + 4.5
      );
    if (pC)
      doc.text(
        `${(pC.tipo || "").substring(0, 5)}: ${Number(pC.peso_kg) || 0} kg`,
        margin + colW + 3,
        y + 4.5
      );
    y += rowH;
  }
  y += 6;

  // ----- TOTAL -----
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL", margin, y);
  doc.setFont("helvetica", "normal");
  const total = Number(r.peso_neto_fisico_kg) || 0;
  doc.text(`${total} kg`, valueX, y);
  y += lineHeight + 10;

  // ----- Firmas -----
  const firmaW = 70;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.line(margin, y, margin + firmaW, y);
  doc.text("FIRMA CLIENTE", margin, y + 5);
  doc.line(margin + colW, y, margin + colW + firmaW, y);
  doc.text("FIRMA RECEPCIONISTA VB", margin + colW, y + 5);
  y += 14;

  // ----- Declaración de conformidad -----
  doc.setFontSize(8);
  const razonDecl =
    (empresa && empresa.razon_social) || r.empresa_razon_social || "";
  const decl =
    "DECLARO ESTAR CONFORME CON EL PROCESO Y SERVICIO ENTREGADO POR " +
    razonDecl.toUpperCase().trim();
  doc.text(decl, pageWidth / 2, y, { align: "center" });

  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}
