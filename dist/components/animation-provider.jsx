"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnimationProvider = AnimationProvider;
exports.useAnimation = useAnimation;
exports.AnimatedComponent = AnimatedComponent;
const react_1 = require("react");
const framer_motion_1 = require("framer-motion");
const AnimationContext = (0, react_1.createContext)(undefined);
function AnimationProvider({ children }) {
    const [animationsEnabled, setAnimationsEnabled] = (0, react_1.useState)(true);
    const [animationSpeed, setAnimationSpeed] = (0, react_1.useState)("normal");
    const toggleAnimations = () => {
        setAnimationsEnabled((prev) => !prev);
    };
    const getAnimationProps = (preset) => {
        if (!animationsEnabled || preset === "none") {
            return {};
        }
        switch (preset) {
            case "fade":
                return {
                    initial: { opacity: 0 },
                    animate: { opacity: 1 },
                    exit: { opacity: 0 },
                };
            case "slide":
                return {
                    initial: { x: -20, opacity: 0 },
                    animate: { x: 0, opacity: 1 },
                    exit: { x: 20, opacity: 0 },
                };
            case "scale":
                return {
                    initial: { scale: 0.9, opacity: 0 },
                    animate: { scale: 1, opacity: 1 },
                    exit: { scale: 0.9, opacity: 0 },
                };
            default:
                return {};
        }
    };
    const getTransitionProps = () => {
        if (!animationsEnabled) {
            return { duration: 0 };
        }
        const durations = {
            slow: 0.5,
            normal: 0.3,
            fast: 0.15,
        };
        return {
            duration: durations[animationSpeed],
            ease: "easeInOut",
        };
    };
    return (<AnimationContext.Provider value={{
            animationsEnabled,
            toggleAnimations,
            animationSpeed,
            setAnimationSpeed,
            getAnimationProps,
            getTransitionProps,
        }}>
      {children}
    </AnimationContext.Provider>);
}
function useAnimation() {
    const context = (0, react_1.useContext)(AnimationContext);
    if (context === undefined) {
        throw new Error("useAnimation must be used within an AnimationProvider");
    }
    return context;
}
function AnimatedComponent({ children, preset = "fade", className, }) {
    const { getAnimationProps, getTransitionProps } = useAnimation();
    return (<framer_motion_1.motion.div {...getAnimationProps(preset)} transition={getTransitionProps()} className={className}>
      {children}
    </framer_motion_1.motion.div>);
}
