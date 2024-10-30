import React, { useState, useEffect, useMemo } from "react";

const TransactionProgressComponent = ({ 
    transaction, 
    typeOfTransaction, 
    initialState, 
    isSendAndWithdrawFinished, 
    payToken1Finished, 
    receiveToken1Finished,
    removeTokenApproved
}) => {
    const swapSteps = ["Sending token", "Verifying token", "Updating liquidity pool", "Receiving Token"];
    const swapWithdrawSteps = ["Transfering pay token", "Sending token", "Updating Liquidity Pool", "Receiving Token", "Withdrawing Token"];
    const addLiquiditySteps = ["Sending token 1", "Sending token 2", "Updating liquidity pool", "Updating LP token"];
    const removeLiquiditySteps = ["Updating LP token", "Updating liquidity pool", "Sending token 1", "Sending token 2"];
    const [activeStep, setActiveStep] = useState(0);

    const steps = useMemo(() => {
        if (typeOfTransaction === "swap") {
            return swapSteps;
        } else if (typeOfTransaction === "swapWithdraw") {
            return swapWithdrawSteps;
        } else if (typeOfTransaction === "addLiquidity") {
            return addLiquiditySteps;
        } else if (typeOfTransaction === "removeLiquidity") {
            return removeLiquiditySteps;
        }
        return [];
    }, [typeOfTransaction]);

    useEffect(() => {
        if (transaction && transaction.Ok && transaction.Ok[0]) {
            const { statuses } = transaction.Ok[0];
            if (typeOfTransaction === "swap" || typeOfTransaction === "swapWithdraw") {
                
                if (statuses && statuses.length > 0) {
                const statusMap = {
                    "Started": 0,
                    "Sending pay token": 1,
                    "Pay token sent": 1,
                    "Calculating pool amounts": 2,
                    "Updating liquidity pool": 2,
                    "Receiving receive token": 3,
                    "Receive token received": 4,
                    "Success": 4
                };
                    // Get the latest status
                    const latestStatus = statuses[statuses.length - 1];
    
                    // Find the corresponding step index
                    const newActiveStep = statusMap[latestStatus] || 0;
                    setActiveStep(newActiveStep);
                    // Special case for swapWithdraw
                    if (typeOfTransaction === "swapWithdraw" && isSendAndWithdrawFinished) {
                        setActiveStep(steps.length); // Move to the final step
                    }
                }
            } else if (typeOfTransaction === "addLiquidity") {
                const statusMapBackend = {
                        "Started": 3,
                        "Sending token 0": 3,
                        "Token 0 sent": 3,
                        "Sending token 1": 3,
                        "Token 1 sent": 3,
                        "Calculating pool amounts": 3,
                        "Pool amounts calculated": 3,
                        "Updating liquidity pool": 3,
                        "Liquidity pool updated": 3,
                        "Updating user LP token amount": 3,
                        "User LP token amount updated": 4,
                        "Success": 4
                    }

                    const latestStatus = statuses[statuses.length - 1];
                    const newActiveStep = statusMapBackend[latestStatus] || 0;
                    setActiveStep(newActiveStep);
                } else if (typeOfTransaction === "removeLiquidity") {

                    const statusMap = {
                        "Started": 2,
                        "Updating user LP token amount": 2,
                        "User LP token amount updated": 2,
                        "Updating liquidity pool": 2,
                        "Receiving token 0": 2,
                        "Token 0 received": 3,
                        "Receiving token 1": 3,
                        "Token 1 received": 4,
                        "Success": 4
                    };
                    const latestStatus = statuses[statuses.length - 1];
                    const newActiveStep = statusMap[latestStatus] || 0;
                    setActiveStep(newActiveStep);
                }
        }        
    }, [transaction, typeOfTransaction, isSendAndWithdrawFinished, payToken1Finished, receiveToken1Finished, removeTokenApproved]);

    useEffect(() => {
        if (typeOfTransaction === "addLiquidity") {
            if (payToken1Finished) {
                setActiveStep(1);
            }
            if (receiveToken1Finished) {
                setActiveStep(2);
            }
        } else if (typeOfTransaction === "removeLiquidity") {
            if (removeTokenApproved) {
                setActiveStep(1);
            }
        }
    }, [payToken1Finished, receiveToken1Finished, typeOfTransaction, removeTokenApproved]);

    // Memoized class assignment based on step text and activeStep
const stepClasses = useMemo(() => {
    return steps.map((step, index) => {
        if (step.toLowerCase().includes("sending")) return "step-image-sending";
        if (step.toLowerCase().includes("updating")) return "step-image-updating";
        if (step.toLowerCase().includes("receiving")) return "step-image-receiving";
        if (activeStep >= index + 1) return "step-image-complete";
        return "step-image-sending";
    });
}, [steps, activeStep]);

    return (
        <>
            <ul className="steps steps-4">
                {steps.map((step, index) => (
                    <li className="step" key={index}>
                        <span
                            className={`step-image 
                                ${stepClasses[index]}
                                ${activeStep >= index + 1? 'step-image-complete' : ''}
                                `}
                        ></span>
                        <span
                            className={`step-text ${
                                activeStep >= index ? 'step-text-complete' : ''
                            }`}
                        >
                            {step}
                        </span>
                    </li>
                ))}
            </ul>
            <div className="steps-subtitle-center">
                {typeOfTransaction.charAt(0).toUpperCase() + typeOfTransaction.slice(1)} in progress
            </div>
            <ul className="steps-progress-bar">
                {steps.map((step, index) => (
                    <li
                        className={`steps-progress-cell ${
                            activeStep >= index + 1 ? 'active' : ''
                        }`}
                        key={index}
                    ></li>
                ))}
            </ul>
        </>
    );
};

export default TransactionProgressComponent;
