"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.kernelError = kernelError;
exports.isCommandOk = isCommandOk;
function kernelError(code, message, details) {
    return Object.assign({ code, message }, (details ? { details } : {}));
}
function isCommandOk(result) {
    return result.success === true;
}
