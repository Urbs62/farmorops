/**
 * @typedef {'BUILTIN'|'WORKSHOP'} CsMapSource
 *
 * @typedef {Object} CsMap
 * @property {string} id
 * @property {string} name
 * @property {string} displayName
 * @property {CsMapSource} source
 * @property {string|null} workshopId
 * @property {boolean} validForMapCycle
 *
 * @typedef {'CHANGE_MAP'|'RESTART_MATCH'} CsServerCommandType
 *
 * @typedef {Object} CsServerCommandRequest
 * @property {CsServerCommandType} type
 * @property {string} [map]
 *
 * @typedef {Object} CsApiErrorResponse
 * @property {string} timestamp
 * @property {number} status
 * @property {string} error
 * @property {string} message
 * @property {string} path
 */

module.exports = {};
