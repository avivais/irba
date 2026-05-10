import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  hash: vi.fn(),
  randomInt: vi.fn(),
  findFirst: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  sendWaMessage: vi.fn(),
  writeAuditLog: vi.fn(),
}));

vi.mock("@/lib/admin-guard", () => ({
  requireAdmin: mocks.requireAdmin,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    player: {
      findFirst: mocks.findFirst,
      findUnique: mocks.findUnique,
      update: mocks.update,
    },
  },
}));

vi.mock("@/lib/wa-notify", () => ({
  sendWaGroupMessage: vi.fn(),
  sendWaMessage: mocks.sendWaMessage,
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: mocks.writeAuditLog,
}));

vi.mock("bcryptjs", () => ({
  hash: mocks.hash,
}));

vi.mock("crypto", () => ({
  randomInt: mocks.randomInt,
}));

import { sendAdminTestOtpAction } from "./actions";

describe("sendAdminTestOtpAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.WA_NOTIFY_ENABLED = "true";
    mocks.requireAdmin.mockResolvedValue("admin-player-id");
    mocks.hash.mockResolvedValue("hashed-otp");
    mocks.randomInt.mockReturnValue(123456);
    mocks.findFirst.mockResolvedValue({ phone: "0509999999" });
    mocks.findUnique.mockResolvedValue({ id: "target-player-id" });
    mocks.update.mockResolvedValue({});
    mocks.sendWaMessage.mockResolvedValue(undefined);
  });

  it("normalizes phone, stores a hashed OTP, and forwards the raw code to the admin phone", async () => {
    const fd = new FormData();
    fd.set("phone", "050-123-4567");

    const result = await sendAdminTestOtpAction({ ok: false, message: "" }, fd);

    expect(result).toEqual({ ok: true, message: "קוד נוצר ונשלח לוואטסאפ של האדמין" });
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { phone: "0501234567" },
      select: { id: true },
    });
    expect(mocks.hash).toHaveBeenCalledWith("123456", 8);
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "target-player-id" },
      data: {
        otpCode: "hashed-otp",
        otpExpiresAt: expect.any(Date),
      },
    });
    expect(mocks.sendWaMessage).toHaveBeenCalledWith(
      "0509999999",
      "קוד בדיקה ל-IRBA עבור 0501234567: 123456\nהקוד תקף ל-10 דקות.",
    );
    expect(mocks.writeAuditLog).toHaveBeenCalledWith({
      actor: "admin",
      action: "SEND_ADMIN_TEST_OTP",
      entityType: "Player",
      entityId: "target-player-id",
      after: { targetPhone: "0501234567", adminPhone: "0509999999" },
    });
  });

  it("does not create an OTP when WhatsApp sending is disabled", async () => {
    process.env.WA_NOTIFY_ENABLED = "false";
    const fd = new FormData();
    fd.set("phone", "0501234567");

    const result = await sendAdminTestOtpAction({ ok: false, message: "" }, fd);

    expect(result).toEqual({ ok: false, message: "שליחת WhatsApp כבויה בסביבה הזו" });
    expect(mocks.findUnique).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.sendWaMessage).not.toHaveBeenCalled();
  });

  it("does not create players for unknown phones", async () => {
    mocks.findUnique.mockResolvedValue(null);
    const fd = new FormData();
    fd.set("phone", "0501234567");

    const result = await sendAdminTestOtpAction({ ok: false, message: "" }, fd);

    expect(result).toEqual({
      ok: false,
      message: "שחקן לא נמצא — בקש ממנו להזין את הטלפון במסך הכניסה תחילה",
    });
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.sendWaMessage).not.toHaveBeenCalled();
  });

  it("rejects invalid phone numbers before touching the database", async () => {
    const fd = new FormData();
    fd.set("phone", "123");

    const result = await sendAdminTestOtpAction({ ok: false, message: "" }, fd);

    expect(result.ok).toBe(false);
    expect(result.message).toContain("מספר טלפון לא תקין");
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });
});
