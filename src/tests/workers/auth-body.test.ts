import { describe, expect, it } from "vitest";
import { readBodyAtMost } from "../../pages/api/auth";

function fakeRequest(
  headers: Record<string, string>,
  body?: Uint8Array | string,
): Request {
  const stream =
    body === undefined ? null : new Response(body as BodyInit).body;
  return {
    headers: new Headers(headers),
    body: stream,
  } as unknown as Request;
}

const MAX = 16;

describe("readBodyAtMost", () => {
  it("reads a small in-bounds body", async () => {
    const res = await readBodyAtMost(
      fakeRequest({ "Content-Length": "5" }, "hello"),
      MAX,
    );
    expect(res).toEqual({ ok: true, text: "hello" });
  });

  it("accepts bodies without Content-Length (chunked)", async () => {
    const res = await readBodyAtMost(fakeRequest({}, "chunky"), MAX);
    expect(res).toEqual({ ok: true, text: "chunky" });
  });

  it("returns ok for empty bodies", async () => {
    const res = await readBodyAtMost(
      fakeRequest({ "Content-Length": "0" }),
      MAX,
    );
    expect(res).toEqual({ ok: true, text: "" });
    const res2 = await readBodyAtMost(fakeRequest({}), MAX);
    expect(res2).toEqual({ ok: true, text: "" });
  });

  it("rejects malformed Content-Length with 400", async () => {
    for (const bad of ["-1", "1.5", "abc", "+8"]) {
      const req = fakeRequest({ "Content-Length": bad }, "x");
      const res = await readBodyAtMost(req, MAX);
      expect(res, `CL=${bad} raw=${req.headers.get("Content-Length")}`).toEqual(
        {
          ok: false,
          status: 400,
        },
      );
    }
  });

  it("rejects oversized declared Content-Length with 413", async () => {
    const res = await readBodyAtMost(
      fakeRequest({ "Content-Length": String(MAX + 1) }, ""),
      MAX,
    );
    expect(res).toEqual({ ok: false, status: 413 });
  });

  it("cancels and rejects streams that exceed the cap mid-flight", async () => {
    const big = new Uint8Array(MAX * 4).fill(0x41);
    const res = await readBodyAtMost(fakeRequest({}, big), MAX);
    expect(res).toEqual({ ok: false, status: 413 });
  });

  it("rejects invalid UTF-8 payloads with 400", async () => {
    const res = await readBodyAtMost(
      fakeRequest({}, new Uint8Array([0xff, 0xfe, 0xfa])),
      MAX,
    );
    expect(res).toEqual({ ok: false, status: 400 });
  });

  it("handles multi-chunk bodies exactly at the cap", async () => {
    const body = new TextEncoder().encode(JSON.stringify({ a: 1 }));
    const res = await readBodyAtMost(fakeRequest({}, body), body.byteLength);
    expect(res).toEqual({ ok: true, text: JSON.stringify({ a: 1 }) });
  });
});
