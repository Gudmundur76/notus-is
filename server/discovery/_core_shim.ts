/**
 * Thin shim to access server/_core utilities from the discovery module
 * without circular import issues.
 */
export { notifyOwner } from "../_core/notification";
