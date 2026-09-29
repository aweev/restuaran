"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TourStep = TourStep;
const react_1 = require("react");
const framer_motion_1 = require("framer-motion");
const button_1 = require("@/components/ui/button");
const lucide_react_1 = require("lucide-react");
function TourStep({ step, totalSteps, currentStep, onNext, onPrev, onSkip }) {
    const [position, setPosition] = (0, react_1.useState)({ top: 0, left: 0 });
    const [targetElement, setTargetElement] = (0, react_1.useState)(null);
    const tooltipRef = (0, react_1.useRef)(null);
    (0, react_1.useEffect)(() => {
        const target = document.querySelector(step.target);
        if (target) {
            setTargetElement(target);
            // Position the tooltip
            const updatePosition = () => {
                var _a;
                const rect = target.getBoundingClientRect();
                const tooltipRect = (_a = tooltipRef.current) === null || _a === void 0 ? void 0 : _a.getBoundingClientRect();
                const tooltipWidth = (tooltipRect === null || tooltipRect === void 0 ? void 0 : tooltipRect.width) || 300;
                const tooltipHeight = (tooltipRect === null || tooltipRect === void 0 ? void 0 : tooltipRect.height) || 150;
                let top = 0;
                let left = 0;
                switch (step.placement) {
                    case "top":
                        top = rect.top - tooltipHeight - 10;
                        left = rect.left + rect.width / 2 - tooltipWidth / 2;
                        break;
                    case "right":
                        top = rect.top + rect.height / 2 - tooltipHeight / 2;
                        left = rect.right + 10;
                        break;
                    case "bottom":
                        top = rect.bottom + 10;
                        left = rect.left + rect.width / 2 - tooltipWidth / 2;
                        break;
                    case "left":
                        top = rect.top + rect.height / 2 - tooltipHeight / 2;
                        left = rect.left - tooltipWidth - 10;
                        break;
                    default:
                        top = rect.bottom + 10;
                        left = rect.left + rect.width / 2 - tooltipWidth / 2;
                }
                // Ensure tooltip stays within viewport
                if (left < 10)
                    left = 10;
                if (left + tooltipWidth > window.innerWidth - 10)
                    left = window.innerWidth - tooltipWidth - 10;
                if (top < 10)
                    top = 10;
                if (top + tooltipHeight > window.innerHeight - 10)
                    top = window.innerHeight - tooltipHeight - 10;
                setPosition({ top, left });
            };
            updatePosition();
            // Highlight the target element
            target.setAttribute("data-tour-target", "true");
            // Update position on resize
            window.addEventListener("resize", updatePosition);
            return () => {
                target.removeAttribute("data-tour-target");
                window.removeEventListener("resize", updatePosition);
            };
        }
    }, [step]);
    return (<>
      {/* Overlay */}
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onSkip}/>

      {/* Target highlight */}
      {targetElement && (<div className="fixed z-50 animate-pulse rounded-md ring-4 ring-primary" style={{
                top: targetElement.getBoundingClientRect().top,
                left: targetElement.getBoundingClientRect().left,
                width: targetElement.getBoundingClientRect().width,
                height: targetElement.getBoundingClientRect().height,
            }}/>)}

      {/* Tooltip */}
      <framer_motion_1.AnimatePresence>
        <framer_motion_1.motion.div ref={tooltipRef} className="fixed z-50 w-[300px] rounded-lg border bg-card p-4 shadow-lg" style={{ top: position.top, left: position.left }} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.2 }}>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">{step.title}</h3>
            <button_1.Button variant="ghost" size="icon" onClick={onSkip} className="h-6 w-6">
              <lucide_react_1.X className="h-4 w-4"/>
              <span className="sr-only">Close</span>
            </button_1.Button>
          </div>

          <p className="mt-2 text-sm text-muted-foreground">{step.content}</p>

          <div className="mt-4 flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              Step {currentStep + 1} of {totalSteps}
            </div>
            <div className="flex gap-2">
              {currentStep > 0 && (<button_1.Button variant="outline" size="sm" onClick={onPrev}>
                  <lucide_react_1.ChevronLeft className="mr-1 h-4 w-4"/>
                  Back
                </button_1.Button>)}
              <button_1.Button size="sm" onClick={onNext}>
                {currentStep === totalSteps - 1 ? "Finish" : "Next"}
                {currentStep !== totalSteps - 1 && <lucide_react_1.ChevronRight className="ml-1 h-4 w-4"/>}
              </button_1.Button>
            </div>
          </div>
        </framer_motion_1.motion.div>
      </framer_motion_1.AnimatePresence>
    </>);
}
