"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = void 0;
const server_1 = require("next/server");
const prisma_1 = __importDefault(require("@/lib/prisma"));
const auth_middleware_1 = require("@/middleware/auth-middleware");
const twilio_1 = __importDefault(require("twilio"));
// Initialize Twilio client
const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? (0, twilio_1.default)(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null;
// POST - Notify a customer that their table is ready
exports.POST = (0, auth_middleware_1.withAuth)(async (req, { params }) => {
    try {
        const { id } = params;
        // Check if wait list entry exists
        const waitListEntry = await prisma_1.default.waitList.findUnique({
            where: { id },
        });
        if (!waitListEntry) {
            return server_1.NextResponse.json({ error: "Wait list entry not found" }, { status: 404 });
        }
        // If no phone number, just mark as notified
        if (!waitListEntry.phoneNumber) {
            const updatedEntry = await prisma_1.default.waitList.update({
                where: { id },
                data: { notified: true },
            });
            return server_1.NextResponse.json(updatedEntry);
        }
        // Send SMS notification if Twilio is configured
        if (twilioClient && process.env.TWILIO_PHONE_NUMBER) {
            await twilioClient.messages.create({
                body: `Hello ${waitListEntry.customerName}, your table at our restaurant is now ready! Please check in with the host.`,
                from: process.env.TWILIO_PHONE_NUMBER,
                to: waitListEntry.phoneNumber,
            });
        }
        else {
            console.warn("Twilio not configured, skipping SMS notification");
        }
        // Update wait list entry to mark as notified
        const updatedEntry = await prisma_1.default.waitList.update({
            where: { id },
            data: { notified: true },
        });
        // Log the action
        await prisma_1.default.auditLog.create({
            data: {
                userId: req.user.sub,
                action: "NOTIFY",
                entity: "WAITLIST",
                entityId: id,
                details: {
                    customerName: waitListEntry.customerName,
                    phoneNumber: waitListEntry.phoneNumber,
                },
            },
        });
        return server_1.NextResponse.json(updatedEntry);
    }
    catch (error) {
        console.error("Error notifying customer:", error);
        return server_1.NextResponse.json({ error: "Failed to notify customer" }, { status: 500 });
    }
});
