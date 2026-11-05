void schedule.ManagePlanesEstados()
{
	// ======================================================================
	// CONFIGURACIÓN — confirmar API names en
	// Setup > Developer Hub > APIs & SDKs > API Names
	// La conexión necesita el scope ZohoCRM.coql.READ (además de modules.ALL y settings.tags.ALL)
	// ======================================================================
	// ---- Módulos ----
	MOD_CUENTAS = "Estados_de_Cuenta";
	MOD_PLANES = "Planificacion_de_Pagos";
	MOD_FACTURAS = "Invoices";
	MOD_COBROS = "Pagos";
	// ---- Estado de Cuenta ----
	CTA_ESTADO = "Estado";
	CTA_BALANCE = "Monto_Total";
	CTA_PROX_VENC = "Pr_ximo_vencimiento";
	// ---- Planificación de Pagos ----
	PLAN_CUENTA = "Estado_de_Cuenta";
	// lookup -> Estado de Cuenta
	PLAN_ESTADO = "Estado";
	PLAN_FECHA_EXP = "Fecha_de_Expiraci_n";
	PLAN_MONTO_COBRADO = "Monto_Cobrado";
	PLAN_MONTO_PLAN = "Monto_del_Plan";
	// ---- Facturas ----
	FAC_CUENTA = "Nombre_Estado_de_Cuenta";
	// lookup -> Estado de Cuenta
	FAC_MONTO = "Grand_Total";
	FAC_ESTADO_DOC = "Estado_del_Documento";
	// ---- Pagos ----
	COB_CUENTA = "Estado_de_Cuenta";
	// lookup -> Estado de Cuenta
	COB_MONTO = "Monto_de_Pago";
	// Monto_Cobrado de cada plan lo mantiene la función que guarda el Pago (no este script)
	// ---- Valores ----
	CUENTAS_EXCLUIDAS = {"Retirado","Cancelado"};
	FACTURA_ANULADA = "Anulada";
	// Estado del Documento que NO suma al total facturado
	ESTADO_CANCELADO = "Cancelado";
	ESTADO_SOBREPAGO = "Sobrepago";
	ESTADO_ACTIVO = "Activo";
	// a este vuelve un "Sobrepago" si luego queda saldo pendiente
	PLAN_VENCIDA = "Vencido";
	// valor que escribe el BLOQUE 4
	PLANES_VENCIDOS = {"Vencido"};
	// valores que cuentan para los tags
	PLAN_PROGRAMADA = "Programado";
	PLAN_CERRADO = "Cerrado";
	PLAN_ESTADOS_INVALIDOS = {"Programada"};
	// TEMPORAL: valores mal escritos por corridas anteriores; se tratan como vacíos para corregirlos
	// ---- Tags ----
	TAG_PENDIENTES = "Pagos pendientes";
	TAG_REVISION = "Revision necesaria";
	TAG_CONTRATO = "Revisar Contrato";
	TAGS_GESTIONADOS = {TAG_PENDIENTES,TAG_REVISION,TAG_CONTRATO};
	// La conexión va escrita como texto en cada invokeurl (connection:"z_crm"): Deluge no acepta una variable ahí
	API_BASE = "https://www.zohoapis.com/crm/v2/";
	// escrituras y tags
	COQL_URL = "https://www.zohoapis.com/crm/v8/coql";
	LOTE = 100;
	// máximo de registros por llamada de escritura (límite de Zoho)
	// ======================================================================
	// NOTA: Deluge corta la función a los 200,000 statements. Por eso las
	// sumas y filtros los hace Zoho (COQL) y aquí solo se recorren totales
	// por cuenta y planes abiertos, no todos los Pagos y Facturas.
	// ======================================================================
	hoy = zoho.currentdate;
	mensajesError = list();
	paginas = leftpad("",50).replaceAll(" ",",").toList();
	errores = 0;
	llamadas = 0;
	cambiosPlanes = list();
	cambiosCuentas = list();
	tagsAgregar = Map();
	tagsQuitar = Map();
	// ======================================================================
	// BLOQUE 1 — Consultas COQL (2,000 filas por llamada)
	// ======================================================================
	consultas = Map();
	consultas.put("cobrado","select " + COB_CUENTA + ", SUM(" + COB_MONTO + ") from " + MOD_COBROS + " where " + COB_CUENTA + " is not null group by " + COB_CUENTA);
	consultas.put("facturado","select " + FAC_CUENTA + ", SUM(" + FAC_MONTO + ") from " + MOD_FACTURAS + " where " + FAC_CUENTA + " is not null and (" + FAC_ESTADO_DOC + " != '" + FACTURA_ANULADA + "' or " + FAC_ESTADO_DOC + " is null) group by " + FAC_CUENTA);
	consultas.put("planes","select " + PLAN_CUENTA + ", " + PLAN_ESTADO + ", " + PLAN_FECHA_EXP + ", " + PLAN_MONTO_COBRADO + ", " + PLAN_MONTO_PLAN + " from " + MOD_PLANES + " where " + PLAN_CUENTA + " is not null and (" + PLAN_ESTADO + " != '" + PLAN_CERRADO + "' or " + PLAN_ESTADO + " is null)");
	resultados = Map();
	for each  nombre in consultas.keys()
	{
		filas = list();
		offset = 0;
		for each  p in paginas
		{
			body = Map();
			body.put("select_query",consultas.get(nombre) + " limit " + offset + ", 2000");
			resp = invokeurl
			[
				url :COQL_URL
				type :POST
				parameters:body.toString()
				headers:{"Content-Type":"application/json"}
				connection:"z_crm"
			];
			llamadas = llamadas + 1;
			if(resp.get("code") != null)
			{
				// error de COQL: no se escribe nada en esta corrida
				mensajesError.add("COQL '" + nombre + "' falló: " + resp);
				break;
			}
			filas.addAll(ifnull(resp.get("data"),list()));
			if(resp.get("info") == null || resp.get("info").get("more_records") != true)
			{
				break;
			}
			offset = offset + 2000;
		}
		resultados.put(nombre,filas);
		info nombre + ": " + filas.size() + " filas";
	}
	if(mensajesError.size() > 0)
	{
		info "ERROR: " + mensajesError.toString(" | ") + " — corrida cancelada, no se guardó nada.";
		return;
	}
	// ---- Totales por cuenta (las filas agrupadas traen el lookup y la suma) ----
	cobradoPorCuenta = Map();
	for each  fila in resultados.get("cobrado")
	{
		cobradoPorCuenta.put(fila.get(COB_CUENTA).get("id").toString(),ifnull(fila.get("SUM(" + COB_MONTO + ")"),0).toDecimal());
	}
	facturadoPorCuenta = Map();
	for each  fila in resultados.get("facturado")
	{
		facturadoPorCuenta.put(fila.get(FAC_CUENTA).get("id").toString(),ifnull(fila.get("SUM(" + FAC_MONTO + ")"),0).toDecimal());
	}
	// ======================================================================
	// BLOQUE 2 — Estados de Cuenta (getRecords: se necesitan los Tags)
	// ======================================================================
	cuentas = list();
	pagina = 0;
	for each  p in paginas
	{
		pagina = pagina + 1;
		lote = zoho.crm.getRecords(MOD_CUENTAS,pagina,200);
		llamadas = llamadas + 1;
		cuentas.addAll(lote);
		if(lote.size() < 200)
		{
			break;
		}
	}
	info MOD_CUENTAS + ": " + cuentas.size() + " registros";
	// Pasada 1: excluidas y saldadas (Cobros >= Facturas)
	excluidas = Map();
	saldadas = Map();
	for each  cuenta in cuentas
	{
		k = cuenta.get("id").toString();
		if(CUENTAS_EXCLUIDAS.contains(ifnull(cuenta.get(CTA_ESTADO),"")))
		{
			excluidas.put(k,true);
			continue;
		}
		facturado = ifnull(facturadoPorCuenta.get(k),0).round(2);
		if(facturado > 0 && ifnull(cobradoPorCuenta.get(k),0).round(2) >= facturado)
		{
			saldadas.put(k,true);
		}
	}
	// ======================================================================
	// BLOQUE 3 — Planificación de Pagos (solo planes abiertos, vía COQL)
	//   0) Cuenta saldada (Cancelado / Sobrepago)  -> Cerrado
	//   1) Monto_Cobrado = Monto_del_Plan          -> Cerrado
	//   2) Estado vacío y hoy <= Fecha Expiración  -> Programada
	//   3) Estado vacío y hoy >  Fecha Expiración  -> Vencido
	//   (si el Estado ya tiene valor, se respeta el del workflow)
	// ======================================================================
	vencidosPorCuenta = Map();
	proximoPorCuenta = Map();
	for each  plan in resultados.get("planes")
	{
		k = plan.get(PLAN_CUENTA).get("id").toString();
		if(excluidas.containKey(k))
		{
			continue;
		}
		estado = ifnull(plan.get(PLAN_ESTADO),"");
		if(PLAN_ESTADOS_INVALIDOS.contains(estado))
		{
			estado = "";
		}
		fechaTxt = plan.get(PLAN_FECHA_EXP);
		nuevo = "";
		montoPlan = ifnull(plan.get(PLAN_MONTO_PLAN),0).toDecimal().round(2);
		if(saldadas.containKey(k) || (montoPlan > 0 && ifnull(plan.get(PLAN_MONTO_COBRADO),0).toDecimal().round(2) == montoPlan))
		{
			nuevo = PLAN_CERRADO;
		}
		else if(estado == "" && fechaTxt != null)
		{
			nuevo = if(hoy <= fechaTxt.toDate("yyyy-MM-dd"),PLAN_PROGRAMADA,PLAN_VENCIDA);
		}
		if(nuevo != "" && nuevo != estado)
		{
			upd = Map();
			upd.put("id",plan.get("id"));
			upd.put(PLAN_ESTADO,nuevo);
			cambiosPlanes.add(upd);
			estado = nuevo;
		}
		// ---- Datos por cuenta: vencidos y próximo vencimiento ----
		if(PLANES_VENCIDOS.contains(estado))
		{
			vencidosPorCuenta.put(k,ifnull(vencidosPorCuenta.get(k),0) + 1);
		}
		else if(estado != PLAN_CERRADO && fechaTxt != null)
		{
			f = fechaTxt.toDate("yyyy-MM-dd");
			if(f >= hoy)
			{
				if(!proximoPorCuenta.containKey(k))
				{
					proximoPorCuenta.put(k,f);
				}
				else if(f < proximoPorCuenta.get(k))
				{
					proximoPorCuenta.put(k,f);
				}
			}
		}
	}
	// ======================================================================
	// BLOQUE 4 — Estados de Cuenta (pasada 2): balance, estado, próximo vencimiento, tags
	// ======================================================================
	procesados = 0;
	canceladas = 0;
	sobrepagos = 0;
	for each  cuenta in cuentas
	{
		idCuenta = cuenta.get("id").toString();
		if(excluidas.containKey(idCuenta))
		{
			continue;
		}
		procesados = procesados + 1;
		estadoCuenta = ifnull(cuenta.get(CTA_ESTADO),"");
		cambiosCuenta = Map();
		// ---- Balance (negativo = saldo a favor del cliente) ----
		balance = (ifnull(facturadoPorCuenta.get(idCuenta),0) - ifnull(cobradoPorCuenta.get(idCuenta),0)).round(2);
		if(ifnull(cuenta.get(CTA_BALANCE),0).toDecimal().round(2) != balance)
		{
			cambiosCuenta.put(CTA_BALANCE,balance);
		}
		// ---- Estado: Cancelado (balance 0) / Sobrepago (balance < 0) / vuelve a Activo ----
		nuevoEstadoCta = estadoCuenta;
		if(saldadas.containKey(idCuenta))
		{
			if(balance == 0)
			{
				nuevoEstadoCta = ESTADO_CANCELADO;
				canceladas = canceladas + 1;
			}
			else
			{
				nuevoEstadoCta = ESTADO_SOBREPAGO;
				sobrepagos = sobrepagos + 1;
			}
		}
		else if(estadoCuenta == ESTADO_SOBREPAGO)
		{
			nuevoEstadoCta = ESTADO_ACTIVO;
		}
		if(nuevoEstadoCta != estadoCuenta)
		{
			cambiosCuenta.put(CTA_ESTADO,nuevoEstadoCta);
		}
		// ---- Próximo vencimiento ----
		actualTxt = ifnull(cuenta.get(CTA_PROX_VENC),"");
		proximoTxt = "";
		if(proximoPorCuenta.containKey(idCuenta))
		{
			proximoTxt = proximoPorCuenta.get(idCuenta).toString("yyyy-MM-dd");
		}
		if(actualTxt != proximoTxt)
		{
			cambiosCuenta.put(CTA_PROX_VENC,if(proximoTxt == "",null,proximoTxt));
		}
		if(cambiosCuenta.size() > 0)
		{
			cambiosCuenta.put("id",idCuenta);
			cambiosCuentas.add(cambiosCuenta);
		}
		// ---- Tag según planes vencidos ----
		vencidos = ifnull(vencidosPorCuenta.get(idCuenta),0);
		nuevoTag = "";
		if(vencidos > 5)
		{
			nuevoTag = TAG_CONTRATO;
		}
		else if(vencidos == 5)
		{
			nuevoTag = TAG_REVISION;
		}
		else if(vencidos >= 2)
		{
			nuevoTag = TAG_PENDIENTES;
		}
		tieneNuevo = false;
		for each  t in ifnull(cuenta.get("Tag"),list())
		{
			nombre = t.get("name");
			if(nombre == nuevoTag)
			{
				tieneNuevo = true;
			}
			else if(TAGS_GESTIONADOS.contains(nombre))
			{
				ids = ifnull(tagsQuitar.get(nombre),list());
				ids.add(idCuenta);
				tagsQuitar.put(nombre,ids);
			}
		}
		if(nuevoTag != "" && !tieneNuevo)
		{
			ids = ifnull(tagsAgregar.get(nuevoTag),list());
			ids.add(idCuenta);
			tagsAgregar.put(nuevoTag,ids);
		}
	}
	// ======================================================================
	// BLOQUE 5 — Guardar todo en lotes de 100 registros por llamada
	// ======================================================================
	envios = Map();
	envios.put(MOD_PLANES,cambiosPlanes);
	envios.put(MOD_CUENTAS,cambiosCuentas);
	for each  mod in envios.keys()
	{
		pendientes = envios.get(mod);
		total = pendientes.size();
		lote = list();
		i = 0;
		for each  rec in pendientes
		{
			lote.add(rec);
			i = i + 1;
			if(lote.size() == LOTE || i == total)
			{
				body = Map();
				body.put("data",lote);
				body.put("trigger",list());
				// sin disparar workflows; usar {"workflow"} para dispararlos
				resp = invokeurl
				[
					url :API_BASE + mod
					type :PUT
					parameters:body.toString()
					headers:{"Content-Type":"application/json"}
					connection:"z_crm"
				];
				llamadas = llamadas + 1;
				for each  d in ifnull(resp.get("data"),list())
				{
					if(d.get("code") != "SUCCESS")
					{
						errores = errores + 1;
						mensajesError.add("Error " + mod + ": " + d);
					}
				}
				lote = list();
			}
		}
		info mod + ": " + total + " registros actualizados";
	}
	// ---- Tags (POST /{modulo}/actions/add_tags|remove_tags?ids=...&tag_names=...) ----
	operaciones = Map();
	operaciones.put("remove_tags",tagsQuitar);
	operaciones.put("add_tags",tagsAgregar);
	for each  op in {"remove_tags","add_tags"}
	{
		porTag = operaciones.get(op);
		for each  tag in porTag.keys()
		{
			ids = porTag.get(tag);
			total = ids.size();
			lote = list();
			i = 0;
			for each  idc in ids
			{
				lote.add(idc);
				i = i + 1;
				if(lote.size() == LOTE || i == total)
				{
					resp = invokeurl
					[
						url :API_BASE + MOD_CUENTAS + "/actions/" + op + "?ids=" + lote.toString(",") + "&tag_names=" + encodeUrl(tag)
						type :POST
						connection:"z_crm"
					];
					llamadas = llamadas + 1;
					for each  d in ifnull(resp.get("data"),list())
					{
						if(d.get("code") != "SUCCESS")
						{
							errores = errores + 1;
							mensajesError.add("Error " + op + " '" + tag + "': " + d);
						}
					}
					lote = list();
				}
			}
			info op + " '" + tag + "': " + total + " estados de cuenta";
		}
	}
	resumen = "Procesados: " + procesados + " | Cancelados: " + canceladas + " | Sobrepago: " + sobrepagos + " | Planes actualizados: " + cambiosPlanes.size() + " | Llamadas API: " + llamadas + " | Errores: " + errores;
	info resumen;
	if(errores > 0)
	{
		info mensajesError.toString(" | ");
	}
}


// ==========================================================================
// FUNCIÓN TEMPORAL APARTE — copiar Estado del Documento -> Status en Facturas.
// Crear como otro Schedule. Cuando ya no se necesite, borrar el Schedule completo.
// ==========================================================================
void schedule.CopiarEstadoFacturas()
{
	MOD_FACTURAS = "Invoices";
	FAC_ESTADO_DOC = "Estado_del_Documento";
	FAC_STATUS = "Status";
	// La conexión va escrita como texto en cada invokeurl (connection:"z_crm"): Deluge no acepta una variable ahí
	paginas = leftpad("",50).replaceAll(" ",",").toList();
	cambios = list();
	pagina = 0;
	for each  p in paginas
	{
		pagina = pagina + 1;
		lote = zoho.crm.getRecords(MOD_FACTURAS,pagina,200);
		for each  fac in lote
		{
			estadoDoc = ifnull(fac.get(FAC_ESTADO_DOC),"");
			if(estadoDoc != ifnull(fac.get(FAC_STATUS),""))
			{
				upd = Map();
				upd.put("id",fac.get("id"));
				upd.put(FAC_STATUS,estadoDoc);
				cambios.add(upd);
			}
		}
		if(lote.size() < 200)
		{
			break;
		}
	}
	total = cambios.size();
	lote = list();
	i = 0;
	errores = 0;
	for each  rec in cambios
	{
		lote.add(rec);
		i = i + 1;
		if(lote.size() == 100 || i == total)
		{
			body = Map();
			body.put("data",lote);
			body.put("trigger",list());
			resp = invokeurl
			[
				url :"https://www.zohoapis.com/crm/v2/" + MOD_FACTURAS
				type :PUT
				parameters:body.toString()
				headers:{"Content-Type":"application/json"}
				connection:"z_crm"
			];
			for each  d in ifnull(resp.get("data"),list())
			{
				if(d.get("code") != "SUCCESS")
				{
					errores = errores + 1;
					info "Error: " + d;
				}
			}
			lote = list();
		}
	}
	info "Facturas actualizadas: " + total + " | Errores: " + errores;
}


// ==========================================================================
// ANTIGÜEDAD DE CARTERA — Schedule diario aparte (después de ManagePlanesEstados).
// Va en su propia función para tener su propio límite de 200,000 statements.
//
// Escribe en cada Factura abierta:
//   Saldo_Pendiente  = Grand_Total - suma de Pagos de esa factura
//   Dias_Vencidos    = días desde la fecha de vencimiento (0 si no ha vencido)
//   Rango_Antiguedad = Al día / 1-30 / 31-60 / 61-90 / +90 / Pagada / Sin fecha
//
// Campos a crear en Facturas antes de correrlo:
//   Saldo Pendiente (Moneda), Días Vencidos (Número),
//   Rango Antigüedad (Lista: Al día, 1-30, 31-60, 61-90, +90, Pagada, Sin fecha — en ese orden)
//
// Las facturas en "Pagada" ya no se vuelven a leer. Si se borra un Pago,
// vaciar el Rango de esa factura para que se recalcule al día siguiente.
// ==========================================================================
void schedule.AntiguedadCartera()
{
	// ---- CONFIGURACIÓN ----
	MOD_FACTURAS = "Invoices";
	MOD_COBROS = "Pagos";
	FAC_VENCE = "Due_Date";
	FAC_MONTO = "Grand_Total";
	FAC_ESTADO_DOC = "Estado_del_Documento";
	FAC_SALDO = "Saldo_Pendiente";
	FAC_DIAS = "Dias_Vencidos";
	FAC_RANGO = "Rango_Antiguedad";
	COB_FACTURA = "Factura";
	// lookup en Pagos -> Factura
	COB_MONTO = "Monto_de_Pago";
	FACTURA_ANULADA = "Anulada";
	R_AL_DIA = "Al día";
	R_30 = "1-30";
	R_60 = "31-60";
	R_90 = "61-90";
	R_MAS = "+90";
	R_PAGADA = "Pagada";
	R_SIN_FECHA = "Sin fecha";
	API_BASE = "https://www.zohoapis.com/crm/v2/";
	COQL_URL = "https://www.zohoapis.com/crm/v8/coql";
	LOTE = 100;
	// ----------------------
	hoy = zoho.currentdate;
	paginas = leftpad("",50).replaceAll(" ",",").toList();
	llamadas = 0;
	errores = 0;
	mensajesError = list();
	// ======================================================================
	// PASO 1 — Total pagado por factura (COQL agrupado, 2,000 filas por llamada)
	// ======================================================================
	pagadoPorFactura = Map();
	offset = 0;
	for each  p in paginas
	{
		body = Map();
		body.put("select_query","select " + COB_FACTURA + ", SUM(" + COB_MONTO + ") from " + MOD_COBROS + " where " + COB_FACTURA + " is not null group by " + COB_FACTURA + " limit " + offset + ", 2000");
		resp = invokeurl
		[
			url :COQL_URL
			type :POST
			parameters:body.toString()
			headers:{"Content-Type":"application/json"}
			connection:"z_crm"
		];
		llamadas = llamadas + 1;
		if(resp.get("code") != null)
		{
			info "ERROR COQL pagos por factura: " + resp + " — corrida cancelada, no se guardó nada.";
			return;
		}
		for each  fila in ifnull(resp.get("data"),list())
		{
			pagadoPorFactura.put(fila.get(COB_FACTURA).get("id").toString(),ifnull(fila.get("SUM(" + COB_MONTO + ")"),0).toDecimal());
		}
		if(resp.get("info") == null || resp.get("info").get("more_records") != true)
		{
			break;
		}
		offset = offset + 2000;
	}
	info "Facturas con pagos: " + pagadoPorFactura.size();
	// ======================================================================
	// PASO 2 — Facturas abiertas, en bloques de 2,000 ordenados por id.
	//   Cada bloque se guarda antes de leer el siguiente: si la corrida se
	//   corta, lo ya guardado queda y la siguiente corrida continúa.
	// ======================================================================
	ultimoId = "0";
	leidas = 0;
	actualizadas = 0;
	for each  p in paginas
	{
		body = Map();
		body.put("select_query","select " + FAC_VENCE + ", " + FAC_MONTO + ", " + FAC_SALDO + ", " + FAC_DIAS + ", " + FAC_RANGO + " from " + MOD_FACTURAS + " where ((" + FAC_RANGO + " != '" + R_PAGADA + "' or " + FAC_RANGO + " is null) and (" + FAC_ESTADO_DOC + " != '" + FACTURA_ANULADA + "' or " + FAC_ESTADO_DOC + " is null)) and id > '" + ultimoId + "' order by id asc limit 2000");
		// COQL: con más de 2 condiciones hay que agruparlas de a dos con paréntesis
		resp = invokeurl
		[
			url :COQL_URL
			type :POST
			parameters:body.toString()
			headers:{"Content-Type":"application/json"}
			connection:"z_crm"
		];
		llamadas = llamadas + 1;
		if(resp.get("code") != null)
		{
			errores = errores + 1;
			mensajesError.add("COQL facturas: " + resp);
			break;
		}
		facturas = ifnull(resp.get("data"),list());
		if(facturas.size() == 0)
		{
			break;
		}
		leidas = leidas + facturas.size();
		// ---- Calcular saldo, días y rango ----
		cambios = list();
		for each  fac in facturas
		{
			idF = fac.get("id").toString();
			saldo = (ifnull(fac.get(FAC_MONTO),0).toDecimal() - ifnull(pagadoPorFactura.get(idF),0)).round(2);
			dias = 0;
			if(saldo <= 0)
			{
				rango = R_PAGADA;
			}
			else if(fac.get(FAC_VENCE) == null)
			{
				rango = R_SIN_FECHA;
			}
			else
			{
				dias = fac.get(FAC_VENCE).toDate("yyyy-MM-dd").daysBetween(hoy);
				if(dias <= 0)
				{
					dias = 0;
					rango = R_AL_DIA;
				}
				else if(dias <= 30)
				{
					rango = R_30;
				}
				else if(dias <= 60)
				{
					rango = R_60;
				}
				else if(dias <= 90)
				{
					rango = R_90;
				}
				else
				{
					rango = R_MAS;
				}
			}
			if(rango != ifnull(fac.get(FAC_RANGO),"") || dias != ifnull(fac.get(FAC_DIAS),0) || saldo != ifnull(fac.get(FAC_SALDO),0).toDecimal().round(2))
			{
				upd = Map();
				upd.put("id",idF);
				upd.put(FAC_SALDO,saldo);
				upd.put(FAC_DIAS,dias);
				upd.put(FAC_RANGO,rango);
				cambios.add(upd);
			}
		}
		ultimoId = facturas.get(facturas.size() - 1).get("id").toString();
		// ---- Guardar este bloque en lotes de 100 ----
		total = cambios.size();
		lote = list();
		i = 0;
		for each  rec in cambios
		{
			lote.add(rec);
			i = i + 1;
			if(lote.size() == LOTE || i == total)
			{
				body = Map();
				body.put("data",lote);
				body.put("trigger",list());
				resp = invokeurl
				[
					url :API_BASE + MOD_FACTURAS
					type :PUT
					parameters:body.toString()
					headers:{"Content-Type":"application/json"}
					connection:"z_crm"
				];
				llamadas = llamadas + 1;
				for each  d in ifnull(resp.get("data"),list())
				{
					if(d.get("code") != "SUCCESS")
					{
						errores = errores + 1;
						mensajesError.add("Error factura: " + d);
					}
				}
				lote = list();
			}
		}
		actualizadas = actualizadas + total;
		if(facturas.size() < 2000)
		{
			break;
		}
	}
	info "Facturas abiertas leídas: " + leidas + " | Actualizadas: " + actualizadas + " | Llamadas API: " + llamadas + " | Errores: " + errores;
	if(errores > 0)
	{
		info mensajesError.toString(" | ");
	}
}


