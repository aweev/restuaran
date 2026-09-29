"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertToCSV = convertToCSV;
exports.exportOrdersToCSV = exportOrdersToCSV;
exports.exportInventoryToCSV = exportInventoryToCSV;
exports.downloadCSV = downloadCSV;
exports.exportToPDF = exportToPDF;
const date_fns_1 = require("date-fns");
// Helper function to convert data to CSV
function convertToCSV(data, headers, dateFields = []) {
    // Create header row
    const headerRow = Object.values(headers).join(",");
    // Create data rows
    const rows = data.map((item) => {
        return Object.keys(headers)
            .map((key) => {
            const value = item[key];
            // Format date fields
            if (dateFields.includes(key) && value) {
                return `"${(0, date_fns_1.format)(new Date(value), "yyyy-MM-dd HH:mm:ss")}"`;
            }
            // Handle arrays and objects
            if (typeof value === "object" && value !== null) {
                return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
            }
            // Handle strings with commas
            if (typeof value === "string" && value.includes(",")) {
                return `"${value.replace(/"/g, '""')}"`;
            }
            return value === null || value === undefined ? "" : value;
        })
            .join(",");
    });
    return [headerRow, ...rows].join("\n");
}
// Export orders to CSV
function exportOrdersToCSV(orders) {
    const headers = {
        id: "Order ID",
        createdAt: "Date",
        customerName: "Customer",
        diningMode: "Dining Mode",
        tableId: "Table ID",
        subtotal: "Subtotal",
        tax: "Tax",
        discount: "Discount",
        total: "Total",
        status: "Status",
        isPaid: "Is Paid",
    };
    const dateFields = ["createdAt", "updatedAt"];
    return convertToCSV(orders, headers, dateFields);
}
// Export inventory to CSV
function exportInventoryToCSV(ingredients) {
    const headers = {
        id: "ID",
        name: "Name",
        category: "Category",
        unit: "Unit",
        currentStock: "Current Stock",
        reorderLevel: "Reorder Level",
        unitCost: "Unit Cost",
        usageLastMonth: "Usage Last Month",
        isActive: "Active",
        lastUpdated: "Last Updated",
    };
    const dateFields = ["lastUpdated"];
    return convertToCSV(ingredients, headers, dateFields);
}
// Download CSV file
function downloadCSV(csvContent, fileName) {
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
// Export data to PDF (client-side)
async function exportToPDF(elementId, fileName, options = {
    margin: { top: 20, right: 20, bottom: 20, left: 20 },
    format: "a4",
}) {
    try {
        // Dynamically import jspdf and html2canvas
        const [jsPDF, html2canvas] = await Promise.all([Promise.resolve().then(() => __importStar(require("jspdf"))), Promise.resolve().then(() => __importStar(require("html2canvas")))]);
        const element = document.getElementById(elementId);
        if (!element)
            throw new Error(`Element with ID ${elementId} not found`);
        const canvas = await html2canvas.default(element, {
            scale: 2,
            logging: false,
            useCORS: true,
        });
        const pdf = new jsPDF.default(options);
        const imgData = canvas.toDataURL("image/png");
        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
        pdf.save(`${fileName}.pdf`);
        return Promise.resolve();
    }
    catch (error) {
        console.error("Error exporting to PDF:", error);
        return Promise.reject(error);
    }
}
