/**
 * Form Asistencia Flex - Utilidades compartidas
 * 
 * Funciones comunes utilizadas por form-renderer.js y config-form-asistencia.php
 * 
 * @package FormAsistencia
 * @author Fixdate
 */

(function() {
    'use strict';

    // Namespace global
    window.FormAsistenciaFlex = window.FormAsistenciaFlex || {};

    /**
     * Utilidades compartidas
     */
    const Utils = {
        
        /**
         * Obtiene texto de un objeto multiidioma
         * 
         * @param {Object|string} obj - Objeto {es: '', en: '', pt: ''} o string
         * @param {string} idioma - Idioma preferido (default: 'es')
         * @returns {string} Texto en el idioma seleccionado o fallback
         */
        getTexto: function(obj, idioma = 'es') {
            if (!obj) return '';
            if (typeof obj === 'string') return obj;
            return obj[idioma] || obj['es'] || obj['en'] || obj['pt'] || '';
        },

        /**
         * Escapa HTML para prevenir XSS
         * 
         * @param {string} text - Texto a escapar
         * @returns {string} Texto escapado
         */
        escapeHtml: function(text) {
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        },

        /**
         * Escapa texto para uso seguro en atributos HTML
         * 
         * @param {string} text - Texto a escapar
         * @returns {string} Texto escapado para atributos
         */
        escapeAttr: function(text) {
            if (!text) return '';
            return String(text)
                .replace(/&/g, '&amp;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
        },

        /**
         * Obtiene el icono correspondiente a un tipo de campo
         * 
         * @param {string} tipo - Tipo de campo
         * @returns {string} Clase del icono
         */
        getIconoTipo: function(tipo) {
            const iconos = {
                'text': 'la-minus',
                'textarea': 'la-align-left',
                'number': 'la-sort-numeric-asc',
                'email': 'la-envelope',
                'tel': 'la-phone',
                'select': 'la-list',
                'radio': 'la-dot-circle-o',
                'checkbox': 'la-check-square'
            };
            return iconos[tipo] || 'la-question';
        },

        /**
         * Genera un ID único para campos
         * 
         * @param {string} prefijo - Prefijo para el ID
         * @returns {string} ID único
         */
        generarId: function(prefijo = 'campo') {
            return prefijo + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        },

        /**
         * Normaliza código de idioma (es-MX -> es)
         * 
         * @param {string} codigo - Código de idioma completo
         * @returns {string} Código normalizado
         */
        normalizarIdioma: function(codigo) {
            if (!codigo) return 'es';
            // Extraer código base (pt-BR → pt, it-IT → it, etc.)
            // Ya no se valida contra lista fija para soportar cualquier idioma
            return codigo.split('-')[0].toLowerCase();
        },

        /**
         * Capitaliza la primera letra de un string
         * 
         * @param {string} str - String a capitalizar
         * @returns {string} String capitalizado
         */
        capitalizar: function(str) {
            if (!str) return '';
            return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
        }
    };

    // Exportar al namespace
    window.FormAsistenciaFlex.Utils = Utils;

    // También exportar funciones individuales para compatibilidad
    window.FormAsistenciaFlex.getTexto = Utils.getTexto;
    window.FormAsistenciaFlex.escapeHtml = Utils.escapeHtml;
    window.FormAsistenciaFlex.escapeAttr = Utils.escapeAttr;
    window.FormAsistenciaFlex.capitalizar = Utils.capitalizar;

})();
