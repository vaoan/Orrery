import { describe, it, expect } from "vitest";
import { createGithub, resolveToken, GithubError } from "../src/lib/github.mjs";

const jsonResponse = (status, body) => ({
  status,
  ok: status < 400,
  json: async () => body,
  text: async () => JSON.stringify(body),
});

describe("resolveToken", () => {
  it("prefers ORRERY_GH_TOKEN over GITHUB_TOKEN over gh", () => {
    expect(resolveToken({ ORRERY_GH_TOKEN: "a", GITHUB_TOKEN: "b" }, () => "c")).toBe("a");
    expect(resolveToken({ GITHUB_TOKEN: "b" }, () => "c")).toBe("b");
    expect(resolveToken({}, () => "c\n")).toBe("c");
  });

  it("throws naming every source when none yields a token", () => {
    expect(() => resolveToken({}, () => "")).toThrow(/ORRERY_GH_TOKEN.*GITHUB_TOKEN.*gh auth token/s);
  });
});

describe("createGithub", () => {
  it("sends JSON with the token and parses the response", async () => {
    const calls = [];
    const fetchImpl = async (url, init) => {
      calls.push({ url, init });
      return jsonResponse(200, { ok: true });
    };
    const gh = createGithub({ token: "t", fetchImpl });
    const result = await gh.request("PATCH", "/repos/vaoan/x", { allow_auto_merge: true });
    expect(result).toEqual({ status: 200, data: { ok: true } });
    expect(calls[0].url).toBe("https://api.github.com/repos/vaoan/x");
    expect(calls[0].init.method).toBe("PATCH");
    expect(calls[0].init.headers.Authorization).toBe("Bearer t");
    expect(JSON.parse(calls[0].init.body)).toEqual({ allow_auto_merge: true });
  });

  it("resolves 404 to null data instead of throwing", async () => {
    const gh = createGithub({ token: "t", fetchImpl: async () => jsonResponse(404, { message: "Not Found" }) });
    expect(await gh.request("GET", "/repos/vaoan/x/branches/develop")).toEqual({ status: 404, data: null });
  });

  it("throws GithubError carrying status and message on other failures", async () => {
    const gh = createGithub({ token: "t", fetchImpl: async () => jsonResponse(422, { message: "Validation Failed" }) });
    await expect(gh.request("PUT", "/x")).rejects.toMatchObject({ status: 422, message: /Validation Failed/ });
    await expect(gh.request("PUT", "/x")).rejects.toBeInstanceOf(GithubError);
  });

  it("treats 204 as success with null data", async () => {
    const gh = createGithub({ token: "t", fetchImpl: async () => ({ status: 204, ok: true, json: async () => { throw new Error("no body"); }, text: async () => "" }) });
    expect(await gh.request("DELETE", "/x")).toEqual({ status: 204, data: null });
  });

  it("surfaces a non-JSON error body as the GithubError message", async () => {
    let callCount = 0;
    const fetchImpl = async () => {
      callCount = 0;
      return {
        status: 502,
        ok: false,
        text: async () => {
          callCount++;
          if (callCount > 1) throw new TypeError("Body is unusable: Body has already been read");
          return "<html>Bad gateway</html>";
        },
        json: async () => {
          callCount++;
          if (callCount > 1) throw new TypeError("Body is unusable: Body has already been read");
          throw new SyntaxError("Unexpected token <");
        },
      };
    };
    const gh = createGithub({ token: "t", fetchImpl });
    await expect(gh.request("GET", "/x")).rejects.toMatchObject({ status: 502, message: /Bad gateway/ });
    await expect(gh.request("GET", "/x")).rejects.toBeInstanceOf(GithubError);
  });

  it("uses the raw body when JSON has no message", async () => {
    const gh = createGithub({ token: "t", fetchImpl: async () => ({ status: 422, ok: false, text: async () => '{"errors":[{"field":"contexts"}]}', json: async () => { throw new SyntaxError("unexpected"); } }) });
    await expect(gh.request("PUT", "/x")).rejects.toMatchObject({ status: 422, message: /contexts/ });
    await expect(gh.request("PUT", "/x")).rejects.toBeInstanceOf(GithubError);
  });
});
