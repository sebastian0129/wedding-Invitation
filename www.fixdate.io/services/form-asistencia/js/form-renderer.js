/**
 * Form Renderer - Renderizado dinámico del formulario de asistencia flex
 * 
 * Maneja el wizard step-by-step, validación en tiempo real y envío del formulario.
 * 
 * @package FormAsistencia
 * @author Fixdate
 */

(function() {
    'use strict';

    // Namespace global
    window.FormAsistenciaFlex = window.FormAsistenciaFlex || {};

    /**
     * Clase principal del renderizador de formulario
     */
    class FormRenderer {
        
        constructor(options = {}) {
            this.containerId = options.containerId || 'form-asistencia-flex';
            this.config = options.config || null;
            this.idInv = options.idInv || 0;
            this.idGrupo = options.idGrupo || null;
            this.invitados = options.invitados || [];
            this.aceptaAcompanante = options.aceptaAcompanante || false;
            this.maxAcompanantes = options.maxAcompanantes || 0;
            this.esContextoGrupo = this.detectarContextoGrupo();
            // Guardar idioma original y normalizado
            // Normalizar idioma: pt-BR → pt, it-IT → it, etc.
            this.idioma = this.normalizarIdioma(options.idioma || 'es');
            this.submitUrl = options.submitUrl || '';
            this.token = options.token || '';
            this.invitacionEnc = options.invitacionEnc || '';
            this.configVersion = options.configVersion != null ? options.configVersion : null;
            this.demoMode = options.demoMode || false;
            this.onSuccess = options.onSuccess || function() {};
            this.onError = options.onError || function() {};
            // Tras cada render() completo (carga inicial y "confirmar otro invitado")
            this.onRender = typeof options.onRender === 'function' ? options.onRender : null;
            
            // Sistema de textos (2 fuentes, de mayor a menor prioridad):
            // 1. Override por invitación (textos_override en config_json)
            // 2. Textos base hardcodeados (textos-formulario.json)
            this.textosGlobales = options.textosGlobales || {};
            this.textosOverride = (this.config && this.config.textos_override) || {};
            this.eventosInvitacion = options.eventosInvitacion || {};
            
            this.pasoActual = 1;
            this.totalPasos = 1;
            this.respuestas = {};
            this.container = null;
            
            this.init();
        }

        detectarContextoGrupo() {
            const idGrupoNum = parseInt(this.idGrupo, 10);
            if (!isNaN(idGrupoNum) && idGrupoNum > 0) {
                return true;
            }
            return Array.isArray(this.invitados) && this.invitados.length > 0;
        }

        init() {
            this.container = document.getElementById(this.containerId);
            if (!this.container) {
                console.error('FormAsistenciaFlex: Container not found');
                return;
            }

            if (!this.config) {
                console.error('FormAsistenciaFlex: Config not provided');
                return;
            }

            this.calcularTotalPasos();
            this.render();
            this.bindEvents();
        }

        calcularTotalPasos() {
            // Paso 1: Invitado
            // Paso 1.5 (condicional): Nombre del acompañante
            // Paso 2+: Un paso por cada evento habilitado
            // Paso N+: Un paso por cada campo adicional
            let pasos = 1; // Paso 1: Invitado
            
            // Paso condicional para nombre de acompañante
            this.tienePasoAcompanante = this.aceptaAcompanante && this.maxAcompanantes > 0;
            if (this.tienePasoAcompanante) {
                pasos++;
            }
            
            // Contar eventos habilitados (un paso por cada uno)
            this.eventosHabilitados = [];
            const eventos = this.config.eventos || {};
            for (const [codigo, evento] of Object.entries(eventos)) {
                if (evento.habilitado) {
                    this.eventosHabilitados.push(codigo);
                }
            }
            pasos += this.eventosHabilitados.length;
            
            // Cada campo es un paso separado
            if (this.config.campos && this.config.campos.length > 0) {
                pasos += this.config.campos.length;
            }
            
            // Calcular desde qué número empiezan los pasos de campos
            const offsetAcompanante = this.tienePasoAcompanante ? 1 : 0;
            this.primerPasoCampos = 1 + offsetAcompanante + this.eventosHabilitados.length + 1;
            
            this.totalPasos = pasos;
        }

        render() {
            let html = `
                <div class="form-flex-container">
                    <form id="form-flex-form" novalidate>
                        ${this.renderHeader()}
                        ${this.renderProgreso()}
                        <div class="form-flex-pasos">
                            ${this.renderPasos()}
                        </div>
                        ${this.renderNavegacion()}
                    </form>
                </div>
            `;
            
            this.container.innerHTML = html;
            this.mostrarPaso(1);
            this.invocarOnRender();
        }

        /**
         * Llama al callback onRender tras pintar el DOM del formulario (incl. reset).
         */
        invocarOnRender() {
            if (typeof this.onRender !== 'function') {
                return;
            }
            try {
                this.onRender(this);
            } catch (e) {
                console.error('FormAsistenciaFlex: onRender error', e);
            }
        }

        renderHeader() {
            const titulo = this.getOverrideTexto('titulo') || this.getTexto(this.config.textos?.titulo) || this.getMensaje('titulo');
            
            let html = '';
            if (titulo) {
                html += `<h3 class="form-flex-title">${this.escapeHtml(titulo)}</h3>`;
            }
            return html;
        }

        renderProgreso() {
            // Indicador de pasos removido para minimizar elementos en el modal
            return '';
        }

        renderPasos() {
            let html = '';
            let numeroPaso = 1;
            
            // Paso 1: Invitado
            html += `<div class="form-flex-paso" data-paso="${numeroPaso}">
                ${this.renderPasoInvitado()}
            </div>`;
            numeroPaso++;
            
            // Paso condicional: nombre del acompañante (visible solo si eligió "Soy acompañante")
            if (this.tienePasoAcompanante) {
                html += `<div class="form-flex-paso" data-paso="${numeroPaso}" data-tipo="acompanante-nombre">
                    ${this.renderPasoNombreAcompanante()}
                </div>`;
                numeroPaso++;
            }

            // Un paso por cada evento habilitado
            this.eventosHabilitados.forEach((codigo) => {
                html += `<div class="form-flex-paso" data-paso="${numeroPaso}" data-tipo="evento" data-evento-codigo="${codigo}">
                    ${this.renderPasoEventoIndividual(codigo)}
                </div>`;
                numeroPaso++;
            });
            
            // Un paso por cada campo adicional (con atributos de condición si aplica)
            if (this.config.campos && this.config.campos.length > 0) {
                const campos = this.config.campos;
                campos.forEach((campo) => {
                    const condicion = campo.condicion || null;
                    const contextoInvitacion = this.normalizarContextoInvitacion(campo.contexto_invitacion || null);
                    let attrCondicion = '';
                    if (condicion && condicion.tipo) {
                        attrCondicion = ` data-condicion-tipo="${condicion.tipo}" data-condicion-objetivo="${condicion.objetivo}" data-condicion-valor="${condicion.valor}"`;
                    }
                    const attrContexto = ` data-contexto-libre="${contextoInvitacion.libre ? '1' : '0'}" data-contexto-grupo="${contextoInvitacion.grupo ? '1' : '0'}"`;
                    const campoId = campo.id || campo.config?.codigo || '';
                    html += `<div class="form-flex-paso" data-paso="${numeroPaso}" data-campo-id="${campoId}"${attrCondicion}${attrContexto}>
                        ${this.renderCampo(campo)}
                    </div>`;
                    numeroPaso++;
                });
            }
            
            return html;
        }

        renderPasoInvitado() {
            const tieneGrupo = this.invitados && this.invitados.length > 0;
            
            if (tieneGrupo) {
                return this.renderInvitadoConGrupo();
            } else {
                return this.renderInvitadoSinGrupo();
            }
        }

        renderInvitadoConGrupo() {
            const etiqueta = this.getMensaje('quien_confirma');
            
            let html = `<div class="form-flex-campo form-flex-invitado">
                <label class="form-flex-label">${etiqueta} <span class="form-flex-required">*</span></label>
                <div class="form-flex-radio-group form-flex-invitados-grupo">`;
            
            this.invitados.forEach((inv, index) => {
                let id, nombre;
                if (typeof inv === 'string') {
                    id = index + 1;
                    nombre = inv;
                } else {
                    id = inv.id_invitado_grupo || inv.id_invitado || inv.id || (index + 1);
                    nombre = inv.nombre_invitado_grupo || inv.nombre_invitado || inv.nombre || '';
                }
                
                html += `<label class="form-flex-radio-option form-flex-invitado-option">
                    <input type="radio" name="id_invitado_grupo" value="${id}" required>
                    <span class="form-flex-radio-label">${this.escapeHtml(nombre)}</span>
                </label>`;
            });

            if (this.aceptaAcompanante && this.maxAcompanantes > 0) {
                html += `<hr style="border:none;border-top:1px solid rgba(0,0,0,0.08);margin:5px 0;">`;
                html += `<label class="form-flex-radio-option form-flex-invitado-option">
                    <input type="radio" name="id_invitado_grupo" value="__acompanante__" required>
                    <span class="form-flex-radio-label"><i class="fa fa-user-plus" style="margin-right:6px;opacity:0.6;"></i>${this.getMensaje('soy_acompanante')}</span>
                </label>`;
            }
            
            html += `</div>`;

            html += `<div class="form-flex-error" id="error_invitado"></div>
            </div>`;
            
            return html;
        }

        renderInvitadoSinGrupo() {
            const etiqueta = this.getMensaje('tu_nombre');
            const textoAyuda = this.getMensaje('placeholder_nombre');
            
            return `<div class="form-flex-campo form-flex-invitado">
                <label for="nombre_invitado" class="form-flex-label">
                    <i class="fa fa-user"></i> ${etiqueta}
                    <span class="form-flex-required">*</span>
                </label>
                <input type="text" id="nombre_invitado" name="nombre_invitado" 
                    class="form-flex-input"
                    required minlength="2" maxlength="255">
                <small class="form-flex-help-text">${this.escapeHtml(textoAyuda)}</small>
                <div class="form-flex-error" id="error_nombre_invitado"></div>
            </div>`;
        }

        renderPasoNombreAcompanante() {
            const etiqueta = this.getMensaje('tu_nombre');
            const textoAyuda = this.getMensaje('placeholder_nombre');

            return `<div class="form-flex-campo form-flex-invitado">
                <label for="nombre_acompanante" class="form-flex-label">
                    <i class="fa fa-user"></i> ${etiqueta}
                    <span class="form-flex-required">*</span>
                </label>
                <input type="text" id="nombre_acompanante" name="nombre_acompanante" 
                    class="form-flex-input"
                    required minlength="2" maxlength="255">
                <small class="form-flex-help-text">${this.escapeHtml(textoAyuda)}</small>
                <div class="form-flex-error" id="error_nombre_acompanante"></div>
            </div>`;
        }

        renderPasoEventoIndividual(codigo) {
            const evento = this.config.eventos[codigo];
            
            const claveTexto = 'pregunta_' + codigo;
            let pregunta = this.getMensaje(claveTexto);
            
            if (!pregunta || pregunta === claveTexto) {
                let nombreEvento = '';
                if (this.eventosInvitacion && this.eventosInvitacion[codigo]) {
                    nombreEvento = this.eventosInvitacion[codigo];
                } else {
                    nombreEvento = this.getTexto(evento.etiqueta) || this.capitalizar(codigo);
                }
                pregunta = nombreEvento + '?';
            }
            
            let html = `<div class="form-flex-campo form-flex-eventos">
                <label class="form-flex-label">${this.escapeHtml(pregunta)} <span class="form-flex-required">*</span></label>
                <div class="form-flex-eventos-lista">
                    <div class="form-flex-evento" data-evento="${codigo}">
                        <div class="form-flex-evento-opciones">
                            <label class="form-flex-evento-opcion form-flex-evento-si">
                                <input type="radio" name="eventos[${codigo}]" value="si">
                                <span>${this.getMensaje('si_asisto')}</span>
                            </label>
                            <label class="form-flex-evento-opcion form-flex-evento-no">
                                <input type="radio" name="eventos[${codigo}]" value="no">
                                <span>${this.getMensaje('no_asisto')}</span>
                            </label>
                        </div>
                    </div>
                </div>
                <div class="form-flex-error" id="error_evento_${codigo}"></div>
            </div>`;
            
            return html;
        }

        renderCampo(campo) {
            const config = campo.config || campo;
            const tipo = config.tipo || campo.tipo || 'text';
            const id = campo.id || config.codigo || '';
            const etiqueta = this.getTexto(config.etiqueta || campo.etiqueta);
            const textoAyuda = this.getTexto(config.placeholder || campo.placeholder) || '';
            const requerido = campo.requerido || config.requerido || false;
            const opciones = config.opciones || campo.opciones || [];
            const atributos = config.atributos || campo.atributos || {};
            
            const safeId = this.escapeAttr(id);
            const safeTipo = this.escapeAttr(tipo);

            let html = `<div class="form-flex-campo" data-campo="${safeId}" data-tipo="${safeTipo}">
                <label class="form-flex-label">
                    ${this.escapeHtml(etiqueta)}
                    ${requerido ? '<span class="form-flex-required">*</span>' : ''}
                </label>`;
            
            switch (tipo) {
                case 'textarea':
                    html += `<textarea id="campo_${safeId}" name="${safeId}" class="form-flex-textarea" 
                        rows="${parseInt(atributos.rows) || 2}"
                        ${atributos.maxlength ? `maxlength="${parseInt(atributos.maxlength)}"` : ''}
                        ${requerido ? 'required' : ''}></textarea>`;
                    break;
                    
                case 'select':
                    html += `<select id="campo_${safeId}" name="${safeId}" class="form-flex-select" ${requerido ? 'required' : ''}>
                        <option value="" disabled selected hidden>${this.getMensaje('seleccionar')}</option>`;
                    opciones.forEach(op => {
                        html += `<option value="${this.escapeAttr(op.valor)}">${this.escapeHtml(this.getTexto(op.texto))}</option>`;
                    });
                    html += '</select>';
                    break;
                    
                case 'radio':
                    html += '<div class="form-flex-radio-group">';
                    opciones.forEach((op, i) => {
                        html += `<label class="form-flex-radio-option">
                            <input type="radio" name="${safeId}" value="${this.escapeAttr(op.valor)}" ${requerido && i === 0 ? 'required' : ''}>
                            <span class="form-flex-radio-label">${this.escapeHtml(this.getTexto(op.texto))}</span>
                        </label>`;
                    });
                    html += '</div>';
                    break;
                    
                case 'checkbox':
                    html += `<div class="form-flex-checkbox-group" data-campo-id="${safeId}" ${requerido ? 'data-requerido="true"' : ''}>`;
                    opciones.forEach(op => {
                        html += `<label class="form-flex-checkbox-option">
                            <input type="checkbox" name="${safeId}[]" value="${this.escapeAttr(op.valor)}">
                            <span class="form-flex-checkbox-label">${this.escapeHtml(this.getTexto(op.texto))}</span>
                        </label>`;
                    });
                    html += '</div>';
                    break;
                    
                case 'number':
                    const minVal = (atributos.min !== undefined && atributos.min >= 0) ? atributos.min : 0;
                    html += `<input type="number" id="campo_${safeId}" name="${safeId}" 
                        class="form-flex-input form-flex-number"
                        min="${parseInt(minVal)}"
                        ${atributos.max !== undefined ? `max="${parseInt(atributos.max)}"` : ''}
                        ${atributos.step ? `step="${parseFloat(atributos.step)}"` : ''}
                        ${requerido ? 'required' : ''}>`;
                    break;
                    
                default:
                    html += `<input type="${safeTipo}" id="campo_${safeId}" name="${safeId}" 
                        class="form-flex-input"
                        ${atributos.maxlength ? `maxlength="${parseInt(atributos.maxlength)}"` : ''}
                        ${requerido ? 'required' : ''}>`;
            }

            if (textoAyuda) {
                html += `<small class="form-flex-help-text">${this.escapeHtml(textoAyuda)}</small>`;
            }
            
            html += `<div class="form-flex-error" id="error_${safeId}"></div>
            </div>`;
            
            return html;
        }

        renderNavegacion() {
            const confirmarOverride = this.getOverrideTexto('confirmar');
            const textoEnviar = confirmarOverride || this.getTexto(this.config.textos?.botonEnviar) || this.getMensaje('confirmar');
            
            return `<div class="form-flex-navegacion">
                <button type="button" class="form-flex-btn form-flex-btn-anterior" data-accion="anterior" style="display:none;">
                    <span class="form-flex-btn-icon">&#8592;</span> ${this.getMensaje('anterior')}
                </button>
                <div class="form-flex-btn-placeholder"></div>
                <button type="button" class="form-flex-btn form-flex-btn-siguiente" data-accion="siguiente">
                    ${this.getMensaje('siguiente')} <span class="form-flex-btn-icon">&#8594;</span>
                </button>
                <button type="submit" class="form-flex-btn form-flex-btn-enviar" style="display:none;">
                    ${this.escapeHtml(textoEnviar)}
                </button>
            </div>`;
        }

        bindEvents() {
            const form = this.container.querySelector('#form-flex-form');
            const btnAnterior = this.container.querySelector('[data-accion="anterior"]');
            const btnSiguiente = this.container.querySelector('[data-accion="siguiente"]');
            
            if (btnAnterior) {
                btnAnterior.addEventListener('click', () => this.irPasoAnterior());
            }
            
            if (btnSiguiente) {
                btnSiguiente.addEventListener('click', () => this.irPasoSiguiente());
            }
            
            if (form) {
                form.addEventListener('submit', (e) => this.handleSubmit(e));
            }
            
            // Validación en tiempo real
            this.container.querySelectorAll('input, select, textarea').forEach(input => {
                input.addEventListener('change', () => this.limpiarError(input.name));
                input.addEventListener('input', () => this.limpiarError(input.name));
            });

            // Re-evaluar navegación cuando cambian radios (eventos o campos condicionantes)
            this.container.querySelectorAll('input[type="radio"]').forEach(input => {
                input.addEventListener('change', () => {
                    this.guardarRespuestasPasoActual();
                    this.actualizarBotones();
                });
            });

            // Campos numéricos: impedir valores negativos por teclado
            this.container.querySelectorAll('input[type="number"]').forEach(input => {
                // Bloquear teclas de signo negativo
                input.addEventListener('keydown', (e) => {
                    if (e.key === '-' || e.key === 'e' || e.key === 'E') {
                        e.preventDefault();
                    }
                });
                // Sanitizar al pegar o cambiar valor
                input.addEventListener('input', () => {
                    const min = parseFloat(input.min) || 0;
                    if (input.value !== '' && parseFloat(input.value) < min) {
                        input.value = min;
                    }
                });
            });
        }

        mostrarPaso(numero) {
            this.pasoActual = numero;
            
            // Actualizar pasos visibles
            this.container.querySelectorAll('.form-flex-paso').forEach(paso => {
                paso.classList.remove('activo');
            });
            
            const pasoActivo = this.container.querySelector(`.form-flex-paso[data-paso="${numero}"]`);
            if (pasoActivo) {
                pasoActivo.classList.add('activo');
            }
            
            // Actualizar progreso
            this.container.querySelectorAll('.form-flex-progreso-paso').forEach((paso, index) => {
                paso.classList.remove('activo', 'completado');
                if (index + 1 < numero) {
                    paso.classList.add('completado');
                } else if (index + 1 === numero) {
                    paso.classList.add('activo');
                }
            });
            
            this.container.querySelectorAll('.form-flex-progreso-linea').forEach((linea, index) => {
                linea.classList.remove('completada');
                if (index + 1 < numero) {
                    linea.classList.add('completada');
                }
            });
            
            // Actualizar botones
            this.actualizarBotones();
        }

        actualizarBotones() {
            const btnAnterior = this.container.querySelector('[data-accion="anterior"]');
            const btnSiguiente = this.container.querySelector('[data-accion="siguiente"]');
            const btnEnviar = this.container.querySelector('.form-flex-btn-enviar');
            
            if (btnAnterior) {
                const hayAnterior = this.getPasoVisibleAnterior(this.pasoActual) > 0;
                btnAnterior.style.display = hayAnterior ? 'inline-flex' : 'none';
            }
            
            if (btnSiguiente && btnEnviar) {
                if (this.esUltimoPasoVisible(this.pasoActual)) {
                    btnSiguiente.style.display = 'none';
                    btnEnviar.style.display = 'inline-flex';
                } else {
                    btnSiguiente.style.display = 'inline-flex';
                    btnEnviar.style.display = 'none';
                }
            }
        }

        irPasoAnterior() {
            this.limpiarErrorGeneral();
            const anterior = this.getPasoVisibleAnterior(this.pasoActual);
            if (anterior > 0) {
                this.mostrarPaso(anterior);
            }
        }

        irPasoSiguiente() {
            this.limpiarErrorGeneral();
            if (this.validarPasoActual()) {
                this.guardarRespuestasPasoActual();
                const siguiente = this.getPasoVisibleSiguiente(this.pasoActual);
                if (siguiente <= this.totalPasos) {
                    this.mostrarPaso(siguiente);
                }
            }
        }

        /**
         * Guarda las respuestas del paso actual en this.respuestas
         * para evaluar condiciones de pasos posteriores
         */
        guardarRespuestasPasoActual() {
            const paso = this.container.querySelector(`.form-flex-paso[data-paso="${this.pasoActual}"]`);
            if (!paso) return;

            // Guardar respuesta de evento
            if (paso.dataset.tipo === 'evento') {
                const codigo = paso.dataset.eventoCodigo;
                const radio = paso.querySelector(`input[name="eventos[${codigo}]"]:checked`);
                if (radio) {
                    if (!this.respuestas.eventos) this.respuestas.eventos = {};
                    this.respuestas.eventos[codigo] = radio.value;
                }
                return;
            }

            // Guardar respuesta de campo
            const campoDiv = paso.querySelector('.form-flex-campo[data-campo]');
            if (!campoDiv) return;
            const campoId = campoDiv.dataset.campo;
            const tipo = campoDiv.dataset.tipo;

            if (tipo === 'radio') {
                const radio = campoDiv.querySelector(`input[name="${campoId}"]:checked`);
                this.respuestas[campoId] = radio ? radio.value : null;
            } else if (tipo === 'select') {
                const select = campoDiv.querySelector(`select[name="${campoId}"]`);
                this.respuestas[campoId] = select ? select.value : null;
            } else if (tipo === 'checkbox') {
                const checked = campoDiv.querySelectorAll(`input[name="${campoId}[]"]:checked`);
                this.respuestas[campoId] = Array.from(checked).map(c => c.value);
            } else {
                const input = campoDiv.querySelector(`[name="${campoId}"]`);
                this.respuestas[campoId] = input ? input.value : null;
            }
        }

        /**
         * Evalúa si un paso es visible según la condición de su campo
         */
        evaluarCondicionPaso(paso) {
            if (!this.evaluarContextoPaso(paso)) {
                return false;
            }

            // Paso de nombre de acompañante: visible solo si eligió "__acompanante__"
            if (paso.dataset.tipo === 'acompanante-nombre') {
                const radio = this.container.querySelector('input[name="id_invitado_grupo"]:checked');
                return radio && radio.value === '__acompanante__';
            }

            const tipo = paso.dataset.condicionTipo;
            if (!tipo) return true;

            const objetivo = paso.dataset.condicionObjetivo;
            const valor = paso.dataset.condicionValor;

            if (tipo === 'evento') {
                const respEvento = this.respuestas.eventos?.[objetivo];
                return respEvento === valor;
            }

            if (tipo === 'campo') {
                return this.respuestas[objetivo] === valor;
            }

            return true;
        }

        normalizarContextoInvitacion(contexto) {
            let libre = true;
            let grupo = true;
            if (contexto && typeof contexto === 'object') {
                if (Object.prototype.hasOwnProperty.call(contexto, 'libre')) {
                    libre = Boolean(contexto.libre);
                }
                if (Object.prototype.hasOwnProperty.call(contexto, 'grupo')) {
                    grupo = Boolean(contexto.grupo);
                }
            }
            if (!libre && !grupo) {
                libre = true;
                grupo = true;
            }
            return { libre, grupo };
        }

        evaluarContextoPaso(paso) {
            const tieneFlags =
                Object.prototype.hasOwnProperty.call(paso.dataset, 'contextoLibre') ||
                Object.prototype.hasOwnProperty.call(paso.dataset, 'contextoGrupo');
            if (!tieneFlags) return true;

            let libre = paso.dataset.contextoLibre !== '0';
            let grupo = paso.dataset.contextoGrupo !== '0';
            if (!libre && !grupo) {
                libre = true;
                grupo = true;
            }
            return this.esContextoGrupo ? grupo : libre;
        }

        /**
         * Obtiene el número del siguiente paso visible desde el paso dado
         */
        getPasoVisibleSiguiente(desde) {
            for (let i = desde + 1; i <= this.totalPasos; i++) {
                const paso = this.container.querySelector(`.form-flex-paso[data-paso="${i}"]`);
                if (paso && this.evaluarCondicionPaso(paso)) {
                    return i;
                }
            }
            return this.totalPasos + 1;
        }

        /**
         * Obtiene el número del paso visible anterior desde el paso dado
         */
        getPasoVisibleAnterior(desde) {
            for (let i = desde - 1; i >= 1; i--) {
                const paso = this.container.querySelector(`.form-flex-paso[data-paso="${i}"]`);
                if (paso && this.evaluarCondicionPaso(paso)) {
                    return i;
                }
            }
            return 0;
        }

        /**
         * Verifica si el paso actual es el último paso visible
         */
        esUltimoPasoVisible(actual) {
            return this.getPasoVisibleSiguiente(actual) > this.totalPasos;
        }

        limpiarErrorGeneral() {
            const errorGeneral = this.container.querySelector('.form-flex-error-general');
            if (errorGeneral) errorGeneral.remove();
        }

        validarPasoActual() {
            const paso = this.container.querySelector(`.form-flex-paso[data-paso="${this.pasoActual}"]`);
            if (!paso) return true;
            
            let valido = true;
            const inputs = paso.querySelectorAll('input[required], select[required], textarea[required]');
            
            inputs.forEach(input => {
                if (!this.validarCampo(input)) {
                    valido = false;
                }
            });
            
            // Validación especial para selección de invitado de grupo
            const grupoInvitados = paso.querySelector('.form-flex-invitados-grupo');
            if (grupoInvitados) {
                const radioMarcado = grupoInvitados.querySelector('input[type="radio"]:checked');
                if (!radioMarcado) {
                    this.mostrarError('invitado', this.getMensaje('invitado_requerido'));
                    valido = false;
                }
            }

            // Validación especial para grupos de checkbox obligatorios
            const checkboxGroups = paso.querySelectorAll('.form-flex-checkbox-group[data-requerido="true"]');
            checkboxGroups.forEach(group => {
                const campoId = group.dataset.campoId;
                const checkeados = group.querySelectorAll('input[type="checkbox"]:checked');
                if (checkeados.length === 0) {
                    this.mostrarError(campoId, this.getMensaje('campo_requerido'));
                    valido = false;
                }
            });

            // Validación especial para pasos de evento individual
            if (paso.dataset.tipo === 'evento') {
                const codigoEvento = paso.dataset.eventoCodigo;
                const eventoDiv = paso.querySelector('.form-flex-evento');
                if (eventoDiv) {
                    const radios = eventoDiv.querySelectorAll('input[type="radio"]');
                    let tieneRespuesta = false;
                    radios.forEach(radio => {
                        if (radio.checked) tieneRespuesta = true;
                    });
                    
                    if (!tieneRespuesta) {
                        this.mostrarError('evento_' + codigoEvento, this.getMensaje('evento_requerido'));
                        valido = false;
                    }
                }
            }

            // Validación de reglas personalizadas de campos (regex, minLength, maxLength, etc.)
            const campoDiv = paso.querySelector('.form-flex-campo[data-campo]');
            if (campoDiv && valido) {
                if (!this.validarReglasPersonalizadas(campoDiv)) {
                    valido = false;
                }
            }
            
            return valido;
        }

        /**
         * Valida las reglas personalizadas configuradas para un campo
         * (regex, minLength, maxLength, min, max, etc.)
         */
        validarReglasPersonalizadas(campoDiv) {
            const campoId = campoDiv.dataset.campo;
            if (!campoId || !this.config.campos) return true;
            
            const campoConfig = this.config.campos.find(c => {
                const id = c.id || c.config?.codigo || '';
                return id === campoId;
            });
            if (!campoConfig) return true;
            
            const config = campoConfig.config || campoConfig;
            const reglas = config.validacion?.reglas || campoConfig.validacion?.reglas || [];
            if (reglas.length === 0) return true;
            
            const input = campoDiv.querySelector(`[name="${campoId}"]`);
            if (!input) return true;
            
            const valor = (input.value || '').trim();
            if (!valor) return true;
            
            for (const regla of reglas) {
                const resultado = this.ejecutarReglaCliente(regla, valor);
                if (!resultado.valido) {
                    this.mostrarError(campoId, resultado.mensaje);
                    return false;
                }
            }
            
            return true;
        }

        /**
         * Ejecuta una regla de validación del lado cliente
         * Espeja la lógica de ValidationRules.php para consistencia
         */
        ejecutarReglaCliente(regla, valor) {
            const tipo = regla.tipo || '';
            const parametro = regla.valor || null;
            const patron = regla.patron || null;
            
            let esValido = true;
            
            switch (tipo) {
                case 'regex':
                    if (patron) {
                        try {
                            const patronLimpio = this.prepararPatronRegex(patron);
                            const regex = new RegExp(patronLimpio.patron, patronLimpio.flags);
                            esValido = regex.test(valor);
                        } catch(e) {
                            esValido = true;
                        }
                    }
                    break;
                case 'minLength':
                    if (parametro !== null) esValido = valor.length >= parseInt(parametro);
                    break;
                case 'maxLength':
                    if (parametro !== null) esValido = valor.length <= parseInt(parametro);
                    break;
                case 'min':
                    if (parametro !== null && !isNaN(parseFloat(valor))) esValido = parseFloat(valor) >= parseFloat(parametro);
                    break;
                case 'max':
                    if (parametro !== null && !isNaN(parseFloat(valor))) esValido = parseFloat(valor) <= parseFloat(parametro);
                    break;
            }
            
            if (esValido) return { valido: true, mensaje: null };
            
            const mensajeError = regla.mensajeError || {};
            let mensaje = this.getTexto(mensajeError) || this.getMensaje('validacion_' + tipo);
            if (parametro !== null) {
                mensaje = mensaje.replace(':valor', parametro);
            }
            
            return { valido: false, mensaje };
        }

        prepararPatronRegex(patron) {
            // Si tiene delimitadores PHP (/pattern/flags), extraer
            const match = patron.match(/^\/(.+)\/([gimsuy]*)$/);
            if (match) {
                return { patron: match[1], flags: match[2] || '' };
            }
            return { patron: patron, flags: '' };
        }

        validarCampo(input) {
            const nombre = input.name.replace('[]', '');
            let valor = input.value;
            
            // Para radio buttons, verificar si alguno está seleccionado
            if (input.type === 'radio') {
                const radios = this.container.querySelectorAll(`input[name="${input.name}"]`);
                let seleccionado = false;
                radios.forEach(r => {
                    if (r.checked) seleccionado = true;
                });
                if (!seleccionado) {
                    this.mostrarError(nombre, this.getMensaje('campo_requerido'));
                    return false;
                }
            }
            
            // Validación de valor vacío
            if (input.required && !valor.trim()) {
                this.mostrarError(nombre, this.getMensaje('campo_requerido'));
                return false;
            }
            
            // Validación de número: no permitir negativos
            if (input.type === 'number' && valor) {
                const numVal = parseFloat(valor);
                const min = parseFloat(input.min) || 0;
                if (isNaN(numVal) || numVal < min) {
                    input.value = '';
                    this.mostrarError(nombre, this.getMensaje('numero_minimo'));
                    return false;
                }
            }
            
            this.limpiarError(nombre);
            return true;
        }

        mostrarError(campo, mensaje) {
            const errorEl = this.container.querySelector(`#error_${campo}`);
            if (errorEl) {
                errorEl.textContent = mensaje;
                errorEl.style.display = 'block';
            }
            
            const input = this.container.querySelector(`[name="${campo}"]`);
            if (input) {
                input.classList.add('error');
            }
        }

        limpiarError(campo) {
            const nombreLimpio = campo.replace('[]', '').replace(/\[.*\]/, '');
            const errorEl = this.container.querySelector(`#error_${nombreLimpio}`);
            if (errorEl) {
                errorEl.textContent = '';
                errorEl.style.display = 'none';
            }
            
            const input = this.container.querySelector(`[name="${campo}"]`);
            if (input) {
                input.classList.remove('error');
            }
        }

        async handleSubmit(e) {
            e.preventDefault();
            
            if (!this.validarPasoActual()) {
                return;
            }
            
            this.guardarRespuestasPasoActual();

            // Tras guardar respuestas, re-verificar si hay más pasos visibles
            if (!this.esUltimoPasoVisible(this.pasoActual)) {
                const siguiente = this.getPasoVisibleSiguiente(this.pasoActual);
                if (siguiente <= this.totalPasos) {
                    this.mostrarPaso(siguiente);
                }
                return;
            }
            
            const form = e.target;
            const formData = new FormData(form);
            const respuestas = this.formDataToObject(formData);

            // Manejar acompañante: reemplazar id_invitado_grupo por nombre_invitado + flag
            if (respuestas.id_invitado_grupo === '__acompanante__') {
                delete respuestas.id_invitado_grupo;
                respuestas.es_acompanante = true;
                respuestas.nombre_invitado = (respuestas.nombre_acompanante || '').trim();
                delete respuestas.nombre_acompanante;
            } else {
                delete respuestas.nombre_acompanante;
            }

            // Excluir respuestas de campos ocultos por condición
            if (this.config.campos) {
                this.config.campos.forEach((campo) => {
                    const condicion = campo.condicion;
                    if (!condicion || !condicion.tipo) return;
                    const campoId = campo.id || campo.config?.codigo || '';
                    const paso = this.container.querySelector(`.form-flex-paso[data-campo-id="${campoId}"]`);
                    if (paso && !this.evaluarCondicionPaso(paso)) {
                        delete respuestas[campoId];
                    }
                });
            }
            
            // Mostrar estado de carga
            this.mostrarCargando();

            // En demoMode (preview de modelo), simular respuesta exitosa sin fetch
            if (this.demoMode) {
                const self = this;
                setTimeout(function() {
                    const demoResult = {
                        success: true,
                        id: 0,
                        esNueva: true,
                        demo: true
                    };
                    self.ocultarCargando();
                    self.mostrarExito(demoResult);
                    self.onSuccess(demoResult);
                }, 800);
                return;
            }
            
            try {
                const response = await fetch(this.submitUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'same-origin',
                    body: JSON.stringify({
                        invitacion: this.invitacionEnc,
                        token: this.token,
                        id_grupo: this.idGrupo,
                        respuestas: respuestas,
                        idioma: this.idioma,
                        config_version: this.configVersion
                    })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    this.ocultarCargando();
                    this.mostrarExito(result);
                    this.onSuccess(result);
                } else if (result.errorCode === 'CONFIG_VERSION_MISMATCH') {
                    this.ocultarCargando();
                    this.mostrarVersionMismatch(result.error || this.getMensaje('formulario_actualizado'));
                    this.onError(result);
                } else {
                    this.ocultarCargando();
                    this.mostrarErrorGeneral(result.error || this.getMensaje('error_envio'));
                    if (result.errores) {
                        this.mostrarErroresCampos(result.errores);
                    }
                    this.onError(result);
                }
            } catch (error) {
                console.error('Error:', error);
                this.ocultarCargando();
                const errorConexion = this.getMensaje('error_conexion');
                this.mostrarErrorGeneral(errorConexion);
                this.onError({ error: errorConexion });
            }
        }

        formDataToObject(formData) {
            const obj = {};
            for (const [key, value] of formData.entries()) {
                if (key.includes('[')) {
                    // Manejar arrays y objetos anidados
                    const match = key.match(/^([^\[]+)\[([^\]]*)\](\[\])?$/);
                    if (match) {
                        const base = match[1];
                        const subkey = match[2];
                        const isArray = match[3];
                        
                        if (!obj[base]) obj[base] = subkey ? {} : [];
                        
                        if (subkey) {
                            obj[base][subkey] = value;
                        } else if (Array.isArray(obj[base])) {
                            obj[base].push(value);
                        }
                    }
                } else {
                    obj[key] = value;
                }
            }
            return obj;
        }

        mostrarCargando() {
            const modalContent = this.container.closest('.modal-content-2') || this.container.closest('.modal-content');
            const target = modalContent || this.container.querySelector('.form-flex-container');
            if (!target) return;
            
            target.style.position = 'relative';
            const overlay = document.createElement('div');
            overlay.className = 'form-flex-loading-overlay';
            overlay.innerHTML = `
                <div class="form-flex-loading">
                    <div class="form-flex-spinner form-flex-loading-spinner"></div>
                    <p class="form-flex-loading-text">${this.getMensaje('enviando')}</p>
                </div>
            `;
            target.appendChild(overlay);
        }

        ocultarCargando() {
            const modalContent = this.container.closest('.modal-content-2') || this.container.closest('.modal-content');
            const target = modalContent || this.container;
            const overlay = target.querySelector('.form-flex-loading-overlay');
            if (overlay) overlay.remove();
        }

        mostrarExito(result) {
            const titulo = this.getOverrideTexto('titulo_exito') || this.getTexto(this.config.textos?.tituloExito) || this.getMensaje('titulo_exito');
            const mensaje = this.getOverrideTexto('mensaje_exito') || this.getTexto(this.config.textos?.mensajeExito) || result.message || this.getMensaje('mensaje_exito');
            
            this.container.innerHTML = `
                <div class="form-flex-container">
                    <div class="form-flex-exito">
                        <h3 class="form-flex-exito-titulo">${this.escapeHtml(titulo)}</h3>
                        <p class="form-flex-exito-mensaje">${this.escapeHtml(mensaje)}</p>
                        <button type="button" class="form-flex-btn form-flex-btn-otro-invitado">
                            <i class="fa fa-user-plus"></i> ${this.getMensaje('confirmar_otro')}
                        </button>
                    </div>
                </div>
            `;
            
            // Bind del botón "Confirmar otro invitado"
            const btnOtro = this.container.querySelector('.form-flex-btn-otro-invitado');
            if (btnOtro) {
                btnOtro.addEventListener('click', () => this.resetFormulario());
            }
        }

        /**
         * Resetea el formulario al estado inicial para confirmar otro invitado
         */
        resetFormulario() {
            this.pasoActual = 1;
            this.respuestas = {};
            this.render();
            this.bindEvents();
        }

        mostrarErrorGeneral(mensaje) {
            // Limpiar error general anterior si existe
            const errorPrevio = this.container.querySelector('.form-flex-error-general');
            if (errorPrevio) errorPrevio.remove();
            
            const nav = this.container.querySelector('.form-flex-navegacion');
            if (nav) {
                const errorDiv = document.createElement('div');
                errorDiv.className = 'form-flex-error form-flex-error-general';
                errorDiv.style.textAlign = 'center';
                errorDiv.style.marginTop = '10px';
                errorDiv.textContent = mensaje;
                nav.parentNode.insertBefore(errorDiv, nav);
            }
        }

        mostrarVersionMismatch(mensaje) {
            const textoMensaje = this.getOverrideTexto('formulario_actualizado') || mensaje;
            const textoBoton = this.getOverrideTexto('boton_actualizar') || this.getMensaje('boton_actualizar');

            this.container.innerHTML = `
                <div class="form-flex-container">
                    <div class="form-flex-exito">
                        <p class="form-flex-exito-mensaje">${this.escapeHtml(textoMensaje)}</p>
                        <button type="button" class="form-flex-btn form-flex-btn-siguiente form-flex-btn-actualizar">
                            ${this.escapeHtml(textoBoton)}
                        </button>
                    </div>
                </div>
            `;

            const btnActualizar = this.container.querySelector('.form-flex-btn-actualizar');
            if (btnActualizar) {
                btnActualizar.addEventListener('click', function() { location.reload(); });
            }
        }

        mostrarErroresCampos(errores) {
            let primerPasoConError = null;
            
            for (const [campo, mensaje] of Object.entries(errores)) {
                this.mostrarError(campo, mensaje);
                
                if (primerPasoConError === null) {
                    const errorEl = this.container.querySelector(`#error_${campo}`);
                    if (errorEl) {
                        const paso = errorEl.closest('.form-flex-paso');
                        if (paso) {
                            primerPasoConError = parseInt(paso.dataset.paso);
                        }
                    }
                }
            }
            
            // Navegar al paso que contiene el primer error
            if (primerPasoConError !== null && primerPasoConError !== this.pasoActual) {
                this.mostrarPaso(primerPasoConError);
            }
        }

        /**
         * Normaliza código de idioma (pt-BR -> pt, es-MX -> es)
         */
        normalizarIdioma(codigo) {
            if (!codigo) return 'es';
            // Extraer código base (pt-BR → pt, it-IT → it, etc.)
            // Ya no se valida contra lista fija para soportar cualquier idioma
            return codigo.split('-')[0].toLowerCase();
        }

        /**
         * Escapa HTML para prevenir XSS
         */
        escapeHtml(text) {
            if (window.FormAsistenciaFlex && window.FormAsistenciaFlex.Utils) {
                return window.FormAsistenciaFlex.Utils.escapeHtml(text);
            }
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        /**
         * Escapa texto para uso seguro en atributos HTML
         */
        escapeAttr(text) {
            if (window.FormAsistenciaFlex && window.FormAsistenciaFlex.Utils) {
                return window.FormAsistenciaFlex.Utils.escapeAttr(text);
            }
            if (!text) return '';
            return String(text)
                .replace(/&/g, '&amp;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
        }

        /**
         * Capitaliza la primera letra de un string
         */
        capitalizar(str) {
            if (window.FormAsistenciaFlex && window.FormAsistenciaFlex.Utils) {
                return window.FormAsistenciaFlex.Utils.capitalizar(str);
            }
            // Fallback local
            if (!str) return '';
            return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
        }

        /**
         * Obtiene texto de objeto multiidioma
         * Usa FormAsistenciaFlex.Utils si está disponible
         */
        getTexto(obj) {
            if (window.FormAsistenciaFlex && window.FormAsistenciaFlex.Utils) {
                return window.FormAsistenciaFlex.Utils.getTexto(obj, this.idioma);
            }
            // Fallback local si Utils no está cargado
            if (!obj) return '';
            if (typeof obj === 'string') return obj;
            return obj[this.idioma] || obj['es'] || '';
        }

        /**
         * Busca un texto solo en override por invitación.
         * Retorna null si no se encuentra, para que el caller use su propio fallback.
         */
        getOverrideTexto(clave) {
            const idioma = this.idioma;
            if (this.textosOverride && 
                this.textosOverride[idioma] && 
                this.textosOverride[idioma][clave]) {
                return this.textosOverride[idioma][clave];
            }
            return null;
        }

        /**
         * Obtiene un mensaje/texto del formulario con 2 fuentes:
         * 1. Override por invitación (textos_override en config_json) - prioridad máxima
         * 2. Textos base (textos-formulario.json) - fuente de verdad
         * 
         * @param {string} clave - Clave del mensaje
         * @returns {string} Texto en el idioma actual
         */
        getMensaje(clave) {
            const idioma = this.idioma;
            
            if (this.textosOverride && 
                this.textosOverride[idioma] && 
                this.textosOverride[idioma][clave]) {
                return this.textosOverride[idioma][clave];
            }
            
            if (this.textosGlobales && 
                this.textosGlobales[clave] && 
                this.textosGlobales[clave][idioma]) {
                return this.textosGlobales[clave][idioma];
            }
            
            if (this.textosGlobales && 
                this.textosGlobales[clave] && 
                this.textosGlobales[clave]['es']) {
                return this.textosGlobales[clave]['es'];
            }
            
            return clave;
        }

    }

    // Exportar al namespace
    window.FormAsistenciaFlex.FormRenderer = FormRenderer;

})();
