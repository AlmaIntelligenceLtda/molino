import { sql } from "../db/connection.js";

async function runMigration() {
  console.log("🔄 Iniciando migración completa de la base de datos...");

  try {
    // ----------------------------------------------------------------------
    // 1. EXTENSIONES
    // ----------------------------------------------------------------------
    await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;

    // ----------------------------------------------------------------------
    // 2. MÓDULO SAAS (TENANTS)
    // ----------------------------------------------------------------------
    console.log("📦 Creando tablas SaaS...");
    
    await sql`
      CREATE TABLE IF NOT EXISTS planes (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(50) NOT NULL,
        precio_mensual DECIMAL(10,2) NOT NULL,
        max_usuarios INTEGER,
        max_sucursales INTEGER,
        features JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS empresas (
        id SERIAL PRIMARY KEY,
        rut VARCHAR(20) UNIQUE NOT NULL,
        razon_social VARCHAR(255) NOT NULL,
        nombre_fantasia VARCHAR(255),
        direccion TEXT,
        telefono VARCHAR(50),
        email_contacto VARCHAR(100),
        plan_id INTEGER REFERENCES planes(id),
        estado VARCHAR(20) DEFAULT 'activo',
        configuracion_global JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await sql`ALTER TABLE empresas ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500)`;

    await sql`
      CREATE TABLE IF NOT EXISTS sucursales (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER REFERENCES empresas(id) ON DELETE CASCADE,
        nombre VARCHAR(100) NOT NULL,
        direccion VARCHAR(255),
        ciudad VARCHAR(100),
        telefono VARCHAR(50),
        es_matriz BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER REFERENCES empresas(id) ON DELETE CASCADE,
        sucursal_id INTEGER REFERENCES sucursales(id),
        nombres VARCHAR(100) NOT NULL,
        apellidos VARCHAR(100),
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        rol VARCHAR(50) NOT NULL,
        estado VARCHAR(20) DEFAULT 'activo',
        ultimo_acceso TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS rut VARCHAR(20)`;

    // ----------------------------------------------------------------------
    // 3. MÓDULO RECEPCIÓN Y LABORATORIO (MATERIA PRIMA)
    // ----------------------------------------------------------------------
    console.log("🌾 Creando tablas de Recepción y Laboratorio...");

    await sql`
      CREATE TABLE IF NOT EXISTS proveedores (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER REFERENCES empresas(id) ON DELETE CASCADE,
        rut VARCHAR(20) NOT NULL,
        razon_social VARCHAR(255) NOT NULL,
        alias VARCHAR(100),
        direccion TEXT,
        comuna VARCHAR(100),
        telefono VARCHAR(50),
        email VARCHAR(100),
        banco VARCHAR(50),
        tipo_cuenta VARCHAR(50),
        numero_cuenta VARCHAR(50),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS choferes (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER REFERENCES empresas(id) ON DELETE CASCADE,
        codigo_chofer VARCHAR(50),
        nombre VARCHAR(100) NOT NULL,
        rut VARCHAR(20) NOT NULL,
        telefono VARCHAR(50),
        email VARCHAR(100),
        activo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`ALTER TABLE choferes ADD COLUMN IF NOT EXISTS codigo_chofer VARCHAR(50)`;
    await sql`ALTER TABLE choferes ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT TRUE`;

    await sql`CREATE UNIQUE INDEX IF NOT EXISTS ux_choferes_empresa_codigo ON choferes (empresa_id, codigo_chofer) WHERE codigo_chofer IS NOT NULL`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS ux_choferes_empresa_rut ON choferes (empresa_id, rut)`;

    await sql`
      CREATE TABLE IF NOT EXISTS productos_agricolas (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER REFERENCES empresas(id) ON DELETE CASCADE,
        nombre VARCHAR(100) NOT NULL,
        codigo VARCHAR(20),
        descripcion TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS carros (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER REFERENCES empresas(id) ON DELETE CASCADE,
        codigo_carro VARCHAR(50),
        patente VARCHAR(20) NOT NULL,
        marca VARCHAR(50),
        modelo VARCHAR(50),
        capacidad_carga_kg INTEGER,
        activo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`ALTER TABLE carros ADD COLUMN IF NOT EXISTS codigo_carro VARCHAR(50)`;
    await sql`ALTER TABLE carros ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT TRUE`;

    await sql`CREATE UNIQUE INDEX IF NOT EXISTS ux_carros_empresa_codigo ON carros (empresa_id, codigo_carro) WHERE codigo_carro IS NOT NULL`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS ux_carros_empresa_patente ON carros (empresa_id, patente)`;

    await sql`
      CREATE TABLE IF NOT EXISTS parametros_proceso (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER REFERENCES empresas(id) ON DELETE CASCADE,
        nombre VARCHAR(100) NOT NULL,
        tipo VARCHAR(20) NOT NULL,
        valor_decimal DECIMAL(12,4) NOT NULL,
        unidad VARCHAR(20),
        descripcion TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS recepciones (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER REFERENCES empresas(id) ON DELETE CASCADE,
        sucursal_id INTEGER REFERENCES sucursales(id),
        proveedor_id INTEGER REFERENCES proveedores(id),
        cliente_id INTEGER,
        producto_agricola_id INTEGER REFERENCES productos_agricolas(id),
        chofer_id INTEGER REFERENCES choferes(id),
        camion_id INTEGER,
        carro_id INTEGER REFERENCES carros(id),

        tipo_recepcion VARCHAR(20) DEFAULT 'compra',
        ticket_codigo VARCHAR(50),
        ticket_token VARCHAR(80),
        producto_harina_id INTEGER,
        
        numero_guia_despacho VARCHAR(50),
        patente_camion VARCHAR(20),
        patente_carro VARCHAR(20),
        chofer_nombre VARCHAR(100),
        chofer_rut VARCHAR(20),
        
        folio_romana VARCHAR(50),
        peso_bruto_kg INTEGER DEFAULT 0,
        peso_tara_kg INTEGER DEFAULT 0,
        peso_neto_fisico_kg INTEGER GENERATED ALWAYS AS (peso_bruto_kg - peso_tara_kg) STORED,
        
        descuento_humedad_kg INTEGER DEFAULT 0,
        descuento_impurezas_kg INTEGER DEFAULT 0,
        peso_neto_pagar_kg INTEGER DEFAULT 0,
        precio_pactado INTEGER DEFAULT 0,

        rendimiento_harina_pct DECIMAL(5,2),
        harina_equivalente_kg DECIMAL(12,2),

        fecha_entrada TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        fecha_salida TIMESTAMP WITH TIME ZONE,
        usuario_operador_id INTEGER REFERENCES usuarios(id),
        estado VARCHAR(20) DEFAULT 'en_proceso',
        observaciones TEXT
      );
    `;

    await sql`ALTER TABLE recepciones ADD COLUMN IF NOT EXISTS cliente_id INTEGER`;
    await sql`ALTER TABLE recepciones ADD COLUMN IF NOT EXISTS chofer_id INTEGER`;
    await sql`ALTER TABLE recepciones ADD COLUMN IF NOT EXISTS camion_id INTEGER`;
    await sql`ALTER TABLE recepciones ADD COLUMN IF NOT EXISTS carro_id INTEGER`;
    await sql`ALTER TABLE recepciones ADD COLUMN IF NOT EXISTS tipo_recepcion VARCHAR(20) DEFAULT 'compra'`;
    await sql`ALTER TABLE recepciones ADD COLUMN IF NOT EXISTS ticket_codigo VARCHAR(50)`;
    await sql`ALTER TABLE recepciones ADD COLUMN IF NOT EXISTS ticket_token VARCHAR(80)`;
    await sql`ALTER TABLE recepciones ADD COLUMN IF NOT EXISTS producto_harina_id INTEGER`;
    await sql`ALTER TABLE recepciones ADD COLUMN IF NOT EXISTS rendimiento_harina_pct DECIMAL(5,2)`;
    await sql`ALTER TABLE recepciones ADD COLUMN IF NOT EXISTS harina_equivalente_kg DECIMAL(12,2)`;

    await sql`CREATE UNIQUE INDEX IF NOT EXISTS ux_recepciones_empresa_ticket_codigo ON recepciones (empresa_id, ticket_codigo) WHERE ticket_codigo IS NOT NULL`;

    await sql`
      CREATE TABLE IF NOT EXISTS pesajes (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER REFERENCES empresas(id) ON DELETE CASCADE,
        recepcion_id INTEGER REFERENCES recepciones(id) ON DELETE CASCADE,
        tipo VARCHAR(10) NOT NULL,
        peso_kg INTEGER NOT NULL,
        origen VARCHAR(20) DEFAULT 'MANUAL',
        motivo TEXT,
        raw_payload TEXT,
        ticket_pesaje_id INTEGER,
        usuario_id INTEGER REFERENCES usuarios(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS tickets_pesaje (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER REFERENCES empresas(id) ON DELETE CASCADE,
        recepcion_id INTEGER REFERENCES recepciones(id) ON DELETE CASCADE,
        ticket_pesaje_codigo VARCHAR(60) UNIQUE,
        ticket_pesaje_token VARCHAR(80),
        usuario_id INTEGER REFERENCES usuarios(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS laboratorio (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER REFERENCES empresas(id) ON DELETE CASCADE,
        recepcion_id INTEGER REFERENCES recepciones(id) ON DELETE CASCADE UNIQUE,
        
        humedad_porcentaje DECIMAL(5,2),
        impurezas_porcentaje DECIMAL(5,2),
        peso_hectolitrico DECIMAL(5,2),
        proteina_porcentaje DECIMAL(5,2),
        gluten_wet DECIMAL(5,2),
        indice_caida INTEGER,
        granos_chuzos DECIMAL(5,2),
        punta_negra DECIMAL(5,2),
        
        aprobado_calidad BOOLEAN DEFAULT TRUE,
        usuario_analista_id INTEGER REFERENCES usuarios(id),
        fecha_analisis TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        observaciones TEXT
      );
    `;

    // ----------------------------------------------------------------------
    // 4. MÓDULO ALMACENAMIENTO E INVENTARIO (SILOS & LOTES)
    // ----------------------------------------------------------------------
    console.log("🏭 Creando tablas de Almacenamiento (WMS)...");

    await sql`
      CREATE TABLE IF NOT EXISTS bodegas (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER REFERENCES empresas(id) ON DELETE CASCADE,
        sucursal_id INTEGER REFERENCES sucursales(id),
        nombre VARCHAR(100) NOT NULL,
        descripcion TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS silos (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER REFERENCES empresas(id) ON DELETE CASCADE,
        bodega_id INTEGER REFERENCES bodegas(id),
        codigo VARCHAR(50) NOT NULL,
        descripcion VARCHAR(100),
        capacidad_max_kg INTEGER NOT NULL,
        nivel_actual_kg INTEGER DEFAULT 0,
        estado VARCHAR(20) DEFAULT 'operativo',
        producto_actual_id INTEGER REFERENCES productos_agricolas(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS lotes (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER REFERENCES empresas(id) ON DELETE CASCADE,
        codigo_lote VARCHAR(50) NOT NULL,
        recepcion_id INTEGER REFERENCES recepciones(id),
        fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        
        cantidad_inicial_kg INTEGER,
        cantidad_actual_kg INTEGER,
        estado VARCHAR(20) DEFAULT 'activo'
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS movimientos_inventario (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER REFERENCES empresas(id) ON DELETE CASCADE,
        sucursal_id INTEGER REFERENCES sucursales(id),
        
        tipo_movimiento VARCHAR(30) NOT NULL,
        
        silo_origen_id INTEGER REFERENCES silos(id),
        silo_destino_id INTEGER REFERENCES silos(id),
        lote_id INTEGER REFERENCES lotes(id),
        
        cantidad_kg INTEGER NOT NULL,
        fecha TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        usuario_id INTEGER REFERENCES usuarios(id),
        observacion TEXT
      );
    `;

    // ----------------------------------------------------------------------
    // 5. MÓDULO PRODUCCIÓN
    // ----------------------------------------------------------------------
    console.log("⚙️ Creando tablas de Producción...");

    await sql`
      CREATE TABLE IF NOT EXISTS productos_terminados (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER REFERENCES empresas(id) ON DELETE CASCADE,
        nombre VARCHAR(100) NOT NULL,
        codigo_sku VARCHAR(50),
        tipo VARCHAR(50),
        unidad_medida VARCHAR(20) DEFAULT 'kg',
        peso_unitario_kg DECIMAL(10,2),
        precio_base DECIMAL(12,2) DEFAULT 0,
        stock_minimo INTEGER DEFAULT 0,
        stock_actual INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS formulas (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER REFERENCES empresas(id) ON DELETE CASCADE,
        producto_terminado_id INTEGER REFERENCES productos_terminados(id),
        nombre VARCHAR(100),
        descripcion TEXT,
        activa BOOLEAN DEFAULT TRUE
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS ordenes_produccion (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER REFERENCES empresas(id) ON DELETE CASCADE,
        sucursal_id INTEGER REFERENCES sucursales(id),
        
        numero_op VARCHAR(50) NOT NULL,
        producto_objetivo_id INTEGER REFERENCES productos_terminados(id),
        formula_id INTEGER REFERENCES formulas(id),
        
        cantidad_objetivo INTEGER,
        fecha_planificada TIMESTAMP WITH TIME ZONE,
        fecha_inicio_real TIMESTAMP WITH TIME ZONE,
        fecha_fin_real TIMESTAMP WITH TIME ZONE,
        
        estado VARCHAR(20) DEFAULT 'planificada',
        usuario_responsable_id INTEGER REFERENCES usuarios(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS rendimientos (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER REFERENCES empresas(id) ON DELETE CASCADE,
        orden_produccion_id INTEGER REFERENCES ordenes_produccion(id) ON DELETE CASCADE,
        
        fecha_registro TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        turno VARCHAR(20),
        
        trigo_molido_kg INTEGER DEFAULT 0,
        
        harina_total_kg INTEGER DEFAULT 0,
        afrecho_kg INTEGER DEFAULT 0,
        semita_kg INTEGER DEFAULT 0,
        otros_subproductos_kg INTEGER DEFAULT 0,
        
        merma_kg INTEGER GENERATED ALWAYS AS (trigo_molido_kg - (harina_total_kg + afrecho_kg + semita_kg + otros_subproductos_kg)) STORED,
        porcentaje_extraccion DECIMAL(5,2),
        
        usuario_registro_id INTEGER REFERENCES usuarios(id),
        observaciones TEXT
      );
    `;

    // ----------------------------------------------------------------------
    // 6. MÓDULO COMERCIAL Y VENTAS
    // ----------------------------------------------------------------------
    console.log("💰 Creando tablas Comerciales y Ventas...");

    await sql`
      CREATE TABLE IF NOT EXISTS clientes (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER REFERENCES empresas(id) ON DELETE CASCADE,
        rut VARCHAR(20) NOT NULL,
        razon_social VARCHAR(255) NOT NULL,
        nombre_fantasia VARCHAR(255),
        direccion_facturacion TEXT,
        direccion_despacho TEXT,
        comuna VARCHAR(100),
        ciudad VARCHAR(100),
        telefono VARCHAR(50),
        email_facturacion VARCHAR(100),
        
        limite_credito INTEGER DEFAULT 0,
        saldo_deuda_actual INTEGER DEFAULT 0,
        dias_credito INTEGER DEFAULT 30,
        bloqueado BOOLEAN DEFAULT FALSE,
        
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS listas_precios (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER REFERENCES empresas(id) ON DELETE CASCADE,
        nombre VARCHAR(100) NOT NULL,
        activa BOOLEAN DEFAULT TRUE
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS precios_listas (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER REFERENCES empresas(id) ON DELETE CASCADE,
        lista_precio_id INTEGER REFERENCES listas_precios(id) ON DELETE CASCADE,
        producto_id INTEGER REFERENCES productos_terminados(id) ON DELETE CASCADE,
        precio DECIMAL(12,2) NOT NULL,
        UNIQUE(lista_precio_id, producto_id)
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS ventas (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER REFERENCES empresas(id) ON DELETE CASCADE,
        sucursal_id INTEGER REFERENCES sucursales(id),
        cliente_id INTEGER REFERENCES clientes(id),
        
        tipo_documento VARCHAR(20) DEFAULT 'factura',
        folio_documento INTEGER,
        
        fecha_emision TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        fecha_vencimiento TIMESTAMP WITH TIME ZONE,
        
        neto INTEGER DEFAULT 0,
        iva INTEGER DEFAULT 0,
        total INTEGER DEFAULT 0,
        
        estado_pago VARCHAR(20) DEFAULT 'pendiente',
        estado_entrega VARCHAR(20) DEFAULT 'pendiente',
        
        usuario_vendedor_id INTEGER REFERENCES usuarios(id),
        observaciones TEXT
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS detalle_ventas (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER REFERENCES empresas(id) ON DELETE CASCADE,
        venta_id INTEGER REFERENCES ventas(id) ON DELETE CASCADE,
        producto_id INTEGER REFERENCES productos_terminados(id),
        
        cantidad INTEGER NOT NULL,
        precio_unitario INTEGER NOT NULL,
        porcentaje_descuento DECIMAL(5,2) DEFAULT 0,
        total_linea INTEGER GENERATED ALWAYS AS ((cantidad * precio_unitario) * (1 - porcentaje_descuento/100)) STORED
      );
    `;

    // ----------------------------------------------------------------------
    // 6.1 MAQUILA (CUENTA CORRIENTE DE HARINA)
    // ----------------------------------------------------------------------
    await sql`
      CREATE TABLE IF NOT EXISTS maquila_movimientos (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER REFERENCES empresas(id) ON DELETE CASCADE,
        sucursal_id INTEGER REFERENCES sucursales(id),
        bodega_id INTEGER REFERENCES bodegas(id),
        cliente_id INTEGER REFERENCES clientes(id),
        producto_harina_id INTEGER REFERENCES productos_terminados(id),
        recepcion_id INTEGER REFERENCES recepciones(id),

        tipo_movimiento VARCHAR(40) NOT NULL,
        kg DECIMAL(12,2) NOT NULL,
        sacos_cantidad INTEGER,
        saco_peso_kg DECIMAL(10,2),

        observacion TEXT,
        usuario_id INTEGER REFERENCES usuarios(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS maquila_tipos_trabajo (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER REFERENCES empresas(id) ON DELETE CASCADE,
        nombre VARCHAR(80) NOT NULL,
        porcentaje DECIMAL(5,2) NOT NULL,
        producto_harina_id INTEGER REFERENCES productos_terminados(id),
        activo BOOLEAN DEFAULT TRUE,
        orden INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // ----------------------------------------------------------------------
    // 7. MÓDULO LOGÍSTICA
    // ----------------------------------------------------------------------
    console.log("🚚 Creando tablas de Logística...");

    await sql`
      CREATE TABLE IF NOT EXISTS camiones (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER REFERENCES empresas(id) ON DELETE CASCADE,
        codigo_camion VARCHAR(50),
        patente VARCHAR(20) NOT NULL,
        marca VARCHAR(50),
        modelo VARCHAR(50),
        capacidad_carga_kg INTEGER,
        chofer_default_id INTEGER REFERENCES usuarios(id),
        estado VARCHAR(20) DEFAULT 'disponible',
        activo BOOLEAN DEFAULT TRUE
      );
    `;

    await sql`ALTER TABLE camiones ADD COLUMN IF NOT EXISTS codigo_camion VARCHAR(50)`;
    await sql`ALTER TABLE camiones ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT TRUE`;

    await sql`CREATE UNIQUE INDEX IF NOT EXISTS ux_camiones_empresa_codigo ON camiones (empresa_id, codigo_camion) WHERE codigo_camion IS NOT NULL`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS ux_camiones_empresa_patente ON camiones (empresa_id, patente)`;

    await sql`
      CREATE TABLE IF NOT EXISTS hojas_ruta (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER REFERENCES empresas(id) ON DELETE CASCADE,
        sucursal_origen_id INTEGER REFERENCES sucursales(id),
        
        camion_id INTEGER REFERENCES camiones(id),
        chofer_id INTEGER REFERENCES usuarios(id),
        
        fecha_salida TIMESTAMP WITH TIME ZONE,
        fecha_retorno TIMESTAMP WITH TIME ZONE,
        
        estado VARCHAR(20) DEFAULT 'en_preparacion'
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS entregas_ruta (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER REFERENCES empresas(id) ON DELETE CASCADE,
        hoja_ruta_id INTEGER REFERENCES hojas_ruta(id) ON DELETE CASCADE,
        venta_id INTEGER REFERENCES ventas(id),
        orden_entrega INTEGER,
        estado VARCHAR(20) DEFAULT 'pendiente'
      );
    `;

    // ----------------------------------------------------------------------
    // 8. MÓDULO MANTENIMIENTO
    // ----------------------------------------------------------------------
    console.log("🔧 Creando tablas de Mantenimiento...");

    await sql`
      CREATE TABLE IF NOT EXISTS maquinaria (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER REFERENCES empresas(id) ON DELETE CASCADE,
        sucursal_id INTEGER REFERENCES sucursales(id),
        nombre VARCHAR(100) NOT NULL,
        tipo VARCHAR(50),
        marca VARCHAR(50),
        modelo VARCHAR(50),
        fecha_instalacion DATE,
        horas_funcionamiento_total DECIMAL(10,2) DEFAULT 0,
        estado VARCHAR(20) DEFAULT 'operativo'
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS planes_mantenimiento (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER REFERENCES empresas(id) ON DELETE CASCADE,
        maquinaria_id INTEGER REFERENCES maquinaria(id) ON DELETE CASCADE,
        nombre_tarea VARCHAR(200) NOT NULL,
        frecuencia_horas INTEGER,
        frecuencia_dias INTEGER,
        tipo VARCHAR(20) DEFAULT 'preventivo'
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS registros_mantenimiento (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER REFERENCES empresas(id) ON DELETE CASCADE,
        maquinaria_id INTEGER REFERENCES maquinaria(id),
        plan_mantenimiento_id INTEGER REFERENCES planes_mantenimiento(id),
        
        fecha_realizacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        tipo_realizado VARCHAR(20),
        descripcion_trabajo TEXT,
        costo_repuestos INTEGER DEFAULT 0,
        costo_mano_obra INTEGER DEFAULT 0,
        tecnico_responsable VARCHAR(100),
        
        horas_maquina_al_momento DECIMAL(10,2)
      );
    `;

    // ----------------------------------------------------------------------
    // 9. MÓDULO TESORERÍA Y CAJAS
    // ----------------------------------------------------------------------
    console.log("💵 Creando tablas de Tesorería...");

    await sql`
      CREATE TABLE IF NOT EXISTS cajas (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER REFERENCES empresas(id) ON DELETE CASCADE,
        sucursal_id INTEGER REFERENCES sucursales(id),
        nombre VARCHAR(100) NOT NULL,
        usuario_asignado_id INTEGER REFERENCES usuarios(id),
        abierta BOOLEAN DEFAULT FALSE,
        saldo_efectivo_actual INTEGER DEFAULT 0
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS movimientos_caja (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER REFERENCES empresas(id) ON DELETE CASCADE,
        caja_id INTEGER REFERENCES cajas(id),
        
        tipo VARCHAR(30) NOT NULL,
        monto INTEGER NOT NULL,
        
        documento_referencia VARCHAR(50),
        fecha TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        usuario_id INTEGER REFERENCES usuarios(id),
        observacion TEXT
      );
    `;
    
    console.log("✅ Migración completada exitosamente.");
    console.log("🚀 El esquema de base de datos está listo para operar.");
    
    process.exit(0);

  } catch (error) {
    console.error("❌ Error fatal durante la migración:", error);
    process.exit(1);
  }
}

runMigration();
