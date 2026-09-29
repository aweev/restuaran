"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExportButtons = ExportButtons;
const react_1 = require("react");
const button_1 = require("@/components/ui/button");
const dropdown_menu_1 = require("@/components/ui/dropdown-menu");
const lucide_react_1 = require("lucide-react");
const export_utils_1 = require("@/lib/export-utils");
const use_toast_1 = require("@/hooks/use-toast");
function ExportButtons({ onExportCSV, fileName, pdfElementId }) {
    const [isExporting, setIsExporting] = (0, react_1.useState)(false);
    const { toast } = (0, use_toast_1.useToast)();
    const handleExportCSV = () => {
        try {
            setIsExporting(true);
            const csvContent = onExportCSV();
            (0, export_utils_1.downloadCSV)(csvContent, `${fileName}.csv`);
            toast({
                title: "Export Successful",
                description: `${fileName} has been exported as CSV`,
                duration: 3000,
            });
        }
        catch (error) {
            console.error("Error exporting CSV:", error);
            toast({
                title: "Export Failed",
                description: "There was an error exporting the data",
                variant: "destructive",
                duration: 5000,
            });
        }
        finally {
            setIsExporting(false);
        }
    };
    const handleExportPDF = async () => {
        if (!pdfElementId)
            return;
        try {
            setIsExporting(true);
            await (0, export_utils_1.exportToPDF)(pdfElementId, fileName);
            toast({
                title: "Export Successful",
                description: `${fileName} has been exported as PDF`,
                duration: 3000,
            });
        }
        catch (error) {
            console.error("Error exporting PDF:", error);
            toast({
                title: "Export Failed",
                description: "There was an error exporting the PDF",
                variant: "destructive",
                duration: 5000,
            });
        }
        finally {
            setIsExporting(false);
        }
    };
    return (<dropdown_menu_1.DropdownMenu>
      <dropdown_menu_1.DropdownMenuTrigger asChild>
        <button_1.Button variant="outline" disabled={isExporting}>
          {isExporting ? <lucide_react_1.Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <lucide_react_1.Download className="mr-2 h-4 w-4"/>}
          Export
        </button_1.Button>
      </dropdown_menu_1.DropdownMenuTrigger>
      <dropdown_menu_1.DropdownMenuContent align="end">
        <dropdown_menu_1.DropdownMenuItem onClick={handleExportCSV}>
          <lucide_react_1.FileSpreadsheet className="mr-2 h-4 w-4"/>
          Export as CSV
        </dropdown_menu_1.DropdownMenuItem>
        {pdfElementId && (<dropdown_menu_1.DropdownMenuItem onClick={handleExportPDF}>
            <lucide_react_1.FileIcon className="mr-2 h-4 w-4"/>
            Export as PDF
          </dropdown_menu_1.DropdownMenuItem>)}
      </dropdown_menu_1.DropdownMenuContent>
    </dropdown_menu_1.DropdownMenu>);
}
