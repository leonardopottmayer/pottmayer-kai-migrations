import { describe, it, expect } from "vitest";
import { KaiError } from "../src/errors";

describe("KaiError", () => {
  it("is an instance of Error", () => {
    expect(new KaiError("oops")).toBeInstanceOf(Error);
  });

  it("has name KaiError", () => {
    expect(new KaiError("oops").name).toBe("KaiError");
  });

  it("defaults to exitCode 1", () => {
    expect(new KaiError("oops").exitCode).toBe(1);
  });

  it("accepts a custom exitCode", () => {
    expect(new KaiError("pending", 2).exitCode).toBe(2);
  });

  it("stores the message", () => {
    expect(new KaiError("something went wrong").message).toBe("something went wrong");
  });
});
