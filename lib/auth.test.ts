import { hashPassword, verifyPassword } from "./auth";

describe("hashPassword / verifyPassword", () => {
  it("round-trips: a hash verifies against its original password", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    await expect(verifyPassword("correct-horse-battery-staple", hash)).resolves.toBe(true);
  });

  it("rejects a wrong password against the hash", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    await expect(verifyPassword("wrong-password", hash)).resolves.toBe(false);
  });

  it("produces a different hash each time (salted)", async () => {
    const hashA = await hashPassword("same-input");
    const hashB = await hashPassword("same-input");
    expect(hashA).not.toBe(hashB);
  });
});
