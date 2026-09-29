"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TourProvider = TourProvider;
exports.useTour = useTour;
const react_1 = require("react");
const useLocalStorage_1 = require("@/hooks/useLocalStorage");
const tour_step_1 = require("@/components/guided-tour/tour-step");
const TourContext = (0, react_1.createContext)(undefined);
// Define available tours
const tours = {
    dashboard: [
        {
            id: "dashboard-welcome",
            title: "Welcome to the Dashboard",
            content: "This is your main dashboard where you can see an overview of your restaurant's performance.",
            target: "#dashboard-overview",
            placement: "bottom",
        },
        {
            id: "recent-orders",
            title: "Recent Orders",
            content: "Here you can see the most recent orders placed in your restaurant.",
            target: "#recent-orders",
            placement: "right",
        },
        {
            id: "table-status",
            title: "Table Status",
            content: "This section shows the current status of all tables in your restaurant.",
            target: "#table-status",
            placement: "left",
        },
    ],
    orders: [
        {
            id: "orders-welcome",
            title: "Order Management",
            content: "This is where you can manage all orders for your restaurant.",
            target: "#orders-header",
            placement: "bottom",
        },
        {
            id: "create-order",
            title: "Create New Orders",
            content: "Click here to create a new order for a customer.",
            target: "#create-order-button",
            placement: "right",
        },
        {
            id: "order-filters",
            title: "Filter Orders",
            content: "Use these filters to find specific orders quickly.",
            target: "#order-filters",
            placement: "bottom",
        },
    ],
    // Add more tours as needed
};
function TourProvider({ children }) {
    const [currentTour, setCurrentTour] = (0, react_1.useState)(null);
    const [currentStep, setCurrentStep] = (0, react_1.useState)(0);
    const [completedTours, setCompletedTours] = (0, useLocalStorage_1.useLocalStorage)("pos-completed-tours", []);
    const startTour = (tourId) => {
        if (tours[tourId]) {
            setCurrentTour(tourId);
            setCurrentStep(0);
        }
    };
    const endTour = () => {
        if (currentTour) {
            setCompletedTours((prev) => [...prev, currentTour]);
            setCurrentTour(null);
            setCurrentStep(0);
        }
    };
    const nextStep = () => {
        if (currentTour && currentStep < tours[currentTour].length - 1) {
            setCurrentStep(currentStep + 1);
        }
        else {
            endTour();
        }
    };
    const prevStep = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };
    const skipTour = () => {
        if (currentTour) {
            setCompletedTours((prev) => [...prev, currentTour]);
            setCurrentTour(null);
            setCurrentStep(0);
        }
    };
    const resetTours = () => {
        setCompletedTours([]);
    };
    return (<TourContext.Provider value={{
            currentTour,
            currentStep,
            startTour,
            endTour,
            nextStep,
            prevStep,
            skipTour,
            completedTours,
            resetTours,
        }}>
      {children}
      {currentTour && tours[currentTour] && (<tour_step_1.TourStep step={tours[currentTour][currentStep]} totalSteps={tours[currentTour].length} currentStep={currentStep} onNext={nextStep} onPrev={prevStep} onSkip={skipTour}/>)}
    </TourContext.Provider>);
}
function useTour() {
    const context = (0, react_1.useContext)(TourContext);
    if (context === undefined) {
        throw new Error("useTour must be used within a TourProvider");
    }
    return context;
}
