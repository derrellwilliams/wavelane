import { describe, expect, it } from "vitest";
import { PLATFORM, inputFor, isAndroid } from "./platform";

describe("platform switch", () => {
  it("the tablet uses touch and leaves the d-pad engine off", () => {
    expect(inputFor("android")).toEqual({ dpad: false, touch: true });
  });
  it("the TV keeps the d-pad engine and has no touch handling", () => {
    expect(inputFor("webos")).toEqual({ dpad: true, touch: false });
  });
  it("tests and the TV build run as webOS", () => {
    expect(PLATFORM).toBe("webos");
    expect(isAndroid).toBe(false);
  });
});
